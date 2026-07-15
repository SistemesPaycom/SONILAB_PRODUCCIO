// components/VideoEditor/WaveformTimeline.tsx
// Viewport-canvas timeline: canvas always equals visible area, redraws on scroll.
// Waveform extracted via Web Audio API. DOM playhead with diamond indicator.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Segment, Id, TimelineViewMode } from '../../appTypes';
import { useWaveformExtractor } from '../../hooks/useWaveformExtractor';
import { LOCAL_STORAGE_KEYS, MIN_SEG_DURATION_MS } from '../../constants';
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
  mediaDocId?: string | null;
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
  /** Modificador+clic (estil Subtitle Edit): fixen cues de l'esdeveniment actiu al temps clicat. */
  onSetCueStart?: (timeSeconds: number) => void;
  onSetCueEnd?: (timeSeconds: number) => void;
  onSetCueStartKeepDuration?: (timeSeconds: number) => void;
  onRippleFromCue?: (timeSeconds: number) => void;
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
  /** Quan és cert, el mode de scroll queda bloquejat a 'page' i el botó intern estacionari/pàgina s'oculta (però es manté al DOM). */
  scrollModeLocked?: boolean;
  autosaveEnabled?: boolean;
  onToggleAutosave?: () => void;
  onSave?: () => void;
  onExportSrt?: () => void;
  /** Marge mínim entre subtítols consecutius (ms). Default: 160 */
  minGapMs?: number;
  /** Durada mínima d'un subtítol (ms). Default: 1000 */
  minDurationMs?: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MIN_ZOOM = 20;
const MAX_ZOOM = 500;
const DEFAULT_ZOOM = 100;

// Segment interaction constants
/** Read hold-ms from localStorage; clamp 0–2000, fallback 50 */
function getHoldMs(): number {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.WAVEFORM_HOLD_MS);
    if (raw == null) return 50;
    const parsed = JSON.parse(raw);
    const n = typeof parsed === 'number' ? parsed : Number(parsed);
    if (!Number.isFinite(n)) return 50;
    return Math.max(0, Math.min(2000, n));
  } catch { return 50; }
}
/** Read drag dead-zone px from localStorage; clamp 0–40, fallback 6 */
function getDeadzonePx(): number {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.WAVEFORM_DRAG_DEADZONE_PX);
    if (raw == null) return 6;
    const parsed = JSON.parse(raw);
    const n = typeof parsed === 'number' ? parsed : Number(parsed);
    if (!Number.isFinite(n)) return 6;
    return Math.max(0, Math.min(40, n));
  } catch { return 6; }
}
const EDGE_HIT_PX = 8;        // pixels from segment edge for resize hit zone
const MIN_SEG_DURATION = MIN_SEG_DURATION_MS / 1000;  // seconds, derivat de constants.ts
const RULER_H = 22;            // height of the timecode ruler strip at top of canvas

type PointerZone = 'ruler' | 'content' | 'scrollbar';

// ── Component ────────────────────────────────────────────────────────────────

