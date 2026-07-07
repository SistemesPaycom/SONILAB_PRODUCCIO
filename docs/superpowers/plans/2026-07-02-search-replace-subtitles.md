# Cerca i Substitució a l'Editor de Subtítols — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-02-search-replace-subtitles-design.md`

**Goal:** Barra de cerca i substitució tipus Word a la part superior de l'editor de subtítols (lupa + Ctrl+F): cerca literal en viu amb opcions Aa/paraula completa, navegació amb ressaltat, i substitució d'una coincidència o de totes (un pas d'undo per operació).

**Architecture:** Tot l'estat i la UI viuen a `SubtitlesEditorInner` (component compartit per les dues vistes; cap canvi a les vistes — el callback `onSegmentsBatchChange` ja hi és). La lògica de coincidències i de substitució amb herència de format és un mòdul nou de funcions pures (`searchReplace.ts`) basat en un model de caràcters visibles amb pila de tags. El ressaltat usa CSS Custom Highlight API (no muta el DOM del contentEditable).

**Tech Stack:** React 19 + TypeScript 5.8, Vite, `@tanstack/react-virtual` (virtualitzador existent), CSS Custom Highlight API (`CSS.highlights` + `::highlight()`), tags SRT literals (`<b>/<i>/<u>`) dins `Segment.originalText`.

## Global Constraints

- **NO fer cap commit de git.** El CLAUDE.md del repo ho prohibeix sense petició explícita de l'usuari. Tot queda al working tree.
- **Les vistes NO es toquen**: `VideoSubtitlesEditorView.tsx` i `VideoSrtStandaloneEditorView.tsx` queden intactes (tenen canvis previs no commitejats aliens a aquest pla — no tocar-los ni revertir-los).
- Offsets sempre en **unitats UTF-16** (índexs de string JS), coherents amb `indexOf`, amb el DOM (`Range.setStart`) i entre `toVisibleText` i el model de caràcters.
- Text visible: qualsevol `<[^>]*>` és markup invisible; ` ` es normalitza a espai (longitud 1↔1); `\n` és un caràcter visible.
- Cerca **literal** (mai regex sobre el terme de l'usuari; si es fa servir regex intern, el terme mai s'hi interpola).
- La substitució NOMÉS modifica `originalText` via `onSegmentsBatchChange` (que ja posa `richText: ''` a les vistes); mai `startTime`/`endTime`.
- Substituir-un = 1 crida a `onSegmentsBatchChange` (1 pas d'undo). Substituir-ho-tot = 1 crida amb tots els canvis (1 pas d'undo).
- Mai generar parells de tags buits (`<i></i>`) nous en re-serialitzar.
- Strings d'UI en **català**. Noms d'highlight: `srt-search` i `srt-search-active`.
- Comprovació de tipus: `cd d:/Documents_L/MisProgramas/SONILAB_PROD_SUBTITOLS/frontend && npx tsc --noEmit` → zero errors. Build: `npm run build` → zero errors.
- No hi ha infraestructura de tests al projecte i **no se n'afegeix**; la lògica pura es verifica amb un script temporal al scratchpad (Task 1) transpilat amb esbuild (dependència transitiva de Vite).
- Rutes absolutes: arrel del repo = `d:\Documents_L\MisProgramas\SONILAB_PROD_SUBTITOLS`; scratchpad de la sessió = `D:/AppData/Local/Temp/claude/d--Documents-L-MisProgramas-SONILAB-PROD-SUBTITOLS/4bafc9fb-074b-4856-8b92-6fc40c74ad8d/scratchpad`.

---

### Task 1: Mòdul pur `searchReplace.ts` + verificació de lògica

**Files:**
- Create: `frontend/utils/SubtitlesEditor/searchReplace.ts`
- Create (temporal, NO al repo): `D:/AppData/Local/Temp/claude/d--Documents-L-MisProgramas-SONILAB-PROD-SUBTITOLS/4bafc9fb-074b-4856-8b92-6fc40c74ad8d/scratchpad/verify-searchReplace.mjs`

**Interfaces:**
- Produces (consumides per Task 3):
  - `export interface SearchOptions { caseSensitive: boolean; wholeWord: boolean; }`
  - `export interface SegmentMatch { segmentId: number; segmentIndex: number; start: number; end: number; }` (offsets sobre text visible)
  - `toVisibleText(raw: string): string`
  - `findMatchesInText(visible: string, query: string, opts: SearchOptions): Array<{ start: number; end: number }>`
  - `findMatches(segments: Array<{ id: number; originalText: string }>, query: string, opts: SearchOptions): SegmentMatch[]`
  - `replaceVisibleRange(raw: string, start: number, end: number, replacement: string): string`

- [ ] **Step 1: Escriure el script de verificació (fallarà fins que existeixi el mòdul)**

Crear `verify-searchReplace.mjs` al scratchpad (crear el directori si no existeix) amb aquest contingut exacte:

```javascript
// verify-searchReplace.mjs — verificació de la lògica pura de searchReplace.ts
// Ús: node verify-searchReplace.mjs   (requereix searchReplace.mjs transpilat al mateix directori)
import {
  toVisibleText, findMatchesInText, findMatches, replaceVisibleRange,
} from './searchReplace.mjs';

let fails = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { console.log(`OK   ${name}`); }
  else { fails++; console.log(`FAIL ${name}\n  got:  ${g}\n  want: ${w}`); }
};
const CI = { caseSensitive: false, wholeWord: false };
const CS = { caseSensitive: true, wholeWord: false };
const WW = { caseSensitive: false, wholeWord: true };

// ── toVisibleText ──
eq('vis sense tags', toVisibleText('hola'), 'hola');
eq('vis treu tags canonics', toVisibleText('<i>hola</i> <b>be</b>'), 'hola be');
eq('vis treu tags no canonics', toVisibleText('<font color="x">a</font>'), 'a');
eq('vis conserva \\n', toVisibleText('l1\nl2'), 'l1\nl2');
eq('vis nbsp a espai', toVisibleText('a\u00A0b'), 'a b');
eq('vis < solt es visible', toVisibleText('2<3'), '2<3');
eq('vis buit', toVisibleText(''), '');

// ── findMatchesInText: literal + case folding ──
eq('find simple', findMatchesInText('hola hola', 'hola', CI), [{ start: 0, end: 4 }, { start: 5, end: 9 }]);
eq('find insensible per defecte', findMatchesInText('Hola HOLA', 'hola', CI), [{ start: 0, end: 4 }, { start: 5, end: 9 }]);
eq('find accents insensible', findMatchesInText('CÀMERA', 'càmera', CI), [{ start: 0, end: 6 }]);
eq('find sensible Aa', findMatchesInText('Hola hola', 'hola', CS), [{ start: 5, end: 9 }]);
eq('find sense resultat', findMatchesInText('abc', 'z', CI), []);
eq('find terme buit', findMatchesInText('abc', '', CI), []);
eq('find no solapa', findMatchesInText('aaaa', 'aa', CI), [{ start: 0, end: 2 }, { start: 2, end: 4 }]);
eq('find espais literals', findMatchesInText('a  b', ' ', CI), [{ start: 1, end: 2 }, { start: 2, end: 3 }]);
eq('find nbsp al query es normalitza', findMatchesInText('a b c', 'a\u00A0b', CI), [{ start: 0, end: 3 }]);
eq('find no travessa \\n', findMatchesInText('buenos\ndías', 'buenos días', CI), []);

// ── findMatchesInText: paraula completa ──
eq('ww simple', findMatchesInText('el gat i el gos', 'el', WW), [{ start: 0, end: 2 }, { start: 9, end: 11 }]);
eq('ww no dins de paraula', findMatchesInText('cartell', 'art', WW), []);
eq('ww accents son lletra', findMatchesInText('un dia diàfan', 'dia', WW), [{ start: 3, end: 6 }]);
eq('ww apostrof separa', findMatchesInText("l'home", 'l', WW), [{ start: 0, end: 1 }]);
eq('ww inici i final de text', findMatchesInText('sol', 'sol', WW), [{ start: 0, end: 3 }]);
eq('ww limit de linia', findMatchesInText('el\nsol', 'sol', WW), [{ start: 3, end: 6 }]);
eq('ww digits son paraula', findMatchesInText('a12b 12', '12', WW), [{ start: 5, end: 7 }]);

// ── findMatches (document) ──
const segs = [
  { id: 1, originalText: 'Bona nit' },
  { id: 2, originalText: '<i>bona</i> tarda' },
  { id: 3, originalText: 'res' },
];
eq('doc ordre i offsets visibles', findMatches(segs, 'bona', CI), [
  { segmentId: 1, segmentIndex: 0, start: 0, end: 4 },
  { segmentId: 2, segmentIndex: 1, start: 0, end: 4 },
]);
eq('doc terme buit', findMatches(segs, '', CI), []);

// ── replaceVisibleRange: herència de format (spec §7.3) ──
eq('rep dins format', replaceVisibleRange('<i>buenos días</i>', 7, 11, 'tardes'), '<i>buenos tardes</i>');
eq('rep travessa limit → pila del 1r char', replaceVisibleRange('buenos <i>días</i>', 0, 11, 'hola'), 'hola');
eq('rep comença dins format', replaceVisibleRange('<b>bue</b>nos', 0, 6, 'malos'), '<b>malos</b>');
eq('rep sense tags', replaceVisibleRange('hola mon', 5, 8, 'terra'), 'hola terra');
eq('rep buida (esborrar)', replaceVisibleRange('ab<i>cd</i>ef', 2, 4, ''), 'abef');
eq('rep buida tot el text', replaceVisibleRange('<i>tot</i>', 0, 3, ''), '');
eq('rep conserva tags posteriors', replaceVisibleRange('xx <b>b</b> yy', 0, 2, 'zz'), 'zz <b>b</b> yy');
eq('rep multilinia no tocada', replaceVisibleRange('l1\nl2 foo', 6, 9, 'bar'), 'l1\nl2 bar');
eq('rep desequilibrat es normalitza', replaceVisibleRange('<i>abc', 0, 1, 'X'), '<i>Xbc</i>');
eq('rep niat mateix tag', replaceVisibleRange('<i>a<i>b</i>c</i>', 1, 2, 'X'), '<i>aXc</i>');
eq('rep nbsp es normalitza a espai (nomes al segment tocat)', replaceVisibleRange('a\u00A0b cd', 4, 6, 'e'), 'a b e');
eq('rep token opac re-ancorat', replaceVisibleRange('<font color="r">ab</font>cd', 0, 2, 'X'), '<font color="r">X</font>cd');
eq('rep multilinia amb format en bloc normalitza per linia',
   replaceVisibleRange('<i>l1\nl2</i>', 0, 1, 'X'), '<i>X1</i>\n<i>l2</i>');

// ── dreta→esquerra (patró de Substituir-ho tot) ──
{
  const raw = 'la la la';
  const ms = findMatchesInText(toVisibleText(raw), 'la', CI);
  let out = raw;
  for (let i = ms.length - 1; i >= 0; i--) out = replaceVisibleRange(out, ms[i].start, ms[i].end, 'na na');
  eq('replace-all dreta a esquerra', out, 'na na na na na na');
}

console.log(fails === 0 ? '\nTOTS ELS CASOS OK' : `\n${fails} CASOS FALLITS`);
process.exit(fails === 0 ? 0 : 1);
```

- [ ] **Step 2: Executar-lo per confirmar que falla (el mòdul no existeix)**

```bash
cd D:/AppData/Local/Temp/claude/d--Documents-L-MisProgramas-SONILAB-PROD-SUBTITOLS/4bafc9fb-074b-4856-8b92-6fc40c74ad8d/scratchpad && node verify-searchReplace.mjs
```
Expected: `ERR_MODULE_NOT_FOUND` — `Cannot find module '…\searchReplace.mjs'`.

- [ ] **Step 3: Crear `frontend/utils/SubtitlesEditor/searchReplace.ts`**

Contingut complet del fitxer:

```typescript
// utils/SubtitlesEditor/searchReplace.ts

/**
 * Cerca i substitució LITERAL sobre el text visible dels subtítols SRT.
 * - "Text visible" = el text sense cap seqüència <...> (criteri idèntic a
 *   textMetrics.stripSrtTags), amb U+00A0 normalitzat a espai i amb \n com a caràcter.
 * - Tots els offsets són unitats UTF-16 (índexs de string JS), coherents amb el DOM.
 * - La substitució opera sobre un model de caràcters amb pila de tags canònics
 *   (<b>/<i>/<u>): el text inserit hereta la pila del primer caràcter substituït
 *   (criteri Word). La re-serialització balanceja tags per línia i mai emet parells buits.
 * Funcions pures: sense DOM, sense React (verificables de manera aïllada).
 */

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
}

/** Coincidència en offsets de TEXT VISIBLE del segment. */
export interface SegmentMatch {
  segmentId: number;
  segmentIndex: number;
  start: number;
  end: number;
}

const TOKEN_RE = /<[^>]*>/g;
const CANONICAL_RE = /^<(\/?)([biu])>$/i;
const WORD_CHAR_RE = /[\p{L}\p{N}]/u;

/** Text visible d'un text SRT cru: treu tot <...>, normalitza U+00A0 → espai. Conserva \n. */
export function toVisibleText(raw: string): string {
  if (!raw) return '';
  return raw.replace(TOKEN_RE, '').replace(/\u00A0/g, ' ');
}

/**
 * Case folding segur per a offsets: minúscula caràcter a caràcter (per code point),
 * conservant el caràcter original si el fold canviés la longitud UTF-16 (casos exòtics
 * tipus 'İ'). Garanteix |fold(s)| === |s| → els offsets del text foldejat valen per a l'original.
 */
function foldForSearch(s: string): string {
  let out = '';
  for (const ch of s) {
    const low = ch.toLowerCase();
    out += low.length === ch.length ? low : ch;
  }
  return out;
}

/** Coincidències literals dins d'un text visible, sense solapaments (avança per `end`). */
export function findMatchesInText(
  visible: string,
  query: string,
  opts: SearchOptions
): Array<{ start: number; end: number }> {
  const res: Array<{ start: number; end: number }> = [];
  if (!query) return res;
  // El query pot dur U+00A0 (p. ex. prefill des del DOM que genera plainToRich amb &nbsp;):
  // normalitzar-lo igual que el text visible. Mateixa longitud → offsets intactes.
  const q = query.replace(/\u00A0/g, ' ');
  const hay = opts.caseSensitive ? visible : foldForSearch(visible);
  const needle = opts.caseSensitive ? q : foldForSearch(q);
  const isWordChar = (ch: string | undefined) => !!ch && WORD_CHAR_RE.test(ch);
  let from = 0;
  for (;;) {
    const i = hay.indexOf(needle, from);
    if (i === -1) break;
    const end = i + needle.length;
    if (!opts.wholeWord || (!isWordChar(visible[i - 1]) && !isWordChar(visible[end]))) {
      res.push({ start: i, end });
      from = end;
    } else {
      from = i + 1;
    }
  }
  return res;
}

/** Coincidències de tot el document, en ordre (índex de segment, offset). */
export function findMatches(
  segments: Array<{ id: number; originalText: string }>,
  query: string,
  opts: SearchOptions
): SegmentMatch[] {
  const out: SegmentMatch[] = [];
  if (!query) return out;
  segments.forEach((seg, segmentIndex) => {
    const visible = toVisibleText(seg.originalText || '');
    for (const m of findMatchesInText(visible, query, opts)) {
      out.push({ segmentId: seg.id, segmentIndex, start: m.start, end: m.end });
    }
  });
  return out;
}

// ── Model de caràcters (base de la substitució amb herència de format) ──

interface VisChar {
  ch: string;        // 1 unitat UTF-16 (U+00A0 del text original ja normalitzat a espai; els caràcters inserits per replacement es mantenen tal qual)
  stack: string[];   // pila EFECTIVA de tags canònics oberts (sense duplicats, ordre d'obertura)
  pre: string[];     // tokens opacs (<font …>, etc.) ancorats just abans d'aquest caràcter
}

interface CharModel {
  chars: VisChar[];
  trailing: string[]; // tokens opacs després de l'últim caràcter visible
}

/**
 * Un únic recorregut amb /<[^>]*>/g. Tags canònics (case-insensitive) mantenen una
 * pila amb repeticions (un <i> niat dins d'un altre no perd la cursiva en tancar-ne un);
 * la pila efectiva per caràcter es dedueix sense duplicats. Un tag obert sense tancar
 * cobreix fins al final (mateixa tolerància que formatTags.isFullyTagged).
 * Qualsevol altre token <...> es conserva com a opac, ancorat al caràcter visible següent.
 */
function parseCharModel(raw: string): CharModel {
  const chars: VisChar[] = [];
  let pending: string[] = [];
  const rawStack: string[] = [];
  let effective: string[] = [];
  const recompute = () => {
    effective = rawStack.filter((t, i) => rawStack.indexOf(t) === i);
  };
  const pushText = (text: string) => {
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      chars.push({ ch: c === '\u00A0' ? ' ' : c, stack: effective, pre: pending });
      pending = [];
    }
  };
  const re = new RegExp(TOKEN_RE.source, 'g');
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    pushText(raw.slice(lastIndex, m.index));
    const tok = m[0];
    const cm = CANONICAL_RE.exec(tok);
    if (cm) {
      const tag = cm[2].toLowerCase();
      if (cm[1] === '/') {
        const at = rawStack.lastIndexOf(tag);
        if (at !== -1) rawStack.splice(at, 1);
      } else {
        rawStack.push(tag);
      }
      recompute();
    } else {
      pending.push(tok);
    }
    lastIndex = m.index + tok.length;
  }
  pushText(raw.slice(lastIndex));
  return { chars, trailing: pending };
}

/**
 * Re-serialitza el model: obre/tanca tags canònics quan la pila canvia entre caràcters
 * consecutius; el \n força pila buida per a ell mateix → forma per-línia
 * (<i>l1</i>\n<i>l2</i>), la mateixa convenció que formatTags.wrapTagPerLine.
 * Els tokens opacs s'emeten a la seva àncora (entre els tancaments i les obertures).
 * Mai s'emeten parells buits: els tags només s'obren quan hi ha un caràcter a dins.
 */
function serializeCharModel(model: CharModel): string {
  let out = '';
  let open: string[] = [];
  for (const c of model.chars) {
    const target = c.ch === '\n' ? [] : c.stack;
    let common = 0;
    while (common < open.length && common < target.length && open[common] === target[common]) common++;
    for (let i = open.length - 1; i >= common; i--) out += `</${open[i]}>`;
    open = open.slice(0, common);
    for (const tok of c.pre) out += tok;
    for (let i = common; i < target.length; i++) {
      out += `<${target[i]}>`;
      open.push(target[i]);
    }
    out += c.ch;
  }
  for (let i = open.length - 1; i >= 0; i--) out += `</${open[i]}>`;
  for (const tok of model.trailing) out += tok;
  return out;
}

/**
 * Substitueix el rang visible [start, end) del text CRU per `replacement` (text pla).
 * Els caràcters inserits hereten la pila de tags del PRIMER caràcter substituït.
 * Els tokens opacs ancorats a caràcters eliminats es re-ancoren al primer caràcter
 * supervivent posterior (o al final). El segment re-serialitzat queda normalitzat
 * (tags balancejats, forma per-línia) — només canvia el segment substituït.
 */
export function replaceVisibleRange(raw: string, start: number, end: number, replacement: string): string {
  const model = parseCharModel(raw);
  const stack = model.chars[start] ? model.chars[start].stack : [];
  const carried = model.chars.slice(start, end).flatMap(c => c.pre);
  const inserted: VisChar[] = [];
  for (let i = 0; i < replacement.length; i++) {
    inserted.push({ ch: replacement[i], stack, pre: i === 0 ? carried : [] });
  }
  const chars = [...model.chars.slice(0, start), ...inserted, ...model.chars.slice(end)];
  let trailing = model.trailing;
  if (inserted.length === 0 && carried.length > 0) {
    const next = chars[start];
    if (next) chars[start] = { ...next, pre: [...carried, ...next.pre] };
    else trailing = [...carried, ...trailing];
  }
  return serializeCharModel({ chars, trailing });
}
```

- [ ] **Step 4: Transpilar i executar la verificació**

```bash
cd d:/Documents_L/MisProgramas/SONILAB_PROD_SUBTITOLS/frontend && npx esbuild utils/SubtitlesEditor/searchReplace.ts --format=esm --outfile=D:/AppData/Local/Temp/claude/d--Documents-L-MisProgramas-SONILAB-PROD-SUBTITOLS/4bafc9fb-074b-4856-8b92-6fc40c74ad8d/scratchpad/searchReplace.mjs
cd D:/AppData/Local/Temp/claude/d--Documents-L-MisProgramas-SONILAB-PROD-SUBTITOLS/4bafc9fb-074b-4856-8b92-6fc40c74ad8d/scratchpad && node verify-searchReplace.mjs
```
Expected: totes les línies `OK`, final `TOTS ELS CASOS OK`, exit code 0.
(Si `npx esbuild` no estigués disponible: copiar el cos del .ts a `searchReplace.mjs` esborrant només anotacions de tipus i `interface`s — el codi és JS pur altrament.)

- [ ] **Step 5: TypeScript check**

```bash
cd d:/Documents_L/MisProgramas/SONILAB_PROD_SUBTITOLS/frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: zero errors.

---

### Task 2: Component `SearchReplaceBar.tsx`

**Files:**
- Create: `frontend/components/VideoSubtitlesEditor/SearchReplaceBar.tsx`

**Interfaces:**
- Consumes: res (component controlat pur; no depèn de Task 1).
- Produces (consumit per Task 3): `export default SearchReplaceBar` amb props:
  - `query: string`, `onQueryChange: (q: string) => void`
  - `replaceText: string`, `onReplaceTextChange: (t: string) => void`
  - `caseSensitive: boolean`, `onCaseSensitiveChange: (v: boolean) => void`
  - `wholeWord: boolean`, `onWholeWordChange: (v: boolean) => void`
  - `matchCount: number`, `activeIndex: number` (−1 = cap)
  - `canReplace: boolean` (mostra/amaga la fila 2)
  - `onNext: () => void`, `onPrev: () => void`, `onReplace: () => void`
  - `onReplaceAll: () => number` (retorna el nombre de substitucions fetes)
  - `onClose: () => void`
  - `inputRef: React.RefObject<HTMLInputElement | null>`

- [ ] **Step 1: Crear el component complet**

Contingut complet del fitxer:

```tsx
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
```

- [ ] **Step 2: TypeScript check**

```bash
cd d:/Documents_L/MisProgramas/SONILAB_PROD_SUBTITOLS/frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: zero errors (el component encara no té consumidors).

---

### Task 3: Integració a `SubtitlesEditor.tsx`

**Files:**
- Modify: `frontend/components/VideoSubtitlesEditor/SubtitlesEditor.tsx`

**Interfaces:**
- Consumes: `searchReplace.ts` (Task 1); `SearchReplaceBar` (Task 2); `useKeyboardShortcuts` (hook existent); prop existent `onSegmentsBatchChange`; `virtualizer`/`scrollContainerRef`/`virtualItems` existents.
- Produces: acció de teclat `FIND` consumida (la drecera es defineix a Task 4; sense ella, el botó lupa ja funciona).

**Referències de línia sobre l'estat ACTUAL del fitxer** (les línies es desplacen a mesura que s'insereixen blocs; localitzar per contingut).

