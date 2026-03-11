import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Layout, Document, EditorStyles, OverlayConfig, Id } from '../../types';
import Editor from '../EditorDeGuions/Editor';
import { ColumnView } from '../EditorDeGuions/ColumnView';
import { CsvView } from '../EditorDeGuions/CsvView';
import { VideoSubtitlesToolbar } from './VideoSubtitlesToolbar';
import { VideoPlaybackArea } from '../VideoEditor/VideoPlaybackArea';
import SubtitlesEditor from './SubtitlesEditor';
import SyncLibraryModal from './SyncLibraryModal';
import SubtitleAIOperationsModal from './SubtitleAIOperationsModal';
import { useLibrary } from '../../context/Library/LibraryContext';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useDocumentHistory } from '../../hooks/useDocumentHistory';
import useLocalStorage from '../../hooks/useLocalStorage';
import { LOCAL_STORAGE_KEYS } from '../../constants';
import { useVerticalPanelResize, useHorizontalPanelResize } from '../../hooks/usePanelResize';
import { SubtitleEditorProvider, useSubtitleEditor } from '../../contexts/SubtitleEditorContext';
import { useSubtitleAIOperations } from '../../hooks/useSubtitleAIOperations';
import { ScriptViewPanel } from './ScriptViewPanel';
import TranscriptCorrectionModal, { ChangeRecord as CorrectionChangeRecord } from './TranscriptCorrectionModal';

import { Segment, GeneralConfig } from '../../types/Subtitles';
import { parseSrt, serializeSrt } from '../../utils/SubtitlesEditor/srtParser';

import { api } from '../../services/api';
import { buildTakeRangesFromScript } from '../../utils/EditorDeGuions/takeRanges';
import { linkSegmentsToTakeRanges } from '../../utils/SubtitlesEditor/segmentTakeLinker';
import { buildTakeDialogMap, applyGuionDiff } from '../../utils/SubtitlesEditor/segmentGuionDiff';

type EditorView = 'script' | 'csv';

interface VideoSubtitlesEditorViewProps {
  currentDoc: Document;
  isEditing: boolean;
  layout: Layout;
  tabSize: number;
  col1Width: number;
  pageWidth: string;
  editorStyles: EditorStyles;
  editorView: EditorView;
  activeLang: string;
  onLayoutChange: (value: Layout) => void;
  onTabSizeChange: (value: number) => void;
  onPageWidthChange: (value: string) => void;
  onEditorViewChange: (value: EditorView) => void;
  onActiveLangChange: (lang: string) => void;
  onSetSourceLang: (lang: string) => void;
  onTranslate: (fromLang: string, toLang: string, taskId: string) => Promise<void>;
  handleTextChange: (newText: string, sourceView: 'script' | 'csv' | 'mono') => void;
  handleEditorBackgroundClick: (e: React.MouseEvent<HTMLElement>) => void;
}

const MIN_PANEL_HEIGHT = 100;

