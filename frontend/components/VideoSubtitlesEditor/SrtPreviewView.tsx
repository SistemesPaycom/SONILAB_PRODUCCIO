import React, { useState, useMemo } from 'react';
import { Document } from '../../types';
import { parseSrt, secondsToSrtTime } from '../../utils/SubtitlesEditor/srtParser';
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
    // SRT content is stored in contentByLang._unassigned (backend field)
    const raw =
      (currentDoc as any).contentByLang?._unassigned ||
      (currentDoc as any).contentByLang?.raw ||
      (currentDoc as any).content ||
      '';
    if (!raw.trim()) return [];
    return parseSrt(raw);
  }, [(currentDoc as any).contentByLang, (currentDoc as any).content]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return segments;
    const q = filter.toLowerCase();
    return segments.filter(s =>
      (s.originalText || '').toLowerCase().includes(q)
    );
  }, [segments, filter]);

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ backgroundColor: 'var(--th-bg-app)' }}>
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-5 py-3 backdrop-blur-md" style={{ backgroundColor: 'var(--th-header-bg)', borderBottom: '1px solid var(--th-border)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: 'var(--th-text-secondary)' }}
            title="Tancar"
          >
            <Icons.ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-sm font-black truncate" style={{ color: 'var(--th-text-primary)' }}>{currentDoc.name}</h2>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--th-text-muted)' }}>
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
            className="w-full rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1"
            style={{ backgroundColor: 'var(--th-bg-tertiary)', border: '1px solid var(--th-border)', color: 'var(--th-text-primary)', '--tw-ring-color': 'var(--th-focus-ring)' } as any}
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
              style={{ color: 'var(--th-text-muted)' }}
            >
              ✕
            </button>
          )}
        </div>
      </header>

      {/* Subtitle list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        {segments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--th-text-muted)' }}>
            <Icons.SubtitlesIcon className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-bold">El fitxer SRT és buit</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--th-text-muted)' }}>
            <p className="text-sm font-bold">Cap subtítol coincideix amb el filtre</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((seg) => {
              const textLines = (seg.originalText || seg.richText || '').split('\n');
              const line1 = textLines[0] || '';
              const line2 = textLines.slice(1).join('\n');
              return (
                <div
                  key={seg.id}
                  className="group flex items-start px-3 py-2 rounded-lg transition-colors"
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--th-editor-row-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                >
                  {/* Col 1: Cue number — fixed width */}
                  <div className="flex-shrink-0 text-right pt-[3px]" style={{ width: '32px' }}>
                    <span className="text-[11px] font-mono font-bold tabular-nums" style={{ color: 'var(--th-text-muted)', opacity: 0.5 }}>
                      {seg.id}
                    </span>
                  </div>

                  {/* Col 2+3 grid */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1 ml-3">
                    {/* Row 1: TC IN badge + line1 */}
                    <div className="flex items-center">
                      <div
                        className="flex-shrink-0 flex items-center justify-center font-mono tabular-nums font-semibold rounded"
                        style={{
                          width: '134px',
                          height: '22px',
                          fontSize: '11px',
                          lineHeight: '22px',
                          backgroundColor: 'var(--th-accent)',
                          color: '#FFFFFF',
                        }}
                      >{secondsToSrtTime(seg.startTime)}</div>
                      <span className="flex-1 min-w-0 truncate ml-3" style={{ fontSize: '13px', lineHeight: '22px', color: 'var(--th-editor-text)' }}>
                        {line1}
                      </span>
                    </div>
                    {/* Row 2: TC OUT badge + line2 */}
                    <div className="flex items-center">
                      <div
                        className="flex-shrink-0 flex items-center justify-center font-mono tabular-nums rounded"
                        style={{
                          width: '134px',
                          height: '22px',
                          fontSize: '11px',
                          lineHeight: '22px',
                          backgroundColor: 'var(--th-bg-tertiary)',
                          color: 'var(--th-editor-timecode)',
                          border: '1px solid var(--th-border-subtle)',
                        }}
                      >{secondsToSrtTime(seg.endTime)}</div>
                      {line2 ? (
                        <span className="flex-1 min-w-0 truncate ml-3" style={{ fontSize: '12px', lineHeight: '22px', color: 'var(--th-editor-text)', opacity: 0.7 }}>
                          {line2}
                        </span>
                      ) : (
                        <span className="flex-1 ml-3" style={{ height: '22px' }}>{'\u00A0'}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer status bar */}
      <footer className="flex-shrink-0 px-5 py-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest" style={{ borderTop: '1px solid var(--th-border)', backgroundColor: 'var(--th-header-bg)', color: 'var(--th-text-muted)' }}>
        <span>{filtered.length} / {segments.length} subtítols</span>
        <span>Només lectura</span>
      </footer>
    </div>
  );
};

export default SrtPreviewView;
