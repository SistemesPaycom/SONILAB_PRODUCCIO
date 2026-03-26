import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Document, OverlayConfig, Id } from '../../types';
import * as Icons from '../icons';
import { VideoSubtitlesToolbar } from './VideoSubtitlesToolbar';
import { VideoPlaybackArea } from '../VideoEditor/VideoPlaybackArea';
import WaveformTimeline from '../VideoEditor/WaveformTimeline';
import SubtitlesEditor from './SubtitlesEditor';
import { useHorizontalPanelResize } from '../../hooks/usePanelResize';
import { Segment, GeneralConfig } from '../../types/Subtitles';
import { parseSrt, serializeSrt } from '../../utils/SubtitlesEditor/srtParser';
import SyncLibraryModal from './SyncLibraryModal';
import SubtitleAIOperationsModal from './SubtitleAIOperationsModal';
import { useLibrary } from '../../context/Library/LibraryContext';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import useLocalStorage from '../../hooks/useLocalStorage';
import { LOCAL_STORAGE_KEYS } from '../../constants';
import { useDocumentHistory } from '../../hooks/useDocumentHistory';
import { api } from '../../services/api';
import { SubtitleEditorProvider, useSubtitleEditor } from '../../contexts/SubtitleEditorContext';
import { useSubtitleAIOperations } from '../../hooks/useSubtitleAIOperations';

interface VideoSrtStandaloneEditorViewProps {
  currentDoc: Document;
  isEditing: boolean;
  onClose: () => void;
}

const VideoSrtStandaloneEditorViewInner: React.FC<VideoSrtStandaloneEditorViewProps> = ({ currentDoc, isEditing, onClose }) => {
  const { splitPayloadRef } = useSubtitleEditor();
  const { state, dispatch, useBackend, getMediaFile, ensureMediaFile } = useLibrary();

  const [maxLinesSubs] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.MAX_LINES_SUBS, 2);
  const [autosave, setAutosave] = useLocalStorage<boolean>(LOCAL_STORAGE_KEYS.AUTOSAVE_SRT, false);

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

  const generalConfig = useMemo<GeneralConfig>(() => ({
    maxCharsPerLine: 40,
    maxLinesPerSubtitle: maxLinesSubs,
    minGapMs: editorMinGapMs,
  }), [maxLinesSubs, editorMinGapMs]);

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
      videoFile,
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
  const onPause = useCallback(() => setIsPlaying(false), []);
  const onSeek = useCallback((time: number) => {
    if (videoRef.current) videoRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

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

  const handleSplitSegmentAtCursor = useCallback(() => {
    const payload = splitPayloadRef.current;
    if (!payload) return;

    const idx = segments.findIndex(s => s.id === payload.id);
    if (idx === -1) return;

    const target = segments[idx];
    const splitPoint = target.startTime + ((target.endTime - target.startTime) * payload.splitRatio);

    const newSeg1 = { ...target, endTime: splitPoint, originalText: payload.leftText, richText: payload.leftText };
    const newSeg2 = {
      id: Date.now(),
      startTime: splitPoint + 0.001,
      endTime: target.endTime,
      originalText: payload.rightText,
      richText: payload.rightText,
    };

    const newSegments = [...segments];
    newSegments.splice(idx, 1, newSeg1, newSeg2);
    splitPayloadRef.current = null;
    subsHistory.commit(newSegments.map((s, i) => ({ ...s, id: i + 1 })));
  }, [segments, subsHistory]);

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
      void api.updateSrt(currentDoc.id, srtText)
        .then(() => {
          lastAutosaved.current = srtText;
          dispatch({ type: 'UPDATE_DOCUMENT_CONTENTS', payload: { documentId: currentDoc.id, lang: '_unassigned', content: srtText, csvContent: '' } });
        })
        .catch(() => {});
    }, 300);

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [autosave, useBackend, isEditing, subsHistory.historyState.present, currentDoc.id, dispatch]);

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
      case 'MERGE_SEGMENT': handleMergeSegmentWithNext(); break;
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
    void (async () => {
      let file = getMediaFile(doc.id);
      if (!file) file = await ensureMediaFile(doc.id, doc.name);

      if (file) {
        if (videoSrc) URL.revokeObjectURL(videoSrc);
        setVideoFile(file);
        setMediaDocId(doc.id);
        setVideoSrc(URL.createObjectURL(file));
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
      }
    })().catch(e => console.error('handleSyncMedia failed', e));
  }, [getMediaFile, ensureMediaFile, videoSrc]);

  // ✅ Auto-cargar vídeo si el SRT pertenece a un proyecto
  useEffect(() => {
    if (!useBackend) return;
    let cancelled = false;

    void (async () => {
      try {
        const proj = await api.getProjectBySrt(currentDoc.id);
        const mediaId = proj?.mediaDocumentId;
        if (!mediaId || cancelled) return;

        const mediaDoc = state.documents.find(d => d.id === mediaId);
        if (mediaDoc) handleSyncMedia(mediaDoc);
      } catch {
        // No vinculado -> queda manual
      }
    })();

    return () => { cancelled = true; };
  }, [useBackend, currentDoc.id, state.documents, handleSyncMedia]);

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
      if (endTime - startTime < 0.1) endTime = startTime + 0.1;
      return prev.map(s => s.id === updated.id ? { ...updated, startTime, endTime } : s);
    });
  };