const VideoSubtitlesEditorViewInner: React.FC<VideoSubtitlesEditorViewProps> = (props) => {
  const {
    currentDoc,
    isEditing,
    layout,
    tabSize,
    col1Width,
    pageWidth,
    editorStyles,
    editorView,
    activeLang,
    handleTextChange,
  } = props;

  const { splitPayloadRef } = useSubtitleEditor();
  const { state, getMediaFile, ensureMediaFile, dispatch, useBackend } = useLibrary();
  const { syncRequest } = state;
  const [takeMargin] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.TAKE_MARGIN, 2);
  const [takeStartMargin] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.TAKE_START_MARGIN, 2);
  const [maxLinesSubs] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.MAX_LINES_SUBS, 2);

  const currentContent = currentDoc?.contentByLang?.[activeLang] || '';
  const currentCsvContent = currentDoc?.csvContentByLang?.[activeLang] || '';

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
const [autosave, setAutosave] = useLocalStorage<boolean>(LOCAL_STORAGE_KEYS.AUTOSAVE_SRT, false);
const autosaveTimer = useRef<any>(null);
const lastSavedRef = useRef<string>(currentDoc.contentByLang['_unassigned'] || '');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiMode, setAiMode] = useState<'whisper' | 'translate' | 'revision'>('whisper');

  const [autoScrollSubs, setAutoScrollSubs] = useState(true);
  const [autoScrollWave, setAutoScrollWave] = useState(true);
  const [scrollModeWave, setScrollModeWave] = useState<'stationary' | 'page'>('stationary');

  const [isScriptLinked, setIsScriptLinked] = useState(true);
  const scriptScrollRef = useRef<HTMLElement>(null);
  const takeLayoutRef = useRef<Map<number, number>>(new Map());
  const activeTakeByTimeRef = useRef<number | null>(null);

  // ── Guió vinculat al projecte ─────────────────────────────────────────────
  const [guionContent, setGuionContent] = useState<string>('');
  const [guionProjectId, setGuionProjectId] = useState<string | null>(null);

  // ── Correcció de transcripció amb guió ───────────────────────────────────
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [correctionHighlightIds, setCorrectionHighlightIds] = useState<Set<number>>(new Set());

  /** Clau localStorage per al guió d'aquest document (persistència local sense backend) */
  const _localGuionKey = `sonilab_guion_${currentDoc?.id}`;

  /** Desa el guió a localStorage quan no hi ha projecte (per persistir entre sessions) */
  const handleGuionLoaded = useCallback((text: string) => {
    setGuionContent(text);
    // Si no hi ha projecte de backend, persistim localment
    if (!guionProjectId && currentDoc?.id) {
      if (text) {
        localStorage.setItem(_localGuionKey, text);
      } else {
        localStorage.removeItem(_localGuionKey);
      }
    }
  }, [guionProjectId, currentDoc?.id, _localGuionKey]);

  const [subsOverlayConfig, setSubsOverlayConfig] = useState<OverlayConfig>({
    show: true,
    position: 'bottom',
    offsetPx: 10,
    fontScale: 1,
  });

  const generalConfig = useMemo<GeneralConfig>(() => ({
    maxCharsPerLine: 40,
    maxLinesPerSubtitle: maxLinesSubs,
  }), [maxLinesSubs]);

  const [syncSubsEnabled, setSyncSubsEnabled] = useState(true);

  const initialSegments = useMemo(() => {
    const srtText = currentDoc.contentByLang['_unassigned'] || Object.values(currentDoc.contentByLang)[0] || '';
    return parseSrt(srtText);
  }, [currentDoc.id]);

  const subsHistory = useDocumentHistory<Segment[]>(currentDoc.id, initialSegments);
  const segments = subsHistory.present;
  const [activeSegmentId, setActiveSegmentId] = useState<number | null>(null);

  /**
   * Aplica la correcció de transcripció: actualitza els segments en memòria
   * i marca els segments modificats per resaltar-los.
   * (Definit DESPRÉS de subsHistory per evitar Temporal Dead Zone)
   */
  const handleApplyCorrection = useCallback((correctedSrt: string, changes: CorrectionChangeRecord[]) => {
    const correctedSegs = parseSrt(correctedSrt);
    if (correctedSegs.length > 0) {
      subsHistory.commit(correctedSegs);
    }
    const changedIds = new Set<number>(changes.map(c => c.seg_idx));
    setCorrectionHighlightIds(changedIds);
    setTimeout(() => setCorrectionHighlightIds(new Set()), 30_000);
  }, [subsHistory]);

  const { isAIProcessing, handleWhisperTranscription, handleAITranslation, handleAIRevision } =
    useSubtitleAIOperations({
      videoFile,
      segments,
      onCommitSegments: (newSegs) => subsHistory.commit(newSegs),
      onCloseModal: () => setIsAIModalOpen(false),
    });

