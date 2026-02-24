
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Layout, Document, EditorStyles } from '../../types';
import Toolbar from '../EditorDeGuions/Toolbar';
import Editor from '../EditorDeGuions/Editor';
import { ColumnView } from '../EditorDeGuions/ColumnView';
import { CsvView } from '../EditorDeGuions/CsvView';
import { VideoEditorToolbar } from './VideoEditorToolbar';
import { VideoPlaybackArea } from './VideoPlaybackArea';
import ImportFilesModal from '../Import/ImportFilesModal';
import { buildTakeRangesFromScript } from '../../utils/EditorDeGuions/takeRanges';
import { useLibrary } from '../../context/Library/LibraryContext';
import useLocalStorage from '../../hooks/useLocalStorage';
import { LOCAL_STORAGE_KEYS } from '../../constants';

type EditorView = 'script' | 'csv';

interface VideoEditorViewProps {
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

export const VideoEditorView: React.FC<VideoEditorViewProps> = (props) => {
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

  const { state, getMediaFile, dispatch } = useLibrary();
  const { syncRequest } = state;
  const [takeMargin] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.TAKE_MARGIN, 2);
  const [takeStartMargin] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.TAKE_START_MARGIN, 2);

  const currentContent = currentDoc && activeLang ? currentDoc.contentByLang[activeLang] : '';
  const currentCsvContent = currentDoc && activeLang ? currentDoc.csvContentByLang[activeLang] : '';

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoImportModalOpen, setVideoImportModalOpen] = useState(false);

  const [isScriptLinked, setIsScriptLinked] = useState(true);
  const scriptScrollRef = useRef<HTMLElement>(null);
  const takeLayoutRef = useRef<Map<number, number>>(new Map());
  const activeTakeByTimeRef = useRef<number | null>(null);

  // ESCULTAR SYNC REQUESTS (Per Drag & Drop des de la llibreria)
  useEffect(() => {
    if (!syncRequest || syncRequest.type !== 'media') return;
    const doc = state.documents.find(d => d.id === syncRequest.docId);
    if (!doc) return;

    handleVideoFileChange_internal(doc);
    dispatch({ type: 'CLEAR_SYNC_REQUEST' });
  }, [syncRequest, dispatch, state.documents]);

  const handleVideoFileChange_internal = (doc: Document) => {
    const file = getMediaFile(doc.id);
    if (file) {
      if (videoSrc) URL.revokeObjectURL(videoSrc);
      setVideoFile(file);
      setVideoSrc(URL.createObjectURL(file));
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  };

  const takeRanges = useMemo(() => {
    return buildTakeRangesFromScript({
      content: currentContent || '',
      takeStartMarginSeconds: takeStartMargin,
      takeEndMarginSeconds: takeMargin,
      durationSeconds: duration,
    });
  }, [currentContent, duration, takeMargin, takeStartMargin]);

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

  const onTogglePlay = () => setIsPlaying((p) => !p);
  const onSeek = (time: number) => {
    if (videoRef.current) videoRef.current.currentTime = time;
    setCurrentTime(time);
  };
  const onJumpTime = (seconds: number) => onSeek(Math.max(0, Math.min(duration, currentTime + seconds)));
  const onChangeRate = (delta: number) => {
    setPlaybackRate((rate) => {
      const newRate = Math.max(0.5, Math.min(2.0, parseFloat((rate + delta).toFixed(2))));
      if (videoRef.current) videoRef.current.playbackRate = newRate;
      return newRate;
    });
  };

  const onImportVideo = () => setVideoImportModalOpen(true);

  const handleVideoFileChange = (file: File) => {
    if (file) {
      if (videoSrc) URL.revokeObjectURL(videoSrc);
      setVideoFile(file);
      setVideoSrc(URL.createObjectURL(file));
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  };

  const onJumpSegment = (direction: 'prev' | 'next') => {
    if (takeRanges.length === 0) return;
    const starts = Array.from<number>(new Set(takeRanges.map((r) => r.start))).sort((a, b) => a - b);
    if (direction === 'next') {
      const next = starts.find((t) => t > currentTime + 0.1);
      if (next !== undefined) onSeek(next);
    } else {
      const prevs = starts.filter((t) => t < currentTime - 0.5);
      if (prevs.length > 0) onSeek(prevs[prevs.length - 1]);
      else onSeek(starts[0]);
    }
  };

  const [topPanelHeight, setTopPanelHeight] = useState(350);
  const containerRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current || !containerRef.current) return;
    const deltaY = e.clientY - startYRef.current;
    const containerHeight = containerRef.current.offsetHeight;
    const toolbarHeight = 52;
    setTopPanelHeight(Math.max(MIN_PANEL_HEIGHT, Math.min(containerHeight - MIN_PANEL_HEIGHT - toolbarHeight, startHeightRef.current + deltaY)));
  }, []);

  const handleMouseUp = useCallback(() => {
    isResizingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = 'none';
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = topPanelHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [topPanelHeight, handleMouseMove, handleMouseUp]);

  const playerProps = {
    isPlaying, currentTime, duration, onSeek, videoRef, src: videoSrc, segments: [], activeSegment: null,
    overlayConfig: { original: { show: false, position: 'top' as const, offsetPx: 10, fontScale: 1 }, translated: { show: false, position: 'bottom' as const, offsetPx: 10, fontScale: 1 } },
    onTimeUpdate: setCurrentTime, onDurationChange: setDuration, onPlay: () => setIsPlaying(true), onPause: () => setIsPlaying(false), onTogglePlay, onJumpSegment, videoFile,
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full w-full bg-gray-900 text-gray-200">
      <div className="bg-black flex-shrink-0" style={{ height: `${topPanelHeight}px` }}>
        <VideoPlaybackArea {...playerProps} />
      </div>
      <div className="h-1.5 bg-gray-900 hover:bg-gray-700 cursor-row-resize flex-shrink-0" onMouseDown={handleMouseDown} />
      <div className="flex-shrink-0 bg-gray-800 border-y border-gray-700">
        <VideoEditorToolbar
          onImportVideo={onImportVideo} isPlaying={isPlaying} onTogglePlay={onTogglePlay} onJumpSegment={onJumpSegment} onJumpTime={onJumpTime} currentTime={currentTime} duration={duration} onSeek={onSeek} playbackRate={playbackRate} onChangeRate={onChangeRate} isScriptLinked={isScriptLinked} onToggleScriptLink={() => setIsScriptLinked((p) => !p)}
        />
      </div>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {isEditing && (
          <header className="bg-gray-800 shadow-md z-10 flex-shrink-0">
            <Toolbar {...props} currentDoc={currentDoc} />
          </header>
        )}
        <main ref={scriptScrollRef} data-script-scroll-container="true" className={`flex-grow overflow-y-auto flex flex-col items-center min-h-0 ${editorView === 'csv' ? 'px-4 pb-4 md:px-8 md:pb-8' : 'p-4 md:p-8'}`} onClick={props.handleEditorBackgroundClick}>
          <div id="page-content-area-video" className={`relative page-a4 bg-white text-gray-900 shadow-lg rounded-sm ${editorView === 'csv' ? '' : 'p-8'} transition-all duration-300`} style={{ width: pageWidth, maxWidth: '100%' }}>
            {editorView === 'csv' ? (
              <CsvView content={currentCsvContent || ''} setContent={(text, source) => handleTextChange(text, source)} isEditable={isEditing} pageWidth={pageWidth} />
            ) : layout === 'mono' ? (
              <Editor content={currentContent} setContent={(text) => handleTextChange(text, 'mono')} isEditable={isEditing} tabSize={tabSize} />
            ) : (
              <ColumnView content={currentContent} setContent={(text) => handleTextChange(text, 'script')} isEditable={isEditing} col1Width={col1Width} editorStyles={editorStyles} onTakeLayout={handleTakeLayout} />
            )}
          </div>
        </main>
      </div>
      {isVideoImportModalOpen && (
        <ImportFilesModal isOpen={isVideoImportModalOpen} onClose={() => setVideoImportModalOpen(false)} onFilesSelect={(files) => files.length > 0 && handleVideoFileChange(files[0])} accept="video/mp4,video/webm,video/ogg,video/quicktime" title="Importar Vídeo" description="Arrossega un arxiu de vídeo per a la sincronització." />
      )}
    </div>
  );
};
