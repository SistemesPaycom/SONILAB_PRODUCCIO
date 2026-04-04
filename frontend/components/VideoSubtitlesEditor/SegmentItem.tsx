import React, { useRef, useLayoutEffect, useEffect, useMemo, useCallback } from 'react';
import { Segment, GeneralConfig } from '../../types/Subtitles';
import * as TextMetrics from '../../utils/SubtitlesEditor/textMetrics';
import * as RichText from '../../utils/SubtitlesEditor/richTextHelpers';
import useLocalStorage from '../../hooks/useLocalStorage';
import { LOCAL_STORAGE_KEYS } from '../../constants';
import { TimecodeInput } from './TimecodeInput';
import { useSubtitleEditor } from '../../context/SubtitleEditorContext';

interface SegmentItemProps {
  segment: Segment;
  isActive: boolean;
  isEditable: boolean;
  /** Indica que el segment ha estat corregit i acceptat pel pipeline de correcció de guió */
  isCorrected?: boolean;
  /** Text proposat per la correcció pendent de revisió inline (amber) */
  proposedText?: string;
  /** Acceptar la correcció proposada (rep l'ID del segment) */
  onAccept?: (id: number) => void;
  /** Rebutjar la correcció proposada (rep l'ID del segment) */
  onReject?: (id: number) => void;
  onClick: (id: number) => void;
  onFocus: (id: number) => void;
  onBlur?: () => void;
  onChange: (updated: Segment) => void;
  onSplit?: (id: number) => void;
  onModifyMerge?: (id: number) => void;
  onInsertBefore?: (id: number) => void;
  onInsertAfter?: (id: number) => void;
  onDelete?: (id: number) => void;
  generalConfig: GeneralConfig;
  autoScroll?: boolean;
  onNavigate?: (direction: 'next' | 'prev', currentId: number) => void;
}

const placeCaret = (el: HTMLElement, where: 'start' | 'end') => {
  try {
    (el as any).focus?.({ preventScroll: true });
  } catch {
    el.focus();
  }

  const sel = window.getSelection();
  if (!sel) return;

  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(where === 'start');
  sel.removeAllRanges();
  sel.addRange(range);
};

