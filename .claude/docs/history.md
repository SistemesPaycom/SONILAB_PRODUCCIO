# Historia del proyecto

Memoria larga del proyecto. NO es un diario de commits (git ya hace eso).
Solo se anota lo que merece la pena recordar para entender el "porqué" del estado actual.

Categorías que SÍ van aquí:
1. Bugs gordos resueltos (sobre todo si la causa raíz fue rara o contraintuitiva)
2. Decisiones arquitectónicas grandes
3. Hitos del proyecto (features grandes, integraciones, sub-proyectos cerrados)
4. Incidencias (cosas que se rompieron y cómo se reaccionó)

Orden: cronológico inverso (más reciente arriba).
Fechas: absolutas, en el encabezado de cada entrada.

---

<!-- Plantilla canónica de entrada:

## YYYY-MM-DD — Título corto

**Tipo:** bug resuelto | decisión arquitectónica | hito | incidencia

**Síntoma / Contexto:**
Qué pasaba, por qué era un problema, en qué situación apareció.

**Lo que NO funcionó:**
- Intento A — por qué falló
- Intento B — por qué falló
(Esta sección es la más valiosa: evita que alguien repita el mismo callejón sin salida.)

**Solución:**
Qué se hizo finalmente. Snippets, archivos tocados, valores concretos.

**Archivos tocados:**
- `ruta/al/archivo.ts`
- ...

**Lección:**
La regla generalizable que se aprende, redactada para que sirva en problemas futuros similares.

**Follow-ups (movidos a tareas.md):**
- ...

-->

## 2026-07-07 — Hito: Cerca i substitució tipus Word a l'editor de subtítols

**Tipo:** hito + decisión arquitectónica

