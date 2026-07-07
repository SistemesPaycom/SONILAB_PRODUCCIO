import React, { useEffect, useRef, useState } from 'react';

interface SearchReplaceBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  replaceText: string;
  onReplaceTextChange: (t: string) => void;
  caseSensitive: boolean;
  onCaseSensitiveChange: (v: boolean) => void;
  wholeWord: boolean;
  onWholeWordChange: (v: boolean) => void;
  matchCount: number;
  /** Índex de la coincidència activa dins del total (−1 = cap). */
  activeIndex: number;
  /** Mostra la fila de substitució (mode edició amb batch disponible). */
  canReplace: boolean;
  onNext: () => void;
  onPrev: () => void;
  onReplace: () => void;
  /** Substituir-ho tot; retorna el nombre de substitucions fetes (per al missatge). */
  onReplaceAll: () => number;
  onClose: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

/**
 * Barra de cerca i substitució tipus Word. Component CONTROLAT: tot l'estat de negoci
 * (terme, opcions, coincidències) viu a SubtitlesEditor; aquí només hi ha el missatge
 * efímer de "S'han fet N substitucions".
 */
const SearchReplaceBar: React.FC<SearchReplaceBarProps> = ({
  query, onQueryChange, replaceText, onReplaceTextChange,
  caseSensitive, onCaseSensitiveChange, wholeWord, onWholeWordChange,
  matchCount, activeIndex, canReplace,
  onNext, onPrev, onReplace, onReplaceAll, onClose, inputRef,
}) => {
  const [message, setMessage] = useState<string | null>(null);
  const msgTimerRef = useRef<number | null>(null);

  // El missatge desapareix en canviar el terme…
  useEffect(() => { setMessage(null); }, [query]);
  // …i el temporitzador es neteja al desmuntar.
  useEffect(() => () => { if (msgTimerRef.current) window.clearTimeout(msgTimerRef.current); }, []);

  const showReplaceAllMessage = (n: number) => {
    setMessage(n === 1 ? "S'ha fet 1 substitució" : `S'han fet ${n} substitucions`);
    if (msgTimerRef.current) window.clearTimeout(msgTimerRef.current);
    msgTimerRef.current = window.setTimeout(() => setMessage(null), 4000);
  };

  // stopPropagation de TOTES les tecles: aïlla els inputs de la barra de les dreceres
  // globals de useKeyboardShortcuts. Imprescindible per a la tecla Delete: la combo
  // 'Delete' (sub_delete) està registrada i el hook fa e.preventDefault() encara que
  // cap vista tracti l'acció — sense stopPropagation, Supr no esborraria text a l'input.
  // Ctrl+F es tracta aquí mateix (el listener global ja no el veu): re-selecciona el camp.
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
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
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      onReplace();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      // Sense això, stopPropagation amaga l'event al listener global i el navegador
      // obriria el SEU cercador natiu. Comportament spec §4.1: tornar al camp de cerca.
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

  return (
    <div
      className="flex-shrink-0 flex flex-col gap-1 px-3 py-1.5 border-b"
      style={{ backgroundColor: 'var(--th-header-bg)', borderColor: 'var(--th-border)' }}
      onKeyDown={(e) => {
        // Esc amb el focus a QUALSEVOL element de la barra (botons inclosos) tanca
        // (spec §4.1). Els inputs ja fan stopPropagation i el tracten localment,
        // així que aquí només arriben les tecles dels botons/toggles.
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
          placeholder="Cercar..."
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
            onClick={() => { const n = onReplaceAll(); if (n > 0) showReplaceAllMessage(n); }}
            disabled={!hasMatches}
            className={`${actionBtnClass} bg-white/5 hover:bg-white/15`}
            style={{ color: 'var(--th-editor-meta)' }}
          >Substituir-ho tot</button>
          {message && (
            <span className="text-[10px] text-emerald-400 whitespace-nowrap select-none">{message}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchReplaceBar;
