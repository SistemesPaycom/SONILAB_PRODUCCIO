// components/VideoEditor/WaveformTimeline.tsx
// Viewport-canvas timeline: canvas always equals visible area, redraws on scroll.
// Waveform extracted via Web Audio API. DOM playhead with diamond indicator.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Segment, Id, TimelineViewMode } from '../../types';
import { useWaveformExtractor } from '../../hooks/useWaveformExtractor';
import * as Icons from '../icons';
import {
  DownloadIcon,
  CursorStationaryIcon,
  CursorPageIcon,
} from './PlayerIcons';

const stripHtml = (text: string) => (text ? text.replace(/<[^>]+>/g, '') : '');

// ── Props ────────────────────────────────────────────────────────────────────

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
  scrollMode?: string;
  // ── Toolbar controls relocated from video toolbar ──
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  autoScrollWave?: boolean;
  onToggleAutoScrollWave?: () => void;
  scrollModeWave?: 'stationary' | 'page';
  onScrollModeChangeWave?: (mode: 'stationary' | 'page') => void;
  autosaveEnabled?: boolean;
  onToggleAutosave?: () => void;
  onSave?: () => void;
  onExportSrt?: () => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MIN_ZOOM = 20;
const MAX_ZOOM = 500;
const DEFAULT_ZOOM = 100;

// Segment interaction constants
const HOLD_MS = 500;           // ms threshold for long-press to arm drag
const EDGE_HIT_PX = 8;        // pixels from segment edge for resize hit zone
const MIN_SEG_DURATION = 0.1;  // minimum segment duration in seconds

// ── Component ────────────────────────────────────────────────────────────────

