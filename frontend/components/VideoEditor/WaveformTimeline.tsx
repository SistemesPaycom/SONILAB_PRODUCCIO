// components/VideoEditor/WaveformTimeline.tsx
// Viewport-canvas timeline: canvas always equals visible area, redraws on scroll.
// Waveform extracted via Web Audio API. DOM playhead with diamond indicator.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Segment, Id, TimelineViewMode } from '../../types';
import { useWaveformExtractor } from '../../hooks/useWaveformExtractor';

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
}

// ── Constants ────────────────────────────────────────────────────────────────

const MIN_ZOOM = 20;
const MAX_ZOOM = 500;
const DEFAULT_ZOOM = 100;

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
}) => {
  // ── Refs ──
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  // Keep mutable refs for values used in RAF loop
  const zoomRef = useRef(DEFAULT_ZOOM);
  const viewportWRef = useRef(0);

  // ── State ──
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(120);

  // Sync refs
  zoomRef.current = zoom;
  viewportWRef.current = viewportWidth;

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

      // ── Segments ──
      const margin = 4;
      const boxY = margin;
      const boxH = h - margin * 2;

      segments.forEach((seg) => {
        const x1 = (seg.startTime - timeStart) * zoom;
        const x2 = (seg.endTime - timeStart) * zoom;
        if (x2 < 0 || x1 > w) return;

        const isActive = seg.id === activeId;

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
    [viewportWidth, viewportHeight, zoom, duration, peaks, segments, activeId, isPlaying]
  );

  // ── Redraw on scroll ──
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    drawVisible(scrollRef.current.scrollLeft);
    // Also update playhead position
    const t = videoRef?.current?.currentTime ?? currentTime;
    updatePlayheadPos(t, scrollRef.current.scrollLeft);
  }, [drawVisible]);

  // ── Redraw when deps change ──
  useEffect(() => {
    const sl = scrollRef.current?.scrollLeft ?? 0;
    drawVisible(sl);
  }, [drawVisible]);

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

  // ── Auto-scroll during playback ──
  useEffect(() => {
    if (!isPlaying || isDraggingRef.current || !scrollRef.current) return;
    const px = currentTime * zoom;
    const sl = scrollRef.current.scrollLeft;
    const margin = viewportWidth * 0.15;
    if (px < sl + margin || px > sl + viewportWidth - margin) {
      scrollRef.current.scrollLeft = px - viewportWidth / 2;
    }
  }, [currentTime, isPlaying, zoom, viewportWidth]);

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
        updatePlayheadPos(t, scroll.scrollLeft);

        // Auto-scroll if playhead about to leave viewport
        if (!isDraggingRef.current) {
          const px = t * zoomRef.current;
          const sl = scroll.scrollLeft;
          const vw = viewportWRef.current;
          if (px > sl + vw * 0.85 || px < sl + vw * 0.15) {
            scroll.scrollLeft = px - vw / 2;
          }
        }
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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDraggingRef.current = true;
      onSeek(pixelToTime(e.clientX));
    },
    [pixelToTime, onSeek]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDraggingRef.current) return;
      onSeek(pixelToTime(e.clientX));
    },
    [pixelToTime, onSeek]
  );

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

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
      onMouseLeave={handleMouseUp}
    >
      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-1 text-xs bg-gray-800 border-b border-gray-700 z-10">
        <div className="flex items-center gap-3">
          <span className="text-gray-300 font-semibold">Timeline</span>
          {waveStatus === 'loading' && (
            <span className="text-amber-400 text-[10px] animate-pulse">
              Processant àudio…
            </span>
          )}
          {waveStatus === 'error' && (
            <span className="text-red-400 text-[10px]">Error d&apos;extracció</span>
          )}
          {waveStatus === 'ready' && (
            <span className="text-emerald-400 text-[10px]">✓ Àudio</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z / 1.5))}
            className="px-1.5 py-0.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          >
            −
          </button>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-24 accent-blue-500"
          />
          <button
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.5))}
            className="px-1.5 py-0.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          >
            +
          </button>
          <span className="text-gray-500 text-[10px] font-mono w-14 text-right">
            {zoom.toFixed(0)}px/s
          </span>
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
      prev.onSeek === next.onSeek &&
      prev.onSegmentUpdate === next.onSegmentUpdate &&
      prev.onSegmentUpdateEnd === next.onSegmentUpdateEnd &&
      prev.onSegmentClick === next.onSegmentClick
    );
  }
  return false;
});
