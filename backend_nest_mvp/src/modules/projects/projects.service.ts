import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { Queue } from 'bull';
import { LibraryService } from '../library/library.service';
import { Project, ProjectDocument } from './schemas/project.schema';
import { Job, JobDocument } from './schemas/job.schema';
import * as fs from 'fs';
import * as path from 'path';

export const TRANSCRIPTION_QUEUE = 'transcription';

function envBool(v: string | undefined, def: boolean) {
  if (v === undefined || v === '') return def;
  return ['1', 'true', 'yes', 'y', 'on'].includes(v.toLowerCase());
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly library: LibraryService,
    private readonly config: ConfigService,
    @InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>,
    @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>,
    @InjectQueue(TRANSCRIPTION_QUEUE) private readonly queue: Queue,
  ) {}
async createProjectFromExisting(
  ownerId: string,
  name: string,
  mediaDocumentId: string,
  srtText: string,
  settings: Record<string, any> = {},
) {
  // valida media existe
  const mediaDoc = await this.library.getDocument(ownerId, mediaDocumentId);
  if (!mediaDoc.media?.path) throw new NotFoundException('Media document not found or has no media');

  // opcional: evitar duplicado de nombre (si ya lo implementaste)
  // const exists = await this.library.folderNameExists(ownerId, name, null);
  // if (exists) throw new ConflictException(`Project "${name}" already exists`);

  // crea folder proyecto
  const folder = await this.library.createFolder(ownerId, name);

  // crea SRT document con texto (NO locked)
  const srtDoc = await this.library.createDocument(ownerId, {
    name: `${name}.srt`,
    parentId: folder.id,
    sourceType: 'srt',
    contentByLang: { _unassigned: srtText },
    isLocked: false,
  } as any);

  const project = await this.projectModel.create({
    ownerId,
    folderId: folder.id,
    mediaDocumentId,
    srtDocumentId: srtDoc.id,
    status: 'ready',
    settings,
    lastError: null,
  });

  return {
    project: { ...project.toObject(), id: project._id.toString() },
    folder,
    srtDocument: srtDoc,
  };
}

async listProjects(ownerId: string) {
  const rows = await this.projectModel.find({ ownerId }).sort({ createdAt: -1 }).lean();
  return rows.map((p: any) => ({ ...p, id: p._id.toString() }));
}
  /**
   * Helper para que el worker obtenga el path real del media en disco
   */
async getMediaPath(ownerId: string, mediaDocumentId: string) {
  const doc = await this.library.getDocument(ownerId, mediaDocumentId);
  if (!doc.media?.path) {
    throw new NotFoundException('Media document not found or has no media path');
  }else if (doc.isDeleted) {
  throw new NotFoundException('Media not found');
}

  const mediaRoot = this.config.get<string>('MEDIA_ROOT', './media');
  const mediaRootAbs = path.isAbsolute(mediaRoot) ? mediaRoot : path.join(process.cwd(), mediaRoot);

  const root = path.resolve(mediaRootAbs);
  const rootCmp = (root.endsWith(path.sep) ? root : root + path.sep).toLowerCase();

  const storedNative = String(doc.media.path).split('/').join(path.sep);

  const abs = path.isAbsolute(storedNative)
    ? path.resolve(storedNative)
    : path.resolve(root, storedNative);

  if (!abs.toLowerCase().startsWith(rootCmp)) {
    throw new NotFoundException('Invalid media path');
  }

  if (fs.existsSync(abs)) return abs;

  // fallback: si solo guardaste filename
  const alt = path.join(root, path.basename(storedNative));
  if (fs.existsSync(alt)) return alt;

  throw new NotFoundException(`Media file not found on disk`);
}

  /**
   * Crea el proyecto:
   * - crea carpeta (Folder)
   * - crea documento SRT locked
   * - crea Project
   * - crea Job
   * - encola Bull job con settings
   */
  async createProject(
    ownerId: string,
    name: string,
    mediaDocumentId: string,
    settings: Record<string, any> = {},
  ) {
    // valida media existe
    const mediaDoc = await this.library.getDocument(ownerId, mediaDocumentId);
    if (!mediaDoc.media?.path) throw new NotFoundException('Media document not found or has no media');

    // defaults desde .env (si el frontend no manda settings)
    const defaults = {
      model: this.config.get<string>('WHISPERX_MODEL', 'small'),
      profile: this.config.get<string>('WHISPERX_PROFILE', 'VE'),
      language: this.config.get<string>('WHISPERX_LANGUAGE', ''),
      batchSize: Number(this.config.get<string>('WHISPERX_BATCH_SIZE', '8')),
      device: this.config.get<string>('WHISPERX_DEVICE', 'cpu'),
      diarization: envBool(this.config.get<string>('WHISPERX_DIARIZATION'), true),
      offline: envBool(this.config.get<string>('WHISPERX_OFFLINE'), false),
    };

    const exists = await this.library.folderNameExists(ownerId, name, null);
if (exists) {
  // Conflict es más correcto que NotFound
  throw new (require('@nestjs/common').ConflictException)(`Project "${name}" already exists`);
} 

    // settings finales: defaults + lo que mande el frontend
    const finalSettings = { ...defaults, ...(settings ?? {}) };

    const folder = await this.library.createFolder(ownerId, name);

    const srtDoc = await this.library.createDocument(ownerId, {
      name: `${name}.srt`,
      parentId: folder.id,
      sourceType: 'srt',
      contentByLang: { _unassigned: '' },
      isLocked: true,
    } as any);

    const project = await this.projectModel.create({
      ownerId,
      folderId: folder.id,
      mediaDocumentId,
      srtDocumentId: srtDoc.id,
      status: 'processing',
      settings: finalSettings,
      lastError: null,
    });

    const projectId = project._id.toString();

    const dbJob = await this.jobModel.create({
      ownerId,
      projectId,
      type: 'transcription',
      status: 'queued',
      progress: 0,
      error: null,
    });

    const jobId = dbJob._id.toString();

    // 🔥 clave: pasamos settings al worker
    await this.queue.add('transcribe', {
      ownerId,
      projectId,
      jobId,
      settings: finalSettings,
    });

    return {
      project: { ...project.toObject(), id: projectId },
      folder,
      srtDocument: srtDoc,
      job: { ...dbJob.toObject(), id: jobId },
    };
  }

  async getProject(ownerId: string, id: string) {
    const project = await this.projectModel.findOne({ _id: id, ownerId }).lean();
    if (!project) throw new NotFoundException('Project not found');
    return { ...project, id: project._id.toString() };
  }

  async getProjectBySrt(ownerId: string, srtDocumentId: string) {
    // ✅ FIX: el campo es srtDocumentId
    const project = await this.projectModel.findOne({ ownerId, srtDocumentId }).lean();
    if (!project) throw new NotFoundException('Project not found for this SRT');
    return { ...project, id: project._id.toString() };
  }

  async getJob(ownerId: string, id: string) {
    const job = await this.jobModel.findOne({ _id: id, ownerId }).lean();
    if (!job) throw new NotFoundException('Job not found');
    return { ...job, id: job._id.toString() };
  }

  async updateJob(jobId: string, patch: Partial<Job>) {
    await this.jobModel.updateOne({ _id: jobId }, patch);
  }

  async updateProject(projectId: string, patch: Partial<Project>) {
    await this.projectModel.updateOne({ _id: projectId }, patch);
  }

  async setSrtContent(ownerId: string, srtDocumentId: string, srtText: string) {
    await this.library.updateDocument(ownerId, srtDocumentId, {
      contentByLang: { _unassigned: srtText },
      isLocked: false,
    } as any);
  }
}