const handleSyncMedia = useCallback((doc: Document) => {
  void (async () => {
    let file = getMediaFile(doc.id);

    if (!file) {
      try {
        file = await ensureMediaFile(doc.id, doc.name);
      } catch (e) {
        console.error('ensureMediaFile failed', e);
        return;
      }
    }

    if (file) {
      if (videoSrc) URL.revokeObjectURL(videoSrc);
      setVideoFile(file);
      setVideoSrc(URL.createObjectURL(file));
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  })();
}, [getMediaFile, ensureMediaFile, videoSrc]);

  const handleSyncSubtitles = useCallback((doc: Document) => {
    const srtText = doc.contentByLang['_unassigned'] || Object.values(doc.contentByLang)[0] || '';
    if (srtText) {
      const parsed = parseSrt(srtText);
      subsHistory.commit(parsed);
      setActiveSegmentId(parsed.length > 0 ? (parsed[0].id as number) : null);
    }
  }, [subsHistory]);

  useEffect(() => {
      if (!syncRequest) return;
      const doc = state.documents.find(d => d.id === syncRequest.docId);
      if (!doc) return;

      if (syncRequest.type === 'media') {
          handleSyncMedia(doc);
      } else if (syncRequest.type === 'subtitles') {
          handleSyncSubtitles(doc);
      }
      dispatch({ type: 'CLEAR_SYNC_REQUEST' });
  }, [syncRequest, dispatch, state.documents, handleSyncMedia, handleSyncSubtitles]);

  // ── Carrega el guió vinculat al projecte (si n'hi ha) ─────────────────────
  useEffect(() => {
    if (!currentDoc?.id) return;
    let cancelled = false;

    void (async () => {
      try {
        if (useBackend) {
          // 1. Obtenim el projecte a partir del document SRT
          const project = await api.getProjectBySrt(currentDoc.id).catch(() => null);
          if (cancelled) return;

          if (project?.id) {
            setGuionProjectId(project.id);

            // 2. Si el projecte té guió, el carregem des del backend
            if (project.guionDocumentId) {
              const { text } = await api.getProjectGuion(project.id).catch(() => ({ text: null, guionDocumentId: null }));
              if (!cancelled && text) {
                setGuionContent(text);
                return; // ← backend ha carregat el guió, no cal localStorage
              }
            }
          }
        }

        // 3. Fallback: guió desat localment al navegador
        if (!cancelled) {
          const localGuion = localStorage.getItem(`sonilab_guion_${currentDoc.id}`);
          if (localGuion) {
            setGuionContent(localGuion);
          }
        }
      } catch {
        // Silenciar errors (doc no és SRT d'un projecte)
        // Intentar localStorage com a fallback final
        if (!cancelled) {
          const localGuion = localStorage.getItem(`sonilab_guion_${currentDoc.id}`);
          if (localGuion) setGuionContent(localGuion);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [currentDoc?.id, useBackend]);
useEffect(() => {
  if (!autosave || !useBackend || !isEditing) return;

  const srt = serializeSrt(subsHistory.present);
  if (srt === lastSavedRef.current) return;

  if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
  autosaveTimer.current = setTimeout(() => {
    void api.updateSrt(currentDoc.id, srt).then(() => {
      lastSavedRef.current = srt;
      dispatch({ type: 'UPDATE_DOCUMENT_CONTENTS', payload: { documentId: currentDoc.id, lang: '_unassigned', content: srt, csvContent: '' }});
    }).catch(()=>{});
  }, 1500);

  return () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
  };
}, [autosave, useBackend, isEditing, subsHistory.present, currentDoc.id, dispatch]);
  // ── Guió efectiu: el guió vinculat al projecte té prioritat sobre el contingut del doc SRT ──
  const effectiveGuionContent = guionContent || currentContent;

  const takeRanges = useMemo(() => {
    // IMPORTANT: usar el guió (effectiveGuionContent) i NO el SRT (currentContent),
    // ja que els marcadors TAKE i timecodes estan al guió, no al SRT.
    return buildTakeRangesFromScript({
      content: effectiveGuionContent || '',
      takeStartMarginSeconds: takeStartMargin,
      takeEndMarginSeconds: takeMargin,
      durationSeconds: duration,
    });
  }, [effectiveGuionContent, duration, takeMargin, takeStartMargin]);

  const linkedSegments = useMemo(() => {
    return linkSegmentsToTakeRanges(segments, takeRanges);
  }, [segments, takeRanges]);

  const takeDialogMap = useMemo(
    () => buildTakeDialogMap(effectiveGuionContent),
    [effectiveGuionContent],
  );

  const linkedSegmentsWithDiff = useMemo(
    () => applyGuionDiff(linkedSegments, takeDialogMap),
    [linkedSegments, takeDialogMap],
  );

  const handleTakeLayout = useCallback((num: number, y: number) => {
    takeLayoutRef.current.set(num, y);
  }, []);

  useEffect(() => {
    if (!isScriptLinked || takeRanges.length === 0) {
      activeTakeByTimeRef.current = null;
      return;
    }
    if (activeTakeByTimeRef.current !== null) {
      const current = takeRanges.find(r => r.takeNum === activeTakeByTimeRef.current);
      if (current && currentTime >= current.start && currentTime < current.end) return; 
    }
    const containing = takeRanges.filter(r => currentTime >= r.start && currentTime < r.end);
    if (containing.length === 0) {
      activeTakeByTimeRef.current = null;
      return;
    }
    const nextActive = [...containing].sort((a, b) => a.takeNum - b.takeNum)[0];
    if (nextActive.takeNum !== activeTakeByTimeRef.current) {
      const yPos = takeLayoutRef.current.get(nextActive.takeNum);
      if (yPos !== undefined && scriptScrollRef.current) {
        scriptScrollRef.current.scrollTo({ top: yPos, behavior: 'smooth' });
        activeTakeByTimeRef.current = nextActive.takeNum;
      }
    }
  }, [currentTime, isScriptLinked, takeRanges]);

  const onTogglePlay = useCallback(() => setIsPlaying((p) => !p), []);
  const onSeek = useCallback((time: number) => {
    if (videoRef.current) videoRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);
  const onJumpTime = useCallback((seconds: number) => onSeek(Math.max(0, Math.min(duration, currentTime + seconds))), [currentTime, duration, onSeek]);
  const onChangeRate = (delta: number) => setPlaybackRate((rate) => {
    const newRate = Math.max(0.5, Math.min(2.0, parseFloat((rate + delta).toFixed(2))));
    if (videoRef.current) videoRef.current.playbackRate = newRate;
    return newRate;
  });

  const handleSegmentClick = useCallback((id: Id) => {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    setActiveSegmentId(numericId);
    const segment = linkedSegmentsWithDiff.find((s) => s.id === numericId);
    // Sync vídeo
    if (syncSubsEnabled && videoRef.current && segment) {
      onSeek(Math.max(0, segment.startTime - 0.05));
    }
    // Sync guió: scroll immediat al TAKE vinculat (independentment del vídeo)
    if (isScriptLinked && segment?.primaryTakeNum !== undefined) {
      const yPos = takeLayoutRef.current.get(segment.primaryTakeNum);
      if (yPos !== undefined && scriptScrollRef.current) {
        scriptScrollRef.current.scrollTo({ top: yPos, behavior: 'smooth' });
        activeTakeByTimeRef.current = segment.primaryTakeNum;
      }
    }
  }, [linkedSegmentsWithDiff, syncSubsEnabled, onSeek, isScriptLinked]);

  const onJumpSegment = useCallback((direction: 'prev' | 'next') => {
    if (takeRanges.length === 0) return;
    const starts: number[] = Array.from<number>(new Set(takeRanges.map((r) => r.start))).sort((a, b) => a - b);
    if (direction === 'next') {
      const next = starts.find((t) => t > currentTime + 0.1);
      if (next !== undefined) onSeek(next);
    } else {
      const prevs = starts.filter((t) => t < currentTime - 0.5);
      if (prevs.length > 0) onSeek(prevs[prevs.length - 1]);
      else onSeek(starts[0]);
    }
  }, [takeRanges, currentTime, onSeek]);

const handleSave = useCallback(() => {
  subsHistory.save((data) => {
    const srtContent = serializeSrt(data);

    // 1) estado local (para UI)
    dispatch({
      type: 'UPDATE_DOCUMENT_CONTENTS',
      payload: { documentId: currentDoc.id, lang: '_unassigned', content: srtContent, csvContent: '' },
    });

    // 2) ✅ persistencia backend (lo que te faltaba)
    if (useBackend) {
      void api.updateSrt(currentDoc.id, srtContent).catch((e) => {
        console.error('updateSrt failed', e);
      });
    }
  });
}, [subsHistory, currentDoc.id, dispatch, useBackend]);

  const handleSplitSegmentAtCursor = useCallback((idParam?: number) => {
    const payload = splitPayloadRef.current;
    if (payload) {
        const idx = segments.findIndex(s => s.id === payload.id);
        if (idx === -1) return;

        const target = segments[idx];
        const totalDuration = target.endTime - target.startTime;
        const splitPoint = target.startTime + (totalDuration * payload.splitRatio);

        const newSeg1 = { ...target, endTime: splitPoint, originalText: payload.leftText, richText: payload.leftText };
        const newSeg2 = { id: Date.now(), startTime: splitPoint + 0.001, endTime: target.endTime, originalText: payload.rightText, richText: payload.rightText };

        const newSegments = [...segments];
        newSegments.splice(idx, 1, newSeg1, newSeg2);

        splitPayloadRef.current = null;
        subsHistory.commit(newSegments.map((s, i) => ({ ...s, id: i + 1 })));
        return;
    }

    const targetId = idParam || activeSegmentId;
    if (!targetId || !isEditing) return;

    const idx = segments.findIndex(s => s.id === targetId);
    if (idx === -1) return;

    const target = segments[idx];
    const half = target.startTime + (target.endTime - target.startTime) / 2;
    const txt = target.originalText;
    const mid = Math.floor(txt.length / 2);

    const newSeg1 = { ...target, endTime: half, originalText: txt.substring(0, mid).trim() };
    const newSeg2 = { id: Date.now(), startTime: half + 0.001, endTime: target.endTime, originalText: txt.substring(mid).trim() };

    const newSegments = [...segments];
    newSegments.splice(idx, 1, newSeg1, newSeg2);
    subsHistory.commit(newSegments.map((s, i) => ({ ...s, id: i + 1 })));
  }, [activeSegmentId, segments, isEditing, subsHistory]);

  const handleInsertSegment = useCallback((id: number, position: 'before' | 'after') => {
    if (!isEditing) return;
    const idx = segments.findIndex(s => s.id === id);
    if (idx === -1) return;

    const target = segments[idx];
    let newSeg: Segment;

    if (position === 'after') {
      const next = segments[idx + 1];
      const start = target.endTime + 0.1;
      const end = next ? Math.min(next.startTime - 0.1, start + 2) : start + 2;
      newSeg = { id: Date.now(), startTime: start, endTime: Math.max(end, start + 0.5), originalText: '' };
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
  }, [isEditing, segments, subsHistory]);

  const handleDeleteSegment = useCallback((id: number) => {
    if (!isEditing || segments.length <= 1) return;
    const newSegments = segments.filter(s => s.id !== id);
    subsHistory.commit(newSegments.map((s, i) => ({ ...s, id: i + 1 })));
  }, [isEditing, segments, subsHistory]);

  const handleMergeSegmentWithNext = useCallback(() => {
    if (!activeSegmentId || !isEditing) return;
    const idx = segments.findIndex(s => s.id === activeSegmentId);
    if (idx === -1 || idx === segments.length - 1) return;

    const current = segments[idx];
    const next = segments[idx + 1];
    
    const mergedText = (current.originalText + '\n' + next.originalText).trim();
    const merged = { 
        ...current, 
        endTime: next.endTime, 
        originalText: mergedText,
        richText: mergedText
    };

    const newSegments = [...segments];
    newSegments.splice(idx, 2, merged);
    subsHistory.commit(newSegments.map((s, i) => ({ ...s, id: i + 1 })));
  }, [activeSegmentId, segments, isEditing, subsHistory]);

  useKeyboardShortcuts('subtitlesEditor', (action) => {
    switch (action) {
      case 'TOGGLE_PLAY_PAUSE': onTogglePlay(); break;
      case 'REWIND_5S': onJumpTime(-5); break;
      case 'FORWARD_5S': onJumpTime(5); break;
      case 'DECREASE_PLAYBACK_RATE': onChangeRate(-0.1); break;
      case 'INCREASE_PLAYBACK_RATE': onChangeRate(0.1); break;
      case 'JUMP_NEXT_SEGMENT': case 'NAVIGATE_SEGMENT_DOWN': onJumpSegment('next'); break;
      case 'JUMP_PREV_SEGMENT': case 'NAVIGATE_SEGMENT_UP': onJumpSegment('prev'); break;
      case 'UNDO': subsHistory.undo(); break;
      case 'REDO': subsHistory.redo(); break;
      case 'SAVE': handleSave(); break;
      case 'SPLIT_SEGMENT': handleSplitSegmentAtCursor(); break;
      case 'MERGE_SEGMENT': handleMergeSegmentWithNext(); break;
    }
  });

  const handleSegmentChange = (updated: Segment) => {
    if (!isEditing) return;
    subsHistory.updateDraft(prev => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleSegmentBlur = () => {
    if (!isEditing) return;
    subsHistory.commit();
  };

  const handleSegmentUpdate = (id: Id, newStart: number, newEnd: number) => {
    if (!isEditing) return;
    subsHistory.updateDraft(prev => prev.map((seg) => (seg.id === id ? { ...seg, startTime: newStart, endTime: newEnd } : seg)));
  };

  const handleSegmentUpdateEnd = useCallback(() => {
    if (!isEditing) return;
    subsHistory.commit();
  }, [isEditing, subsHistory]);

  const handleExportSrt = () => {
    if (segments.length === 0) return;
    const srtContent = serializeSrt(segments);
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${currentDoc.name.replace(/\.slsf$/, '')}.srt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const verticalContainerRef = useRef<HTMLDivElement>(null);
  const bottomContainerRef = useRef<HTMLDivElement>(null);

  const { height: topPanelHeight, handleMouseDown: handleVerticalMouseDown } =
    useVerticalPanelResize(400, MIN_PANEL_HEIGHT);

  const { widthPercent: leftPanelWidth, handleMouseDown: handleHorizontalMouseDown } =
    useHorizontalPanelResize(bottomContainerRef as React.RefObject<HTMLElement>, 50, 20, 80);

  const activeSegmentForPlayer = useMemo(() => {
    const seg = linkedSegmentsWithDiff.find((s: Segment) => currentTime >= s.startTime && currentTime < s.endTime);
    return seg ? { id: seg.id, startTime: seg.startTime, endTime: seg.endTime, originalText: seg.originalText, translatedText: '' } : null;
  }, [linkedSegments, currentTime]);

  const playerProps = {
    isPlaying, currentTime, duration, onSeek, videoRef, src: videoSrc, segments: linkedSegmentsWithDiff, activeId: activeSegmentId,
    activeSegment: subsOverlayConfig.show ? activeSegmentForPlayer : null,
    overlayConfig: { original: subsOverlayConfig, translated: { show: false, position: 'bottom' as const, offsetPx: 10, fontScale: 1 } },
    onTimeUpdate: setCurrentTime, onDurationChange: setDuration, onPlay: () => setIsPlaying(true), onPause: () => setIsPlaying(false), onTogglePlay, onJumpSegment,
    videoFile, onSegmentUpdate: handleSegmentUpdate, onSegmentUpdateEnd: handleSegmentUpdateEnd, onSegmentClick: handleSegmentClick, autoScroll: autoScrollWave, scrollMode: scrollModeWave,
  };

  return (
    <div ref={verticalContainerRef} className="flex flex-col h-full w-full bg-[#111827] text-gray-200">
      <div className="bg-black flex-shrink-0" style={{ height: `${topPanelHeight}px` }}>
        <VideoPlaybackArea {...playerProps} />
      </div>
      <div className="h-1.5 bg-gray-900 hover:bg-blue-600/50 cursor-row-resize flex-shrink-0 transition-colors" onMouseDown={handleVerticalMouseDown} />
      <div className="flex-shrink-0 bg-[#1e293b] border-y border-gray-700/50">
        <VideoSubtitlesToolbar
          onOpenSync={() => setIsSyncModalOpen(true)} onExportSrt={handleExportSrt} isPlaying={isPlaying} onTogglePlay={onTogglePlay} onJumpSegment={onJumpSegment} onJumpTime={onJumpTime} currentTime={currentTime} duration={duration} onSeek={onSeek} playbackRate={playbackRate} onChangeRate={onChangeRate} isScriptLinked={isScriptLinked} onToggleScriptLink={() => setIsScriptLinked((p) => !p)} isEditable={isEditing} autoScrollWave={autoScrollWave} onToggleAutoScrollWave={() => setAutoScrollWave(!autoScrollWave)} scrollModeWave={scrollModeWave} onScrollModeChangeWave={setScrollModeWave} autoScrollSubs={autoScrollSubs} onToggleAutoScrollSubs={() => setAutoScrollSubs(!autoScrollSubs)}
          onUndo={() => subsHistory.undo()} onRedo={() => subsHistory.redo()} canUndo={subsHistory.canUndo} canRedo={subsHistory.canRedo} onSave={handleSave}
        />
      </div>
      <div ref={bottomContainerRef} className="flex-1 flex min-h-0 overflow-hidden">
        <ScriptViewPanel
          width={leftPanelWidth}
          content={effectiveGuionContent}
          csvContent={currentCsvContent}
          editorView={editorView}
          layout={layout}
          tabSize={tabSize}
          col1Width={col1Width}
          editorStyles={editorStyles}
          pageWidth={pageWidth}
          onTakeLayout={handleTakeLayout}
          scrollRef={scriptScrollRef}
          projectId={guionProjectId}
          docId={currentDoc?.id}
          onGuionLoaded={handleGuionLoaded}
          onOpenCorrection={guionProjectId ? () => setIsCorrectionModalOpen(true) : undefined}
        />
        <div className="w-1.5 bg-gray-900 hover:bg-blue-600/50 cursor-col-resize flex-shrink-0 transition-colors" onMouseDown={handleHorizontalMouseDown} />
        <div className="flex-grow h-full bg-[#111827] flex flex-col overflow-hidden">
           <SubtitlesEditor
            title="Subtítols SRT"
            segments={linkedSegmentsWithDiff}
            activeId={activeSegmentId}
            isEditable={isEditing}
            onSegmentChange={handleSegmentChange}
            onSegmentBlur={handleSegmentBlur}
            onSegmentClick={(id) => handleSegmentClick(id)}
            onSegmentFocus={(id) => isEditing && setActiveSegmentId(id)}
            syncEnabled={syncSubsEnabled}
            onSyncChange={setSyncSubsEnabled}
            overlayConfig={subsOverlayConfig}
            onOverlayConfigChange={setSubsOverlayConfig}
            generalConfig={generalConfig}
            autoScroll={autoScrollSubs}
            onOpenAIOperations={(m) => { setAiMode(m); setIsAIModalOpen(true); }}
            onSplit={handleSplitSegmentAtCursor}
            onMerge={handleMergeSegmentWithNext}
            onInsert={handleInsertSegment}
            onDelete={handleDeleteSegment}
            correctionHighlightIds={correctionHighlightIds.size > 0 ? correctionHighlightIds : undefined}
          />
        </div>
      </div>
      {isSyncModalOpen && <SyncLibraryModal isOpen={isSyncModalOpen} onClose={() => setIsSyncModalOpen(false)} onSyncMedia={handleSyncMedia} onSyncSubtitles={handleSyncSubtitles} />}
      {isAIModalOpen && <SubtitleAIOperationsModal isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} mode={aiMode} isProcessing={isAIProcessing} onWhisper={handleWhisperTranscription} onTranslate={handleAITranslation} onRevision={handleAIRevision} />}
      {isCorrectionModalOpen && guionProjectId && (
        <TranscriptCorrectionModal
          isOpen={isCorrectionModalOpen}
          onClose={() => setIsCorrectionModalOpen(false)}
          projectId={guionProjectId}
          onApply={handleApplyCorrection}
          hasGuion={Boolean(guionContent?.trim())}
        />
      )}
    </div>
  );
};

export const VideoSubtitlesEditorView: React.FC<VideoSubtitlesEditorViewProps> = (props) => (
  <SubtitleEditorProvider>
    <VideoSubtitlesEditorViewInner {...props} />
  </SubtitleEditorProvider>
);