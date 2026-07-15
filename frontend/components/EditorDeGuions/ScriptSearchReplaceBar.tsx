import React, { useEffect, useRef, useState } from 'react';
import { findGeneralShortcutAction } from '../../hooks/useKeyboardShortcuts';

/** Columna diana de la cerca al guió: versió original, traduïda o totes dues. */
export type ScriptSearchColumn = 'original' | 'translation' | 'both';

interface ScriptSearchReplaceBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  replaceText: string;
  onReplaceTextChange: (t: string) => void;
  caseSensitive: boolean;
  onCaseSensitiveChange: (v: boolean) => void;
  wholeWord: boolean;
  onWholeWordChange: (v: boolean) => void;
  column: ScriptSearchColumn;
  onColumnChange: (c: ScriptSearchColumn) => void;
  /** Si el document no té cap versió traduïda, es desactiven Traducció/Ambdues. */
  hasTranslation: boolean;
  matchCount: number;
  /** Índex de la coincidència activa dins del total (−1 = cap). */
  activeIndex: number;
  /** Mostra la fila de substitució (només en mode edició). */
  canReplace: boolean;
  onNext: () => void;
  onPrev: () => void;
  onReplace: () => void;
  /** Substituir-ho tot; retorna el nombre de coincidències realment substituïdes. */
  onReplaceAll: () => number;
  onClose: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

/**
 * Barra de cerca i substitució per a l'editor de guions. Component CONTROLAT: tot
 * l'estat de negoci (terme, opcions, columna diana, coincidències) viu a
 * ScriptSearchOverlay; aquí només hi ha el missatge efímer de "S'han fet N substitucions".
 * Coherent en look&feel amb la barra de l'editor de subtítols, però amb el selector de
 * columna (Original / Traducció / Ambdues), adaptat al model de dues versions del guió.
 */
