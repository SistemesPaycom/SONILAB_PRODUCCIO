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
  /** Selecció múltiple: aquest bloc està seleccionat (checkbox marcat) */
  isSelected?: boolean;
  /** Selecció múltiple: hi ha ≥1 bloc seleccionat a la llista (fa visibles tots els checkboxes) */
  selectionActive?: boolean;
  /** Toggle de selecció del bloc; shiftKey=true → selecció de rang des de l'àncora */
  onToggleSelect?: (id: number, shiftKey: boolean) => void;
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

/**
 * Posiciona el cursor a una línia lògica concreta dins d'un editor unificat.
 * Les línies estan delimitades per elements <br>.
 */
const placeCaretAtLogicalLine = (
  editor: HTMLElement,
  target: 'first' | 'lastNonEmpty' | number,
  where: 'start' | 'end'
) => {
  try {
    (editor as any).focus?.({ preventScroll: true });
  } catch {
    editor.focus();
  }

  const sel = window.getSelection();
  if (!sel) return;

  if (target === 'first') {
    if (where === 'start') { placeCaret(editor, 'start'); return; }
    const firstBr = editor.querySelector('br');
    if (firstBr) {
      const range = document.createRange();
      range.setStartBefore(firstBr);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      placeCaret(editor, 'end');
    }
    return;
  }

  const brs = Array.from(editor.querySelectorAll('br'));

  let targetLine: number;
  if (target === 'lastNonEmpty') {
    const lines = RichText.richToPlain(editor.innerHTML || '').split('\n');
    targetLine = 0;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().length > 0) { targetLine = i; break; }
    }
  } else {
    const lineCount = brs.length + 1;
    targetLine = Math.max(0, Math.min(target, lineCount - 1));
  }

  if (targetLine === 0) {
    if (where === 'start') { placeCaret(editor, 'start'); return; }
    if (brs.length > 0) {
      const range = document.createRange();
      range.setStartBefore(brs[0]);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      placeCaret(editor, 'end');
    }
    return;
  }

  const brBefore = brs[targetLine - 1];
  if (!brBefore) { placeCaret(editor, where === 'start' ? 'start' : 'end'); return; }

  const range = document.createRange();
  if (where === 'start') {
    // Posicionem el cursor just després del <br>. Si no hi ha node de text
    // real a continuació, usem l'offset del pare (que pot no funcionar per
    // teclejar, però la crida des de rAF amb ensureTextNodeAfterBr ho resol).
    const nextSib = brBefore.nextSibling;
    if (nextSib && nextSib.nodeType === Node.TEXT_NODE) {
      range.setStart(nextSib, 0);
    } else {
      const parent = brBefore.parentNode!;
      const brIdx = Array.from(parent.childNodes).indexOf(brBefore);
      range.setStart(parent, brIdx + 1);
    }
    range.collapse(true);
  } else {
    const brAfter = brs[targetLine];
    if (brAfter) {
      range.setStartBefore(brAfter);
    } else {
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    range.collapse(true);
  }

  sel.removeAllRanges();
  sel.addRange(range);
};