- [ ] **Step 1: Imports**

A la capçalera del fitxer:
- Línia 5, substituir `import { EyeIcon, EyeOffIcon, EarIcon, Languages } from '../icons';` per:
```typescript
import { EyeIcon, EyeOffIcon, EarIcon, Languages, SearchIcon } from '../icons';
```
- Sota la línia 10 (`import { SrtFormatTag, ... } from '.../formatTags';`) afegir:
```typescript
import { findMatches, replaceVisibleRange, toVisibleText, SegmentMatch, SearchOptions } from '../../utils/SubtitlesEditor/searchReplace';
import SearchReplaceBar from './SearchReplaceBar';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
```

- [ ] **Step 2: Helpers a nivell de mòdul**

Just abans de `const SubtitlesEditorInner: React.FC<SubtitlesEditorProps> = ({` (línia ~57) afegir:

```typescript
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
```

- [ ] **Step 3: Estat, coincidències, navegació i substitució**

Inserir el bloc sencer just **després** de l'efecte d'auto-scroll existent (el `useEffect` que crida `virtualizer.scrollToIndex(idx, { align: 'center', behavior: 'smooth' })` i tanca amb `}, [activeId, autoScroll, segments, virtualizer]);`, línia ~294) i **abans** del `return (`:

```typescript
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
    container.querySelectorAll<HTMLElement>('[data-index]').forEach(row => {
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
```

