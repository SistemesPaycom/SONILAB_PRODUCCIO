import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors, Logger } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { diskStorage } from 'multer';
import { nanoid } from 'nanoid';
import * as mime from 'mime-types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user';
import { LibraryService } from '../library/library.service';
import { MediaCacheService } from './media-cache.service';
import { createHash } from 'crypto';
import { NotFoundException } from '@nestjs/common';

function ensureDirSync(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function extFromOriginalname(originalname: string) {
  const ext = path.extname(originalname || '').toLowerCase();
  return ext || '';
}
function sourceTypeFromExt(ext: string) {
  const clean = ext.replace('.', '');
  return clean || 'bin';
}
function resolveSafeMediaPath(mediaRootAbs: string, storedPath: string): string {
  const root = path.resolve(mediaRootAbs);
  const rootCmp = (root.endsWith(path.sep) ? root : root + path.sep).toLowerCase();

  // storedPath lo guardas en POSIX ('/'), lo pasamos a separador nativo
  const storedNative = String(storedPath).split('/').join(path.sep);

  // Si es absoluto, solo lo permitimos si está dentro de MEDIA_ROOT
  const abs = path.isAbsolute(storedNative)
    ? path.resolve(storedNative)
    : path.resolve(root, storedNative);

  const absCmp = abs.toLowerCase();

  if (!absCmp.startsWith(rootCmp)) {
    // path traversal / salida del root
    throw new BadRequestException('Invalid media path');
  }

  return abs;
}

async function sha256File(filePath: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const s = fs.createReadStream(filePath);
    s.on('data', (d) => hash.update(d));
    s.on('error', reject);
    s.on('end', () => resolve(hash.digest('hex')));
  });
}
@UseGuards(JwtAuthGuard)
@Controller('/media')
export class MediaController {
  private readonly logger = new Logger(MediaController.name);
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly library: LibraryService,
    private readonly mediaCache: MediaCacheService,
  ) {
    // Start periodic cleanup check every 30 minutes
    this.cleanupTimer = setInterval(() => {
      this.tryNightlyCleanup();
    }, 30 * 60 * 1000);
    // Also run once at startup if in window
    setTimeout(() => this.tryNightlyCleanup(), 5000);
  }

  private tryNightlyCleanup() {
    if (this.mediaCache.isInCleanupWindow()) {
      this.logger.log('Running nightly cache cleanup...');
      const result = this.mediaCache.cleanOldCaches();
      if (result.deleted > 0) {
        this.logger.log(`Nightly cleanup: removed ${result.deleted} old cache files`);
      }
    }
  }

  /** Lightweight precheck: probable duplicate by name + file size (no content hashing). */
  @Get('/check-duplicate')
  async checkDuplicate(
    @CurrentUser() user: RequestUser,
    @Query('name') name: string,
    @Query('size') size: string,
  ) {
    if (!name) throw new BadRequestException('name is required');
    if (!size) throw new BadRequestException('size is required');
    const sizeNum = parseInt(size, 10);
    if (isNaN(sizeNum)) throw new BadRequestException('size must be a number');
    const existing = await this.library.findMediaByNameAndSize(name, sizeNum);
    if (existing) return { exists: true, document: existing };
    return { exists: false };
  }

  @Post('/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const mediaRoot = process.env.STORAGE_ROOT || process.env.MEDIA_ROOT || './media';
          const dest = path.isAbsolute(mediaRoot) ? mediaRoot : path.join(process.cwd(), mediaRoot);
          ensureDirSync(dest);
          cb(null, dest);
        },
        filename: (_req, file, cb) => {
          const ext = extFromOriginalname(file.originalname);
          cb(null, `${nanoid(16)}${ext}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 * 1024 }, // 50GB
    }),
  )
  async upload(@CurrentUser() user: RequestUser, @UploadedFile() file?: Express.Multer.File, @Body('parentId') parentId?: string) {
    if (!file) throw new BadRequestException('file is required');

    const ext = extFromOriginalname(file.originalname);
    const sourceType = sourceTypeFromExt(ext);
    const mimeType = (mime.lookup(file.path) || file.mimetype || 'application/octet-stream') as string;
    const mediaRoot = process.env.STORAGE_ROOT || process.env.MEDIA_ROOT || './media';
const mediaRootAbs = path.isAbsolute(mediaRoot) ? mediaRoot : path.join(process.cwd(), mediaRoot);

const absPath = path.resolve(file.path);
const relPathPosix = path.relative(mediaRootAbs, absPath).split(path.sep).join('/');
const sha256 = await sha256File(file.path);
const existing = await this.library.findMediaBySha256(user.userId, sha256, file.size);

const allowedExt = new Set(['mp4', 'mov', 'm4v', 'mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg']);
const extClean = ext.replace('.', '').toLowerCase();

if (!allowedExt.has(extClean)) {
  try { fs.unlinkSync(file.path); } catch {}
  throw new BadRequestException(`Unsupported file extension: .${extClean}`);
}

const allowedMime = new Set([
  'video/mp4',
  'video/quicktime',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',      // Windows reporta WAV com audio/wave
  'audio/vnd.wave',  // variant addicional de WAV
  'audio/mpeg',
  'audio/mp3',       // variant de MP3 en alguns sistemes
  'audio/mp4',
  'audio/aac',
  'audio/flac',
  'audio/ogg',
]);

if (!allowedMime.has(mimeType)) {
  // no siempre viene perfecto en Windows, por eso suelo priorizar ext
  // pero si quieres ser estricto, activa este bloque.
 try { fs.unlinkSync(file.path); } catch {}
 throw new BadRequestException(`Unsupported mime type: ${mimeType}`);
}
if (existing) {
  // borrar el archivo recién subido (duplicado)
  try { fs.unlinkSync(file.path); } catch {}

  // Ensure waveform cache exists for the existing media (async, non-blocking)
  if (existing.media?.sha256 && existing.media?.path) {
    this.ensureWaveformCache(existing.media.sha256, existing.media.path, mediaRootAbs);
  }

  return { document: existing, duplicated: true };
}

    const finalName = file.originalname;

    const doc = await this.library.createDocument(user.userId, {
      name: finalName,
      parentId: parentId || null,
      sourceType,
      media: {
        storage: 'local',
        path: relPathPosix,
        mimeType,
        size: file.size,
        sha256,
      },
    });

    // Generate waveform cache immediately after import (async, non-blocking).
    // The response returns to the user right away; waveform generation continues
    // in background so it's ready when the editor opens.
    this.ensureWaveformCache(sha256, relPathPosix, mediaRootAbs);

    return { document: doc };
  }

  /**
   * Fire-and-forget: generate waveform cache if it doesn't exist yet.
   * Called during upload/import so the cache is ready before the editor opens.
   */
  private ensureWaveformCache(sha256: string, mediaRelPath: string, mediaRootAbs: string) {
    if (this.mediaCache.hasCache(sha256)) {
      this.logger.log(`Waveform cache already exists for ${sha256.substring(0, 12)}...`);
      return;
    }

    const filePath = resolveSafeMediaPath(mediaRootAbs, mediaRelPath);
    if (!fs.existsSync(filePath)) {
      this.logger.warn(`Cannot pre-generate waveform: media file not found at ${filePath}`);
      return;
    }

    // Run generation in background — don't block the upload response
    this.mediaCache.generateAndCache(filePath, sha256).then(() => {
      this.logger.log(`Waveform pre-generated successfully for ${sha256.substring(0, 12)}...`);
    }).catch((err) => {
      this.logger.warn(`Waveform pre-generation failed for ${sha256.substring(0, 12)}...: ${err.message}`);
    });
  }
  @Delete('/delete/:docId')
  async delete(@CurrentUser() user: RequestUser, @Param('docId') docId: string) {
    return this.library.updateDocument(user.userId, docId, { isDeleted: true } as any);
}
  @Get('/:docId/stream')
  async stream(@CurrentUser() user: RequestUser, @Param('docId') docId: string, @Res() res: Response) {
    const doc = await this.library.getDocument(user.userId, docId);
    if (!doc.media?.path) throw new BadRequestException('Document has no media');
    if (doc.isDeleted) {
  throw new NotFoundException('Media not found');
}

   const mediaRoot = process.env.STORAGE_ROOT || process.env.MEDIA_ROOT || './media';
const mediaRootAbs = path.isAbsolute(mediaRoot) ? mediaRoot : path.join(process.cwd(), mediaRoot);

// doc.media.path está guardado en posix (con '/')
const stored = String(doc.media.path);
const storedNative = stored.split('/').join(path.sep);

// soporta paths antiguos absolutos + los nuevos relativos
const filePath = resolveSafeMediaPath(mediaRootAbs, doc.media.path);

if (!fs.existsSync(filePath)) {
  throw new BadRequestException(`Media file not found on disk`);
}

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    const range = res.req.headers.range;
    const contentType = doc.media.mimeType || 'application/octet-stream';

    // CORP: permetre que <video src> cross-origin carregui aquest recurs.
    // Helmet posa 'same-origin' per defecte i bloqueja la reproducció
    // quan frontend (3000) i backend (8000) estan en orígens diferents.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', contentType);

    if (!range) {
      res.setHeader('Content-Length', fileSize);
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    const m = /bytes=(\d+)-(\d+)?/.exec(range);
    if (!m) {
      res.status(416).end();
      return;
    }

    const start = parseInt(m[1], 10);
    const end = m[2] ? parseInt(m[2], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize || start > end) {
      res.status(416).end();
      return;
    }

    const chunkSize = end - start + 1;

    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', chunkSize);

    fs.createReadStream(filePath, { start, end }).pipe(res);
  }

  /**
   * GET /media/:docId/waveform
   * Returns cached waveform peaks as JSON.
   * If no cache exists, generates it on-the-fly using FFmpeg.
   */
  @Get('/:docId/waveform')
  async waveform(@CurrentUser() user: RequestUser, @Param('docId') docId: string) {
    const doc = await this.library.getDocument(user.userId, docId);
    if (!doc.media?.path) throw new BadRequestException('Document has no media');
    if (doc.isDeleted) throw new NotFoundException('Media not found');

    const sha256 = doc.media.sha256;
    if (!sha256) throw new BadRequestException('Media has no SHA-256 hash');

    // 1. Try to read from cache
    const cached = this.mediaCache.readCacheAsJSON(sha256);
    if (cached) {
      this.logger.log(`Waveform cache HIT for ${docId} (${sha256.substring(0, 12)}...)`);
      return { cached: true, waveform: cached };
    }

    // 2. Cache miss → generate via FFmpeg
    this.logger.log(`Waveform cache MISS for ${docId} (${sha256.substring(0, 12)}...) — generating...`);

    const mediaRoot = process.env.STORAGE_ROOT || process.env.MEDIA_ROOT || './media';
    const mediaRootAbs = path.isAbsolute(mediaRoot) ? mediaRoot : path.join(process.cwd(), mediaRoot);
    const filePath = resolveSafeMediaPath(mediaRootAbs, doc.media.path);

    if (!fs.existsSync(filePath)) {
      throw new BadRequestException('Media file not found on disk');
    }

    try {
      await this.mediaCache.generateAndCache(filePath, sha256);
    } catch (err) {
      this.logger.error(`Failed to generate waveform for ${docId}: ${err}`);
      throw new BadRequestException('Failed to generate waveform. FFmpeg may not be available.');
    }

    const result = this.mediaCache.readCacheAsJSON(sha256);
    if (!result) {
      throw new BadRequestException('Waveform generation succeeded but cache read failed');
    }

    return { cached: false, waveform: result };
  }

}