const WaveformTimeline: React.FC<WaveformTimelineProps> = ({
  videoFile,
  segments,
  duration,
  currentTime,
  onSeek,
  isPlaying,
  videoRef,
  activeId,
  onSegmentUpdate,
  onSegmentUpdateEnd,
  onSegmentClick,
  scrollMode = 'stationary',
  // Relocated toolbar controls
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  autoScrollWave,
  onToggleAutoScrollWave,
  scrollModeWave,
  onScrollModeChangeWave,
  autosaveEnabled,
  onToggleAutosave,
  onSave,
  onExportSrt,
}) => {
  // ── Refs ──
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const seekRafRef = useRef<number | null>(null);
  const pendingSeekRef = useRef<number | null>(null);

  // ── Segment drag interaction refs ──
  const mouseDownActiveRef = useRef(false);
  const mouseDownTsRef = useRef(0);
  const mouseDownClientRef = useRef({ x: 0, y: 0 });
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragArmedRef = useRef(false);
  const dragTypeRef = useRef<'move' | 'resize-start' | 'resize-end' | null>(null);
  const dragSegIdRef = useRef<Id | null>(null);
  const dragAnchorTimeRef = useRef(0);
  const dragSegOrigStartRef = useRef(0);
  const dragSegOrigEndRef = useRef(0);
  const seekDragActiveRef = useRef(false);

  // Keep mutable refs for values used in RAF loop
  const zoomRef = useRef(DEFAULT_ZOOM);
  const viewportWRef = useRef(0);
  const scrollModeRef = useRef(scrollMode);

  // ── State ──
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(120);

  // Mutable refs for values read inside drawVisible / RAF (avoid callback deps)
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  // Sync refs
  zoomRef.current = zoom;
  viewportWRef.current = viewportWidth;
  scrollModeRef.current = scrollMode;

  // ── Waveform extraction ──
  const { extract, peaks, status: waveStatus } = useWaveformExtractor();

  useEffect(() => {
    if (videoFile) extract(videoFile);
  }, [videoFile, extract]);

  // ── Viewport resize observer ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) {
        setViewportWidth(r.width);
        setViewportHeight(r.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── Derived ──
  const totalWidth = Math.max(duration * zoom, viewportWidth);

  // ── Draw visible portion of the canvas ──
  const drawVisible = useCallback(
    (scrollLeft: number) => {
      const canvas = canvasRef.current;
      if (!canvas || viewportWidth <= 0 || viewportHeight <= 0) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const w = viewportWidth;
      const h = viewportHeight;

      // Resize backing store if needed
      const bw = Math.ceil(w * dpr);
      const bh = Math.ceil(h * dpr);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Time range visible in this viewport
      const timeStart = scrollLeft / zoom;
      const timeEnd = (scrollLeft + w) / zoom;

      // ── Background ──
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, w, h);

      // ── Center line ──
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      // ── Timecode grid ──
      let step = 1;
      if (zoom < 10) step = 30;
      else if (zoom < 30) step = 10;
      else if (zoom < 80) step = 5;
      else if (zoom < 200) step = 2;

      ctx.strokeStyle = 'rgba(55, 65, 81, 0.3)';
      ctx.lineWidth = 1;
      ctx.fillStyle = 'rgba(107, 114, 128, 0.6)';
      ctx.font = '9px sans-serif';

      const firstMark = Math.floor(timeStart / step) * step;
      for (let t = firstMark; t <= timeEnd; t += step) {
        if (t < 0) continue;
        const x = (t - timeStart) * zoom;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
        const mm = Math.floor(t / 60);
        const ss = Math.floor(t % 60);
        ctx.fillText(`${mm}:${String(ss).padStart(2, '0')}`, x + 3, 12);
      }

      // ── Waveform ──
      if (peaks && peaks.length > 0) {
        const data = peaks.data;
        const amp = h / 2;
        ctx.fillStyle = isPlaying
          ? 'rgba(16, 185, 129, 0.6)'
          : 'rgba(113, 113, 122, 0.5)';

        // peaks has ~100 peaks/sec
        const peaksPerSec = data.length / (peaks.duration || duration || 1);

        for (let px = 0; px < w; px++) {
          const tAtPx = timeStart + px / zoom;
          const tAtPxNext = timeStart + (px + 1) / zoom;

          const idxStart = Math.floor(tAtPx * peaksPerSec);
          const idxEnd = Math.min(Math.ceil(tAtPxNext * peaksPerSec), data.length);

          if (idxStart < 0 || idxStart >= data.length) continue;

          let max = 0;
          for (let j = idxStart; j < idxEnd; j++) {
            if (data[j] > max) max = data[j];
          }

          const barH = Math.max(1, max * amp);
          ctx.fillRect(px, amp - barH, 1, barH * 2);
        }
      }

      // ── Segments (read from refs — no callback dep on segments/activeId) ──
      const margin = 4;
      const boxY = margin;
      const boxH = h - margin * 2;
      const curSegments = segmentsRef.current;
      const curActiveId = activeIdRef.current;

      curSegments.forEach((seg) => {
        const x1 = (seg.startTime - timeStart) * zoom;
        const x2 = (seg.endTime - timeStart) * zoom;
        if (x2 < 0 || x1 > w) return;

        const isActive = seg.id === curActiveId;

        // Background
        ctx.fillStyle = isActive
          ? 'rgba(79, 70, 229, 0.2)'
          : 'rgba(148, 163, 184, 0.08)';
        ctx.fillRect(x1, boxY, x2 - x1, boxH);

        // Border
        ctx.strokeStyle = isActive ? '#6366f1' : '#64748b';
        ctx.lineWidth = isActive ? 1.5 : 0.5;
        ctx.strokeRect(x1, boxY, x2 - x1, boxH);

        // Edge handles
        ctx.fillStyle = isActive ? '#818cf8' : '#94a3b8';
        ctx.fillRect(x1, boxY, 2, boxH);
        ctx.fillRect(x2 - 2, boxY, 2, boxH);

        // Text label
        const segW = x2 - x1;
        if (segW > 24) {
          const text = stripHtml(seg.originalText || '');
          if (text) {
            const fontSize = 10;
            ctx.font = `${fontSize}px sans-serif`;
            ctx.fillStyle = isActive
              ? 'rgba(199, 210, 254, 0.9)'
              : 'rgba(156, 163, 175, 0.7)';
            ctx.save();
            ctx.beginPath();
            ctx.rect(x1 + 3, boxY + 2, segW - 6, boxH - 4);
            ctx.clip();
            ctx.fillText(text, x1 + 5, boxY + fontSize + 3, segW - 10);
            ctx.restore();
          }
        }
      });
    },
    [viewportWidth, viewportHeight, zoom, duration, peaks, isPlaying]
  );

  // ── Redraw on scroll ──
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    drawVisible(scrollRef.current.scrollLeft);
    // Also update playhead position
    const t = videoRef?.current?.currentTime ?? currentTime;
    updatePlayheadPos(t, scrollRef.current.scrollLeft);
  }, [drawVisible]);

  // ── Redraw when core deps change (zoom, peaks, viewport) ──
  useEffect(() => {
    const sl = scrollRef.current?.scrollLeft ?? 0;
    drawVisible(sl);
  }, [drawVisible]);

  // ── Redraw when segments or activeId change (refs updated above, just trigger draw) ──
  useEffect(() => {
    const sl = scrollRef.current?.scrollLeft ?? 0;
    drawVisible(sl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, activeId]);

  // ── Playhead positioning ──
  const updatePlayheadPos = useCallback(
    (time: number, scrollLeft: number) => {
      const el = playheadRef.current;
      if (!el) return;
      const px = time * zoomRef.current - scrollLeft;
      if (px >= -2 && px <= viewportWRef.current + 2) {
        el.style.display = 'flex';
        el.style.transform = `translateX(${px}px)`;
      } else {
        el.style.display = 'none';
      }
    },
    []
  );

  // Update playhead when paused
  useEffect(() => {
    if (!isPlaying) {
      const sl = scrollRef.current?.scrollLeft ?? 0;
      updatePlayheadPos(currentTime, sl);
    }
  }, [currentTime, isPlaying, updatePlayheadPos, zoom]);

  // ── Auto-scroll when paused (e.g. after manual seek) ──
  // During playback the RAF loop handles auto-scroll at 60fps with the real
  // video time.  This effect only fires on the throttled currentTime state
  // (~250ms), so running it while playing would fight the RAF loop — especially
  // in page mode where a stale time can trigger a backwards page jump.
  useEffect(() => {
    if (isPlaying || isDraggingRef.current || !scrollRef.current) return;
    const px = currentTime * zoom;
    const sl = scrollRef.current.scrollLeft;
    if (scrollMode === 'page') {
      if (px > sl + viewportWidth * 0.97 || px < sl) {
        scrollRef.current.scrollLeft = px - viewportWidth * 0.03;
      }
    } else {
      // Stationary: always center on cursor position
      scrollRef.current.scrollLeft = px - viewportWidth / 2;
    }
  }, [currentTime, isPlaying, zoom, viewportWidth, scrollMode]);

  // ── RAF loop during playback (playhead only) ──
  useEffect(() => {
    if (!isPlaying || !videoRef?.current) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    const loop = () => {
      const vid = videoRef.current;
      const scroll = scrollRef.current;
      if (vid && scroll) {
        const t = vid.currentTime;

        // Auto-scroll if playhead about to leave viewport
        if (!isDraggingRef.current) {
          const px = t * zoomRef.current;
          const vw = viewportWRef.current;
          if (scrollModeRef.current === 'page') {
            // Page mode: jump when cursor reaches ~97% of right edge or goes before page start
            const sl = scroll.scrollLeft;
            if (px > sl + vw * 0.97 || px < sl) {
              scroll.scrollLeft = px - vw * 0.03;
            }
          } else {
            // Stationary mode: keep cursor fixed at center, timeline scrolls underneath
            scroll.scrollLeft = px - vw / 2;
          }
        }

        updatePlayheadPos(t, scroll.scrollLeft);
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [isPlaying, videoRef, updatePlayheadPos]);

  // ── Click / drag to seek ──
  const pixelToTime = useCallback(
    (clientX: number) => {
      if (!scrollRef.current) return 0;
      const rect = scrollRef.current.getBoundingClientRect();
      const relX = clientX - rect.left;
      const scrollLeft = scrollRef.current.scrollLeft;
      const targetPx = scrollLeft + relX;
      return Math.max(0, Math.min(duration, targetPx / zoom));
    },
    [duration, zoom]
  );

  // RAF-throttled seek: coalesces multiple mousemove events into one setState per frame
  const throttledSeek = useCallback(
    (time: number) => {
      pendingSeekRef.current = time;
      if (seekRafRef.current === null) {
        seekRafRef.current = requestAnimationFrame(() => {
          seekRafRef.current = null;
          if (pendingSeekRef.current !== null) {
            onSeek(pendingSeekRef.current);
            pendingSeekRef.current = null;
          }
        });
      }
    },
    [onSeek]
  );

  // ── Hit-test: find segment and zone under cursor ──
  const hitTestSegment = useCallback(
    (clientX: number): { id: Id; zone: 'start' | 'end' | 'body' } | null => {
      const sc = scrollRef.current;
      if (!sc) return null;
      const rect = sc.getBoundingClientRect();
      const absX = clientX - rect.left + sc.scrollLeft; // absolute pixel in timeline
      const z = zoomRef.current;
      const segs = segmentsRef.current;
      // Check in reverse so later-drawn (top) segments get priority
      for (let i = segs.length - 1; i >= 0; i--) {
        const s = segs[i];
        const x1 = s.startTime * z;
        const x2 = s.endTime * z;
        if (absX >= x1 - 2 && absX <= x2 + 2) {
          if (absX <= x1 + EDGE_HIT_PX) return { id: s.id, zone: 'start' };
          if (absX >= x2 - EDGE_HIT_PX) return { id: s.id, zone: 'end' };
          return { id: s.id, zone: 'body' };
        }
      }
      return null;
    },
    []
  );

  const clearHold = useCallback(() => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  // ── Neighbor bounds for overlap prevention ──
  const getNeighborBounds = useCallback(
    (segId: Id) => {
      const segs = segmentsRef.current;
      const idx = segs.findIndex((s) => s.id === segId);
      return {
        prevEnd: idx > 0 ? segs[idx - 1].endTime : 0,
        nextStart: idx < segs.length - 1 ? segs[idx + 1].startTime : duration,
      };
    },
    [duration]
  );

  // ── Mouse handlers with short-click / long-press discrimination ──

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return; // left button only
      mouseDownTsRef.current = performance.now();
      mouseDownClientRef.current = { x: e.clientX, y: e.clientY };
      mouseDownActiveRef.current = true;
      dragArmedRef.current = false;
      dragTypeRef.current = null;
      dragSegIdRef.current = null;
      seekDragActiveRef.current = false;
      clearHold();

      const hit = hitTestSegment(e.clientX);
      if (hit) {
        // Do NOT call onSegmentClick here — it causes a seek via the parent.
        // Selection + seek will happen on mouseUp if it's a short click.
        const seg = segmentsRef.current.find((s) => s.id === hit.id);
        if (seg) {
          dragSegIdRef.current = hit.id;
          dragAnchorTimeRef.current = pixelToTime(e.clientX);
          dragSegOrigStartRef.current = seg.startTime;
          dragSegOrigEndRef.current = seg.endTime;
          const zone = hit.zone;
          // Start hold timer — if user holds > HOLD_MS, arm drag
          holdTimerRef.current = setTimeout(() => {
            holdTimerRef.current = null;
            dragArmedRef.current = true;
            isDraggingRef.current = true; // suppress auto-scroll
            dragTypeRef.current =
              zone === 'start'
                ? 'resize-start'
                : zone === 'end'
                ? 'resize-end'
                : 'move';
            const sc = scrollRef.current;
            if (sc) sc.style.cursor = zone === 'body' ? 'grabbing' : 'col-resize';
          }, HOLD_MS);
        }
      }
      // Don't seek on mouseDown — decision happens on mouseUp
    },
    [hitTestSegment, pixelToTime, clearHold]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // ── 1. Segment drag in progress ──
      if (dragArmedRef.current && dragSegIdRef.current && dragTypeRef.current) {
        const curT = pixelToTime(e.clientX);
        const delta = curT - dragAnchorTimeRef.current;
        const allowOverlap = e.shiftKey;
        const { prevEnd, nextStart } = getNeighborBounds(dragSegIdRef.current);
        const origS = dragSegOrigStartRef.current;
        const origE = dragSegOrigEndRef.current;
        let ns = origS,
          ne = origE;

        if (dragTypeRef.current === 'move') {
          const dur = origE - origS;
          ns = origS + delta;
          ne = ns + dur;
          if (!allowOverlap) {
            if (ns < prevEnd) {
              ns = prevEnd;
              ne = ns + dur;
            }
            if (ne > nextStart) {
              ne = nextStart;
              ns = ne - dur;
            }
          }
          if (ns < 0) {
            ns = 0;
            ne = dur;
          }
          if (ne > duration) {
            ne = duration;
            ns = duration - dur;
          }
        } else if (dragTypeRef.current === 'resize-start') {
          ns = origS + delta;
          ne = origE;
          if (!allowOverlap) ns = Math.max(ns, prevEnd);
          ns = Math.max(0, ns);
          if (ne - ns < MIN_SEG_DURATION) ns = ne - MIN_SEG_DURATION;
        } else {
          // resize-end
          ns = origS;
          ne = origE + delta;
          if (!allowOverlap) ne = Math.min(ne, nextStart);
          ne = Math.min(duration, ne);
          if (ne - ns < MIN_SEG_DURATION) ne = ns + MIN_SEG_DURATION;
        }

        onSegmentUpdate?.(dragSegIdRef.current, ns, ne);
        return;
      }

      // ── 2. Waiting for hold timer on a segment ──
      if (holdTimerRef.current !== null) {
        // Don't act while waiting — small movement is tolerated
        return;
      }

      // ── 3. Empty-space seek-drag (scrubbing) ──
      if (mouseDownActiveRef.current && !dragSegIdRef.current) {
        const dx = Math.abs(e.clientX - mouseDownClientRef.current.x);
        if (dx > 3 || seekDragActiveRef.current) {
          seekDragActiveRef.current = true;
          isDraggingRef.current = true;
          throttledSeek(pixelToTime(e.clientX));
        }
        return;
      }

      // ── 4. Hover cursor feedback (no button held) ──
      if (!mouseDownActiveRef.current) {
        const hit = hitTestSegment(e.clientX);
        const sc = scrollRef.current;
        if (sc) {
          sc.style.cursor = hit
            ? hit.zone === 'body'
              ? 'grab'
              : 'col-resize'
            : '';
        }
      }
    },
    [
      pixelToTime,
      throttledSeek,
      onSegmentUpdate,
      duration,
      hitTestSegment,
      getNeighborBounds,
    ]
  );

  const handleMouseUp = useCallback(
    (e?: React.MouseEvent) => {
      clearHold();
      const wasArmed = dragArmedRef.current;
      const wasSeekDrag = seekDragActiveRef.current;

      // Finish segment drag
      if (wasArmed && dragSegIdRef.current) {
        onSegmentUpdateEnd?.();
      }

      // Short click → select segment + seek on mouseUp (only if no drag occurred)
      if (!wasArmed && !wasSeekDrag && e) {
        const elapsed = performance.now() - mouseDownTsRef.current;
        if (elapsed < HOLD_MS) {
          // If the short click was on a segment, select it now (triggers parent seek too)
          if (dragSegIdRef.current) {
            onSegmentClick?.(dragSegIdRef.current);
          } else {
            // Empty space: direct seek
            onSeek(pixelToTime(e.clientX));
          }
        }
      }

      // Flush pending seek from scrub-drag
      if (wasSeekDrag) {
        if (seekRafRef.current !== null) {
          cancelAnimationFrame(seekRafRef.current);
          seekRafRef.current = null;
        }
        if (pendingSeekRef.current !== null) {
          onSeek(pendingSeekRef.current);
          pendingSeekRef.current = null;
        }
      }

      // Reset all interaction state
      isDraggingRef.current = false;
      dragArmedRef.current = false;
      dragTypeRef.current = null;
      dragSegIdRef.current = null;
      seekDragActiveRef.current = false;
      mouseDownActiveRef.current = false;
      const sc = scrollRef.current;
      if (sc) sc.style.cursor = '';
    },
    [clearHold, onSegmentUpdateEnd, onSeek, onSegmentClick, pixelToTime]
  );

  // Separate handler for mouse leave — cleans up without seeking
  const handleMouseLeave = useCallback(() => {
    clearHold();
    if (dragArmedRef.current && dragSegIdRef.current) {
      onSegmentUpdateEnd?.();
    }
    isDraggingRef.current = false;
    dragArmedRef.current = false;
    dragTypeRef.current = null;
    dragSegIdRef.current = null;
    seekDragActiveRef.current = false;
    mouseDownActiveRef.current = false;
    const sc = scrollRef.current;
    if (sc) sc.style.cursor = '';
  }, [clearHold, onSegmentUpdateEnd]);

  // ── Zoom with Ctrl+Wheel ──
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      setZoom((prev) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev * factor)));
    }
  }, []);

  return (
    <div
      className="w-full h-full flex flex-col bg-gray-900 border-t border-gray-800 select-none overflow-hidden"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-1 text-xs bg-gray-800 border-b border-gray-700 z-10 gap-2">
        {/* LEFT: Title + status + undo/redo */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-gray-300 font-semibold whitespace-nowrap">Timeline</span>
          {waveStatus === 'loading' && (
            <span className="text-amber-400 text-[10px] animate-pulse whitespace-nowrap">
              Processant àudio…
            </span>
          )}
          {waveStatus === 'error' && (
            <span className="text-red-400 text-[10px] whitespace-nowrap">Error d&apos;extracció</span>
          )}
          {waveStatus === 'ready' && (
            <span className="text-emerald-400 text-[10px] whitespace-nowrap">✓ Àudio</span>
          )}

          {/* Undo / Redo */}
          {(onUndo || onRedo) && (
            <>
              <div className="w-px h-5 bg-gray-700 mx-0.5" />
              <div className="flex items-center gap-0.5">
                <button
                  disabled={!canUndo}
                  onClick={onUndo}
                  className="p-1 rounded text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-20 transition-all"
                  title="Desfer (Ctrl+Z)"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l5-5m-5 5l5 5" />
                  </svg>
                </button>
                <button
                  disabled={!canRedo}
                  onClick={onRedo}
                  className="p-1 rounded text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-20 transition-all"
                  title="Refer (Ctrl+Shift+Z)"
                >
                  <svg className="w-3.5 h-3.5 scale-x-[-1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l5-5m-5 5l5 5" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>

        {/* CENTER: Auto-scroll + scroll mode */}
        <div className="flex items-center gap-2">
          {onToggleAutoScrollWave && (
            <div className="flex items-center gap-1 bg-black/30 rounded-full p-0.5 border border-white/5">
              <button
                onClick={onToggleAutoScrollWave}
                className={`p-1 rounded-full transition-all ${autoScrollWave ? 'bg-blue-600 text-white shadow-inner' : 'text-gray-500 hover:text-gray-300'}`}
                title={autoScrollWave ? 'Seguiment actiu' : 'Seguiment inactiu'}
              >
                <Icons.ArrowDown className={`w-3 h-3 ${autoScrollWave && isPlaying ? 'animate-bounce' : ''}`} />
              </button>
              {onScrollModeChangeWave && (
                <button
                  onClick={() => onScrollModeChangeWave(scrollModeWave === 'stationary' ? 'page' : 'stationary')}
                  className="p-1 rounded-full bg-gray-700 text-gray-400 hover:text-white transition-all"
                  title={scrollModeWave === 'stationary' ? 'Mode estacionari' : 'Mode pàgina'}
                >
                  {scrollModeWave === 'stationary' ? <CursorStationaryIcon className="w-3 h-3" /> : <CursorPageIcon className="w-3 h-3" />}
                </button>
              )}
            </div>
          )}

          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z / 1.5))}
              className="px-1 py-0.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            >
              −
            </button>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-20 accent-blue-500"
            />
            <button
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.5))}
              className="px-1 py-0.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            >
              +
            </button>
            <span className="text-gray-500 text-[10px] font-mono w-12 text-right whitespace-nowrap">
              {zoom.toFixed(0)}px/s
            </span>
          </div>
        </div>

        {/* RIGHT: Save / Autosave / Export */}
        <div className="flex items-center gap-1.5 min-w-0">
          {onToggleAutosave && (
            <button
              onClick={onToggleAutosave}
              className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border whitespace-nowrap ${
                autosaveEnabled ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-gray-800 text-gray-500 border-gray-700'
              }`}
              title="Autosave"
            >
              AUTO
            </button>
          )}
          {onSave && (
            <button
              onClick={onSave}
              className="p-1 text-blue-300 hover:text-blue-200 transition-colors"
              title="Guardar (Ctrl+S)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zM12 19a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm3-10H5V5h10v4z"/>
              </svg>
            </button>
          )}
          {onExportSrt && (
            <button
              onClick={onExportSrt}
              className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors"
              title="Exportar SRT final"
            >
              <DownloadIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Timeline viewport ── */}
      <div
        ref={containerRef}
        className="flex-1 relative min-h-0 w-full"
        onWheel={handleWheel}
      >
        {/* Scrollable spacer — provides the scrollbar */}
        <div
          ref={scrollRef}
          className="absolute inset-0 overflow-x-auto overflow-y-hidden"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 #111827' }}
          onScroll={handleScroll}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
        >
          {/* Invisible spacer to create correct scroll width */}
          <div style={{ width: totalWidth, height: 1, pointerEvents: 'none' }} />
        </div>

        {/* Canvas — viewport-sized, drawn from scroll position */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block pointer-events-none"
        />

        {/* ── DOM Playhead ── */}
        <div
          ref={playheadRef}
          className="absolute top-0 h-full flex flex-col items-center pointer-events-none z-20"
          style={{ left: 0, willChange: 'transform' }}
        >
          <div
            className="w-2.5 h-2.5 bg-white rotate-45 -mt-1"
            style={{ boxShadow: '0 0 6px rgba(255,255,255,0.6)' }}
          />
          <div
            className="w-px flex-1"
            style={{
              background: 'rgba(255, 255, 255, 0.85)',
              boxShadow: '0 0 8px rgba(255, 255, 255, 0.4)',
            }}
          />
        </div>

        {/* Empty state */}
        {!videoFile && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500 pointer-events-none">
            Sense àudio
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(WaveformTimeline, (prev, next) => {
  // During playback, skip re-renders when only currentTime changes
  if (prev.isPlaying && next.isPlaying) {
    return (
      prev.videoFile === next.videoFile &&
      prev.segments === next.segments &&
      prev.duration === next.duration &&
      prev.activeId === next.activeId &&
      prev.scrollMode === next.scrollMode &&
      prev.onSeek === next.onSeek &&
      prev.onSegmentUpdate === next.onSegmentUpdate &&
      prev.onSegmentUpdateEnd === next.onSegmentUpdateEnd &&
      prev.onSegmentClick === next.onSegmentClick &&
      prev.canUndo === next.canUndo &&
      prev.canRedo === next.canRedo &&
      prev.autoScrollWave === next.autoScrollWave &&
      prev.scrollModeWave === next.scrollModeWave &&
      prev.autosaveEnabled === next.autosaveEnabled
    );
  }
  return false;
});