const segIndexRef = useRef<Map<Id, number>>(new Map());

useEffect(() => {
  const m = new Map<Id, number>();
  segments.forEach((s, i) => m.set(s.id, i));
  segIndexRef.current = m;
}, [segments]);

 const handleSegmentUpdate = (id: Id, newStart: number, newEnd: number) => {
  if (!isEditing) return;

  subsHistory.updateDraft((prev) => {
    const idx = segIndexRef.current.get(id);
    if (idx === undefined) return prev;

    const next = prev.slice();
    const cur = next[idx];
    next[idx] = { ...cur, startTime: newStart, endTime: newEnd };
    return next;
  });
};

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
    videoFile, mediaDocId, onSegmentUpdate: handleSegmentUpdate, onSegmentClick: handleSegmentClick, autoScroll: autoScrollWave, scrollMode: scrollModeWave,
  };

  return (
    <div className="flex flex-col h-full w-full text-gray-200" style={{ backgroundColor: 'var(--th-bg-app)' }}>
      {/* Header */}
      <header className="h-14 flex items-center px-4 justify-between flex-shrink-0" style={{ backgroundColor: 'var(--th-bg-secondary)', borderBottom: '1px solid var(--th-border)' }}>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg text-gray-400">
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
          />
        </div>

        {/* Divisor esquerra | dreta */}
        <div
          className="w-1.5 hover:bg-gray-500/50 cursor-col-resize flex-shrink-0 transition-colors" style={{ backgroundColor: 'var(--th-divider)' }}
          onMouseDown={handleMainSplitMouseDown}
        />

        {/* ── PANELL DRET: Vídeo (flex-grow) + Toolbar (fix) ───────────────── */}
        <div className="flex flex-col flex-grow min-h-0 overflow-hidden">
          <div className="flex-grow min-h-0 bg-black overflow-hidden">
            <VideoPlaybackArea {...playerProps} />
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
              autoScrollWave={autoScrollWave}
              onToggleAutoScrollWave={() => setAutoScrollWave(!autoScrollWave)}
              scrollModeWave={scrollModeWave}
              onScrollModeChangeWave={setScrollModeWave}
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
          onSegmentUpdateEnd={() => subsHistory.commit()}
          onSegmentClick={handleSegmentClick}
          autoScroll={autoScrollWave}
          scrollMode={scrollModeWave}
          onUndo={() => subsHistory.undo()}
          onRedo={() => subsHistory.redo()}
          canUndo={subsHistory.canUndo}
          canRedo={subsHistory.canRedo}
          autoScrollWave={autoScrollWave}
          onToggleAutoScrollWave={() => setAutoScrollWave(!autoScrollWave)}
          scrollModeWave={scrollModeWave}
          onScrollModeChangeWave={setScrollModeWave}
          autosaveEnabled={autosave}
          onToggleAutosave={() => setAutosave(!autosave)}
          onSave={handleSave}
          onExportSrt={() => {}}
          minGapMs={generalConfig.minGapMs}
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