- [ ] **Step 4: Botó lupa a la capçalera**

Just **després** del botó de sincronització (el `<button>` amb `title={syncEnabled ? "Desactivar sincronització" : "Activar sincronització"}`, que tanca a la línia ~451) i **abans** del separador `<div className="w-px h-5 mx-1" ...>` següent, inserir:

```tsx
                <button
                    title="Cercar i substituir (Ctrl+F)"
                    onClick={() => (searchOpen ? closeSearchBar() : openSearchBar())}
                    className={`p-1.5 rounded transition-colors ${searchOpen ? '' : 'text-gray-500 hover:bg-white/10'}`}
                    style={searchOpen ? { color: 'var(--th-accent-text)', backgroundColor: 'var(--th-accent-muted)' } : undefined}
                >
                    <SearchIcon className="w-4 h-4" />
                </button>
```

- [ ] **Step 5: Renderitzar la barra entre la capçalera i la llista**

Just **després** del tancament `</header>` (línia ~493) i **abans** del `<div ref={scrollContainerRef} ...>`, inserir:

```tsx
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
```

Al mateix pas, fer enfocable el contenidor de scroll (necessari perquè `closeSearchBar` hi retorni el focus — spec §4.1). Substituir:

```tsx
      <div ref={scrollContainerRef} className="flex-grow overflow-auto custom-scrollbar">
```

