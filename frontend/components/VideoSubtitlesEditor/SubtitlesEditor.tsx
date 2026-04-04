import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { Segment, GeneralConfig } from '../../types/Subtitles';
import { OverlayConfig } from '../../types';
import SegmentItem from './SegmentItem';
import { EyeIcon, EyeOffIcon, EarIcon, Languages } from '../icons';
import { LinkIcon, LinkOffIcon } from '../VideoEditor/PlayerIcons';
import { SubtitleEditorProvider, useSubtitleEditor } from '../../context/SubtitleEditorContext';
import { useVirtualizer } from '@tanstack/react-virtual';

interface PendingCorrectionEntry {
  proposed: string;
  original: string;
  change: any;
}

interface SubtitlesEditorProps {
  title: string;
  segments: Segment[];
  activeId: number | null;
  isEditable: boolean;
  onSegmentChange: (segment: Segment) => void;
  onSegmentBlur: () => void;
  onSegmentClick: (id: number) => void;
  onSegmentFocus: (id: number) => void;
  onSplit?: (id: number) => void;
  onMerge?: (id: number) => void;
  onInsert?: (id: number, position: 'before' | 'after') => void;
  onDelete?: (id: number) => void;
  syncEnabled: boolean;
  onSyncChange: (enabled: boolean) => void;
  overlayConfig: OverlayConfig;
  onOverlayConfigChange: (config: OverlayConfig) => void;
  generalConfig: GeneralConfig;
  /** Marge mínim entre subtítols a l'editor (ms) — preferència d'usuari */
  editorMinGapMs?: number;
  onEditorMinGapMsChange?: (ms: number) => void;
  autoScroll: boolean;
  onOpenAIOperations: (mode: 'whisper' | 'translate' | 'revision') => void;
  /** Conjunt d'índexs de segments corregits i acceptats (rose background, 30s) */
  correctionHighlightIds?: Set<number>;
  /** Correccions pendents de revisió inline (amber, per segment) */
  pendingCorrections?: Map<number, PendingCorrectionEntry>;
  onAcceptCorrection?: (id: number) => void;
  onRejectCorrection?: (id: number) => void;
  onAcceptAllCorrections?: () => void;
  onRejectAllCorrections?: () => void;
  /** Propostes d'inserció de nous subtítols (propose_new_cue) */
  pendingInsertions?: any[];
  onAcceptInsertion?: (change: any) => void;
  onRejectInsertion?: (change: any) => void;
}

