import React, { useState, useRef, useCallback } from 'react';
import VideoPlayer from '../VideoEditor/VideoPlayer';
import WaveformTimeline from '../VideoEditor/WaveformTimeline';
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
    mediaDocId?: string | null;
    onSegmentUpdate?: (id: Id, newStart: number, newEnd: number) => void;
    onSegmentClick?: (id: Id) => void;
}

const MIN_PANEL_HEIGHT = 80;

export const VideoPlaybackAreaWithSubs: React.FC<VideoPlaybackAreaProps> = (props) => {
    // Sincronitzem l'alçada inicial a 250px per defecte
    const [topPanelHeight, setTopPanelHeight] = useState(250);
    const containerRef = useRef<HTMLDivElement>(null);
    const isResizingRef = useRef(false);
    const startYRef = useRef(0);
    const startHeightRef = useRef(0);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizingRef.current || !containerRef.current) return;
        const deltaY = e.clientY - startYRef.current;
        const containerHeight = containerRef.current.offsetHeight;
        let newHeight = startHeightRef.current + deltaY;

        const separatorHeight = 12;
        newHeight = Math.max(MIN_PANEL_HEIGHT, newHeight);
        newHeight = Math.min(containerHeight - MIN_PANEL_HEIGHT - separatorHeight, newHeight);

        setTopPanelHeight(newHeight);
    }, []);

    const handleMouseUp = useCallback(() => {
        isResizingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
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

    return (
        <div 
            ref={containerRef} 
            className="flex flex-col h-full w-full bg-black relative group/droparea"
            data-droptarget="true"
            data-drop-action="link-media"
        >
             {/* Visual feedback for library dragging */}
             <div className="absolute inset-0 z-50 pointer-events-none border-4 border-dashed border-emerald-500/50 bg-emerald-600/10 flex items-center justify-center opacity-0 group-[.drop-hover]/droparea:opacity-100 transition-opacity duration-200">
                <div className="bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex flex-col items-center gap-2 scale-110">
                    <span className="text-3xl">🎬</span>
                    <span className="text-sm font-black uppercase tracking-widest">Vincular Vídeo / Àudio</span>
                </div>
            </div>

            <div className="flex-shrink-0 w-full" style={{ height: `${topPanelHeight}px` }}>
                <VideoPlayer {...props} />
            </div>

            <div
                className="flex-shrink-0 h-3 cursor-row-resize flex items-center justify-center group"
                style={{ backgroundColor: 'var(--th-bg-primary)' }}
                onMouseDown={handleMouseDown}
            >
                <div className="w-10 h-1 group-hover:bg-gray-600 rounded-full" style={{ backgroundColor: 'var(--th-bg-tertiary)' }} />
            </div>

            <div className="flex-grow min-h-0 w-full">
                <WaveformTimeline {...props} />
            </div>
        </div>
    );
};