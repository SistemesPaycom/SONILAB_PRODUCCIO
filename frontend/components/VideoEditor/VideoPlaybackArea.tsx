import React from 'react';
import VideoPlayer from './VideoPlayer';
import { Segment, OverlayConfig, Id } from '../../types';

interface VideoPlaybackAreaProps {
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
    videoFile: File | null;
    // Waveform-passthrough props (unused here, live at bottom waveform)
    onSegmentUpdate?: (id: Id, newStart: number, newEnd: number) => void;
    onSegmentUpdateEnd?: () => void;
    onSegmentClick?: (id: Id) => void;
    autoScroll?: boolean;
    scrollMode?: 'stationary' | 'page';
}

export const VideoPlaybackArea: React.FC<VideoPlaybackAreaProps> = (props) => {
    return (
        <div
            className="flex flex-col h-full w-full bg-black relative group/droparea"
            data-droptarget="true"
            data-drop-action="link-media"
        >
            {/* Drop overlay */}
            <div className="absolute inset-0 z-50 pointer-events-none border-4 border-dashed border-blue-500/50 bg-blue-600/10 flex items-center justify-center opacity-0 group-[.drop-hover]/droparea:opacity-100 transition-opacity duration-200">
                <div className="bg-blue-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex flex-col items-center gap-2 scale-110">
                    <span className="text-3xl">🎬</span>
                    <span className="text-sm font-black uppercase tracking-widest">Vincular Vídeo / Àudio</span>
                </div>
            </div>

            <div className="flex-grow min-h-0 w-full">
                <VideoPlayer {...props} />
            </div>
        </div>
    );
};
