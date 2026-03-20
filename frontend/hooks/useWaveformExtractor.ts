// hooks/useWaveformExtractor.ts
// Loads waveform peak data, prioritising the backend cache (pre-generated at import time).
// Falls back to client-side Web Audio API only when backend is unavailable.

import { useState, useCallback, useRef } from 'react';
import { api } from '../services/api';

export interface WaveformPeaks {
  data: Float32Array;
  length: number;
  duration: number;
  sampleRate: number;
}

type ExtractionStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Small helper: wait ms milliseconds */
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function useWaveformExtractor() {
  const [status, setStatus] = useState<ExtractionStatus>('idle');
  const [peaks, setPeaks] = useState<WaveformPeaks | null>(null);
  const lastFileRef = useRef<File | null>(null);

  const extract = useCallback(async (file: File, docId?: string) => {
    // Avoid re-extracting the same file
    if (lastFileRef.current === file && peaks) return;
    lastFileRef.current = file;

    setStatus('loading');
    setPeaks(null);

    // ── Strategy 1: Backend cache (primary path) ─────────────────────────
    // The waveform is normally pre-generated at upload time, so this should
    // return instantly.  If the upload just happened and generation is still
    // running in background, we retry a couple of times before giving up.
    if (docId) {
      const MAX_RETRIES = 2;
      const RETRY_DELAY = 2000; // 2 seconds between retries

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const result = await api.getWaveform(docId);
          if (result?.waveform) {
            const wf = result.waveform;
            const peaksData = new Float32Array(wf.peaks);
            setPeaks({
              data: peaksData,
              length: wf.peakCount,
              duration: wf.duration,
              sampleRate: wf.sampleRate,
            });
            setStatus('ready');
            console.log(
              `[Waveform] Loaded from backend${result.cached ? ' (cached)' : ' (just generated)'} — ${wf.peakCount} peaks`,
            );
            return;
          }
        } catch (err) {
          if (attempt < MAX_RETRIES) {
            console.log(`[Waveform] Backend not ready yet, retrying in ${RETRY_DELAY}ms... (attempt ${attempt + 1}/${MAX_RETRIES})`);
            await wait(RETRY_DELAY);
          } else {
            console.warn('[Waveform] Backend cache unavailable after retries, falling back to client-side:', err);
          }
        }
      }
    }

    // ── Strategy 2: Client-side Web Audio API (fallback for edge cases) ──
    // This runs only when: no docId, backend unreachable, or FFmpeg failed.
    try {
      console.log('[Waveform] Extracting client-side via Web Audio API (fallback)...');
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      const duration = audioBuffer.duration;

      const peaksPerSecond = 100;
      const samplesPerPeak = Math.floor(sampleRate / peaksPerSecond);
      const peakCount = Math.floor(channelData.length / samplesPerPeak);
      const peaksData = new Float32Array(peakCount);

      for (let i = 0; i < peakCount; i++) {
        let max = 0;
        const start = i * samplesPerPeak;
        for (let j = 0; j < samplesPerPeak; j++) {
          const val = Math.abs(channelData[start + j]);
          if (val > max) max = val;
        }
        peaksData[i] = max;
      }

      setPeaks({ data: peaksData, length: peakCount, duration, sampleRate });
      setStatus('ready');
      console.log(`[Waveform] Client-side fallback complete (${peakCount} peaks)`);
      await audioContext.close();
    } catch (err) {
      console.error('[Waveform] All extraction methods failed:', err);
      setStatus('error');
    }
  }, [peaks]);

  return { extract, peaks, status };
}
