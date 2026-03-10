// components/VideoEditor/WaveformTimeline.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Segment, Id, TimelineViewMode } from '../../types';
import { CursorStationaryIcon, CursorPageIcon } from './PlayerIcons';
import useLocalStorage from '../../hooks/useLocalStorage';
import { LOCAL_STORAGE_KEYS } from '../../constants';

const stripHtml = (text: string) => (text ? text.replace(/<[^>]+>/g, '') : '');

// “Public” i configurable des de fora com a valor base inicial
export const DEFAULT_HOLD_TO_EDIT_MS = 400;

interface WaveformTimelineProps {
  videoFile: File | null;
  segments: Segment[];
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  isPlaying: boolean;
  videoRef?: React.RefObject<HTMLVideoElement>;
  activeId?: Id | null;
  viewMode?: TimelineViewMode;
  onToggleViewMode?: (mode: TimelineViewMode) => void;
  onSegmentUpdate?: (id: Id, newStart: number, newEnd: number) => void;
  onSegmentUpdateEnd?: () => void;
  onSegmentClick?: (id: Id) => void;
  autoScroll?: boolean;
  scrollMode?: 'stationary' | 'page';

  // prop opcional (té prioritat sobre localStorage si es passa)
  holdToEditMs?: number;
}

interface Peak {
  min: number;
  max: number;
}

interface WavePeakData {
  peaks: Peak[];
  sampleRate: number;
  highestPeak: number;
}

type HitType = 'resize-start' | 'resize-end' | 'move';
type HitTarget = { id: Id; type: HitType };

type DragState = {
  segmentId: Id;
  type: HitType;
  startX: number;
  originalStart: number;
  originalEnd: number;
};

type PressState = {
  startedAt: number;
  startX: number;
  startY: number;
  latestX: number;
  latestY: number;
  target: HitTarget | null;
  activatedEdit: boolean;
};

const TARGET_PEAKS_PER_SECOND = 500;
const MIN_ZOOM = 100;
const MAX_ZOOM_H = 700;
const MAX_ZOOM_V = 600;
const MIN_ZOOM_INICI_H = 250;
const MIN_ZOOM_INICI_V = 150;

