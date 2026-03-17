import React, { useEffect, useRef, useState } from 'react';
import { Segment, OverlayConfig } from '../../types';
import { Timecode, formatTime } from './Timecode';
import { plainToRich } from '../../utils/SubtitlesEditor/richTextHelpers';
import {
  PlayIcon,
  PauseIcon,
  SkipBackIcon,
  SkipForwardIcon,
  VolumeHighIcon,
  VolumeMuteIcon,
  FullscreenEnterIcon,
  FullscreenExitIcon,
  PopOutIcon,
  PopInIcon,
} from './PlayerIcons';

/**
 * Component per renderitzar línies de subtítols interpretant tags de format (b, i, u).
 */
const SubtitleLines: React.FC<{ text: string }> = ({ text }) => {
    // Utilitzem la utilitat que converteix els tags SRT a HTML real per al navegador
    const htmlContent = plainToRich(text);
    return (
        <div 
            className="inline-block"
            dangerouslySetInnerHTML={{ __html: htmlContent }} 
        />
    );
};


interface VideoPlayerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  src: string | null;
  segments: Segment[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  activeSegment: Segment | null;
  overlayConfig: { original: OverlayConfig; translated: OverlayConfig };
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onSeek: (time: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onTogglePlay: () => void;
  onJumpSegment: (direction: 'prev' | 'next') => void;
  isFloating?: boolean;
  onToggleFloating?: () => void;
}

const SESSION_STORAGE_TIME_KEY = 'subtrans.lastTime';

const SubtitleOverlay: React.FC<{
  text: string;
  position: 'top' | 'bottom';
  offsetPx: number;
  side: 'vo' | 'tr';
}> = ({ text, position, offsetPx, side }) => {
  const style = {
    '--offset-px': `${offsetPx}px`,
    transform:
      position === 'top'
        ? `translateY(var(--offset-px))`
        : `translateY(calc(-1 * var(--offset-px)))`,
  } as React.CSSProperties;

  return (
    <div className={`subtitle-overlay absolute left-0 right-0 p-4 text-center pointer-events-none ${position === 'top' ? 'top-0' : 'bottom-0'} ${side}`} style={style}>
      <div className="subtitle-overlay-text inline-block px-4 py-1.5 bg-black/70 text-white rounded-lg text-2xl font-medium shadow-2xl backdrop-blur-sm">
        <SubtitleLines text={text} />
      </div>
    </div>
  );
};

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoRef,
  src,
  segments,
  currentTime,
  duration,
  isPlaying,
  activeSegment,
  overlayConfig,
  onTimeUpdate,
  onDurationChange,
  onSeek,
  onPlay,
  onPause,
  onTogglePlay,
  onJumpSegment,
  isFloating = false,
  onToggleFloating,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying && v.paused) {
      v.play().catch(() => {});
    } else if (!isPlaying && !v.paused) {
      v.pause();
    }
  }, [isPlaying, videoRef]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const sessionSaveRef = useRef(0);
  const handleTimeUpdateWithSave = (time: number) => {
    onTimeUpdate(time);
    // Throttle sessionStorage writes to every 2s — sync I/O on every frame kills perf
    const now = performance.now();
    if (now - sessionSaveRef.current > 2000) {
      sessionSaveRef.current = now;
      sessionStorage.setItem(SESSION_STORAGE_TIME_KEY, time.toString());
    }
  };


  if (!src) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-gray-500 text-3xl font-black uppercase tracking-widest">
        VIDEO
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col bg-black group overflow-hidden">
      <div
        className="flex-grow relative w-full min-h-0 bg-black cursor-pointer"
        onClick={onTogglePlay}
        role="button"
        aria-pressed={isPlaying}
        aria-label={isPlaying ? 'Pausa' : 'Reproduir'}
      >
        <video
          ref={videoRef}
          src={src}
          onTimeUpdate={(e) => handleTimeUpdateWithSave(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => onDurationChange(e.currentTarget.duration)}
          onPlay={onPlay}
          onPause={onPause}
          className="w-full h-full object-contain pointer-events-none"
        />

        {overlayConfig.original.show &&
          activeSegment &&
          activeSegment.originalText.trim() && (
            <SubtitleOverlay
              text={activeSegment.originalText}
              position={overlayConfig.original.position}
              offsetPx={overlayConfig.original.offsetPx}
              side="vo"
            />
          )}

        {overlayConfig.translated.show &&
          activeSegment &&
          activeSegment.translatedText && activeSegment.translatedText.trim() !== '' && (
            <SubtitleOverlay
              text={activeSegment.translatedText || ''}
              position={overlayConfig.translated.position}
              offsetPx={overlayConfig.translated.offsetPx}
              side="tr"
            />
          )}
      </div>
    </div>
  );
};

// Custom comparator: skip re-renders caused by currentTime changes.
// The <video> element manages its own playback time via the ref;
// subtitle overlay depends on activeSegment (already compared by reference).
export default React.memo(VideoPlayer, (prev, next) => {
  // Re-render only when something other than currentTime/duration changes
  if (prev.src !== next.src) return false;
  if (prev.isPlaying !== next.isPlaying) return false;
  if (prev.activeSegment !== next.activeSegment) return false;
  if (prev.overlayConfig !== next.overlayConfig) return false;
  if (prev.isFloating !== next.isFloating) return false;
  // Callbacks — reference equality (parent should memoize these)
  if (prev.onTogglePlay !== next.onTogglePlay) return false;
  if (prev.onPlay !== next.onPlay) return false;
  if (prev.onPause !== next.onPause) return false;
  // currentTime, duration, onTimeUpdate, onDurationChange, onSeek, onJumpSegment
  // are intentionally NOT compared — they change frequently but don't affect render output
  return true;
});
