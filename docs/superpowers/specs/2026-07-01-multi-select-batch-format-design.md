# Disseny: Selecció múltiple de blocs + format en lot no destructiu

**Data:** 2026-07-01
**Àmbit:** Editor de subtítols (vista principal i standalone)
**Referència UX:** Checkboxes tipus Gmail (clic = toggle, Maj+clic = rang)

---

## 1. Problema i motivació

L'editor de subtítols només permet un "segment actiu" (`activeSegmentId`). Els botons **B/I/U** de la capçalera (`SubtitlesEditor.tsx:368-387`) apliquen format via `document.execCommand` **només a la selecció de text dins del contentEditable enfocat**. No hi ha cap manera d'aplicar cursiva (o negreta/subratllat) a un conjunt de blocs de cop.

L'usuari demana:

1. Un **botó de selecció a l'esquerra de tot** de cada bloc.
2. **Maj+clic** per seleccionar rangs: si se selecciona el bloc 78 i es fa Maj+clic al 104, queden seleccionats tots els blocs del 78 al 104, ambdós inclosos.
3. En aplicar cursiva al conjunt, el comportament ha de ser **no destructiu i normalitzador**: si dins de "hola com estàs" la paraula "com" ja era `<i>com</i>`, primer s'elimina la cursiva parcial i després s'aplica al text sencer — mai `<i>hola <i>com</i> estàs</i>` ni tags creuats. La negreta i el subratllat **no es toquen** quan es manipula la cursiva (i viceversa).

---

## 2. Àmbit i enfocament

