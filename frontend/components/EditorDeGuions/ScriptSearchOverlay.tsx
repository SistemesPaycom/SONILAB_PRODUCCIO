import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  findMatchesInText,
  replaceVisibleRange,
  toVisibleText,
  SearchOptions,
} from '../../utils/SubtitlesEditor/searchReplace';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import ScriptSearchReplaceBar, { ScriptSearchColumn } from './ScriptSearchReplaceBar';

interface ScriptSearchOverlayProps {
  /** Mode edició: habilita la fila de substitució. En lectura només es pot cercar. */
  isEditable: boolean;
  /** Totes les versions de contingut del document (per idioma). */
  contentByLang: Record<string, string>;
  /** Idioma marcat com a original (font). Pot ser null en documents legacy. */
  sourceLang: string | null;
  /** Idioma visible actualment a l'editor (la "Versió" seleccionada). */
  activeLang: string;
  /**
   * Contingut FRESC de la versió visible (pot anar per davant de contentByLang si hi ha
   * edicions sense confirmar a l'historial). Per a la resta d'idiomes s'usa contentByLang.
   */
  visibleContent: string;
  /** Aplica un contingut nou a una versió concreta (dispatch + historial si escau). */
  onReplaceLang: (lang: string, newContent: string) => void;
  /** Canvia la versió visible (per situar l'usuari a la coincidència d'un altre idioma). */
  onRequestLang: (lang: string) => void;
}

interface FlatMatch { lang: string; start: number; end: number; }

/**
 * Cerca i substitució per a l'editor de guions amb selector de columna
 * (Original / Traducció / Ambdues). Reutilitza el mòdul pur compartit amb l'editor de
 * subtítols (findMatchesInText / replaceVisibleRange, agnòstics del component): aquí el
 * "segment" és la cadena completa d'una versió d'idioma del guió.
 */
