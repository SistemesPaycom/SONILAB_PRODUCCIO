import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Document, OverlayConfig, Id } from '../../types';
import * as Icons from '../icons';
import { VideoSubtitlesToolbar } from './VideoSubtitlesToolbar';
import { VideoPlaybackArea } from '../VideoEditor/VideoPlaybackArea';
import SubtitlesEditor from './SubtitlesEditor';
import { Segment, GeneralConfig } from '../../types/Subtitles';
import { parseSrt, serializeSrt } from '../../utils/SubtitlesEditor/srtParser';
import SyncLibraryModal from './SyncLibraryModal';
import SubtitleAIOperationsModal from './SubtitleAIOperationsModal';
import { useLibrary } from '../../context/Library/LibraryContext';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import useLocalStorage from '../../hooks/useLocalStorage';
import { LOCAL_STORAGE_KEYS } from '../../constants';

interface VideoSrtStandaloneEditorViewProps {
  currentDoc: Document;
  isEditing: boolean;
  onClose: () => void;
}

export const VideoSrtStandaloneEditorView: React.FC<VideoSrtStandaloneEditorViewProps> = ({ currentDoc, isEditing, onClose }) => {
  const { getMediaFile, ensureMediaFile } = useLibrary();
  const [maxLinesSubs] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.MAX_LINES_SUBS, 2);

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
  
  const [autoScrollWave, setAutoScrollWave] = useState(true);
  const [scrollModeWave, setScrollModeWave] = useState<'stationary' | 'page'>('stationary');
  const [autoScrollSubs, setAutoScrollSubs] = useState(true);

  const [segments, setSegments] = useState<Segment[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<number | null>(null);
  const [subsOverlayConfig, setSubsOverlayConfig] = useState<OverlayConfig>({
    show: true, position: 'bottom', offsetPx: 10, fontScale: 1,
  });

  const generalConfig = useMemo<GeneralConfig>(() => ({
    maxCharsPerLine: 40,
    maxLinesPerSubtitle: maxLinesSubs
  }), [maxLinesSubs]);

  const [syncSubsEnabled, setSyncSubsEnabled] = useState(true);

  useEffect(() => {
    const srtText = (Object.values(currentDoc.contentByLang)[0] as string) || '';
    if (srtText) {
      const parsed = parseSrt(srtText);
      setSegments(parsed);
      if (parsed.length > 0) setActiveSegmentId(parsed[0].id);
    }
  }, [currentDoc.id]);

  useEffect(() => {
    if (!syncSubsEnabled) return;
    const currentSeg = segments.find(s => currentTime >= s.startTime && currentTime < s.endTime);
    if (currentSeg && currentSeg.id !== activeSegmentId) {
        setActiveSegmentId(currentSeg.id as number);
    }
  }, [currentTime, segments, activeSegmentId, syncSubsEnabled]);

  const onTogglePlay = useCallback(() => setIsPlaying((p) => !p), []);
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
      if (segment) onSeek(segment.startTime);
    }
  }, [segments, syncSubsEnabled, onSeek]);

  const onJumpSegment = useCallback((direction: 'prev' | 'next') => {
      if (segments.length === 0) return;
      const idx = segments.findIndex(s => s.id === activeSegmentId);
      if (direction === 'next' && idx < segments.length - 1) {
          handleSegmentClick(segments[idx+1].id);
      } else if (direction === 'prev' && idx > 0) {
          handleSegmentClick(segments[idx-1].id);
      }
  }, [segments, activeSegmentId, handleSegmentClick]);

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
    setSegments(newSegments.map((s, i) => ({ ...s, id: i + 1 })));
  }, [activeSegmentId, segments, isEditing]);

  const handleSplitSegmentAtCursor = useCallback(() => {
    const payload = window.__SEG_SPLIT_PAYLOAD__;
    if (payload) {
        const idx = segments.findIndex(s => s.id === payload.id);
        if (idx === -1) return;
        const target = segments[idx];
        const splitPoint = target.startTime + ((target.endTime - target.startTime) * payload.splitRatio);
        const newSeg1 = { ...target, endTime: splitPoint, originalText: payload.leftText, richText: payload.leftText };
        const newSeg2 = { id: Date.now(), startTime: splitPoint + 0.001, endTime: target.endTime, originalText: payload.rightText, richText: payload.rightText };
        const newSegments = [...segments];
        newSegments.splice(idx, 1, newSeg1, newSeg2);
        window.__SEG_SPLIT_PAYLOAD__ = null;
        setSegments(newSegments.map((s, i) => ({ ...s, id: i + 1 })));
    }
  }, [segments]);

  useKeyboardShortcuts('subtitlesEditor', (action) => {
    switch (action) {
      case 'TOGGLE_PLAY_PAUSE': onTogglePlay(); break;
      case 'REWIND_5S': onJumpTime(-5); break;
      case 'FORWARD_5S': onJumpTime(5); break;
      case 'JUMP_NEXT_SEGMENT': case 'NAVIGATE_SEGMENT_DOWN': onJumpSegment('next'); break;
      case 'JUMP_PREV_SEGMENT': case 'NAVIGATE_SEGMENT_UP': onJumpSegment('prev'); break;
      case 'SPLIT_SEGMENT': handleSplitSegmentAtCursor(); break;
      case 'MERGE_SEGMENT': handleMergeSegmentWithNext(); break;
    }
  });

  const handleSyncMedia = (doc: Document) => {
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
};
  
  const handleSegmentChange = (updated: Segment) => {
    if (!isEditing) return;
    setSegments(prev => prev.map(s => (s.id === updated.id ? updated : s)));
  };

  const handleSegmentUpdate = (id: Id, newStart: number, nE: number) => {
    if (!isEditing) return;
    setSegments(prev => prev.map(seg => seg.id === id ? { ...seg, startTime: newStart, endTime: nE } : seg));
  };

  const activeSegmentForPlayer = useMemo(() => {
    const seg = segments.find((s: Segment) => currentTime >= s.startTime && currentTime < s.endTime);
    return seg ? { id: seg.id, startTime: seg.startTime, endTime: seg.endTime, originalText: seg.originalText, translatedText: '' } : null;
  }, [segments, currentTime]);

  const playerProps = {
    isPlaying, currentTime, duration, onSeek, videoRef, src: videoSrc, segments, activeId: activeSegmentId,
    activeSegment: subsOverlayConfig.show ? activeSegmentForPlayer : null,
    overlayConfig: { original: subsOverlayConfig, translated: { show: false, position: 'bottom' as const, offsetPx: 10, fontScale: 1 } },
    onTimeUpdate: setCurrentTime, onDurationChange: setDuration, onPlay: () => setIsPlaying(true), onPause: () => setIsPlaying(false), onTogglePlay, onJumpSegment,
    videoFile, onSegmentUpdate: handleSegmentUpdate, onSegmentClick: handleSegmentClick, autoScroll: autoScrollWave, scrollMode: scrollModeWave,
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0f172a] text-gray-200">
      <header className="bg-gray-800 h-14 border-b border-gray-700 flex items-center px-4 justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
              <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg text-gray-400"><Icons.ArrowLeft className="w-5 h-5" /></button>
              <div><h2 className="text-sm font-black text-white uppercase tracking-widest">Standalone SRT Editor</h2><p className="text-[10px] text-gray-500 font-bold">{currentDoc.name}</p></div>
          </div>
          <button onClick={() => setIsSyncModalOpen(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-lg transition-all shadow-md uppercase tracking-wider">Vincular Vídeo</button>
      </header>
      <div className="flex-grow flex flex-col min-h-0">
          <div className="h-1/2 bg-black">
              <VideoPlaybackArea {...playerProps} />
          </div>
          <div className="bg-[#1e293b] border-y border-gray-700/50"><VideoSubtitlesToolbar onOpenSync={() => setIsSyncModalOpen(true)} onExportSrt={() => {}} isPlaying={isPlaying} onTogglePlay={onTogglePlay} onJumpSegment={onJumpSegment} onJumpTime={onJumpTime} currentTime={currentTime} duration={duration} onSeek={onSeek} playbackRate={playbackRate} onChangeRate={onChangeRate} isScriptLinked={false} onToggleScriptLink={() => {}} isEditable={isEditing} autoScrollWave={autoScrollWave} onToggleAutoScrollWave={() => setAutoScrollWave(!autoScrollWave)} scrollModeWave={scrollModeWave} onScrollModeChangeWave={setScrollModeWave} autoScrollSubs={autoScrollSubs} onToggleAutoScrollSubs={() => setAutoScrollSubs(!autoScrollSubs)} /></div>
          <div className="flex-grow overflow-hidden bg-[#111827]"><SubtitlesEditor title="Llista de Subtítols" segments={segments} activeId={activeSegmentId} isEditable={isEditing} onSegmentChange={handleSegmentChange} onSegmentBlur={() => {}} onSegmentClick={handleSegmentClick} onSegmentFocus={(id: number) => setActiveSegmentId(id)} syncEnabled={syncSubsEnabled} onSyncChange={setSyncSubsEnabled} overlayConfig={subsOverlayConfig} onOverlayConfigChange={setSubsOverlayConfig} generalConfig={generalConfig} autoScroll={autoScrollSubs} onOpenAIOperations={(m) => { setAiMode(m); setIsAIModalOpen(true); }} onSplit={handleSplitSegmentAtCursor} onMerge={handleMergeSegmentWithNext} /></div>
      </div>
      {isSyncModalOpen && <SyncLibraryModal isOpen={isSyncModalOpen} onClose={() => setIsSyncModalOpen(false)} onSyncMedia={handleSyncMedia} onSyncSubtitles={(doc) => { const parsed = parseSrt((doc.contentByLang['_unassigned'] as string) || (Object.values(doc.contentByLang)[0] as string) || ''); setSegments(parsed); }} />}
      {isAIModalOpen && <SubtitleAIOperationsModal isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} mode={aiMode} isProcessing={isAIProcessing} onWhisper={() => {}} onTranslate={() => {}} onRevision={() => {}} />}
    </div>
  );
};