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

import { Segment, GeneralConfig } from '../../types/Subtitles';
import { parseSrt, serializeSrt } from '../../utils/SubtitlesEditor/srtParser';

import { buildTakeRangesFromScript } from '../../utils/EditorDeGuions/takeRanges';
import { linkSegmentsToTakeRanges } from '../../utils/SubtitlesEditor/segmentTakeLinker';

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

export const VideoSubtitlesEditorView: React.FC<VideoSubtitlesEditorViewProps> = (props) => {
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

  const { state, getMediaFile, ensureMediaFile, dispatch } = useLibrary();
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

  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiMode, setAiMode] = useState<'whisper' | 'translate' | 'revision'>('whisper');
  const [isAIProcessing, setIsAIProcessing] = useState(false);

  const [autoScrollSubs, setAutoScrollSubs] = useState(true);
  const [autoScrollWave, setAutoScrollWave] = useState(true);
  const [scrollModeWave, setScrollModeWave] = useState<'stationary' | 'page'>('stationary');

  const [isScriptLinked, setIsScriptLinked] = useState(true);
  const scriptScrollRef = useRef<HTMLElement>(null);
  const takeLayoutRef = useRef<Map<number, number>>(new Map());
  const activeTakeByTimeRef = useRef<number | null>(null);

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

  const takeRanges = useMemo(() => {
    return buildTakeRangesFromScript({
      content: currentContent || '',
      takeStartMarginSeconds: takeStartMargin,
      takeEndMarginSeconds: takeMargin,
      durationSeconds: duration,
    });
  }, [currentContent, duration, takeMargin, takeStartMargin]);

  const linkedSegments = useMemo(() => {
    return linkSegmentsToTakeRanges(segments, takeRanges);
  }, [segments, takeRanges]);

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
    if (syncSubsEnabled && videoRef.current) {
      const segment = linkedSegments.find((s) => s.id === numericId);
      if (segment) onSeek(segment.startTime);
    }
  }, [linkedSegments, syncSubsEnabled, onSeek]);

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
        dispatch({
            type: 'UPDATE_DOCUMENT_CONTENTS',
            payload: { documentId: currentDoc.id, lang: '_unassigned', content: srtContent, csvContent: '' }
        });
    });
  }, [subsHistory, currentDoc.id, dispatch]);

  const handleSplitSegmentAtCursor = useCallback((idParam?: number) => {
    const payload = window.__SEG_SPLIT_PAYLOAD__;
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
        
        window.__SEG_SPLIT_PAYLOAD__ = null;
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

  const handleWhisperTranscription = async (lang: string) => {
    if (!videoFile) { alert("Vinculeu un vídeo primer."); return; }
    setIsAIProcessing(true);
    try { await new Promise(r => setTimeout(r, 2000)); setIsAIModalOpen(false); } 
    finally { setIsAIProcessing(false); }
  };

  const handleAITranslation = async (from: string, to: string) => {
    if (segments.length === 0) return;
    setIsAIProcessing(true);
    try { await new Promise(r => setTimeout(r, 2000)); setIsAIModalOpen(false); } 
    finally { setIsAIProcessing(false); }
  };

  const handleAIRevision = async () => {
    if (segments.length === 0) return;
    setIsAIProcessing(true);
    try {
        await new Promise(r => setTimeout(r, 1500));
        const newSegments = segments.map((s, idx) => idx === 2 ? { ...s, hasDiff: true } : s);
        subsHistory.commit(newSegments);
        alert("Revisió IA finalitzada.");
        setIsAIModalOpen(false);
    } finally { setIsAIProcessing(false); }
  };

  const handleExportSrt = () => {
    if (segments.length === 0) return;
    const srtContent = serializeSrt(segments);
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${currentDoc.name.replace(/\.slsf$/, '')}.srt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const [topPanelHeight, setTopPanelHeight] = useState(400);
  const verticalContainerRef = useRef<HTMLDivElement>(null);
  const isVerticalResizingRef = useRef(false);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50);
  const bottomContainerRef = useRef<HTMLDivElement>(null);
  const isHorizontalResizingRef = useRef(false);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  const handleVerticalMouseMove = useCallback((e: MouseEvent) => {
    if (!isVerticalResizingRef.current || !verticalContainerRef.current) return;
    const deltaY = e.clientY - startYRef.current;
    setTopPanelHeight(Math.max(MIN_PANEL_HEIGHT, startHeightRef.current + deltaY));
  }, []);

  const handleHorizontalMouseMove = useCallback((e: MouseEvent) => {
    if (!isHorizontalResizingRef.current || !bottomContainerRef.current) return;
    const deltaX = e.clientX - startXRef.current;
    const containerWidth = bottomContainerRef.current.offsetWidth;
    const newWidth = ((startWidthRef.current + deltaX) / containerWidth) * 100;
    setLeftPanelWidth(Math.max(20, Math.min(80, newWidth)));
  }, []);

  const handleMouseUp = useCallback(() => {
    isVerticalResizingRef.current = false;
    isHorizontalResizingRef.current = false;
    document.body.style.cursor = '';
    window.removeEventListener('mousemove', handleVerticalMouseMove);
    window.removeEventListener('mousemove', handleHorizontalMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleVerticalMouseMove, handleHorizontalMouseMove]);

  const handleVerticalMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isVerticalResizingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = topPanelHeight;
    document.body.style.cursor = 'row-resize';
    window.addEventListener('mousemove', handleVerticalMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [topPanelHeight, handleVerticalMouseMove, handleMouseUp]);

  const handleHorizontalMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!bottomContainerRef.current) return;
    isHorizontalResizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = (bottomContainerRef.current.children[0] as HTMLElement).clientWidth;
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', handleHorizontalMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [handleHorizontalMouseMove, handleMouseUp]);

  const activeSegmentForPlayer = useMemo(() => {
    const seg = linkedSegments.find((s: Segment) => currentTime >= s.startTime && currentTime < s.endTime);
    return seg ? { id: seg.id, startTime: seg.startTime, endTime: seg.endTime, originalText: seg.originalText, translatedText: '' } : null;
  }, [linkedSegments, currentTime]);

  const playerProps = {
    isPlaying, currentTime, duration, onSeek, videoRef, src: videoSrc, segments: linkedSegments, activeId: activeSegmentId,
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
          onUndo={() => subsHistory.undo()} onRedo={() => subsHistory.redo()} canUndo={subsHistory.canUndo} canRedo={subsHistory.canRedo}
        />
      </div>
      <div ref={bottomContainerRef} className="flex-1 flex min-h-0 overflow-hidden">
        <div style={{ width: `${leftPanelWidth}%` }} className="flex flex-col min-w-0 h-full border-r border-gray-950">
          <header className="flex-shrink-0 h-11 border-b border-gray-700 bg-gray-800/80 flex items-center px-4">
            <h3 className="font-black text-[10px] uppercase tracking-widest text-gray-500">Guió Original</h3>
          </header>
          <main ref={scriptScrollRef} data-script-scroll-container="true" className="flex-grow overflow-y-auto flex flex-col items-center min-h-0 bg-[#111827] px-4 pb-12 pt-0 custom-scrollbar">
            <div id="page-content-area-subs" className="relative page-a4 bg-white text-gray-900 shadow-2xl rounded-sm p-10 transition-all duration-300 pointer-events-none select-none" style={{ width: pageWidth, maxWidth: '100%' }}>
              {editorView === 'csv' ? (
                <CsvView content={currentCsvContent} setContent={() => {}} isEditable={false} pageWidth={pageWidth} />
              ) : layout === 'mono' ? (
                <Editor content={currentContent} setContent={() => {}} isEditable={false} tabSize={tabSize} />
              ) : (
                <ColumnView content={currentContent} setContent={() => {}} isEditable={false} col1Width={col1Width} editorStyles={editorStyles} onTakeLayout={handleTakeLayout} />
              )}
            </div>
          </main>
        </div>
        <div className="w-1.5 bg-gray-900 hover:bg-blue-600/50 cursor-col-resize flex-shrink-0 transition-colors" onMouseDown={handleHorizontalMouseDown} />
        <div className="flex-grow h-full bg-[#111827] flex flex-col overflow-hidden">
           <SubtitlesEditor 
            title="Subtítols SRT" 
            segments={linkedSegments} 
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
          />
        </div>
      </div>
      {isSyncModalOpen && <SyncLibraryModal isOpen={isSyncModalOpen} onClose={() => setIsSyncModalOpen(false)} onSyncMedia={handleSyncMedia} onSyncSubtitles={handleSyncSubtitles} />}
      {isAIModalOpen && <SubtitleAIOperationsModal isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} mode={aiMode} isProcessing={isAIProcessing} onWhisper={handleWhisperTranscription} onTranslate={handleAITranslation} onRevision={handleAIRevision} />}
    </div>
  );
};