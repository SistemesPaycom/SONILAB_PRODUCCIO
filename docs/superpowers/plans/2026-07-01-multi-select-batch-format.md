# Selecció Múltiple de Blocs + Format en Lot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-01-multi-select-batch-format-design.md`

**Goal:** Checkbox de selecció a l'esquerra de cada bloc de subtítol (clic = toggle, Maj+clic = rang inclusiu) i reutilització dels botons B/I/U perquè, amb selecció activa, apliquin/treguin el tag corresponent a tots els blocs seleccionats de manera no destructiva (normalitza el tag manipulat, mai toca els altres tags).

**Architecture:** L'estat de selecció (`selectedIds` + àncora) viu a `SubtitlesEditorInner` (component compartit per les dues vistes). La lògica de tags és un mòdul nou de funcions pures (`formatTags.ts`). Les vistes només aporten un callback nou `onSegmentsBatchChange` que mapa canvis per id sobre `subsHistory.present` i fa `subsHistory.commit(next)` (un únic pas d'undo).

**Tech Stack:** React 19 + TypeScript 5.8, Vite, `@tanstack/react-virtual` (llista virtualitzada existent), tags SRT literals (`<i>`, `<b>`, `<u>`) dins `Segment.originalText`.

## Global Constraints

- **NO fer cap commit de git.** El CLAUDE.md del repo ho prohibeix sense petició explícita de l'usuari, i el working tree ja conté canvis previs no commitejats a fitxers que aquest pla modifica (`VideoSrtStandaloneEditorView.tsx`, `VideoSubtitlesEditorView.tsx`). Tot queda al working tree per a revisió final de l'usuari.
- **No tocar** la CSS var `--us-sub-grid-columns` ni `SegmentItem`'s grid: el checkbox va en un canal flex NOU fora del grid.
- Tags: lectura case-insensitive, escriptura sempre minúscules (`<i>`, no `<I>`).
- Mai generar tags buits (`<i></i>`): línies/blocs sense text visible queden byte-idèntics.
- El batch NOMÉS modifica `originalText` (+ `richText: ''`); mai `startTime`/`endTime` ni cap altre camp.
- Strings d'UI en **català** (com la resta de l'editor).
- Comprovació de tipus: `cd d:/Documents_L/MisProgramas/SONILAB_PROD_SUBTITOLS/frontend && npx tsc --noEmit` → zero errors. Build: `cd d:/Documents_L/MisProgramas/SONILAB_PROD_SUBTITOLS/frontend && npm run build` → zero errors.
- No hi ha infraestructura de tests al projecte i **no se n'afegeix**; la lògica pura es verifica amb un script temporal al scratchpad (Task 1) que s'executa amb node + esbuild (esbuild ja és dependència transitiva de Vite).
- Rutes absolutes del repo: arrel = `d:\Documents_L\MisProgramas\SONILAB_PROD_SUBTITOLS`.

---

### Task 1: Mòdul pur `formatTags.ts` + verificació de lògica

**Files:**
- Create: `frontend/utils/SubtitlesEditor/formatTags.ts`
- Create (temporal, NO al repo): `D:/AppData/Local/Temp/claude/d--Documents-L-MisProgramas-SONILAB-PROD-SUBTITOLS/67cfaf82-dc1f-4d1b-a81e-da97a07964af/scratchpad/verify-formatTags.mjs` (mateixa ruta que usen les ordres dels Steps 2 i 4; crear el directori si no existeix)

**Interfaces:**
- Produces (consumides per Task 3):
  - `export type SrtFormatTag = 'i' | 'b' | 'u'`
  - `stripTag(text: string, tag: SrtFormatTag): string`
  - `hasVisibleText(text: string): boolean`
  - `isFullyTagged(text: string, tag: SrtFormatTag): boolean`
  - `wrapTagPerLine(text: string, tag: SrtFormatTag): string`
  - `allFullyTagged(texts: string[], tag: SrtFormatTag): boolean`
  - `toggleTagOnTexts(texts: string[], tag: SrtFormatTag): string[]`