const WaveformTimeline: React.FC<WaveformTimelineProps> = ({
  videoFile,
  segments,
  duration,
  currentTime,
  onSeek,
  isPlaying,
  videoRef,
  activeId,
  viewMode = 'both',
  onSegmentUpdate,
  onSegmentUpdateEnd,
  onSegmentClick,
  autoScroll = true,
  scrollMode = 'stationary',
  holdToEditMs: propHoldToEditMs,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [wavePeaks, setWavePeaks] = useState<WavePeakData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  

  const [zoomH, setZoomH] = useState(MIN_ZOOM_INICI_H);
  const [zoomV, setZoomV] = useState(MIN_ZOOM_INICI_V);

  const pendingUpdateRef = useRef<{ id: Id; s: number; e: number } | null>(null);
const rafUpdateRef = useRef<number | null>(null);

const flushPendingUpdate = useCallback(() => {
  rafUpdateRef.current = null;
  const p = pendingUpdateRef.current;
  if (!p) return;
  onSegmentUpdate?.(p.id, p.s, p.e);
}, [onSegmentUpdate]);

  // viewport
  const currentViewportStartRef = useRef<number>(0);
  const [manualScrollOffset, setManualScrollOffset] = useState<number>(0);

  // Configuració dinàmica des de LocalStorage
  const [storedHoldMs] = useLocalStorage<number>(
    LOCAL_STORAGE_KEYS.WAVEFORM_HOLD_MS,
    DEFAULT_HOLD_TO_EDIT_MS
  );
  const effectiveHoldToEditMs = propHoldToEditMs ?? storedHoldMs;

  // click curt vs pressió llarga
  const pressRef = useRef<PressState | null>(null);
  const holdTimerRef = useRef<number | null>(null);

  // drag
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [cursorStyle, setCursorStyle] = useState<string>('default');

  // --- SOLUCIÓ AL SALT VISUAL I BOLA FANTASMA ---
  useEffect(() => {
    if (!autoScroll) {
      setManualScrollOffset(currentViewportStartRef.current);
    }
  }, [autoScroll]);

  useEffect(() => {
    let cancelled = false;
    let audioCtx: AudioContext | null = null;

    const load = async () => {
      if (!videoFile) {
        setWavePeaks(null);
        setError(null);
        return;
      }
      setIsLoading(true);
      setError(null);

      try {
        const arrayBuf = await videoFile.arrayBuffer();
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
        if (cancelled) return;

        const channelData = audioBuf.getChannelData(0);
        const totalSamples = channelData.length;
        const audioSampleRate = audioBuf.sampleRate;

        const samplesPerPeak = Math.max(1, Math.floor(audioSampleRate / TARGET_PEAKS_PER_SECOND));
        const effectivePeaksPerSecond = audioSampleRate / samplesPerPeak;

        const peakCount = Math.floor(totalSamples / samplesPerPeak);
        const peaks: Peak[] = new Array(peakCount);

        let globalMax = 0;
        let globalMin = 0;

        for (let i = 0; i < peakCount; i++) {
          const start = i * samplesPerPeak;
          const end = Math.min(start + samplesPerPeak, totalSamples);
          let min = 0;
          let max = 0;

          for (let j = start; j < end; j++) {
            const val = channelData[j];
            if (val < min) min = val;
            if (val > max) max = val;
          }

          peaks[i] = { min, max };
          if (max > globalMax) globalMax = max;
          if (min < globalMin) globalMin = min;
        }

        setWavePeaks({
          peaks,
          sampleRate: effectivePeaksPerSecond,
          highestPeak: Math.max(Math.abs(globalMax), Math.abs(globalMin)) || 1,
        });
      } catch (e) {
        if (!cancelled) setError("No s’ha pogut carregar l'àudio.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
      if (audioCtx) audioCtx.close();
    };
  }, [videoFile]);

  const getVisibleDuration = useCallback(() => 30 * (100 / zoomH), [zoomH]);

  const getViewportStart = useCallback(
    (exactTime: number) => {
      if (!autoScroll) return manualScrollOffset;

      const visDur = getVisibleDuration();

      if (scrollMode === 'page') {
        const isVisible =
          exactTime >= currentViewportStartRef.current &&
          exactTime < currentViewportStartRef.current + visDur;
        if (!isVisible) {
          currentViewportStartRef.current = Math.floor(exactTime / visDur) * visDur;
        }
        return currentViewportStartRef.current;
      } else {
        let vs = exactTime - visDur / 2;
        if (vs < 0) vs = 0;
        currentViewportStartRef.current = vs;
        return vs;
      }
    },
    [getVisibleDuration, scrollMode, autoScroll, manualScrollOffset]
  );

  const timeToX = useCallback((t: number, viewportStart: number, width: number, visibleDuration: number) => {
    return ((t - viewportStart) / visibleDuration) * width;
  }, []);

  const xToTime = useCallback((x: number, viewportStart: number, width: number, visibleDuration: number) => {
    return viewportStart + (x / width) * visibleDuration;
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (autoScroll) return;
      const visDur = getVisibleDuration();
      const deltaSeconds = (e.deltaX + e.deltaY) * (visDur / 1000);
      setManualScrollOffset((prev) => Math.max(0, Math.min(duration - visDur, prev + deltaSeconds)));
    },
    [autoScroll, getVisibleDuration, duration]
  );

  const getHitTarget = useCallback(
    (mouseX: number, mouseY: number, width: number, height: number, timeAtMouse: number): HitTarget | null => {
      const margin = 5;
      const handleWidthPx = 6;
      const visDur = getVisibleDuration();
      const handleSeconds = handleWidthPx / (width / visDur);
      if (mouseY < margin || mouseY > height - margin) return null;

      for (const seg of segments) {
        if (timeAtMouse >= seg.startTime - handleSeconds && timeAtMouse <= seg.endTime + handleSeconds) {
          if (Math.abs(timeAtMouse - seg.startTime) <= handleSeconds) return { id: seg.id, type: 'resize-start' };
          if (Math.abs(timeAtMouse - seg.endTime) <= handleSeconds) return { id: seg.id, type: 'resize-end' };
          if (timeAtMouse > seg.startTime && timeAtMouse < seg.endTime) return { id: seg.id, type: 'move' };
        }
      }
      return null;
    },
    [getVisibleDuration, segments]
  );

  const draw = useCallback(
    (exactTime: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !wavePeaks) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const width = rect.width;
      const height = rect.height;
      const visDur = getVisibleDuration();
      const viewportStart = getViewportStart(exactTime);

      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      const verticalZoomFactor = zoomV / 100;
      const scaleY = (height / (wavePeaks.highestPeak * 2.1)) * verticalZoomFactor;
      const centerY = height / 2;

      const pixelsPerSecondDiv = wavePeaks.sampleRate * ((width / visDur) / wavePeaks.sampleRate);

      const drawRange = (xStart: number, xEnd: number, color: string) => {
        ctx.strokeStyle = color;
        ctx.beginPath();

        for (let x = Math.floor(xStart); x < xEnd; x++) {
          if (x < 0) continue;
          if (x >= width) break;

          const secondsAtX = viewportStart + x / pixelsPerSecondDiv;
          const pos = secondsAtX * wavePeaks.sampleRate;
          const p0 = Math.floor(pos);

          if (p0 < 0 || p0 >= wavePeaks.peaks.length - 1) continue;

          const weight = pos - p0;
          const peak = wavePeaks.peaks[p0];
          const nextPeak = wavePeaks.peaks[p0 + 1];

          const max = peak.max * (1 - weight) + nextPeak.max * weight;
          const min = peak.min * (1 - weight) + nextPeak.min * weight;

          const yMax = centerY - max * scaleY;
          let yMin = centerY - min * scaleY;

          if (Math.abs(yMin - yMax) < 1) yMin = yMax + 1;

          ctx.moveTo(x, yMax);
          ctx.lineTo(x, yMin);
        }

        ctx.stroke();
      };

      drawRange(0, width, '#4b5563');
    /*   segments.forEach((seg) => {
        const x1 = timeToX(seg.startTime, viewportStart, width, visDur);
        const x2 = timeToX(seg.endTime, viewportStart, width, visDur);
        if (x2 > 0 && x1 < width) drawRange(Math.max(0, x1), Math.min(width, x2), '#4f46e5');
      }); */

      if (viewMode !== 'hidden') {
        const margin = 5;
        const boxY = margin;
        const boxH = height - margin * 2;

        segments.forEach((seg) => {
          const x1 = timeToX(seg.startTime, viewportStart, width, visDur);
          const x2 = timeToX(seg.endTime, viewportStart, width, visDur);
          if (x2 < 0 || x1 > width) return;

          const isActiveSeg = seg.id === activeId;
          ctx.fillStyle = isActiveSeg ? 'rgba(79, 70, 229, 0.2)' : 'rgba(148, 163, 184, 0.1)';
          ctx.fillRect(x1, boxY, x2 - x1, boxH);

          ctx.strokeStyle = isActiveSeg ? '#6366f1' : '#64748b';
          ctx.lineWidth = isActiveSeg ? 1.5 : 1;
          ctx.strokeRect(x1, boxY, x2 - x1, boxH);

        /*   if (x2 - x1 > 40) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x1 + 4, boxY, x2 - x1 - 8, boxH);
            ctx.clip();

            ctx.fillStyle = isActiveSeg ? '#a5b4fc' : '#9ca3af';
            ctx.font = '11px sans-serif';
            ctx.textBaseline = 'top';

            const lines = stripHtml(seg.originalText || '').split('\n');
            lines.slice(0, 2).forEach((line, i) => ctx.fillText(line, x1 + 6, boxY + 4 + i * 12));

            ctx.restore();
          } */
        });
      }

      const playheadX = timeToX(exactTime, viewportStart, width, visDur);
      if (playheadX >= 0 && playheadX <= width) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, height);
        ctx.stroke();
      }
    },
    [wavePeaks, zoomH, zoomV, segments, activeId, viewMode, getVisibleDuration, getViewportStart, timeToX]
  );

  const renderLoop = useCallback(() => {
    if (videoRef?.current) draw(videoRef.current.currentTime);
    animationFrameRef.current = requestAnimationFrame(renderLoop);
  }, [draw, videoRef]);

  useEffect(() => {
    if (isPlaying) renderLoop();
    else {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      draw(currentTime);
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, renderLoop, draw, currentTime]);

  useEffect(() => {
    if (!isPlaying) draw(currentTime);
  }, [currentTime, isPlaying, draw, scrollMode, manualScrollOffset]);

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    // IMPORTANT: evitem propagació perquè cap component pare reaccioni a la pressió inicial
    e.preventDefault();
    e.stopPropagation();

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const refTime = isPlaying && videoRef?.current ? videoRef.current.currentTime : currentTime;
    const viewportStart = getViewportStart(refTime);
    const timeAtMouse = xToTime(x, viewportStart, rect.width, getVisibleDuration());

    const target = getHitTarget(x, y, rect.width, rect.height, timeAtMouse);

    // Guardem l'estat inicial. NO executem onSegmentClick aquí per evitar el salt del videoRef.current.currentTime
    pressRef.current = {
      startedAt: performance.now(),
      startX: x,
      startY: y,
      latestX: x,
      latestY: y,
      target,
      activatedEdit: false,
    };

    clearHoldTimer();

    // Només iniciem el temporitzador de pressió llarga si hi ha un segment sota el ratolí
    if (target) {
      holdTimerRef.current = window.setTimeout(() => {
        const ps = pressRef.current;
        if (!ps || ps.activatedEdit) return;

        ps.activatedEdit = true;

        // ✅ IMPORTANT: No cridem onSegmentClick aquí per evitar que el vídeo salti
        // El vídeo només ha de saltar si l'usuari fa un clic curt.
        // onSegmentClick?.(target.id); <--- Eliminat per evitar marejos.

        const seg = segments.find((s) => s.id === target.id);
        if (!seg) return;

        setDragState({
          segmentId: target.id,
          type: target.type,
          startX: ps.latestX,
          originalStart: seg.startTime,
          originalEnd: seg.endTime,
        });
      }, effectiveHoldToEditMs);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (pressRef.current) {
      pressRef.current.latestX = x;
      pressRef.current.latestY = y;
    }

    const refTime = isPlaying && videoRef?.current ? videoRef.current.currentTime : currentTime;
    const timeAtMouse = xToTime(x, getViewportStart(refTime), rect.width, getVisibleDuration());

    if (dragState && e.buttons === 1) {
      const timeDelta = (x - dragState.startX) * (getVisibleDuration() / rect.width);

      let nS = dragState.originalStart;
      let nE = dragState.originalEnd;

      if (dragState.type === 'move') {
        nS = Math.max(0, dragState.originalStart + timeDelta);
        nE = nS + (dragState.originalEnd - dragState.originalStart);
        if (nE > duration) {
          nE = duration;
          nS = nE - (dragState.originalEnd - dragState.originalStart);
        }
      } else if (dragState.type === 'resize-start') {
        nS = Math.max(0, Math.min(dragState.originalStart + timeDelta, dragState.originalEnd - 0.2));
      } else if (dragState.type === 'resize-end') {
        nE = Math.min(duration, Math.max(dragState.originalStart + 0.2, dragState.originalEnd + timeDelta));
      }

     pendingUpdateRef.current = { id: dragState.segmentId, s: nS, e: nE };
if (rafUpdateRef.current == null) {
  rafUpdateRef.current = requestAnimationFrame(flushPendingUpdate);
}
return;
    }

    const target = getHitTarget(x, y, rect.width, rect.height, timeAtMouse);
    setCursorStyle(target ? (target.type === 'move' ? 'move' : 'col-resize') : 'default');
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    e.preventDefault();
    e.stopPropagation();

    clearHoldTimer();

    // Si estàvem en mode arrossegament, finalitzem sense fer seek
    if (dragState) {
      onSegmentUpdateEnd?.();
      setDragState(null);
      pressRef.current = null;
      return;
    }

    const ps = pressRef.current;
    pressRef.current = null;

    if (!ps) return;

    const elapsed = performance.now() - ps.startedAt;

    // ✅ Només realitzem la navegació si:
    // 1. NO s'ha activat el mode d'edició (hold llarg ja complert)
    // 2. El temps total de pressió és inferior al llindar configurat (Short Click)
    if (!ps.activatedEdit && elapsed < effectiveHoldToEditMs) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;

      const refTime = isPlaying && videoRef?.current ? videoRef.current.currentTime : currentTime;
      const viewportStart = getViewportStart(refTime);
      const timeAtMouse = xToTime(x, viewportStart, rect.width, getVisibleDuration());

      // Si hem clicat sobre un segment, el seleccionem ara que sabem que és un clic curt
      if (ps.target) {
          onSegmentClick?.(ps.target.id);
      }

      // Fem el seek al reproductor
      onSeek(Math.max(0, Math.min(duration, timeAtMouse)));
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 border-l border-gray-800 select-none overflow-hidden relative">
      <style>{`
        .manual-wave-scroll::-webkit-slider-thumb {
            appearance: none;
            width: 32px;
            height: 10px;
            background: #4b5563;
            border-radius: 4px;
            cursor: ew-resize;
            border: 1px solid #374151;
        }
        .manual-wave-scroll::-moz-range-thumb {
            width: 32px;
            height: 10px;
            background: #4b5563;
            border-radius: 4px;
            cursor: ew-resize;
            border: 1px solid #374151;
        }
      `}</style>

      <div className="flex-shrink-0 flex items-center justify-between px-4 py-1 text-xs bg-gray-800 border-b border-gray-700 z-10">
        <div className="text-gray-300 font-semibold">{isLoading ? 'Generant…' : 'Forma d’ona'}</div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">H</span>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM_H}
              value={zoomH}
              onChange={(e) => setZoomH(Number(e.target.value))}
              className="w-24 accent-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">V</span>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM_V}
              value={zoomV}
              onChange={(e) => setZoomV(Number(e.target.value))}
              className="w-24 accent-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 relative min-h-0 w-full" onWheel={handleWheel}>
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ cursor: cursorStyle }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        />

        {!videoFile && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500 pointer-events-none">
            Sense àudio
          </div>
        )}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 pointer-events-none">
            Processant…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-red-500 pointer-events-none">
            {error}
          </div>
        )}

        {!autoScroll && duration > 0 && (
          <div className="absolute bottom-0 left-0 w-full h-2.5 bg-black/40 flex px-2 z-20 border-t border-white/5">
            <input
              type="range"
              min="0"
              max={Math.max(0, duration - getVisibleDuration())}
              step="0.01"
              value={manualScrollOffset}
              onChange={(e) => setManualScrollOffset(parseFloat(e.target.value))}
              className="w-full h-full appearance-none bg-transparent cursor-pointer manual-wave-scroll"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default WaveformTimeline;