# Disseny: Cerca i substitució de text a l'editor de subtítols

**Data:** 2026-07-02
**Àmbit:** Editor de subtítols (vista principal `VideoSubtitlesEditorView` i standalone `VideoSrtStandaloneEditorView`)
**Referència UX:** Buscador de Microsoft Word (cerca literal amb opcions, substituir un a un o tot)

---

## 1. Problema i motivació

L'editor de subtítols no té cap manera de localitzar un terme dins del document ni de substituir-lo. En documents de centenars de blocs, corregir un nom mal transcrit ("Marta" → "Berta") obliga a repassar visualment tots els blocs un a un.

L'usuari demana:

1. Una **eina de cerca de text a la part superior** de l'editor de subtítols.
2. Cerca de **termes exactes** (literal, sense regex), amb opcions tipus Word: **coincidir majúscules/minúscules** i **només paraules completes** (desactivades per defecte).
3. **Substituir**: la coincidència activa (un a un) o **totes de cop** en el document.
4. Aparició amb **botó lupa + Ctrl+F**, barra desplegable sota la capçalera, tancament amb Esc/✕ (decisió d'UX validada amb l'usuari).

**Abast validat amb l'usuari:** només l'editor de subtítols. L'editor de guions (`EditorDeGuions`, columnes original/traducció) queda explícitament fora — si es fa en el futur, necessitarà cerca per columna.

---

## 2. Àmbit i enfocament