// Posiciona el cursor a un offset de caràcter absolut dins l'editor (cada <br> val 1 char).
const placeCaretAtCharOffset = (editor: HTMLElement, offset: number) => {
  try {
    (editor as any).focus?.({ preventScroll: true });
  } catch {
    editor.focus();
  }
  const sel = window.getSelection();
  if (!sel) return;
  let remaining = offset;
  for (const node of Array.from(editor.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node as Text).length;
      if (remaining <= len) {
        const range = document.createRange();
        range.setStart(node, remaining);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      remaining -= len;
    } else if ((node as Element).nodeName === 'BR') {
      if (remaining === 0) {
        const range = document.createRange();
        range.setStartBefore(node);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      remaining--;
    }
  }
  placeCaret(editor, 'end');
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
  isSelected = false,
  selectionActive = false,
  onToggleSelect,
}) => {
  const { caretHintRef, splitPayloadRef } = useSubtitleEditor();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [gridOpacity] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.SUB_GRID_OPACITY, 0);

  const contentLines = useMemo(() => (segment.originalText || '').split('\n'), [segment.originalText]);

  const maxLines = useMemo(() => {
    const maxCfg = generalConfig.maxLinesPerSubtitle || 1;
    return Math.max(maxCfg, contentLines.length);
  }, [generalConfig.maxLinesPerSubtitle, contentLines.length]);

  const duration = segment.endTime - segment.startTime;

  const gridCellStyle: React.CSSProperties = {
    borderWidth: gridOpacity > 0 ? '1px' : '0px',
    borderStyle: 'dashed',
    borderColor: `rgba(150, 150, 150, ${gridOpacity})`,
  };

  const maxCharsPerLine = generalConfig.maxCharsPerLine ?? 40;

  // Sync: extreu text pla de l'editor unificat, aplica maxLines, propaga canvis
  // Nota: el.innerHTML s'actualitza amb contingut intern segur (plainToRich escapa HTML primer)
  const syncEditorsToState = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    let plain = RichText.richToPlain(el.innerHTML)
      .replace(/\u00A0/g, ' ');

    // Enforcement de maxLines: trunca si el navegador ha generat línies extra
    const lines = plain.split('\n');
    if (lines.length > maxLines) {
      plain = lines.slice(0, maxLines).join('\n');
      el.innerHTML = RichText.plainToRich(plain);
      placeCaret(el, 'end');
    }

    if (plain !== (segment.originalText || '')) {
      onChange({ ...segment, originalText: plain, richText: '' });
    }
  }, [onChange, segment, maxLines]);

  // Split al cursor (Ctrl+K) — opera sobre l'editor unificat
  const performSplitAtCaret = useCallback(() => {
    if (!onSplit) return;
    const editor = editorRef.current;
    const sel = window.getSelection();
    if (!editor || !sel || sel.rangeCount === 0) return;
    if (!editor.contains(sel.anchorNode)) return;

    const caretRange = sel.getRangeAt(0);

    const headRange = document.createRange();
    headRange.selectNodeContents(editor);
    headRange.setEnd(caretRange.startContainer, caretRange.startOffset);

    const tailRange = document.createRange();
    tailRange.selectNodeContents(editor);
    tailRange.setStart(caretRange.startContainer, caretRange.startOffset);

    const headWrap = document.createElement('div');
    headWrap.appendChild(headRange.cloneContents());
    const tailWrap = document.createElement('div');
    tailWrap.appendChild(tailRange.cloneContents());

    const leftText = RichText.richToPlain(headWrap.innerHTML)
      .replace(/\u00A0/g, ' ').trimEnd();
    const rightText = RichText.richToPlain(tailWrap.innerHTML)
      .replace(/\u00A0/g, ' ').trimStart();

    // Cursor al principi o al final: no dividim (crearia un bloc buit)
    if (!leftText.trim() || !rightText.trim()) return;

    const strip = (s: string) => TextMetrics.stripSrtTags(s || '');
    const fullText = strip(segment.originalText || '');
    const leftStripped = strip(leftText);
    const splitRatio = fullText.length > 0
      ? leftStripped.length / fullText.length
      : 0.5;

    splitPayloadRef.current = {
      id: segment.id,
      leftText,
      rightText,
      splitRatio,
    };

    caretHintRef.current = {
      segmentId: segment.id,
      target: 'first',
      where: 'end',
      ts: Date.now(),
      retries: 3,
    };

    onSplit(segment.id);
  }, [onSplit, segment.id, segment.originalText]);

  // Botó S: si el cursor és dins l'editor d'aquest segment, divideix pel cursor
  // (mateix camí que Ctrl+K); si no, delega al fallback lògic de la vista.
  // El preventDefault del mousedown evita que el clic desenfoqui l'editor i
  // destrueixi la selecció abans de poder-la llegir.
  const handleSplitButtonMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const handleSplitButtonClick = useCallback(() => {
    if (!onSplit) return;
    const editor = editorRef.current;
    const sel = window.getSelection();
    if (editor && sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
      performSplitAtCaret();
    } else {
      onSplit(segment.id);
    }
  }, [onSplit, performSplitAtCaret, segment.id]);

  // Teclat: Enter=seg. següent, Shift+Enter=salt de línia, Ctrl+K=split, Ctrl+Shift+Enter=seg. anterior
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isEditable) return;

    // Ctrl+K: dividir segment al cursor
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      e.stopPropagation();
      performSplitAtCaret();
      return;
    }

    // Ctrl+Shift+Enter: navegar al segment anterior
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
      e.preventDefault();
      syncEditorsToState();
      onNavigate?.('prev', segment.id as number);
      return;
    }

    // Ctrl+Enter o Enter sol: navegar al segment següent
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      syncEditorsToState();
      onNavigate?.('next', segment.id as number);
      return;
    }

    // Shift+Enter: inserir salt de línia (si hi ha espai)
    // Estratègia: NO manipulem el DOM directament perquè React el reconcilia
    // i elimina qualsevol node afegit fora del seu control. En lloc d'això,
    // extraiem el text pla, inserim un \n a la posició del cursor, actualitzem
    // l'estat de React (onChange), i usem caretHintRef perquè el useLayoutEffect
    // posicioni el cursor a la línia nova després del re-render.
    if (e.key === 'Enter' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const editor = editorRef.current;
      if (!editor) return;

      // Comptar línies actuals
      const currentPlain = RichText.richToPlain(editor.innerHTML).replace(/\u00A0/g, ' ').replace(/\u200B/g, '');
      const currentLines = currentPlain.split('\n');
      if (currentLines.length >= maxLines) return; // no hi cap més

      // Extreure text abans i després del cursor
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const caretRange = sel.getRangeAt(0);
      if (!editor.contains(caretRange.startContainer)) return;

      const headRange = document.createRange();
      headRange.selectNodeContents(editor);
      headRange.setEnd(caretRange.startContainer, caretRange.startOffset);

      const tailRange = document.createRange();
      tailRange.selectNodeContents(editor);
      tailRange.setStart(caretRange.startContainer, caretRange.startOffset);

      const headWrap = document.createElement('div');
      headWrap.appendChild(headRange.cloneContents());
      const tailWrap = document.createElement('div');
      tailWrap.appendChild(tailRange.cloneContents());

      const textBefore = RichText.richToPlain(headWrap.innerHTML).replace(/\u00A0/g, ' ').replace(/\u200B/g, '');
      const textAfter = RichText.richToPlain(tailWrap.innerHTML).replace(/\u00A0/g, ' ').replace(/\u200B/g, '');

      // Calcular en quina línia quedarà el cursor (la línia just després de la inserció)
      const linesBefore = textBefore.split('\n');
      const targetLineIdx = linesBefore.length; // línia on quedarà el cursor

      // Construir text nou amb el \n inserit
      const newText = textBefore + '\n' + textAfter;

      // Posar el caretHint ABANS de l'onChange perquè el useLayoutEffect el trobi
      caretHintRef.current = {
        segmentId: segment.id as number,
        target: targetLineIdx,
        where: 'start',
        ts: Date.now(),
        retries: 3,
      };

      // Actualitzar estat React — això dispara re-render + useLayoutEffect
      onChange({ ...segment, originalText: newText, richText: '' });
      return;
    }

    // Delete al final d'una línia: unir amb la línia següent (mirall de Backspace)
    if (e.key === 'Delete') {
      const editor = editorRef.current;
      if (!editor) return;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const caretRange = sel.getRangeAt(0);
      if (!caretRange.collapsed || !editor.contains(caretRange.startContainer)) return;

      const headRange = document.createRange();
      headRange.selectNodeContents(editor);
      headRange.setEnd(caretRange.startContainer, caretRange.startOffset);
      const headWrap = document.createElement('div');
      headWrap.appendChild(headRange.cloneContents());
      const textBefore = RichText.richToPlain(headWrap.innerHTML).replace(/ /g, ' ').replace(/​/g, '');

      const tailRange = document.createRange();
      tailRange.selectNodeContents(editor);
      tailRange.setStart(caretRange.startContainer, caretRange.startOffset);
      const tailWrap = document.createElement('div');
      tailWrap.appendChild(tailRange.cloneContents());
      const textAfter = RichText.richToPlain(tailWrap.innerHTML).replace(/ /g, ' ').replace(/​/g, '');

      // Només intervenim si el cursor és just davant d'un \n (final de línia no última)
      if (!textAfter.startsWith('\n')) return;

      e.preventDefault();

      const newText = textBefore + textAfter.slice(1);
      const charOffset = textBefore.length;

      caretHintRef.current = {
        segmentId: segment.id as number,
        target: 0,
        where: 'end',
        charOffset,
        ts: Date.now(),
        retries: 3,
      };

      onChange({ ...segment, originalText: newText, richText: '' });
      return;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditable, performSplitAtCaret, maxLines, syncEditorsToState, onNavigate, segment.id]);

  // Sync contingut + caret hint (editor unificat)
  // Nota: el.innerHTML s'actualitza amb contingut intern segur (plainToRich escapa HTML primer)
  useLayoutEffect(() => {
    if (!isEditable) return;
    const el = editorRef.current;
    if (!el) return;

    const targetHtml = RichText.plainToRich(segment.originalText || '');

    if (document.activeElement === el) {
      const currentPlain = RichText.richToPlain(el.innerHTML).replace(/\u00A0/g, ' ');
      if (currentPlain !== (segment.originalText || '')) {
        el.innerHTML = targetHtml;
      }
    } else {
      if (el.innerHTML !== targetHtml) {
        el.innerHTML = targetHtml;
      }
    }

    if (!isActive) return;

    const hint = caretHintRef.current;
    if (hint && Date.now() - hint.ts < 1500) {
      if (typeof hint.segmentId === 'number' && hint.segmentId !== segment.id) return;

      placeCaretAtLogicalLine(el, hint.target, hint.where);

      // El rAF s'executa DESPRÉS que React hagi acabat de reconciliar.
      // Si el cursor ha d'anar després d'un <br> (target numèric, where='start'),
      // creem un node de text buit i posicionem el cursor DINS d'ell.
      // Chromium accepta escriure en un node buit si el cursor s'hi col·loca
      // atòmicament dins el mateix frame (sense ZWS).
      requestAnimationFrame(() => {
        if (typeof hint.charOffset === 'number') {
          placeCaretAtCharOffset(el, hint.charOffset);
          return;
        }
        if (typeof hint.target === 'number' && hint.where === 'start') {
          const targetIdx = hint.target as number;
          const brs = el.querySelectorAll('br');
          const br = brs[targetIdx - 1] as HTMLBRElement | undefined;
          if (br) {
            let textNode: Node | null = br.nextSibling;
            if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
              textNode = document.createTextNode('');
              br.parentNode!.insertBefore(textNode, br.nextSibling);
            }
            try { (el as any).focus?.({ preventScroll: true }); } catch { el.focus(); }
            const sel = window.getSelection();
            if (sel) {
              const r = document.createRange();
              r.setStart(textNode, 0);
              r.collapse(true);
              sel.removeAllRanges();
              sel.addRange(r);
            }
            return;
          }
        }
        placeCaretAtLogicalLine(el, hint.target, hint.where);
      });

      const retriesLeft = (hint.retries ?? 1) - 1;
      if (retriesLeft > 0) {
        caretHintRef.current = { ...hint, retries: retriesLeft, ts: Date.now() };
      } else {
        caretHintRef.current = null;
      }
    }
  }, [segment.originalText, isEditable, isActive, segment.id]);

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
      style={
        isActive
          ? { backgroundColor: 'var(--th-editor-row-active)', '--tw-ring-color': 'var(--th-focus-ring)' } as any
          : isSelected
          ? { backgroundColor: 'var(--th-accent-muted)' }
          : undefined
      }
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
      <div className="flex items-stretch">
        {/* Canal esquerre: checkbox de selecció múltiple (a l'esquerra de tot) */}
        {isEditable && onToggleSelect && (
          <div
            className="flex flex-col items-center flex-shrink-0 w-[22px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center" style={{ height: 'var(--us-sub-row-height)' }}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => { e.stopPropagation(); onToggleSelect(segment.id as number, e.shiftKey); }}
                className={`w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center transition-all ${
                  isSelected || selectionActive || isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                } ${isSelected ? '' : 'hover:border-white/60'}`}
                style={isSelected
                  ? { backgroundColor: 'var(--th-accent)', borderColor: 'var(--th-accent)', color: 'var(--th-text-inverse)' }
                  : { borderColor: 'var(--th-border)' }}
                title={isSelected ? 'Desseleccionar bloc (Maj+clic: rang)' : 'Seleccionar bloc (Maj+clic: rang)'}
                aria-pressed={isSelected}
              >
                {isSelected && <span className="text-[9px] font-black leading-none select-none">✓</span>}
              </button>
            </div>
          </div>
        )}
        <div
          className="grid items-stretch flex-1 min-w-0"
          style={{
            // Amplades de columna calculades dinàmicament per `applyUserStylesToDOM`
            // segons les CSS vars `--us-sub-*` del preset actiu de subtítols.
            gridTemplateColumns: 'var(--us-sub-grid-columns)',
            gridTemplateRows: `repeat(${maxLines}, var(--us-sub-row-height))`,
          }}
        >
          {/* Columnes 1-4: metadades per fila */}
          {Array.from({ length: maxLines }).map((_, i) => (
          <React.Fragment key={i}>
            {/* Columna 1: TAKE + indicador DIFF + botons d'acció */}
            <div style={gridCellStyle} className="flex items-center px-2 gap-1">
              {i === 0 && (
                <>
                  {segment.primaryTakeNum && (
                    <span
                      className="truncate flex-shrink-0"
                      style={{
                        fontFamily: 'var(--us-sub-takelabel-family)',
                        fontSize:   'var(--us-sub-takelabel-size)',
                        color:      'var(--us-sub-takelabel-color)',
                        fontWeight: 'var(--us-sub-takelabel-weight)' as any,
                        fontStyle:  'var(--us-sub-takelabel-style)',
                      }}
                    >
                      TK{segment.primaryTakeNum}
                    </span>
                  )}
                  {segment.hasDiff && (
                    <span
                      className="text-[8px] font-black text-red-400 bg-red-900/30 px-0.5 rounded leading-none"
                      title="Discrepància detectada entre el subtítol i el guió"
                    >
                      DIFF
                    </span>
                  )}
                  {isEditable && (
                    <div
                      className={`flex flex-1 gap-0.5 justify-center transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {onInsertBefore && (
                        <button
                          className="w-[1.8em] text-center py-0.5 rounded hover:bg-white/5 transition-colors leading-none"
                          style={{
                            fontFamily: 'var(--us-sub-actionbuttons-family)',
                            fontSize:   'var(--us-sub-actionbuttons-size)',
                            color:      'var(--us-sub-actionbuttons-color)',
                            fontWeight: 'var(--us-sub-actionbuttons-weight)' as any,
                            fontStyle:  'var(--us-sub-actionbuttons-style)',
                          }}
                          onClick={() => onInsertBefore(segment.id)}
                          title="Insertar subtítol abans (Alt+↑)"
                        >+↑</button>
                      )}
                      {onInsertAfter && (
                        <button
                          className="w-[1.8em] text-center py-0.5 rounded hover:bg-white/5 transition-colors leading-none"
                          style={{
                            fontFamily: 'var(--us-sub-actionbuttons-family)',
                            fontSize:   'var(--us-sub-actionbuttons-size)',
                            color:      'var(--us-sub-actionbuttons-color)',
                            fontWeight: 'var(--us-sub-actionbuttons-weight)' as any,
                            fontStyle:  'var(--us-sub-actionbuttons-style)',
                          }}
                          onClick={() => onInsertAfter(segment.id)}
                          title="Insertar subtítol després (Alt+↓)"
                        >+↓</button>
                      )}
                    </div>
                  )}
                </>
              )}
              {/* Cas línia única: S, U i ✕ aquí (Col 6 no té fila 2) */}
              {i === 0 && maxLines === 1 && isEditable && (
                <div
                  className={`flex flex-1 gap-0.5 items-center justify-center transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {onSplit && (
                    <button
                      className="w-[1.8em] text-center py-0.5 rounded font-mono text-gray-500 hover:text-amber-300 hover:bg-amber-600/10 transition-colors leading-none"
                      style={{
                        fontFamily: 'var(--us-sub-actionbuttons-family)',
                        fontSize:   'var(--us-sub-actionbuttons-size)',
                        fontWeight: 'var(--us-sub-actionbuttons-weight)' as any,
                        fontStyle:  'var(--us-sub-actionbuttons-style)',
                      }}
                      onMouseDown={handleSplitButtonMouseDown}
                      onClick={handleSplitButtonClick}
                      title="Dividir segment (al cursor si és dins el text)"
                    >S</button>
                  )}
                  {onModifyMerge && (
                    <button
                      className="w-[1.8em] text-center py-0.5 rounded font-mono text-gray-500 hover:text-emerald-300 hover:bg-emerald-600/10 transition-colors leading-none"
                      style={{
                        fontFamily: 'var(--us-sub-actionbuttons-family)',
                        fontSize:   'var(--us-sub-actionbuttons-size)',
                        fontWeight: 'var(--us-sub-actionbuttons-weight)' as any,
                        fontStyle:  'var(--us-sub-actionbuttons-style)',
                      }}
                      onClick={() => onModifyMerge(segment.id)}
                      title="Fusionar amb el següent"
                    >U</button>
                  )}
                  {onDelete && (
                    <button
                      className="w-[1.8em] text-center py-0.5 rounded text-[9px] font-bold transition-colors hover:bg-red-600/20 leading-none"
                      style={{
                        color: '#ef4444',
                        backgroundColor: 'rgba(239,68,68,0.10)',
                        border: '1px solid rgba(239,68,68,0.25)',
                        fontFamily: 'var(--us-sub-actionbuttons-family)',
                        fontSize:   'var(--us-sub-actionbuttons-size)',
                        fontWeight: 'var(--us-sub-actionbuttons-weight)' as any,
                        fontStyle:  'var(--us-sub-actionbuttons-style)',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f87171'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
                      onClick={() => onDelete(segment.id)}
                      title="Eliminar subtítol (Shift+Supr)"
                    >✕</button>
                  )}
                </div>
              )}
              {/* Cas multi-línia: S i U al row 1 (✕ es mou a Col 6) */}
              {i === 1 && isEditable && (
                <div
                  className={`flex flex-1 gap-0.5 items-center justify-center transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {onSplit && (
                    <button
                      className="w-[1.8em] text-center py-0.5 rounded font-mono text-gray-500 hover:text-amber-300 hover:bg-amber-600/10 transition-colors leading-none"
                      style={{
                        fontFamily: 'var(--us-sub-actionbuttons-family)',
                        fontSize:   'var(--us-sub-actionbuttons-size)',
                        fontWeight: 'var(--us-sub-actionbuttons-weight)' as any,
                        fontStyle:  'var(--us-sub-actionbuttons-style)',
                      }}
                      onMouseDown={handleSplitButtonMouseDown}
                      onClick={handleSplitButtonClick}
                      title="Dividir segment (al cursor si és dins el text)"
                    >S</button>
                  )}
                  {onModifyMerge && (
                    <button
                      className="w-[1.8em] text-center py-0.5 rounded font-mono text-gray-500 hover:text-emerald-300 hover:bg-emerald-600/10 transition-colors leading-none"
                      style={{
                        fontFamily: 'var(--us-sub-actionbuttons-family)',
                        fontSize:   'var(--us-sub-actionbuttons-size)',
                        fontWeight: 'var(--us-sub-actionbuttons-weight)' as any,
                        fontStyle:  'var(--us-sub-actionbuttons-style)',
                      }}
                      onClick={() => onModifyMerge(segment.id)}
                      title="Fusionar amb el següent"
                    >U</button>
                  )}
                </div>
              )}
            </div>

            {/* Columna 2: #Índex i CPS (a sota) */}
            <div style={gridCellStyle} className="flex items-center px-2">
              {i === 0 ? (
                <span
                  style={{
                    fontFamily: 'var(--us-sub-idcps-family)',
                    fontSize:   'var(--us-sub-idcps-size)',
                    color:      'var(--us-sub-idcps-color)',
                    fontWeight: 'var(--us-sub-idcps-weight)' as any,
                    fontStyle:  'var(--us-sub-idcps-style)',
                  }}
                >#{segment.id}</span>
              ) : i === 1 ? (
                <span
                  className={`whitespace-nowrap ${cpsValue > 20 ? 'animate-pulse' : ''}`}
                  style={{
                    fontFamily: 'var(--us-sub-idcps-family)',
                    fontSize:   'var(--us-sub-idcps-size)',
                    color:      cpsValue > 20 ? '#ef4444' : 'var(--us-sub-idcps-color)',
                    fontWeight: 'var(--us-sub-idcps-weight)' as any,
                    fontStyle:  'var(--us-sub-idcps-style)',
                  }}
                >
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
              className={`flex items-center px-2 justify-end ${
                charsPerLine[i] > maxCharsPerLine ? 'bg-red-500/10' : ''
              }`}
              style={{
                ...gridCellStyle,
                fontFamily: 'var(--us-sub-charcounter-family)',
                fontSize:   'var(--us-sub-charcounter-size)',
                color:      charsPerLine[i] > maxCharsPerLine ? '#ef4444' : 'var(--us-sub-charcounter-color)',
                fontWeight: 'var(--us-sub-charcounter-weight)' as any,
                fontStyle:  'var(--us-sub-charcounter-style)',
              }}
            >
              {charsPerLine[i] > 0 && `${charsPerLine[i]}c`}
            </div>
          </React.Fragment>
          ))}

          {/* Columna 5: Text Editable UNIFICAT — ocupa totes les files */}
          <div
            style={{
              ...gridCellStyle,
              gridColumn: 5,
              gridRow: `1 / ${maxLines + 1}`,
            }}
            className="px-2"
          >
            <div
              ref={editorRef}
              contentEditable={isEditable}
              suppressContentEditableWarning
              onFocus={() => onFocus(segment.id)}
              onBlur={onBlur}
              onInput={syncEditorsToState}
              onKeyDown={handleKeyDown}
              onPaste={(e) => {
                e.preventDefault();
                const text = e.clipboardData.getData('text/plain').replace(/\r\n/g, '\n');

                // execCommand('insertText') NO converteix \n a <br> dins contentEditable.
                // Inserim manualment: text + <br> per cada salt de línia.
                const sel = window.getSelection();
                if (!sel || sel.rangeCount === 0) return;
                const range = sel.getRangeAt(0);
                range.deleteContents();

                const lines = text.split('\n');
                const frag = document.createDocumentFragment();
                lines.forEach((line, idx) => {
                  if (idx > 0) frag.appendChild(document.createElement('br'));
                  if (line) frag.appendChild(document.createTextNode(line));
                });
                range.insertNode(frag);
                // Col·loca el cursor al final del contingut inserit
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);

                // Enforcement de maxLines després del paste
                syncEditorsToState();
              }}
              data-segment-id={segment.id}
              className={`outline-none w-full block ${isEditable ? 'cursor-text px-1.5 focus:ring-1 rounded-sm' : ''}`}
              style={{
                fontFamily: 'var(--us-sub-content-family)',
                fontSize:   'var(--us-sub-content-size)',
                fontWeight: 'var(--us-sub-content-weight)' as any,
                fontStyle:  'var(--us-sub-content-style)',
                lineHeight: 'var(--us-sub-row-height)',
                height: `calc(var(--us-sub-row-height) * ${maxLines})`,
                overflowY: 'hidden',
                whiteSpace: 'nowrap',
                color: isActive ? 'var(--th-editor-text-active)' : 'var(--us-sub-content-color)',
                caretColor: 'var(--th-editor-caret)',
                '--tw-ring-color': 'var(--th-focus-ring)',
              } as any}
              spellCheck={false}
            />
          </div>
        </div>

        {/* Col 6: ⠿ selecció (row 0) + ✕ eliminar (row 1 si multi-línia i editable) */}
        <div
          className={`flex flex-col w-[60px] flex-shrink-0 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        >
          <div
            className={`flex items-center justify-center rounded-sm cursor-pointer hover:bg-white/10 flex-shrink-0 ${isActive ? 'opacity-40' : ''}`}
            style={{ height: 'var(--us-sub-row-height)' }}
            onClick={(e) => { e.stopPropagation(); onClick(segment.id); }}
            title="Seleccionar subtítol"
          >
            <span className="select-none text-[11px]" style={{ color: 'var(--th-text-muted, #555)' }}>⠿</span>
          </div>
          {Array.from({ length: maxLines - 1 }).map((_, rowIdx) => (
            isEditable && onDelete && rowIdx === 0 ? (
              <div
                key={rowIdx}
                className="flex items-center justify-center rounded-sm cursor-pointer hover:bg-red-600/20 flex-shrink-0"
                style={{ height: 'var(--us-sub-row-height)' }}
                onClick={(e) => { e.stopPropagation(); onDelete(segment.id); }}
                title="Eliminar subtítol (Shift+Supr)"
              >
                <span
                  className="text-[9px] font-bold select-none"
                  style={{ color: '#ef4444' }}
                >✕</span>
              </div>
            ) : (
              <div key={rowIdx} style={{ height: 'var(--us-sub-row-height)' }} />
            )
          ))}
        </div>
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

    </div>
  );
};

export default React.memo(SegmentItem);