const SubtitlesEditorInner: React.FC<SubtitlesEditorProps> = ({
  title,
  segments,
  activeId,
  isEditable,
  onSegmentChange,
  onSegmentBlur,
  onSegmentClick,
  onSegmentFocus,
  onSplit,
  onMerge,
  onInsert,
  onDelete,
  syncEnabled,
  onSyncChange,
  overlayConfig,
  onOverlayConfigChange,
  generalConfig,
  editorMinGapMs,
  onEditorMinGapMsChange,
  autoScroll,
  onOpenAIOperations,
  correctionHighlightIds,
  pendingCorrections,
  onAcceptCorrection,
  onRejectCorrection,
  onAcceptAllCorrections,
  onRejectAllCorrections,
  pendingInsertions,
  onAcceptInsertion,
  onRejectInsertion,
}) => {
  const { caretHintRef } = useSubtitleEditor();
  const [formatState, setFormatState] = useState({ bold: false, italic: false, underline: false });
  const [insertionsCollapsed, setInsertionsCollapsed] = useState(false);

  // Throttle selectionchange: queryCommandState fuerza style recalc.
  // Limitem a 1 update per 200ms per evitar layout thrashing.
  useEffect(() => {
    let rafId = 0;
    let lastUpdate = 0;
    const updateFormatButtons = () => {
      const now = performance.now();
      if (now - lastUpdate < 200) return;
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        lastUpdate = performance.now();
        setFormatState({
          bold: document.queryCommandState('bold'),
          italic: document.queryCommandState('italic'),
          underline: document.queryCommandState('underline')
        });
      });
    };

    document.addEventListener('selectionchange', updateFormatButtons);
    return () => {
      document.removeEventListener('selectionchange', updateFormatButtons);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  const handleFormatAction = (command: string) => {
    if (!isEditable) return;
    document.execCommand(command, false);
  };

  const handleNavigate = useCallback((direction: 'next' | 'prev', currentId: number) => {
    const idx = segments.findIndex(s => s.id === currentId);
    if (direction === 'next' && idx < segments.length - 1) {
        const nextId = segments[idx + 1].id as number;
        caretHintRef.current = {
            segmentId: nextId,
            target: 'first',
            where: 'end',
            ts: Date.now(),
            retries: 3
        };
        onSegmentClick(nextId);
    } else if (direction === 'prev' && idx > 0) {
        const prevId = segments[idx - 1].id as number;
        caretHintRef.current = {
            segmentId: prevId,
            target: 'lastNonEmpty',
            where: 'end',
            ts: Date.now(),
            retries: 3
        };
        onSegmentClick(prevId);
    }
  }, [segments, onSegmentClick, caretHintRef]);

  // Callbacks estables per a onInsert — eviten crear arrow functions noves a cada render
  const handleInsertBefore = useCallback((id: number) => onInsert?.(id, 'before'), [onInsert]);
  const handleInsertAfter = useCallback((id: number) => onInsert?.(id, 'after'), [onInsert]);

  // ── Virtual scroll ──
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: segments.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 90, // ~90px per segment row
    overscan: 5,
  });

  const virtualContainerRef = useRef<HTMLDivElement>(null);

  // Sync the virtual container's width to the scroll container's scrollWidth.
  // Absolute-positioned virtual items don't contribute to the parent's width
  // calculation, so the container stays viewport-width while content overflows.
  // By reading scrollWidth (which includes overflow) and applying it as minWidth,
  // all items (width: 100%) and their borders extend to the full scrollable width.
  const virtualItems = virtualizer.getVirtualItems();
  useLayoutEffect(() => {
    const scrollEl = scrollContainerRef.current;
    const vcEl = virtualContainerRef.current;
    if (!scrollEl || !vcEl) return;
    // Reset to auto first so scrollWidth reflects true content width
    vcEl.style.minWidth = '100%';
    // Read the true scrollable width (includes grid overflow)
    requestAnimationFrame(() => {
      const sw = scrollEl.scrollWidth;
      if (sw > 0) {
        vcEl.style.minWidth = sw + 'px';
      }
    });
  }, [virtualItems.length, segments]);

  // Auto-scroll to active segment via virtualizer
  useEffect(() => {
    if (activeId == null || !autoScroll) return;
    const idx = segments.findIndex(s => s.id === activeId);
    if (idx >= 0) {
      virtualizer.scrollToIndex(idx, { align: 'center', behavior: 'smooth' });
    }
  }, [activeId, autoScroll, segments, virtualizer]);

  return (
    <div 
        className="h-full flex flex-col text-gray-300 relative group/droparea"
        style={{ backgroundColor: 'var(--th-bg-primary)' }}
        data-droptarget="true"
        data-drop-action="link-subs"
    >
      <div className="absolute inset-0 z-50 pointer-events-none border-4 border-dashed border-emerald-500/50 bg-emerald-600/10 flex items-center justify-center opacity-0 group-[.drop-hover]/droparea:opacity-100 transition-opacity duration-200">
        <div className="bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex flex-col items-center gap-2 scale-110">
            <span className="text-3xl">🗒️</span>
            <span className="text-sm font-black uppercase tracking-widest">Vincular Subtítols (SRT)</span>
        </div>
      </div>

      <header className="flex-shrink-0 flex flex-col border-b border-[var(--th-border)] backdrop-blur-md" style={{ backgroundColor: 'var(--th-header-bg)' }}>
        {/* Barra de propostes d'inserció (propose_new_cue) */}
        {pendingInsertions && pendingInsertions.length > 0 && (
          <div className="flex flex-col px-3 py-1.5 bg-violet-950/50 border-b border-violet-700/40 gap-1">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setInsertionsCollapsed(v => !v)}
                className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-violet-300 hover:text-violet-100 transition-colors"
              >
                <span className={`transition-transform ${insertionsCollapsed ? '' : 'rotate-90'}`}>▶</span>
                + {pendingInsertions.length} {pendingInsertions.length === 1 ? 'nou subtítol proposat' : 'nous subtítols proposats'}
              </button>
              <div className="flex gap-1.5">
                <button
                  onClick={() => pendingInsertions.forEach(ins => onRejectInsertion?.(ins))}
                  className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-red-900/50 hover:bg-red-700/70 text-red-300 transition-colors"
                >
                  ✗ Rebutjar totes
                </button>
                <button
                  onClick={() => pendingInsertions.forEach(ins => onAcceptInsertion?.(ins))}
                  className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-900/50 hover:bg-emerald-700/70 text-emerald-300 transition-colors"
                >
                  ✓ Acceptar totes
                </button>
              </div>
            </div>
            {!insertionsCollapsed && (
              <div className="max-h-[150px] overflow-y-auto custom-scrollbar flex flex-col gap-1">
                {pendingInsertions.map((ins, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-2 rounded-lg bg-violet-900/30 px-2 py-1 border border-violet-600/30">
                    <div className="flex-1 min-w-0">
                      <span className="text-[8px] font-bold text-violet-400 uppercase tracking-widest mr-1">
                        [{ins.guion_speaker}]
                      </span>
                      <span className="text-[10px] text-violet-100 break-words">{ins.corrected}</span>
                      <span className="block text-[8px] text-violet-500 mt-0.5">{ins.start} → {ins.end}</span>
                    </div>
                    <div className="flex gap-1 flex-shrink-0 mt-0.5">
                      <button
                        onClick={() => onRejectInsertion?.(ins)}
                        className="px-1.5 py-0.5 rounded text-[9px] font-black bg-red-900/50 hover:bg-red-700/70 text-red-300 transition-colors"
                      >✗</button>
                      <button
                        onClick={() => onAcceptInsertion?.(ins)}
                        className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-900/50 hover:bg-emerald-700/70 text-emerald-300 transition-colors"
                      >✓</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Barra de correccions pendents (inline review) */}
        {pendingCorrections && pendingCorrections.size > 0 && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-amber-950/50 border-b border-amber-700/40">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-amber-300">
                ✦ {pendingCorrections.size} {pendingCorrections.size === 1 ? 'correcció pendent' : 'correccions pendents'}
              </span>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={onRejectAllCorrections}
                className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-red-900/50 hover:bg-red-700/70 text-red-300 transition-colors"
              >
                ✗ Rebutjar totes
              </button>
              <button
                onClick={onAcceptAllCorrections}
                className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-900/50 hover:bg-emerald-700/70 text-emerald-300 transition-colors"
              >
                ✓ Acceptar totes
              </button>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between p-2">
            <h3 className="font-black text-[10px] uppercase tracking-widest ml-2" style={{ color: 'var(--th-editor-meta)' }}>{title}</h3>
            
            <div className="flex items-center gap-1.5 px-2">
                <button 
                    onClick={() => onOpenAIOperations('whisper')}
                    className="p-1.5 rounded-lg bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all"
                    title="Whisper (Àudio local)"
                >
                    <EarIcon size={16} />
                </button>

                <button 
                    onClick={() => onOpenAIOperations('translate')}
                    className="p-1.5 rounded-lg bg-violet-600/10 text-violet-400 hover:bg-violet-600 hover:text-white transition-all"
                    title="Traduir amb IA (Qwen)"
                >
                    <Languages size={16} />
                </button>

                <button 
                    onClick={() => onOpenAIOperations('revision')}
                    className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all font-black text-sm"
                    title="Revisar coherència (R)"
                >
                    R
                </button>

                <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--th-bg-tertiary)' }} />

                <button
                    title="Mostrar subtítols sobre el vídeo"
                    onClick={() => onOverlayConfigChange({ ...overlayConfig, show: !overlayConfig.show })}
                    className={`p-1.5 rounded transition-colors ${overlayConfig.show ? '' : 'text-gray-500 hover:bg-white/10'}`}
                    style={overlayConfig.show ? { color: 'var(--th-accent-text)', backgroundColor: 'var(--th-accent-muted)' } : undefined}
                >
                    {overlayConfig.show ? <EyeIcon className="w-4 h-4" /> : <EyeOffIcon className="w-4 h-4" />}
                </button>

                {/* Font scale control for subtitle overlay */}
                {overlayConfig.show && (
                  <div className="flex items-center gap-0.5 ml-0.5" title="Mida màxima subtítols sobre vídeo">
                    <button
                      onClick={() => onOverlayConfigChange({ ...overlayConfig, fontScale: Math.max(0.5, (overlayConfig.fontScale || 1) - 0.1) })}
                      className="p-1 rounded text-gray-400 hover:bg-white/10 text-[10px] font-bold leading-none"
                    >A↓</button>
                    <span className="text-[10px] font-mono text-gray-400 w-7 text-center select-none">
                      {((overlayConfig.fontScale || 1) * 100).toFixed(0)}%
                    </span>
                    <button
                      onClick={() => onOverlayConfigChange({ ...overlayConfig, fontScale: Math.min(2.0, (overlayConfig.fontScale || 1) + 0.1) })}
                      className="p-1 rounded text-gray-400 hover:bg-white/10 text-[10px] font-bold leading-none"
                    >A↑</button>
                  </div>
                )}
              
                <button 
                    title={syncEnabled ? "Desactivar sincronització" : "Activar sincronització"}
                    onClick={() => onSyncChange(!syncEnabled)}
                    className={`p-1.5 rounded transition-colors ${syncEnabled ? '' : 'text-gray-500 hover:bg-white/10'}`}
                    style={syncEnabled ? { color: 'var(--th-accent-text)', backgroundColor: 'var(--th-accent-muted)' } : undefined}
                >
                    {syncEnabled ? <LinkIcon className="w-4 h-4" /> : <LinkOffIcon className="w-4 h-4" />}
                </button>

                <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--th-bg-tertiary)' }} />

                <div className="flex items-center gap-1">
                    <button
                        onMouseDown={(e) => { e.preventDefault(); handleFormatAction('bold'); }}
                        className={`w-7 h-7 rounded flex items-center justify-center text-xs font-black transition-colors ${formatState.bold ? 'shadow-sm' : 'hover:bg-white/10'}`}
                        style={formatState.bold ? { backgroundColor: 'var(--th-accent)', color: 'var(--th-text-inverse)' } : { color: 'var(--th-editor-meta)' }}
                        title="Negreta (Ctrl+B)"
                    >B</button>
                    <button
                        onMouseDown={(e) => { e.preventDefault(); handleFormatAction('italic'); }}
                        className={`w-7 h-7 rounded flex items-center justify-center text-xs italic font-serif transition-colors ${formatState.italic ? 'shadow-sm' : 'hover:bg-white/10'}`}
                        style={formatState.italic ? { backgroundColor: 'var(--th-accent)', color: 'var(--th-text-inverse)' } : { color: 'var(--th-editor-meta)' }}
                        title="Cursiva (Ctrl+I)"
                    >I</button>
                    <button
                        onMouseDown={(e) => { e.preventDefault(); handleFormatAction('underline'); }}
                        className={`w-7 h-7 rounded flex items-center justify-center text-xs underline transition-colors ${formatState.underline ? 'shadow-sm' : 'hover:bg-white/10'}`}
                        style={formatState.underline ? { backgroundColor: 'var(--th-accent)', color: 'var(--th-text-inverse)' } : { color: 'var(--th-editor-meta)' }}
                        title="Subratllat (Ctrl+U)"
                    >U</button>
                </div>

            </div>
        </div>
      </header>

      <div ref={scrollContainerRef} className="flex-grow overflow-auto custom-scrollbar">
        {segments.length > 0 ? (
          <div
            ref={virtualContainerRef}
            style={{
              height: virtualizer.getTotalSize(),
              minWidth: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const segment = segments[virtualRow.index];
              const idx = virtualRow.index;
              return (
                <div
                  key={segment.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <SegmentItem
                    segment={segment}
                    isActive={activeId === segment.id}
                    isEditable={isEditable}
                    isCorrected={correctionHighlightIds?.has(segment.id as number)}
                    proposedText={pendingCorrections?.get(segment.id as number)?.proposed}
                    onAccept={onAcceptCorrection}
                    onReject={onRejectCorrection}
                    onChange={onSegmentChange}
                    onBlur={onSegmentBlur}
                    onClick={onSegmentClick}
                    onFocus={onSegmentFocus}
                    onSplit={onSplit}
                    onModifyMerge={idx < segments.length - 1 ? onMerge : undefined}
                    onInsertBefore={onInsert ? handleInsertBefore : undefined}
                    onInsertAfter={onInsert ? handleInsertAfter : undefined}
                    onDelete={segments.length > 1 ? onDelete : undefined}
                    generalConfig={generalConfig}
                    autoScroll={false}
                    onNavigate={handleNavigate}
                  />
                </div>
              );
            })}
          </div>
        ) : (
            <div className="flex items-center justify-center h-full text-gray-500 italic text-sm p-10 text-center">
                Prems el botó "Vincular" o les eines d'IA per començar.
            </div>
        )}
      </div>
    </div>
  );
};

// SubtitlesEditor requiere SubtitleEditorProvider en un component pare (VideoSubtitlesEditorView / VideoSrtStandaloneEditorView).
const SubtitlesEditor: React.FC<SubtitlesEditorProps> = React.memo((props) => (
  <SubtitlesEditorInner {...props} />
));

export default SubtitlesEditor;