- [ ] **Step 1: Escriure el script de verificació (fallarà fins que existeixi el mòdul)**

Crear `verify-formatTags.mjs` a `D:/AppData/Local/Temp/claude/d--Documents-L-MisProgramas-SONILAB-PROD-SUBTITOLS/67cfaf82-dc1f-4d1b-a81e-da97a07964af/scratchpad/` (crear el directori si no existeix) amb aquest contingut exacte:

```javascript
// verify-formatTags.mjs — verificació de la lògica pura de formatTags.ts
// Ús: node verify-formatTags.mjs   (requereix formatTags.mjs transpilat al mateix directori)
import {
  stripTag, hasVisibleText, isFullyTagged, wrapTagPerLine, allFullyTagged, toggleTagOnTexts,
} from './formatTags.mjs';

let fails = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { console.log(`OK   ${name}`); }
  else { fails++; console.log(`FAIL ${name}\n  got:  ${g}\n  want: ${w}`); }
};

// ── stripTag ──
eq('strip basic', stripTag('hola <i>com</i> estas', 'i'), 'hola com estas');
eq('strip case-insensitive', stripTag('<I>Hola</I>', 'i'), 'Hola');
eq('strip nomes el seu tag', stripTag('<b>Ho<i>la</i></b>', 'i'), '<b>Hola</b>');
eq('strip desequilibrat', stripTag('<i>text', 'i'), 'text');
eq('strip buit', stripTag('', 'i'), '');

// ── hasVisibleText ──
eq('visible normal', hasVisibleText('hola'), true);
eq('visible nomes tags', hasVisibleText('<i></i>'), false);
eq('visible blancs', hasVisibleText('  \n '), false);
eq('visible buit', hasVisibleText(''), false);

// ── isFullyTagged ──
eq('fully simple', isFullyTagged('<i>Hola</i>', 'i'), true);
eq('fully parcial', isFullyTagged('hola <i>com</i> estas', 'i'), false);
eq('fully buit', isFullyTagged('', 'i'), false);
eq('fully blancs fora', isFullyTagged('<i>Hola</i> <i>que tal</i>', 'i'), true);
eq('fully bloc multilinia', isFullyTagged('<i>l1\nl2</i>', 'i'), true);
eq('fully per-linia', isFullyTagged('<i>l1</i>\n<i>l2</i>', 'i'), true);
eq('fully obert sense tancar', isFullyTagged('<i>text', 'i'), true);
eq('fully altre tag dins', isFullyTagged('<i><b>Hola</b></i>', 'i'), true);
eq('fully altre tag fora no compta', isFullyTagged('<b>Hola</b>', 'i'), false);
eq('fully nomes blancs', isFullyTagged('   ', 'i'), false);
eq('fully majuscules', isFullyTagged('<I>Hola</I>', 'i'), true);
eq('fully niat mateix tag', isFullyTagged('<i>a<i>b</i>c</i>', 'i'), true);

// ── wrapTagPerLine ──
eq('wrap una linia', wrapTagPerLine('hola com estas', 'i'), '<i>hola com estas</i>');
eq('wrap multilinia', wrapTagPerLine('l1\nl2', 'i'), '<i>l1</i>\n<i>l2</i>');
eq('wrap linia buida enmig', wrapTagPerLine('l1\n\nl2', 'i'), '<i>l1</i>\n\n<i>l2</i>');
eq('wrap conserva altres tags', wrapTagPerLine('hola <b>com</b> estas', 'i'), '<i>hola <b>com</b> estas</i>');

// ── allFullyTagged ──
eq('all cert', allFullyTagged(['<i>a</i>', '<i>b</i>'], 'i'), true);
eq('all mixt', allFullyTagged(['<i>a</i>', 'b'], 'i'), false);
eq('all ignora buits', allFullyTagged(['<i>a</i>', '', '  '], 'i'), true);
eq('all nomes buits', allFullyTagged(['', '  '], 'i'), false);

// ── toggleTagOnTexts ──
eq('toggle normalitza (exemple canonic usuari)',
   toggleTagOnTexts(['hola <i>com</i> estas'], 'i'), ['<i>hola com estas</i>']);
eq('toggle mixt aplica a tots',
   toggleTagOnTexts(['<i>a</i>', 'b'], 'i'), ['<i>a</i>', '<i>b</i>']);
eq('toggle tots-taggejats treu',
   toggleTagOnTexts(['<i>a</i>', '<i>b</i>'], 'i'), ['a', 'b']);
eq('toggle conserva negreta',
   toggleTagOnTexts(['<b>Ho</b>la'], 'i'), ['<i><b>Ho</b>la</i>']);
eq('toggle repara interleave (nomes toca i)',
   toggleTagOnTexts(['<b>Ho<i>la</b></i>'], 'i'), ['<i><b>Hola</b></i>']);
eq('toggle b independent de i',
   toggleTagOnTexts(['<i><b>x</b></i>'], 'b'), ['<i>x</i>']);
eq('toggle salta buits',
   toggleTagOnTexts(['', '<i>a</i>'], 'i'), ['', 'a']);
eq('toggle nomes buits no-op',
   toggleTagOnTexts(['', ' '], 'i'), ['', ' ']);
eq('toggle multilinia normalitza a per-linia',
   toggleTagOnTexts(['x\n<i>y</i>'], 'i'), ['<i>x</i>\n<i>y</i>']);

console.log(fails === 0 ? '\nTOTS ELS CASOS OK' : `\n${fails} CASOS FALLITS`);
process.exit(fails === 0 ? 0 : 1);
```