per:

```tsx
      <div ref={scrollContainerRef} tabIndex={-1} className="flex-grow overflow-auto custom-scrollbar outline-none">
```

(`tabIndex={-1}`: enfocable només per codi, no entra a l'ordre de tabulació; `outline-none` evita l'anell de focus visible al contenidor.)

- [ ] **Step 6: Fons de fila del fallback al wrapper de fila virtual**

Al `style` del wrapper de fila virtual (el `div` amb `data-index={virtualRow.index}` i `transform: translateY(...)`, línia ~513-519), afegir la clau `backgroundColor`:

```tsx
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    backgroundColor: virtualRow.index === fallbackActiveSegIndex ? 'var(--th-accent-muted)' : undefined,
                  }}
```

- [ ] **Step 7: TypeScript check**

```bash
cd d:/Documents_L/MisProgramas/SONILAB_PROD_SUBTITOLS/frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: zero errors. Nota: `findMatches(segments, ...)` compila directament perquè `Segment.id` és `Id = number` (`types/Subtitles.ts:4`) i el paràmetre demana `Array<{ id: number; originalText: string }>` (estructural).

---

### Task 4: Drecera `FIND` a `constants.ts` + estils `::highlight()` a `index.html`

**Files:**
- Modify: `frontend/constants.ts`
- Modify: `frontend/index.html`

**Interfaces:**
- Consumes: l'acció `FIND` la tracta el handler de Task 3 Step 3 (`useKeyboardShortcuts('subtitlesEditor', ...)`).
- Produces: entrada `sub_find` visible al quadre de dreceres de Configuració (SettingsModal ja fusiona amb `mergeShortcuts`).

- [ ] **Step 1: Afegir la drecera als defaults**

A `DEFAULT_SHORTCUTS.subtitlesEditor` (línia ~90-106), després de la línia de `sub_set_tc_out` afegir:

```typescript
    { id: 'sub_find', action: 'FIND', label: 'Cercar i substituir', combo: 'Ctrl+F' },