**Síntoma / Contexto:**
L'editor de subtítols no tenia manera de localitzar un terme ni de substituir-lo (corregir un nom mal transcrit en centenars de blocs = repàs visual un a un). Petició de l'usuari: buscador tipus Microsoft Word a la part superior — cerca de termes exactes amb opcions, substituir d'un en un o tot de cop. Decisió d'abast validada: NOMÉS l'editor de subtítols; l'editor de guions (dues columnes original/traducció) queda per a una tasca futura (→ tareas.md #7). Aclariment funcional important: en aquest editor cada subtítol té UN sol text visible (el camp `translatedText` del tipus `Segment` és llegat i no es mostra) — la confusió inicial de l'usuari venia del nom intern `originalText`.

**Lo que NO funcionó:**
- **Scroll v1 — efecte amb dependència de l'array `matches`:** `matches` és un `useMemo` sobre `segments`, i el draft d'edició arriba VIU per props → l'array és NOU a cada pulsació dins de qualsevol contentEditable. Amb la barra oberta, teclejar en qualsevol bloc re-disparava el `scrollToIndex` i arrossegava el viewport cap a la coincidència activa a cada tecla.
- **Scroll v2 — dependències derivades de la POSICIÓ de l'activa** (`activeMatchSeg`/`activeMatchStart`): seguia disparant quan una edició desplaçava l'índex o el `start` de l'activa; una simulació fidel a React (efectes post-commit en ordre de declaració, deps per `Object.is`) va demostrar a més un doble scroll amb un frame d'índex caducat en afegir una ocurrència en un bloc anterior a l'activa.
- **Scroll v3 (definitiu) encara amb un forat:** scroll per INTENCIÓ (`pendingScrollRef` marcat per terme/opcions nous i per Substituir; scroll imperatiu a `gotoMatch`). Però substituir per text idèntic deixava el flag ORFE: `commitHistory` fa *bail* per igualtat profunda (`JSON.stringify(present) === JSON.stringify(next)`) → cap re-render consumia el flag → la següent edició en qualsevol bloc scrollejava. Fix: guard `newRaw === originalText` que no toca flags i salta a la següent com Word.
- **Assumir que els inputs de la barra quedaven aïllats dels atajos:** la combo `Delete` (`sub_delete`) està registrada a `DEFAULT_SHORTCUTS` i `useKeyboardShortcuts` fa `e.preventDefault()` en trobar QUALSEVOL combo encara que cap vista tracti l'acció (i el guard d'inputs només salta tecles d'1 caràcter: 'Delete'.length === 6) → sense `stopPropagation` de TOTES les tecles, la tecla Supr no esborraria text als inputs. I amb `stopPropagation`, Ctrl+F dins dels inputs ja no arriba al listener global → cal tractar-lo localment o el navegador obre el SEU cercador natiu.
- **Assumir correspondència exacta text visible ↔ DOM:** falsa amb tokens no canònics (`<font …>`): `plainToRich` els mostra com a TEXT LITERAL però `toVisibleText` els elimina → el ressaltat es pintaria desplaçat. Fix: guard `domVisibleLength(editable) !== toVisibleText(text).length` → el segment no es pinta (cerca/comptador/substitució segueixen funcionant).
- **NBSP crus invisibles als documents de disseny:** el codi del pla contenia U+00A0 literals que semblaven espais normals — un retipeig els perdria en silenci. Norma adoptada: als strings de codi sempre escapes ` ` explícits; el caràcter cru només a la prosa.

**Solución:**
Mòdul pur `searchReplace.ts` (model de caràcters visibles amb pila de tags canònics: `toVisibleText`, `findMatchesInText` — literal, case-fold per caràcter que preserva longituds UTF-16, paraula completa amb `\p{L}\p{N}` —, `findMatches`, `replaceVisibleRange` — el text inserit hereta la pila del 1r caràcter substituït, re-serialització balancejada per línia, mai parells buits). UI en `SearchReplaceBar.tsx` (component controlat) integrada a `SubtitlesEditorInner` (estat, matches memoitzats, re-ancoratge per posició, ressaltat amb CSS Custom Highlight API sobre les files virtualitzades, scroll per intenció). Substitucions via `onSegmentsBatchChange` existent → 1 pas d'undo per operació i `richText: ''` garantit per les vistes. Drecera `FIND`/Ctrl+F afegida als defaults (mergeShortcuts la propaga a usuaris amb prefs de backend). Procés: spec + pla amb tot el codi → **ralph-loop de 7 iteracions de revisió adversarial** (subagents executant la lògica de veritat amb node/esbuild i simulant React; sortida per 2 iteracions consecutives amb 0 BUG) → execució amb subagents (implementador + revisor per task + revisió final holística: READY TO HAND OFF YES, 0 critical/important).

**Archivos tocados:**
- `frontend/utils/SubtitlesEditor/searchReplace.ts` (nou)
- `frontend/components/VideoSubtitlesEditor/SearchReplaceBar.tsx` (nou)
- `frontend/components/VideoSubtitlesEditor/SubtitlesEditor.tsx`
- `frontend/constants.ts` (drecera `sub_find`)
- `frontend/index.html` (regles `::highlight()`)
- Docs: `docs/superpowers/specs/2026-07-02-search-replace-subtitles-design.md`, `docs/superpowers/plans/2026-07-02-search-replace-subtitles.md`, `docs/superpowers/plans/2026-07-02-search-replace-review-log.md`

**Lección:**
1. Un efecte que depèn d'un valor recalculat a cada render (arrays derivats d'estat viu) es dispara a cada pulsació: per a reaccions a ACCIONS de l'usuari (scroll, focus), modela la intenció explícitament (flag consumible o crida imperativa al handler), mai la derivis de la identitat de les dades. El mateix bug de scroll va necessitar 3 intents — les dues primeres "correccions" només movien el problema de lloc.
2. Un `setState` que no canvia res (bail per igualtat) NO produeix re-render: qualsevol protocol de "flag que consumirà el següent render" ha de cobrir el camí en què el render mai arriba.
3. Amb un sistema d'atajos globals que fa `preventDefault` per combos registrades, un input de text nou dins d'aquella superfície necessita `stopPropagation` de TOTES les tecles (no només les que tracta) i re-implementar localment les combos que sí vol (Ctrl+F).
4. La revisió adversarial iterativa del DISSENY (executant la lògica real i simulant la semàntica de React abans de codificar) va caçar 9 bugs i va deixar la implementació en transcripció verificada: cap bug nou va aparèixer en execució.

