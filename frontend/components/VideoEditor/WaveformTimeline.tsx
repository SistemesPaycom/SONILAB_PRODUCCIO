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

  // ── Refs per a valors volàtils dins draw ──────────────────────────────────
  // Usem refs perquè draw NO es recreï quan canvien segments o activeId,
  // evitant reinicis del RAF loop que causen salts visibles a la waveform.
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  const [wavePeaks, setWavePeaks] = useState<WavePeakData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  

  const [zoomH, setZoomH] = useState(MIN_ZOOM_INICI_H);
  const [zoomV, setZoomV] = useState(MIN_ZOOM_INICI_V);

  // ── Ephemeral drag: visual-only segment position during drag ────────
  // During drag we do NOT call onSegmentUpdate (avoids React re-renders).
  // Instead we store the dragged segment's ephemeral position here and
  // let drawStatic read it. On mouseup we commit once.
  const ephemeralSegRef = useRef<{ id: Id; startTime: number; endTime: number } | null>(null);
  const rafRedrawRef = useRef<number | null>(null);

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

  // drag — refs to avoid re-renders during interaction
  const dragStateRef = useRef<DragState | null>(null);
  const cursorRef = useRef<string>('default');

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

      for (const seg of segmentsRef.current) {
        if (timeAtMouse >= seg.startTime - handleSeconds && timeAtMouse <= seg.endTime + handleSeconds) {
          if (Math.abs(timeAtMouse - seg.startTime) <= handleSeconds) return { id: seg.id, type: 'resize-start' };
          if (Math.abs(timeAtMouse - seg.endTime) <= handleSeconds) return { id: seg.id, type: 'resize-end' };
          if (timeAtMouse > seg.startTime && timeAtMouse < seg.endTime) return { id: seg.id, type: 'move' };
        }
      }
      return null;
    },
    [getVisibleDuration]
  );

  // ── Overlay canvas for playhead (separate from main canvas) ─────────
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Track the last viewport params for the static layer so the overlay
  // layer can position the playhead without recomputing everything.
  const lastViewportRef = useRef<{
    viewportStart: number;
    visDur: number;
    width: number;
    height: number;
  }>({ viewportStart: 0, visDur: 30, width: 0, height: 0 });

  // ── drawStatic: waveform + segments (expensive, called rarely) ────────
  const drawStatic = useCallback(
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

      // Store viewport params for overlay layer
      lastViewportRef.current = { viewportStart, visDur, width, height };

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

      if (viewMode !== 'hidden') {
        const margin = 5;
        const boxY = margin;
        const boxH = height - margin * 2;
        const curSegments = segmentsRef.current;
        const curActiveId = activeIdRef.current;

        const eph = ephemeralSegRef.current;
        curSegments.forEach((seg) => {
          // Use ephemeral position for the segment being dragged
          const sStart = eph && eph.id === seg.id ? eph.startTime : seg.startTime;
          const sEnd = eph && eph.id === seg.id ? eph.endTime : seg.endTime;

          const x1 = timeToX(sStart, viewportStart, width, visDur);
          const x2 = timeToX(sEnd, viewportStart, width, visDur);
          if (x2 < 0 || x1 > width) return;

          const isActiveSeg = seg.id === curActiveId;
          ctx.fillStyle = isActiveSeg ? 'rgba(79, 70, 229, 0.2)' : 'rgba(148, 163, 184, 0.1)';
          ctx.fillRect(x1, boxY, x2 - x1, boxH);

          ctx.strokeStyle = isActiveSeg ? '#6366f1' : '#64748b';
          ctx.lineWidth = isActiveSeg ? 1.5 : 1;
          ctx.strokeRect(x1, boxY, x2 - x1, boxH);
        });
      }
    },
    [wavePeaks, zoomH, zoomV, viewMode, getVisibleDuration, getViewportStart, timeToX]
  );

  // ── drawPlayhead: ONLY the playhead line on the overlay canvas (cheap, 60fps) ──
  const drawPlayhead = useCallback(
    (exactTime: number) => {
      const overlay = overlayCanvasRef.current;
      if (!overlay) return;

      const dpr = window.devicePixelRatio || 1;
      const { viewportStart, visDur, width, height } = lastViewportRef.current;
      if (width === 0) return;

      if (overlay.width !== width * dpr || overlay.height !== height * dpr) {
        overlay.width = width * dpr;
        overlay.height = height * dpr;
      }

      const ctx = overlay.getContext('2d');
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

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
    [timeToX]
  );

  // ── Full draw = static + playhead ──────────────────────────────────────
  const draw = useCallback(
    (exactTime: number) => {
      drawStatic(exactTime);
      drawPlayhead(exactTime);
    },
    [drawStatic, drawPlayhead]
  );

  // ── drawRef: permet que renderLoop sigui estable (mai es recrea) ──────
  const drawStaticRef = useRef(drawStatic);
  drawStaticRef.current = drawStatic;
  const drawPlayheadRef = useRef(drawPlayhead);
  drawPlayheadRef.current = drawPlayhead;
  const drawRef = useRef(draw);
  drawRef.current = draw;

  // Track last playhead pixel to skip sub-pixel updates
  const lastPlayheadPxRef = useRef(-1);

  const renderLoop = useCallback(() => {
    if (videoRef?.current) {
      const t = videoRef.current.currentTime;
      const { viewportStart, visDur, width } = lastViewportRef.current;
      const px = ((t - viewportStart) / visDur) * width;

      // Only redraw playhead if it moved at least 0.5 pixel
      if (Math.abs(px - lastPlayheadPxRef.current) >= 0.5) {
        lastPlayheadPxRef.current = px;
        drawPlayheadRef.current(t);
      }

      // Check if viewport needs scrolling (stationary mode) — redraw static if so
      const newVs = drawStaticRef.current === drawRef.current
        ? viewportStart // avoid calling getViewportStart in tight loop
        : viewportStart;

      // For page/stationary scroll modes, check if we scrolled past viewport
      const visDuration = lastViewportRef.current.visDur;
      if (t < viewportStart || t > viewportStart + visDuration) {
        drawRef.current(t);
        lastPlayheadPxRef.current = -1; // force redraw next frame
      }
    }
    animationFrameRef.current = requestAnimationFrame(renderLoop);
  }, [videoRef]);

  // ── RAF loop per reproducció + draw estàtic quan pausat ────────────────
  useEffect(() => {
    if (isPlaying) {
      draw(currentTime); // Full draw once when starting playback
      lastPlayheadPxRef.current = -1;
      renderLoop();
    } else {
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

        dragStateRef.current = {
          segmentId: target.id,
          type: target.type,
          startX: ps.latestX,
          originalStart: seg.startTime,
          originalEnd: seg.endTime,
        };
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

    const ds = dragStateRef.current;
    if (ds && e.buttons === 1) {
      const timeDelta = (x - ds.startX) * (getVisibleDuration() / rect.width);

      let nS = ds.originalStart;
      let nE = ds.originalEnd;

      if (ds.type === 'move') {
        nS = Math.max(0, ds.originalStart + timeDelta);
        nE = nS + (ds.originalEnd - ds.originalStart);
        if (nE > duration) {
          nE = duration;
          nS = nE - (ds.originalEnd - ds.originalStart);
        }
      } else if (ds.type === 'resize-start') {
        nS = Math.max(0, Math.min(ds.originalStart + timeDelta, ds.originalEnd - 0.2));
      } else if (ds.type === 'resize-end') {
        nE = Math.min(duration, Math.max(ds.originalStart + 0.2, ds.originalEnd + timeDelta));
      }

      // Ephemeral: update ref only, redraw canvas visually — NO React state
      ephemeralSegRef.current = { id: ds.segmentId, startTime: nS, endTime: nE };
      if (rafRedrawRef.current == null) {
        rafRedrawRef.current = requestAnimationFrame(() => {
          rafRedrawRef.current = null;
          const t = videoRef?.current ? videoRef.current.currentTime : currentTime;
          drawStaticRef.current(t);
          drawPlayheadRef.current(t);
        });
      }
      return;
    }

    // Set cursor via DOM — no React state, no re-render
    const target = getHitTarget(x, y, rect.width, rect.height, timeAtMouse);
    const newCursor = target ? (target.type === 'move' ? 'move' : 'col-resize') : 'default';
    if (canvasRef.current && cursorRef.current !== newCursor) {
      cursorRef.current = newCursor;
      canvasRef.current.style.cursor = newCursor;
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    e.preventDefault();
    e.stopPropagation();

    clearHoldTimer();

    // Si estàvem en mode arrossegament, commit ephemeral → React state
    if (dragStateRef.current) {
      const eph = ephemeralSegRef.current;
      if (eph) {
        onSegmentUpdate?.(eph.id, eph.startTime, eph.endTime);
        ephemeralSegRef.current = null;
      }
      if (rafRedrawRef.current) {
        cancelAnimationFrame(rafRedrawRef.current);
        rafRedrawRef.current = null;
      }
      onSegmentUpdateEnd?.();
      dragStateRef.current = null;
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
          className="absolute inset-0 w-full h-full block"
          style={{ cursor: 'default' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        />
        {/* Overlay canvas — playhead only (redrawn 60fps, cheap) */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full block pointer-events-none"
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

export default React.memo(WaveformTimeline);