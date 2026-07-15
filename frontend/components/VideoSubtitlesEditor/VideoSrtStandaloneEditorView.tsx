import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Document, OverlayConfig, Id } from '../../appTypes';
import * as Icons from '../icons';
import { VideoSubtitlesToolbar } from './VideoSubtitlesToolbar';
import { VideoPlaybackArea } from '../VideoEditor/VideoPlaybackArea';
import WaveformTimeline from '../VideoEditor/WaveformTimeline';
import SubtitlesEditor from './SubtitlesEditor';
import { useHorizontalPanelResize } from '../../hooks/usePanelResize';
import { Segment, GeneralConfig } from '../../types/Subtitles';
import { parseSrt, serializeSrt } from '../../utils/SubtitlesEditor/srtParser';
import { computeSmartSplit, computeSplitTimes } from '../../utils/SubtitlesEditor/splitHelpers';
import { DEFAULT_FPS } from '../../utils/SubtitlesEditor/frameTime';
import SyncLibraryModal from './SyncLibraryModal';
import SubtitleAIOperationsModal from './SubtitleAIOperationsModal';
import { useLibrary } from '../../context/Library/SonilabLibraryContext';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import useLocalStorage from '../../hooks/useLocalStorage';
import { LOCAL_STORAGE_KEYS, isAudioOnly, MIN_SEG_DURATION_MS } from '../../constants';
import { useDocumentHistory } from '../../hooks/useDocumentHistory';
import { api } from '../../services/api';
import { SubtitleEditorProvider, useSubtitleEditor } from '../../context/SubtitleEditorContext';
import { useSubtitleAIOperations } from '../../hooks/useSubtitleAIOperations';
import { useResumePosition } from '../../hooks/useResumePosition';

interface VideoSrtStandaloneEditorViewProps {
  currentDoc: Document;
  isEditing: boolean;
  onClose: () => void;
}