```

Nota (spec §8): els usuaris amb sessió backend i `preferences.shortcuts` desades reben la drecera al següent login (`AuthContext.refreshMe` re-escriu el localStorage amb `mergeShortcuts` NOMÉS si el perfil té shortcuts — AuthContext.tsx:34-36). Si el localStorage no té la clau, `getCachedShortcuts` cau directament a `DEFAULT_SHORTCUTS` (que ja inclou `sub_find`). Cas residual: localStorage antic + perfil sense shortcuts — el botó lupa sempre funciona i Configuració fusiona en obrir-se.

- [ ] **Step 2: Afegir els estils d'highlight**

A `frontend/index.html`, dins del bloc `<style>` global existent (línies ~9-42), afegir al final del bloc. (Nota: la classe `custom-scrollbar` no té cap regla pròpia enlloc del frontend — només hi ha regles genèriques `::-webkit-scrollbar` a `ThemeContext.tsx`; l'ancoratge és simplement el final d'aquest bloc `<style>`.)

```css
      /* Cerca a l'editor de subtítols (CSS Custom Highlight API) */
      ::highlight(srt-search) {
        background-color: rgba(250, 204, 21, 0.35);
      }
      ::highlight(srt-search-active) {
        background-color: rgba(249, 115, 22, 0.65);
        color: white;
      }