- [ ] **Step 2: Executar-lo per confirmar que falla (el mòdul no existeix)**

```bash
cd D:/AppData/Local/Temp/claude/d--Documents-L-MisProgramas-SONILAB-PROD-SUBTITOLS/67cfaf82-dc1f-4d1b-a81e-da97a07964af/scratchpad && node verify-formatTags.mjs
```
Expected: `ERR_MODULE_NOT_FOUND` — `Cannot find module '…\formatTags.mjs'` (node mostra la ruta absoluta resolta, no `'./formatTags.mjs'`).

- [ ] **Step 3: Crear `frontend/utils/SubtitlesEditor/formatTags.ts`**

Contingut complet del fitxer:

```typescript
// utils/SubtitlesEditor/formatTags.ts

/**
 * Manipulació NO destructiva de tags de format SRT (<i>, <b>, <u>) sobre strings.
 * Cada funció opera EXCLUSIVAMENT sobre el tag indicat: mai toca els altres tags.
 * Lectura case-insensitive (tolerància a <I> de fitxers externs), escriptura en minúscules.
 * Funcions pures: sense DOM, sense React (verificables de manera aïllada).
 */

export type SrtFormatTag = 'i' | 'b' | 'u';

/** Elimina totes les aparicions de <tag> i </tag> (case-insensitive). No toca cap altre tag. */
export function stripTag(text: string, tag: SrtFormatTag): string {
  if (!text) return text;
  return text.replace(new RegExp(`</?${tag}>`, 'gi'), '');
}

/** true si el text té contingut visible (fora de qualsevol seqüència <...>). */
export function hasVisibleText(text: string): boolean {
  if (!text) return false;
  return text.replace(/<[^>]*>/g, '').trim().length > 0;
}

/**
 * true si TOT el text visible està dins de regions <tag>…</tag>.
 * - Els blancs (espais, salts de línia) fora de regions s'ignoren:
 *   "<i>l1</i>\n<i>l2</i>" i "<i>l1\nl2</i>" compten totes dues com a tot-taggejat.
 * - Qualsevol altra seqüència <...> és markup, no text visible.
 * - Un <tag> obert sense tancar cobreix fins al final (tolerància a tags desequilibrats).
 * - Sense text visible → false.
 */
export function isFullyTagged(text: string, tag: SrtFormatTag): boolean {
  if (!text) return false;
  const openRe = new RegExp(`^<${tag}>$`, 'i');
  const closeRe = new RegExp(`^</${tag}>$`, 'i');
  let depth = 0;
  let sawVisible = false;

  // Recorregut únic: trossos de text visible separats per tokens <...>
  const tokenRe = /<[^>]*>/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  const chunkOk = (chunk: string): boolean => {
    if (chunk.trim().length === 0) return true; // blancs: ignorats
    sawVisible = true;
    return depth > 0; // text visible fora de regió → invalida
  };

  while ((m = tokenRe.exec(text)) !== null) {
    if (!chunkOk(text.slice(lastIndex, m.index))) return false;
    if (openRe.test(m[0])) depth++;
    else if (closeRe.test(m[0])) depth = Math.max(0, depth - 1);
    lastIndex = m.index + m[0].length;
  }
  if (!chunkOk(text.slice(lastIndex))) return false;
  return sawVisible;
}

/**
 * Embolcalla CADA LÍNIA amb <tag>…</tag> (convenció per-línia; en lectura també
 * s'accepta la forma en bloc <i>l1\nl2</i>). Línies sense text visible queden intactes (mai <i></i>).
 * PRECONDICIÓ del cridador: text ja passat per stripTag(text, tag).
 */
export function wrapTagPerLine(text: string, tag: SrtFormatTag): string {
  if (!text) return text;
  return text
    .split('\n')
    .map(line => (hasVisibleText(line) ? `<${tag}>${line}</${tag}>` : line))
    .join('\n');
}

/** true si hi ha ≥1 text amb contingut visible i TOTS els que en tenen són fullyTagged. */
export function allFullyTagged(texts: string[], tag: SrtFormatTag): boolean {
  const formattable = texts.filter(hasVisibleText);
  if (formattable.length === 0) return false;
  return formattable.every(t => isFullyTagged(t, tag));
}

/**
 * Toggle en lot amb semàntica "make consistent":
 * - Si TOTS els textos amb contingut visible són tot-taggejats → TREURE el tag de tots.
 * - Si no → APLICAR a tots: normalitzar primer (stripTag) i embolcallar per línia.
 *   Així "hola <i>com</i> estas" esdevé "<i>hola com estas</i>" (mai tags niats).
 * - Els textos sense contingut visible es retornen byte-idèntics.
 * Retorna un array nou de la mateixa longitud i ordre.
 */
export function toggleTagOnTexts(texts: string[], tag: SrtFormatTag): string[] {
  const removing = allFullyTagged(texts, tag);
  return texts.map(t => {
    if (!hasVisibleText(t)) return t;
    return removing ? stripTag(t, tag) : wrapTagPerLine(stripTag(t, tag), tag);
  });
}
```

