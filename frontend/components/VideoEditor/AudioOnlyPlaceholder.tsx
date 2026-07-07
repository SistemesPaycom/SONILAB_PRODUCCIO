import React from 'react';

/**
 * Overlay absolut que indica que el media no té pista de vídeo.
 * S'ha de col·locar dins d'un contenidor amb `position: relative`.
 */
export const AudioOnlyPlaceholder: React.FC = () => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
    <span
      className="text-xs font-medium tracking-widest uppercase select-none"
      style={{ color: 'rgba(255,255,255,0.18)' }}
    >
      no video
    </span>
  </div>
);
