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

  /**
   * Extrae texto plano de un buffer DOCX o PDF usando Python.
   * Devuelve el texto extraído (formato del guión intacto).
   */
  async extractTextFromFile(buffer: Buffer, originalName: string): Promise<string> {
    const ext = path.extname(originalName).toLowerCase();
    const tmpPath = path.join(
      require('os').tmpdir(),
      `guion_upload_${Date.now()}${ext}`,
    );
    fs.writeFileSync(tmpPath, buffer);

    try {
      const pythonExec = this.config.get<string>('PYTHON_EXEC', 'python');
      const { execSync } = require('child_process');

      let script: string;
      if (ext === '.docx') {
        script = `
import sys, zipfile, re
from xml.etree import ElementTree as ET
def extract_docx(path):
    ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
    with zipfile.ZipFile(path) as zf:
        xml = zf.read('word/document.xml')
    root = ET.fromstring(xml)
    lines = []
    for p in root.iter(f'{ns}p'):
        text = ''.join((r.text or '') for r in p.iter(f'{ns}t'))
        lines.append(text)
    # eliminar lineas completamente vacias al principio/final y colapsar multiples vacias
    result = []
    prev_empty = False
    for line in lines:
        if not line.strip():
            if not prev_empty and result:
                result.append('')
            prev_empty = True
        else:
            result.append(line)
            prev_empty = False
    print('\\n'.join(result).strip())
extract_docx(sys.argv[1])
`.trim();
      } else if (ext === '.pdf') {
        script = `
import sys
try:
    import pdfminer.high_level as hl
    text = hl.extract_text(sys.argv[1])
    print(text.strip())
except ImportError:
    try:
        import subprocess
        r = subprocess.run(['pdftotext', sys.argv[1], '-'], capture_output=True, text=True)
        print(r.stdout.strip())
    except Exception:
        print('ERROR: No se puede extraer texto del PDF. Instala pdfminer.six o pdftotext.')
        sys.exit(1)
`.trim();
      } else {
        // .txt u otro: leer directamente
        return fs.readFileSync(tmpPath, 'utf-8');
      }

      const scriptPath = path.join(require('os').tmpdir(), `guion_extract_${Date.now()}.py`);
      fs.writeFileSync(scriptPath, script, 'utf-8');

      const result = execSync(`${pythonExec} "${scriptPath}" "${tmpPath}"`, {
        encoding: 'utf-8',
        timeout: 30000,
      });

      fs.unlinkSync(scriptPath);
      return result.trim();
    } finally {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
  }

  /**
   * Vincula o actualiza el contenido del guión de un proyecto.
   * Crea un Document de tipo 'guion' en la carpeta del proyecto si no existe.
   */
  async setGuionContent(
    ownerId: string,
    projectId: string,
    guionText: string,
    guionName?: string,
  ): Promise<{ guionDocumentId: string }> {
    const project = await this.getProject(ownerId, projectId);

    if (project.guionDocumentId) {
      // Actualizar documento existente
      await this.library.updateDocument(ownerId, project.guionDocumentId, {
        contentByLang: { raw: guionText },
      } as any);
      return { guionDocumentId: project.guionDocumentId };
    }

    // Crear nuevo documento de guión
    const docName = guionName || `guion_${projectId}.txt`;
    const guionDoc = await this.library.createDocument(ownerId, {
      name: docName,
      parentId: project.folderId,
      sourceType: 'guion',
      contentByLang: { raw: guionText },
      isLocked: false,
    } as any);

    await this.projectModel.updateOne(
      { _id: projectId, ownerId },
      { $set: { guionDocumentId: guionDoc.id } },
    );

    return { guionDocumentId: guionDoc.id };
  }

  /**
   * Obtiene el contenido de texto del guión vinculado al proyecto.
   */
  async getGuionContent(ownerId: string, projectId: string): Promise<{ text: string | null; guionDocumentId: string | null }> {
    const project = await this.getProject(ownerId, projectId);
    if (!project.guionDocumentId) return { text: null, guionDocumentId: null };

    try {
      const doc = await this.library.getDocument(ownerId, project.guionDocumentId);
      const text = (doc as any).contentByLang?.['raw'] || null;
      return { text, guionDocumentId: project.guionDocumentId };
    } catch {
      return { text: null, guionDocumentId: project.guionDocumentId };
    }
  }
}