- [ ] **Step 4: Transpilar i executar la verificació**

```bash
cd d:/Documents_L/MisProgramas/SONILAB_PROD_SUBTITOLS/frontend && npx esbuild utils/SubtitlesEditor/formatTags.ts --format=esm --outfile=D:/AppData/Local/Temp/claude/d--Documents-L-MisProgramas-SONILAB-PROD-SUBTITOLS/67cfaf82-dc1f-4d1b-a81e-da97a07964af/scratchpad/formatTags.mjs
cd D:/AppData/Local/Temp/claude/d--Documents-L-MisProgramas-SONILAB-PROD-SUBTITOLS/67cfaf82-dc1f-4d1b-a81e-da97a07964af/scratchpad && node verify-formatTags.mjs
```
Expected: totes les línies `OK`, final `TOTS ELS CASOS OK`, exit code 0.
(Si `npx esbuild` no estigués disponible: copiar el cos del .ts a `formatTags.mjs` esborrant només les anotacions de tipus — el codi és JS pur altrament.)

- [ ] **Step 5: TypeScript check**

```bash
cd d:/Documents_L/MisProgramas/SONILAB_PROD_SUBTITOLS/frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: zero errors.

---

### Task 2: Checkbox de selecció a `SegmentItem`

**Files:**
- Modify: `frontend/components/VideoSubtitlesEditor/SegmentItem.tsx`

**Interfaces:**
- Produces (consumides per Task 3): props noves opcionals de `SegmentItemProps`:
  - `isSelected?: boolean`
  - `selectionActive?: boolean`
  - `onToggleSelect?: (id: number, shiftKey: boolean) => void`
- Consumes: res de tasks anteriors (independent de Task 1).

- [ ] **Step 1: Afegir les 3 props a `SegmentItemProps`**

A `SegmentItemProps` (línia ~10-34), després de `onNavigate?: (direction: 'next' | 'prev', currentId: number) => void;` afegir:

```typescript
  /** Selecció múltiple: aquest bloc està seleccionat (checkbox marcat) */
  isSelected?: boolean;
  /** Selecció múltiple: hi ha ≥1 bloc seleccionat a la llista (fa visibles tots els checkboxes) */
  selectionActive?: boolean;
  /** Toggle de selecció del bloc; shiftKey=true → selecció de rang des de l'àncora */
  onToggleSelect?: (id: number, shiftKey: boolean) => void;