const SegmentItem: React.FC<SegmentItemProps> = ({
  segment,
  isActive,
  isEditable,
  isCorrected = false,
  proposedText,
  onAccept,
  onReject,
  onClick,
  onFocus,
  onBlur,
  onChange,
  onSplit,
  onModifyMerge,
  onInsertBefore,
  onInsertAfter,
  onDelete,
  generalConfig,
  autoScroll = true,
  onNavigate,
}) => {
  const { caretHintRef, splitPayloadRef } = useSubtitleEditor();
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [gridOpacity] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.SUB_GRID_OPACITY, 0);

  const contentLines = useMemo(() => (segment.originalText || '').split('\n'), [segment.originalText]);

  const maxLines = useMemo(() => {
    const maxCfg = generalConfig.maxLinesPerSubtitle || 1;
    return Math.max(maxCfg, contentLines.length);
  }, [generalConfig.maxLinesPerSubtitle, contentLines.length]);

  const duration = segment.endTime - segment.startTime;
  const ROW_HEIGHT = '24px';
  
  const gridCellStyle: React.CSSProperties = {
    borderWidth: gridOpacity > 0 ? '1px' : '0px',
    borderStyle: 'dashed',
    borderColor: `rgba(150, 150, 150, ${gridOpacity})`,
  };

  const maxCharsPerLine = generalConfig.maxCharsPerLine ?? 40;

  const getLinePlain = (el: HTMLElement | null) => {
    if (!el) return '';
    return RichText.richToPlain(el.innerHTML ?? '')
      .replace(/\u00A0/g, ' ')
      .replace(/\n+/g, ' ')
      .trim();
  };

  const isLineNonEmpty = useCallback(
    (lineIdx: number) => {
      const el = lineRefs.current.get(lineIdx);
      return getLinePlain(el || null).length > 0;
    },
    [segment.id]
  );

  const isCaretAtStart = (lineEl: HTMLElement): boolean => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    const r = sel.getRangeAt(0);
    if (!r.collapsed) return false;

    const pre = document.createRange();
    pre.selectNodeContents(lineEl);
    pre.setEnd(r.startContainer, r.startOffset);
    return pre.toString().length === 0;
  };

  const syncEditorsToState = useCallback(() => {
    const plainLines: string[] = [];
    for (let i = 0; i < maxLines; i++) {
      plainLines.push(getLinePlain(lineRefs.current.get(i) || null));
    }

    let last = -1;
    for (let i = plainLines.length - 1; i >= 0; i--) {
      if (plainLines[i].length > 0) {
        last = i;
        break;
      }
    }

    const combined = last >= 0 ? plainLines.slice(0, last + 1).join('\n') : '';
    if (combined !== (segment.originalText || '')) {
      onChange({ ...segment, originalText: combined, richText: '' });
    }
  }, [maxLines, onChange, segment, segment.originalText]);

  const resolveHintIndex = useCallback(
    (target: 'first' | 'lastNonEmpty' | number) => {
      if (typeof target === 'number') return Math.max(0, Math.min(target, maxLines - 1));
      if (target === 'first') return 0;

      for (let i = maxLines - 1; i >= 0; i--) {
        if (isLineNonEmpty(i)) return i;
      }
      return 0;
    },
    [isLineNonEmpty, maxLines]
  );

  const performSplitAtCaret = useCallback(
    (activeLineIndex: number) => {
      if (!onSplit) return;

      const activeEl = lineRefs.current.get(activeLineIndex);
      const sel = window.getSelection();
      if (!activeEl || !sel || sel.rangeCount === 0) return;

      if (!activeEl.contains(sel.anchorNode)) return;

      const caretRange = sel.getRangeAt(0);

      const headRange = document.createRange();
      headRange.selectNodeContents(activeEl);
      headRange.setEnd(caretRange.startContainer, caretRange.startOffset);

      const tailRange = document.createRange();
      tailRange.selectNodeContents(activeEl);
      tailRange.setStart(caretRange.startContainer, caretRange.startOffset);

      const headWrap = document.createElement('div');
      headWrap.appendChild(headRange.cloneContents());
      const tailWrap = document.createElement('div');
      tailWrap.appendChild(tailRange.cloneContents());

      const headMarkup = RichText.richToPlain(headWrap.innerHTML).replace(/\n+/g, ' ').trimEnd();
      const tailMarkup = RichText.richToPlain(tailWrap.innerHTML).replace(/\n+/g, ' ').trimEnd();

      const fullMarkupLines: string[] = [];
      for (let i = 0; i < maxLines; i++) {
        const el = lineRefs.current.get(i);
        fullMarkupLines.push(RichText.richToPlain(el?.innerHTML ?? '').replace(/\n+/g, ' ').trimEnd());
      }

      const leftLines = [...fullMarkupLines.slice(0, activeLineIndex), headMarkup];

      const tailIsEmpty = tailMarkup.trim().length === 0;
      const rightLines = tailIsEmpty
        ? [...fullMarkupLines.slice(activeLineIndex + 1)]
        : [tailMarkup, ...fullMarkupLines.slice(activeLineIndex + 1)];

      const trimTrailing = (arr: string[]) => {
        let end = arr.length - 1;
        while (end >= 0 && !arr[end].trim()) end--;
        return arr.slice(0, end + 1);
      };

      const leftText = trimTrailing(leftLines).join('\n');
      const rightText = trimTrailing(rightLines).join('\n');

      const strip = (s: string) => TextMetrics.stripSrtTags(s || '');
      const totalChars = fullMarkupLines.reduce((acc, l) => acc + strip(l).length, 0);
      const charsBefore =
        fullMarkupLines.slice(0, activeLineIndex).reduce((acc, l) => acc + strip(l).length, 0) +
        strip(headMarkup).length;

      splitPayloadRef.current = {
        id: segment.id,
        leftText,
        rightText,
        splitRatio: totalChars > 0 ? charsBefore / totalChars : 0.5,
      };

      caretHintRef.current = {
        segmentId: segment.id,
        target: activeLineIndex,
        where: 'end',
        ts: Date.now(),
        retries: 3,
      };

      onSplit(segment.id);
    },
    [maxLines, onSplit, segment.id]
  );

  const handleKeyDownForLine = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isEditable) return;

    const lineIndex = parseInt((e.currentTarget as HTMLElement).dataset.lineIndex || '0', 10);

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      e.stopPropagation();
      performSplitAtCaret(lineIndex);
      return;
    }

    if (e.key === 'Backspace') {
      const cur = lineRefs.current.get(lineIndex);
      if (cur && isCaretAtStart(cur)) {
        e.preventDefault();

        if (lineIndex > 0) {
          const prev = lineRefs.current.get(lineIndex - 1);
          if (prev) {
            const curHtml = cur.innerHTML;
            const prevPlain = getLinePlain(prev);
            const curPlain = getLinePlain(cur);

            prev.innerHTML += prevPlain.length > 0 && curPlain.length > 0 ? `&nbsp;${curHtml}` : curHtml;

            for (let j = lineIndex; j < maxLines - 1; j++) {
              const nextEl = lineRefs.current.get(j + 1);
              const curEl = lineRefs.current.get(j);
              if (curEl && nextEl) curEl.innerHTML = nextEl.innerHTML;
            }
            const lastEl = lineRefs.current.get(maxLines - 1);
            if (lastEl) lastEl.innerHTML = '';

            placeCaret(prev, 'end');
            syncEditorsToState();
          }
        }
        return;
      }
    }

    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      const dir = e.shiftKey ? 'prev' : 'next';
      let moved = false;

      if (dir === 'next') {
        for (let i = lineIndex + 1; i < maxLines; i++) {
          if (isLineNonEmpty(i)) {
            placeCaret(lineRefs.current.get(i)!, 'end');
            moved = true;
            break;
          }
        }
      } else {
        for (let i = lineIndex - 1; i >= 0; i--) {
          if (isLineNonEmpty(i)) {
            placeCaret(lineRefs.current.get(i)!, 'end');
            moved = true;
            break;
          }
        }
      }

      if (!moved) {
        caretHintRef.current = {
          target: dir === 'prev' ? 'lastNonEmpty' : 'first',
          where: 'end',
          ts: Date.now(),
          retries: 3,
        };
        onNavigate?.(dir, segment.id as number);
      }
      return;
    }

    if (e.key === 'Enter' && !e.ctrlKey) {
      e.preventDefault();

      if (e.shiftKey) {
        if (lineIndex > 0) {
          placeCaret(lineRefs.current.get(lineIndex - 1)!, 'end');
        } else {
          caretHintRef.current = { target: 'lastNonEmpty', where: 'end', ts: Date.now(), retries: 3 };
          onNavigate?.('prev', segment.id as number);
        }
        return;
      }

      if (lineIndex === maxLines - 1) {
        return;
      }

      if (isLineNonEmpty(maxLines - 1)) {
        return;
      }

      if (lineIndex < maxLines - 1) {
        const cur = lineRefs.current.get(lineIndex);
        const next = lineRefs.current.get(lineIndex + 1);
        if (cur && next) {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const r = sel.getRangeAt(0);

            const tailR = document.createRange();
            tailR.selectNodeContents(cur);
            tailR.setStart(r.startContainer, r.startOffset);

            const tailHtml = tailR.cloneContents();
            tailR.extractContents();

            for (let j = maxLines - 1; j > lineIndex + 1; j--) {
              const prevRow = lineRefs.current.get(j - 1);
              const curRow = lineRefs.current.get(j);
              if (curRow && prevRow) curRow.innerHTML = prevRow.innerHTML;
            }

            next.innerHTML = '';
            next.appendChild(tailHtml);

            placeCaret(next, 'start');
            syncEditorsToState();
          }
        }
      }
      return;
    }
  }, [isEditable, performSplitAtCaret, maxLines, syncEditorsToState, isLineNonEmpty, onNavigate, segment.id]);

  useLayoutEffect(() => {
    if (!isEditable) return;

    const linesArr = (segment.originalText || '').split('\n');

    for (let i = 0; i < maxLines; i++) {
      const el = lineRefs.current.get(i);
      if (!el) continue;

      const targetHtml = RichText.plainToRich(linesArr[i] || '');

      if (document.activeElement === el) {
        if (getLinePlain(el) !== (linesArr[i] || '')) el.innerHTML = targetHtml;
      } else {
        if (el.innerHTML !== targetHtml) el.innerHTML = targetHtml;
      }
    }

    if (!isActive) return;

    const hint = caretHintRef.current;
    if (hint && Date.now() - hint.ts < 1500) {
      if (typeof hint.segmentId === 'number' && hint.segmentId !== segment.id) return;

      const idx = resolveHintIndex(hint.target);
      const el = lineRefs.current.get(idx);

      if (el) {
        placeCaret(el, hint.where);
        requestAnimationFrame(() => placeCaret(el, hint.where));

        const retriesLeft = (hint.retries ?? 1) - 1;
        if (retriesLeft > 0) {
          caretHintRef.current = { ...hint, retries: retriesLeft, ts: Date.now() };
        } else {
          caretHintRef.current = null;
        }
      }
    }
  }, [segment.originalText, isEditable, maxLines, isActive, resolveHintIndex, segment.id]);

  useEffect(() => {
    if (isActive && autoScroll && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isActive, autoScroll]);

  const cleanLinesByRow = useMemo(() => contentLines.map((l) => TextMetrics.stripSrtTags(l || '')), [contentLines]);
  const charsPerLine = useMemo(
    () => Array.from({ length: maxLines }).map((_, i) => cleanLinesByRow[i]?.length || 0),
    [maxLines, cleanLinesByRow]
  );
  const cpsValue = useMemo(() => {
    const total = cleanLinesByRow.join('').length;
    return duration > 0 ? total / duration : 0;
  }, [cleanLinesByRow, duration]);

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col p-2 border-b border-[var(--th-border)] transition-colors duration-150 min-w-full ${
        isActive
          ? 'ring-1 ring-inset'
          : proposedText
          ? 'bg-red-950/20 hover:bg-red-950/30'
          : isCorrected
          ? 'bg-rose-900/15 hover:bg-rose-900/25'
          : segment.hasDiff
          ? 'bg-red-900/10 hover:bg-red-900/20'
          : 'hover:bg-white/5'
      } cursor-pointer group`}
      style={isActive ? { backgroundColor: 'var(--th-editor-row-active)', '--tw-ring-color': 'var(--th-focus-ring)' } as any : undefined}
      onClick={() => onClick(segment.id)}
    >
      {/* Indicador lateral vermell quan hasDiff */}
      {segment.hasDiff && !isActive && (
        <div
          className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500/70"
          title="Discrepància amb el guió"
        />
      )}
      {/* Indicador lateral vermell quan hi ha correcció pendent de revisió */}
      {proposedText && !isActive && (
        <div
          className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-400/90"
          title="Correcció pendent de revisió"
        />
      )}
      {/* Indicador lateral rosa quan isCorrected (text corregit i acceptat) */}
      {isCorrected && !proposedText && !isActive && (
        <div
          className="absolute left-0 top-0 bottom-0 w-0.5 bg-rose-400/80"
          title="Text corregit pel guió"
        />
      )}
      <div
        className="grid items-stretch"
        style={{
          // REAJUSTAMENT: Amplades optimitzades per evitar solapaments (10ch per a TK, 12ch per a ID/CPS)
          // La columna de text usa max-content per no comprimir-se mai — el scroll
          // horitzontal global del panel s'encarrega del desbordament.
          gridTemplateColumns: '10ch 12ch 21ch 5ch max-content',
          gridTemplateRows: `repeat(${maxLines}, ${ROW_HEIGHT})`,
        }}
      >
        {Array.from({ length: maxLines }).map((_, i) => (
          <React.Fragment key={i}>
            {/* Columna 1: TAKE + indicador DIFF */}
            <div style={gridCellStyle} className="flex items-center px-2 gap-1">
              {i === 0 && (
                <>
                  <span className="font-black text-[10px] truncate" style={{ color: 'var(--th-accent-text)' }}>
                    {segment.primaryTakeNum ? `TK${segment.primaryTakeNum}` : ''}
                  </span>
                  {segment.hasDiff && (
                    <span
                      className="text-[8px] font-black text-red-400 bg-red-900/30 px-0.5 rounded leading-none"
                      title="Discrepància detectada entre el subtítol i el guió"
                    >
                      DIFF
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Columna 2: #Índex i CPS (a sota) */}
            <div style={gridCellStyle} className="flex items-center px-2">
              {i === 0 ? (
                <span className="font-black text-[11px]" style={{ color: 'var(--th-editor-meta)' }}>#{segment.id}</span>
              ) : i === 1 ? (
                <span className={`font-black text-[11px] whitespace-nowrap ${cpsValue > 20 ? 'text-red-500 animate-pulse' : ''}`} style={cpsValue <= 20 ? { color: 'var(--th-editor-text-muted)' } : undefined}>
                  {cpsValue.toFixed(1)} <span className="text-[8px] opacity-60 font-normal">CPS</span>
                </span>
              ) : null}
            </div>

            {/* Columna 3: Timecodes editables */}
            <div style={gridCellStyle} className="flex items-center px-1">
              {i === 0 ? (
                <TimecodeInput
                  value={segment.startTime}
                  label="IN"
                  isEditable={isEditable}
                  onCommit={(newVal) => {
                    onChange({ ...segment, startTime: newVal });
                    onBlur?.();
                  }}
                />
              ) : i === 1 ? (
                <TimecodeInput
                  value={segment.endTime}
                  label="OUT"
                  isEditable={isEditable}
                  onCommit={(newVal) => {
                    onChange({ ...segment, endTime: newVal });
                    onBlur?.();
                  }}
                />
              ) : null}
            </div>

            {/* Columna 4: Caràcters */}
            <div
              style={gridCellStyle}
              className={`flex items-center px-2 justify-end font-black text-[11px] ${
                charsPerLine[i] > maxCharsPerLine ? 'text-red-500 bg-red-500/10' : ''
              }`}
              style={charsPerLine[i] <= maxCharsPerLine ? { color: 'var(--th-editor-text-muted)' } : undefined}
            >
              {charsPerLine[i] > 0 && `${charsPerLine[i]}c`}
            </div>

            {/* Columna 5: Text Editable */}
            <div style={gridCellStyle} className="px-2 relative">
              <div
                ref={(el) => {
                  if (el) lineRefs.current.set(i, el);
                  else lineRefs.current.delete(i);
                }}
                contentEditable={isEditable}
                suppressContentEditableWarning
                onFocus={() => onFocus(segment.id)}
                onBlur={onBlur}
                onInput={syncEditorsToState}
                data-line-index={i}
                onKeyDown={handleKeyDownForLine}
                onPaste={(e) => {
                  e.preventDefault();
                  document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
                }}
                data-segment-id={segment.id}
                className={`outline-none whitespace-nowrap text-[14.5px] transition-colors ${isEditable ? 'cursor-text px-1.5 py-0.5 focus:ring-1 rounded-sm' : ''}`}
                style={{
                  fontFamily: "'Courier Prime', monospace",
                  lineHeight: ROW_HEIGHT,
                  minHeight: ROW_HEIGHT,
                  color: isActive ? 'var(--th-editor-text-active)' : 'var(--th-editor-text)',
                  caretColor: 'var(--th-editor-caret)',
                  '--tw-ring-color': 'var(--th-focus-ring)',
                } as any}
                spellCheck={false}
              />
              {charsPerLine[i] > maxCharsPerLine && <div className="absolute top-0 right-0 h-full w-0.5 bg-red-600/50" />}
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Panel de correcció pendent (inline review) — VERMELL */}
      {proposedText && (
        <div
          className="mt-1 rounded-lg border border-red-600/40 bg-red-950/40 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2 px-2 pt-1.5 pb-1.5">
            <div className="flex-1 min-w-0">
              <div className="text-[8px] font-black uppercase tracking-widest text-red-400/70 mb-0.5">
                ✦ Proposta correcció
              </div>
              <div
                className="text-[13px] text-red-100 whitespace-pre-wrap break-words leading-snug"
                style={{ fontFamily: "'Courier Prime', monospace" }}
              >
                {proposedText}
              </div>
            </div>
            <div className="flex gap-1 flex-shrink-0 mt-0.5">
              <button
                onClick={() => onAccept?.(segment.id as number)}
                className="px-2 py-1 rounded-lg bg-emerald-800/60 hover:bg-emerald-600 text-emerald-200 text-[10px] font-black uppercase tracking-widest transition-colors"
                title="Acceptar correcció"
              >
                ✓
              </button>
              <button
                onClick={() => onReject?.(segment.id as number)}
                className="px-2 py-1 rounded-lg bg-red-900/60 hover:bg-red-700 text-red-300 text-[10px] font-black uppercase tracking-widest transition-colors"
                title="Rebutjar correcció"
              >
                ✗
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra d'accions: visible en hover o quan el segment és actiu */}
      {isEditable && (
        <div
          className={`flex items-center gap-0.5 mt-0.5 pt-0.5 border-t border-white/10 transition-opacity ${
            isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {onInsertBefore && (
            <button
              className="px-1.5 py-0.5 rounded text-[9px] hover:bg-white/5 transition-colors" style={{ color: 'var(--th-editor-meta)' }}
              onClick={() => onInsertBefore(segment.id)}
              title="Insertar subtítol abans (Alt+↑)"
            >
              +↑
            </button>
          )}
          {onInsertAfter && (
            <button
              className="px-1.5 py-0.5 rounded text-[9px] hover:bg-white/5 transition-colors" style={{ color: 'var(--th-editor-meta)' }}
              onClick={() => onInsertAfter(segment.id)}
              title="Insertar subtítol després (Alt+↓)"
            >
              +↓
            </button>
          )}
          {(onInsertBefore || onInsertAfter) && <div className="w-px h-3 mx-0.5 flex-shrink-0" style={{ backgroundColor: 'var(--th-bg-tertiary)' }} />}
          {onSplit && (
            <button
              className="px-1.5 py-0.5 rounded text-[9px] text-gray-500 hover:text-amber-300 hover:bg-amber-600/10 transition-colors font-mono"
              onClick={() => onSplit(segment.id)}
              title="Dividir en dos (Ctrl+K)"
            >
              Split
            </button>
          )}
          {onModifyMerge && (
            <button
              className="px-1.5 py-0.5 rounded text-[9px] text-gray-500 hover:text-emerald-300 hover:bg-emerald-600/10 transition-colors font-mono"
              onClick={() => onModifyMerge(segment.id)}
              title="Fusionar amb el següent"
            >
              Merge↓
            </button>
          )}
          <div className="flex-grow" />
          {onDelete && (
            <button
              className="px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors hover:bg-red-600/20"
              style={{
                color: '#ef4444',
                backgroundColor: 'rgba(239,68,68,0.10)',
                border: '1px solid rgba(239,68,68,0.25)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f87171'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
              onClick={() => onDelete(segment.id)}
              title="Eliminar subtítol (Shift+Supr)"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(SegmentItem);