**Follow-ups (movidos a tareas.md):**
- Cerca/substitució a l'editor de guions amb selector de columna (#7).
- Instal·lar `@types/react` — el typecheck actual valida menys del que sembla (#8).
- 2 polits LEAVE del review final: Ctrl+Z natiu als inputs de la barra; missatge N en no-op total (#9).
- Verificació manual en navegador + decisió de commit (tareas manuales).

---

## 2026-07-07 — Bug: en reobrir un projecte tornava al vídeo original, no a l'últim vinculat

**Tipo:** bug resuelto

**Síntoma / Contexto:**
Flux de l'usuari: crear un projecte amb el vídeo A (versió catalana), transcriure, importar/canviar al vídeo B (original en anglès) a l'editor, guardar i tancar. L'endemà, reobrir el projecte tornava a carregar el vídeo A (l'original de la creació) en lloc de l'últim seleccionat (B). La causa era un desajust entre **on es guarda el canvi de vídeo** i **on es llegeix en reobrir**:
- **Guardar (correcte):** en canviar de vídeo, `handleSyncMedia` de `VideoSubtitlesEditorView` crida `api.linkMediaToSrt(currentDoc.id, doc.id)` → `PATCH /documents/{srt}` amb `{ linkedMediaId }`. El nou vídeo es persisteix al camp `linkedMediaId` del document SRT. ✅
- **Llegir (bug):** en obrir/reobrir, els dos efectes de sync de `App.tsx` llegien el vídeo del camp `mediaDocumentId` del **registre del projecte**, que només s'estableix a la CREACIÓ del projecte i **mai s'actualitza** en canviar de vídeo. Sempre disparaven `TRIGGER_SYNC_REQUEST` amb el vídeo original. ❌

**Lo que NO funcionó:**
- **Confiar en l'auto-load intern de l'editor** (`VideoSubtitlesEditorView`/`VideoSrtStandaloneEditorView` ja llegien `linkedMediaId` correctament, useEffect amb `autoLoadAttemptedRef`): arriba massa tard. L'efecte d'`App.tsx` ja ha disparat el `TRIGGER_SYNC_REQUEST` amb el vídeo dolent abans que l'editor munti, i l'auto-load intern només torna a disparar-se quan canvia `state.documents`. En reobrir el projecte, el codi dolent d'`App.tsx` s'executava de nou i reimposava l'original.
- **Actualitzar `project.mediaDocumentId` al backend en vincular media** (fer que el registre del projecte reflectís el vídeo actual): descartat com a fix PRIMARI. Té més blast radius (toca `backend_nest_mvp/src/modules/projects/` i creuar la frontera cap al mòdul Projectes), quan el problema real és de **lectura** al frontend. `linkedMediaId` de l'SRT ja és la font de veritat de l'últim vídeo; només calia llegir-la. Queda com a follow-up opcional (coherència del registre, no bloqueja).

**Solución:**
Fix mínim al costat de LECTURA, simètric als dos efectes de sync d'`App.tsx` (obertura de pestanya principal i pestanya de l'editor de vídeo): prioritzar el `linkedMediaId` del document SRT (l'últim vídeo seleccionat) i usar el `mediaDocumentId` del projecte només com a fallback.
```ts
const linkedId = (doc as any).linkedMediaId as string | null | undefined;
const mediaId = linkedId || proj?.mediaDocumentId || proj?.mediaDocId;
```
`doc` ja estava disponible dins de tots dos efectes (es busca a `state.documents` per l'`openDocId`/`docId`). Sense tocar backend ni el flux de guardat (que ja funcionava). `tsc --noEmit` net (exit 0).

**Archivos tocados:**
- `frontend/App.tsx` — dos punts de sync de media (obertura de pestanya i editor de vídeo): `linkedMediaId` prioritzat sobre `mediaDocumentId`.

**Lección:**
Quan un valor es pot escriure en dos llocs (aquí: `linkedMediaId` de l'SRT vs `mediaDocumentId` del projecte), el camí de lectura ha de coincidir amb el d'escriptura o l'estat "reviu" el valor obsolet. El `mediaDocumentId` del projecte és un snapshot de la creació, no la font de veritat de l'últim vídeo — aquesta és `linkedMediaId`. I un "auto-load correcte" dins d'un component fill no arregla una lectura dolenta feta abans (a `App.tsx`) que s'executa cada cop que s'obre la pestanya: cal arreglar-ho al punt més amunt on es dispara la càrrega inicial.

**Follow-ups (movidos a tareas.md):**
- Sincronitzar `project.mediaDocumentId` al backend en vincular media (opcional, coherència del registre).
- Verificació manual en navegador del cicle canviar vídeo → guardar → reobrir.
- Decisió de commit d'`App.tsx`.

---

## 2026-07-07 — Bug + decisió: inserir subtítol al cursor i "+després" trepitjava el veí

**Tipo:** bug resuelto + decisión funcional

**Síntoma / Contexto:**
Dos problemes a l'inserció de subtítols de l'editor (dues vistes, amb `handleInsertSegment` idèntic):
1. La drecera "Inserir subtítol" (INSERT_SUBTITLE) no col·locava el bloc on era el cursor (playhead): l'inseria després del segment actiu/últim amb `target.endTime + 0.1` i durada fixa ~2s.
2. El botó "+després" de cada bloc respectava la separació amb el segment d'ancoratge però **trepitjava el següent per defecte**: `end = Math.min(next.startTime - 0.1, start + 2)` quedava anul·lat per `Math.max(end, start + 0.5)`, que forçava un pis de 0.5s de durada encara que solapés el veí. ("+abans" sí ho feia bé.)

**Lo que NO funcionó:**
- **Resposta de disseny contradictòria de l'usuari per al cas de col·lisió.** A la pregunta tancada va triar "mantenir 1000ms encara que solapi", però en text lliure va aclarir el contrari: "si és menys, que sigui menys perquè no trepitgi els altres" (ja hi ha alerta per als blocs per sota de la durada mínima). Reconciliació: la prioritat REAL és **no solapar mai** > mantenir 1000ms (desplaçant l'inici enrere) > com a últim recurs, escurçar la durada. El text lliure amb el "perquè" preval sobre l'opció tancada.
- El pis `Math.max(end, start + 0.5)` del codi original era la causa exacta del solapament: aplicar una "durada mínima" DESPRÉS de clampar contra el veí torna a obrir el solapament. L'ordre correcte és clampar contra el veí AL FINAL.

**Solución:**
- Nou `handleInsertSegmentAtCursor` (dues vistes): llegeix `videoRef.current.currentTime` (precisió, com `handleSetTcIn`), calcula el buit lliure al voltant del cursor (`lowerBound`/`upperBound` recorrent tots els segments amb `minGapMs`) i col·loca `[t, t+minDur]` desplaçant per encaixar; si `freeSpace >= minDur` desplaça l'inici enrere per mantenir la durada; si `0 < freeSpace < minDur` omple el buit (durada < minDur) sense solapar; si no hi ha buit, últim recurs `[t, t+minDur]`. Inserció posicionada per temps (`findIndex(s => s.startTime > start)`). `minDur = Math.max(MIN_SEG_DURATION_MS, minDurationMs ?? 1000) / 1000`.
- "+després" reescrit: apunta a `minDur` (o fins a 2s si hi ha marge) però clampa `next.startTime - minGapMs` AL FINAL; si el buit és menor que minDur, durada més curta abans que solapar. La drecera INSERT_SUBTITLE ara crida el handler de cursor en lloc de `handleInsertSegment(id, 'after')`.
- "+abans" sense canvis (ja correcte).

**Archivos tocados:**
- `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx`
- `frontend/components/VideoSubtitlesEditor/VideoSrtStandaloneEditorView.tsx`

**Lección:**
Quan s'aplica una durada mínima i alhora s'ha d'evitar solapar un veí, l'ordre importa: clampar contra el veí ha de ser l'ÚLTIM pas, o el pis de durada reintrodueix el solapament (causa exacta d'aquest bug). I davant respostes de requisits contradictòries de l'usuari (opció tancada vs text lliure), preval el text lliure amb el "perquè"; aquí la invariant és **no trepitjar mai un altre subtítol** — la durada mínima és preferència, no obligació.

**Follow-ups (movidos a tareas.md):**
- Verificació manual en navegador de l'inserció al cursor i del "+després" (tareas manuales del usuario).
- Decisió de commit dels 2 fitxers (tareas manuales del usuario).

---

## 2026-07-07 — Hito: Selecció múltiple de blocs + format B/I/U en lot no destructiu

**Tipo:** hito + decisión arquitectónica

**Síntoma / Contexto:**
L'editor de subtítols només tenia un "segment actiu" i els botons B/I/U aplicaven format via `document.execCommand` sobre la selecció de text del contentEditable enfocat — no hi havia manera d'aplicar cursiva a 30 blocs de cop. Petició de l'usuari: checkbox a l'esquerra de tot de cada bloc, Maj+clic per rangs inclusius (78 → Maj+104 = 78..104), i toggle de cursiva en lot **normalitzador**: si "com" ja era `<i>com</i>` dins la frase, primer s'elimina la cursiva parcial i després s'embolcalla tot — mai `<i>… <i>…</i> …</i>`, i mai tocar `<b>`/`<u>` en manipular `<i>`.

**Lo que NO funcionó:**
- **Primer disseny de `handleToggleSelect`: mutar `anchorIdRef` DINS de l'updater de `setSelectedIds`.** L'app corre sota `<React.StrictMode>` (index.tsx), que en dev invoca els updaters dues vegades: la primera invocació (descartada) movia l'àncora 78→104 i la segona llegia l'àncora ja moguda → el rang Maj+clic degenerava al bloc clicat. Caçat pel ralph-loop (iteració 1) abans d'escriure codi. Regla: updaters de setState sempre PURS; lectura/escriptura de refs i càlcul de rangs fora de l'updater.
- **Aritmètica d'ids per als rangs** hauria estat un bug latent: els ids NO estan garantits 1..N seqüencials (`parseSrt` conserva la numeració del fitxer original; `handleAcceptInsertion` insereix amb `id: Date.now()`). Els rangs es calculen per **índex d'array** (`findIndex` + `slice`), mai per ids.
- **Afirmació falsa al disseny inicial**: "execCommand ja genera tags per línia en multilínia" — refutat empíricament en revisió (Chromium genera UN tag que travessa el `<br>`: `<i>l1<br>l2</i>`). No canviava la decisió (per-línia segueix sent la convenció més segura) però hauria acabat com a comentari fals al codi.

**Solución:**
- **`utils/SubtitlesEditor/formatTags.ts` (nou, funcions pures):** `stripTag` (elimina NOMÉS el tag demanat, case-insensitive), `isFullyTagged` (recorregut amb comptador de profunditat; blancs fora de regions s'ignoren, tags desequilibrats tolerats), `wrapTagPerLine` (mai `<i></i>` en línies buides), `toggleTagOnTexts` amb semàntica "make consistent": tots-taggejats → treure; mixt → strip+wrap a tots. Verificat amb script de 35 casos (esbuild+node; el projecte no té infra de tests).
- **Estat de selecció a `SubtitlesEditorInner`** (component compartit per les dues vistes → una sola implementació): `selectedIds: Set<number>` + `anchorIdRef`; invalidació automàtica quan canvia `segments.length` (les ops estructurals renumeren ids) o s'surt del mode edició. Checkbox en un canal flex NOU a l'esquerra del grid (sense tocar `--us-sub-grid-columns`); `preventDefault` al mousedown (Maj+clic no estén selecció de text) i `stopPropagation` (no activa el bloc).
- **Reutilització dels botons B/I/U:** amb selecció activa → lot (i `return` abans d'execCommand); sense → comportament clàssic intacte. Ressaltat dels botons via `batchFormatState ?? formatState`. Chip "N sel. ✕" a la capçalera.
- **Vistes:** nou `onSegmentsBatchChange` → mapa canvis per id sobre `subsHistory.present` + `richText: ''` (patró de `syncEditorsToState`; `serializeSrt` fa `richText || originalText`) + **un únic `commit`** = un pas d'undo. El refresc visual el fa el `useLayoutEffect` existent de SegmentItem.
- **Procés:** spec+plan revisats amb ralph-loop (4 iteracions, 1 major + 13 minors corregits; sortida per 3 consecutives només-minor), implementació amb subagents (implementador + revisor fresc per tasca) i revisió final de branca completa: "Ready to hand off: Yes". 35/35 lògica, `tsc` i `npm run build` nets. Spec/plan complets a `docs/superpowers/{specs,plans}/2026-07-01-multi-select-batch-format*` (carpeta ignorada per git — només local).

**Archivos tocados:**
- `frontend/utils/SubtitlesEditor/formatTags.ts` (nou)
- `frontend/components/VideoSubtitlesEditor/SegmentItem.tsx` — 3 props + canal checkbox
- `frontend/components/VideoSubtitlesEditor/SubtitlesEditor.tsx` — selecció, lot B/I/U, chip
- `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` i `VideoSrtStandaloneEditorView.tsx` — handler + prop

**Lección:**
Per a operacions de format en lot sobre text amb tags inline, el patró segur és **normalitzar-i-reaplicar per tag** (strip només del tag manipulat + wrap net), mai editar in place — impossibilita niats i tags creuats per construcció, i repara tags trencats de fitxers externs de passada. Sota StrictMode, qualsevol side-effect (refs incloses) dins d'un updater de setState és un bug intermitent només-dev dificilíssim de diagnosticar: treure'l fora sempre. I per revisar diffs sense commits (regla del repo) amb fitxers ja bruts: snapshots pre-tasca + `git diff --no-index` — a més, bona part de `frontend/components/VideoSubtitlesEditor/` està UNTRACKED, per la qual cosa `git diff` normal no mostra res d'aquests fitxers.

**Follow-ups (movidos a tareas.md):**
- SrtPreviewView mostra tags literals (tarea 4).
- Polits menors del review final (tarea 5).
- Residu acceptat del sync amb mateixa longitud (informacional).
- Verificació manual en navegador (tareas manuales del usuario).

---

## 2026-07-07 — Bug: split erràtic a l'editor de subtítols (només 1 de 3 disparadors usava el cursor)

**Tipo:** bug resuelto

**Síntoma / Contexto:**
El split de segments "feia el que volia": no tallava on hi havia el cursor i, en blocs de 2 línies, partia la segona línia per qualsevol punt enviant el tros a la línia 1 del bloc següent. La sensació d'aleatorietat venia de que el mateix gest visible prenia camins de codi diferents segons un estat invisible (el focus):

1. **Ctrl+K amb focus dins del contentEditable** → `performSplitAtCaret` (SegmentItem) → payload amb left/right/ratio → tall al cursor. L'únic camí correcte.
2. **Botó S** → `onSplit(segment.id)` sense payload → fallback cec: `Math.floor(txt.length / 2)` sobre el text sencer (incloent `\n` i tags SRT) → partia paraules i línies per la meitat en caràcters.
3. **Ctrl+K amb focus fora del text** → drecera global (window keydown) → mateix fallback cec, aplicat a `activeSegmentId`, que se sincronitza sol amb el playhead del vídeo → podia partir un segment diferent del que l'usuari mirava.

A més: a la vista standalone (`VideoSrtStandaloneEditorView`) el fallback no existia (`if (!payload) return`) → el botó S no feia res; i el `splitPayloadRef` no es netejava en tots els camins de sortida → perill latent de payload obsolet aplicat a un segment equivocat (els ids es renumeren `i + 1` a cada commit).

**Lo que NO funcionó:**
- El disseny original del fallback (punt mig en caràcters del text cru): és determinista però percebut com a aleatori perquè ignora cursor, paraules, salts de línia i tags. Qualsevol fallback de split ha d'operar sobre fronteres semàntiques (línia > paraula), mai sobre offsets de caràcters.
- Fer que el botó S llegís la selecció directament al `onClick` no és viable sense més: el mousedown del botó desenfoca l'editor i pot destruir la selecció abans del click. Cal `onMouseDown={e => e.preventDefault()}` (truc estàndard de toolbars d'editors rics) per conservar focus i caret.

**Solución:**
Comportament estàndard tipus Subtitle Edit:
- **Botó S conscient del cursor:** si `window.getSelection()` cau dins l'editor d'aquest segment → `performSplitAtCaret` (mateix camí que Ctrl+K); si no → fallback lògic de la vista. `preventDefault` al mousedown per no perdre la selecció.
- **Fallback lògic nou** (`computeSmartSplit` a `utils/SubtitlesEditor/splitHelpers.ts`, funció pura): multilínia → talla pel `\n` que deixa les meitats més equilibrades (longitud sense tags); una línia → per l'espai més proper al centre; paraula única → migpunt dur. Mai talla dins d'un tag; reequilibra tags oberts (`<i>a\nb</i>` → `<i>a</i>` + `<i>b</i>`). Retorna `splitRatio` per repartir la durada proporcionalment al text (abans el fallback partia el temps 50/50 encara que el text quedés 80/20).
- **Vista standalone:** afegit el mateix fallback (el botó S hi era mort).
- **Higiene del payload:** es consumeix sempre a l'entrada del handler (`read + clear`) i es valida `payload.id === idParam` abans d'usar-lo.
- **Guarda anti-bloc-buit:** cursor al principi o final del text → no es divideix.

**Archivos tocados:**
- `frontend/utils/SubtitlesEditor/splitHelpers.ts` (nou — lògica pura, testejada amb 10 casos via tsc+node)
- `frontend/components/VideoSubtitlesEditor/SegmentItem.tsx` — botó S conscient del cursor, guarda anti-buit
- `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` — fallback smart + higiene payload
- `frontend/components/VideoSubtitlesEditor/VideoSrtStandaloneEditorView.tsx` — fallback nou + higiene payload

**Lección:**
Quan una acció d'UI té múltiples disparadors (drecera local, drecera global, botó), tots han de convergir en la mateixa semàntica o l'usuari ho percep com a comportament aleatori — el pitjor cas és que el resultat depengui d'un estat invisible com el focus. I per a botons de toolbar que operen sobre la selecció d'un contentEditable, `preventDefault` al mousedown és obligatori. Estat efímer compartit via ref (`splitPayloadRef`) s'ha de consumir sempre (read + clear atòmic a l'entrada), no netejar-lo camí per camí.

**Follow-ups (movidos a tareas.md):**
- Split: respectar `minDurationMs`/`minGapMs` (tarea 3).
- Verificació manual en navegador dels 3 gestos (tareas manuales del usuario).

---

## 2026-07-07 — Hito: Durada mínima configurable per bloc de subtítol (equivalent Subtitle Edit)

**Tipo:** hito + bug resuelto

**Síntoma / Contexto:**
L'editor no tenia cap manera de configurar la durada mínima d'un bloc. L'únic límit existent era el pis absolut intern `MIN_SEG_DURATION_MS = 100` ms (compartit amb el pipeline de transcripció del backend i no configurable). Subtitle Edit ofereix "Minimum duration (ms)" (default 1000 ms) per impedir reduir blocs per sota del llindar triat.

A més, `VideoSrtStandaloneEditorView.tsx` tenia un bug latent: el punt d'aplicació dins de `handleSegmentChange` usava `0.1` (100 ms) hardcoded en lloc de la constant, cosa que feia el pis efectiu de 100 ms i no reflectia el valor real del sistema.

**Lo que NO funcionó:**
- Cap intent fallit: el disseny va madurar via 3 iteracions de ralph-loop (totes amb findings de severitat MINOR) sense canviar l'arquitectura. La revisió sí va detectar el bug de `0.1` hardcoded i va millorar el pla (hoisting de `minDurSec` al WaveformTimeline).

**Solución:**
Patró idèntic al de `editorMinGapMs` / `EDITOR_MIN_GAP_MS`:
- Clau localStorage `snlbpro_editor_min_duration_ms` (default 1000 ms); afegida a `KEYS_TO_REMOVE` de factoryReset.
- Camp `minDurationMs?: number` a `GeneralConfig` → propagat des de `useLocalStorage` fins a tots els punts d'aplicació.
- `SettingsModal` → control "Durada mínima de subtítol" (step 50, max 5000 ms).
- 6 punts d'aplicació, fórmula única: `Math.max(MIN_SEG_DURATION_MS, generalConfig.minDurationMs ?? 1000) / 1000`.
- WaveformTimeline: `minDurMsRef` (useRef + useEffect) per evitar recrear el callback de drag quan canvia la preferència.

**Archivos tocados:**
- `frontend/constants.ts`, `frontend/types/Subtitles.ts`, `frontend/utils/factoryReset.ts`
- `frontend/components/SettingsModal.tsx`
- `frontend/components/VideoEditor/WaveformTimeline.tsx`
- `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx`
- `frontend/components/VideoSubtitlesEditor/VideoSrtStandaloneEditorView.tsx`

**Lección:**
El patró `editorMinGapMs` (localStorage → `GeneralConfig` → punts d'aplicació) és el model reutilitzable per a qualsevol nova preferència d'editor de subtítols. Per a valors que canvien rarament però que callbacks estables (`useCallback`) han de llegir: `useRef` + `useEffect` (no afegir la prop com a dep del callback — provoca recreació constant del handler de drag).

**Follow-ups (movidos a tareas.md):**
- Cap.

---

## 2026-07-07 — Bug: Delete al final de línia no unia amb la línia següent en l'editor de subtítols

**Tipo:** bug resuelto

**Síntoma / Contexto:**
En el editor de subtítols (`SegmentItem.tsx`), prémer **Suprimir** (Delete) al final de la línia 1 d'un bloc no unia el text amb la línia 2. En canvi, prémer **Retrocés** (Backspace) al principi de la línia 2 sí que funcionava correctament.

**Lo que NO funcionó:**
- Deixar el comportament per defecte del navegador: `contentEditable` amb separadors `<br>` no gestiona bé la tecla Delete al final d'un node de text (el navegador no elimina el `<br>` correctament en aquesta posició, però sí ho fa Backspace des del costat oposat).

**Solución:**
Afegir un handler explícit per a la tecla `Delete` a `handleKeyDown`, seguint el mateix patró que el handler de `Shift+Enter` (però en sentit invers):
1. Extreure el text pla abans i després del cursor amb `document.createRange`.
2. Si `textAfter` comença per `\n` (cursor al final d'una línia no darrera), prevenir el comportament per defecte.
3. Construir el text unificat (`textBefore + textAfter.slice(1)`) i cridar `onChange`.
4. Posicionar el cursor exactament a la unió (`charOffset = textBefore.length`) via un nou camp `charOffset` a `CaretHint`, gestionat al `requestAnimationFrame` del `useLayoutEffect`.

Funció auxiliar nova: `placeCaretAtCharOffset(editor, offset)` — recorre els nodes fills de l'editor (text nodes + `<br>`) acumulant caràcters fins a trobar l'offset exacte.

**Archivos tocados:**
- `frontend/context/SubtitleEditorContext.tsx` — afegit `charOffset?: number` a la interfície `CaretHint`
- `frontend/components/VideoSubtitlesEditor/SegmentItem.tsx` — nova funció `placeCaretAtCharOffset`, handler `Delete` a `handleKeyDown`, cas `charOffset` al `requestAnimationFrame`

**Lección:**
El `contentEditable` amb `<br>` com a separadors de línia té un comportament asimètric entre Delete i Backspace: Backspace des de la línia N+1 funciona nativament, Delete des de la línia N no. Qualsevol editor que faci servir `<br>` com a separador ha d'implementar el handler Delete explícitament. El patró `onChange + caretHintRef + useLayoutEffect + rAF` és el mecanisme establert per a modificacions programàtiques de text amb posicionament de cursor en aquest editor.

**Follow-ups (movidos a tareas.md):**
- Cap.

---

## 2026-07-07 — Limpieza del repo y adopción del modelo `.claude`

**Tipo:** incidencia + decisión arquitectónica

**Síntoma / Contexto:**
La rama `ModificacionesMarcJulio2026` (subconjunto reducido de `main`) no tenía `.gitignore` ni `CLAUDE.md` raíz, tenía ~5.74 GB de media (`backend_nest_mvp/SonilabData/`) commiteados en el historial que impedían el push (GitHub rechaza archivos >100 MB), y arrastraba artefactos de skills (`docs/`, `.playwright-mcp/`) y archivos con nombre corrupto.

**Solución:**
- `.gitignore` raíz nuevo: ignora `docs/`, `.superpowers/`, `.playwright-mcp/`, `SonilabData/`, builds, logs. Se conservan `.vscode/` y `.claude/` (decisión propia de esta rama, opuesta a `main`).
- Purga de los 5.74 GB del historial con `git filter-branch --index-filter`.
- `CLAUDE.md` raíz traído de `main` y luego **fusionado** con el modelo genérico `0000_MODELO_PROYECTO_CLAUDE` (constitución operativa + contexto de producto Sonilab).
- Adoptada la estructura `.claude/` del modelo (settings, docs/tareas.md, docs/history.md, to_claude, commands, skills).

**Lección:**
Datos de runtime (media de usuario) nunca en git. La media vive fuera del repo; `SonilabData/` está en `.gitignore` en ambas ramas.