### Inclòs
- Botó de selecció (checkbox) al **marge esquerre** de cada bloc a `SegmentItem`, només en mode edició.
- Selecció múltiple amb **clic** (toggle individual) i **Maj+clic** (afegeix el rang entre l'àncora i el bloc clicat, ambdós inclosos).
- Indicador "N seleccionats" + botó **✕ esborrar selecció** a la capçalera de `SubtitlesEditor`.
- Reutilització dels botons **B/I/U** existents: amb selecció activa, actuen **en lot sobre tots els blocs seleccionats**; sense selecció, mantenen el comportament actual (`execCommand` sobre el contentEditable enfocat).
- Algorisme de **toggle no destructiu per tag** (`<i>`, `<b>`, `<u>` independents) amb normalització prèvia (secció 5).
- Funciona a **les dues vistes** (`VideoSubtitlesEditorView` i `VideoSrtStandaloneEditorView`) perquè s'implementa dins del component compartit `SubtitlesEditor`/`SegmentItem`.
- Un batch = **un únic pas d'undo** (`subsHistory.commit(next)`).

### Exclòs
- Accions en lot diferents de B/I/U (esborrar múltiple, merge múltiple…). No demanades.
- Drecera de teclat per seleccionar/esborrar selecció (p. ex. Escape). S'evita per no col·lidir amb l'ús d'Escape en modals; el botó ✕ cobreix la necessitat.
- "Seleccionar-ho tot". No demanat; Maj+clic del primer a l'últim bloc ho cobreix.
- Canvis a `SrtPreviewView` (vista prèvia de biblioteca, només lectura): mostra els tags literals — comportament preexistent per a qualsevol SRT amb tags, fora d'àmbit.
- Canvis a l'overlay de vídeo: **ja renderitza els tags correctament** (`VideoPlayer.tsx:32` usa `plainToRich` + `dangerouslySetInnerHTML`). Cap canvi necessari.
- Persistència de la selecció entre sessions o documents.

---

## 3. Alternatives considerades

| Alternativa | Descripció | Decisió |
|---|---|---|
| **A. Estat de selecció dins `SubtitlesEditor`** (triada) | `selectedIds: Set<number>` viu a `SubtitlesEditorInner`; les vistes només aporten un callback nou `onSegmentsBatchChange`. | ✅ Una sola implementació per a les dues vistes; mínim prop drilling; coherent amb el fet que `formatState` i els botons B/I/U ja viuen allà. |
| B. Estat de selecció a cada vista | Duplicaria lògica a `VideoSubtitlesEditorView` i `VideoSrtStandaloneEditorView` (rutes germanes que caldria mantenir simètriques — risc identificat al CLAUDE.md del frontend). | ❌ |
| C. "Mode selecció" amb barra d'accions flotant pròpia | Més superfície d'UI nova, més estats. Els botons B/I/U ja existeixen i són el lloc natural. | ❌ |
| Estil d'embolcall: tag únic per bloc (`<i>l1\nl2</i>`) vs **per línia** (`<i>l1</i>\n<i>l2</i>`) (triada) | `execCommand` (flux actual) genera un únic tag que travessa el `<br>` (`<i>l1<br>l2</i>` → via `richToPlain` queda `<i>l1\nl2</i>`, forma en bloc); ambdues formes es reconeixen com a "tot en cursiva" en llegir (secció 5.2) i el batch escriu sempre per línia, la convenció més segura en renderers estrictes. | ✅ per línia |

---

## 4. Model de selecció

### 4.1 Estat (dins `SubtitlesEditorInner`)

```typescript
const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
const anchorIdRef = useRef<number | null>(null);
const selectionEnabled = isEditable && !!onSegmentsBatchChange;
```

- **`selectedIds`**: conjunt d'`id` de segment. Nota: els ids solen ser 1-based i seqüencials (les operacions estructurals renumeren amb `id: i + 1`), però **no està garantit** — `parseSrt` conserva la numeració del fitxer original i `handleAcceptInsertion` insereix amb un id efímer `Date.now()`. Per això el disseny mai fa aritmètica d'ids: rangs per índex d'array i mapeigs per `findIndex`/`Set.has`.
- **`anchorIdRef`**: últim bloc on s'ha fet clic al checkbox (amb o sense Maj). Ref, no estat: canviar l'àncora no ha de re-renderitzar. **La lectura/escriptura de l'àncora i el càlcul del rang es fan sempre FORA de l'updater de `setSelectedIds`** — l'updater ha de ser pur perquè l'app corre sota `<React.StrictMode>` (`frontend/index.tsx`) i React el pot invocar dues vegades en dev; un updater que mutés la ref faria degenerar el rang Maj+clic al bloc clicat.
- La UI de selecció només es mostra si `selectionEnabled`.

### 4.2 Regles de clic (handler `handleToggleSelect(id, shiftKey)`)

| Acció | Resultat |
|---|---|
| Clic simple al checkbox | Toggle del bloc (afegeix/treu de `selectedIds`). Àncora ← bloc clicat. |
| Maj+clic amb àncora vàlida | **Afegeix** (unió, mai treu) tots els blocs entre l'àncora i el bloc clicat **per índex d'array**, ambdós inclosos. Àncora ← bloc clicat. |
| Maj+clic sense àncora (o àncora ja no present a l'array) | Es comporta com un clic simple. |
| Maj+clic amb àncora == bloc clicat | Rang d'un sol element: el selecciona (idempotent si ja ho estava). |
| Clic al checkbox d'un bloc ja seleccionat (sense Maj) | El desselecciona. Àncora ← bloc clicat igualment. |

El rang es calcula per **índexs a l'array `segments` actual** (`findIndex` per id), no per aritmètica d'ids — robust encara que en el futur els ids deixessin de ser seqüencials.

### 4.3 Interacció amb la resta de l'editor

- El clic al checkbox fa `e.stopPropagation()` (no activa el bloc, no mou `activeSegmentId`) i `onMouseDown` fa `e.preventDefault()` (evita que Maj+clic estengui la selecció de text del navegador i evita robar el focus).
- Seleccionar blocs **no** canvia el focus ni el caret de cap contentEditable.
- `activeSegmentId` (selecció "de treball" existent) i `selectedIds` (selecció en lot) són independents i poden coexistir.

### 4.4 Invalidació automàtica de la selecció

La selecció es buida (i l'àncora es reseteja) quan:

1. **`segments.length` canvia** — cobreix split, merge, insert, delete, acceptar proposta d'inserció, i undo/redo d'aquestes operacions. Motiu: quan canvia la longitud, el mapeig id→bloc deixa de ser fiable (split/merge/insert/delete renumeren amb `id: i + 1`; accept-insertion afegeix un id efímer `Date.now()`), i un `Set` d'ids antics apuntaria a blocs equivocats.
2. **`selectionEnabled` passa a fals** (es surt del mode edició o desapareix el callback).

Els canvis **només de text** (edició manual, correccions acceptades una a una, el mateix batch de format) mantenen ids i longitud → la selecció es conserva, cosa desitjable (p. ex. aplicar cursiva i després negreta al mateix conjunt).

**Residu conegut i acceptat**: vincular un SRT nou sobre el mateix document substitueix tot l'array via `commit(parseSrt(...))` sense remount — passa amb `handleSyncSubtitles` a la vista principal (drag&drop o modal Vincular, `VideoSubtitlesEditorView.tsx:402-409`, cablejat a `SyncLibraryModal` l.~1125) i amb el callback inline equivalent de l'standalone (`VideoSrtStandaloneEditorView.tsx:567-570`). Si el fitxer nou té *exactament el mateix nombre de blocs*, la selecció sobreviu apuntant a blocs del contingut nou. Conseqüència acotada: els checkboxes queden visiblement marcats (l'usuari veu què hi ha seleccionat) i el lot s'aplicaria a allò marcat. No es complica el disseny per cobrir-ho.

### 4.5 UI del checkbox (a `SegmentItem`)

- **Posició**: primer fill del contenidor `div.flex.items-stretch` (`SegmentItem.tsx:582`), **abans** del grid de columnes — un canal vertical de ~22px a l'esquerra de tot. No es toca la CSS var `--us-sub-grid-columns` (el grid queda intacte com a `flex-1`).
- **Mides/estil**: botó quadrat ~14px, `border: 1px solid var(--th-border)`, arrodonit 3px. Seleccionat: fons `var(--th-accent)`, marca ✓ amb `var(--th-text-inverse)`.
- **Visibilitat** (mateix patró que els botons d'acció existents): `opacity-100` si `isSelected || selectionActive || isActive`; si no, `opacity-0 group-hover:opacity-100`. (`selectionActive` = hi ha ≥1 bloc seleccionat a la llista: quan comences a seleccionar, tots els checkboxes es fan visibles, estil gestor de fitxers.)
- **Feedback de fila**: quan `isSelected && !isActive`, fons de fila `var(--th-accent-muted)` via estil inline (no es toca la cadena de classes existent; l'estil inline té prioritat sobre `hover:bg-*`).
- Les franges laterals d'estat (hasDiff/correccions, `w-0.5` absolutes a `left-0`) es mantenen; queden al caire esquerre, superposades al marge del canal nou.
- Alineació vertical: el checkbox se centra a la **primera fila** (`height: var(--us-sub-row-height)`), coherent amb com Col 2 mostra `#id` a la fila 0.

### 4.6 Indicador i neteja a la capçalera (a `SubtitlesEditor`)

Quan `selectionEnabled && selectedIds.size > 0`, a la capçalera (al costat esquerre del grup B/I/U, després del separador existent):

```
|  [ N sel. ✕ ]  B I U
```

- Chip amb `{selectedIds.size} sel.` i botó ✕ ("Esborrar selecció") que buida `selectedIds` i l'àncora.
- Textos UI en català: `title="Seleccionar bloc (Maj+clic: rang)"`, `title="Esborrar selecció"`.

---

## 5. Format en lot no destructiu

### 5.1 Mòdul nou de funcions pures: `frontend/utils/SubtitlesEditor/formatTags.ts`

Sense dependències de DOM ni de React (testejable de manera aïllada). Opera sobre strings SRT amb tags `<i>`, `<b>`, `<u>` (case-insensitive en lectura, minúscules en escriptura — coherent amb `plainToRich`/`richToPlain`).

```typescript
export type SrtFormatTag = 'i' | 'b' | 'u';

/** Elimina totes les aparicions de <tag> i </tag> (case-insensitive). No toca cap altre tag. */
export function stripTag(text: string, tag: SrtFormatTag): string;

/**
 * true si TOT el text visible del bloc està dins de regions <tag>…</tag>.
 * - "Text visible" = el text després de treure qualsevol seqüència <...> (mateix criteri que stripSrtTags).
 * - Els espais/salts de línia FORA de regions s'ignoren (així <i>l1</i>\n<i>l2</i> compta com a tot-cursiva).
 * - Un <tag> obert sense tancar cobreix fins al final del text (tolerància a tags desequilibrats).
 * - Text visible buit → false.
 */
export function isFullyTagged(text: string, tag: SrtFormatTag): boolean;

/** true si el text té contingut visible (stripSrtTags(text).trim().length > 0). */
export function hasVisibleText(text: string): boolean;

/**
 * Embolcalla CADA LÍNIA amb <tag>…</tag>. Les línies sense text visible es deixen intactes
 * (mai es genera <i></i>). PRECONDICIÓ del cridador: passar el text ja net del tag (stripTag).
 */
export function wrapTagPerLine(text: string, tag: SrtFormatTag): string;

/** true si el conjunt té ≥1 text amb contingut visible i TOTS els que en tenen són fullyTagged. */
export function allFullyTagged(texts: string[], tag: SrtFormatTag): boolean;

/**
 * Toggle en lot amb semàntica "fer consistent":
 * - Si allFullyTagged(texts) → TREURE: cada text amb contingut visible es retorna stripTag(text).
 * - Si no → APLICAR: cada text amb contingut visible es retorna wrapTagPerLine(stripTag(text), tag).
 * - Els textos sense contingut visible es retornen byte-idèntics.
 * Retorna el nou array (mateixa longitud i ordre).
 */
export function toggleTagOnTexts(texts: string[], tag: SrtFormatTag): string[];
```

**Detall d'`isFullyTagged`** (implementació de referència): tokenitzar el string amb un únic recorregut per regex global `/<[^>]*>/g`; per a cada token, si és `<tag>` → `depth++`, si és `</tag>` → `depth = max(0, depth-1)`, qualsevol altre `<...>` s'ignora (és markup, no text visible); els caràcters entre tokens són text visible: si `depth === 0` i el fragment conté algun caràcter no-blanc → `false`. En acabar, `true` si s'ha vist ≥1 caràcter visible no-blanc.

### 5.2 Per què aquesta semàntica compleix el que demana l'usuari

Exemple de l'usuari: `hola <i>com</i> estàs` + tota la frase seleccionada + botó I:

1. `allFullyTagged` → fals ("hola" i "estàs" són fora de `<i>`) → direcció = **APLICAR**.
2. `stripTag` → `hola com estàs` (la cursiva parcial desapareix — la normalització que demana).
3. `wrapTagPerLine` → `<i>hola com estàs</i>`.

Mai es generen tags niats del mateix tipus ni seqüències creuades per culpa d'aquesta operació. I com que `stripTag`/`wrapTagPerLine` **només toquen el tag demanat**, `<b>`/`<u>` queden exactament on eren: `hola <b>com</b> estàs` + I → `<i>hola <b>com</b> estàs</i>`.

Direcció del toggle amb estats mixtos (alguns blocs tot-cursiva, altres no): **APLICAR a tots** (els que ja ho eren queden visualment igual — strip+wrap és idempotent). Només quan **tots** els blocs (amb text) són tot-cursiva, el botó **TREU** la cursiva de tots. És el model estàndard de "make consistent" (Word, Google Docs, Subtitle Edit).

### 5.3 Cablatge als botons B/I/U (`SubtitlesEditor.handleFormatAction`)

```typescript
const handleFormatAction = (command: string) => {
  if (!isEditable) return;
  if (selectionEnabled && selectedIds.size > 0) {
    const tag: SrtFormatTag = command === 'bold' ? 'b' : command === 'italic' ? 'i' : 'u';
    const sel = segments.filter(s => selectedIds.has(s.id as number));
    const texts = sel.map(s => s.originalText || '');
    const newTexts = toggleTagOnTexts(texts, tag);
    const changes = sel
      .map((s, k) => ({ id: s.id as number, newText: newTexts[k] }))
      .filter((c, k) => newTexts[k] !== texts[k]);
    if (changes.length > 0) onSegmentsBatchChange!(changes);
    return;                      // amb selecció activa MAI s'executa execCommand
  }
  document.execCommand(command, false);   // comportament actual intacte
};
```

- Els botons conserven `onMouseDown={preventDefault}` (no roben focus; innocu en mode lot).
- Les dreceres natives del navegador (Ctrl+B/I/U dins del contentEditable) **no** disparen el mode lot: només afecten el bloc enfocat, com fins ara. Documentat com a comportament esperat.

**Estat visual dels botons**: amb selecció activa, el ressaltat de B/I/U passa a reflectir l'estat del lot en lloc de `queryCommandState`:

```typescript
const batchFormatState = useMemo(() => {
  if (!selectionEnabled || selectedIds.size === 0) return null;
  const texts = segments.filter(s => selectedIds.has(s.id as number)).map(s => s.originalText || '');
  return {
    bold: allFullyTagged(texts, 'b'),
    italic: allFullyTagged(texts, 'i'),
    underline: allFullyTagged(texts, 'u'),
  };
}, [selectionEnabled, selectedIds, segments]);
const shownFormatState = batchFormatState ?? formatState;   // els 3 botons usen shownFormatState
```

### 5.4 Aplicació del canvi a les vistes (callback nou)

Prop nova a `SubtitlesEditorProps`:

```typescript
/** Aplica canvis de text a diversos segments de cop (format en lot). Un únic pas d'undo. */
onSegmentsBatchChange?: (changes: Array<{ id: number; newText: string }>) => void;
```

Implementació **idèntica** a les dues vistes (al costat dels handlers existents):

```typescript
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

Punts clau:

- **`richText: ''`** al segment modificat — mateix patró que `syncEditorsToState` (`SegmentItem.tsx:243`). Imprescindible: `serializeSrt` fa `segment.richText || segment.originalText` (`srtParser.ts:58`); un `richText` ranci exportaria text antic.
- **`subsHistory.commit(next)`** — un únic pas d'undo (push de l'estat present a `past`, `commitHistory` a `historyManager.ts:27-40`). Es calcula sobre `subsHistory.present` (= draft viu, inclou tecleig no commitejat perquè `onInput` → `updateDraft` a cada pulsació).
- La vista principal passa a `SubtitlesEditor` l'array **derivat** `linkedSegmentsWithDiff`, però els canvis es mapen **per id** sobre `subsHistory.present` (font de veritat), així que no es persisteixen camps derivats nous. Els ids coincideixen entre derivat i font (la derivació no els altera).
- L'autosave existent de **les dues vistes** (efectes que observen `subsHistory.historyState.present`: vista principal l.~485-507, standalone l.~274-298) es dispara sol amb el commit. Cap canvi.

### 5.5 Refresc visual dels blocs modificats

`SegmentItem` ja re-sincronitza el contentEditable quan `segment.originalText` canvia des de fora (`useLayoutEffect`, `SegmentItem.tsx:458-526`): compara i reescriu `innerHTML` amb `plainToRich(nou text)`. Els blocs seleccionats visibles s'actualitzen a l'instant; els no muntats (virtualitzats) es munten ja amb el text nou. Cas particular: si un dels blocs del lot tenia el focus del teclat, el seu `innerHTML` es reescriu i el caret es perd — acceptat (idèntic al que passa avui amb undo extern mentre s'edita).

---

## 6. Canvis per fitxer

| Fitxer | Canvi |
|---|---|
| `frontend/utils/SubtitlesEditor/formatTags.ts` | **NOU.** Funcions pures de la secció 5.1 (~70 línies amb comentaris). |
| `frontend/components/VideoSubtitlesEditor/SegmentItem.tsx` | +3 props opcionals (`isSelected?`, `selectionActive?`, `onToggleSelect?`); canal esquerre amb el checkbox (primer fill del wrapper `flex items-stretch`, línia 582); fons de fila quan `isSelected`. |
| `frontend/components/VideoSubtitlesEditor/SubtitlesEditor.tsx` | +1 prop (`onSegmentsBatchChange?`); estat `selectedIds` + `anchorIdRef` + efectes d'invalidació (§4.4); `handleToggleSelect`; branca lot dins `handleFormatAction`; `batchFormatState`/`shownFormatState` als 3 botons; chip "N sel. ✕" a la capçalera; pas de les 3 props noves a `SegmentItem`. |
| `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` | +`handleSegmentsBatchChange` (§5.4) i prop `onSegmentsBatchChange` a l'instància de `SubtitlesEditor` (línia ~1026). |
| `frontend/components/VideoSubtitlesEditor/VideoSrtStandaloneEditorView.tsx` | Ídem (instància a la línia ~454). |

**Total: 4 fitxers modificats + 1 nou. Backend intacte. Cap canvi d'esquema ni de settings.**

---

## 7. Casos límit

| Cas | Comportament |
|---|---|
| Maj+clic sense selecció prèvia | Toggle simple + fixa àncora. |
| Maj+clic 104 amb àncora 78 | Selecciona 78–104 inclosos (unió amb el que ja hi hagués). Àncora ← 104. |
| Maj+clic "cap enrere" (àncora 104, clic 78) | Mateix rang 78–104 (min/max per índex). |
| Rang sobre blocs ja seleccionats | Unió idempotent; mai desselecciona. |
| Split/merge/insert/delete/undo estructural | `segments.length` canvia → selecció i àncora es buiden (els ids es renumeren i deixarien de ser fiables). |
| Undo/redo del batch de format | 1 pas; longitud/ids intactes → la selecció es manté i es pot re-aplicar. |
| Bloc buit o només espais dins la selecció | Mai s'embolcalla (`<i></i>` prohibit); no compta per decidir la direcció del toggle; roman byte-idèntic. |
| Selecció formada només per blocs buits | `toggleTagOnTexts` retorna tot igual → `changes = []` → no es fa commit. |
| Tots els blocs (amb text) ja tot-cursiva | El botó I **treu** la cursiva de tots (`stripTag`). |
| Estat mixt | El botó I **aplica** a tots: strip+wrap (els ja-cursiva queden visualment idèntics). |
| `hola <i>com</i> estàs` + I | `<i>hola com estàs</i>` (normalitza, mai niats). |
| `<i>Hola</i> <i>que tal</i>` (tot el visible dins i, espai fora) | Es reconeix com a tot-cursiva (els blancs fora s'ignoren). |
| Multilínia `<i>l1</i>\n<i>l2</i>` vs `<i>l1\nl2</i>` | Ambdós es reconeixen com a tot-cursiva; en aplicar, sempre es normalitza a per-línia. |
| Línia buida enmig d'un bloc multilínia | Es conserva sense embolcallar. |
| Tag desequilibrat d'origen extern (`<i>text` sense tancar) | `isFullyTagged` el tracta com a cobertura fins al final; strip+wrap el repara per a aquest tag. |
| Niament invàlid extern (`<b>Ho<i>la</b></i>`) + I | Es treu/re-aplica només `<i>`; `<b>` queda exactament on era (no movem ni validem tags aliens). |
| Cursiva + després negreta al mateix conjunt | `<b><i>text</i></b>` — niament correcte, ordre exterior = últim aplicat. |
| Tags en MAJÚSCULES d'SRT extern (`<I>`) | Lectura i strip case-insensitive; escriptura sempre en minúscules. |
| Tags no canònics (`<i >` amb espai, `<i class=…>`, `<font …>`) | Es tracten com a markup aliè: compten com a no-visible (criteri idèntic a `stripSrtTags`) però `stripTag` NO els elimina ni els normalitza. Implausible en fluxos reals: `richToPlain` només emet tags canònics i `plainToRich` ja els mostra com a text literal avui. |
| Comptadors CPS/caràcters | No canvien: `textMetrics.stripSrtTags` ja elimina `<...>` abans de comptar. |
| Enforcement `maxLines` | No afectat: el wrap no afegeix `\n`. |
| Mode lectura (`isEditing = false`) | Ni checkboxes ni batch; B/I/U ja feien no-op per la guarda `isEditable`. |
| Botons B/I/U amb selecció activa i cap contentEditable enfocat | Funcionen (el lot no depèn del focus) — abans no feien res útil en aquest escenari. |
| Bloc del lot amb focus de teclat | El text es reescriu i el caret es perd (equivalent a undo extern actual). Acceptat. |
| Canvi de document | Si la longitud difereix, la selecció es buida. Cas residual: vincular per drag&drop un SRT amb el mateix nombre exacte de blocs conserva la selecció sobre el contingut nou (vegeu §4.4, residu conegut i acceptat). |
| Overlay de vídeo | Renderitza cursiva/negreta/subratllat correctament (preexistent, `VideoPlayer.tsx:32`). |
| Export SRT / autosave backend | `serializeSrt` escriu els tags tal qual; `richText: ''` garanteix que s'usa `originalText`. |

---

## 8. Verificació

1. **Tipus**: `npx tsc --noEmit` net al frontend.
2. **Build**: `npm run build` (Vite) net.
3. **Lògica pura**: script temporal de verificació (scratchpad, fora del repo) que executa `stripTag`/`isFullyTagged`/`wrapTagPerLine`/`toggleTagOnTexts` contra la taula de casos límit de la secció 7 (el projecte no té infraestructura de tests; no se n'afegeix).
4. **Manual (si hi ha entorn)**: seleccionar 78 → Maj+clic 104 → I; comprovar normalització, undo d'un sol pas, i que B/U no es toquen.

---

## 9. No cal canviar

- `srtParser.ts` — parse/serialize ja conserven tags.
- `splitHelpers.ts` — el seu reequilibri de tags en split segueix funcionant amb tags per línia (cas encara més senzill).
- `richTextHelpers.ts` — `plainToRich`/`richToPlain` ja suporten i/b/u; el mòdul nou és independent.
- `textMetrics.ts` — ja ignora tags.
- `useDocumentHistory.ts` / `historyManager.ts` — `commit(value)` ja fa exactament el que cal.
- `VideoSubtitlesToolbar.tsx` — la barra de transport no hi intervé.
- Backend — el text SRT amb tags ja viatja i es desa tal qual.
