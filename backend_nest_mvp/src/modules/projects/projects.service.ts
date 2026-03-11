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

async listProjects() {
  const rows = await this.projectModel.find().sort({ createdAt: -1 }).lean();
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

  async getProject(id: string) {
    const project = await this.projectModel.findOne({ _id: id }).lean();
    if (!project) throw new NotFoundException('Project not found');
    return { ...project, id: project._id.toString() };
  }

  async getProjectBySrt(srtDocumentId: string) {
    const project = await this.projectModel.findOne({ srtDocumentId }).lean();
    if (!project) throw new NotFoundException('Project not found for this SRT');
    return { ...project, id: project._id.toString() };
  }

  async getJob(id: string) {
    const job = await this.jobModel.findOne({ _id: id }).lean();
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
   * Extrae texto plano de un buffer DOCX/RTF/PDF/TXT usando guion_converter.py.
   * Preserva tabuladors (SPEAKER\ttext) i estructura SONILAB.
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

      if (ext === '.txt') {
        // TXT: llegir directament sense subprocess
        try {
          return fs.readFileSync(tmpPath, 'utf-8');
        } catch {
          return fs.readFileSync(tmpPath, 'latin1');
        }
      }

      if (ext === '.pdf') {
        // PDF: script inline (pdfminer.six / pdftotext)
        const pdfScript = `
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
        print('ERROR: No es pot extreure text del PDF. Instal·la pdfminer.six o pdftotext.')
        sys.exit(1)
`.trim();
        const scriptPath = path.join(require('os').tmpdir(), `guion_pdf_${Date.now()}.py`);
        fs.writeFileSync(scriptPath, pdfScript, 'utf-8');
        try {
          const result = execSync(`${pythonExec} "${scriptPath}" "${tmpPath}"`, {
            encoding: 'utf-8',
            timeout: 30000,
          });
          return result.trim();
        } finally {
          if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
        }
      }

      // DOCX / RTF → guion_converter.py (preserva tabuladors SONILAB)
      if (ext === '.docx' || ext === '.rtf') {
        // Localitzar guion_converter.py relatiu al runner
        const runnerDir = this.config.get<string>(
          'PYTHON_RUNNER_DIR',
          path.join(process.cwd(), '..', 'WhisperX_Sonilab_01-main', 'src'),
        );
        const converterScript = path.join(runnerDir, 'guion_converter.py');

        if (!fs.existsSync(converterScript)) {
          throw new Error(`guion_converter.py not found at: ${converterScript}`);
        }

        const result = execSync(
          `${pythonExec} "${converterScript}" "${tmpPath}"`,
          { encoding: 'utf-8', timeout: 30000 },
        );
        return result.trim();
      }

      throw new Error(`Format no suportat: ${ext}`);
    } finally {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
  }

  /**
   * Vincula o actualiza el contenido del guión de un proyecto.
   * Crea un Document de tipo 'guion' en la carpeta del proyecto si no existe.
   */
  async setGuionContent(
    projectId: string,
    guionText: string,
    guionName?: string,
  ): Promise<{ guionDocumentId: string }> {
    const project = await this.getProject(projectId);
    const ownerId = (project as any).ownerId;

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
      { _id: projectId },
      { $set: { guionDocumentId: guionDoc.id } },
    );

    return { guionDocumentId: guionDoc.id };
  }

  /**
   * Obtiene el contenido de texto del guión vinculado al proyecto.
   */
  async getGuionContent(projectId: string): Promise<{ text: string | null; guionDocumentId: string | null }> {
    const project = await this.getProject(projectId);
    const ownerId = (project as any).ownerId;
    if (!project.guionDocumentId) return { text: null, guionDocumentId: null };

    try {
      const doc = await this.library.getDocument(ownerId, project.guionDocumentId);
      const text = (doc as any).contentByLang?.['raw'] || null;
      return { text, guionDocumentId: project.guionDocumentId };
    } catch {
      return { text: null, guionDocumentId: project.guionDocumentId };
    }
  }

  /**
   * Corregeix el text de la transcripció SRT del projecte usant el guió vinculat.
   *
   * Executa transcript_corrector.py (Python) de manera síncrona.
   * Retorna el SRT corregit + JSON de canvis. NO modifica el projecte automàticament;
   * l'usuari ha de confirmar i cridar applyCorrectedSrt si vol desar.
   */
  async correctTranscript(
    projectId: string,
    options: { threshold?: number; window?: number; llmMode?: string; llmModel?: string } = {},
  ): Promise<{
    correctedSrt: string;
    changes: any[];
    summary: { totalSegments: number; changed: number; unchanged: number };
  }> {
    const { execSync } = require('child_process');
    const os = require('os');

    const project = await this.getProject(projectId);
    const ownerId = (project as any).ownerId;

    // Obtenir SRT de transcripció
    if (!project.srtDocumentId) {
      throw new (require('@nestjs/common').BadRequestException)('El projecte no té SRT de transcripció');
    }
    const srtDoc = await this.library.getDocument(ownerId, project.srtDocumentId);
    const srtText: string = (srtDoc as any).contentByLang?.['_unassigned']
      || Object.values((srtDoc as any).contentByLang || {})[0]
      || '';
    if (!srtText.trim()) {
      throw new (require('@nestjs/common').BadRequestException)('El SRT de transcripció és buit');
    }

    // Obtenir guió
    const { text: guionText } = await this.getGuionContent(projectId);
    if (!guionText?.trim()) {
      throw new (require('@nestjs/common').BadRequestException)(
        'No hi ha guió vinculat al projecte. Puja el guió primer.',
      );
    }

    // Escriure fitxers temporals
    const tmpDir = os.tmpdir();
    const ts = Date.now();
    const srtTmp = path.join(tmpDir, `correct_srt_${ts}.srt`);
    const guionTmp = path.join(tmpDir, `correct_guion_${ts}.txt`);
    const outSrtTmp = path.join(tmpDir, `correct_out_${ts}.srt`);
    const outJsonTmp = path.join(tmpDir, `correct_changes_${ts}.json`);

    fs.writeFileSync(srtTmp, srtText, 'utf-8');
    fs.writeFileSync(guionTmp, guionText, 'utf-8');

    try {
      const pythonExec = this.config.get<string>('PYTHON_EXEC', 'python');
      const runnerDir = this.config.get<string>(
        'PYTHON_RUNNER_DIR',
        path.join(process.cwd(), '..', 'WhisperX_Sonilab_01-main', 'src'),
      );
      const correctorScript = path.join(runnerDir, 'transcript_corrector.py');

      if (!fs.existsSync(correctorScript)) {
        throw new Error(`transcript_corrector.py not found at: ${correctorScript}`);
      }

      const threshold = options.threshold ?? 0.45;
      const window = options.window ?? 8;
      const llmMode = options.llmMode && ['off', 'fast', 'smart'].includes(options.llmMode)
        ? options.llmMode : 'off';
      const llmModel = options.llmModel || 'llama3.1';

      const rawOutput = execSync(
        `${pythonExec} "${correctorScript}" --srt "${srtTmp}" --guion "${guionTmp}" --out-srt "${outSrtTmp}" --out-json "${outJsonTmp}" --threshold ${threshold} --window ${window} --llm-mode ${llmMode} --llm-model ${llmModel}`,
        { encoding: 'utf-8', timeout: 60000 },
      );

      const summary = JSON.parse(rawOutput.trim());
      if (summary.error) {
        throw new Error(summary.error);
      }

      const correctedSrt = fs.readFileSync(outSrtTmp, 'utf-8');
      const changesRaw = fs.readFileSync(outJsonTmp, 'utf-8');
      const changesData = JSON.parse(changesRaw);

      return {
        correctedSrt,
        changes: changesData.changes || [],
        summary: {
          totalSegments: summary.total_segments,
          changed: summary.changed,
          unchanged: summary.unchanged,
        },
      };
    } finally {
      for (const f of [srtTmp, guionTmp, outSrtTmp, outJsonTmp]) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      }
    }
  }

  /**
   * Aplica un SRT corregit (prèviament generat per correctTranscript) al projecte.
   * Substitueix el contingut del document SRT del projecte.
   */
  async applyCorrectedSrt(projectId: string, correctedSrt: string): Promise<void> {
    const project = await this.getProject(projectId);
    const ownerId = (project as any).ownerId;
    if (!project.srtDocumentId) {
      throw new (require('@nestjs/common').BadRequestException)('El projecte no té SRT de transcripció');
    }
    await this.setSrtContent(ownerId, project.srtDocumentId, correctedSrt);
  }
}

