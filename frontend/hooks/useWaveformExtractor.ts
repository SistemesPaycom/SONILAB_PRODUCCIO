// hooks/useWaveformExtractor.ts
// Extracts waveform peak data from a video/audio file using the Web Audio API.
// Returns a Float32Array of absolute peak amplitudes at ~100 peaks/second.

import { useState, useCallback, useRef } from 'react';

export interface WaveformPeaks {
  data: Float32Array;
  length: number;
  duration: number;
  sampleRate: number;
}

type ExtractionStatus = 'idle' | 'loading' | 'ready' | 'error';

export function useWaveformExtractor() {
  const [status, setStatus] = useState<ExtractionStatus>('idle');
  const [peaks, setPeaks] = useState<WaveformPeaks | null>(null);
  const lastFileRef = useRef<File | null>(null);

  const extract = useCallback(async (file: File) => {
    // Avoid re-extracting the same file
    if (lastFileRef.current === file && peaks) return;
    lastFileRef.current = file;

    setStatus('loading');
    setPeaks(null);

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      const duration = audioBuffer.duration;

      // 100 peaks per second — enough resolution for most zoom levels
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
      await audioContext.close();
    } catch (err) {
      console.error('Error extracting waveform:', err);
      setStatus('error');
    }
  }, [peaks]);

  return { extract, peaks, status };
}