```

- [ ] **Step 2: Destructurar-les al component**

Al destructuring del component (línia ~183-203), després de `onNavigate,` afegir:

```typescript
  isSelected = false,
  selectionActive = false,
  onToggleSelect,
```

- [ ] **Step 3: Fons de fila quan està seleccionat**

Al `div` arrel (línia ~558), l'`style` actual és:

```typescript
style={isActive ? { backgroundColor: 'var(--th-editor-row-active)', '--tw-ring-color': 'var(--th-focus-ring)' } as any : undefined}
```

Substituir per:

```typescript
style={
  isActive
    ? { backgroundColor: 'var(--th-editor-row-active)', '--tw-ring-color': 'var(--th-focus-ring)' } as any
    : isSelected
    ? { backgroundColor: 'var(--th-accent-muted)' }
    : undefined
}
```

(No es toca la cadena de `className`: l'estil inline té prioritat sobre `hover:bg-*`.)

- [ ] **Step 4: Inserir el canal esquerre amb el checkbox**

Just després de l'obertura de `<div className="flex items-stretch">` (línia ~582) i **abans** del `div` del grid, inserir:

```tsx
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
```

Notes de comportament (del spec §4.3/§4.5):
- `onMouseDown preventDefault` → Maj+clic no estén la selecció de text del navegador ni roba el focus.
- `stopPropagation` al clic → no s'activa el bloc (no canvia `activeSegmentId`).
- Sense `onToggleSelect` o sense `isEditable`, el canal NO es renderitza (les vistes en mode lectura queden idèntiques a avui).

- [ ] **Step 5: TypeScript check**

```bash
cd d:/Documents_L/MisProgramas/SONILAB_PROD_SUBTITOLS/frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: zero errors (props opcionals; cap consumidor encara).

---

### Task 3: Estat de selecció + lot als botons B/I/U (`SubtitlesEditor`)

**Files:**
- Modify: `frontend/components/VideoSubtitlesEditor/SubtitlesEditor.tsx`

**Interfaces:**
- Consumes: `formatTags.ts` (Task 1); props noves de `SegmentItem` (Task 2).
- Produces (consumida per Task 4): prop nova de `SubtitlesEditorProps`:
  - `onSegmentsBatchChange?: (changes: Array<{ id: number; newText: string }>) => void`

- [ ] **Step 1: Import del mòdul de tags**

Sota l'import de `useVirtualizer` (línia ~9) afegir:

```typescript
import { SrtFormatTag, allFullyTagged, toggleTagOnTexts } from '../../utils/SubtitlesEditor/formatTags';
```

- [ ] **Step 2: Afegir la prop a `SubtitlesEditorProps`**

A la interfície (línia ~17-52), després de `onDelete?: (id: number) => void;` afegir:

```typescript
  /** Format en lot: aplica canvis de text a diversos segments de cop (un únic pas d'undo a la vista). */
  onSegmentsBatchChange?: (changes: Array<{ id: number; newText: string }>) => void;
```

I al destructuring de `SubtitlesEditorInner` (línia ~54-85), després de `onDelete,` afegir:

```typescript
  onSegmentsBatchChange,
```

- [ ] **Step 3: Estat de selecció, invalidació i handler de toggle**

Just després de `const [insertionsCollapsed, setInsertionsCollapsed] = useState(false);` (línia ~88) afegir:

