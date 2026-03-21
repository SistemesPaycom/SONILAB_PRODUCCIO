import React, { useState } from 'react';
import * as Icons from '../icons';
import {
    PlayIcon, PauseIcon, SkipBackIcon, SkipForwardIcon, VolumeHighIcon,
    VolumeMuteIcon, DownloadIcon, RewindIcon, ForwardIcon, PlusIcon, MinusIcon,
    LinkIcon, LinkOffIcon, CursorStationaryIcon, CursorPageIcon
} from '../VideoEditor/PlayerIcons';
import { Timecode } from '../VideoEditor/Timecode';

interface VideoSubtitlesToolbarProps {
    onOpenSync: () => void;
    onExportSrt: () => void;
    isPlaying: boolean;
    onTogglePlay: () => void;
    onJumpSegment: (direction: 'prev' | 'next') => void;
    onJumpTime: (seconds: number) => void;
    currentTime: number;
    duration: number;
    onSeek: (time: number) => void;
    playbackRate: number;
    onChangeRate: (delta: number) => void;
    isScriptLinked: boolean;
    onToggleScriptLink: () => void;
    isEditable?: boolean;
    onSave?: () => void;
    // Seguiment Ona (kept for interface compat but controls moved to timeline header)
    autoScrollWave: boolean;
    onToggleAutoScrollWave: () => void;
    scrollModeWave: 'stationary' | 'page';
    onScrollModeChangeWave: (mode: 'stationary' | 'page') => void;
    autosaveEnabled?: boolean;
    onToggleAutosave?: () => void;

    // Seguiment Subtítols
    autoScrollSubs: boolean;
    onToggleAutoScrollSubs: () => void;

    // Subtitle overlay on video
    subtitleOverlayShow?: boolean;
    onToggleSubtitleOverlay?: () => void;

    // Historial (kept for interface compat but controls moved to timeline header)
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
}

const ControlButton: React.FC<{ onClick: () => void; title: string; children: React.ReactNode; className?: string; disabled?: boolean }> = (props) => (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      className={`p-2 rounded-full transition-all hover:bg-white/10 disabled:opacity-20 ${props.className || ''}`}
      style={{ color: 'var(--th-text-secondary)' }}
    >
      {props.children}
    </button>
  );

