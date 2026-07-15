/**
 * shot-changes.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Persistent shot-change (scene-cut) cache backed by FFmpeg.
 *
 * Cache files live under  {CACHE_ROOT}/shotchanges/{sha256}.json
 * Each file is a small JSON:
 *   { version, sha256, threshold, count, shotChanges: number[], generatedAt }
 *
 * Identification: the media's SHA-256 hash (already computed at upload time)
 * guarantees a cache is only reused when the exact same file is involved —
 * same convention as the waveform cache (see media-cache.service.ts).
 *
 * Detection: mirrors what Subtitle Edit does — an FFmpeg scene-detect filter
 * (`select='gt(scene,THRESHOLD)',showinfo`) whose `pts_time` outputs mark the
 * timestamp (in seconds) of each detected shot change.
 *
 * Re-detection overwrites the cache file for the same sha256 (idempotent):
 * one asset never accumulates duplicate shot-change files.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

const CACHE_VERSION = 1;
export const DEFAULT_SHOT_THRESHOLD = 0.4;

export interface ShotChangesResult {
  version: number;
  sha256: string;
  threshold: number;
  count: number;
  shotChanges: number[];
  generatedAt: string;
}

@Injectable()
export class ShotChangesService {
  private readonly logger = new Logger(ShotChangesService.name);
  private readonly cacheDir: string;

  constructor(private readonly config: ConfigService) {
    const cacheRoot = config.get<string>('CACHE_ROOT') || './cache';
    const base = path.isAbsolute(cacheRoot) ? cacheRoot : path.join(process.cwd(), cacheRoot);
    this.cacheDir = path.join(base, 'shotchanges');
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /** Path of the cache file for a given sha256 */
  private cachePath(sha256: string): string {
    return path.join(this.cacheDir, `${sha256}.json`);
  }

  /** Whether a valid cache exists for the given sha256 */
  hasCache(sha256: string): boolean {
    const p = this.cachePath(sha256);
    if (!fs.existsSync(p)) return false;
    try {
      return fs.statSync(p).size > 0;
    } catch {
      return false;
    }
  }

  /** Read cached shot changes. Returns the parsed object or null. */
  readCache(sha256: string): ShotChangesResult | null {
    if (!this.hasCache(sha256)) return null;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.cachePath(sha256), 'utf-8'));
      if (parsed?.version !== CACHE_VERSION || !Array.isArray(parsed.shotChanges)) return null;
      return parsed as ShotChangesResult;
    } catch {
      return null;
    }
  }

  /** Clamp an incoming threshold to FFmpeg's valid scene-score range [0, 1]. */
  private normalizeThreshold(threshold?: number): number {
    const t = threshold == null || Number.isNaN(threshold) ? DEFAULT_SHOT_THRESHOLD : threshold;
    return Math.min(1, Math.max(0, t));
  }

  /**
   * Detect shot changes from a media file using FFmpeg and cache the result.
   * Always overwrites the cache for this sha256 (idempotent re-detection).
   */
  async detectAndCache(
    filePath: string,
    sha256: string,
    threshold?: number,
  ): Promise<ShotChangesResult> {
    const thr = this.normalizeThreshold(threshold);
    this.logger.log(`Detecting shot changes for ${sha256} (threshold ${thr}) from ${filePath}`);

    const shotChanges = await this.runFfmpegSceneDetect(filePath, thr);

    const result: ShotChangesResult = {
      version: CACHE_VERSION,
      sha256,
      threshold: thr,
      count: shotChanges.length,
      shotChanges,
      generatedAt: new Date().toISOString(),
    };

    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    // Overwrite in place — same sha256 never accumulates duplicate files.
    fs.writeFileSync(this.cachePath(sha256), JSON.stringify(result), 'utf-8');
    this.logger.log(`Shot-changes cache written: ${sha256} (${result.count} cuts)`);

    return result;
  }

  /**
   * Run FFmpeg with the scene-detection filter and parse the `pts_time` values
   * that showinfo prints (to stderr) for each frame that survives the
   * `select='gt(scene,THRESHOLD)'` filter — i.e. each detected shot change.
   *
   * `-f null -` discards the decoded output; we only care about the log.
   * The scene expression is wrapped in single quotes so FFmpeg's own filtergraph
   * parser (not the shell) protects the inner comma of gt(scene,THRESHOLD).
   */
  private runFfmpegSceneDetect(filePath: string, threshold: number): Promise<number[]> {
    const args = [
      '-hide_banner',
      '-nostats',
      '-i', filePath,
      '-an',
      '-sn',
      '-vf', `select='gt(scene,${threshold})',showinfo`,
      '-f', 'null',
      '-',
    ];

    return new Promise<number[]>((resolve, reject) => {
      const child = spawn('ffmpeg', args, {
        env: { ...process.env },
        stdio: ['ignore', 'ignore', 'pipe'],
      });

      let stderrBuf = '';
      child.stderr.on('data', (d: Buffer) => {
        stderrBuf += d.toString();
      });

      child.on('error', reject);
      child.on('close', (code) => {
        // FFmpeg returns 0 on a normal scan; a non-zero exit with no parsed
        // timestamps is a real failure (bad file, ffmpeg missing, etc.).
        const times = this.parsePtsTimes(stderrBuf);
        if (code !== 0 && times.length === 0) {
          reject(new Error(`ffmpeg scene detection failed (exit ${code}). STDERR:\n${stderrBuf.slice(-2000)}`));
          return;
        }
        resolve(times);
      });
    });
  }

  /** Extract, dedupe and sort every `pts_time:` value from showinfo output. */
  private parsePtsTimes(stderr: string): number[] {
    const re = /pts_time:\s*([0-9]+(?:\.[0-9]+)?)/g;
    const seen = new Set<number>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(stderr)) !== null) {
      const t = parseFloat(m[1]);
      if (!Number.isNaN(t)) seen.add(Math.round(t * 1000) / 1000);
    }
    return Array.from(seen).sort((a, b) => a - b);
  }
}