```typescript
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
  // setSelectedIds. L'updater ha de ser PUR: l'app corre sota <React.StrictMode>
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
```

- [ ] **Step 4: Branca de lot dins `handleFormatAction`**

Substituir la funció actual (línia ~117-120):

```typescript
  const handleFormatAction = (command: string) => {
    if (!isEditable) return;
    document.execCommand(command, false);
  };
```

per:

```typescript
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
```

- [ ] **Step 5: Estat visual dels botons amb selecció activa**

Just després del bloc de `handleFormatAction` afegir:

```typescript
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
```

I als 3 botons B/I/U (línia ~368-387) substituir **totes** les 6 referències `formatState.bold`, `formatState.italic`, `formatState.underline` (2 per botó: `className` i `style`) per `shownFormatState.bold`, `shownFormatState.italic`, `shownFormatState.underline`. Exemple amb el botó B (aplicar el mateix patró a I i U):

```tsx
                    <button
                        onMouseDown={(e) => { e.preventDefault(); handleFormatAction('bold'); }}
                        className={`w-7 h-7 rounded flex items-center justify-center text-xs font-black transition-colors ${shownFormatState.bold ? 'shadow-sm' : 'hover:bg-white/10'}`}
                        style={shownFormatState.bold ? { backgroundColor: 'var(--th-accent)', color: 'var(--th-text-inverse)' } : { color: 'var(--th-editor-meta)' }}
                        title="Negreta (Ctrl+B)"
                    >B</button>
```

- [ ] **Step 6: Chip "N sel. ✕" a la capçalera**

Just **abans** del `<div className="flex items-center gap-1">` que conté els botons B/I/U (línia ~368) inserir:

```tsx
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
```

- [ ] **Step 7: Passar les props noves a `SegmentItem`**

A la instància de `<SegmentItem ...>` (línia ~419-439), després de `onNavigate={handleNavigate}` afegir:

```tsx
                    isSelected={selectionEnabled && selectedIds.has(segment.id as number)}
                    selectionActive={selectionEnabled && selectedIds.size > 0}
                    onToggleSelect={selectionEnabled ? handleToggleSelect : undefined}
```

- [ ] **Step 8: TypeScript check**

```bash
cd d:/Documents_L/MisProgramas/SONILAB_PROD_SUBTITOLS/frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: zero errors. (La prop `onSegmentsBatchChange` és opcional: les dues vistes encara no la passen i han de seguir compilant.)

---

### Task 4: Callback `onSegmentsBatchChange` a les dues vistes

**Files:**
- Modify: `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx`
- Modify: `frontend/components/VideoSubtitlesEditor/VideoSrtStandaloneEditorView.tsx`

**Interfaces:**
- Consumes: prop `onSegmentsBatchChange?: (changes: Array<{ id: number; newText: string }>) => void` (Task 3); `subsHistory` (`useDocumentHistory`) existent a cada vista.
- Produces: res per a tasks posteriors.

**ATENCIÓ:** aquests DOS fitxers ja tenen canvis previs no commitejats al working tree, aliens a aquest pla. Fer NOMÉS les edicions descrites; no "netejar" ni reformatar res més.

- [ ] **Step 1: Handler a `VideoSubtitlesEditorView.tsx`**

Just després del final de `handleSegmentChange` (el `useCallback` que acaba a la línia ~914 amb `}, [isEditing, subsHistory, generalConfig.minGapMs, generalConfig.minDurationMs]);`) afegir:

```typescript
  // Format en lot des de SubtitlesEditor (selecció múltiple): un únic pas d'undo.
  // richText: '' segueix el patró de syncEditorsToState — serializeSrt fa
  // (richText || originalText) i un richText ranci exportaria text antic.
  const handleSegmentsBatchChange = useCallback((changes: Array<{ id: number; newText: string }>) => {
    if (!isEditing || changes.length === 0) return;
    const byId = new Map(changes.map(c => [c.id, c.newText]));
    subsHistory.commit(
      subsHistory.present.map(s =>
        byId.has(s.id as number)
          ? { ...s, originalText: byId.get(s.id as number)!, richText: '' }
          : s
      )
    );
  }, [isEditing, subsHistory]);