const ScriptSearchReplaceBar: React.FC<ScriptSearchReplaceBarProps> = ({
  query, onQueryChange, replaceText, onReplaceTextChange,
  caseSensitive, onCaseSensitiveChange, wholeWord, onWholeWordChange,
  column, onColumnChange, hasTranslation,
  matchCount, activeIndex, canReplace,
  onNext, onPrev, onReplace, onReplaceAll, onClose, inputRef,
}) => {
  const [message, setMessage] = useState<{ text: string; done: boolean } | null>(null);
  const msgTimerRef = useRef<number | null>(null);

  useEffect(() => { setMessage(null); }, [query, replaceText, column]);
  useEffect(() => () => { if (msgTimerRef.current) window.clearTimeout(msgTimerRef.current); }, []);

  const showReplaceAllMessage = (n: number) => {
    setMessage(
      n === 0
        ? { text: 'Cap substitució', done: false }
        : { text: n === 1 ? "S'ha fet 1 substitució" : `S'han fet ${n} substitucions`, done: true }
    );
    if (msgTimerRef.current) window.clearTimeout(msgTimerRef.current);
    msgTimerRef.current = window.setTimeout(() => setMessage(null), 4000);
  };

  // Les dreceres GENERALS (Desfer/Refer/Guardar) travessen la barra amb Ctrl/Cmd perquè
  // el document, no l'input, respongui (criteri Word/VSCode). La resta de tecles s'aïllen
  // amb stopPropagation per no disparar dreceres del mòdul mentre s'escriu.
  const isGlobalShortcut = (e: React.KeyboardEvent) =>
    (e.ctrlKey || e.metaKey) && findGeneralShortcutAction(e) !== null;

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (isGlobalShortcut(e)) return;
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) onPrev(); else onNext();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      (e.target as HTMLInputElement).select();
    }
  };
  const handleReplaceKeyDown = (e: React.KeyboardEvent) => {
    if (isGlobalShortcut(e)) return;
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      onReplace();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  };

  const hasMatches = matchCount > 0;
  const inputClass = 'flex-1 min-w-0 max-w-[280px] px-2 py-1 rounded text-xs bg-black/20 border focus:outline-none';
  const inputStyle: React.CSSProperties = { color: 'var(--th-text-primary)', borderColor: 'var(--th-border)' };
  const navBtnClass = 'w-6 h-6 rounded flex items-center justify-center text-[10px] transition-colors disabled:opacity-30 disabled:cursor-default hover:bg-white/10';
  const toggleClass = (active: boolean) =>
    `w-7 h-6 rounded flex items-center justify-center text-[10px] font-black transition-colors ${active ? '' : 'hover:bg-white/10'}`;
  const toggleStyle = (active: boolean): React.CSSProperties =>
    active
      ? { backgroundColor: 'var(--th-accent)', color: 'var(--th-text-inverse)' }
      : { color: 'var(--th-editor-meta)' };
  const actionBtnClass = 'px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-colors disabled:opacity-30 disabled:cursor-default';

  const colBtnClass = (active: boolean, disabled: boolean) =>
    `px-2 h-6 rounded text-[10px] font-bold transition-colors ${disabled ? 'opacity-30 cursor-default' : active ? '' : 'hover:bg-white/10'}`;
  const colBtnStyle = (active: boolean): React.CSSProperties =>
    active
      ? { backgroundColor: 'var(--th-accent)', color: 'var(--th-text-inverse)' }
      : { color: 'var(--th-editor-meta)' };

  const columnBtn = (value: ScriptSearchColumn, label: string, disabled = false) => (
    <button
      type="button"
      onClick={() => { if (!disabled) onColumnChange(value); }}
      disabled={disabled}
      className={colBtnClass(column === value, disabled)}
      style={colBtnStyle(column === value)}
      aria-pressed={column === value}
      title={`Cercar a: ${label}`}
    >{label}</button>
  );

  return (
    <div
      className="flex-shrink-0 flex flex-col gap-1 px-3 py-1.5 border-b"
      style={{ backgroundColor: 'var(--th-header-bg)', borderColor: 'var(--th-border)' }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Cercar al guió..."
          autoFocus
          className={inputClass}
          style={inputStyle}
        />
        <button
          type="button"
          onClick={() => onCaseSensitiveChange(!caseSensitive)}
          className={toggleClass(caseSensitive)}
          style={toggleStyle(caseSensitive)}
          title="Coincidir majúscules/minúscules"
          aria-pressed={caseSensitive}
        >Aa</button>
        <button
          type="button"
          onClick={() => onWholeWordChange(!wholeWord)}
          className={toggleClass(wholeWord)}
          style={toggleStyle(wholeWord)}
          title="Només paraules completes"
          aria-pressed={wholeWord}
        >[ab]</button>

        {/* Selector de columna diana */}
        <div className="flex items-center gap-0.5 ml-1 px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--th-bg-surface)' }}>
          {columnBtn('original', 'Original')}
          {columnBtn('translation', 'Traducció', !hasTranslation)}
          {columnBtn('both', 'Ambdues', !hasTranslation)}
        </div>

        <span className="text-[10px] font-mono text-gray-400 whitespace-nowrap min-w-[80px] text-center select-none">
          {hasMatches ? `${Math.max(0, activeIndex) + 1} de ${matchCount}` : (query ? 'Sense resultats' : '')}
        </span>
        <button type="button" onClick={onPrev} disabled={!hasMatches} className={navBtnClass} style={{ color: 'var(--th-editor-meta)' }} title="Anterior (Maj+Enter)">▲</button>
        <button type="button" onClick={onNext} disabled={!hasMatches} className={navBtnClass} style={{ color: 'var(--th-editor-meta)' }} title="Següent (Enter)">▼</button>
        <div className="flex-1" />
        <button type="button" onClick={onClose} className={navBtnClass} style={{ color: 'var(--th-editor-meta)' }} title="Tancar (Esc)">✕</button>
      </div>
      {canReplace && (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={replaceText}
            onChange={(e) => onReplaceTextChange(e.target.value)}
            onKeyDown={handleReplaceKeyDown}
            placeholder="Substituir per..."
            className={inputClass}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={onReplace}
            disabled={!hasMatches || activeIndex < 0}
            className={`${actionBtnClass} bg-white/5 hover:bg-white/15`}
            style={{ color: 'var(--th-editor-meta)' }}
          >Substituir</button>
          <button
            type="button"
            onClick={() => showReplaceAllMessage(onReplaceAll())}
            disabled={!hasMatches}
            className={`${actionBtnClass} bg-white/5 hover:bg-white/15`}
            style={{ color: 'var(--th-editor-meta)' }}
          >Substituir-ho tot</button>
          {message && (
            <span className={`text-[10px] whitespace-nowrap select-none ${message.done ? 'text-emerald-400' : 'text-gray-400'}`}>{message.text}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default ScriptSearchReplaceBar;