const ScriptSearchOverlay: React.FC<ScriptSearchOverlayProps> = ({
  isEditable,
  contentByLang,
  sourceLang,
  activeLang,
  visibleContent,
  onReplaceLang,
  onRequestLang,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [column, setColumn] = useState<ScriptSearchColumn>('original');
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  // Posició de l'última activa: re-ancoratge estable quan la llista es recalcula.
  const lastActivePosRef = useRef<{ lang: string; start: number } | null>(null);

  // Contingut fresc per idioma: la versió visible ve de l'historial (edicions en curs);
  // la resta, de contentByLang.
  const contentFor = useCallback(
    (lang: string): string => (lang === activeLang ? visibleContent : (contentByLang[lang] ?? '')),
    [activeLang, visibleContent, contentByLang]
  );

  // ── Resolució de columnes (model de dues versions sobre un contentByLang de N idiomes) ──
  const originalLang = useMemo(() => {
    const keys = Object.keys(contentByLang);
    if (sourceLang && contentByLang[sourceLang] !== undefined) return sourceLang;
    if (keys.includes('_unassigned')) return '_unassigned';
    return keys[0] ?? '';
  }, [contentByLang, sourceLang]);

  const translationLang = useMemo(() => {
    const keys = Object.keys(contentByLang).filter((k) => k !== '_unassigned');
    if (activeLang && activeLang !== originalLang && contentByLang[activeLang] !== undefined) return activeLang;
    return keys.find((k) => k !== originalLang) ?? '';
  }, [contentByLang, activeLang, originalLang]);

  const hasTranslation = translationLang !== '';

  // Si no hi ha traducció, força el selector a Original (evita cerca sobre conjunt buit).
  useEffect(() => {
    if (!hasTranslation && column !== 'original') setColumn('original');
  }, [hasTranslation, column]);

  const targetLangs = useMemo(() => {
    const langs =
      column === 'original' ? [originalLang]
      : column === 'translation' ? [translationLang]
      : [originalLang, translationLang];
    // Dedup i descarta buits (evita comptar/substituir dues vegades el mateix idioma).
    return langs.filter((l, i) => l !== '' && langs.indexOf(l) === i);
  }, [column, originalLang, translationLang]);

  const searchOpts = useMemo<SearchOptions>(
    () => ({ caseSensitive, wholeWord }),
    [caseSensitive, wholeWord]
  );

  // Debounce del terme (150ms), com a l'editor de subtítols.
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 150);
    return () => window.clearTimeout(t);
  }, [query]);

  const matches = useMemo<FlatMatch[]>(() => {
    if (!open || !debouncedQuery) return [];
    const out: FlatMatch[] = [];
    for (const lang of targetLangs) {
      const visible = toVisibleText(contentFor(lang));
      for (const m of findMatchesInText(visible, debouncedQuery, searchOpts)) {
        out.push({ lang, start: m.start, end: m.end });
      }
    }
    return out;
  }, [open, debouncedQuery, searchOpts, targetLangs, contentFor]);

  // Re-ancoratge de l'activa quan canvia la llista (edició, opcions, columna).
  useEffect(() => {
    if (matches.length === 0) { setActiveIndex(-1); return; }
    const pos = lastActivePosRef.current;
    let idx = 0;
    if (pos) {
      const orderOf = (lang: string) => targetLangs.indexOf(lang);
      const posOrder = orderOf(pos.lang);
      const found = matches.findIndex((m) => {
        const o = orderOf(m.lang);
        return o > posOrder || (o === posOrder && m.start >= pos.start);
      });
      idx = found === -1 ? 0 : found;
    }
    setActiveIndex(idx);
    lastActivePosRef.current = { lang: matches[idx].lang, start: matches[idx].start };
  }, [matches, targetLangs]);

  const gotoMatch = useCallback((idx: number) => {
    if (matches.length === 0) return;
    const n = ((idx % matches.length) + matches.length) % matches.length;
    setActiveIndex(n);
    const m = matches[n];
    lastActivePosRef.current = { lang: m.lang, start: m.start };
    // Situa l'usuari a la versió on és la coincidència (feedback visible sense injectar
    // ressaltat al DOM editable: veure limitacions a la tasca).
    if (m.lang !== activeLang) onRequestLang(m.lang);
  }, [matches, activeLang, onRequestLang]);

  const handleNext = useCallback(() => gotoMatch(activeIndex + 1), [gotoMatch, activeIndex]);
  const handlePrev = useCallback(() => gotoMatch(activeIndex - 1), [gotoMatch, activeIndex]);

  const openBar = useCallback(() => {
    setOpen(true);
    requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select(); });
  }, []);
  const closeBar = useCallback(() => setOpen(false), []);

  // Ctrl+F: listener addicional (mateix patró que l'editor de subtítols). Cada listener
  // ignora les accions que no tracta; el hook ja fa preventDefault del combo registrat.
  useKeyboardShortcuts('scriptEditor', (action) => {
    if (action !== 'FIND') return;
    if (open) {
      requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select(); });
      return;
    }
    openBar();
  });

  const handleReplaceOne = useCallback(() => {
    if (!isEditable) return;
    const m = matches[activeIndex];
    if (!m) return;
    const raw = contentFor(m.lang);
    const next = replaceVisibleRange(raw, m.start, m.end, replaceText);
    if (next === raw) { gotoMatch(activeIndex + 1); return; }
    // Re-ancora a la posició posterior al text inserit (mai re-coincideix dins d'ell).
    lastActivePosRef.current = { lang: m.lang, start: m.start + replaceText.length };
    if (m.lang !== activeLang) onRequestLang(m.lang);
    onReplaceLang(m.lang, next);
  }, [isEditable, matches, activeIndex, contentFor, replaceText, gotoMatch, activeLang, onRequestLang, onReplaceLang]);

  const handleReplaceAll = useCallback((): number => {
    if (!isEditable || matches.length === 0) return 0;
    let total = 0;
    for (const lang of targetLangs) {
      const raw = contentFor(lang);
      const ms = findMatchesInText(toVisibleText(raw), debouncedQuery, searchOpts);
      if (ms.length === 0) continue;
      // Dreta a esquerra: offsets estables. Un sol callback per idioma → un pas d'undo.
      let next = raw;
      for (let i = ms.length - 1; i >= 0; i--) {
        next = replaceVisibleRange(next, ms[i].start, ms[i].end, replaceText);
      }
      if (next === raw) continue;
      onReplaceLang(lang, next);
      total += ms.length;
    }
    return total;
  }, [isEditable, matches.length, targetLangs, contentFor, debouncedQuery, searchOpts, replaceText, onReplaceLang]);

  if (!open) return null;

  return (
    <ScriptSearchReplaceBar
      query={query}
      onQueryChange={setQuery}
      replaceText={replaceText}
      onReplaceTextChange={setReplaceText}
      caseSensitive={caseSensitive}
      onCaseSensitiveChange={setCaseSensitive}
      wholeWord={wholeWord}
      onWholeWordChange={setWholeWord}
      column={column}
      onColumnChange={setColumn}
      hasTranslation={hasTranslation}
      matchCount={matches.length}
      activeIndex={activeIndex}
      canReplace={isEditable}
      onNext={handleNext}
      onPrev={handlePrev}
      onReplace={handleReplaceOne}
      onReplaceAll={handleReplaceAll}
      onClose={closeBar}
      inputRef={inputRef}
    />
  );
};

export default ScriptSearchOverlay;
