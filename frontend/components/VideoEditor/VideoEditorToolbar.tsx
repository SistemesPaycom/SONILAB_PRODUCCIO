import React, { useState } from 'react';
import { 
    PlayIcon, PauseIcon, SkipBackIcon, SkipForwardIcon, VolumeHighIcon, 
    VolumeMuteIcon, UploadIcon, RewindIcon, ForwardIcon, PlusIcon, MinusIcon, TimeIcon,
    LinkIcon, LinkOffIcon
} from './PlayerIcons';
import { Timecode } from './Timecode';

interface VideoEditorToolbarProps {
    onImportVideo: () => void;
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
}

const ControlButton: React.FC<{ onClick: () => void; title: string; children: React.ReactNode; className?: string; }> = (props) => (
    <button
      onClick={props.onClick}
      title={props.title}
      className={`p-2 rounded-full transition-colors text-gray-300 hover:bg-gray-700 hover:text-white ${props.className || ''}`}
    >
      {props.children}
    </button>
  );

export const VideoEditorToolbar: React.FC<VideoEditorToolbarProps> = (props) => {
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
        // Lògica per controlar el volum del vídeo (s'hauria de passar des de dalt)
    };

    const toggleMute = () => {
        setIsMuted(prev => !prev);
        if (isMuted && volume === 0) setVolume(0.5);
        // Lògica per silenciar/dessilenciar el vídeo (s'hauria de passar des de dalt)
    };

    return (
        <div className="relative flex items-center justify-between px-4 py-2 select-none">
            
            {/* Esquerra: Importar */}
            <div className="flex items-center gap-2">
                 <button 
                    onClick={props.onImportVideo}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-md"
                    style={{ backgroundColor: 'var(--th-btn-primary-bg)', color: 'var(--th-btn-primary-text)' }}
                    title="Importar vídeo"
                >
                    <UploadIcon className="w-4 h-4" />
                    <span>Importar vídeo</span>
                </button>
            </div>

            {/* Controls centrals (Absolutely Centered) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 text-gray-200">
                <ControlButton onClick={() => props.onJumpTime(-5)} title="Retrocedir 5s">
                    <RewindIcon className="w-5 h-5" />
                </ControlButton>
                <ControlButton onClick={() => props.onJumpSegment('prev')} title="Anterior TAKE">
                    <SkipBackIcon className="w-6 h-6" />
                </ControlButton>

                <ControlButton 
                    onClick={props.onToggleScriptLink} 
                    title={props.isScriptLinked ? "Desvincular guió del vídeo" : "Vincular guió al vídeo"} 
                    className={props.isScriptLinked ? 'text-white' : ''}
                    style={props.isScriptLinked ? { backgroundColor: 'var(--th-accent)' } : undefined}
                >
                    {props.isScriptLinked ? <LinkIcon className="w-5 h-5" /> : <LinkOffIcon className="w-5 h-5" />}
                </ControlButton>
                
                <button onClick={props.onTogglePlay} title="Reproduir/Pausa" className="mx-2 text-white hover:text-gray-300">
                    {props.isPlaying ? <PauseIcon className="w-9 h-9" /> : <PlayIcon className="w-9 h-9" />}
                </button>

                <ControlButton onClick={() => props.onJumpSegment('next')} title="Següent TAKE">
                    <SkipForwardIcon className="w-6 h-6" />
                </ControlButton>
                <ControlButton onClick={() => props.onJumpTime(5)} title="Avançar 5s">
                    <ForwardIcon className="w-5 h-5" />
                </ControlButton>
            </div>
            
            {/* Controls a la dreta */}
            <div className="flex flex-col items-stretch gap-0.5 justify-center">
                <div className="flex justify-end">
                    <Timecode currentTime={props.currentTime} duration={props.duration} onSeek={props.onSeek} />
                </div>

                <div className="flex items-center gap-1 justify-end">
                    <ControlButton onClick={() => props.onChangeRate(-0.1)} title="Disminuir velocitat">
                        <MinusIcon className="w-4 h-4" />
                    </ControlButton>
                    <span className="text-xs font-mono text-gray-300 w-12 text-center">{props.playbackRate.toFixed(2)}x</span>
                    <ControlButton onClick={() => props.onChangeRate(0.1)} title="Augmentar velocitat">
                        <PlusIcon className="w-4 h-4" />
                    </ControlButton>
                </div>

                <div className="flex items-center group/vol relative">
                    <button onClick={toggleMute} title={isMuted ? 'Activar so' : 'Silenciar'} className="p-2 text-gray-400 hover:text-white">
                        {isMuted || volume === 0 ? <VolumeMuteIcon className="w-5 h-5" /> : <VolumeHighIcon className="w-5 h-5" />}
                    </button>
                    <div className="w-0 overflow-hidden group-hover/vol:w-24 transition-all duration-200 ease-in-out flex items-center ml-1">
                        <input
                            type="range" min="0" max="1" step="0.05"
                            value={isMuted ? 0 : volume}
                            onChange={handleVolumeChange}
                            className="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                            style={{ accentColor: 'var(--th-accent)' }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};