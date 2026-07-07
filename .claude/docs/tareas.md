# Tareas del proyecto

Este archivo es la **fuente única de verdad sobre el futuro del proyecto**.
Las tareas NO se borran al completarse: se MUEVEN de PENDIENTE a TERMINADO.
Las fechas son SIEMPRE absolutas (YYYY-MM-DD), nunca relativas.

---

## 🟡 PENDIENTE

> Ordenado por recomendación de ataque: de más rápido/desbloqueante a más grande.

## 1. Mode Duo + estacionari: model de ratolí alternatiu *(2026-07-07)*

**Síntoma / Contexto:** El nou model de ratolí de l'editor de subtítols (clic = seek sense recentrar · doble clic = seleccionar · arrossegar = moure/redimensionar · modificador+clic = fixar cues) depèn del **page-follow**. En mode **ESTACIONARI** (que recentra la vista a cada seek) el clic i el doble-clic no funcionen igual perquè la vista fuig.
**Plan:** Decidir/implementar el comportament de ratolí per a estacionari — probablement estil **Ctrl+clic per editar** (l'esquema original de l'usuari) — o assumir que estacionari és un mode "llegat" amb interacció limitada. De moment, el mode **Duo/estacionari** queda amb el comportament ACTUAL; per defecte el programa arrenca en mode **Pàgina** (nou), on tot el nou esquema funciona.
**Archivos afectados:** editor de subtítols (visualitzador d'ona) — mode de scroll (page vs estacionari) i handlers de ratolí.
**Riesgo:** medio
**Tamaño:** medio

## 2. Presets d'interacció de ratolí page vs duo *(2026-07-07)*

**Síntoma / Contexto:** Potser cal separar explícitament els presets d'interacció de ratolí per mode (page vs duo) en comptes de derivar-los del mode de scroll actiu.
**Plan:** Avaluar si val la pena un preset explícit per mode o mantenir la derivació actual.
**Riesgo:** bajo
**Tamaño:** pequeño

## 3. Split: respectar la durada mínima configurable *(2026-07-07)*

**Síntoma / Contexto:** El split (per cursor o lògic) reparteix la durada proporcionalment al text, però no comprova `minDurationMs`: dividir un bloc curt pot crear dos blocs per sota de la durada mínima configurada (T1 va cobrir els 6 punts d'enforcement existents; el split va quedar fora). Tampoc aplica `minGapMs` entre les dues meitats (gap fix de 0.001 s).
**Plan:** Decidir si el split ha de bloquejar-se quan cap meitat pot arribar a la durada mínima, o només avisar (Subtitle Edit permet el split i marca l'error de validació). Si s'aplica, fer-ho als dos handlers `handleSplitSegmentAtCursor` (vista principal i standalone).
**Archivos afectados:** `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx`, `VideoSrtStandaloneEditorView.tsx`.
**Riesgo:** bajo
**Tamaño:** pequeño

## 4. SrtPreviewView: renderitzar tags SRT en comptes de mostrar-los literals *(2026-07-07)*

**Síntoma / Contexto:** La vista prèvia de fitxers SRT de la biblioteca (`SrtPreviewView.tsx`) mostra el text cru: un bloc en cursiva es veu com a `<i>Hola</i>` literal. Preexistent, però ara més visible perquè el format en lot farà més habituals els tags. L'overlay del vídeo ja ho fa bé (`VideoPlayer.tsx` usa `plainToRich` + `dangerouslySetInnerHTML`, que escapa tot excepte i/b/u).
**Plan:** Renderitzar les línies amb el mateix patró `plainToRich` + `dangerouslySetInnerHTML` (segur: escapa qualsevol altre HTML).
**Archivos afectados:** `frontend/components/VideoSubtitlesEditor/SrtPreviewView.tsx`.
**Riesgo:** bajo
**Tamaño:** pequeño

## 5. Polits menors del review final de selecció múltiple *(2026-07-07)*

**Síntoma / Contexto:** La revisió final de la feature de selecció múltiple va deixar 4 polits triats com a "LEAVE" (cap bloqueja res): (a) typo al comentari de `handleToggleSelect` ("corra"→"corre", SubtitlesEditor.tsx); (b) el canal del checkbox de 22px té zona morta — només el botó de 14px fa toggle; es podria reenviar el clic del canal al toggle per ampliar la diana; (c) `useState<Set<number>>(new Set())` alloca un Set per render — lazy init `useState(() => new Set<number>())`; (d) `onSegmentsBatchChange` declarat al final de la interfaz en lloc de després d'`onDelete`.
**Plan:** Agrupar-los en el proper retoc de `SubtitlesEditor.tsx`/`SegmentItem.tsx`; no obrir una tasca dedicada només per això.
**Riesgo:** bajo
**Tamaño:** pequeño

## 6. Sincronitzar `project.mediaDocumentId` en vincular media (coherència del registre) *(2026-07-07)*

**Síntoma / Contexto:** El fix de T5 (persistència del vídeo del projecte) llegeix l'últim vídeo des de `linkedMediaId` de l'SRT, però el `project.mediaDocumentId` del backend queda obsolet: continua apuntant al vídeo de la creació. No afecta l'obertura del projecte (ja no és la font primària), però qualsevol llistat/report/lògica futura que llegeixi `mediaDocumentId` veurà el vídeo antic.
**Plan:** En `api.linkMediaToSrt` (o al backend en rebre el PATCH de `linkedMediaId`), actualitzar també el `mediaDocumentId` del projecte associat a aquest SRT. Toca `backend_nest_mvp/src/modules/projects/` → consultar `.claude/docs/domains/projectes.md` abans. Opcional; no bloqueja res.
**Archivos afectados:** `backend_nest_mvp/src/modules/projects/` (service + potser controller), possiblement `frontend/services/api.ts`.
**Riesgo:** bajo
**Tamaño:** pequeño

## 7. Cerca i substitució a l'editor de guions (columnes original/traducció) *(2026-07-07)*

**Síntoma / Contexto:** La cerca/substitució tipus Word (T6) es va implementar només a l'editor de subtítols — decisió d'abast validada amb l'usuari. L'editor de guions (`EditorDeGuions`, dues columnes) no en té; l'usuari va assenyalar que allà caldria poder cercar tant a la columna original com a la traduïda (o a totes dues).
**Plan:** Reutilitzar el mòdul pur `frontend/utils/SubtitlesEditor/searchReplace.ts` (`findMatches`/`replaceVisibleRange` són agnòstics del component); dissenyar a part la UI i el selector de columna (original / traducció / ambdues).
**Archivos afectados:** `frontend/components/EditorDeGuions/`.
**Riesgo:** medio
**Tamaño:** medio

## 8. Instal·lar `@types/react` (+ `@types/react-dom`) al frontend *(2026-07-07)*

**Síntoma / Contexto:** El frontend no té `@types/react` enlloc: `npx tsc --noEmit` passa, però tot `React.*` es resol com a *any* silenciós i el typecheck valida molt menys del que sembla. Va aflorar dues vegades durant T6 (error TS2347 en un genèric de `querySelectorAll` derivat de la cadena d'*any*; els revisors ho van marcar com a baseline feble del repo).
**Plan:** `npm install --save-dev @types/react @types/react-dom` (dependència nova → requereix aprovació expressa de l'usuari) i arreglar els errors de tipus latents que aflorin.
**Riesgo:** bajo (només dev-time)
**Tamaño:** pequeño-medio (poden aflorar errors latents en cadena)

## 9. Polits menors del review final de cerca/substitució *(2026-07-07)*

**Síntoma / Contexto:** La revisió final de T6 va deixar 2 polits triats "LEAVE" (cap bloqueja res): (a) amb el focus als inputs de la barra de cerca, Ctrl+Z fa l'undo natiu de l'input, no el del document — conseqüència del `stopPropagation` total (decisió documentada al codi per la tecla Supr); Word/VSCode enruten l'undo al document; es podria delegar amb un prop `onUndo`; (b) si TOTES les substitucions d'un «Substituir-ho tot» són byte-idèntiques, el commit fa *bail* però el missatge diu igualment «S'han fet N substitucions» (cosmètic).
**Plan:** Agrupar-los en el proper retoc de `SearchReplaceBar.tsx`/`SubtitlesEditor.tsx`; no obrir tasca dedicada.
**Riesgo:** bajo
**Tamaño:** pequeño

### Tareas manuales del usuario

<!-- Cosas que requieren acción humana fuera del código -->

- *(2026-07-07)* Verificar en navegador la cerca/substitució de T6 (les dues vistes de l'editor de subtítols): (a) lupa i Ctrl+F obren la barra; Esc/✕ tanquen i el focus torna a l'editor; (b) cerca en viu amb comptador «N de M», ▲/▼ amb scroll i ressaltat groc/taronja; (c) opcions Aa i paraula completa (provar accents: «càmera»); (d) Substituir → 1 pas d'undo i salta a la següent; (e) Substituir-ho tot → 1 sol pas d'undo + missatge «S'han fet N substitucions»; (f) cas amb format: `buenos <i>días</i>` + substituir "buenos días"→"hola" → `hola` sense tags residuals; (g) mode lectura: cerca funciona, fila de substituir absent.
- *(2026-07-07)* Decidir si commitejar la feature de cerca/substitució (5 fitxers al working tree: `searchReplace.ts` i `SearchReplaceBar.tsx` nous; `SubtitlesEditor.tsx`, `constants.ts`, `index.html` modificats; sense commitejar per la regla del CLAUDE.md).
- *(2026-07-07)* Verificar en navegador el cicle de T5: crear/obrir un projecte, canviar el vídeo (importar-ne un altre), guardar, tancar i reobrir → ha de reaparèixer l'ÚLTIM vídeo vinculat, no l'original de la creació. Provar també amb la pestanya de l'editor de vídeo i amb l'standalone SRT.
- *(2026-07-07)* Decidir si commitejar el fix de T5 (`frontend/App.tsx`; sense commitejar per la regla del CLAUDE.md).
- *(2026-07-07)* Verificar en navegador el nou split de l'editor de subtítols: (a) cursor a mitja línia 2 + botó S → ha de tallar exactament al cursor; (b) botó S sense cursor al text en un bloc de 2 línies → ha de separar línia 1 / línia 2; (c) Ctrl+K amb el focus fora del text → tall pel salt de línia o espai més proper al centre del segment actiu.
- *(2026-07-07)* Verificar en navegador la selecció múltiple + format en lot (les dues vistes): (a) clic al checkbox del bloc N + Maj+clic al bloc M → tots els intermedis seleccionats, inclosos N i M; (b) amb "hola <i>com</i> estas" seleccionat, botó I → `<i>hola com estas</i>` (normalitzat, sense niats) i les negretes intactes; (c) segona I amb tot en cursiva → la treu; (d) un sol Ctrl+Z reverteix tot el lot i la selecció es manté; (e) split/merge/delete buiden la selecció.
- *(2026-07-07)* Decidir si commitejar la feature de selecció múltiple (5 fitxers al working tree, sense commitejar per la regla del CLAUDE.md; Claude pot fer els commits per tasques si es demana).
- *(2026-07-07)* Verificar en navegador l'inserció de subtítol al cursor (les dues vistes): (a) drecera Inserir amb el playhead en un buit ampli → bloc de 1000ms exactament al cursor; (b) playhead a menys de 1000ms del següent subtítol → l'inici es desplaça enrere per mantenir 1000ms sense trepitjar; (c) buit lliure < 1000ms → bloc més curt, sense solapar (salta l'alerta de durada mínima); (d) botó "+després" en un bloc enganxat al següent → ja no el trepitja; (e) "+abans" segueix igual.
- *(2026-07-07)* Decidir si commitejar la reparació insert-at-cursor / "+després" (2 fitxers: `VideoSubtitlesEditorView.tsx`, `VideoSrtStandaloneEditorView.tsx`; sense commitejar per la regla del CLAUDE.md).

### Informacionales (no tocar)

<!-- Decisiones tomadas de NO hacer algo, documentadas para que no se reabran sin contexto -->

## Residu acceptat — selecció múltiple sobreviu al sync d'SRT amb la mateixa longitud *(2026-07-07)*

- Vincular un SRT nou sobre el mateix document (drag&drop o modal Vincular; també a l'standalone) substitueix tot l'array via `commit(parseSrt(...))` sense remount. La selecció múltiple es buida quan canvia `segments.length`; si el fitxer nou té **exactament el mateix nombre de blocs**, la selecció sobreviu apuntant al contingut nou.
- **Decisió: no cobrir-ho.** Conseqüència acotada (els checkboxes queden visiblement marcats i el lot s'aplicaria a allò marcat); cobrir-ho exigiria un `docKey`/invalidació extra que no compensa. Detall a la spec local `docs/superpowers/specs/2026-07-01-multi-select-batch-format-design.md` §4.4.

## Notes de disseny — dreceres vs ratolí *(2026-07-07)*

- Les **dreceres de teclat** (nudges Alt/Alt+Shift+fletxes, F9–F12, Ctrl+fletxes, Ctrl+Shift+M, Ctrl+Alt+V, etc.) són **independents del mode de scroll** → un sol joc, vàlid a pàgina i estacionari. No cal preset per mode per al teclat.
- El que és dependent del mode és **només el ratolí**.
- Documents relacionats: `Shortcuts Subtitols - Consolidat.csv`.

---

## ✅ TERMINADO

> Histórico de tareas cerradas. Más reciente arriba.

## T6. Cerca i substitució tipus Word a l'editor de subtítols *(tancada 2026-07-07)*

**Qué cambió al cerrarla:** Barra de cerca desplegable a la capçalera de l'editor de subtítols (botó lupa + Ctrl+F, drecera configurable `sub_find`), funcional a les dues vistes perquè viu al component compartit `SubtitlesEditor`. Cerca literal en viu (debounce 150ms) sobre el text visible (ignora tags `<b>/<i>/<u>` i qualsevol `<...>`, normalitza U+00A0), opcions **Aa** i **paraula completa** (límits Unicode, accents inclosos), comptador «N de M», navegació ▲/▼ amb wrap i scroll per intenció, ressaltat de coincidències via **CSS Custom Highlight API** (groc + activa taronja, sense mutar el contentEditable; fallback de fons de fila si l'API no hi és). **Substituir** (un a un, salta a la següent) i **Substituir-ho tot** (batch únic = 1 sol pas d'undo, missatge «S'han fet N substitucions»); les coincidències que travessen un canvi de format hereten el format del 1r caràcter (criteri Word). 2 fitxers nous (`utils/SubtitlesEditor/searchReplace.ts` — lògica pura amb model de caràcters i pila de tags — i `components/VideoSubtitlesEditor/SearchReplaceBar.tsx`) + 3 modificats (`SubtitlesEditor.tsx`, `constants.ts`, `index.html`); vistes intactes (reutilitza `onSegmentsBatchChange` del format en lot). Dissenyat amb ralph-loop (7 iteracions adversarials: 9 BUG + 19 MINOR corregits al disseny abans de codificar) i executat amb subagents; revisió final «READY TO HAND OFF: YES», 40/40 casos de lògica pura, tsc + build nets. **Pendent de verificació en navegador i de commit.** Detall a history.md (2026-07-07).

## T5. En reobrir un projecte es carregava el vídeo original, no l'últim vinculat *(tancada 2026-07-07)*

**Qué cambió al cerrarla:** Bug de persistència del vídeo del projecte. En canviar de vídeo, el nou asset es guardava bé a `linkedMediaId` del document SRT (via `api.linkMediaToSrt`), però els dos efectes de sync de media d'`App.tsx` llegien sempre el `mediaDocumentId` del registre del projecte —que només s'estableix a la creació i mai s'actualitza— i disparaven `TRIGGER_SYNC_REQUEST` amb el vídeo original. Fix mínim al costat de lectura, simètric als dos efectes: `const linkedId = (doc as any).linkedMediaId; const mediaId = linkedId || proj?.mediaDocumentId || proj?.mediaDocId;` (prioritza l'últim vídeo vinculat, `mediaDocumentId` només com a fallback). Sense tocar backend ni el flux de guardat. `tsc --noEmit` net. **Pendent de verificació en navegador i de commit.** Detall a history.md (2026-07-07).

## T4. Inserir subtítol al cursor (playhead) + reparació del botó "+després" *(tancada 2026-07-07)*

**Qué cambió al cerrarla:** La drecera "Inserir subtítol" (INSERT_SUBTITLE) inseria sempre DESPRÉS del segment actiu/últim (`target.endTime + 0.1`, durada fixa ~2s). Ara crea el bloc EXACTAMENT al playhead amb durada per defecte = durada mínima configurada (`minDurationMs ?? 1000` ms, pis `MIN_SEG_DURATION_MS`). Si el cursor és massa a prop del següent subtítol, desplaça l'inici cap enrere per conservar la durada mínima respectant `minGapMs`; si ni així hi cap, escurça la durada (mai solapa — l'alerta de durada mínima ja ho marca). Nou handler `handleInsertSegmentAtCursor` a les dues vistes (llegeix el temps directament de `<video>` per precisió, com `handleSetTcIn`; posició d'inserció calculada per temps amb `startTime > start`). A més, reparat el botó "+després" de cada bloc: `Math.max(end, start + 0.5)` forçava un pis de durada que **trepitjava el següent subtítol**; ara respecta `next.startTime - minGapMs` (com ja feia "+abans" amb l'anterior) i escurça abans que solapar. "+abans" intacte. tsc net; **pendent de verificació en navegador i de commit**. Detall a history.md (2026-07-07).

## T3. Selecció múltiple de blocs + format B/I/U en lot no destructiu *(tancada 2026-07-07)*

**Qué cambió al cerrarla:** Checkbox a l'esquerra de tot de cada bloc (mode edició; canal flex nou, grid intacte), clic = toggle i Maj+clic = rang inclusiu per índex d'array (78 → Maj+104 = 78..104, unió), chip "N sel. ✕" a la capçalera. Els botons B/I/U existents, amb selecció activa, apliquen el tag en lot amb semàntica "make consistent" i normalització no destructiva: `stripTag` del tag manipulat + `wrapTagPerLine` (mai niats, mai `<i></i>`, `<b>`/`<u>` intactes en tocar `<i>`); tots-taggejats → treure. Un lot = un pas d'undo (`subsHistory.commit`) amb `richText: ''`. Selecció invalidada quan canvia la longitud (les ops estructurals renumeren ids). Nou mòdul pur `utils/SubtitlesEditor/formatTags.ts` (35 casos verificats), + `SegmentItem.tsx`, `SubtitlesEditor.tsx` i les dues vistes. Dissenyat amb ralph-loop (4 iteracions: 1 major — updater impur sota StrictMode — + 13 minors corregits abans de codificar) i executat amb subagents; revisió final "Ready to hand off: Yes", tsc + build nets. **Pendent de commit** (regla CLAUDE.md). Detall a history.md (2026-07-07).

## T2. Split lògic a l'editor de subtítols (cursor + fallback per línia/paraula) *(tancada 2026-07-07)*

**Qué cambió al cerrarla:** El split tenia 3 disparadors i només Ctrl+K amb focus dins del text usava el cursor; el botó S i la drecera global tallaven a cegues pel punt mig en caràcters (`Math.floor(txt.length / 2)`), partint paraules i la segona línia per qualsevol lloc. Ara: botó S divideix pel cursor si el caret és dins l'editor del segment (mousedown amb `preventDefault` per no perdre la selecció); sense cursor, tall lògic pel salt de línia més proper al centre (2 línies → línia 1 / línia 2) o per l'espai més proper al centre (mai a mitja paraula), amb durada proporcional al text i reequilibri de tags SRT (`<i>` no queda mai obert entre blocs). Afegit el fallback que faltava a la vista standalone (botó S mort) i higiene del `splitPayloadRef` (es consumeix sempre; un payload obsolet s'aplicaria a un segment equivocat perquè els ids es renumeren a cada commit). Nou helper pur `utils/SubtitlesEditor/splitHelpers.ts` (`computeSmartSplit`), verificat amb 10 casos + `tsc --noEmit` net. Detall a history.md (2026-07-07).

## T1. Durada mínima configurable per bloc de subtítol *(tancada 2026-07-07)*

**Qué cambió al cerrarla:** Nova clau `EDITOR_MIN_DURATION_MS` (`snlbpro_editor_min_duration_ms`, default 1000 ms), camp `minDurationMs?: number` a `GeneralConfig`, control "Durada mínima de subtítol" a SettingsModal. Enforcement als 6 punts existents: `handleSetTcIn`, `handleSetTcOut`, `handleSegmentChange` (VideoSubtitlesEditorView), `handleSegmentChange` (VideoSrtStandaloneEditorView), drag `resize-start`/`resize-end` (WaveformTimeline). Corregit bug de `0.1` hardcoded a VideoSrtStandaloneEditorView. `KEYS_TO_REMOVE` de factoryReset.ts actualitzat. 7 fitxers modificats, build net.

<!-- Ejemplo:
## N. Título *(cerrada 2026-05-25)*

**Qué cambió al cerrarla:** ...
-->