```

- [ ] **Step 2: Passar la prop a la instància de `SubtitlesEditor` de la vista principal**

A `<SubtitlesEditor ...>` (línia ~1026), després de `onDelete={handleDeleteSegment}` afegir:

```tsx
              onSegmentsBatchChange={handleSegmentsBatchChange}
```

- [ ] **Step 3: Handler a `VideoSrtStandaloneEditorView.tsx`**

Localitzar `handleSegmentChange` a la vista standalone: és una **funció plana** (`const handleSegmentChange = (updated: Segment) => { ... }`, NO un useCallback), única al fitxer, línies ~367-382. Inserir el handler nou **just després del seu tancament** (abans de `const segIndexRef` de la línia ~383):

```typescript
  // Format en lot des de SubtitlesEditor (selecció múltiple): un únic pas d'undo.
  const handleSegmentsBatchChange = useCallback((changes: Array<{ id: number; newText: string }>) => {
    if (!isEditing || changes.length === 0) return;
    const byId = new Map(changes.map(c => [c.id, c.newText]));
    subsHistory.commit(
      subsHistory.present.map(s =>
        byId.has(s.id as number)
          ? { ...s, originalText: byId.get(s.id as number)!, richText: '' }
          : s
      )
    );
  }, [isEditing, subsHistory]);
```

- [ ] **Step 4: Passar la prop a la instància de `SubtitlesEditor` standalone**

A `<SubtitlesEditor ...>` (línia ~454-476), després de `onDelete={handleDeleteSegment}` afegir:

```tsx
            onSegmentsBatchChange={handleSegmentsBatchChange}
```

- [ ] **Step 5: TypeScript check + build**

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
cd d:/Documents_L/MisProgramas/SONILAB_PROD_SUBTITOLS/frontend && npx esbuild utils/SubtitlesEditor/formatTags.ts --format=esm --outfile=D:/AppData/Local/Temp/claude/d--Documents-L-MisProgramas-SONILAB-PROD-SUBTITOLS/67cfaf82-dc1f-4d1b-a81e-da97a07964af/scratchpad/formatTags.mjs
cd D:/AppData/Local/Temp/claude/d--Documents-L-MisProgramas-SONILAB-PROD-SUBTITOLS/67cfaf82-dc1f-4d1b-a81e-da97a07964af/scratchpad && node verify-formatTags.mjs
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
cd d:/Documents_L/MisProgramas/SONILAB_PROD_SUBTITOLS && git diff frontend/components/VideoSubtitlesEditor/SegmentItem.tsx frontend/components/VideoSubtitlesEditor/SubtitlesEditor.tsx
```
Comprovar que:
- El diff **afegit per aquest pla** es limita als 4 fitxers modificats + el nou `formatTags.ts`. ATENCIÓ: el working tree ja contenia canvis previs aliens al pla (`SonilabLibraryView.tsx` i modificacions preexistents a les dues vistes) — **ignorar-los i NO revertir-los**; no compten com a desviació.
- Cap canvi a `--us-sub-grid-columns`, `srtParser.ts`, `richTextHelpers.ts`, backend.
- **NO s'ha fet cap commit** (Global Constraints).

- [ ] **Step 4: Checklist funcional contra el spec (§7)**

Verificar per lectura del codi final (o manualment amb `npm run dev` si hi ha entorn):
1. Checkbox visible a l'esquerra de tot en mode edició; invisible en mode lectura.
2. Clic = toggle + àncora; Maj+clic = rang inclusiu per índex; unió, mai treu.
3. Chip "N sel. ✕" apareix amb ≥1 seleccionat; ✕ buida selecció i àncora.
4. B/I/U amb selecció → lot (normalitza + embolcalla per línia / treu si tots-taggejats); sense selecció → execCommand com abans.
5. Un batch = un `subsHistory.commit` = un pas d'undo.
6. Split/merge/insert/delete/undo estructural buida la selecció.
7. `richText: ''` als segments modificats pel lot.
