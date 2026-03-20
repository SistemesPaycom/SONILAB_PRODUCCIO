/**
 * media-cache.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Persistent waveform cache backed by FFmpeg.
 *
 * Cache files live under  {CACHE_ROOT}/waveform/{sha256}.wfcache
 * Each file is a small binary:
 *   [4B version][4B peaksPerSecond][8B duration][4B sampleRate][4B peakCount][peakCount×4B float32]
 *
 * Identification: the media's SHA-256 hash (already computed at upload time)
 * guarantees that a cache is only reused when the exact same file is involved.
 *
 * Cleanup: entries older than MAX_AGE_DAYS are removed.  The controller (or a
 * cron task) should call cleanOldCaches() during the nightly window 21:00-05:00.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFileCb);

const CACHE_VERSION = 1;
const PEAKS_PER_SECOND = 100;
const MAX_AGE_DAYS = 30;

// Header layout (24 bytes total)
// offset 0  : uint32  version
// offset 4  : uint32  peaksPerSecond
// offset 8  : float64 duration
// offset 16 : uint32  sampleRate
// offset 20 : uint32  peakCount
// offset 24+: float32[] peaks

@Injectable()
export class MediaCacheService {
  private readonly logger = new Logger(MediaCacheService.name);
  private readonly cacheDir: string;

  constructor(private readonly config: ConfigService) {
    const cacheRoot = config.get<string>('CACHE_ROOT') || './cache';
    const base = path.isAbsolute(cacheRoot) ? cacheRoot : path.join(process.cwd(), cacheRoot);
    this.cacheDir = path.join(base, 'waveform');
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /** Path of the cache file for a given sha256 */
  private cachePath(sha256: string): string {
    return path.join(this.cacheDir, `${sha256}.wfcache`);
  }

  /** Check whether a valid cache exists for the given sha256 */
  hasCache(sha256: string): boolean {
    const p = this.cachePath(sha256);
    if (!fs.existsSync(p)) return false;
    // Quick sanity: at least 24 bytes header
    try {
      const stat = fs.statSync(p);
      return stat.size >= 24;
    } catch {
      return false;
    }
  }

  /** Read cached waveform. Returns the raw buffer or null. */
  readCache(sha256: string): Buffer | null {
    if (!this.hasCache(sha256)) return null;
    try {
      const buf = fs.readFileSync(this.cachePath(sha256));
      // Validate version
      const version = buf.readUInt32LE(0);
      if (version !== CACHE_VERSION) return null;
      return buf;
    } catch {
      return null;
    }
  }

  /** Read cached waveform and return parsed JSON-friendly object */
  readCacheAsJSON(sha256: string): {
    version: number;
    peaksPerSecond: number;
    duration: number;
    sampleRate: number;
    peakCount: number;
    peaks: number[];
  } | null {
    const buf = this.readCache(sha256);
    if (!buf) return null;

    const version = buf.readUInt32LE(0);
    const peaksPerSecond = buf.readUInt32LE(4);
    const duration = buf.readDoubleLE(8);
    const sampleRate = buf.readUInt32LE(16);
    const peakCount = buf.readUInt32LE(20);

    // Validate data size
    const expectedSize = 24 + peakCount * 4;
    if (buf.length < expectedSize) return null;

    const peaks: number[] = new Array(peakCount);
    for (let i = 0; i < peakCount; i++) {
      peaks[i] = buf.readFloatLE(24 + i * 4);
    }

    return { version, peaksPerSecond, duration, sampleRate, peakCount, peaks };
  }

  /**
   * Generate waveform peaks from a media file using FFmpeg and cache the result.
   * FFmpeg extracts mono f32le PCM at a low sample rate, and we compute peaks
   * in Node to keep the pipeline simple and portable.
   */
  async generateAndCache(filePath: string, sha256: string): Promise<void> {
    this.logger.log(`Generating waveform cache for ${sha256} from ${filePath}`);

    // Step 1: Get audio info via ffprobe
    const probeArgs = [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=sample_rate,duration',
      '-of', 'json',
      filePath,
    ];

    let sampleRate = 44100;
    let duration = 0;

    try {
      const { stdout } = await execFileAsync('ffprobe', probeArgs, { timeout: 30000 });
      const info = JSON.parse(stdout);
      const stream = info?.streams?.[0];
      if (stream) {
        sampleRate = parseInt(stream.sample_rate, 10) || 44100;
        duration = parseFloat(stream.duration) || 0;
      }
    } catch (e) {
      this.logger.warn(`ffprobe failed, will try to extract anyway: ${e}`);
    }

    // Step 2: Extract raw PCM using FFmpeg
    // We downsample to 8000 Hz mono to reduce data volume while keeping enough resolution.
    // At 8000 Hz, 100 peaks/sec means 80 samples per peak — more than enough.
    const extractRate = 8000;
    const ffmpegArgs = [
      '-i', filePath,
      '-vn',                    // no video
      '-ac', '1',               // mono
      '-ar', String(extractRate),
      '-f', 'f32le',            // raw float32 little-endian
      '-',                      // stdout
    ];

    const rawPcm = await new Promise<Buffer>((resolve, reject) => {
      execFileCb('ffmpeg', ffmpegArgs, {
        maxBuffer: 500 * 1024 * 1024, // 500MB for long files
        encoding: 'buffer',
      } as any, (err: any, stdout: Buffer) => {
        if (err && !stdout?.length) return reject(err);
        resolve(stdout);
      });
    });

    // Step 3: Compute peaks from raw PCM
    const totalSamples = rawPcm.length / 4; // float32 = 4 bytes
    const actualDuration = totalSamples / extractRate;
    if (duration === 0) duration = actualDuration;

    const samplesPerPeak = Math.floor(extractRate / PEAKS_PER_SECOND);
    const peakCount = Math.floor(totalSamples / samplesPerPeak);

    const peaksF32 = new Float32Array(peakCount);
    for (let i = 0; i < peakCount; i++) {
      let max = 0;
      const start = i * samplesPerPeak;
      for (let j = 0; j < samplesPerPeak; j++) {
        const offset = (start + j) * 4;
        if (offset + 4 > rawPcm.length) break;
        const val = Math.abs(rawPcm.readFloatLE(offset));
        if (val > max) max = val;
      }
      peaksF32[i] = max;
    }

    // Step 4: Write binary cache file
    const headerSize = 24;
    const buf = Buffer.alloc(headerSize + peakCount * 4);

    buf.writeUInt32LE(CACHE_VERSION, 0);
    buf.writeUInt32LE(PEAKS_PER_SECOND, 4);
    buf.writeDoubleLE(duration, 8);
    buf.writeUInt32LE(sampleRate, 16);
    buf.writeUInt32LE(peakCount, 20);

    // Copy peaks into buffer
    for (let i = 0; i < peakCount; i++) {
      buf.writeFloatLE(peaksF32[i], headerSize + i * 4);
    }

    // Ensure directory exists
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    fs.writeFileSync(this.cachePath(sha256), buf);
    this.logger.log(`Waveform cache written: ${sha256} (${peakCount} peaks, ${(buf.length / 1024).toFixed(1)} KB)`);
  }

  /**
   * Clean cache files older than MAX_AGE_DAYS.
   * Should be called during the nightly window (21:00 - 05:00).
   */
  cleanOldCaches(): { deleted: number; errors: number } {
    const now = Date.now();
    const maxAgeMs = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    let deleted = 0;
    let errors = 0;

    try {
      if (!fs.existsSync(this.cacheDir)) return { deleted, errors };

      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (!file.endsWith('.wfcache')) continue;
        const filePath = path.join(this.cacheDir, file);
        try {
          const stat = fs.statSync(filePath);
          const age = now - stat.mtimeMs;
          if (age > maxAgeMs) {
            fs.unlinkSync(filePath);
            deleted++;
            this.logger.log(`Cleaned old cache: ${file}`);
          }
        } catch (e) {
          errors++;
          this.logger.warn(`Failed to clean cache file ${file}: ${e}`);
        }
      }
    } catch (e) {
      this.logger.error(`Cache cleanup failed: ${e}`);
    }

    if (deleted > 0) {
      this.logger.log(`Cache cleanup complete: ${deleted} deleted, ${errors} errors`);
    }

    return { deleted, errors };
  }

  /**
   * Check if we're currently in the nightly cleanup window (21:00 - 05:00)
   */
  isInCleanupWindow(): boolean {
    const hour = new Date().getHours();
    return hour >= 21 || hour < 5;
  }
}