export const VideoSubtitlesToolbar: React.FC<VideoSubtitlesToolbarProps> = (props) => {
    const {
        isEditable = true, currentTime, duration, onSeek, isPlaying,
        autoScrollSubs, onToggleAutoScrollSubs,
        subtitleOverlayShow, onToggleSubtitleOverlay,
    } = props;

    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);

    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
    };

    const toggleMute = () => {
        setIsMuted(prev => !prev);
        if (isMuted && volume === 0) setVolume(0.5);
    };

    const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
        onSeek(parseFloat(e.target.value));
    };

    return (
        <div className="flex flex-col w-full overflow-hidden">
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

            <div className="relative w-full h-1.5 group cursor-pointer border-b overflow-hidden" style={{ backgroundColor: 'var(--th-bg-tertiary)', borderBottomColor: 'var(--th-border)' }}>
                <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    step="0.01"
                    value={currentTime}
                    onChange={handleScrub}
                    className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer custom-scrubber"
                />
                <div
                    className="absolute top-0 left-0 h-full z-10"
                    style={{ backgroundColor: 'var(--th-accent)', width: `${progressPercent}%`, transition: 'width 230ms linear' }}
                />
                <div className="absolute top-0 left-0 w-full h-full transition-colors" style={{ backgroundColor: 'rgba(128,128,128,0.1)' }} />

                {/* Bola de reproducció (sempre visible sobre la barra) */}
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow-lg border-2 z-30 group-hover:scale-125"
                    style={{ backgroundColor: 'var(--th-accent)', borderColor: 'var(--th-text-primary)', left: `calc(${progressPercent}% - 6px)`, transition: 'left 230ms linear, transform 75ms' }}
                />
            </div>

            <div className={`relative flex items-center justify-between px-3 py-2 select-none h-14`} style={{ backgroundColor: isEditable ? 'var(--th-header-bg)' : 'var(--th-accent-muted)' }}>

                {/* LEFT: Vincular */}
                <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
                    {isEditable ? (
                        <button
                            onClick={props.onOpenSync}
                            className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-black rounded-md transition-all shadow-md uppercase tracking-tighter"
                            style={{ backgroundColor: 'var(--th-btn-primary-bg)', color: 'var(--th-btn-primary-text)' }}
                            title="Sincronitzar mitjans"
                        >
                            <Icons.Hash className="w-3.5 h-3.5" />
                            <span>VINCULAR</span>
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: 'var(--th-accent-muted)', borderWidth: '1px', borderColor: 'var(--th-focus-ring)' }}>
                            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--th-accent-text)' }}></div>
                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--th-accent-text)' }}>Lector Actiu</span>
                        </div>
                    )}
                </div>

                {/* CENTER: Transport controls only */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 text-gray-200 bg-black/40 px-4 py-1.5 rounded-full border border-white/10 backdrop-blur-md shadow-2xl">
                    <ControlButton onClick={() => props.onJumpTime(-5)} title="Retrocedir 5s (←)">
                        <RewindIcon className="w-4 h-4" />
                    </ControlButton>
                    <ControlButton onClick={() => props.onJumpSegment('prev')} title="Anterior TAKE (↑)">
                        <SkipBackIcon className="w-5 h-5" />
                    </ControlButton>

                    <div className="w-px h-6 bg-white/10 mx-1 opacity-50" />

                    <button onClick={props.onTogglePlay} className="mx-1 text-white transition-all active:scale-90" style={{ '--hover-color': 'var(--th-accent-text)' } as any}>
                        {props.isPlaying ? <PauseIcon className="w-9 h-9" /> : <PlayIcon className="w-9 h-9" />}
                    </button>

                    {/* Subtitle overlay toggle */}
                    {onToggleSubtitleOverlay && (
                        <button
                            onClick={onToggleSubtitleOverlay}
                            className={`p-2 rounded-full transition-all ${subtitleOverlayShow ? 'text-white shadow-inner' : 'bg-black/40 text-gray-500 hover:text-gray-300'}`}
                            style={subtitleOverlayShow ? { backgroundColor: 'var(--th-accent)' } : undefined}
                            title={subtitleOverlayShow ? 'Ocultar subtítols al vídeo' : 'Mostrar subtítols al vídeo'}
                        >
                            <Icons.SubtitlesIcon className="w-4 h-4" />
                        </button>
                    )}

                    <div className="w-px h-6 bg-white/10 mx-1 opacity-50" />

                    <ControlButton onClick={() => props.onJumpSegment('next')} title="Següent TAKE (↓)">
                        <SkipForwardIcon className="w-5 h-5" />
                    </ControlButton>
                    <ControlButton onClick={() => props.onJumpTime(5)} title="Avançar 5s (→)">
                        <ForwardIcon className="w-4 h-4" />
                    </ControlButton>
                </div>

                {/* RIGHT: Timecode + speed */}
                <div className="flex flex-col items-stretch gap-0.5 min-w-0 flex-shrink-0 justify-center">
                    <div className="flex justify-end">
                        <Timecode currentTime={props.currentTime} duration={props.duration} onSeek={props.onSeek} />
                    </div>

                    <div className="flex items-center gap-1 justify-end">
                        <ControlButton onClick={() => props.onChangeRate(-0.1)} title="Disminuir velocitat" className="!p-1"><MinusIcon className="w-3 h-3" /></ControlButton>
                        <span className="text-[11px] font-mono font-bold w-9 text-center" style={{ color: 'var(--th-accent-text)' }}>{props.playbackRate.toFixed(2)}x</span>
                        <ControlButton onClick={() => props.onChangeRate(0.1)} title="Augmentar velocitat" className="!p-1"><PlusIcon className="w-3 h-3" /></ControlButton>
                    </div>
                </div>
            </div>
        </div>
    );
};