```

- [ ] **Step 3: TypeScript check + build**

```bash
cd d:/Documents_L/MisProgramas/SONILAB_PROD_SUBTITOLS/frontend && npx tsc --noEmit 2>&1 | head -30
cd d:/Documents_L/MisProgramas/SONILAB_PROD_SUBTITOLS/frontend && npm run build 2>&1 | tail -15
```
Expected: zero errors a tots dos.

---

### Task 5: Verificació final integrada

**Files:** cap modificació (només verificació).

**Interfaces:** consumeix tot l'anterior.

- [ ] **Step 1: Re-executar la verificació de lògica pura**

```bash
cd d:/Documents_L/MisProgramas/SONILAB_PROD_SUBTITOLS/frontend && npx esbuild utils/SubtitlesEditor/searchReplace.ts --format=esm --outfile=D:/AppData/Local/Temp/claude/d--Documents-L-MisProgramas-SONILAB-PROD-SUBTITOLS/4bafc9fb-074b-4856-8b92-6fc40c74ad8d/scratchpad/searchReplace.mjs
cd D:/AppData/Local/Temp/claude/d--Documents-L-MisProgramas-SONILAB-PROD-SUBTITOLS/4bafc9fb-074b-4856-8b92-6fc40c74ad8d/scratchpad && node verify-searchReplace.mjs
```
Expected: `TOTS ELS CASOS OK`, exit 0.

- [ ] **Step 2: TypeScript + build nets**

```bash
cd d:/Documents_L/MisProgramas/SONILAB_PROD_SUBTITOLS/frontend && npx tsc --noEmit
cd d:/Documents_L/MisProgramas/SONILAB_PROD_SUBTITOLS/frontend && npm run build 2>&1 | tail -5
```
Expected: zero errors.

- [ ] **Step 3: Revisió del diff**

```bash
cd d:/Documents_L/MisProgramas/SONILAB_PROD_SUBTITOLS && git diff --stat
cd d:/Documents_L/MisProgramas/SONILAB_PROD_SUBTITOLS && git diff frontend/components/VideoSubtitlesEditor/SubtitlesEditor.tsx frontend/constants.ts frontend/index.html
```
Comprovar que:
- El diff **afegit per aquest pla** es limita a: `SubtitlesEditor.tsx`, `constants.ts`, `index.html` (modificats) + `searchReplace.ts`, `SearchReplaceBar.tsx` (nous). ATENCIÓ: el working tree ja contenia canvis previs aliens (`App.tsx`, `SonilabLibraryView.tsx`, les dues vistes, etc.) — **ignorar-los i NO revertir-los**.
- Cap canvi a `VideoSubtitlesEditorView.tsx` ni `VideoSrtStandaloneEditorView.tsx` **fet per aquest pla**.
- Cap canvi a `srtParser.ts`, `richTextHelpers.ts`, `formatTags.ts`, backend.
- **NO s'ha fet cap commit** (Global Constraints).

- [ ] **Step 4: Checklist funcional contra el spec**

Verificar per lectura del codi final (o manualment amb `npm run dev` si hi ha entorn):
1. Botó lupa a la capçalera; Ctrl+F obre la barra (si ja és oberta: només re-enfoca i selecciona el camp, sense re-prefilar); Esc/✕ la tanquen, netegen highlights i retornen el focus al contenidor de l'editor (`tabIndex={-1}`).
2. Cerca en viu (debounce 150ms), comptador «N de M», «Sense resultats» amb terme sense coincidències.
3. Aa i [ab] recalculen immediatament; paraula completa amb accents (`\p{L}`).
4. ▲/▼ amb wrap; scroll suau al bloc de l'activa; ressaltat groc + activa taronja.
5. Substituir → 1 pas d'undo; salta a la següent; cas «a»→«aa» no fa bucle.
6. Substituir-ho tot → 1 únic pas d'undo; missatge «S'han fet N substitucions».
7. `buenos <i>días</i>` + substituir "buenos días"→"hola" → `hola` sense tags residuals.
8. Mode lectura: fila 2 absent; cerca, comptador i navegació funcionen. (Caveat conegut: en mode lectura el contentEditable pot no estar hidratat — `SegmentItem` fa early-return del re-sync amb `!isEditable` — i el ressaltat per caràcter pot no pintar-se; acceptat, spec §9.)
9. `richText: ''` als segments substituïts (ho fa el handler existent de les vistes).
