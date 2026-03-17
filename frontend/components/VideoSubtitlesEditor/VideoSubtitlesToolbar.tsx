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
    // Seguiment Ona
    autoScrollWave: boolean;
    onToggleAutoScrollWave: () => void;
    scrollModeWave: 'stationary' | 'page';
    onScrollModeChangeWave: (mode: 'stationary' | 'page') => void;
    autosaveEnabled?: boolean;
    onToggleAutosave?: () => void;
    
    // Seguiment Subtítols
    autoScrollSubs: boolean;
    onToggleAutoScrollSubs: () => void;

    // Historial
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
      className={`p-2 rounded-full transition-all text-gray-300 hover:bg-gray-700 hover:text-white disabled:opacity-20 ${props.className || ''}`}
    >
      {props.children}
    </button>
  );

export const VideoSubtitlesToolbar: React.FC<VideoSubtitlesToolbarProps> = (props) => {
    const { 
        isEditable = true, currentTime, duration, onSeek, isPlaying,
        autoScrollWave, onToggleAutoScrollWave, scrollModeWave, onScrollModeChangeWave,
        autoScrollSubs, onToggleAutoScrollSubs,
        onUndo, onRedo, canUndo, canRedo
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
            
            <div className="relative w-full h-1.5 bg-gray-900 group cursor-pointer border-b border-white/5 overflow-hidden">
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
                    className="absolute top-0 left-0 h-full bg-blue-600 z-10"
                    style={{ width: `${progressPercent}%`, transition: 'width 230ms linear' }}
                />
                <div className="absolute top-0 left-0 w-full h-full bg-gray-700/30 group-hover:bg-gray-700/50 transition-colors" />

                {/* Bola de reproducció (sempre visible sobre la barra) */}
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full shadow-lg border-2 border-white z-30 group-hover:scale-125"
                    style={{ left: `calc(${progressPercent}% - 6px)`, transition: 'left 230ms linear, transform 75ms' }}
                />
            </div>

            <div className={`relative flex items-center justify-between px-4 py-2 select-none h-14 ${isEditable ? 'bg-gray-800/80' : 'bg-blue-900/20'}`}>
                
                <div className="flex items-center gap-2 min-w-[200px]">
                    {isEditable ? (
                        <button 
                            onClick={props.onOpenSync}
                            className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-black text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-all shadow-md uppercase tracking-tighter"
                            title="Sincronitzar mitjans"
                        >
                            <Icons.Hash className="w-3.5 h-3.5" />
                            <span>VINCULAR</span>
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 bg-blue-600/20 px-3 py-1.5 rounded-full border border-blue-500/30">
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                            <span className="text-[10px] font-black text-blue-300 uppercase tracking-widest">Lector Actiu</span>
                        </div>
                    )}

                    <div className="w-px h-6 bg-gray-700 mx-1 opacity-50" />

                    <div className="flex items-center gap-0.5">
                        <button 
                            disabled={!canUndo}
                            onClick={onUndo}
                            className="p-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-20 transition-all"
                            title="Desfer (Ctrl+Z)"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l5-5m-5 5l5 5" />
                            </svg>
                        </button>
                        <button 
                            disabled={!canRedo}
                            onClick={onRedo}
                            className="p-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-20 transition-all"
                            title="Refer (Ctrl+Shift+Z)"
                        >
                            <svg className="w-4 h-4 scale-x-[-1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l5-5m-5 5l5 5" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* CONTROLS CENTRALS */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 text-gray-200 bg-gray-950/40 px-4 py-1.5 rounded-full border border-gray-700/40 backdrop-blur-md shadow-2xl">
                    <ControlButton onClick={() => props.onJumpTime(-5)} title="Retrocedir 5s (←)">
                        <RewindIcon className="w-4 h-4" />
                    </ControlButton>
                    <ControlButton onClick={() => props.onJumpSegment('prev')} title="Anterior TAKE (↑)">
                        <SkipBackIcon className="w-5 h-5" />
                    </ControlButton>

                    <div className="w-px h-6 bg-gray-700 mx-1 opacity-50" />

                    <div className="flex items-center gap-1 bg-black/40 rounded-full p-0.5 border border-white/5">
                        <button 
                            onClick={onToggleAutoScrollWave}
                            className={`p-1.5 rounded-full transition-all ${autoScrollWave ? 'bg-blue-600 text-white shadow-inner' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <Icons.ArrowDown className={`w-3.5 h-3.5 ${autoScrollWave && isPlaying ? 'animate-bounce' : ''}`} />
                        </button>
                        <button 
                            onClick={() => onScrollModeChangeWave(scrollModeWave === 'stationary' ? 'page' : 'stationary')}
                            className="p-1.5 rounded-full bg-gray-800 text-gray-400 hover:text-white"
                        >
                            {scrollModeWave === 'stationary' ? <CursorStationaryIcon className="w-3 h-3" /> : <CursorPageIcon className="w-3 h-3" />}
                        </button>
                    </div>

                    <button onClick={props.onTogglePlay} className="mx-1 text-white hover:text-blue-400 transition-all active:scale-90">
                        {props.isPlaying ? <PauseIcon className="w-9 h-9" /> : <PlayIcon className="w-9 h-9" />}
                    </button>

                    <button 
                        onClick={onToggleAutoScrollSubs}
                        className={`p-2 rounded-full transition-all ${autoScrollSubs ? 'bg-cyan-600 text-white shadow-inner' : 'bg-black/40 text-gray-500 hover:text-gray-300'}`}
                    >
                        <Icons.SubtitlesIcon className="w-4 h-4" />
                    </button>

                    <div className="w-px h-6 bg-gray-700 mx-1 opacity-50" />

                    <ControlButton onClick={() => props.onJumpSegment('next')} title="Següent TAKE (↓)">
                        <SkipForwardIcon className="w-5 h-5" />
                    </ControlButton>
                    <ControlButton onClick={() => props.onJumpTime(5)} title="Avançar 5s (→)">
                        <ForwardIcon className="w-4 h-4" />
                    </ControlButton>
                </div>
                
                <div className="flex items-center gap-4 min-w-[200px] justify-end">
                    <ControlButton 
                        onClick={props.onToggleScriptLink} 
                        title={props.isScriptLinked ? "Desvincular guió" : "Vincular guió"}
                        className={`${props.isScriptLinked ? 'text-indigo-400' : 'text-gray-600'}`}
                    >
                        {props.isScriptLinked ? <LinkIcon className="w-5 h-5" /> : <LinkOffIcon className="w-5 h-5" />}
                    </ControlButton>

                    <Timecode currentTime={props.currentTime} duration={props.duration} onSeek={props.onSeek} />

                    <div className="flex items-center gap-1 bg-black/30 rounded-lg px-2 py-0.5 border border-white/5">
                        <ControlButton onClick={() => props.onChangeRate(-0.1)} title="Disminuir velocitat" className="!p-1"><MinusIcon className="w-3 h-3" /></ControlButton>
                        <span className="text-[11px] font-mono font-bold text-blue-400 w-9 text-center">{props.playbackRate.toFixed(2)}x</span>
                        <ControlButton onClick={() => props.onChangeRate(0.1)} title="Augmentar velocitat" className="!p-1"><PlusIcon className="w-3 h-3" /></ControlButton>
                    </div>
                    {props.onToggleAutosave && (
  <button
    onClick={props.onToggleAutosave}
    className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${
      props.autosaveEnabled ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-gray-800 text-gray-400 border-gray-700'
    }`}
    title="Autosave"
  >
    AUTO
  </button>
)}
                    {props.onSave && (
  <button
    onClick={props.onSave}
    className="p-2 text-blue-300 hover:text-blue-200 transition-colors"
    title="Guardar (Ctrl+S)"
  >
    {/* icono simple */}
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zM12 19a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm3-10H5V5h10v4z"/>
    </svg>
  </button>
)}
                    <button 
                        onClick={props.onExportSrt}
                        className="p-2 text-emerald-400 hover:text-emerald-300 transition-colors"
                        title="Exportar SRT final"
                    >
                        <DownloadIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};