const VideoSrtStandaloneEditorViewInner: React.FC<VideoSrtStandaloneEditorViewProps> = ({ currentDoc, isEditing, onClose }) => {
  const { splitPayloadRef } = useSubtitleEditor();
  const { state, dispatch, useBackend } = useLibrary();
  const { syncRequest } = state;

  const [maxLinesSubs] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.MAX_LINES_SUBS, 2);
  const [autosave, setAutosave] = useLocalStorage<boolean>(LOCAL_STORAGE_KEYS.AUTOSAVE_SRT, true);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  // ── Performance: throttle currentTime updates (same as VideoSubtitlesEditorView) ──
  const currentTimeRef = useRef(0);
  const lastTimeUpdateRef = useRef(0);
  const handleTimeUpdateThrottled = useCallback((t: number) => {
    currentTimeRef.current = t;
    const now = performance.now();
    if (now - lastTimeUpdateRef.current > 250) {
      lastTimeUpdateRef.current = now;
      setCurrentTime(t);
    }
  }, []);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [mediaDocId, setMediaDocId] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [linkedMediaMissing, setLinkedMediaMissing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiMode, setAiMode] = useState<'whisper' | 'translate' | 'revision'>('whisper');

  const [autoScrollWave, setAutoScrollWave] = useState(true);
  const [scrollModeWave, setScrollModeWave] = useState<'stationary' | 'page'>('stationary');
  const [autoScrollSubs, setAutoScrollSubs] = useState(true);

  const [activeSegmentId, setActiveSegmentId] = useState<number | null>(null);
  const [subsOverlayConfig, setSubsOverlayConfig] = useState<OverlayConfig>({
    show: true, position: 'bottom', offsetPx: 10, fontScale: 1,
  });

  const [editorMinGapMs, setEditorMinGapMs] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.EDITOR_MIN_GAP_MS, 160);
  const [waveViewMode] = useLocalStorage<'page' | 'duo'>(LOCAL_STORAGE_KEYS.WAVEFORM_VIEW_MODE, 'page');
  const effectiveScrollMode: 'stationary' | 'page' = waveViewMode === 'page' ? 'page' : scrollModeWave;
  const [editorMinDurationMs] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.EDITOR_MIN_DURATION_MS, 1000);
  const [editorFps] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.EDITOR_FPS, DEFAULT_FPS);

  const generalConfig = useMemo<GeneralConfig>(() => ({
    maxCharsPerLine: 40,
    maxLinesPerSubtitle: maxLinesSubs,
    minGapMs: editorMinGapMs,
    minDurationMs: editorMinDurationMs,
  }), [maxLinesSubs, editorMinGapMs, editorMinDurationMs]);

  const [syncSubsEnabled, setSyncSubsEnabled] = useState(true);

  // -------- Subs history (UNDO/REDO/SAVE/AUTOSAVE) --------
  const initialSegments = useMemo(() => {
    const srtText = currentDoc.contentByLang['_unassigned'] || Object.values(currentDoc.contentByLang)[0] || '';
    return parseSrt(srtText);
  }, [currentDoc.id]);

  const subsHistory = useDocumentHistory<Segment[]>(currentDoc.id, initialSegments);
  const segments = subsHistory.present;

  const { isAIProcessing, handleWhisperTranscription, handleAITranslation, handleAIRevision } =
    useSubtitleAIOperations({
      videoSrc,
      segments,
      onCommitSegments: (newSegs) => subsHistory.commit(newSegs),
      onCloseModal: () => setIsAIModalOpen(false),
    });

  useEffect(() => {
    if (segments.length > 0 && activeSegmentId == null) setActiveSegmentId(segments[0].id);
  }, [segments.length]);

  // Sync active segment by time
  useEffect(() => {
    if (!syncSubsEnabled) return;
    const currentSeg = segments.find(s => currentTime >= s.startTime && currentTime < s.endTime);
    if (currentSeg && currentSeg.id !== activeSegmentId) setActiveSegmentId(currentSeg.id);
  }, [currentTime, segments, activeSegmentId, syncSubsEnabled]);

  const onTogglePlay = useCallback(() => setIsPlaying((p) => !p), []);
  const onPlay = useCallback(() => setIsPlaying(true), []);
  const onPause = useCallback(() => { resume.flush(); setIsPlaying(false); }, []);
  const onSeek = useCallback((time: number) => {
    if (videoRef.current) videoRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const resume = useResumePosition({
    docId: currentDoc.id,
    useBackend,
    duration,
    currentTime,
    activeSegmentId,
    segments,
    mediaMissing: linkedMediaMissing,
    seekTo: onSeek,
    setActiveSegmentId,
  });

  const onJumpTime = useCallback((seconds: number) => {
    onSeek(Math.max(0, Math.min(duration, currentTime + seconds)));
  }, [currentTime, duration, onSeek]);

  const onChangeRate = (delta: number) =>
    setPlaybackRate((rate) => {
      const newRate = Math.max(0.5, Math.min(2.0, parseFloat((rate + delta).toFixed(2))));
      if (videoRef.current) videoRef.current.playbackRate = newRate;
      return newRate;
    });

  const handleSegmentClick = useCallback((id: Id) => {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    setActiveSegmentId(numericId);
    if (syncSubsEnabled && videoRef.current) {
      const segment = segments.find((s) => s.id === numericId);
      if (segment) onSeek(Math.max(0, segment.startTime - 0.05)); // pequeño “snappy”
    }
  }, [segments, syncSubsEnabled, onSeek]);

  const onJumpSegment = useCallback((direction: 'prev' | 'next') => {
    if (segments.length === 0) return;
    const idx = segments.findIndex(s => s.id === activeSegmentId);
    if (direction === 'next' && idx < segments.length - 1) handleSegmentClick(segments[idx + 1].id);
    else if (direction === 'prev' && idx > 0) handleSegmentClick(segments[idx - 1].id);
  }, [segments, activeSegmentId, handleSegmentClick]);

  const handleMergeSegmentWithNext = useCallback(() => {
    if (!activeSegmentId || !isEditing) return;
    const idx = segments.findIndex(s => s.id === activeSegmentId);
    if (idx === -1 || idx === segments.length - 1) return;

    const current = segments[idx];
    const next = segments[idx + 1];

    const mergedText = (current.originalText + '\n' + next.originalText).trim();
    const merged = { ...current, endTime: next.endTime, originalText: mergedText, richText: mergedText };

    const newSegments = [...segments];
    newSegments.splice(idx, 2, merged);
    subsHistory.commit(newSegments.map((s, i) => ({ ...s, id: i + 1 })));
  }, [activeSegmentId, segments, isEditing, subsHistory]);

  const handleInsertSegment = useCallback((id: number, position: 'before' | 'after') => {
    if (!isEditing) return;
    const idx = segments.findIndex(s => s.id === id);
    if (idx === -1) return;

    const target = segments[idx];
    const gap = (generalConfig.minGapMs ?? 160) / 1000;
    const minDur = Math.max(MIN_SEG_DURATION_MS, generalConfig.minDurationMs ?? 1000) / 1000;
    let newSeg: Segment;

    if (position === 'after') {
      const next = segments[idx + 1];
      const start = target.endTime + gap;
      // Volem ~minDur (o fins a 2s si hi ha marge) però MAI trepitjar el següent.
      // Si el buit fins al següent és menor que minDur, la durada queda més curta
      // (saltarà l'alerta de durada mínima) abans que solapar el subtítol veí.
      let end = next ? Math.min(next.startTime - gap, start + 2) : start + 2;
      const minEnd = start + minDur;
      if (end < minEnd) end = next ? Math.min(minEnd, next.startTime - gap) : minEnd;
      if (end <= start) end = minEnd; // sense buit lliure: últim recurs
      newSeg = { id: Date.now(), startTime: Math.max(0, start), endTime: end, originalText: '' };
    } else {
      const prev = idx > 0 ? segments[idx - 1] : null;
      const end = target.startTime - 0.1;
      const start = prev ? Math.max(prev.endTime + 0.1, end - 2) : Math.max(0, end - 2);
      newSeg = { id: Date.now(), startTime: Math.max(0, start), endTime: Math.max(end, 0.5), originalText: '' };
    }

    const insertAt = position === 'after' ? idx + 1 : idx;
    const newSegments = [...segments];
    newSegments.splice(insertAt, 0, newSeg);
    subsHistory.commit(newSegments.map((s, i) => ({ ...s, id: i + 1 })));
  }, [isEditing, segments, generalConfig.minGapMs, generalConfig.minDurationMs, subsHistory]);

  // Insereix un nou subtítol EXACTAMENT al cursor (playhead) amb durada per defecte
  // = durada mínima configurada (1000ms). Si el cursor és massa a prop del següent
  // subtítol, desplaça l'inici cap enrere per conservar la durada mínima; si ni així
  // hi cap sense trepitjar cap veí, escurça la durada (mai solapa).
  const handleInsertSegmentAtCursor = useCallback(() => {
    if (!isEditing) return;
    const t = videoRef.current ? videoRef.current.currentTime : currentTimeRef.current;
    const gap = (generalConfig.minGapMs ?? 160) / 1000;
    const minDur = Math.max(MIN_SEG_DURATION_MS, generalConfig.minDurationMs ?? 1000) / 1000;

    // Límits del buit lliure al voltant del cursor: cap subtítol pot ser trepitjat.
    let lowerBound = 0;
    let upperBound = Infinity;
    for (const s of segments) {
      if (s.startTime <= t) lowerBound = Math.max(lowerBound, s.endTime + gap);
      else upperBound = Math.min(upperBound, s.startTime - gap);
    }

    let start = t;
    let end = t + minDur;
    const freeSpace = upperBound - lowerBound;
    if (freeSpace >= minDur) {
      // Hi ha marge per a la durada mínima: col·loca al cursor i desplaça per encaixar.
      if (end > upperBound) { end = upperBound; start = end - minDur; }
      if (start < lowerBound) { start = lowerBound; end = start + minDur; }
    } else if (freeSpace > 0) {
      // Buit insuficient per a minDur: omple'l (durada < minDur), sense trepitjar.
      start = lowerBound;
      end = upperBound;
    }
    // else: cap buit lliure → últim recurs, es queda [t, t + minDur].
    start = Math.max(0, start);

    const newSeg: Segment = { id: Date.now(), startTime: start, endTime: end, originalText: '' };
    let insertAt = segments.findIndex(s => s.startTime > start);
    if (insertAt === -1) insertAt = segments.length;
    const newSegments = [...segments];
    newSegments.splice(insertAt, 0, newSeg);
    subsHistory.commit(newSegments.map((s, i) => ({ ...s, id: i + 1 })));
  }, [isEditing, segments, generalConfig.minGapMs, generalConfig.minDurationMs, subsHistory]);

  // Crear arrossegant a l'ona (Fase B2, SPS-0028) — simètric amb VideoSubtitlesEditorView.
  const handleCreateSegment = useCallback((start: number, end: number) => {
    if (!isEditing) return;
    const gap = (generalConfig.minGapMs ?? 160) / 1000;
    let s = Math.min(start, end);
    let e = Math.max(start, end);
    let lowerBound = 0;
    let upperBound = duration;
    for (const seg of segments) {
      if (seg.endTime <= s) lowerBound = Math.max(lowerBound, seg.endTime + gap);
      else if (seg.startTime >= e) upperBound = Math.min(upperBound, seg.startTime - gap);
      else return;
    }
    s = Math.max(s, lowerBound, 0);
    e = Math.min(e, upperBound);
    if (e - s < MIN_SEG_DURATION_MS / 1000) return;
    const newSeg: Segment = { id: Date.now(), startTime: s, endTime: e, originalText: '' };
    let insertAt = segments.findIndex(sg => sg.startTime > s);
    if (insertAt === -1) insertAt = segments.length;
    const newSegments = [...segments];
    newSegments.splice(insertAt, 0, newSeg);
    subsHistory.commit(newSegments.map((sg, i) => ({ ...sg, id: i + 1 })));
  }, [isEditing, segments, generalConfig.minGapMs, subsHistory.commit, duration]);

  // Els handlers que arriben a WaveformTimeline depenen de `subsHistory.commit` /
  // `subsHistory.updateDraft`, no de l'objecte `subsHistory`: useDocumentHistory en retorna un
  // literal nou a cada render. El React.memo de l'ona compara aquests handlers, i amb l'objecte a
  // les deps tindrien identitat nova a cada tick de currentTime → el bail-out no saltaria mai.
  // `updateDraft` no canvia mai; `commit` canvia amb el draft, però llavors també canvia `segments`,
  // que el comparador ja mira.

  // ── Modificador+clic a l'ona (estil Subtitle Edit): fixa cues de l'esdeveniment ACTIU al temps clicat ──
  const handleCueStart = useCallback((t: number) => {
    if (!isEditing || !activeSegmentId) return;
    const gap = (generalConfig.minGapMs ?? 160) / 1000;
    const idx = segments.findIndex(s => s.id === activeSegmentId);
    if (idx === -1) return;
    const seg = segments[idx];
    const prevSeg = idx > 0 ? segments[idx - 1] : null;
    let startTime = t;
    if (prevSeg && startTime < prevSeg.endTime + gap) startTime = prevSeg.endTime + gap;
    const minDurSec = Math.max(MIN_SEG_DURATION_MS, generalConfig.minDurationMs ?? 1000) / 1000;
    if (startTime >= seg.endTime - minDurSec) startTime = seg.endTime - minDurSec;
    if (startTime < 0) startTime = 0;
    subsHistory.commit(segments.map(s => s.id === activeSegmentId ? { ...s, startTime } : s));
  }, [isEditing, activeSegmentId, segments, generalConfig.minGapMs, generalConfig.minDurationMs, subsHistory.commit]);

  const handleCueEnd = useCallback((t: number) => {
    if (!isEditing || !activeSegmentId) return;
    const gap = (generalConfig.minGapMs ?? 160) / 1000;
    const idx = segments.findIndex(s => s.id === activeSegmentId);
    if (idx === -1) return;
    const seg = segments[idx];
    const nextSeg = idx < segments.length - 1 ? segments[idx + 1] : null;
    let endTime = t;
    if (nextSeg && endTime > nextSeg.startTime - gap) endTime = nextSeg.startTime - gap;
    const minDurSec = Math.max(MIN_SEG_DURATION_MS, generalConfig.minDurationMs ?? 1000) / 1000;
    if (endTime - seg.startTime < minDurSec) endTime = seg.startTime + minDurSec;
    subsHistory.commit(segments.map(s => s.id === activeSegmentId ? { ...s, endTime } : s));
  }, [isEditing, activeSegmentId, segments, generalConfig.minGapMs, generalConfig.minDurationMs, subsHistory.commit]);

  const handleCueStartKeepDuration = useCallback((t: number) => {
    if (!isEditing || !activeSegmentId) return;
    const gap = (generalConfig.minGapMs ?? 160) / 1000;
    const idx = segments.findIndex(s => s.id === activeSegmentId);
    if (idx === -1) return;
    const seg = segments[idx];
    const dur = seg.endTime - seg.startTime;
    const prevSeg = idx > 0 ? segments[idx - 1] : null;
    const nextSeg = idx < segments.length - 1 ? segments[idx + 1] : null;
    let startTime = t;
    const lowerBound = prevSeg ? prevSeg.endTime + gap : 0;
    const upperBound = (nextSeg ? nextSeg.startTime - gap : duration) - dur;
    if (startTime < lowerBound) startTime = lowerBound;
    if (startTime > upperBound) startTime = upperBound;
    if (startTime < 0) startTime = 0;
    const endTime = startTime + dur;
    subsHistory.commit(segments.map(s => s.id === activeSegmentId ? { ...s, startTime, endTime } : s));
  }, [isEditing, activeSegmentId, segments, generalConfig.minGapMs, subsHistory.commit, duration]);

  const handleRippleFromCue = useCallback((t: number) => {
    if (!isEditing || !activeSegmentId) return;
    const gap = (generalConfig.minGapMs ?? 160) / 1000;
    const idx = segments.findIndex(s => s.id === activeSegmentId);
    if (idx === -1) return;
    const seg = segments[idx];
    const prevSeg = idx > 0 ? segments[idx - 1] : null;
    let startTime = t;
    if (prevSeg && startTime < prevSeg.endTime + gap) startTime = prevSeg.endTime + gap;
    if (startTime < 0) startTime = 0;
    const delta = startTime - seg.startTime;
    subsHistory.commit(segments.map((s, i) => i < idx ? s : { ...s, startTime: s.startTime + delta, endTime: s.endTime + delta }));
  }, [isEditing, activeSegmentId, segments, generalConfig.minGapMs, subsHistory.commit]);

  // ── Nudge de teclat estil Nuendo (Fase C, SPS-0025) ── (simètric amb VideoSubtitlesEditorView)
  const nudgeStart = useCallback((frames: number) => {
    if (!isEditing || !activeSegmentId) return;
    const seg = segments.find(s => s.id === activeSegmentId);
    if (!seg) return;
    handleCueStart(seg.startTime + frames / (editorFps || DEFAULT_FPS));
  }, [isEditing, activeSegmentId, segments, editorFps, handleCueStart]);

  const nudgeEnd = useCallback((frames: number) => {
    if (!isEditing || !activeSegmentId) return;
    const seg = segments.find(s => s.id === activeSegmentId);
    if (!seg) return;
    handleCueEnd(seg.endTime + frames / (editorFps || DEFAULT_FPS));
  }, [isEditing, activeSegmentId, segments, editorFps, handleCueEnd]);

  // Fixar cues al cursor (Fase C, SPS-0025) — simètric amb VideoSubtitlesEditorView (que ja els tenia).
  const handleSetTcIn = useCallback(() => {
    if (!isEditing || !activeSegmentId) return;
    const t = videoRef.current ? videoRef.current.currentTime : currentTimeRef.current;
    const gap = (generalConfig.minGapMs ?? 160) / 1000;
    const idx = segments.findIndex(s => s.id === activeSegmentId);
    if (idx === -1) return;
    const seg = segments[idx];
    const prevSeg = idx > 0 ? segments[idx - 1] : null;
    let startTime = t;
    if (prevSeg && startTime < prevSeg.endTime + gap) startTime = prevSeg.endTime + gap;
    const minDurSec = Math.max(MIN_SEG_DURATION_MS, generalConfig.minDurationMs ?? 1000) / 1000;
    if (startTime >= seg.endTime - minDurSec) startTime = seg.endTime - minDurSec;
    if (startTime < 0) startTime = 0;
    subsHistory.commit(segments.map(s => s.id === activeSegmentId ? { ...s, startTime } : s));
  }, [isEditing, activeSegmentId, segments, generalConfig.minGapMs, generalConfig.minDurationMs, subsHistory.commit]);

  const handleSetTcOut = useCallback(() => {
    if (!isEditing || !activeSegmentId) return;
    const t = videoRef.current ? videoRef.current.currentTime : currentTimeRef.current;
    const gap = (generalConfig.minGapMs ?? 160) / 1000;
    const idx = segments.findIndex(s => s.id === activeSegmentId);
    if (idx === -1) return;
    const seg = segments[idx];
    const nextSeg = idx < segments.length - 1 ? segments[idx + 1] : null;
    let endTime = t;
    if (nextSeg && endTime > nextSeg.startTime - gap) endTime = nextSeg.startTime - gap;
    const minDurSec = Math.max(MIN_SEG_DURATION_MS, generalConfig.minDurationMs ?? 1000) / 1000;
    if (endTime - seg.startTime < minDurSec) endTime = seg.startTime + minDurSec;
    subsHistory.commit(segments.map(s => s.id === activeSegmentId ? { ...s, endTime } : s));
  }, [isEditing, activeSegmentId, segments, generalConfig.minGapMs, generalConfig.minDurationMs, subsHistory.commit]);

  const seekByFrames = useCallback((frames: number) => {
    const t = videoRef.current ? videoRef.current.currentTime : currentTimeRef.current;
    onSeek(Math.max(0, Math.min(duration, t + frames / (editorFps || DEFAULT_FPS))));
  }, [onSeek, duration, editorFps]);

  const fixInRipple = useCallback(() => {
    const t = videoRef.current ? videoRef.current.currentTime : currentTimeRef.current;
    handleRippleFromCue(t);
  }, [handleRippleFromCue]);

  const fixOutNext = useCallback(() => {
    handleSetTcOut();
    onJumpSegment('next');
  }, [handleSetTcOut, onJumpSegment]);

  const handleDeleteSegment = useCallback((id: number) => {
    if (!isEditing || segments.length <= 1) return;
    const newSegments = segments.filter(s => s.id !== id);
    subsHistory.commit(newSegments.map((s, i) => ({ ...s, id: i + 1 })));
  }, [isEditing, segments, subsHistory]);

  const applySplit = useCallback((idx: number, leftText: string, rightText: string, ratio: number, cutTime?: number) => {
    const target = segments[idx];
    const times = computeSplitTimes({
      startTime: target.startTime,
      endTime: target.endTime,
      ratio,
      cutTime,
      minDurSec: Math.max(MIN_SEG_DURATION_MS, generalConfig.minDurationMs ?? 1000) / 1000,
      gapSec: (generalConfig.minGapMs ?? 160) / 1000,
    });
    if (!times) return;

    const newSeg1 = { ...target, endTime: times.leftEnd, originalText: leftText, richText: leftText };
    const newSeg2 = {
      id: Date.now(),
      startTime: times.rightStart,
      endTime: target.endTime,
      originalText: rightText,
      richText: rightText,
    };

    const newSegments = [...segments];
    newSegments.splice(idx, 1, newSeg1, newSeg2);
    subsHistory.commit(newSegments.map((s, i) => ({ ...s, id: i + 1 })));
  }, [segments, subsHistory, generalConfig.minGapMs, generalConfig.minDurationMs]);

  const handleSplitSegmentAtCursor = useCallback((idParam?: number) => {
    // Consumim el payload sempre: els ids es renumeren a cada commit, i un
    // payload obsolet s'aplicaria després a un segment equivocat.
    const payload = splitPayloadRef.current;
    splitPayloadRef.current = null;

    if (!isEditing) return;

    if (payload && (idParam === undefined || payload.id === idParam)) {
      const idx = segments.findIndex(s => s.id === payload.id);
      if (idx === -1) return;
      applySplit(idx, payload.leftText, payload.rightText, payload.splitRatio);
      return;
    }

    const targetId = idParam ?? activeSegmentId;
    if (!targetId) return;

    const idx = segments.findIndex(s => s.id === targetId);
    if (idx === -1) return;

    const smart = computeSmartSplit(segments[idx].originalText || '');
    if (!smart) return;
    applySplit(idx, smart.leftText, smart.rightText, smart.splitRatio);
  }, [segments, activeSegmentId, isEditing, applySplit]);

  // Ctrl+Shift+K: divideix pel PLAYHEAD, no pel cursor de text. El primer bloc acaba
  // exactament al playhead i el segon arrenca un gap més tard (computeSplitTimes encara
  // hi fa respectar la durada mínima); el text es reparteix pel punt lògic més proper a
  // la proporció del playhead dins del bloc. Si el text no admet divisió (buit, un sol
  // caràcter), queda sencer al primer bloc. Si el playhead no és dins de cap subtítol,
  // no fa res.
  const handleSplitSegmentAtPlayhead = useCallback(() => {
    if (!isEditing) return;
    const t = videoRef.current ? videoRef.current.currentTime : currentTimeRef.current;
    const idx = segments.findIndex(s => t > s.startTime && t < s.endTime);
    if (idx === -1) return;

    const target = segments[idx];
    const dur = target.endTime - target.startTime;
    if (dur <= 0) return;
    const ratio = (t - target.startTime) / dur;

    const smart = computeSmartSplit(target.originalText || '', ratio);
    applySplit(
      idx,
      smart ? smart.leftText : (target.originalText || ''),
      smart ? smart.rightText : '',
      ratio,
      t,
    );
  }, [isEditing, segments, applySplit]);

  // ✅ Save (botón + Ctrl+S)
  const handleSave = useCallback(() => {
    if (!isEditing) return;

    subsHistory.save((data) => {
      const srtText = serializeSrt(data);

      // estado local
      dispatch({
        type: 'UPDATE_DOCUMENT_CONTENTS',
        payload: { documentId: currentDoc.id, lang: '_unassigned', content: srtText, csvContent: '' },
      });

      // backend
      if (useBackend) {
        void api.updateSrt(currentDoc.id, srtText).catch((e) => console.error('updateSrt failed', e));
      }
    });
  }, [isEditing, subsHistory, dispatch, currentDoc.id, useBackend]);

  // ✅ Autosave (debounce)
  const autosaveTimer = useRef<any>(null);
  const lastAutosaved = useRef<string>('');

  useEffect(() => {
    if (!autosave || !useBackend || !isEditing) return;

    // Use historyState.present (committed state) so autosave only fires on confirmed
    // actions (drag-end commit, text blur, split, merge, insert, delete, undo, redo)
    // — not on every intermediate updateDraft call during drag or typing.
    const srtText = serializeSrt(subsHistory.historyState.present);
    if (srtText === lastAutosaved.current) return;

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      // Only update lastAutosaved — do NOT dispatch UPDATE_DOCUMENT_CONTENTS here.
      // Dispatching changes state.documents, which re-triggers the video auto-load
      // effect (dep: state.documents) → handleSyncMedia → setCurrentTime(0) → playhead reset.
      void api.updateSrt(currentDoc.id, srtText)
        .then(() => {
          lastAutosaved.current = srtText;
        })
        .catch(() => {});
    }, 300);

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [autosave, useBackend, isEditing, subsHistory.historyState.present, currentDoc.id]);

  useKeyboardShortcuts('subtitlesEditor', (action) => {
    switch (action) {
      case 'SAVE': handleSave(); break;
      case 'UNDO': subsHistory.undo(); break;
      case 'REDO': subsHistory.redo(); break;
      case 'TOGGLE_PLAY_PAUSE': onTogglePlay(); break;
      case 'REWIND_5S': onJumpTime(-5); break;
      case 'FORWARD_5S': onJumpTime(5); break;
      case 'JUMP_NEXT_SEGMENT': case 'NAVIGATE_SEGMENT_DOWN': onJumpSegment('next'); break;
      case 'JUMP_PREV_SEGMENT': case 'NAVIGATE_SEGMENT_UP': onJumpSegment('prev'); break;
      case 'SPLIT_SEGMENT': handleSplitSegmentAtCursor(); break;
      case 'SPLIT_AT_PLAYHEAD': handleSplitSegmentAtPlayhead(); break;
      case 'MERGE_SEGMENT': handleMergeSegmentWithNext(); break;
      case 'SET_TC_IN': handleSetTcIn(); break;
      case 'SET_TC_OUT': handleSetTcOut(); break;
      case 'FIX_IN_RIPPLE': fixInRipple(); break;
      case 'FIX_OUT_NEXT': fixOutNext(); break;
      case 'SEEK_STEP_BACK': onJumpTime(-1); break;
      case 'SEEK_STEP_FWD': onJumpTime(1); break;
      case 'FRAME_STEP_BACK': seekByFrames(-1); break;
      case 'FRAME_STEP_FWD': seekByFrames(1); break;
      case 'NUDGE_START_BACK': nudgeStart(-1); break;
      case 'NUDGE_START_FWD': nudgeStart(1); break;
      case 'NUDGE_END_BACK': nudgeEnd(-1); break;
      case 'NUDGE_END_FWD': nudgeEnd(1); break;
      case 'INSERT_SUBTITLE': handleInsertSegmentAtCursor(); break;
      case 'DELETE_ACTIVE_SEGMENT': {
        const active = document.activeElement as HTMLElement | null;
        if (activeSegmentId && !active?.isContentEditable) {
          handleDeleteSegment(activeSegmentId);
        }
        break;
      }
    }
  });

  const handleSyncMedia = useCallback((doc: Document) => {
    // Streaming directe: el <video> demana bytes sota demanda, sense descàrrega completa.
    setVideoFile(null);
    setMediaDocId(doc.id);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    // Primer assegurem la cookie de només-media; després el <video> carrega la URL
    // SENSE token a la query (SPS-0023). Si la cookie falla, el backend respondrà 401.
    void (async () => {
      try { await api.ensureMediaCookie(); } catch { /* el <video> ho reintentarà; backend valida */ }
      setVideoSrc(api.streamUrl(doc.id));
    })();
    // Persisteix el vincle SRT→media al backend
    if (useBackend) void api.linkMediaToSrt(currentDoc.id, doc.id).catch(() => {});
  }, [useBackend, currentDoc.id]);

  // Consumidor de syncRequest (EditorTabContent ja fa TRIGGER_SYNC_REQUEST en carregar)
  useEffect(() => {
    if (!syncRequest) return;
    const doc = state.documents.find(d => d.id === syncRequest.docId);
    if (!doc) return;
    if (syncRequest.type === 'media') handleSyncMedia(doc);
    dispatch({ type: 'CLEAR_SYNC_REQUEST' });
  }, [syncRequest, dispatch, state.documents, handleSyncMedia]);

  // Auto-restauració del vincle media: llegeix linkedMediaId del document (camp guardat al backend)
  const autoLoadAttemptedRef = useRef(false);
  useEffect(() => {
    if (autoLoadAttemptedRef.current) return;
    if (!useBackend) return;
    const linkedId = (currentDoc as any).linkedMediaId as string | null | undefined;
    if (!linkedId) return;
    autoLoadAttemptedRef.current = true;

    const mediaDoc = state.documents.find(d => d.id === linkedId && !d.isDeleted);
    if (!mediaDoc) {
      setLinkedMediaMissing(true);
      return;
    }

    handleSyncMedia(mediaDoc);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.documents]);

  const handleSegmentChange = (updated: Segment) => {
    if (!isEditing) return;
    const gap = (generalConfig.minGapMs ?? 160) / 1000;
    subsHistory.updateDraft(prev => {
      const idx = prev.findIndex(s => s.id === updated.id);
      if (idx === -1) return prev.map(s => s.id === updated.id ? updated : s);
      const prevSeg = idx > 0 ? prev[idx - 1] : null;
      const nextSeg = idx < prev.length - 1 ? prev[idx + 1] : null;
      let { startTime, endTime } = updated;
      if (prevSeg && startTime < prevSeg.endTime + gap) startTime = prevSeg.endTime + gap;
      if (nextSeg && endTime > nextSeg.startTime - gap) endTime = nextSeg.startTime - gap;
      const minDurSec = Math.max(MIN_SEG_DURATION_MS, generalConfig.minDurationMs ?? 1000) / 1000;
      if (endTime - startTime < minDurSec) {
        // Estirar fins a la durada mínima no pot trepitjar el veí: el no-solapament
        // mana sobre la durada mínima (un bloc curt és vàlid; un de solapat, no).
        const hardEnd = nextSeg ? nextSeg.startTime - gap : Infinity;
        endTime = Math.min(startTime + minDurSec, Math.max(hardEnd, startTime + MIN_SEG_DURATION_MS / 1000));
      }
      return prev.map(s => s.id === updated.id ? { ...updated, startTime, endTime } : s);
    });
  };

  // Format en lot des de SubtitlesEditor (selecció múltiple): un únic pas d'undo.
  const handleSegmentsBatchChange = useCallback((changes: Array<{ id: number; newText: string }>) => {
    if (!isEditing || changes.length === 0) return;
    const byId = new Map(changes.map(c => [c.id, c.newText]));
    subsHistory.commit(
      subsHistory.present.map(s =>
        byId.has(s.id as number)
          ? { ...s, originalText: byId.get(s.id as number)!, richText: '' }
          : s
      )
    );
  }, [isEditing, subsHistory]);

const segIndexRef = useRef<Map<Id, number>>(new Map());

useEffect(() => {
  const m = new Map<Id, number>();
  segments.forEach((s, i) => m.set(s.id, i));
  segIndexRef.current = m;
}, [segments]);

const handleSegmentUpdate = useCallback((id: Id, newStart: number, newEnd: number) => {
  if (!isEditing) return;

  subsHistory.updateDraft((prev) => {
    const idx = segIndexRef.current.get(id);
    if (idx === undefined) return prev;

    const next = prev.slice();
    const cur = next[idx];
    next[idx] = { ...cur, startTime: newStart, endTime: newEnd };
    return next;
  });
}, [isEditing, subsHistory.updateDraft]);

const handleSegmentUpdateEnd = useCallback(() => {
  if (!isEditing) return;
  subsHistory.commit();
}, [isEditing, subsHistory.commit]);

  const activeSegmentForPlayer = useMemo(() => {
    const seg = segments.find((s: Segment) => currentTime >= s.startTime && currentTime < s.endTime);
    return seg ? { id: seg.id, startTime: seg.startTime, endTime: seg.endTime, originalText: seg.originalText, translatedText: '' } : null;
  }, [segments, currentTime]);

  // ── Panell principal: esquerra (subtítols) | dreta (vídeo+toolbar) ─────────
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const { widthPercent: mainSplitPercent, handleMouseDown: handleMainSplitMouseDown } =
    useHorizontalPanelResize(mainContainerRef as React.RefObject<HTMLElement>, 55, 25, 80);

  const playerProps = {
    isPlaying, currentTime, duration, onSeek, videoRef, src: videoSrc, segments, activeId: activeSegmentId,
    activeSegment: subsOverlayConfig.show ? activeSegmentForPlayer : null,
    overlayConfig: { original: subsOverlayConfig, translated: { show: false, position: 'bottom' as const, offsetPx: 10, fontScale: 1 } },
    onTimeUpdate: handleTimeUpdateThrottled, onDurationChange: setDuration, onPlay, onPause, onTogglePlay, onJumpSegment,
    videoFile, mediaDocId, onSegmentUpdate: handleSegmentUpdate, onSegmentClick: handleSegmentClick,
    isAudioOnly: isAudioOnly(state.documents.find(d => d.id === mediaDocId)?.sourceType),
  };

  return (
    <div className="flex flex-col h-full w-full text-gray-200" style={{ backgroundColor: 'var(--th-bg-app)' }}>
      {/* Header */}
      <header className="h-14 flex items-center px-4 justify-between flex-shrink-0" style={{ backgroundColor: 'var(--th-bg-secondary)', borderBottom: '1px solid var(--th-border)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => { resume.flush(); onClose(); }} className="p-2 hover:bg-gray-700 rounded-lg text-gray-400">
            <Icons.ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Standalone SRT Editor</h2>
            <p className="text-[10px] text-gray-500 font-bold">{currentDoc.name}</p>
          </div>
        </div>
        <button
          onClick={() => setIsSyncModalOpen(true)}
          className="px-4 py-2 text-xs font-black rounded-lg transition-all shadow-md uppercase tracking-wider"
          style={{ backgroundColor: 'var(--th-btn-primary-bg)', color: 'var(--th-btn-primary-text)' }}
        >
          Vincular Vídeo
        </button>
      </header>

      {/* ── Cos principal: panell esquerre (subs) + panell dret (vídeo) ───────── */}
      <div ref={mainContainerRef} className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── PANELL ESQUERRE: Subtítols ─────────────────────────────────────── */}
        <div
          className="flex-shrink-0 overflow-hidden"
          style={{ width: `${mainSplitPercent}%`, backgroundColor: 'var(--th-editor-bg)' }}
        >
          <SubtitlesEditor
            title="Llista de Subtítols"
            segments={segments}
            activeId={activeSegmentId}
            isEditable={isEditing}
            onSegmentChange={handleSegmentChange}
            onSegmentBlur={() => subsHistory.commit()}
            onSegmentClick={handleSegmentClick}
            onSegmentFocus={(id: number) => setActiveSegmentId(id)}
            syncEnabled={syncSubsEnabled}
            onSyncChange={setSyncSubsEnabled}
            overlayConfig={subsOverlayConfig}
            onOverlayConfigChange={setSubsOverlayConfig}
            generalConfig={generalConfig}
            editorMinGapMs={editorMinGapMs}
            onEditorMinGapMsChange={setEditorMinGapMs}
            autoScroll={autoScrollSubs}
            onOpenAIOperations={(m) => { setAiMode(m); setIsAIModalOpen(true); }}
            onSplit={handleSplitSegmentAtCursor}
            onMerge={handleMergeSegmentWithNext}
            onInsert={handleInsertSegment}
            onDelete={handleDeleteSegment}
            onSegmentsBatchChange={handleSegmentsBatchChange}
          />
        </div>

        {/* Divisor esquerra | dreta */}
        <div
          className="w-1.5 hover:bg-gray-500/50 cursor-col-resize flex-shrink-0 transition-colors" style={{ backgroundColor: 'var(--th-divider)' }}
          onMouseDown={handleMainSplitMouseDown}
        />

        {/* ── PANELL DRET: Vídeo (flex-grow) + Toolbar (fix) ───────────────── */}
        <div className="flex flex-col flex-grow min-h-0 overflow-hidden">
          <div className="flex-grow min-h-0 bg-black overflow-hidden relative">
            <VideoPlaybackArea {...playerProps} />
            {linkedMediaMissing && !videoSrc && (
              <div className="absolute top-2 left-2 right-2 z-10 bg-amber-900/80 border border-amber-600/50 rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-amber-200">
                <span>⚠</span>
                <span>El vídeo vinculat ha estat eliminat o no està disponible.</span>
                <button onClick={() => setLinkedMediaMissing(false)} className="ml-auto text-amber-400 hover:text-white">✕</button>
              </div>
            )}
          </div>
          <div className="flex-shrink-0 border-t border-gray-700/50" style={{ backgroundColor: 'var(--th-bg-secondary)' }}>
            <VideoSubtitlesToolbar
              onOpenSync={() => setIsSyncModalOpen(true)}
              onExportSrt={() => {}}
              isPlaying={isPlaying}
              onTogglePlay={onTogglePlay}
              onJumpSegment={onJumpSegment}
              onJumpTime={onJumpTime}
              currentTime={currentTime}
              duration={duration}
              onSeek={onSeek}
              playbackRate={playbackRate}
              onChangeRate={onChangeRate}
              isScriptLinked={false}
              onToggleScriptLink={() => {}}
              isEditable={isEditing}
              autoScrollSubs={autoScrollSubs}
              onToggleAutoScrollSubs={() => setAutoScrollSubs(!autoScrollSubs)}
              subtitleOverlayShow={subsOverlayConfig.show}
              onToggleSubtitleOverlay={() => setSubsOverlayConfig(c => ({ ...c, show: !c.show }))}
            />
          </div>
        </div>

      </div>

      {/* ── WAVEFORM inferior: alçada fixa 150px, amplada completa ───────────── */}
      <div className="flex-shrink-0 w-full" style={{ height: '150px' }}>
        <WaveformTimeline
          videoFile={videoFile}
          mediaDocId={mediaDocId}
          segments={segments}
          currentTime={currentTime}
          duration={duration}
          onSeek={onSeek}
          isPlaying={isPlaying}
          videoRef={videoRef}
          activeId={activeSegmentId}
          onSegmentUpdate={handleSegmentUpdate}
          onSegmentUpdateEnd={handleSegmentUpdateEnd}
          onSegmentClick={handleSegmentClick}
          onSetCueStart={handleCueStart}
          onSetCueEnd={handleCueEnd}
          onSetCueStartKeepDuration={handleCueStartKeepDuration}
          onRippleFromCue={handleRippleFromCue}
          onCreateSegment={handleCreateSegment}
          autoScroll={autoScrollWave}
          scrollMode={effectiveScrollMode}
          onUndo={() => subsHistory.undo()}
          onRedo={() => subsHistory.redo()}
          canUndo={subsHistory.canUndo}
          canRedo={subsHistory.canRedo}
          autoScrollWave={autoScrollWave}
          onToggleAutoScrollWave={() => setAutoScrollWave(!autoScrollWave)}
          scrollModeWave={effectiveScrollMode}
          onScrollModeChangeWave={setScrollModeWave}
          scrollModeLocked={waveViewMode === 'page'}
          autosaveEnabled={autosave}
          onToggleAutosave={() => setAutosave(!autosave)}
          onSave={handleSave}
          onExportSrt={() => {}}
          minGapMs={generalConfig.minGapMs}
          minDurationMs={generalConfig.minDurationMs}
        />
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {isSyncModalOpen && (
        <SyncLibraryModal
          isOpen={isSyncModalOpen}
          onClose={() => setIsSyncModalOpen(false)}
          onSyncMedia={handleSyncMedia}
          onSyncSubtitles={(doc) => {
            const parsed = parseSrt((doc.contentByLang['_unassigned'] as string) || (Object.values(doc.contentByLang)[0] as string) || '');
            subsHistory.commit(parsed);
          }}
        />
      )}

      {isAIModalOpen && (
        <SubtitleAIOperationsModal
          isOpen={isAIModalOpen}
          onClose={() => setIsAIModalOpen(false)}
          mode={aiMode}
          isProcessing={isAIProcessing}
          onWhisper={handleWhisperTranscription}
          onTranslate={handleAITranslation}
          onRevision={handleAIRevision}
        />
      )}
    </div>
  );
};

export const VideoSrtStandaloneEditorView: React.FC<VideoSrtStandaloneEditorViewProps> = (props) => (
  <SubtitleEditorProvider>
    <VideoSrtStandaloneEditorViewInner {...props} />
  </SubtitleEditorProvider>
);