const WaveformTimeline: React.FC<WaveformTimelineProps> = ({
  videoFile,
  mediaDocId,
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
  onSetCueStart,
  onSetCueEnd,
  onSetCueStartKeepDuration,
  onRippleFromCue,
  autoScroll = true,
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
  scrollModeLocked,
  autosaveEnabled,
  onToggleAutosave,
  onSave,
  onExportSrt,
  minGapMs = 160,
  minDurationMs = 1000,
}) => {
  // ── Seguiment (SPS-0030) ──
  // Una sola veritat per al comportament i per a l'estat encès/apagat del botó: si es llegissin
  // props diferents, el botó podria tornar a mentir (que és exactament el bug d'aquesta tasca).
  const followEnabled = autoScrollWave ?? autoScroll;

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
  const dragMovedRef = useRef(false);   // true un cop el punter supera la zona morta després d'armar
  const deadzonePxRef = useRef(0);      // zona morta (px) capturada al mousedown
  const minDurMsRef = useRef(minDurationMs);
  useEffect(() => { minDurMsRef.current = minDurationMs; }, [minDurationMs]);

  // ── Marc de coordenades del gest (SPS-0029) ──
  // Durant la reproducció el RAF loop reescriu scrollLeft a 60 fps: si un handler deriva el temps
  // del scrollLeft VIU, el punt llegit ja no és el que l'usuari va prémer. El gest, doncs, es
  // resol amb el temps capturat al mousedown. Es guarda SENSE clamp: el hit-test compara píxels
  // absoluts i clampar a [0, duration] convertiria la zona morta de la dreta en un fals positiu
  // sobre l'últim esdeveniment.
  const downRawTimeRef = useRef<number | null>(null);
  // Primer clic de la parella (el doble clic s'ha de resoldre contra el marc que l'usuari veia
  // en prémer, no contra la vista ja recentrada pel seek d'aquell mateix primer clic).
  const firstClickRawTimeRef = useRef<number | null>(null);
  const firstClickZoneRef = useRef<PointerZone | null>(null);
  const firstClickModsRef = useRef(0);
  // Un mousedown amb detail parell és el 2n clic d'una parella: mai arma drag ni scrub, i no
  // reexecuta l'acció de clic simple (el navegador ja hi dispararà un dblclick).
  const pairContinuationRef = useRef(false);

  // Keep mutable refs for values used in RAF loop
  const zoomRef = useRef(DEFAULT_ZOOM);
  const viewportWRef = useRef(0);
  const scrollModeRef = useRef(scrollMode);
  const followEnabledRef = useRef(followEnabled);

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
  followEnabledRef.current = followEnabled;

  // ── Waveform extraction ──
  const { extract, peaks, status: waveStatus } = useWaveformExtractor();

  useEffect(() => {
    if (mediaDocId || videoFile) {
      extract(videoFile ?? null, mediaDocId ?? undefined);
    }
  }, [videoFile, mediaDocId, extract]);

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

  // ── Read theme tokens from CSS custom properties ──
  const getThemeColors = useCallback(() => {
    const s = getComputedStyle(document.documentElement);
    const v = (token: string, fallback: string) => s.getPropertyValue(`--th-${token}`).trim() || fallback;
    return {
      bg:             v('waveform-bg', '#111827'),
      rulerBg:        v('waveform-ruler-bg', 'rgba(0,0,0,0.25)'),
      line:           v('waveform-line', '#374151'),
      grid:           v('waveform-grid', 'rgba(55,65,81,0.3)'),
      gridText:       v('waveform-grid-text', 'rgba(107,114,128,0.6)'),
      bar:            v('waveform-bar', 'rgba(113,113,122,0.5)'),
      barPlay:        v('waveform-bar-play', 'rgba(16,185,129,0.6)'),
      seg:            v('waveform-seg', 'rgba(79,70,229,0.2)'),
      segIdle:        v('waveform-seg-idle', 'rgba(148,163,184,0.08)'),
      segBorder:      v('waveform-seg-border', '#6366f1'),
      segBorderIdle:  v('waveform-seg-border-idle', '#64748b'),
      segHandle:      v('waveform-seg-handle', '#818cf8'),
      segHandleIdle:  v('waveform-seg-handle-idle', '#94a3b8'),
      segText:        v('waveform-seg-text', 'rgba(199,210,254,0.9)'),
      segTextIdle:    v('waveform-seg-text-idle', 'rgba(156,163,175,0.7)'),
    };
  }, []);

  // ── Draw visible portion of the canvas ──
  const drawVisible = useCallback(
    (scrollLeft: number) => {
      const canvas = canvasRef.current;
      if (!canvas || viewportWidth <= 0 || viewportHeight <= 0) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const tc = getThemeColors();

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

      // ── Zone geometry ──
      const rulerH = RULER_H;              // top ruler strip for timecodes
      const contentY = rulerH;             // where waveform + segments start
      const contentH = h - rulerH;         // height of the content zone

      // ── Background ──
      ctx.fillStyle = tc.bg;
      ctx.fillRect(0, 0, w, h);

      // ── Ruler background (slightly differentiated) ──
      ctx.fillStyle = tc.rulerBg || 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, 0, w, rulerH);

      // ── Ruler separator line ──
      ctx.strokeStyle = tc.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, rulerH);
      ctx.lineTo(w, rulerH);
      ctx.stroke();

      // ── Center line (content zone) ──
      ctx.strokeStyle = tc.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const centerY = contentY + contentH / 2;
      ctx.moveTo(0, centerY);
      ctx.lineTo(w, centerY);
      ctx.stroke();

      // ── Timecode grid ──
      let step = 1;
      if (zoom < 10) step = 30;
      else if (zoom < 30) step = 10;
      else if (zoom < 80) step = 5;
      else if (zoom < 200) step = 2;

      const firstMark = Math.floor(timeStart / step) * step;
      for (let t = firstMark; t <= timeEnd; t += step) {
        if (t < 0) continue;
        const x = (t - timeStart) * zoom;

        // Grid lines span full height (ruler + content)
        ctx.strokeStyle = tc.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();

        // Timecode labels ONLY in the ruler zone
        ctx.fillStyle = tc.gridText;
        ctx.font = '10px sans-serif';
        const mm = Math.floor(t / 60);
        const ss = Math.floor(t % 60);
        ctx.fillText(`${mm}:${String(ss).padStart(2, '0')}`, x + 3, rulerH - 5);
      }

      // ── Waveform (drawn inside content zone only) ──
      if (peaks && peaks.length > 0) {
        const data = peaks.data;
        const amp = contentH / 2;
        ctx.fillStyle = isPlaying ? tc.barPlay : tc.bar;

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
          ctx.fillRect(px, centerY - barH, 1, barH * 2);
        }
      }

      // ── Segments (drawn inside content zone only) ──
      const margin = 4;
      const boxY = contentY + margin;
      const boxH = contentH - margin * 2;
      const curSegments = segmentsRef.current;
      const curActiveId = activeIdRef.current;

      curSegments.forEach((seg) => {
        const x1 = (seg.startTime - timeStart) * zoom;
        const x2 = (seg.endTime - timeStart) * zoom;
        if (x2 < 0 || x1 > w) return;

        const isActive = seg.id === curActiveId;

        // Background
        ctx.fillStyle = isActive ? tc.seg : tc.segIdle;
        ctx.fillRect(x1, boxY, x2 - x1, boxH);

        // Border
        ctx.strokeStyle = isActive ? tc.segBorder : tc.segBorderIdle;
        ctx.lineWidth = isActive ? 1.5 : 0.5;
        ctx.strokeRect(x1, boxY, x2 - x1, boxH);

        // Edge handles
        ctx.fillStyle = isActive ? tc.segHandle : tc.segHandleIdle;
        ctx.fillRect(x1, boxY, 2, boxH);
        ctx.fillRect(x2 - 2, boxY, 2, boxH);

        // Text label
        const segW = x2 - x1;
        if (segW > 24) {
          const text = stripHtml(seg.originalText || '');
          if (text) {
            const fontSize = 10;
            ctx.font = `${fontSize}px sans-serif`;
            ctx.fillStyle = isActive ? tc.segText : tc.segTextIdle;
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
    [viewportWidth, viewportHeight, zoom, duration, peaks, isPlaying, getThemeColors]
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
  //
  // Manual/paused seeks (clic, doble clic, salt des de la llista, teclat…) MAI
  // recentren la vista, en cap dels dos modes — només salten si el punt surt de
  // la finestra visible. Recentrar aquí trencava el doble-clic en mode
  // estacionari (SPS-0014): el primer clic ja movia la vista abans que arribés
  // el segon. El recentratge continu propi d'estacionari només s'aplica DURANT
  // la reproducció real (RAF loop, més avall) — arrel: H-00011.
  //
  // El botó «Seguiment» (SPS-0030) NO governa aquest camí, i és deliberat: això no és seguiment,
  // sinó REVELAR el cursor després d'un esdeveniment discret (només salta si el punt ja ha quedat
  // FORA de la finestra). EN PAUSA és qui rescata la vista en canviar el zoom (scrollLeft és en
  // píxels: el zoom desplaça la finestra en temps), en saltar des de la llista o el teclat, en
  // canviar de media i en restaurar la posició (SPS-0007). Apagar-lo aquí deixaria el cursor
  // invisible sense cap via de retorn.
  // DURANT la reproducció amb el seguiment apagat no hi ha cap rescat, i és el que l'usuari demana
  // en apagar-lo: la vista es queda quieta encara que el cursor en surti.
  useEffect(() => {
    if (isPlaying || isDraggingRef.current || !scrollRef.current) return;
    const px = currentTime * zoom;
    const sl = scrollRef.current.scrollLeft;
    if (px > sl + viewportWidth * 0.97 || px < sl) {
      scrollRef.current.scrollLeft = px - viewportWidth * 0.03;
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

        // Auto-scroll if playhead about to leave viewport
        // Amb el «Seguiment» apagat la vista queda quieta durant la reproducció: és la vàlvula
        // d'escapament per treballar sobre una ona que, altrament, es mou sota el punter (SPS-0030).
        // El playhead continua actualitzant-se (fora de la guarda) i s'amaga en sortir de la vista.
        if (!isDraggingRef.current && followEnabledRef.current) {
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
  /** Temps sota el punter amb el scrollLeft viu, SENSE clamp (pot sortir de [0, duration]). */
  const rawTimeAt = useCallback((clientX: number): number | null => {
    const sc = scrollRef.current;
    if (!sc) return null;
    const rect = sc.getBoundingClientRect();
    return (sc.scrollLeft + (clientX - rect.left)) / zoomRef.current;
  }, []);

  const clampToDuration = useCallback(
    (t: number) => Math.max(0, Math.min(duration, t)),
    [duration]
  );

  const pixelToTime = useCallback(
    (clientX: number) => {
      const raw = rawTimeAt(clientX);
      return raw === null ? 0 : clampToDuration(raw);
    },
    [rawTimeAt, clampToDuration]
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

  // ── Hit-test: find segment and zone at a given time ──
  const hitTestAtTime = useCallback(
    (time: number): { id: Id; zone: 'start' | 'end' | 'body' } | null => {
      const z = zoomRef.current;
      const absX = time * z; // absolute pixel in timeline
      const segs = segmentsRef.current;
      // Check in reverse so later-drawn (top) segments get priority
      for (let i = segs.length - 1; i >= 0; i--) {
        const s = segs[i];
        const x1 = s.startTime * z;
        const x2 = s.endTime * z;
        if (absX >= x1 - 2 && absX <= x2 + 2) {
          // Per segments estrets, escalar la zona d'extrem perquè sempre existeixi una zona body central
          const segW = x2 - x1;
          const edgeHit = segW < 2 * EDGE_HIT_PX
            ? Math.max(2, Math.floor(segW * 0.25))
            : EDGE_HIT_PX;
          if (absX <= x1 + edgeHit) return { id: s.id, zone: 'start' };
          if (absX >= x2 - edgeHit) return { id: s.id, zone: 'end' };
          return { id: s.id, zone: 'body' };
        }
      }
      return null;
    },
    []
  );

  // ── Franja vertical sota el punter (SPS-0033) ──
  // `scrollRef` ocupa TOTA l'alçada del visor, i s'hi superposen tres coses ben diferents: la
  // regla de timecodes (que pinta el canvas als RULER_H px de dalt), la zona de contingut, i la
  // barra de scroll horitzontal nativa de sota — que reserva espai de layout i rep els seus
  // propis mousedown/mousemove encara que el canvas la tapi. El hit-test només mira la X, o sigui
  // que sense partir per Y qualsevol de les tres encerta el segment d'aquella columna: prémer la
  // regla o arrossegar la barra movia l'esdeveniment de sota.
  // `clientHeight` exclou la barra; quan no n'hi ha (l'ona hi cap sencera) val l'alçada sencera i
  // no queda cap franja morta.
  const zoneAt = useCallback((clientY: number): PointerZone | null => {
    const sc = scrollRef.current;
    if (!sc) return null;
    const rect = sc.getBoundingClientRect();
    const y = clientY - rect.top;
    if (y < 0 || y >= rect.height) return null;
    // La barra mana sobre la regla: si el visor s'estrenyés fins a solapar-les, el que cal
    // protegir és la barra (arrossegar-la mai pot fer scrub).
    if (y >= sc.clientHeight) return 'scrollbar';
    if (y < RULER_H) return 'ruler';
    return 'content';
  }, []);

  /** Hit-test amb el marc VIU (per al mousedown i per al hover). Només encerta dins el contingut. */
  const hitTestSegment = useCallback(
    (clientX: number, clientY: number) => {
      if (zoneAt(clientY) !== 'content') return null;
      const raw = rawTimeAt(clientX);
      return raw === null ? null : hitTestAtTime(raw);
    },
    [zoneAt, rawTimeAt, hitTestAtTime]
  );

  const clearHold = useCallback(() => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  /**
   * Tanca el gest en curs sense fer cap seek: compromet el drag si l'esdeveniment s'ha mogut de
   * veritat i reseteja tot l'estat d'interacció. La fa servir el mouseleave i la xarxa de seguretat
   * del mousemove (SPS-0032).
   */
  const finishGesture = useCallback(() => {
    clearHold();
    if (dragMovedRef.current && dragSegIdRef.current) {
      onSegmentUpdateEnd?.();
    }
    isDraggingRef.current = false;
    dragArmedRef.current = false;
    dragMovedRef.current = false;
    dragTypeRef.current = null;
    dragSegIdRef.current = null;
    seekDragActiveRef.current = false;
    mouseDownActiveRef.current = false;
    firstClickRawTimeRef.current = null;
    const sc = scrollRef.current;
    if (sc) sc.style.cursor = '';
  }, [clearHold, onSegmentUpdateEnd]);

  // ── Neighbor bounds for overlap prevention + minimum gap ──
  const gapSec = minGapMs / 1000;
  const getNeighborBounds = useCallback(
    (segId: Id) => {
      const segs = segmentsRef.current;
      const idx = segs.findIndex((s) => s.id === segId);
      return {
        prevEnd: idx > 0 ? segs[idx - 1].endTime + gapSec : 0,
        nextStart: idx < segs.length - 1 ? segs[idx + 1].startTime - gapSec : duration,
      };
    },
    [duration, gapSec]
  );

  // ── Mouse handlers with short-click / long-press discrimination ──

  /** Màscara de modificadors, per comparar dos clics d'una mateixa parella. */
  const modMask = (e: React.MouseEvent) =>
    (e.ctrlKey || e.metaKey ? 1 : 0) | (e.shiftKey ? 2 : 0) | (e.altKey ? 4 : 0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return; // left button only
      // Press sobre la barra de scroll nativa: el navegador ja la gestiona tota sola. Aquí no
      // s'arma RES —ni latch, ni drag, ni scrub— perquè arrossegar-la no pot moure un esdeveniment
      // ni moure el cursor de transport. Va DESPRÉS del filtre de botó: si es fes abans, prémer el
      // dret damunt la barra enmig d'un drag armat el consumiria (SPS-0032).
      // Es tanca amb finishGesture i no amb un reset parcial: deixar `dragArmed` viu amb
      // `mouseDownActive` fals desactivaria la xarxa de seguretat del mousemove (que mira
      // `mouseDownActive`) sense aturar el drag (que no la mira) — el segment seguiria el punter
      // amb el botó ja deixat anar.
      const downZone = zoneAt(e.clientY);
      if (downZone === null || downZone === 'scrollbar') {
        finishGesture();
        return;
      }

      // detail parell = 2n clic d'una parella (el navegador hi dispararà un dblclick). Es fa servir
      // la paritat i no `>= 2` perquè una cadena llarga són parelles independents: el 3r clic torna
      // a ser un clic simple de ple dret.
      const isPairContinuation = e.detail > 0 && e.detail % 2 === 0;
      pairContinuationRef.current = isPairContinuation;
      downRawTimeRef.current = rawTimeAt(e.clientX);
      if (!isPairContinuation) {
        firstClickRawTimeRef.current = downRawTimeRef.current;
        firstClickZoneRef.current = downZone;
        firstClickModsRef.current = modMask(e);
      }

      mouseDownTsRef.current = performance.now();
      mouseDownClientRef.current = { x: e.clientX, y: e.clientY };
      mouseDownActiveRef.current = true;
      dragArmedRef.current = false;
      dragMovedRef.current = false;
      deadzonePxRef.current = getDeadzonePx();
      dragTypeRef.current = null;
      dragSegIdRef.current = null;
      seekDragActiveRef.current = false;
      clearHold();

      // A la regla, `hit` sempre és null: cap drag ni resize. Hi queda el seek del clic simple (i
      // el scrub en arrossegar), que és el que fa la regla de timecodes de qualsevol editor.
      const hit = hitTestSegment(e.clientX, e.clientY);
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
          // Start hold timer — if user holds > HOLD_MS, arm drag.
          // Al 2n clic d'una parella, no: el hit-test l'ha resolt amb la vista JA recentrada pel
          // seek del primer clic, o sigui que podria armar un drag sobre un esdeveniment que
          // l'usuari no ha assenyalat mai (SPS-0029).
          if (!isPairContinuation) {
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
            }, getHoldMs());
          }
        }
      }
      // Don't seek on mouseDown — decision happens on mouseUp
    },
    [hitTestSegment, pixelToTime, rawTimeAt, clearHold, zoneAt, finishGesture]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // ── 0. Xarxa de seguretat: el mouseup s'ha perdut ──
      // Ara que el mouseup filtra el botó (SPS-0032), el gest només el tanca el mouseup de
      // l'esquerre. Si aquest no arriba mai (el menú contextual natiu de Windows se l'empassa
      // mentre és obert), un drag armat continuaria seguint el punter amb el botó ja deixat anar.
      // `buttons` és l'estat VIU dels botons: si el primari ja no hi és, el gest s'ha acabat.
      if (mouseDownActiveRef.current && (e.buttons & 1) === 0) {
        finishGesture();
        return;
      }

      // ── 1. Segment drag in progress ──
      if (dragArmedRef.current && dragSegIdRef.current && dragTypeRef.current) {
        // Zona morta: després d'armar, ignora moviments minúsculs (tremolor) fins que
        // el punter supera el llindar configurat. Evita desplaçar un esdeveniment en un clic.
        if (!dragMovedRef.current) {
          const dxAbs = Math.abs(e.clientX - mouseDownClientRef.current.x);
          if (dxAbs <= deadzonePxRef.current) return;        // dins la zona morta → no moure
          dragMovedRef.current = true;                        // superada → comença el drag real
          dragAnchorTimeRef.current = pixelToTime(e.clientX); // reancora al punt de creuament (evita el salt = zona morta)
        }
        const curT = pixelToTime(e.clientX);
        const delta = curT - dragAnchorTimeRef.current;
        const allowOverlap = e.shiftKey;
        const { prevEnd, nextStart } = getNeighborBounds(dragSegIdRef.current);
        const origS = dragSegOrigStartRef.current;
        const origE = dragSegOrigEndRef.current;
        let ns = origS,
          ne = origE;
        const minDurSec = Math.max(MIN_SEG_DURATION_MS, minDurMsRef.current) / 1000;

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
          if (ne - ns < minDurSec) ns = ne - minDurSec;
        } else {
          // resize-end
          ns = origS;
          ne = origE + delta;
          if (!allowOverlap) ne = Math.min(ne, nextStart);
          ne = Math.min(duration, ne);
          if (ne - ns < minDurSec) ne = ns + minDurSec;
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
      // El 2n clic d'una parella no fa scrub: la seva deriva no està acotada pel llindar de doble
      // clic del SO (que només compara els dos punts de pressió) i el seek de brossa sobreescriuria
      // el del primer clic (SPS-0029).
      if (mouseDownActiveRef.current && !dragSegIdRef.current && !pairContinuationRef.current) {
        const dx = Math.abs(e.clientX - mouseDownClientRef.current.x);
        if (dx > 3 || seekDragActiveRef.current) {
          seekDragActiveRef.current = true;
          isDraggingRef.current = true;
          throttledSeek(pixelToTime(e.clientX));
        }
        return;
      }

      // ── 4. Hover cursor feedback (no button held) ──
      // Sense return anticipat per zona: cal que aquesta branca s'executi TAMBÉ sobre la regla i la
      // barra, perquè és qui neteja el cursor `grab`/`col-resize` en sortir d'un esdeveniment.
      if (!mouseDownActiveRef.current) {
        const sc = scrollRef.current;
        if (sc) {
          const hit = hitTestSegment(e.clientX, e.clientY);
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
      finishGesture,
    ]
  );

  const handleMouseUp = useCallback(
    (e?: React.MouseEvent) => {
      // Només el botó primari tanca el gest (simètric amb handleMouseDown). A Windows el menú
      // contextual surt al mouse-up del botó dret: sense aquest filtre, prémer el dret amb
      // l'esquerre encara premut consumia el gest (seek + reset de tot l'estat) enmig d'un drag
      // que l'usuari no havia deixat anar (SPS-0032).
      if (e && e.button !== 0) return;
      clearHold();
      // El gest ha començat a la regla o al contingut. Fals si venia de la barra superior, i també
      // si venia de la barra de scroll: allà el mousedown surt sense armar res (SPS-0033).
      const startedInWave = mouseDownActiveRef.current;
      const wasDragged = dragMovedRef.current;   // el punter ha superat la zona morta → drag real
      const wasSeekDrag = seekDragActiveRef.current;

      // Commit del drag només si l'esdeveniment s'ha mogut de veritat
      if (wasDragged && dragSegIdRef.current) {
        onSegmentUpdateEnd?.();
      }

      // Clic simple → mou el cursor de transport al punt EXACTE clicat (mai selecciona).
      // NOMÉS si el gest ha començat dins la zona d'ona (mousedown a scrollRef): així un clic
      // a la barra superior (Timeline/Audio/undo/mode…) no mou el cursor.
      // La selecció d'un esdeveniment es fa amb DOBLE clic (estil Subtitle Edit) — veure handleDoubleClick.
      //
      // El temps surt del latch del mousedown, no del punter al mouseup: durant la reproducció la
      // vista es mou sota el gest i recalcular-lo aquí desplaçava el seek i les cues tota la durada
      // de la pressió (SPS-0029).
      if (startedInWave && !wasDragged && !wasSeekDrag && e && downRawTimeRef.current !== null) {
        // El 2n clic d'una parella no repeteix l'acció: el primer ja l'ha executada al mateix punt
        // (dins de la distància de doble clic del SO) i el marc de coordenades pot haver-se mogut
        // entremig. S'exceptua el cas de modificadors diferents (p. ex. clic i tot seguit Shift+clic):
        // allà el 2n clic és una acció distinta i deliberada, i s'executa amb el seu propi latch.
        const redundantSecondClick =
          pairContinuationRef.current && modMask(e) === firstClickModsRef.current;
        if (!redundantSecondClick) {
          // Modificador+clic (estil Subtitle Edit): fixa cues de l'esdeveniment actiu al punt clicat.
          const t = clampToDuration(downRawTimeRef.current);
          const ctrl = e.ctrlKey || e.metaKey;
          if (ctrl && e.shiftKey && !e.altKey) onRippleFromCue?.(t);
          else if (e.shiftKey && !ctrl && !e.altKey) onSetCueStart?.(t);
          else if (ctrl && !e.shiftKey && !e.altKey) onSetCueEnd?.(t);
          else if (e.altKey && !ctrl && !e.shiftKey) onSetCueStartKeepDuration?.(t);
          else onSeek(t);
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

      // Un gest que ha acabat sent drag o scrub no pot ser el primer clic d'un doble clic:
      // invalida el latch de parella perquè un dblclick posterior no el consumeixi.
      if (wasDragged || wasSeekDrag) firstClickRawTimeRef.current = null;

      // Reset all interaction state
      isDraggingRef.current = false;
      dragArmedRef.current = false;
      dragMovedRef.current = false;
      dragTypeRef.current = null;
      dragSegIdRef.current = null;
      seekDragActiveRef.current = false;
      mouseDownActiveRef.current = false;
      const sc = scrollRef.current;
      if (sc) sc.style.cursor = '';
    },
    [clearHold, onSegmentUpdateEnd, onSeek, clampToDuration, onSetCueStart, onSetCueEnd, onSetCueStartKeepDuration, onRippleFromCue]
  );

  // Doble clic sobre un esdeveniment → selecciona'l (estil Subtitle Edit). El clic simple només mou el cursor.
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      // Només dins la zona d'ona (scrollRef), no a la barra superior
      if (!scrollRef.current || !scrollRef.current.contains(e.target as Node)) return;
      // Es resol contra el temps latched del PRIMER clic de la parella: el seek d'aquell primer clic
      // ja pot haver recentrat (estacionari) o saltat de pàgina la vista, i el hit-test amb el
      // punter viu seleccionaria un esdeveniment que l'usuari no ha assenyalat mai (SPS-0029).
      const isPair = e.detail > 0 && e.detail % 2 === 0;
      const fromLatch = isPair && firstClickRawTimeRef.current !== null;
      // La zona surt del MATEIX marc que el temps. Barrejar la Y viva del 2n clic amb el temps
      // latched del 1r obriria les dues portes que aquesta tasca tanca: prémer la regla i derivar
      // 2 px avall (dins la distància de doble clic del SO) seleccionaria igualment, i un doble
      // clic legítim ran de la regla es perdria (SPS-0033).
      const zone = fromLatch ? firstClickZoneRef.current : zoneAt(e.clientY);
      if (zone !== 'content') return;
      const t = fromLatch ? firstClickRawTimeRef.current : rawTimeAt(e.clientX);
      if (t === null) return;
      const hit = hitTestAtTime(t);
      if (hit) onSegmentClick?.(hit.id);
    },
    [rawTimeAt, hitTestAtTime, onSegmentClick, zoneAt]
  );

  // Separate handler for mouse leave — cleans up without seeking
  const handleMouseLeave = finishGesture;

  // El comptador de clics del navegador és purament temps+distància: no mira el DOM. Una parella
  // pot començar FORA de l'ona (capçalera, o qualsevol punt de l'app a tocar de la vora) i acabar
  // dins; llavors el mousedown de dins arriba amb detail=2 i no reescriu el latch. Sense això, el
  // dblclick consumiria el latch ranci d'un gest anterior i seleccionaria un esdeveniment arbitrari.
  useEffect(() => {
    const onDocMouseDown = (ev: MouseEvent) => {
      if (!scrollRef.current?.contains(ev.target as Node)) firstClickRawTimeRef.current = null;
    };
    document.addEventListener('mousedown', onDocMouseDown, true);
    return () => document.removeEventListener('mousedown', onDocMouseDown, true);
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
      className="w-full h-full flex flex-col border-t border-[var(--th-border)] select-none overflow-hidden"
      style={{ backgroundColor: 'var(--th-waveform-bg)' }}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={handleDoubleClick}
    >
      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-1 text-xs border-b border-[var(--th-border)] z-10 gap-2" style={{ backgroundColor: 'var(--th-bg-secondary)' }}>
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
              <div className="w-px h-5 mx-0.5" style={{ backgroundColor: 'var(--th-bg-tertiary)' }} />
              <div className="flex items-center gap-0.5">
                <button
                  disabled={!canUndo}
                  onClick={onUndo}
                  className="p-1 rounded text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-20 transition-all"
                  title="Desfer (Ctrl+Z)"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l5-5m-5 5l5 5" />
                  </svg>
                </button>
                <button
                  disabled={!canRedo}
                  onClick={onRedo}
                  className="p-1 rounded text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-20 transition-all"
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
                className={`p-1 rounded-full transition-all ${followEnabled ? 'text-white shadow-inner' : 'text-gray-500 hover:text-gray-300'}`}
                style={followEnabled ? { backgroundColor: 'var(--th-accent)' } : undefined}
                title={followEnabled ? 'Seguiment actiu' : 'Seguiment inactiu'}
                aria-pressed={followEnabled}
              >
                <Icons.ArrowDown className={`w-3 h-3 ${followEnabled && isPlaying ? 'animate-bounce' : ''}`} />
              </button>
              {onScrollModeChangeWave && (
                <button
                  onClick={() => { if (!scrollModeLocked) onScrollModeChangeWave(scrollModeWave === 'stationary' ? 'page' : 'stationary'); }}
                  className={`p-1 rounded-full text-gray-400 hover:text-white transition-all ${scrollModeLocked ? 'invisible pointer-events-none' : ''}`}
                  style={{ backgroundColor: 'var(--th-bg-tertiary)' }}
                  title={scrollModeWave === 'stationary' ? 'Mode estacionari' : 'Mode pàgina'}
                  aria-hidden={scrollModeLocked || undefined}
                  tabIndex={scrollModeLocked ? -1 : undefined}
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
              className="px-1 py-0.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
            >
              −
            </button>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-20" style={{ accentColor: 'var(--th-accent)' }}
            />
            <button
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.5))}
              className="px-1 py-0.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
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
                autosaveEnabled ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'text-gray-500 border-[var(--th-border)]'
              }`}
              style={!autosaveEnabled ? { backgroundColor: 'var(--th-bg-surface)' } : undefined}
              title="Autosave"
            >
              AUTO
            </button>
          )}
          {onSave && (
            <button
              onClick={onSave}
              className="p-1 transition-colors" style={{ color: 'var(--th-accent-text)' }}
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
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--th-waveform-scrollbar)' }}
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

        {/* Loading overlay — visible mentre s'extreu l'àudio */}
        {waveStatus === 'loading' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <video
              src="/assets/loading.webm"
              autoPlay
              loop
              muted
              playsInline
              className="w-12 h-12"
            />
          </div>
        )}

        {/* Empty state */}
        {!videoFile && !mediaDocId && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500 pointer-events-none">
            Sense àudio
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(WaveformTimeline, (prev, next) => {
  // During playback, skip re-renders when only currentTime changes.
  //
  // Dues regles governen aquesta llista (SPS-0034, precisades a SPS-0036):
  //  1. Tot valor que el RAF o un handler llegeixi per ref (o que sigui dep d'un useMemo/
  //     useCallback intern) ha de ser aquí. Si no hi és, el bail-out salta el cos del render,
  //     l'efecte de sincronització no corre i el ref es queda ranci. Dues excepcions volgudes:
  //     `videoRef` (identitat estable per contracte de useRef) i `currentTime` (només es llegeix
  //     dins d'efectes guardats per `!isPlaying`; durant el play mana el RAF, que llegeix el <video>).
  //  2. Les callbacks es reparteixen en dos grups i NO són intercanviables:
  //     · Les 8 d'interacció amb l'ona (onSeek, onSegmentUpdate, onSegmentUpdateEnd, onSegmentClick
  //       i els 4 cue) SÍ es comparen, i han de fer-ho: són les que executen els gestos d'edició, i
  //       amb el bail-out actiu una closure rància commetria contra un draft vell. El preu és que
  //       els pares les han de mantenir estables (deps als *mètodes* de useDocumentHistory, no a
  //       l'objecte, que és un literal nou cada render) — si un pare no ho fa, el memo no bloqueja mai.
  //     · Les 7 de la toolbar (onUndo, onRedo, onToggleAutoScrollWave, onToggleAutosave, onSave,
  //       onExportSrt, onScrollModeChangeWave) queden fora a propòsit: els pares les passen inline
  //       (`onUndo={() => …}`) i comparar-les desactivaria el memo a cada tick. El que les manté
  //       fresques és comparar el *valor d'estat que capturen* (autosaveEnabled, autoScrollWave,
  //       canUndo/canRedo, segments…): si canvia, hi ha re-render i es reconstrueixen amb la closure nova.
  //     (`onToggleViewMode` també queda fora, però perquè és prop morta: mai es desestructura.)
  if (prev.isPlaying && next.isPlaying) {
    return (
      prev.videoFile === next.videoFile &&
      prev.mediaDocId === next.mediaDocId &&
      prev.segments === next.segments &&
      prev.duration === next.duration &&
      prev.activeId === next.activeId &&
      prev.scrollMode === next.scrollMode &&
      prev.onSeek === next.onSeek &&
      prev.onSegmentUpdate === next.onSegmentUpdate &&
      prev.onSegmentUpdateEnd === next.onSegmentUpdateEnd &&
      prev.onSegmentClick === next.onSegmentClick &&
      prev.onSetCueStart === next.onSetCueStart &&
      prev.onSetCueEnd === next.onSetCueEnd &&
      prev.onSetCueStartKeepDuration === next.onSetCueStartKeepDuration &&
      prev.onRippleFromCue === next.onRippleFromCue &&
      prev.canUndo === next.canUndo &&
      prev.canRedo === next.canRedo &&
      prev.autoScroll === next.autoScroll &&
      prev.autoScrollWave === next.autoScrollWave &&
      prev.scrollModeWave === next.scrollModeWave &&
      prev.scrollModeLocked === next.scrollModeLocked &&
      prev.autosaveEnabled === next.autosaveEnabled &&
      prev.minGapMs === next.minGapMs &&
      prev.minDurationMs === next.minDurationMs
    );
  }
  return false;
});
