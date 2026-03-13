import { Process, Processor } from '@nestjs/bull';
import { Job as BullJob } from 'bull';
import { ConfigService } from '@nestjs/config';
import { ProjectsService, TRANSCRIPTION_QUEUE } from './projects.service';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promises as fsp } from 'fs';

type TranscribeJobPayload = {
  ownerId: string;
  projectId: string;
  jobId: string;
  settings?: Record<string, any>;
};

function ensureDirSync(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function resolveMediaRoot(mediaRootEnv?: string) {
  const mediaRoot = mediaRootEnv || './media';
  return path.isAbsolute(mediaRoot) ? mediaRoot : path.join(process.cwd(), mediaRoot);
}

function envBool(v: string | undefined, def: boolean) {
  if (v === undefined || v === '') return def;
  return ['1', 'true', 'yes', 'y', 'on'].includes(v.toLowerCase());
}

@Processor(TRANSCRIPTION_QUEUE)
export class TranscriptionProcessor {
  constructor(
    private readonly projects: ProjectsService,
    private readonly config: ConfigService,
  ) {}

  @Process('transcribe')
  async handle(job: BullJob<TranscribeJobPayload>) {
    const { ownerId, projectId, jobId } = job.data;
    console.log('[TRANSCRIBE] handle start', job.id, job.data);
    try {
      await this.projects.updateJob(jobId, { status: 'processing', progress: 5 } as any);
      await this.projects.updateProject(projectId, { status: 'processing', lastError: null } as any);

      // 1) Cargar proyecto y ruta real del vídeo/audio en disco
      const project = await this.projects.getProject(projectId);
      const mediaPath = await this.projects.getMediaPath(ownerId, project.mediaDocumentId);

      // 2) Preparar salida dentro del backend: MEDIA_ROOT/projects/<projectId>/whisperx
      const mediaRootAbs = resolveMediaRoot(this.config.get<string>('MEDIA_ROOT'));
      const outDir = path.join(mediaRootAbs, 'projects', projectId, 'whisperx');
      ensureDirSync(outDir);

      // 3) Defaults desde .env y merge con settings del job
      const defaults = {
        model: this.config.get<string>('WHISPERX_MODEL', 'large-v3'),
        engine: this.config.get<string>('WHISPERX_ENGINE', 'faster-whisper'),
        profile: this.config.get<string>('WHISPERX_PROFILE', 'VE'),
        language: this.config.get<string>('WHISPERX_LANGUAGE', ''),
        batchSize: Number(this.config.get<string>('WHISPERX_BATCH_SIZE', '8')),
        device: this.config.get<string>('WHISPERX_DEVICE', 'cpu'),
        diarization: envBool(this.config.get<string>('WHISPERX_DIARIZATION'), true),
        offline: envBool(this.config.get<string>('WHISPERX_OFFLINE'), false),
        timingFix: envBool(this.config.get<string>('WHISPERX_TIMING_FIX'), true),
      };

      const s: typeof defaults & Record<string, any> = { ...defaults, ...(job.data.settings || project.settings || {}) };

      const model = String(s.model || 'large-v3');
      const engine = String(s.engine || 'faster-whisper');
      const profile = String(s.profile || 'VE');
      const language = String(s.language || '');
      const batchSize = String(s.batchSize ?? 8);
      const device = String(s.device || 'cpu');
      const diarization = Boolean(s.diarization);
      const offline = Boolean(s.offline);
      const timingFix = s.timingFix !== false;
      const scriptText = String(s.scriptText || '').trim();

      // ─── PURFVIEW REAL EXE CHECK ──────────────────────────────────────────────
      // Si PURFVIEW_XXL_EXE_PATH apunta a un faster-whisper-xxl.exe real i l'engine
      // és purfview-xxl, s'executa el .exe directament en comptes del pipeline Python.
      // Fallback automàtic al pipeline Python si el .exe no existeix o l'env no està set.
      const purfviewExePath = (this.config.get<string>('PURFVIEW_XXL_EXE_PATH', '') || '').trim();
      const usePurfviewExe = engine === 'purfview-xxl' && !!purfviewExePath && fs.existsSync(purfviewExePath);

      if (engine === 'purfview-xxl') {
        if (usePurfviewExe) {
          console.log(`[PURFVIEW-EXE] Real exe trodat: ${purfviewExePath}`);
        } else if (purfviewExePath) {
          console.warn(`[PURFVIEW-EXE] PURFVIEW_XXL_EXE_PATH configurat (${purfviewExePath}) però el fitxer no existeix. Fallback al pipeline Python.`);
        } else {
          console.log(`[PURFVIEW-EXE] PURFVIEW_XXL_EXE_PATH no configurat. S'usa el pipeline Python per a purfview-xxl.`);
        }
      }

      if (usePurfviewExe) {
        // ── Ruta A: Exe real de Purfview ──────────────────────────────────────
        await this.projects.updateJob(jobId, { progress: 15 } as any);
        job.progress(15);

        const exeArgs: string[] = ['--beep_off', '--standard'];
        if (language) exeArgs.push('--language', language);
        exeArgs.push('--model', model);
        // El .exe output al directori del vídeo d'entrada (comportament per defecte)
        exeArgs.push(mediaPath);

        console.log(`[PURFVIEW-EXE] Device: ${device} | Language: ${language || 'auto'} | Model: ${model}`);
        console.log(`[PURFVIEW-EXE] Executant: “${purfviewExePath}” ${exeArgs.join(' ')}`);

        const { stderr: exeStderr, exitCode: exeExitCode } = await new Promise<{
          stderr: string;
          exitCode: number;
        }>((resolve, reject) => {
          const child = spawn(purfviewExePath, exeArgs, {
            cwd: path.dirname(purfviewExePath),
            env: { ...process.env },
            stdio: ['ignore', 'pipe', 'pipe'],
          });

          let stderrBuf = '';
          let bumped = false;

          child.stdout.on('data', (d: Buffer) => {
            const s = d.toString();
            // Log exe stdout for debugging
            process.stdout.write(`[PURFVIEW-EXE] ${s}`);
            if (!bumped) {
              bumped = true;
              this.projects.updateJob(jobId, { progress: 50 } as any).catch(() => {});
              job.progress(50);
            }
          });

          child.stderr.on('data', (d: Buffer) => {
            stderrBuf += d.toString();
          });

          child.on('error', reject);
          child.on('close', (code) => resolve({ stderr: stderrBuf, exitCode: code ?? 1 }));
        });

        if (exeExitCode !== 0) {
          throw new Error(`faster-whisper-xxl.exe ha fallat (exit ${exeExitCode}).\nSTDERR:\n${exeStderr || '(buit)'}`);
        }

        // Buscar SRT output: per defecte el .exe escriu al directori del vídeo amb el mateix nom base
        const baseName = path.basename(mediaPath, path.extname(mediaPath));
        const mediaDir = path.dirname(mediaPath);
        const exeSrtPath = path.join(mediaDir, baseName + '.srt');

        if (!fs.existsSync(exeSrtPath)) {
          throw new Error(
            `faster-whisper-xxl.exe ha completat però el SRT no s'ha trobat a: ${exeSrtPath}\nSTDERR: ${exeStderr}`,
          );
        }

        // Copiar SRT al outDir per consistència amb el pipeline Python
        const copiedSrtPath = path.join(outDir, baseName + '.srt');
        fs.copyFileSync(exeSrtPath, copiedSrtPath);
        console.log(`[PURFVIEW-EXE] SRT copiat a: ${copiedSrtPath}`);

        await this.projects.updateJob(jobId, { progress: 80 } as any);
        job.progress(80);

        // Guardar SRT en Mongo
        const srtContent = await fsp.readFile(copiedSrtPath, 'utf-8');
        await this.projects.setSrtContent(ownerId, project.srtDocumentId, srtContent);

        await this.projects.updateJob(jobId, { status: 'done', progress: 100, error: null } as any);
        await this.projects.updateProject(projectId, { status: 'ready', lastError: null } as any);
        job.progress(100);

      } else {
        // ── Ruta B: Pipeline Python (tots els engines, inclòs purfview-xxl sense .exe) ──
        const pythonExe = this.config.get<string>('WHISPERX_PYTHON', 'python');
        const runnerPath = this.config.get<string>('WHISPERX_RUNNER');
        if (!runnerPath) throw new Error('WHISPERX_RUNNER is not set in .env');

        const hfToken = this.config.get<string>('HUGGINGFACE_HUB_TOKEN', '');

        const args: string[] = [
          runnerPath,
          '--input',
          mediaPath,
          '--output_dir',
          outDir,
          '--model',
          model,
          '--profile',
          profile,
          '--batch_size',
          batchSize,
          '--device',
          device,
        ];

        args.push('--engine', engine);

        if (timingFix) {
          args.push('--timing-fix');
        } else {
          args.push('--no-timing-fix');
        }

        // purfview-xxl activa postprocess automáticamente en el runner,
        // pero lo pasamos explícitamente para que quede en el log.
        // --subtitle-edit-compat: reduce merges agressius (orphan_gap 1s→0.20s,
        // small_gap 0.85s→0.20s) per produir ~300-360 cues en lloc de ~235,
        // similar al resultat de Subtitle Edit amb faster-whisper-xxl.exe.
        if (engine === 'purfview-xxl') {
          args.push('--postprocess');
          args.push('--subtitle-edit-compat');
        }

        console.log(`[TRANSCRIBE] Engine: ${engine} | Model: ${model} | Device: ${device} | Language: ${language || 'auto'} | Args: ${args.slice(2).join(' ')}`);

        if (language) args.push('--language', language);
        if (offline) args.push('--offline');

        // runner soporta --no-diarization
        if (!diarization) args.push('--no-diarization');

        if (hfToken) args.push('--hf_token', hfToken);

        // Script-align: escribir el guion a un archivo temporal y pasarlo al runner
        let scriptFilePath: string | null = null;
        if (engine === 'script-align' && scriptText) {
          scriptFilePath = path.join(outDir, '_script_input.txt');
          await fsp.writeFile(scriptFilePath, scriptText, 'utf-8');
          args.push('--script-file', scriptFilePath);
        }

        await this.projects.updateJob(jobId, { progress: 15 } as any);
        job.progress(15);

        // 4) Ejecutar runner Python
        const { stdout, stderr, exitCode } = await new Promise<{
          stdout: string;
          stderr: string;
          exitCode: number;
        }>((resolve, reject) => {
          const child = spawn(pythonExe, args, {
            cwd: path.dirname(runnerPath), // importante para imports del runner
            env: { ...process.env },       // hereda FFMPEG_BIN, HF_HOME, token, etc.
            stdio: ['ignore', 'pipe', 'pipe'],
          });

          let stdoutBuf = '';
          let stderrBuf = '';
          let bumped = false;

          child.stdout.on('data', (d) => {
            const s = d.toString();
            stdoutBuf += s;

            // Subida “coarse” de progreso al primer output
            if (!bumped) {
              bumped = true;
              this.projects.updateJob(jobId, { progress: 50 } as any).catch(() => {});
              job.progress(50);
            }
          });

          child.stderr.on('data', (d) => {
            stderrBuf += d.toString();
          });

          child.on('error', (err) => reject(err));
          child.on('close', (code) => resolve({ stdout: stdoutBuf, stderr: stderrBuf, exitCode: code ?? 0 }));
        });

        // Limpiar archivo de guion temporal
        if (scriptFilePath && fs.existsSync(scriptFilePath)) {
          try { fs.unlinkSync(scriptFilePath); } catch (_) {}
        }

        if (exitCode !== 0) {
          throw new Error(`WhisperX failed (exit ${exitCode}). STDERR:\n${stderr || '(empty)'}`);
        }

        await this.projects.updateJob(jobId, { progress: 80 } as any);
        job.progress(80);

        // 5) El runner imprime logs [STATUS] y al final un JSON en una línea.
        // Buscamos la última línea que parezca JSON.
        const lines = stdout
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);

        const jsonLine = [...lines].reverse().find((l) => l.startsWith('{') && l.endsWith('}'));
        if (!jsonLine) {
          throw new Error(`Runner did not output JSON. STDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
        }

        const result = JSON.parse(jsonLine) as any;
        const srtPath: string | undefined = result?.copied?.srt || result?.out_srt;

        if (!srtPath || !fs.existsSync(srtPath)) {
          throw new Error(`SRT not found. srtPath=${srtPath}\nSTDERR:\n${stderr}`);
        }

        // 6) Guardar SRT en Mongo (Document.contentByLang._unassigned)
        const srtText = await fsp.readFile(srtPath, 'utf-8');
        await this.projects.setSrtContent(ownerId, project.srtDocumentId, srtText);

        await this.projects.updateJob(jobId, { status: 'done', progress: 100, error: null } as any);
        await this.projects.updateProject(projectId, { status: 'ready', lastError: null } as any);
        job.progress(100);
      }
    } catch (e: any) {
      const msg = e?.message || 'Unknown error';
      await this.projects.updateJob(jobId, { status: 'error', error: msg } as any);
      await this.projects.updateProject(projectId, { status: 'error', lastError: msg } as any);
      throw e;
    }
  }
}