### Inclòs
- Component nou **`SearchReplaceBar`** renderitzat dins de `SubtitlesEditor` (component compartit per les dues vistes → una sola implementació).
- **Botó lupa** a la capçalera de `SubtitlesEditor` + acció de teclat **`FIND` (Ctrl+F)** integrada al sistema de dreceres configurables (`DEFAULT_SHORTCUTS.subtitlesEditor`).
- Cerca **literal, en viu** (mentre s'escriu), sobre el **text visible** del subtítol (ignorant els tags `<b>/<i>/<u>` i qualsevol `<...>`), per defecte insensible a majúscules.
- Opcions: **Aa** (majúscules/minúscules) i **paraula completa** (límits de paraula Unicode: lletres i dígits, accents catalans inclosos).
- Comptador «N de M», navegació ▲/▼ (amb *wrap-around*), scroll automàtic al bloc de la coincidència activa (virtualitzador existent).
- **Ressaltat** de totes les coincidències visibles + coincidència activa destacada via **CSS Custom Highlight API** (no muta el DOM del contentEditable → no contamina el text desat). *Fallback* si l'API no existeix: només scroll + fons de fila del bloc actiu.
- **Substituir** (coincidència activa) i **Substituir-ho tot**, ambdós via `onSegmentsBatchChange` → **un pas d'undo cadascun**. En Substituir-ho tot (només): missatge inline «S'han fet N substitucions» («S'ha fet 1 substitució» en singular).
- Si una coincidència travessa un canvi de format, el text substituït **hereta el format del primer caràcter** de la coincidència (criteri Word).
- La **cerca funciona sempre** (mode lectura inclòs); els controls de substitució només actius amb `isEditable && onSegmentsBatchChange`.
- Mòdul de **funcions pures** `frontend/utils/SubtitlesEditor/searchReplace.ts`, verificable de manera aïllada.

### Exclòs
- Editor de guions (`EditorDeGuions`) — validat amb l'usuari.
- Regex, cerca difusa, "sona com", formats de Word avançats.
- Cerca que travessi el límit entre blocs o entre línies d'un bloc (vegeu §5.4 — de fet és impossible per construcció).
- Persistència de l'estat de cerca (terme, opcions) entre sessions o documents.
- Historial de cerques.
- Canvis a `SrtPreviewView`, overlay de vídeo, backend, esquemes.

---

## 3. Alternatives considerades

| Alternativa | Descripció | Decisió |
|---|---|---|
| **A. Barra dins `SubtitlesEditor` (compartit)** (triada) | Estat de cerca i UI viuen a `SubtitlesEditorInner`; les vistes no aporten res de nou (el callback `onSegmentsBatchChange` ja existeix a totes dues des del batch de format). | ✅ Una implementació, dues vistes; zero prop drilling nou; el virtualitzador (scroll) i la capçalera ja hi són. |
| B. Implementar a cada vista | Duplicaria estat, UI i lògica en rutes germanes que caldria mantenir simètriques (risc del CLAUDE.md del frontend). | ❌ |
| C. Diàleg flotant tipus Word clàssic | Tapa el vídeo, més estats de posicionament, no aporta res sobre la barra. | ❌ |
| Ressaltat: injectar `<mark>` a l'`innerHTML` | Mutaria el contingut del contentEditable: risc de contaminar `richToPlain`/autosave i de trencar el caret. | ❌ |
| **Ressaltat: CSS Custom Highlight API** (triada) | `CSS.highlights` + `::highlight()` pinta rangs sense tocar el DOM. Suportat a Chrome/Edge 105+, Firefox 140+, Safari 17.2+. | ✅ amb *fallback* net si no existeix. |
| Substituir-un via `onSegmentChange` (draft + blur) | El commit dependria del blur; l'undo quedaria acoblat al focus. | ❌ — `onSegmentsBatchChange` amb 1 element = 1 pas d'undo net i explícit. |

---

## 4. UI de la barra (`SearchReplaceBar`)

### 4.1 Obertura i tancament

- **Botó lupa** a la capçalera de `SubtitlesEditor` (grup de botons existent, entre el botó de sincronització i el separador previ a B/I/U), `title="Cercar i substituir (Ctrl+F)"`. Toggle: obre/tanca.
- **Drecera `FIND`** nova a `DEFAULT_SHORTCUTS.subtitlesEditor`: `{ id: 'sub_find', action: 'FIND', label: 'Cercar i substituir', combo: 'Ctrl+F' }`. `SubtitlesEditorInner` registra el seu propi `useKeyboardShortcuts('subtitlesEditor', handler)` que només tracta `FIND` (les vistes ja tenen el seu listener per a la resta d'accions; dos listeners del mateix `appId` coexisteixen sense conflicte — cadascú ignora les accions que no tracta).
  - En obrir amb Ctrl+F: si hi ha text seleccionat dins d'un contentEditable de segment, es **prefil·la** el camp de cerca amb aquesta selecció (una sola línia; si la selecció travessa línies, s'ignora). Com Word.
  - Ctrl+F amb la barra ja oberta: enfoca i selecciona el camp de cerca (no la tanca).
- **Tancament**: botó ✕ o **Esc** amb el focus dins de la barra. En tancar: es buiden els ressaltats (`CSS.highlights.delete`), es conserva el terme per si es reobre dins de la mateixa sessió del component, i el focus torna al contenidor de l'editor.
- La barra es renderitza **entre la capçalera i la llista** (germana prèvia del contenidor de scroll), `flex-shrink-0`, coherent amb les barres existents de correccions/insercions pendents.

### 4.2 Controls (una fila, dues si el mode edició està actiu)

```
[🔍 input Cercar...] [Aa] [ab]  [3 de 17] [▲] [▼]              [✕]
[input Substituir per...] [Substituir] [Substituir-ho tot]  [msg]
```

- **Fila 1 (sempre):** input de cerca (autofocus en obrir), toggle **Aa** (`title="Coincidir majúscules/minúscules"`), toggle **paraula completa** (`title="Només paraules completes"`), comptador «3 de 17» (o «Sense resultats» / buit si no hi ha terme), ▲ anterior / ▼ següent, ✕ tancar.
- **Fila 2 (només `isEditable && onSegmentsBatchChange`):** input de substitució, botó **Substituir**, botó **Substituir-ho tot**, i espai per al missatge efímer «S'han fet N substitucions» (desapareix al cap d'~4s o en canviar el terme).
- **Teclat dins dels inputs** (`onKeyDown` local amb `stopPropagation` per no interferir amb altres listeners): `Enter` → següent; `Shift+Enter` → anterior; `Esc` → tancar; `Enter` a l'input de substitució → Substituir.
- Estils coherents amb el tema: fons `var(--th-header-bg)`, vores `var(--th-border)`, toggles actius amb fons `var(--th-accent)` i text `var(--th-text-inverse)` (mateix patró que els botons B/I/U actius). Textos UI en català.
- Botons ▲/▼/Substituir/Substituir-ho tot **deshabilitats** quan no hi ha coincidències (i els de substituir, també sense terme).

---

## 5. Model de cerca (mòdul pur `searchReplace.ts`)

### 5.1 Text visible i model de caràcters

El text SRT cru (`segment.originalText`) pot contenir tags `<b>/<i>/<u>` (canònics, els únics que emet `richToPlain`) i, teòricament, altres seqüències `<...>` d'SRT externs. Criteri idèntic a `textMetrics.stripSrtTags` i a `formatTags.ts`: **qualsevol `<[^>]*>` és markup invisible**; la resta són caràcters visibles. Els `\n` són caràcters visibles (separadors de línia). ` ` es normalitza a espai normal en comparar (el DOM en conté per `plainToRich`; `richToPlain` els retorna a espai — longitud idèntica, offsets estables).

**Model de caràcters** (base de la substitució amb formats): un únic recorregut amb `/<[^>]*>/g` produeix, per a cada caràcter visible, la **pila de tags canònics oberts** (`b`/`i`/`u`, lectura case-insensitive; un tag obert sense tancar cobreix fins al final — mateixa tolerància que `isFullyTagged`). Els tokens `<...>` **no canònics** es conserven com a tokens opacs ancorats al caràcter visible següent (o al final del text).

```typescript
export interface SearchOptions { caseSensitive: boolean; wholeWord: boolean; }
/** Coincidència en offsets de TEXT VISIBLE (sense tags, \n inclòs com a caràcter). */
export interface SegmentMatch { segmentId: number; segmentIndex: number; start: number; end: number; }

/** Text visible d'un text SRT cru: treu tot <...>, normalitza U+00A0 → espai. Conserva \n. */
export function toVisibleText(raw: string): string;

/** Coincidències dins d'un text visible. Literal, sense solapaments (avança end). */
export function findMatchesInText(visible: string, query: string, opts: SearchOptions): Array<{ start: number; end: number }>;

/** Coincidències de tot el document, en ordre (índex de segment, offset). */
export function findMatches(
  segments: Array<{ id: number; originalText: string }>,
  query: string,
  opts: SearchOptions
): SegmentMatch[];

/**
 * Substitueix el rang visible [start, end) del text CRU per `replacement` (text pla).
 * Els caràcters inserits hereten la pila de tags del PRIMER caràcter substituït.
 * Re-serialitza el text sencer des del model de caràcters: tags canònics balancejats
 * per canvi de pila, tokens opacs re-emesos a la seva àncora. Mai genera parells buits.
 */
export function replaceVisibleRange(raw: string, start: number, end: number, replacement: string): string;
```

### 5.2 Comparació

- **Literal** (mai regex; el terme no s'interpreta).
- **Insensible a majúscules per defecte**: es compara sobre còpies *case-folded* construïdes **caràcter a caràcter** amb `toLowerCase()` (conservant el caràcter original si el fold en canviés la longitud UTF-16 — casos exòtics tipus 'İ') → els offsets del text foldejat i de l'original queden alineats 1:1 per construcció. Amb **Aa** actiu, comparació directa. El terme de cerca es normalitza igual que el text visible (` ` U+00A0 → espai): un prefill des del DOM (que conté `&nbsp;` per `plainToRich`) troba el text que l'usuari veu.
- **Paraula completa**: caràcter de paraula = `/[\p{L}\p{N}]/u` (lletres Unicode — accents, ç, ñ — i dígits). Una coincidència és vàlida si el caràcter anterior a `start` i el caràcter a `end` no són de paraula (o no existeixen). El guionet, l'apòstrof i el `\n` compten com a separadors (cercar "l" amb paraula completa troba la "l" de "l'home").
- **Sense solapaments**: després d'una coincidència, la cerca continua a `end` (cercar "aa" dins "aaaa" → 2 coincidències).

### 5.3 Cerca en viu i estabilitat

- `matches = useMemo(findMatches(segments, query, opts), [segments, query, opts])` dins de `SubtitlesEditorInner`. Es recalcula amb cada pulsació (el draft viu ja arriba via `segments`) i amb undo/redo. Cost: O(text total) per recàlcul — el document més gran esperat (~2-3k blocs × ~80 chars) és < 1 ms; sense necessitat de *debounce*, però se n'hi posa un de 150 ms **només sobre `query`** per no ressaltar mentre s'escriu ràpid.
- **Índex actiu** (`activeMatchIndex`): es manté per posició `(segmentIndex, start)`. Quan `matches` canvia (edició, undo, canvi de terme o d'opcions), es re-selecciona **la primera coincidència amb posició ≥ l'anterior activa** (wrap a 0 si no n'hi ha; −1 si no hi ha coincidències). Això evita salts estranys mentre s'edita i dona continuïtat de posició en canviar el terme (com Word/VSCode).
- La vista principal passa l'array derivat `linkedSegmentsWithDiff`, però ids i textos coincideixen amb `subsHistory.present` (mateix patró ja validat pel batch de format) → les substitucions per id són correctes.

### 5.4 Per què una coincidència mai travessa línies ni blocs

L'input de cerca és d'una sola línia: el terme no pot contenir `\n`. Com que la comparació és literal i `\n` és un caràcter que mai apareix al terme, cap coincidència pot incloure un salt de línia ni, òbviament, travessar blocs. No cal cap cas especial.

---

## 6. Navegació i ressaltat

### 6.1 Scroll

El scroll només respon a **accions explícites**: navegació (▲/▼/Enter — també amb una única coincidència: retorna al match si l'usuari s'ha allunyat amb scroll manual), terme o opcions de cerca nous (cap a la coincidència re-ancorada per continuïtat de posició — §5.3), i Substituir (cap a la següent). S'executa `virtualizer.scrollToIndex(match.segmentIndex, { align: 'center', behavior: 'smooth' })` — mateix mecanisme que l'auto-scroll de reproducció. El recàlcul de `matches` per **edicions de text mai mou el viewport** (implementació per intenció: flag `pendingScrollRef` consumit pel re-ancoratge + scroll imperatiu a la navegació). **No** es roba el focus del contentEditable ni es toca el caret.

### 6.2 Ressaltat (CSS Custom Highlight API)

- **Detecció**: `typeof CSS !== 'undefined' && 'highlights' in CSS`. Si no hi és → *fallback*: només scroll + el bloc de la coincidència activa rep fons `var(--th-accent-muted)` (estil inline al wrapper de fila virtual; pot quedar tapat pel fons propi del bloc — vegeu §9).
- **Efecte de pintat** a `SubtitlesEditorInner`, dependent de `[matches, activeMatchIndex, virtualItems, segments, barOpen]`:
  1. Per a cada fila virtual renderitzada, localitzar el seu contentEditable (selector `[contenteditable]` dins del wrapper `data-index`).
  2. Convertir offsets visibles → posicions DOM recorrent `childNodes` en profunditat: node de text suma `length`; `<br>` suma 1 (el `\n` del model visible); elements de format recursen. La correspondència amb `toVisibleText` és exacta NOMÉS per a tags canònics (`plainToRich` els converteix en elements sense text, igual que `toVisibleText` els elimina; el U+00A0 compta 1 com l'espai). Amb tokens NO canònics (`<font …>`) no hi ha correspondència (`plainToRich` els mostra com a text literal): abans de pintar es compara la longitud visible del DOM amb la del model i, si no quadren, el segment NO es pinta (guard defensiu; cerca, comptador i substitució segueixen funcionant).
  3. Crear un `Range` per coincidència visible; `CSS.highlights.set('srt-search', new Highlight(...))` i `'srt-search-active'` per a l'activa.
- **Neteja**: `CSS.highlights.delete('srt-search'|'srt-search-active')` en tancar la barra, en quedar-se sense terme i al cleanup de l'efecte/unmount.
- **Estils** (al final del bloc `<style>` global de `frontend/index.html`):
  ```css
  ::highlight(srt-search) { background-color: rgba(250, 204, 21, 0.35); }
  ::highlight(srt-search-active) { background-color: rgba(249, 115, 22, 0.65); color: white; }
  ```
- Les coincidències de blocs **no renderitzats** (fora del viewport virtual) no tenen DOM → no es pinten; es pinten soles quan hi fas scroll (l'efecte depèn de `virtualItems`). El comptador «N de M» sempre reflecteix el total del document.
- Escriure dins d'un bloc mentre la cerca és activa: l'efecte es re-executa (canvia `segments`) i re-pinta amb els offsets nous. El ressaltat no interfereix amb el caret (no muta DOM).

---

## 7. Substitució

### 7.1 Substituir (un)

1. Requereix coincidència activa i mode edició.
2. `newRaw = replaceVisibleRange(seg.originalText, m.start, m.end, replacement)`.
3. `onSegmentsBatchChange([{ id: m.segmentId, newText: newRaw }])` → **1 pas d'undo**; el handler de les dues vistes ja fa `richText: ''` (imprescindible: `serializeSrt` fa `richText || originalText`).
4. La coincidència activa passa a la **primera amb posició ≥ `(segmentIndex, start + replacement.length)`** (recalculada sobre l'estat nou), amb *wrap*. Aquesta regla evita el bucle infinit quan el terme de substitució conté el de cerca ("a" → "aa") i reprodueix el comportament de Word (salta a la següent).
5. El contentEditable del bloc es re-sincronitza sol (`useLayoutEffect` existent de `SegmentItem` sobre canvis externs d'`originalText`). Si aquell bloc tenia el focus, el caret es perd — idèntic i acceptat com al batch de format.

### 7.2 Substituir-ho tot

1. Per a cada segment amb coincidències, aplicar `replaceVisibleRange` a **totes les seves coincidències de dreta a esquerra** (els offsets anteriors no es desplacen).
2. Un únic `onSegmentsBatchChange(changes)` amb tots els segments afectats → **un únic pas d'undo** per a tota l'operació.
3. Missatge inline «S'han fet N substitucions» (N = coincidències substituïdes). Després, el terme deixa de tenir coincidències (tret del cas terme ⊂ substitució, on el comptador mostrarà les noves — comportament Word, correcte).

### 7.3 Herència de format (criteri Word)

`replaceVisibleRange` insereix cada caràcter del text nou amb **la pila de tags del primer caràcter substituït**:

| Cas | Resultat |
|---|---|
| Coincidència tota dins d'un format (`<i>buenos días</i>`, cercar "días" → "tardes") | `<i>buenos tardes</i>` — es conserva. |
| Coincidència que travessa un límit (`buenos <i>días</i>`, cercar "buenos días" → "hola") | `hola` (pila del 1r caràcter: buida). El parell `<i></i>` residual **no s'emet** (la re-serialització surt del model de caràcters, mai genera parells buits). |
| Coincidència que comença dins (`<b>bue</b>nos`, cercar "buenos" → "malos") | `<b>malos</b>` — hereta la negreta del primer caràcter. |
| Substitució per cadena buida (esborrar el terme) | S'eliminen els caràcters; tags balancejats; línies poden quedar buides (no es fusionen ni s'eliminen blocs — l'usuari decideix). |
| Text amb tags desequilibrats d'origen extern | El model els llegeix amb tolerància obert-fins-al-final; el segment substituït queda **normalitzat** (balancejat). Només afecta segments modificats. |

**Nota d'idempotència**: la re-serialització del model de caràcters pot normalitzar el segment substituït — la forma dels tags (p. ex. `<i>l1\nl2</i>` → `<i>l1</i>\n<i>l2</i>`, forma per-línia, la mateixa convenció que `formatTags.wrapTagPerLine`) i els ` ` U+00A0 a espai normal (equivalent al que ja fa `richToPlain` en qualsevol edició manual del bloc). Visualment idèntic; només en segments tocats per una substitució.

**Residu acceptat**: si l'usuari tecleja literalment `<i>` al camp de substituir, el text cru resultant conté `<i>` i les capes posteriors (`plainToRich`, overlay, export) ho interpretaran com a cursiva. L'SRT no té mecanisme d'escapament; és el mateix comportament que si ho tecleja directament al bloc. Documentat, no es bloqueja.

---

## 8. Canvis per fitxer

| Fitxer | Canvi |
|---|---|
| `frontend/utils/SubtitlesEditor/searchReplace.ts` | **NOU.** Funcions pures §5.1 (~150 línies amb comentaris). Sense DOM ni React. |
| `frontend/components/VideoSubtitlesEditor/SearchReplaceBar.tsx` | **NOU.** UI de la barra (§4.2). Component controlat: rep terme/opcions/comptador/handlers per props; sense estat de negoci propi (només el missatge efímer). |
| `frontend/components/VideoSubtitlesEditor/SubtitlesEditor.tsx` | Estat de cerca (`barOpen`, `query`, `replaceText`, `opts`, `activeMatchIndex`), `matches` (useMemo), efecte de ressaltat (§6.2), scroll (§6.1), handlers de navegació i substitució (§7), botó lupa a la capçalera, `useKeyboardShortcuts('subtitlesEditor', …)` per a `FIND`, render de `SearchReplaceBar`. |
| `frontend/constants.ts` | +1 drecera a `DEFAULT_SHORTCUTS.subtitlesEditor`: `sub_find` / `FIND` / `Ctrl+F`. |
| `frontend/index.html` | +2 regles `::highlight()` al `<style>` global. |

**Total: 3 fitxers modificats + 2 nous. Les vistes NO es toquen** (el callback `onSegmentsBatchChange` ja hi és a totes dues). Backend intacte. Cap canvi d'esquema.

### Nota sobre la drecera i usuaris existents

`useKeyboardShortcuts.getCachedShortcuts` llegeix el localStorage **sense** fusionar amb els defaults; però `AuthContext.refreshMe` re-escriu el localStorage amb `mergeShortcuts(DEFAULT_SHORTCUTS, prefs)` a cada càrrega de perfil → els usuaris amb sessió backend reben `sub_find` automàticament al següent login/refresh. Cas residual: usuari sense backend amb shortcuts antics desats localment no tindrà Ctrl+F fins que obri Configuració (que fusiona) — el **botó lupa sempre funciona**, i el quadre de dreceres de Configuració mostrarà la drecera nova. Acceptat.

---

## 9. Casos límit

| Cas | Comportament |
|---|---|
| Terme buit | Cap coincidència, comptador buit, ressaltats nets, botons deshabilitats. |
| Terme sense coincidències | «Sense resultats», ▲/▼/Substituir deshabilitats. |
| Terme amb espais o només espais | Literal: es cerca tal qual (Word ho fa igual). |
| Coincidències solapades («aa» dins «aaaa») | 2 (avança per `end`). |
| Terme amb `<` o `>` («2<3») | Es cerca sobre text visible; si el text cru té `2<3` literal, `toVisibleText` el manté (el `<` sense `>` posterior no forma token `<...>`)*. |
| Coincidència dins de text amb ` ` (doble espai) | Compta com a espai normal a la cerca i al mapping DOM (longituds idèntiques). |
| Paraula completa amb accents («càmera», «años») | `\p{L}` els reconeix com a caràcters de paraula. |
| Paraula completa a inici/final de línia o de bloc | Vàlida (no hi ha caràcter veí). |
| Cerca amb la barra oberta + undo/redo | `matches` es recalcula; l'activa es re-ancora per posició (§5.3). |
| Split/merge/insert/delete amb la barra oberta | Ídem: recàlcul complet; ids nous es reflecteixen als `matches` següents. |
| Substituir amb el document en mode lectura | Fila 2 no es renderitza; la cerca, el comptador i la navegació funcionen. Caveat: el ressaltat per caràcter pot no pintar-se en mode lectura (el re-sync del contentEditable de `SegmentItem` fa early-return amb `!isEditable` i el DOM pot no estar hidratat) — acceptat. |
| Substituir-ho tot amb diverses coincidències al mateix segment | Dreta→esquerra, un sol commit, offsets correctes. |
| Substitució que conté el terme («a» → «aa») | Substituir-un salta a la següent (regla ≥ posició + longitud); Substituir-ho tot acaba (una passada sobre les coincidències del moment). |
| Substituir amb resultat cru idèntic (la substitució no canvia ni un byte del text del segment) | No es fa cap commit; l'activa salta a la següent coincidència, com Word. Si terme == substitució però el match difereix en majúscules, o la re-serialització normalitza el segment (§7.3: forma per-línia, U+00A0, tags desequilibrats), sí que hi ha commit — canvi real del text cru, visualment idèntic o amb canvi de caixa. |
| Substitució buida | Esborra el terme; el bloc pot quedar amb línia buida — no s'auto-elimina. |
| Coincidència que travessa `<i>…</i>` | Hereta el format del 1r caràcter; mai queden parells buits ni tags creuats (§7.3). |
| Tags no canònics (`<font …>`) al segment substituït | Tokens opacs re-emesos ancorats al caràcter visible següent; si la substitució elimina aquell caràcter, s'ancoren al següent supervivent (o al final). No es validen ni es reordenen més enllà d'això. |
| Bloc amb focus del teclat substituït | El contentEditable es reescriu i el caret es perd (igual que batch de format / undo extern). Acceptat. |
| Ctrl+F amb focus al camp de cerca | Re-selecciona el camp (no tanca). |
| Ctrl+F amb focus al camp de substitució | Torna el focus al camp de cerca i el selecciona (gestionat al keydown local amb preventDefault; el cercador natiu del navegador no s'obre). |
| Segment amb tokens no canònics i ressaltat | El segment no es pinta (guard de longitud visible↔DOM); cerca, comptador, navegació i substitució hi funcionen igualment. |
| Ctrl+F amb selecció de text al bloc | Prefil·la el terme (una línia). |
| Esc dins del contentEditable d'un bloc | No tanca la barra (Esc només es tracta dins de la barra) — no s'interfereix amb cap comportament existent. |
| Enter al camp de cerca sense coincidències | No-op. |
| Navegació ▼ des de l'última coincidència | Wrap a la primera (i ▲ des de la primera → última). |
| Canvi d'opcions Aa/paraula amb terme actiu | Recàlcul immediat; activa re-ancorada per posició. |
| Document buit (0 segments) | Barra operativa, «Sense resultats». |
| Virtualització: coincidència activa fora del viewport | `scrollToIndex` la porta al centre; el ressaltat es pinta quan la fila es munta (efecte depèn de `virtualItems`). |
| Navegador sense CSS Highlight API | Scroll + fons de fila del bloc actiu (pot quedar tapat pel fons propi del bloc — actiu/diff/correccions — acceptat); funcionalitat completa altrament. |
| Les dues vistes alhora | No passa: són rutes exclusives; i encara que coexistissin, cada instància té el seu estat (només col·lidirien els noms d'highlight — irrellevant a la pràctica). |
| CPS/comptadors de caràcters | Sense canvi: la substitució passa pel mateix camí que qualsevol edició de text. |
| Autosave | Es dispara sol amb el commit (efectes existents sobre `historyState.present`). |

\* Detall d'implementació de `toVisibleText`: el regex `/<[^>]*>/g` només consumeix seqüències tancades; un `<` solt és text visible. Coherent amb `stripSrtTags`.

---

## 10. Verificació

1. **Tipus**: `npx tsc --noEmit` net al frontend.
2. **Build**: `npm run build` (Vite) net.
3. **Lògica pura**: script de verificació (scratchpad, fora del repo — el projecte no té infraestructura de tests) que executa `toVisibleText`/`findMatchesInText`/`findMatches`/`replaceVisibleRange` contra la taula de casos de §9 (mínims: case folding, paraula completa amb accents, solapaments, herència de format als 4 casos de §7.3, dreta→esquerra multi-coincidència, tokens opacs).
4. **Manual (si hi ha entorn)**: Ctrl+F, cercar terme amb 2+ coincidències en blocs distants, ▼▼ (scroll + ressaltat actiu), Substituir (1 pas d'undo), Substituir-ho tot (1 pas d'undo, missatge N), cas `buenos <i>días</i>` → "hola", mode lectura (sense fila 2).

---

## 11. No cal canviar

- `VideoSubtitlesEditorView.tsx` / `VideoSrtStandaloneEditorView.tsx` — `onSegmentsBatchChange` ja cablejat a les dues (batch de format, 2026-07-01).
- `SegmentItem.tsx` — la re-sincronització de contentEditable en canvis externs ja existeix; el ressaltat no el toca.
- `richTextHelpers.ts` / `formatTags.ts` / `textMetrics.ts` — el mòdul nou és independent però segueix els seus criteris (tags canònics, `<...>` invisible).
- `srtParser.ts` — el text substituït viatja per `originalText` + `richText: ''` com qualsevol edició.
- `useDocumentHistory.ts` — `commit(next)` ja fa el pas d'undo únic.
- Backend — cap canvi.
