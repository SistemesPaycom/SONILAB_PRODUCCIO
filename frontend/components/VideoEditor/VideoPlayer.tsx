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
    // Split by original line breaks; each line rendered as a separate block
    // to preserve the exact number of lines. Parent handles nowrap + auto-scaling.
    const lines = text.split('\n');
    return (
        <>
          {lines.map((line, i) => (
            <React.Fragment key={i}>
              {i > 0 && <br />}
              <span dangerouslySetInnerHTML={{ __html: plainToRich(line) }} />
            </React.Fragment>
          ))}
        </>
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
  fontScale: number;
  side: 'vo' | 'tr';
}> = ({ text, position, offsetPx, fontScale, side }) => {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLDivElement>(null);
  const [finalFontPx, setFinalFontPx] = React.useState(24);

  // Base font size: fontScale acts as multiplier (1 = 24px base)
  const baseFontPx = Math.round(24 * (fontScale || 1));

  // Auto-fit: measure the text at baseFontPx, then shrink fontSize if the
  // text block exceeds ~90% of the container width. By adjusting fontSize
  // directly (instead of CSS transform), the inline-block naturally reflows
  // to a narrower width and text-center keeps it perfectly centred — no
  // transform-origin / pivot issues.
  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    const textEl = textRef.current;
    if (!wrapper || !textEl) return;

    const fit = () => {
      // First measure at full base size
      textEl.style.fontSize = `${baseFontPx}px`;

      const availW = wrapper.clientWidth * 0.90; // 90% — leave margin on sides
      const contentW = textEl.scrollWidth;

      if (contentW > availW && availW > 0) {
        const ratio = Math.max(0.4, availW / contentW);
        const reduced = Math.max(10, Math.round(baseFontPx * ratio));
        setFinalFontPx(reduced);
        textEl.style.fontSize = `${reduced}px`;
      } else {
        setFinalFontPx(baseFontPx);
      }
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [text, baseFontPx]);

  const posStyle = {
    '--offset-px': `${offsetPx}px`,
    transform:
      position === 'top'
        ? `translateY(var(--offset-px))`
        : `translateY(calc(-1 * var(--offset-px)))`,
  } as React.CSSProperties;

  return (
    <div
      ref={wrapperRef}
      className={`subtitle-overlay absolute left-0 right-0 p-2 text-center pointer-events-none ${position === 'top' ? 'top-0' : 'bottom-0'} ${side}`}
      style={posStyle}
    >
      <div
        ref={textRef}
        className="subtitle-overlay-text inline-block px-4 py-1.5 rounded-lg font-medium shadow-2xl backdrop-blur-sm"
        style={{
          fontSize: `${finalFontPx}px`,
          lineHeight: 1.35,
          whiteSpace: 'nowrap',
          color: '#FFFFFF',
          backgroundColor: 'rgba(0, 0, 0, 0.70)',
          textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)',
        }}
      >
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
              fontScale={overlayConfig.original.fontScale}
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
              fontScale={overlayConfig.translated.fontScale}
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
