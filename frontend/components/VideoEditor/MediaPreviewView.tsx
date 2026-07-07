import React, { useState, useRef, useEffect } from 'react';
import { Document } from '../../appTypes';
import { useLibrary } from '../../context/Library/SonilabLibraryContext';
import { VideoPlaybackArea } from './VideoPlaybackArea';
import { PlayIcon, PauseIcon, PlusIcon, MinusIcon, CursorStationaryIcon, CursorPageIcon } from './PlayerIcons';
import { Timecode } from './Timecode';
import * as Icons from '../icons';
import { isAudioOnly } from '../../constants';

interface MediaPreviewViewProps {
  currentDoc: Document;
}

export const MediaPreviewView: React.FC<MediaPreviewViewProps> = ({ currentDoc }) => {
  const { getMediaFile, ensureMediaFile } = useLibrary();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
const [videoFile, setVideoFile] = useState<File | null>(null);
  // Estats de seguiment de l'ona
  const [autoScrollWave, setAutoScrollWave] = useState(true);
  const [scrollModeWave, setScrollModeWave] = useState<'stationary' | 'page'>('stationary');

  useEffect(() => {
  let cancelled = false;
  let url: string | null = null;

  void (async () => {
    let f = getMediaFile(currentDoc.id);

    if (!f) {
      try {
        f = await ensureMediaFile(currentDoc.id, currentDoc.name);
      } catch (e) {
        console.error('ensureMediaFile failed', e);
        return;
      }
    }

    if (cancelled || !f) return;

    setVideoFile(f);
    url = URL.createObjectURL(f);
    setVideoSrc(url);
  })();

  return () => {
    cancelled = true;
    if (url) URL.revokeObjectURL(url);
  };
}, [currentDoc.id, currentDoc.name, getMediaFile, ensureMediaFile]);

  const onTogglePlay = () => setIsPlaying(!isPlaying);
  const onSeek = (time: number) => {
    if (videoRef.current) videoRef.current.currentTime = time;
    setCurrentTime(time);
  };
  
  const onChangeRate = (delta: number) => {
    setPlaybackRate((prev) => {
      const next = Math.max(0.5, Math.min(2.0, parseFloat((prev + delta).toFixed(2))));
      if (videoRef.current) videoRef.current.playbackRate = next;
      return next;
    });
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const playerProps = {
    isPlaying,
    currentTime,
    duration,
    onSeek,
    videoRef,
    src: videoSrc,
    segments: [],
    activeSegment: null,
    overlayConfig: {
        original: { show: false, position: 'top' as const, offsetPx: 0, fontScale: 1 },
        translated: { show: false, position: 'bottom' as const, offsetPx: 0, fontScale: 1 }
    },
    onTimeUpdate: setCurrentTime,
    onDurationChange: setDuration,
    onPlay: () => setIsPlaying(true),
    onPause: () => setIsPlaying(false),
    onTogglePlay,
    onJumpSegment: () => {},
    videoFile: videoFile,
    autoScroll: autoScrollWave,
    scrollMode: scrollModeWave,
    isAudioOnly: isAudioOnly(currentDoc.sourceType)
  };

  return (
    <div className="flex flex-col h-full w-full bg-black">
      <style>{`
        .custom-scrubber::-webkit-slider-thumb {
            appearance: none;
            width: 1px;
            height: 1px;
            background: transparent;
            border: none;
        }
        .custom-scrubber::-moz-range-thumb {
            width: 1px;
            height: 1px;
            background: transparent;
            border: none;
        }
      `}</style>

      <div className="flex-grow min-h-0">
        <VideoPlaybackArea {...playerProps} />
      </div>
      
      {/* Barra de transport amb scrubber i botons de seguiment */}
      <div className="flex flex-col flex-shrink-0">
        {/* Scrubber (Barra blava) */}
        <div className="relative w-full h-1.5 bg-gray-900 group cursor-pointer border-b border-white/5">
            <input
                type="range"
                min="0"
                max={duration || 0}
                step="0.01"
                value={currentTime}
                onChange={(e) => onSeek(parseFloat(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer custom-scrubber"
            />
            <div
                className="absolute top-0 left-0 h-full transition-all duration-75 z-10"
                style={{ backgroundColor: 'var(--th-accent)', width: `${progressPercent}%` }}
            />
            <div className="absolute top-0 left-0 w-full h-full bg-gray-700/30 group-hover:bg-gray-700/50 transition-colors" />
            
            {/* Bola de reproducció permanent */}
            <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow-lg border-2 border-white z-30 transition-transform duration-75 group-hover:scale-125"
                style={{ backgroundColor: 'var(--th-accent)', left: `calc(${progressPercent}% - 6px)` }}
            />
        </div>

        <div className="h-14 bg-gray-900 border-t border-gray-800 flex items-center justify-between px-6">
            <div className="flex items-center gap-6">
                <button 
                    onClick={onTogglePlay} 
                    className="text-white hover:text-gray-300 transition-all active:scale-90"
                >
                    {isPlaying ? <PauseIcon className="w-8 h-8" /> : <PlayIcon className="w-8 h-8" />}
                </button>
                
                <Timecode currentTime={currentTime} duration={duration} onSeek={onSeek} />
                
                <div className="w-px h-6 bg-gray-700 mx-1 opacity-50" />

                {/* Botons de seguiment de l'ona */}
                <div className="flex items-center gap-1 bg-black/40 rounded-full p-0.5 border border-white/5">
                    <button 
                        onClick={() => setAutoScrollWave(!autoScrollWave)}
                        className={`p-1.5 rounded-full transition-all ${autoScrollWave ? 'text-white shadow-inner' : 'text-gray-500 hover:text-gray-300'}`}
                        style={autoScrollWave ? { backgroundColor: 'var(--th-accent)' } : undefined}
                        title="Mode seguiment"
                    >
                        <Icons.ArrowDown className={`w-3.5 h-3.5 ${autoScrollWave && isPlaying ? 'animate-bounce' : ''}`} />
                    </button>
                    <button 
                        onClick={() => setScrollModeWave(scrollModeWave === 'stationary' ? 'page' : 'stationary')}
                        className="p-1.5 rounded-full bg-gray-800 text-gray-400 hover:text-white"
                        title={scrollModeWave === 'stationary' ? "Canviar a mode pàgina" : "Canviar a mode estacionari"}
                    >
                        {scrollModeWave === 'stationary' ? <CursorStationaryIcon className="w-3 h-3" /> : <CursorPageIcon className="w-3 h-3" />}
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-3 bg-black/30 rounded-xl px-4 py-1.5 border border-white/5">
                <button onClick={() => onChangeRate(-0.1)} className="p-1 text-gray-400 hover:text-white transition-colors">
                    <MinusIcon className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-bold w-12 text-center select-none" style={{ color: 'var(--th-accent-text)' }}>
                    {playbackRate.toFixed(2)}x
                </span>
                <button onClick={() => onChangeRate(0.1)} className="p-1 text-gray-400 hover:text-white transition-colors">
                    <PlusIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default MediaPreviewView;