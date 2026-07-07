import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { Segment, GeneralConfig } from '../../types/Subtitles';
import { OverlayConfig } from '../../appTypes';
import SegmentItem from './SegmentItem';
import { EyeIcon, EyeOffIcon, EarIcon, Languages, SearchIcon } from '../icons';
import { LinkIcon, LinkOffIcon } from '../VideoEditor/PlayerIcons';
import { SubtitleEditorProvider, useSubtitleEditor } from '../../context/SubtitleEditorContext';
import { useUserStyles } from '../../context/UserStyles/UserStylesContext';
import { useVirtualizer } from '@tanstack/react-virtual';
import { SrtFormatTag, allFullyTagged, toggleTagOnTexts } from '../../utils/SubtitlesEditor/formatTags';
import { findMatches, replaceVisibleRange, toVisibleText, SegmentMatch, SearchOptions } from '../../utils/SubtitlesEditor/searchReplace';
import SearchReplaceBar from './SearchReplaceBar';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

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
  /** Format en lot: aplica canvis de text a diversos segments de cop (un únic pas d'undo a la vista). */
  onSegmentsBatchChange?: (changes: Array<{ id: number; newText: string }>) => void;
}

// ── Cerca i substitució: suport del ressaltat ──
const HIGHLIGHTS_SUPPORTED = typeof CSS !== 'undefined' && 'highlights' in CSS;

/**
 * Converteix un rang d'offsets de TEXT VISIBLE (searchReplace.toVisibleText) a un Range
 * del DOM dins del contentEditable d'un segment. Correspondència exacta NOMÉS per a
 * tags canònics <b>/<i>/<u>: plainToRich els converteix en elements (0 caràcters de text),
 * igual que toVisibleText (els elimina); nodes de text = caràcters visibles (el U+00A0
 * hi compta 1, com l'espai), <br> = el \n del model visible. Amb tokens NO canònics
 * (<font …>) NO hi ha correspondència: plainToRich els mostra com a TEXT LITERAL i
 * toVisibleText els treu — per això el cridador comprova primer domVisibleLength
 * (guard defensiu) i no pinta el segment si les longituds no quadren.
 * Retorna null si els offsets cauen fora del contingut actual (p. ex. DOM a mig re-sync).
 */
function visibleOffsetsToRange(root: HTMLElement, start: number, end: number): Range | null {
  let pos = 0;
  let startNode: Node | null = null;
  let startOffset = 0;
  let endNode: Node | null = null;
  let endOffset = 0;
  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent || '').length;
      if (!startNode && pos + len > start) { startNode = node; startOffset = start - pos; }
      if (pos + len >= end) { endNode = node; endOffset = end - pos; return true; }
      pos += len;
      return false;
    }
    if (node.nodeName === 'BR') { pos += 1; return false; }
    for (let i = 0; i < node.childNodes.length; i++) {
      if (walk(node.childNodes[i])) return true;
    }
    return false;
  };
  walk(root);
  if (!startNode || !endNode) return null;
  const r = document.createRange();
  r.setStart(startNode, startOffset);
  r.setEnd(endNode, endOffset);
  return r;
}

