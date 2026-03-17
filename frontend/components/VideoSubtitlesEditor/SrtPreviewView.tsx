import React, { useState, useMemo } from 'react';
import { Document } from '../../types';
import { parseSrt } from '../../utils/SubtitlesEditor/srtParser';
import { useLibrary } from '../../context/Library/LibraryContext';
import * as Icons from '../icons';

interface SrtPreviewViewProps {
  currentDoc: Document;
  onClose: () => void;
}

/**
 * Vista de previsualització per a fitxers SRT.
 * Mostra únicament els subtítols en mode lectura (sense vídeo, sense waveform, sense editor).
 */
const SrtPreviewView: React.FC<SrtPreviewViewProps> = ({ currentDoc, onClose }) => {
  const { state } = useLibrary();
  const [filter, setFilter] = useState('');

  const segments = useMemo(() => {
    const raw = currentDoc.content || '';
    if (!raw.trim()) return [];
    return parseSrt(raw);
  }, [currentDoc.content]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return segments;
    const q = filter.toLowerCase();
    return segments.filter(s =>
      (s.originalText || '').toLowerCase().includes(q)
    );
  }, [segments, filter]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0b1120]">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-gray-700/50 bg-gray-900/60 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            title="Tancar"
          >
            <Icons.ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-sm font-black text-white truncate">{currentDoc.name}</h2>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Vista prèvia SRT · {segments.length} subtítols
            </span>
          </div>
        </div>

        {/* Search filter */}
        <div className="relative w-64">
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filtrar subtítols..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </header>

      {/* Subtitle list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        {segments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Icons.SubtitlesIcon className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-bold">El fitxer SRT és buit</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p className="text-sm font-bold">Cap subtítol coincideix amb el filtre</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-1">
            {filtered.map((seg) => (
              <div
                key={seg.id}
                className="group flex gap-3 px-4 py-2.5 rounded-lg hover:bg-gray-800/60 transition-colors border border-transparent hover:border-gray-700/30"
              >
                {/* Cue number */}
                <div className="flex-shrink-0 w-8 text-right">
                  <span className="text-[10px] font-mono font-bold text-gray-600 group-hover:text-gray-400 tabular-nums">
                    {seg.id}
                  </span>
                </div>

                {/* Timecodes */}
                <div className="flex-shrink-0 w-[200px]">
                  <span className="text-[11px] font-mono text-blue-400/70 group-hover:text-blue-400 tabular-nums">
                    {seg.start} → {seg.end}
                  </span>
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
                    {seg.originalText || seg.richText || ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer status bar */}
      <footer className="flex-shrink-0 px-5 py-2 border-t border-gray-800/50 bg-gray-900/40 flex items-center justify-between text-[10px] font-bold text-gray-600 uppercase tracking-widest">
        <span>{filtered.length} / {segments.length} subtítols</span>
        <span>Només lectura</span>
      </footer>
    </div>
  );
};

export default SrtPreviewView;