/** Longitud de text visible del DOM d'un contentEditable (nodes de text + <br> = 1). */
function domVisibleLength(root: HTMLElement): number {
  let len = 0;
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) { len += (node.textContent || '').length; return; }
    if (node.nodeName === 'BR') { len += 1; return; }
    for (let i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i]);
  };
  walk(root);
  return len;
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
  onSegmentsBatchChange,
}) => {
  const { caretHintRef } = useSubtitleEditor();
  const [formatState, setFormatState] = useState({ bold: false, italic: false, underline: false });
  const [insertionsCollapsed, setInsertionsCollapsed] = useState(false);

  // ── Selecció múltiple de blocs (checkbox per bloc + Maj+clic per rang) — spec §4 ──
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const anchorIdRef = useRef<number | null>(null);
  const selectionEnabled = isEditable && !!onSegmentsBatchChange;

  const clearSelection = useCallback(() => {
    anchorIdRef.current = null;
    setSelectedIds(prev => (prev.size === 0 ? prev : new Set()));
  }, []);

  // Invalidació: quan canvia la longitud de l'array, el mapeig id→bloc deixa de ser
  // fiable (split/merge/insert/delete renumeren amb id: i+1; accept-insertion afegeix
  // un id efímer Date.now()) → un Set d'ids antics apuntaria a blocs equivocats.
  const prevSegmentsLengthRef = useRef(segments.length);
  useEffect(() => {
    if (segments.length !== prevSegmentsLengthRef.current) {
      prevSegmentsLengthRef.current = segments.length;
      clearSelection();
    }
  }, [segments.length, clearSelection]);

  // Invalidació: sortida del mode edició (o desaparició del callback)
  useEffect(() => {
    if (!selectionEnabled) clearSelection();
  }, [selectionEnabled, clearSelection]);

  // IMPORTANT: tota la lògica d'àncora i de càlcul de rang va FORA de l'updater de
  // setSelectedIds. L'updater ha de ser PUR: l'app corra sota <React.StrictMode>
  // (frontend/index.tsx) i en dev React pot invocar l'updater dues vegades — si
  // l'updater mutés anchorIdRef, la segona invocació llegiria l'àncora ja moguda
  // i el rang Maj+clic degeneraria al bloc clicat.
  const handleToggleSelect = useCallback((id: number, shiftKey: boolean) => {
    const anchor = anchorIdRef.current;
    anchorIdRef.current = id;
    if (shiftKey && anchor != null) {
      // Rang per ÍNDEX d'array (no aritmètica d'ids): àncora → bloc clicat, inclusius, unió.
      const aIdx = segments.findIndex(s => s.id === anchor);
      const tIdx = segments.findIndex(s => s.id === id);
      if (aIdx !== -1 && tIdx !== -1) {
        const [lo, hi] = aIdx <= tIdx ? [aIdx, tIdx] : [tIdx, aIdx];
        const rangeIds = segments.slice(lo, hi + 1).map(s => s.id as number);
        setSelectedIds(prev => {
          const next = new Set(prev);
          rangeIds.forEach(x => next.add(x));
          return next;
        });
        return;
      }
      // Àncora invàlida (no hauria de passar: la selecció es buida en canvis de longitud) → clic simple.
    }
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, [segments]);

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
    // Amb selecció múltiple activa: toggle en lot sobre els blocs seleccionats (spec §5).
    if (selectionEnabled && selectedIds.size > 0) {
      const tag: SrtFormatTag = command === 'bold' ? 'b' : command === 'italic' ? 'i' : 'u';
      const sel = segments.filter(s => selectedIds.has(s.id as number));
      const texts = sel.map(s => s.originalText || '');
      const newTexts = toggleTagOnTexts(texts, tag);
      const changes: Array<{ id: number; newText: string }> = [];
      sel.forEach((s, k) => {
        if (newTexts[k] !== texts[k]) changes.push({ id: s.id as number, newText: newTexts[k] });
      });
      if (changes.length > 0) onSegmentsBatchChange!(changes);
      return;
    }
    // Sense selecció: comportament actual (selecció de text dins el contentEditable enfocat).
    document.execCommand(command, false);
  };

  // Amb selecció activa, el ressaltat B/I/U reflecteix l'estat del lot (no el caret).
  const batchFormatState = useMemo(() => {
    if (!selectionEnabled || selectedIds.size === 0) return null;
    const texts = segments.filter(s => selectedIds.has(s.id as number)).map(s => s.originalText || '');
    return {
      bold: allFullyTagged(texts, 'b'),
      italic: allFullyTagged(texts, 'i'),
      underline: allFullyTagged(texts, 'u'),
    };
  }, [selectionEnabled, selectedIds, segments]);
  const shownFormatState = batchFormatState ?? formatState;

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

  const { subtitleRowEstimate } = useUserStyles();

  const virtualizer = useVirtualizer({
    count: segments.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => subtitleRowEstimate,
    overscan: 5,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [subtitleRowEstimate]);

  const virtualContainerRef = useRef<HTMLDivElement>(null);

  // Sync the virtual container's width to the scroll container's scrollWidth.
  // Absolute-positioned virtual items don't contribute to the parent's width
  // calculation, so the container stays viewport-width while content overflows.
  // By reading scrollWidth (which includes overflow) and applying it as minWidth,
  // all items (width: 100%) and their borders extend to the full scrollable width.
  const syncVirtualWidth = useCallback(() => {
    const scrollEl = scrollContainerRef.current;
    const vcEl = virtualContainerRef.current;
    if (!scrollEl || !vcEl) return;
    // Reset a auto primer perquè scrollWidth reflecteixi l'amplada real del contingut
    vcEl.style.minWidth = '100%';
    requestAnimationFrame(() => {
      const sw = scrollEl.scrollWidth;
      if (sw > 0) vcEl.style.minWidth = sw + 'px';
    });
  }, []);

  const virtualItems = virtualizer.getVirtualItems();
  useLayoutEffect(() => {
    syncVirtualWidth();
  }, [virtualItems.length, segments, syncVirtualWidth]);

  // Re-sync quan el panell es redimensiona (per exemple, arrossegant el separador)
  useEffect(() => {
    const scrollEl = scrollContainerRef.current;
    if (!scrollEl) return;
    const ro = new ResizeObserver(syncVirtualWidth);
    ro.observe(scrollEl);
    return () => ro.disconnect();
  }, [syncVirtualWidth]);

  // Auto-scroll to active segment via virtualizer
  useEffect(() => {
    if (activeId == null || !autoScroll) return;
    const idx = segments.findIndex(s => s.id === activeId);
    if (idx >= 0) {
      virtualizer.scrollToIndex(idx, { align: 'center', behavior: 'smooth' });
    }
  }, [activeId, autoScroll, segments, virtualizer]);

  // ── Cerca i substitució (spec 2026-07-02-search-replace-subtitles-design) ──
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Posició (segmentIndex, start) de l'última activa: re-ancoratge estable quan
  // `matches` es recalcula (edició, undo, canvi d'opcions) — spec §5.3.
  const lastActivePosRef = useRef<{ seg: number; start: number } | null>(null);
  // Scroll per INTENCIÓ (spec §6.1): només es fa scroll quan hi ha una acció explícita
  // (terme/opcions nous, Substituir) — mai perquè `matches` s'hagi recalculat per una
  // edició de text. La navegació ▲/▼ fa scroll imperatiu dins de gotoMatch.
  const pendingScrollRef = useRef(false);
  const replaceEnabled = isEditable && !!onSegmentsBatchChange;

  // Debounce només del terme (150ms): no ressaltar a mig teclejar.
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(searchQuery), 150);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  const searchOpts = useMemo<SearchOptions>(
    () => ({ caseSensitive, wholeWord }),
    [caseSensitive, wholeWord]
  );

  const matches = useMemo<SegmentMatch[]>(
    () => (searchOpen && debouncedQuery ? findMatches(segments, debouncedQuery, searchOpts) : []),
    [searchOpen, debouncedQuery, searchOpts, segments]
  );

  // Terme o opcions nous → la propera re-ancorada ha de fer scroll a la coincidència
  // re-ancorada (continuïtat de posició: la primera ≥ l'anterior activa, com Word/VSCode
  // — spec §5.3/§6.1). DECLARAT ABANS del re-ancoratge (l'ordre d'execució dels efectes
  // és el de declaració).
  useEffect(() => {
    pendingScrollRef.current = true;
  }, [debouncedQuery, searchOpts]);

  // Re-ancoratge de l'activa quan canvia la llista de coincidències. NOMÉS fa scroll
  // si hi ha una intenció pendent (terme nou, Substituir): les edicions de text
  // recalculen `matches` a cada pulsació i NO han de moure el viewport.
  useEffect(() => {
    if (matches.length === 0) {
      pendingScrollRef.current = false;
      setActiveMatchIndex(-1);
      return;
    }
    const pos = lastActivePosRef.current;
    let idx = 0;
    if (pos) {
      const found = matches.findIndex(
        m => m.segmentIndex > pos.seg || (m.segmentIndex === pos.seg && m.start >= pos.start)
      );
      idx = found === -1 ? 0 : found;
    }
    setActiveMatchIndex(idx);
    lastActivePosRef.current = { seg: matches[idx].segmentIndex, start: matches[idx].start };
    if (pendingScrollRef.current) {
      pendingScrollRef.current = false;
      virtualizer.scrollToIndex(matches[idx].segmentIndex, { align: 'center', behavior: 'smooth' });
    }
  }, [matches, virtualizer]);

  const gotoMatch = useCallback((idx: number) => {
    if (matches.length === 0) return;
    const n = ((idx % matches.length) + matches.length) % matches.length; // wrap-around
    setActiveMatchIndex(n);
    lastActivePosRef.current = { seg: matches[n].segmentIndex, start: matches[n].start };
    // Scroll imperatiu: també quan n === índex actual (única coincidència + wrap):
    // si l'usuari s'ha allunyat amb scroll manual, Enter el retorna al match (com Word).
    virtualizer.scrollToIndex(matches[n].segmentIndex, { align: 'center', behavior: 'smooth' });
  }, [matches, virtualizer]);
  const handleNextMatch = useCallback(() => gotoMatch(activeMatchIndex + 1), [gotoMatch, activeMatchIndex]);
  const handlePrevMatch = useCallback(() => gotoMatch(activeMatchIndex - 1), [gotoMatch, activeMatchIndex]);

  const openSearchBar = useCallback((prefill?: string) => {
    if (prefill) setSearchQuery(prefill);
    setSearchOpen(true);
    // Enfocar després del render (la barra pot no estar muntada encara).
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  }, []);

  const closeSearchBar = useCallback(() => {
    setSearchOpen(false);
    // El focus torna al contenidor de l'editor (spec §4.1): no deixar-lo en un input
    // desmuntat. Requereix tabIndex={-1} al contenidor de scroll (vegeu Step 5).
    scrollContainerRef.current?.focus();
  }, []);

  // Drecera FIND (Ctrl+F). Listener addicional al de la vista pare (mateix appId):
  // cadascú ignora les accions que no tracta. Prefill amb la selecció de text si és
  // dins d'un contentEditable de segment i d'una sola línia (criteri Word).
  const handleShortcutAction = useCallback((action: string) => {
    if (action !== 'FIND') return;
    // Barra ja oberta: NOMÉS re-enfocar i seleccionar el camp (spec §4.1); mai re-prefilar.
    if (searchOpen) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      });
      return;
    }
    let prefill: string | undefined;
    const sel = window.getSelection();
    const anchorEl = sel?.anchorNode instanceof Element ? sel.anchorNode : sel?.anchorNode?.parentElement;
    if (
      sel && !sel.isCollapsed && sel.anchorNode &&
      anchorEl?.closest('[contenteditable]') &&
      scrollContainerRef.current?.contains(sel.anchorNode)
    ) {
      const text = sel.toString();
      if (text && !text.includes('\n')) prefill = text;
    }
    openSearchBar(prefill);
  }, [openSearchBar, searchOpen]);
  useKeyboardShortcuts('subtitlesEditor', handleShortcutAction);

  // Substituir la coincidència activa (1 pas d'undo). L'activa següent es re-ancora
  // a la primera posició ≥ (segment, start + longitud inserida): mai re-coincideix
  // dins del text acabat d'inserir ("a" → "aa" no fa bucle) — spec §7.1.
  const handleReplaceOne = useCallback(() => {
    if (!replaceEnabled) return;
    const m = matches[activeMatchIndex];
    if (!m) return;
    const seg = segments[m.segmentIndex];
    if (!seg || seg.id !== m.segmentId) return;
    const newRaw = replaceVisibleRange(seg.originalText || '', m.start, m.end, replaceText);
    if (newRaw === (seg.originalText || '')) {
      // Substitució sense efecte (p. ex. terme == substitució): el commit de la vista
      // faria bail per igualtat profunda (historyManager) i cap re-render consumiria
      // pendingScrollRef → NO tocar els flags; saltar a la següent com fa Word.
      gotoMatch(activeMatchIndex + 1);
      return;
    }
    lastActivePosRef.current = { seg: m.segmentIndex, start: m.start + replaceText.length };
    pendingScrollRef.current = true; // el re-ancoratge farà scroll a la següent coincidència
    onSegmentsBatchChange!([{ id: m.segmentId, newText: newRaw }]);
  }, [replaceEnabled, matches, activeMatchIndex, segments, replaceText, onSegmentsBatchChange, gotoMatch]);

  // Substituir-ho tot: per segment, de dreta a esquerra (offsets estables), un únic
  // batch = un únic pas d'undo. Retorna el total per al missatge de la barra.
  const handleReplaceAll = useCallback((): number => {
    if (!replaceEnabled || matches.length === 0) return 0;
    const bySegIndex = new Map<number, SegmentMatch[]>();
    for (const m of matches) {
      const arr = bySegIndex.get(m.segmentIndex);
      if (arr) arr.push(m); else bySegIndex.set(m.segmentIndex, [m]);
    }
    const changes: Array<{ id: number; newText: string }> = [];
    let count = 0; // coincidències realment substituïdes (coherent amb la guarda defensiva)
    bySegIndex.forEach((ms, segIndex) => {
      const seg = segments[segIndex];
      if (!seg || seg.id !== ms[0].segmentId) return;
      let raw = seg.originalText || '';
      for (let i = ms.length - 1; i >= 0; i--) {
        raw = replaceVisibleRange(raw, ms[i].start, ms[i].end, replaceText);
      }
      changes.push({ id: seg.id, newText: raw });
      count += ms.length;
    });
    if (changes.length === 0) return 0;
    onSegmentsBatchChange!(changes);
    return count;
  }, [replaceEnabled, matches, segments, replaceText, onSegmentsBatchChange]);

  // (El scroll a la coincidència activa és per INTENCIÓ: efecte de terme nou +
  // re-ancoratge amb pendingScrollRef, scroll imperatiu a gotoMatch, i flag a
  // handleReplaceOne — vegeu més amunt. Cap efecte depèn de la posició de l'activa:
  // teclejar en qualsevol bloc amb la barra oberta MAI mou el viewport.)

  // Ressaltat via CSS Custom Highlight API: pinta les coincidències de les files
  // RENDERITZADES (virtualitzador); les altres es pinten soles en fer-hi scroll
  // (l'efecte depèn de virtualItems). No muta el DOM → no contamina richToPlain.
  useEffect(() => {
    if (!HIGHLIGHTS_SUPPORTED) return;
    const registry = (CSS as any).highlights as Map<string, unknown>;
    registry.delete('srt-search');
    registry.delete('srt-search-active');
    if (!searchOpen || matches.length === 0) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const bySegIndex = new Map<number, Array<{ m: SegmentMatch; isActive: boolean }>>();
    matches.forEach((m, i) => {
      const arr = bySegIndex.get(m.segmentIndex);
      const entry = { m, isActive: i === activeMatchIndex };
      if (arr) arr.push(entry); else bySegIndex.set(m.segmentIndex, [entry]);
    });
    const normal: Range[] = [];
    const active: Range[] = [];
    container.querySelectorAll<HTMLElement>('[data-index]').forEach((row: HTMLElement) => {
      const idx = Number(row.dataset.index);
      const entries = bySegIndex.get(idx);
      if (!entries) return;
      const editable = row.querySelector<HTMLElement>('[contenteditable]');
      if (!editable) return;
      // Guard defensiu: si la longitud visible del DOM no quadra amb la del model
      // (tokens no canònics mostrats com a text literal per plainToRich, o DOM a mig
      // editar amb <div> del navegador), NO es pinta aquest segment — la cerca, el
      // comptador i la substitució segueixen funcionant igualment.
      const seg = segments[idx];
      if (!seg || domVisibleLength(editable) !== toVisibleText(seg.originalText || '').length) return;
      for (const { m, isActive } of entries) {
        const r = visibleOffsetsToRange(editable, m.start, m.end);
        if (r) (isActive ? active : normal).push(r);
      }
    });
    const HighlightCtor = (window as any).Highlight;
    if (normal.length > 0) registry.set('srt-search', new HighlightCtor(...normal));
    if (active.length > 0) registry.set('srt-search-active', new HighlightCtor(...active));
    return () => {
      registry.delete('srt-search');
      registry.delete('srt-search-active');
    };
  }, [searchOpen, matches, activeMatchIndex, virtualItems, segments]);

  // Fallback sense Highlight API: fons de fila del bloc de la coincidència activa.
  const fallbackActiveSegIndex =
    !HIGHLIGHTS_SUPPORTED && searchOpen && activeMatchIndex >= 0
      ? matches[activeMatchIndex]?.segmentIndex ?? -1
      : -1;

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

                <button
                    title="Cercar i substituir (Ctrl+F)"
                    onClick={() => (searchOpen ? closeSearchBar() : openSearchBar())}
                    className={`p-1.5 rounded transition-colors ${searchOpen ? '' : 'text-gray-500 hover:bg-white/10'}`}
                    style={searchOpen ? { color: 'var(--th-accent-text)', backgroundColor: 'var(--th-accent-muted)' } : undefined}
                >
                    <SearchIcon className="w-4 h-4" />
                </button>

                <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--th-bg-tertiary)' }} />

                {selectionEnabled && selectedIds.size > 0 && (
                  <div
                    className="flex items-center gap-1 px-1.5 h-7 rounded"
                    style={{ backgroundColor: 'var(--th-accent-muted)', color: 'var(--th-accent-text)' }}
                    title={`${selectedIds.size} blocs seleccionats`}
                  >
                    <span className="text-[10px] font-black tabular-nums whitespace-nowrap">{selectedIds.size} sel.</span>
                    <button
                      onClick={clearSelection}
                      className="w-4 h-4 rounded flex items-center justify-center hover:bg-white/20 text-[10px] font-black leading-none"
                      title="Esborrar selecció"
                    >✕</button>
                  </div>
                )}

                <div className="flex items-center gap-1">
                    <button
                        onMouseDown={(e) => { e.preventDefault(); handleFormatAction('bold'); }}
                        className={`w-7 h-7 rounded flex items-center justify-center text-xs font-black transition-colors ${shownFormatState.bold ? 'shadow-sm' : 'hover:bg-white/10'}`}
                        style={shownFormatState.bold ? { backgroundColor: 'var(--th-accent)', color: 'var(--th-text-inverse)' } : { color: 'var(--th-editor-meta)' }}
                        title="Negreta (Ctrl+B)"
                    >B</button>
                    <button
                        onMouseDown={(e) => { e.preventDefault(); handleFormatAction('italic'); }}
                        className={`w-7 h-7 rounded flex items-center justify-center text-xs italic font-serif transition-colors ${shownFormatState.italic ? 'shadow-sm' : 'hover:bg-white/10'}`}
                        style={shownFormatState.italic ? { backgroundColor: 'var(--th-accent)', color: 'var(--th-text-inverse)' } : { color: 'var(--th-editor-meta)' }}
                        title="Cursiva (Ctrl+I)"
                    >I</button>
                    <button
                        onMouseDown={(e) => { e.preventDefault(); handleFormatAction('underline'); }}
                        className={`w-7 h-7 rounded flex items-center justify-center text-xs underline transition-colors ${shownFormatState.underline ? 'shadow-sm' : 'hover:bg-white/10'}`}
                        style={shownFormatState.underline ? { backgroundColor: 'var(--th-accent)', color: 'var(--th-text-inverse)' } : { color: 'var(--th-editor-meta)' }}
                        title="Subratllat (Ctrl+U)"
                    >U</button>
                </div>

            </div>
        </div>
      </header>

      {searchOpen && (
        <SearchReplaceBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          replaceText={replaceText}
          onReplaceTextChange={setReplaceText}
          caseSensitive={caseSensitive}
          onCaseSensitiveChange={setCaseSensitive}
          wholeWord={wholeWord}
          onWholeWordChange={setWholeWord}
          matchCount={matches.length}
          activeIndex={activeMatchIndex}
          canReplace={replaceEnabled}
          onNext={handleNextMatch}
          onPrev={handlePrevMatch}
          onReplace={handleReplaceOne}
          onReplaceAll={handleReplaceAll}
          onClose={closeSearchBar}
          inputRef={searchInputRef}
        />
      )}

      <div ref={scrollContainerRef} tabIndex={-1} className="flex-grow overflow-auto custom-scrollbar outline-none">
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
                    backgroundColor: virtualRow.index === fallbackActiveSegIndex ? 'var(--th-accent-muted)' : undefined,
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
                    isSelected={selectionEnabled && selectedIds.has(segment.id as number)}
                    selectionActive={selectionEnabled && selectedIds.size > 0}
                    onToggleSelect={selectionEnabled ? handleToggleSelect : undefined}
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