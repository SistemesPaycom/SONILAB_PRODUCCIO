# Tasques del projecte

Aquest arxiu és la **font única de veritat sobre el futur del projecte**.
Les tasques NO s'esborren en completar-se: es **MOUEN** de 🟥 PENDENTS → 🟡 EN_PROCES → ✅ ACABAT (o 🛑 CANCELATS si es descarten/reverteixen).
Les dates són **SEMPRE** absolutes `[aaaa-mm-dd] | [hh:mm:ss]`, mai relatives.

> [!NOTE]
> **Migració 2026-07-09.** Aquest arxiu substitueix l'antic `tareas.md` (format de 2 estats:
> PENDIENTE/TERMINADO), migrat al model de 4 estats de
> `.claude/to_claude/kit-migracio-model/`. Backup íntegre de l'original a
> `.claude/_backup-migracio-2026-07-09/tareas.md`. Notes de la migració (llegir abans de fiar-se
> cegament dels camps numèrics):
> - **IDs nous** `SPS-nnnn`, assignats en aquesta migració (no existien a l'original). S'anoten
>   referències «abans: T#» / «abans: (pendent #N)» a cada entrada. L'ordre no és estrictament
>   cronològic de creació (l'original no distingia data de creació vs. data de tancament) —
>   T1..T13 s'han numerat per ordre de la seva pròpia llista antiga, i els PENDENTS 1..15 a
>   continuació, en el mateix ordre en què ja apareixien.
> - **Dates:** l'original només registrava **una** data per entrada (dia, sense hora). On el
>   format nou espera 🗒️ (incorporació) i 🏃 (inici) per separat, s'ha posat **la mateixa data**
>   als dos camps (flux autònom d'una sola sessió: spec+pla+implementació el mateix dia) amb
>   l'hora marcada `(no consta)`.
> - **Risc/Dimensions numèrics:** l'original feia servir nivells qualitatius («bajo/medio/alto»,
>   «pequeño/medio/grande»), sense escala 0–10. Els números d'aquest arxiu són una **conversió
>   aproximada** (bajo≈2, medio≈5, alto≈8) fet en la migració, no un valor original — es manté
>   sempre entre parèntesis el nivell qualitatiu real de l'original.
> - **Prioritat (⭐):** concepte nou, inexistent a l'original. No s'inventa cap valor: es marca
>   `(no consta)`. Per als PENDENTS, l'ordre de la llista reprodueix exactament l'ordre original,
>   que ja anava «ordenat per recomanació d'atac» — fa de proxy visual de prioritat.
> - **Reinterpretació d'estat (la decisió més important d'aquesta migració):** l'antic
>   `tareas.md` tenia només 2 estats. 13 tasques (T1–T13) estaven a `✅ TERMINADO`, però 12
>   d'elles (totes tret de T1) tenien pendents explícits a la secció «Tareas manuales del
>   usuario»: verificació en navegador i/o decisió de commit. El model nou defineix ACABAT com
>   «un cop l'usuari n'hagi verificat les tasques manuals» — per tant, aquestes 12 es migren a
>   **🟡 EN_PROCES** (no a ACABAT), amb el seu checklist pendent com a «Tasques a realitzar per
>   part de l'usuari». Només **T1** (sense cap pendent a la llista antiga) passa a ACABAT. Això
>   és una reinterpretació semàntica explícita, no una pèrdua de dades — cap informació
>   desapareix, es marca l'estat que reflecteix la realitat actual. Veure l'informe de migració
>   per si es prefereix un altre criteri.

<!--
Plantilla d'una entrada (copieu-la per crear-ne una de nova):

> ---
> ## **[ID]. [Títol curt]**
> >> ###### [🗒️] *[aaaa-mm-dd] | [hh:mm:ss]*   (incorporació al document)
> >> ###### [🏃‍♂️‍➡️] *[aaaa-mm-dd] | [hh:mm:ss]*   (inici — només en passar a EN_PROCES)
> >> ###### [✅] *[aaaa-mm-dd] | [hh:mm:ss]*   (finalització — només en passar a ACABAT)
>
> >#### **Síntoma / Context:**
> >* [text]
>
> >#### **Pla:**
> >* [text]
>
> >#### **Arxius afectats:**
> >* [text]
>
> >>##### **Risc:** (X/10)
> >>##### **Dimensions:** (Y/10)
> >>##### **Prioritat:** ⭐ (sobre 10)
>
> >#### **Tasques a realitzar per part de l'usuari ABANS de donar-ho per tancat:**
> > * (tasca) [__ / ✅]
>
> ---

#### Què ha canviat al tancar-ho:   (només en ACABAT)
(text)

**Nota:** (text opcional)

**Detall a** history.md (H-nnnnn)

Llegenda dels camps:
- ID .......... Sigles del projecte + número de 4 dígits (SPS-nnnn).
- Risc ........ Probabilitat de trencar alguna cosa, sobre 10.
- Dimensions .. Complexitat esperada (temps/tokens), sobre 10 — NO és el mateix que el risc.
- Prioritat ... Urgència sobre 10 ⭐. L'ordre al document mana per sobre, però serveix de
                referència visual. 10⭐ = bloquejant absolut (cal fer-ho abans de continuar).
- Tasques de l'usuari .. Verificacions manuals que apareixen quan la IA ja no pot avançar i
                cal intervenció humana. `[__]` = pendent · `[✅]` = fet.
-->

---

# 🟥 **PENDENTS**

> *Ordenat per recomanació d'atac: primer per ordre lògic (els ciments, les bases… fins al sostre) i, després, dels més ràpids/desbloquejants als més grans. Ordre conservat íntegrament de l'original.*

> ---
> ## **SPS-0019. Sincronitzar `project.mediaDocumentId` en vincular media (coherència del registre)**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: pendent #6)* El fix de SPS-0005 (T5, persistència del vídeo del projecte) llegeix l'últim vídeo des de `linkedMediaId` de l'SRT, però el `project.mediaDocumentId` del backend queda obsolet: continua apuntant al vídeo de la creació. No afecta l'obertura del projecte (ja no és la font primària), però qualsevol llistat/report/lògica futura que llegeixi `mediaDocumentId` veurà el vídeo antic.
>
> >#### **Pla:**
> >* En `api.linkMediaToSrt` (o al backend en rebre el PATCH de `linkedMediaId`), actualitzar també el `mediaDocumentId` del projecte associat a aquest SRT. Toca `backend_nest_mvp/src/modules/projects/` → consultar `.claude/docs/domains/projectes.md` abans. Opcional; no bloqueja res.
>
> >#### **Arxius afectats:**
> >* `backend_nest_mvp/src/modules/projects/` (service + potser controller), possiblement `frontend/services/api.ts`.
>
> >>##### **Risc:** 2/10 *(orig.: «bajo»)*
> >>##### **Dimensions:** 2/10 *(orig.: «pequeño»)*
> >>##### **Prioritat:** ⭐ (no consta)
>
> ---

> ---
> ## **SPS-0020. Cerca i substitució a l'editor de guions (columnes original/traducció)**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: pendent #7)* La cerca/substitució tipus Word (SPS-0006/T6) es va implementar només a l'editor de subtítols — decisió d'abast validada amb l'usuari. L'editor de guions (`EditorDeGuions`, dues columnes) no en té; l'usuari va assenyalar que allà caldria poder cercar tant a la columna original com a la traduïda (o a totes dues).
>
> >#### **Pla:**
> >* Reutilitzar el mòdul pur `frontend/utils/SubtitlesEditor/searchReplace.ts` (`findMatches`/`replaceVisibleRange` són agnòstics del component); dissenyar a part la UI i el selector de columna (original / traducció / ambdues).
>
> >#### **Arxius afectats:**
> >* `frontend/components/EditorDeGuions/`.
>
> >>##### **Risc:** 5/10 *(orig.: «medio»)*
> >>##### **Dimensions:** 5/10 *(orig.: «medio»)*
> >>##### **Prioritat:** ⭐ (no consta)
>
> ---

> ---
> ## **SPS-0021. Instal·lar `@types/react` (+ `@types/react-dom`) al frontend**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: pendent #8)* El frontend no té `@types/react` enlloc: `npx tsc --noEmit` passa, però tot `React.*` es resol com a *any* silenciós i el typecheck valida molt menys del que sembla. Va aflorar dues vegades durant SPS-0006 (T6, error TS2347 en un genèric de `querySelectorAll` derivat de la cadena d'*any*; els revisors ho van marcar com a baseline feble del repo).
>
> >#### **Pla:**
> >* `npm install --save-dev @types/react @types/react-dom` (**dependència nova → requereix aprovació expressa de l'usuari**, regla j de la Part I) i arreglar els errors de tipus latents que aflorin.
>
> >#### **Arxius afectats:**
> >* `frontend/package.json` + errors de tipus latents que aflorin arreu del frontend.
>
> >>##### **Risc:** 2/10 *(orig.: «bajo, només dev-time»)*
> >>##### **Dimensions:** 4/10 *(orig.: «pequeño-medio, poden aflorar errors latents en cadena»)*
> >>##### **Prioritat:** ⭐ (no consta)
>
> ---

> ---
> ## **SPS-0023. [SEGURETAT · HIGH] Treure el JWT de la URL de streaming de media**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: pendent #10)* La revisió de seguretat automàtica va marcar `api.streamUrlWithToken(docId)` (`frontend/services/api.ts`): passa el JWT com a query param (`?token=...`) al `src` del `<video>`. Els tokens a la query string es filtren a logs d'accés del servidor, historial del navegador, capçaleres `Referer` i proxies. **Preexistent** — no introduït per SPS-0007 (T7, resume position); `api.saveResumeState` de SPS-0007 usa la capçalera `Authorization`, no la URL. Fora de l'abast de SPS-0007 i toca el flux de streaming (zona sensible, requereix canvi coordinat backend+frontend d'autenticació) → tasca a part.
>
> >#### **Pla:**
> >* Opció recomanada (b) menys intrusiva: endpoint que emeti una cookie de només-media (`HttpOnly, SameSite=Lax, Path=/media`) i que el `<video>` usi la URL sense token. Alternativa (a): signed-URLs curtes amb HMAC(docId+expiry). Si es manté el token durant la migració, configurar el servidor perquè no registri el param `token` als logs.
>
> >#### **Arxius afectats:**
> >* `frontend/services/api.ts`, `backend_nest_mvp/src/modules/media/` (nou endpoint/guard), consultar `.claude/docs/domains/` si aplica.
>
> >>##### **Risc:** 5/10 *(orig.: «medio (auth)»)*
> >>##### **Dimensions:** 5/10 *(orig.: «medio»)*
> >>##### **Prioritat:** ⭐ (no consta — marcada [SEGURETAT · HIGH] a l'original)
>
> ---

> ---
> ## **SPS-0024. Evitar la doble crida `getProjectBySrt` a `VideoSubtitlesEditorView`**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: pendent #11)* Tradeoff acceptat de SPS-0007 (T7): el hook `useResumePosition` fa la seva pròpia crida `api.getProjectBySrt(docId)`, i `VideoSubtitlesEditorView` ja en fa una altra a l'efecte de càrrega del guió → dues lectures en obrir. És barat i es va prioritzar tenir les dues vistes idèntiques, però es podria optimitzar passant el projecte ja carregat al hook (via setter). No bloqueja res.
>
> >#### **Pla:**
> >* Afegir un mecanisme opcional perquè la vista alimenti el projecte ja resolt al hook; l'standalone continuaria fent el fetch propi.
>
> >#### **Arxius afectats:**
> >* `frontend/hooks/useResumePosition.ts`, `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx`.
>
> >>##### **Risc:** 2/10 *(orig.: «bajo»)*
> >>##### **Dimensions:** 2/10 *(orig.: «pequeño»)*
> >>##### **Prioritat:** ⭐ (no consta)
>
> ---

> ---
> ## **SPS-0025. Rediseny complet de la interacció del visualitzador d'ona (Fases A/B/C)**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: pendent #12)* Sessió de disseny llarga (validada amb l'usuari, estudiant el codi font de Subtitle Edit) per portar la interacció de l'ona a paritat amb SE + millores de Nuendo. Esquema mestre a `Shortcuts Subtitols - Consolidat.csv` (arrel). Arrel tècnica descoberta: el problema del doble-clic i de l'edició durant la reproducció NO és el model de ratolí sinó l'**autoscroll que recentra la vista en cada seek manual**; SE ho evita amb page-follow (només salta quan el cursor surt de la finestra) i sense recentrar en clic. Veure `history.md` (H-00011).
>
> >#### **Pla (per fases; spec+pla datats cadascuna):**
> >* **Fase A (base, desbloquejant): implementada, pendent de verificació — veure SPS-0012.** Default de scroll → `page`; secció Ajustos "Ona d'àudio" amb **Pàgina** (default; amaga+inertitza el botó intern del timeline però el deixa al DOM) i **Duo** (comportament actual). Arregla el doble-clic i l'edició durant playback (el mode `page` ja no recentra en clics dins la finestra).
> >* **Fase B (ratolí):** part 1 (modificador+clic = fixar cues: Shift=inici, Ctrl=final, Alt=inici mantenint durada, Ctrl+Shift=ripple) **implementada, pendent de verificació — veure SPS-0013.** Resta a **Fase B2 (SPS-0028)**: crear arrossegant a zona buida (+Enter), `Alt+Shift`+arrossegar = scrub, `Alt`+arrossegar vora = enllaça veí <500 ms.
> >* **Fase C (teclat):** un sol joc de dreceres (independent del mode de scroll): `←/→` (1 s) i `Ctrl+←/→` (1 frame; passos configurables), nudge `Alt+←/→` (inici) i `Alt+Shift+←/→` (final) estil Nuendo, `Alt+↑/↓` (línia), `F9–F12`, `Shift+F9`, `Ctrl+Shift+M` (merge), `Ctrl+Alt+V` (split) — tot personalitzable.
> >* **Sub-parts ajornades:** model de ratolí per a estacionari/Duo (SPS-0014). Els presets explícits page/duo (SPS-0015) queden **descartats** — el model de ratolí és únic i mode-agnòstic (veure CANCELATS i H-00015); el que sí queda obert és SPS-0029 (gestos contra una vista en moviment durant la reproducció).
>
> >#### **Arxius afectats:**
> >* `frontend/components/VideoEditor/WaveformTimeline.tsx`, `SettingsModal.tsx`, `constants.ts`, `factoryReset.ts`, sistema de dreceres (`useKeyboardShortcuts`/`DEFAULT_SHORTCUTS`), les dues vistes d'editor.
>
> >>##### **Risc:** 7/10 *(orig.: «medio-alto, rework d'interacció ampli»)*
> >>##### **Dimensions:** 8/10 *(orig.: «gran — fer per fases»)*
> >>##### **Prioritat:** ⭐ (no consta)
>
> ---

> ---
> ## **SPS-0026. Detecció de canvis de pla (shot changes) + snapping**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: pendent #13)* L'usuari vol detecció de canvis de pla qualitat tipus Premiere per enganxar-hi les vores dels subtítols. SE ho fa amb FFmpeg (`select=gt(scene\,0.4),showinfo`, llindar 0.4 configurable, desat en `.shotchanges`).
>
> >#### **Pla:**
> >* Backend — job que detecti els canvis de pla del media i en desi els timestamps per media; opció FFmpeg (ràpid) o **PySceneDetect** (content-aware, millor amb fosos/moviment; ja hi ha worker Python de WhisperX). Frontend — pintar línies verticals a l'ona + snapping configurable de les vores (`Shift`+arrossegar per bypassar; zones de llindar estil SE). Mirar el codi de snapping de SE (clonat a scratchpad) per la UX.
>
> >#### **Arxius afectats:**
> >* `backend_nest_mvp/src/modules/media/` (o worker Python), `frontend/components/VideoEditor/WaveformTimeline.tsx`.
>
> >>##### **Risc:** 5/10 *(orig.: «medio»)*
> >>##### **Dimensions:** 8/10 *(orig.: «gran — fase pròpia»)*
> >>##### **Prioritat:** ⭐ (no consta)
>
> ---

> ---
> ## **SPS-0027. Presets de temps per frames per projecte (TV 25 / Cine 24)**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: pendent #14)* Min duration / min gap són en ms; l'usuari vol presets seleccionables per projecte expressats en FRAMES segons perfil (TV 25 fps, Cine 24 fps).
>
> >#### **Pla:**
> >* Afegir fps per projecte + conversió frame↔ms; presets escollibles que fixin min duration / min gap en frames.
>
> >#### **Arxius afectats:**
> >* Model de projecte (backend), `SettingsModal.tsx` / config d'editor.
>
> >>##### **Risc:** 3/10 *(orig.: «bajo-medio»)*
> >>##### **Dimensions:** 5/10 *(orig.: «medio»)*
> >>##### **Prioritat:** ⭐ (no consta)
>
> ---

> ---
> ## **SPS-0028. Fase B2 de l'ona: crear-arrossegant + scrub + Alt-vora-veí**
> >> ###### [🗒️] *[2026-07-08] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: pendent #15)* Resta de la Fase B (SPS-0025) que es va deixar fora de la part 1 (SPS-0013/T13) perquè requereix infraestructura NOVA i té col·lisions de modificador-durant-drag. Van juntes.
>
> >#### **Pla:**
> >* **Crear arrossegant a zona buida:** arrossegar sobre l'ona buida marca un rang provisional (nou estat + dibuix a `drawVisible` de `WaveformTimeline`) → `Enter` insereix el subtítol (`Esc` cancel·la). **Cal fer l'ona focusable i afegir-hi maneig de teclat** (avui `WaveformTimeline` NO té cap `onKeyDown` ni és focusable — tota la gestió de tecles viu al pare via `useKeyboardShortcuts`). Nou callback `onCreateSegment(start, end)` + handler al pare (reutilitzar la lògica de `handleInsertSegmentAtCursor`).
> >* **Scrub → `Alt+Shift`+arrossegar:** relocalitzar el scrub (avui = arrossegar sobre espai buit) a `Alt+Shift`, per alliberar l'arrossegar-buit per a "crear". Acoblat amb el punt anterior.
> >* **`Alt`+arrossegar vora = enllaça veí:** en redimensionar una vora amb Alt, moure també la vora del veí més proper si és a <500 ms (com SE). Modifica la lògica de drag/resize a `handleMouseMove`; compte amb la col·lisió amb `Alt`+clic (cue, SPS-0013/T13) — es distingeix per clic-vs-drag.
>
> >#### **Arxius afectats:**
> >* `frontend/components/VideoEditor/WaveformTimeline.tsx` (drawVisible, handlers, teclat, nou estat), les dues vistes editores (callback `onCreateSegment`).
>
> >>##### **Risc:** 7/10 *(orig.: «medio-alto»)*
> >>##### **Dimensions:** 8/10 *(orig.: «gran — infra nova de teclat + dibuix»)*
> >>##### **Prioritat:** ⭐ (no consta)
>
> ---

> ---
> ## **SPS-0031. Neteja del deute mort del subsistema d'ona (props i claus sense consumidor)**
> >> ###### [🗒️] *[2026-07-13] | [10:42:34]*
>
> >#### **Síntoma / Context:**
> >* Inventari fet en avaluar SPS-0015 (veure H-00015). Cap d'aquests punts trenca res avui, però tots són trampes per a qui llegeixi el codi després (o per a una IA que hi confiï):
> >   * `LOCAL_STORAGE_KEYS.WAVEFORM_CTRL_CLICK_SEEK` (`frontend/constants.ts:24`, `factoryReset.ts:41`): **zero lectures** des de SPS-0013 (H-00013 ja la va declarar deprecada). Pitjor: el comentari de `constants.ts:23` («Ctrl/Cmd + clic mou només el cursor») diu **el contrari** del que fa el codi avui (`WaveformTimeline.tsx:761` → Ctrl+clic = fixa cue de FINAL).
> >   * Props declarades i mai desestructurades a `WaveformTimeline.tsx`: `viewMode` / `onToggleViewMode` (L30-31). ⚠️ **`autoScroll` (L40) JA NO és deute mort: SPS-0030 l'ha feta viva** (és qui governa el seguiment del RAF loop). **No l'esborris.** Compte a no confondre-la: el que sí que és mort és el `autoScroll` que viatja dins de `playerProps` cap a `VideoPlaybackArea` (punt següent) — camí de props diferent, tot i dir-se igual.
> >   * Passthroughs morts: `VideoPlaybackArea.tsx:27-28` (`autoScroll`, `scrollMode` declarades i mai usades) alimentats des de `VideoSubtitlesEditorView.tsx:1114`, `VideoSrtStandaloneEditorView.tsx:557` i `MediaPreviewView.tsx:92-93` — i, a més, hi passen `scrollModeWave` **cru** en lloc d'`effectiveScrollMode` (inconsistència latent). Igual a `VideoSubtitlesToolbar.tsx:26-30` («kept for interface compat»).
> >   * `MediaPreviewView.tsx:25,169-173`: té estat i botó propis d'estacionari/pàgina però **no renderitza cap `WaveformTimeline`** → el botó no fa res i no respecta el bloqueig del mode Pàgina (ja detectat a H-00012 com a botó vestigial).
>
> >#### **Pla:**
> >* Esborrar clau + comentari obsolet, esborrar props mortes i els seus llocs de crida, i decidir què fer amb el botó vestigial de `MediaPreviewView` (amagar-lo o eliminar-lo). Fer-ho en **un sol canvi de neteja**, no barrejat amb cap fix funcional. Consultar `.claude/docs/domains/localstorage.md` si per llavors existeix (avui la carpeta `domains/` encara no està creada).
>
> >#### **Arxius afectats:**
> >* `frontend/constants.ts`, `frontend/utils/factoryReset.ts`, `frontend/components/VideoEditor/WaveformTimeline.tsx`, `VideoPlaybackArea.tsx`, `MediaPreviewView.tsx`, `frontend/components/VideoSubtitlesEditor/VideoSubtitlesToolbar.tsx` + les dues vistes editores.
>
> >>##### **Risc:** 2/10 *(esborrar codi sense consumidor; el risc real és esborrar-ne un que sí que en tingui — verificar amb grep abans)*
> >>##### **Dimensions:** 3/10
> >>##### **Prioritat:** ⭐⭐ (2/10 — no bloqueja res; fer-ho quan es toqui l'ona per un altre motiu)
>
> ---

> ---
> ## **SPS-0039. Lògica de combos de teclat duplicada entre `SettingsModal` i `useKeyboardShortcuts`**
> >> ###### [🗒️] *[2026-07-14] | [13:15:39]*
>
> >#### **Síntoma / Context:**
> >* Detectat a la revisió de SPS-0022. El gravador de dreceres d'Ajustos (`SettingsModal.tsx:94-110`) té la **seva pròpia còpia** de la funció que converteix un event de teclat en el string de combo (`Ctrl+Shift+Z`), gairebé idèntica a la del hook però amb diferències pròpies (majúscula per a tecles d'1 caràcter, `null` per a `Escape`). Fins ara la duplicació era invisible; SPS-0022 ha extret la versió canònica al hook (`mapKeyName`/`comboFromEvent`, ara reutilitzada també per la barra de cerca), de manera que ara hi ha **dues fonts de veritat**: qui gravi el combo i qui el reconegui poden divergir. Si algú toca `mapKeyName` (p. ex. afegint `'.'→Period`), els combos ja gravats a `localStorage` deixarien de casar i la drecera de l'usuari es tornaria muda, sense cap error visible.
>
> >#### **Pla:**
> >* Fer que `SettingsModal` consumeixi el `comboFromEvent` del hook (exportar-lo) i quedar-se només amb el que és pròpiament del gravador (tractament d'`Escape` per cancel·lar, presentació en majúscules). Verificar que els combos ja desats a `LOCAL_STORAGE_KEYS.SHORTCUTS` segueixen casant després del canvi (o migrar-los) — és l'únic risc real.
>
> >#### **Arxius afectats:**
> >* `frontend/components/SettingsModal.tsx`, `frontend/hooks/useKeyboardShortcuts.ts`.
>
> >>##### **Risc:** 3/10 *(toca el matching de dreceres ja desades de l'usuari)*
> >>##### **Dimensions:** 2/10
> >>##### **Prioritat:** ⭐⭐ (2/10 — no trenca res avui; és una trampa per al proper que toqui les dreceres)
>
> ---

---

## 🟡 **EN_PROCES**

> *Implementació ja feta (verificada tècnicament amb `tsc --noEmit`/`vite build`) però **pendent de verificació humana en navegador i/o decisió de commit** — per això, segons la semàntica del model nou, NO són ACABAT encara. Veure nota de migració a dalt. Ordenades de la més recent a la més antiga (mateix ordre que l'antic bloc TERMINADO).*

> [!NOTE]
> **Comprovació 2026-07-15 (abans d'un trasllat de disc).** SPS-0011 es va tancar aquest dia perquè `git status` confirmava l'arbre net i el seu únic fitxer (`backend_nest_mvp/tsconfig.json`) ja commitejat. **NO s'ha fet el mateix amb SPS-0008/SPS-0009/SPS-0010/SPS-0012/SPS-0013**, que comparteixen el mateix ítem "decidir si commitejar" (grup T8–T13): en aquesta data, `git status` mostrava canvis **encara no commitejats** a `WaveformTimeline.tsx`, `VideoSubtitlesEditorView.tsx`, `VideoSrtStandaloneEditorView.tsx`, `SubtitlesEditor.tsx`, `SegmentItem.tsx`, `SrtPreviewView.tsx`, `useKeyboardShortcuts.ts`, `SearchReplaceBar.tsx`, `richTextHelpers.ts`, `splitHelpers.ts`, `VideoPlayer.tsx` i als propis `tasks.md`/`history.md` (aquests dos ja amb les entrades SPS-0016..SPS-0039 / H-00019..H-00024 escrites però sense commit) — més 4 fitxers de harness sense trackejar (`frontend/__main_wave_harness.*`, `frontend/__wave_harness.*`). No tocar aquestes 5 tasques com a ACABAT fins que es torni a comprovar `git status` i surti net. **Abans de traslladar aquest projecte a un altre disc, assegura't que el mètode de trasllat preserva l'arbre de treball tal qual (còpia de carpeta sencera, no un `git clone` nou)** — un clone nou perdria tot això perquè mai s'ha fet push.

> ---
> ## **SPS-0022. Polits menors del review final de cerca/substitució**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-14] | [13:02:40]*
>
> >#### **Síntoma / Context:**
> >* *(abans: pendent #9)* La revisió final de SPS-0006 (T6) va deixar 2 polits triats "LEAVE" (cap bloqueja res): (a) amb el focus als inputs de la barra de cerca, Ctrl+Z fa l'undo natiu de l'input, no el del document — conseqüència del `stopPropagation` total (decisió documentada al codi per la tecla Supr); Word/VSCode enruten l'undo al document; (b) si TOTES les substitucions d'un «Substituir-ho tot» són byte-idèntiques, el commit fa *bail* però el missatge diu igualment «S'han fet N substitucions» (cosmètic).
>
> >#### **Pla (ja implementat):**
> >* **(a) Delegació de les dreceres GENERALS, no un prop `onUndo`.** La fitxa proposava un prop `onUndo`, però hauria hardcodejat Ctrl+Z i duplicat el sistema de dreceres (que és **personalitzable** des d'Ajustos). En comptes d'això, `useKeyboardShortcuts.ts` exporta ara `findGeneralShortcutAction(e)` (consulta la config real) i la barra deixa de fer `stopPropagation` **només** quan la combo premuda (amb Ctrl/Cmd) correspon a una drecera de la llista `general` → l'event arriba al listener de window i la vista fa `subsHistory.undo()`. Cobreix Desfer, Refer **i Guardar** (Ctrl+S ja no obre el diàleg de desar del navegador: mateixa causa arrel). La resta de tecles segueixen aïllades → Supr continua esborrant text a l'input i Ctrl+F es continua tractant localment.
> >* **S'exigeix Ctrl/Cmd** a la delegació: si l'usuari remapegés una drecera general a una tecla simple, no podria robar el text que s'està escrivint. (Asimetria conscient: un remapeig a `Alt+S` no travessaria la barra; ampliar-ho a `altKey` obriria la porta a AltGr = Ctrl+Alt als teclats ES/CAT, que és pitjor.)
> >* **Refactor mínim del hook:** extrets `mapKeyName` / `comboFromEvent` / `normalizeCombo` de dins de `handleKeyDown` (equivalència semàntica auditada contra HEAD, cas per cas) per poder reutilitzar el matching des de la barra sense duplicar-lo.
> >* **(b) Comptador honest a `handleReplaceAll`:** els segments que queden **byte-idèntics** després de la substitució ja no s'inclouen al batch ni es compten. Si el total real és 0, la barra mostra «Cap substitució» (gris) en lloc de «S'han fet N substitucions» (verd). Efecte lateral positiu descobert a la revisió: `handleSegmentsBatchChange` posa `richText: ''` als segments del batch, així que abans una substitució idèntica sobre un bloc amb format **n'esborrava el `richText`** i empenyia un pas d'undo fantasma; ara ni s'hi inclou.
>
> >#### **Arxius afectats:**
> >* `frontend/hooks/useKeyboardShortcuts.ts` (nou export + refactor intern) · `frontend/components/VideoSubtitlesEditor/SearchReplaceBar.tsx` · `SubtitlesEditor.tsx` (`handleReplaceAll`).
>
> >#### **Verificació feta:**
> >* `tsc --noEmit` net.
> >* **Revisió adversarial (subagent, 2 lents):** cap troballa MAJOR. Comprovat explícitament que el refactor del hook és equivalent a HEAD (tecles modificadores soles, mapping `Space/Plus/Minus/Comma`, guarda `isInput && !hasMod && len===1`, normalització `.replace('+','')`), que Ctrl+A/C/V/X i Supr segueixen intactes als inputs (no són dreceres `general`), i que **cap acció es dispara dues vegades** (els listeners `scriptEditor` d'`App.tsx` estan desactivats en aquests modes; el hook de `SubtitlesEditor` ignora tot el que no sigui `FIND`). Polits aplicats de la mateixa revisió: el missatge també es neteja en editar el camp de substitució, i s'ha tret un `useRef` importat i no fet servir.
> >* **APP REAL** (backend NestJS + Mongo/Redis en Docker + Vite; editor SRT standalone en mode edició, SRT de 5 blocs; usuari i document de prova sembrats a la BD de dev i **esborrats després** — el compte `admin@sonilab.cat` i els seus 18 documents no s'han tocat):
> >   * **(b)** Cercar `de` + substituir per `de` (5 coincidències) → **«Cap substitució»** en gris i els 5 blocs **byte-idèntics** abans/després. Cercar `prova` + substituir per `PROVA` → «S'han fet **5** substitucions» en verd i els 5 blocs canviats. El comptador és correcte en tots dos casos.
> >   * **(a)** Amb el focus al camp «Cercar…»: **Ctrl+Z** desfà el **document** (els blocs tornen a `prova`) mentre el text de l'input **es queda intacte** (l'undo natiu de l'input no s'executa) · **Ctrl+Shift+Z** refà · **Ctrl+S** arriba a l'app (amb autoguardat OFF, dispara el `PATCH /documents/:id/srt`).
> >   * **Cap default del navegador s'escapa:** mesurat `defaultPrevented` al final del dispatch des de l'input de cerca → `Ctrl+Z`, `Ctrl+Shift+Z`, `Ctrl+S` i `Ctrl+F` tots `true` (el diàleg de desar de Chrome i l'undo natiu de l'input queden suprimits).
> >   * **L'aïllament no s'ha trencat:** una tecla normal (`x`) i **Supr** NO es prevenen i **no arriben a window** (el `stopPropagation` segueix vigent) → escriure i esborrar dins de la barra funciona igual que abans.
>
> >>##### **Risc:** 2/10 *(orig.: «bajo»)*
> >>##### **Dimensions:** 2/10 *(orig.: «pequeño»)*
> >>##### **Prioritat:** ⭐ (no consta)
>
> >**Detall a** history.md (H-00024)
>
> >#### **Tasques a realitzar per part de l'usuari ABANS de donar-ho per tancat:**
> > * Repetir la prova de Ctrl+Z / Ctrl+Shift+Z / Ctrl+S des de la barra de cerca a la vista **vídeo + subtítols** (`VideoSubtitlesEditorView`). Jo només he pogut provar-ho a l'**editor SRT standalone**: la vista de vídeo comparteix exactament els mateixos `SearchReplaceBar`/`SubtitlesEditor` i el mateix cablejat de dreceres (el `case 'UNDO'` és idèntic a les dues vistes), però calia un media real i no l'he conduïda. [__]
> > * Judici de gust: cercar un terme i posar **exactament el mateix** al camp de substitució → «Substituir-ho tot» diu **«Cap substitució»** en gris. ¿Et sembla bé el text i el color, o prefereixes un altre missatge (p. ex. «Res per substituir»)? [__]
> > * Judici de gust: ara **Ctrl+S també travessa la barra** (abans obria el diàleg de desar del navegador). No estava demanat a la fitxa, però és la mateixa causa arrel i la fitxa parlava d'«enrutar al document com Word». Si el prefereixes fora de l'abast, es revertiria traient `SAVE` de la delegació. [__]
> > * Decidir commit. [__]
>
> ---

> ---
> ## **SPS-0018. Polits menors del review final de selecció múltiple**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-14] | [13:00:12]*
>
> >#### **Síntoma / Context:**
> >* *(abans: pendent #5)* La revisió final de la feature de selecció múltiple (SPS-0003) va deixar 4 polits triats com a "LEAVE" (cap bloqueja res): (a) typo al comentari de `handleToggleSelect` ("corra"→"corre", `SubtitlesEditor.tsx`); (b) el canal del checkbox de 22px té zona morta — només el botó de 14px fa toggle; es podria reenviar el clic del canal al toggle per ampliar la diana; (c) `useState<Set<number>>(new Set())` alloca un Set per render — lazy init `useState(() => new Set<number>())`; (d) `onSegmentsBatchChange` declarat al final de la interfaz en lloc de després d'`onDelete`.
>
> >#### **Pla (ja implementat):**
> >* **(a) Typo:** `l'app corra` → `l'app corre` al comentari de `handleToggleSelect`. Només comentari.
> >* **(c) Lazy init:** `useState<Set<number>>(new Set())` → `useState(() => new Set<number>())`. El tipus `Set<number>` continua inferint-se de l'inicialitzador, així que no cal el genèric explícit.
> >* **(d) Ordre de la interfície:** `onSegmentsBatchChange` (amb el seu JSDoc) mogut de l'última posició de `SubtitlesEditorProps` a just després d'`onDelete`, amb la resta de callbacks d'edició de segments. Cap canvi de comportament: és una interfície, no un objecte posicional.
> >* **(b) Diana del checkbox (l'únic canvi amb efecte real):** el handler de toggle s'ha afegit al **div interior del canal** (el que té l'alçada d'una fila), no al canal sencer — així la diana no s'estén verticalment per sota del checkbox en blocs multi-línia. Detall clau: aquest div viu dins d'un pare `flex flex-col items-center`, o sigui que **s'encongia a l'amplada del seu contingut (15px)**; calia `w-full` perquè ocupés de veritat els 22px del canal. El botó de 14px ja fa `stopPropagation()` al seu `onClick`, de manera que un clic directe a sobre **no** dispara també el handler del div (cap doble toggle). S'hi replica el `onMouseDown → preventDefault()` del botó perquè el Maj+clic no seleccioni text ni robi el focus.
>
> >#### **Arxius afectats:**
> >* `frontend/components/VideoSubtitlesEditor/SubtitlesEditor.tsx` (a, c, d) · `frontend/components/VideoSubtitlesEditor/SegmentItem.tsx` (b).
>
> >#### **Verificació feta:**
> >* `npx tsc --noEmit` net. **Atenció:** el frontend no té `@types/react` (això és precisament SPS-0021), així que el typecheck aquí val poc — per això s'ha verificat al navegador.
> >* **App real** (Vite + NestJS + Mongo/Redis), editor de subtítols obert amb un SRT de 5 blocs. Mapa de *hit-testing* (`document.elementFromPoint`) de tot el canal: **cada píxel** dels 22×25 respon ara (diana ampliada o botó); abans només els 15×15 centrals. La zona morta ha desaparegut.
> >* **Toggle pel canal:** clic a (x = botó − 2px), fora del botó → el bloc es selecciona; segon clic → es deselecciona.
> >* **Maj+clic pel canal:** clic normal al canal del bloc 1 + Maj+clic al canal del bloc 4 → rang 1–4 seleccionat, comptador "4 sel." correcte a la barra. La selecció de rang **no** ha regressat.
> >* **Cap doble toggle:** clic directe sobre el botó de 14px continua fent un sol canvi d'estat (`aria-pressed` false→true).
>
> >>##### **Risc:** 2/10 *(orig.: «bajo»)*
> >>##### **Dimensions:** 2/10 *(orig.: «pequeño»)*
> >>##### **Prioritat:** ⭐ (no consta)
>
> >#### **Tasques a realitzar per part de l'usuari ABANS de donar-ho per tancat:**
> > * Judici de gust (això sí que no ho puc decidir jo): amb la diana ampliada als 22px, ¿el checkbox es clica **còmodament** amb ratolí real, o ara és **massa fàcil** seleccionar un bloc sense voler quan apuntes a la vora esquerra de la fila? [__]
> > * Decidir commit. [__]
>
> ---

> ---
> ## **SPS-0017. SrtPreviewView: renderitzar tags SRT en comptes de mostrar-los literals**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-14] | [11:26:05]*
>
> >#### **Síntoma / Context:**
> >* *(abans: pendent #4)* La vista prèvia de fitxers SRT de la biblioteca (`SrtPreviewView.tsx`) mostrava el text cru: un bloc en cursiva es veia com a `<i>Hola</i>` literal. Preexistent, però ara més visible perquè el format en lot (SPS-0003) fa més habituals els tags.
>
> >#### **Pla (ja implementat):**
> >* **Render:** `plainToRich` + `dangerouslySetInnerHTML`, el mateix patró que ja fan servir `VideoPlayer.tsx` i `SegmentItem.tsx`. És segur: `plainToRich` escapa `&`, `<` i `>` **primer** i només re-emet els sis literals exactes `<i>`, `</i>`, `<b>`, `</b>`, `<u>`, `</u>` — no admet atributs, així que `<i onclick=…>` o `<script>` queden escapats com a text.
> >* **`plainToRichLines(text)` (nova, a `richTextHelpers.ts`):** la còpia literal del patró de `VideoPlayer` tenia un forat — partir per `\n` i cridar `plainToRich` **per línia** trenca la forma en bloc `<i>línia1\nlínia2</i>` (la línia 2 perd la cursiva perquè el seu `</i>` orfe el descarta el parser d'HTML). El helper porta una pila dels tags oberts i els **reobre** al principi de cada línia (i els tanca al final), de manera que cada línia és HTML balancejat i autònom.
> >* **Filtre:** passa a comparar contra `toVisibleText(...)` (helper canònic que ja fa servir la cerca de l'editor, `searchReplace.ts`) en lloc del text cru. Un cop els tags deixen de veure's, filtrar pel text cru era incoherent: `gran dia` no trobava `El <b>gran</b> dia`, i escriure `i` cassava amb **tots** els subtítols en cursiva.
> >* Les línies 2+ es fusionen en una sola fila unides amb **espai**, no amb `\n` (que `plainToRich` convertiria en `<br>` i faria créixer la fila de 22px d'alçada fixa). Visualment idèntic al d'abans: `white-space: nowrap` ja col·lapsava el `\n` a espai.
>
> >#### **Arxius afectats:**
> >* `frontend/components/VideoSubtitlesEditor/SrtPreviewView.tsx` · `frontend/utils/SubtitlesEditor/richTextHelpers.ts` (nova funció exportada; `plainToRich` i `richToPlain` **no** s'han tocat → cap efecte sobre l'editor).
>
> >#### **Verificació feta:**
> >* `tsc --noEmit` net.
> >* **Navegador, component REAL servit per Vite** (harness temporal, ja esborrat), amb un SRT de 9 casos: cursiva simple ✓ · **forma en bloc** `<i>l1\nl2</i>` → **les dues** línies en cursiva ✓ · niuat `<b><i>…` a cavall de dues línies ✓ · negreta i subratllat ✓ · subtítol de 3 línies ✓.
> >* **XSS:** `<img src=x onerror=…>` i `<script>` es mostren com a **text literal**; cap `<img>`/`<script>` injectat al DOM i cap dels dos flags globals executat. Caràcters literals `& < >` correctes.
> >* **Layout:** les 9 files mantenen exactament la mateixa alçada (64px) → cap `<br>` s'escapa i el truncat amb el·lipsi segueix funcionant.
> >* **Filtre:** `gran dia` ara troba `El <b>gran</b> dia` (abans, 0 resultats); buscar `<i>` dona 0 resultats (abans, 3 falsos positius).
>
> >>##### **Risc:** 2/10 *(orig.: «bajo»)*
> >>##### **Dimensions:** 2/10 *(orig.: «pequeño»)*
> >>##### **Prioritat:** ⭐ (no consta)
>
> >#### **Tasques a realitzar per part de l'usuari ABANS de donar-ho per tancat:**
> > * Obrir un `.srt` **real des de la biblioteca** de l'app (vista prèvia) i confirmar que els tags es veuen renderitzats. No ho he pogut fer jo: cal backend + Mongo + login, i he verificat el component aïllat amb un harness. [__]
> > * Judici de gust: els tags **no canònics** (`<font color=…>`, `{\an8}`) segueixen sortint com a **text literal** — ho he deixat així a posta, per coherència amb l'editor de subtítols (decisió ja documentada a history.md:768). ¿Ho vols així, o prefereixes que la vista prèvia els **amagui**? [__]
> > * Decidir commit. [__]
>
> ---

> ---
> ## **SPS-0037. `SPLIT_AT_PLAYHEAD` (Ctrl+Shift+K) és una drecera morta**
> >> ###### [🗒️] *[2026-07-13] | [23:05:12]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-14] | [00:47:10]*
>
> >#### **Síntoma / Context:**
> >* Detectat revisant SPS-0016. L'acció `SPLIT_AT_PLAYHEAD` està declarada a `frontend/constants.ts` i `useKeyboardShortcuts.ts` li fa `preventDefault()` (o sigui, **es menja la tecla**), però **cap dels dos switch d'accions** (`VideoSubtitlesEditorView.tsx`, `VideoSrtStandaloneEditorView.tsx`) té el `case` corresponent: la drecera no fa absolutament res.
>
> >#### **Decisió presa (la fitxa demanava «implementar o retirar»):**
> >* **Implementar-la.** El cost era baix perquè SPS-0016 ja havia centralitzat la lògica de temps a `computeSplitTimes`, i la drecera ja hi era declarada i documentada de cara a l'usuari («Dividir al playhead»): retirar-la hauria estat treure una funció que l'usuari ja espera.
> >* **Semàntica adoptada:** el primer bloc acaba **exactament al playhead** i el segon arrenca un gap més tard (estil Subtitle Edit), amb la jerarquia de SPS-0016 intacta per sobre (**durada mínima > gap > punt exacte**). El text es reparteix pel punt lògic (salt de línia o espai) més proper a la **proporció del playhead dins del bloc** — no pel centre.
>
> >#### **Pla (ja implementat):**
> >* **`computeSmartSplit(text, targetRatio = 0.5)`**: el punt de tall del text ja no és sempre el centre, sinó el candidat més proper a `totalLen × targetRatio`. Amb el default, comportament idèntic al d'abans (botó S i Ctrl+K sense cursor no canvien gens). Els ratios extrems mai deixen una meitat buida.
> >* **`computeSplitTimes({ ..., cutTime? })`**: paràmetre nou de **punt de tall absolut** que mana sobre `ratio`. Necessari perquè el `ratio` s'aplica sobre la durada *útil* (total − gap) i el tall queia desplaçat fins a un gap sencer respecte del playhead — vegeu «El que NO ha funcionat» a history.md.
> >* **`handleSplitSegmentAtPlayhead`** a les dues vistes (+ `applySplit` extret a `useCallback` compartit amb el split pel cursor): busca el bloc que **conté** el playhead (lectura directa de `videoRef.current.currentTime`, com `handleSetTcIn`), i si no n'hi ha cap, no fa res. Si el text no admet divisió (buit, un sol caràcter), queda sencer al primer bloc.
> >* **Bug latent que ho hauria deixat inútil:** el handler de Ctrl+K del contenteditable de `SegmentItem` era `(ctrl||meta) && key==='k'` **sense mirar Shift**, i feia `stopPropagation()`. Amb el cursor dins del text, Ctrl+Shift+K mai hauria arribat al listener global: hauria dividit pel cursor. Afegida la guarda `!e.shiftKey`.
>
> >#### **Arxius afectats:**
> >* `frontend/utils/SubtitlesEditor/splitHelpers.ts` · `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` · `VideoSrtStandaloneEditorView.tsx` · `SegmentItem.tsx`. (`constants.ts` i `useKeyboardShortcuts.ts` no s'han hagut de tocar: la declaració ja hi era i era correcta.)
>
> >#### **Verificació feta:**
> >* `tsc --noEmit` net.
> >* **Navegador, mòdul REAL servit per Vite** (13 casos): default 0.5 idèntic a abans (cap regressió), ratio del playhead reparteix el text proporcionalment, ratios extrems (0.01/0.99) sense meitats buides, tags `<i>` reequilibrats a cavall del tall, text buit/1 caràcter → `null`, bloc massa curt → `null` (no-op).
> >* **Navegador, `SegmentItem` REAL + `useKeyboardShortcuts` REAL** (harness temporal, ja esborrat), amb el cursor DINS del contenteditable: Ctrl+K → split pel cursor amb payload i **cap** acció global (com abans); Ctrl+Shift+K → acció global `SPLIT_AT_PLAYHEAD` i **cap** split pel cursor.
> >* **Temps** (bloc 10→14 s, minDur 1 s, gap 160 ms): playhead 11,5 s → **11,500** + gap + 11,660 (tall exacte); playhead 13,0 s → 12,840 / **13,000** (la durada mínima del segon bloc mana, i el segon bloc arrenca igualment al playhead); playhead 10,1 s → 11,000 / 11,160 (mana la durada mínima del primer).
>
> >>##### **Risc:** 2/10 *(el camí del split pel cursor no canvia — mateixos números verificats; el nou camí és additiu)*
> >>##### **Dimensions:** 3/10 *(ja implementat)*
> >>##### **Prioritat:** ⭐⭐ (2/10 — una drecera que no fa res no molesta, però confon)
>
> >#### **Tasques a realitzar per part de l'usuari ABANS de donar-ho per tancat:**
> > * Provar Ctrl+Shift+K **a l'editor real amb vídeo** (no he pogut passar del login: cal backend + credencials). Amb el playhead dins d'un bloc, ha de dividir-lo pel playhead. [__]
> > * Provar-ho també a la **vista standalone** (`.srt` sol amb vídeo vinculat). [__]
> > * Judici de producte: quan el playhead cau **massa a prop d'una vora** del bloc, la durada mínima mana i el tall es desplaça (no cau on és la línia). ¿Ho prefereixes així, o que en aquest cas **no divideixi** i prou? [__]
> > * Judici de producte: el text es talla per la paraula més propera a la proporció del playhead. ¿Et va bé, o preferiries que el **text quedés sencer al primer bloc** i escriure el segon a mà? [__]
> > * Judici de gust: el segon bloc arrenca **un gap després** del playhead (el primer acaba exactament a la línia). L'alternativa seria centrar el gap sobre el playhead. [__]
> > * Decidir commit. [__]
>
> ---

> ---
> ## **SPS-0016. Split: respectar la durada mínima configurable (i el gap mínim)**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-13] | [22:46:54]*
>
> >#### **Síntoma / Context:**
> >* *(abans: pendent #3)* El split (per cursor o lògic) repartia la durada proporcionalment al text, però no comprovava `minDurationMs`: dividir un bloc curt creava dos blocs per sota de la durada mínima configurada (SPS-0001/T1 va cobrir els 6 punts d'enforcement existents; el split va quedar fora). Tampoc aplicava `minGapMs` entre les dues meitats (gap fix de 0.001 s).
>
> >#### **Decisió presa (la fitxa demanava «bloquejar o avisar»):**
> >* **Ni bloquejar ni degradar en silenci: es divideix sempre que sigui físicament possible, cedint primer el gap i després les durades, i es marca visualment el bloc que queda sota el mínim.** El bloqueig es va descartar perquè els editors de subtítols **no tenen cap canal de notificació** (no hi ha toasts): un botó que no fa res sense dir per què és pitjor que un resultat imperfecte però visible.
> >* **Jerarquia d'invariants adoptada** (llegida del comportament que ja tenien els 6 punts d'enforcement): **no-solapament > durada mínima > gap mínim**. Amb els defaults (1000 ms / 160 ms) un bloc necessita 2160 ms per satisfer-ho tot, i la majoria de subtítols reals en fan menys — per això importa qui cedeix primer.
>
> >#### **Pla (ja implementat):**
> >* **`computeSplitTimes`** (funció pura nova a `splitHelpers.ts`), única font de veritat per als **4 camins** de split (2 vistes × payload del cursor / fallback lògic). Càlcul en **mil·lisegons sencers** (els timecodes SRT tenen resolució de ms). Si no hi caben `2 × minDur + gap`: primer s'encongeix el gap (fins a 1 ms — mai 0), i només llavors es degraden les dues durades per igual amb pis absolut `MIN_SEG_DURATION_MS`. `ratio` clampat a [0,1]. Retorna `null` si el bloc no admet ni dues meitats del pis absolut. `endTime` del bloc original no es toca mai → el buit amb el subtítol següent queda intacte.
> >* **Fuita col·lateral tancada:** `handleSegmentChange` (les dues vistes) clampava el final contra el veí i tot seguit l'estirava incondicionalment a `startTime + minDur` → **qualsevol bloc sota el mínim es menjava el següent a la primera tecla**. Ara l'estirada queda limitada per la frontera del veí.
> >* **Marcador de validació:** `SegmentItem` tenyeix la columna de timecodes de vermell (+ tooltip amb el mínim configurat) quan la durada queda sota el mínim — mateix idioma visual que l'alerta de caràcters per línia. Cap component nou.
> >* Guarda `isEditing` afegida també al camí del payload (abans només la tenia el fallback).
>
> >#### **Arxius afectats:**
> >* `frontend/utils/SubtitlesEditor/splitHelpers.ts` (nova funció pura) · `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` · `VideoSrtStandaloneEditorView.tsx` · `SegmentItem.tsx`.
>
> >#### **Verificació feta:**
> >* **78/78 asserts** de lògica pura (tsc + node): ratio 0/1/fora de rang, gap encongit, degradació uniforme, config extrema (minDur 5000 / minGap 0 / minGap 1000), bloc degenerat → null, quantització a ms.
> >* `tsc --noEmit` net · `vite build` net.
> >* **Navegador amb la vista REAL** (harness temporal sense backend, ja esborrat): 5 s → 2466 + **gap 160** + 2374 · 2,1 s → **1000 + gap 100 + 1000** (cedeix el gap, no les durades) · 1,5 s → 750 + 1 + 749, marcats en vermell. Escrivint dins d'una meitat degradada, el final s'atura a l'inici del següent − gap en comptes de solapar.
>
> >>##### **Risc:** 3/10 *(toca els 4 camins de split i un dels 6 punts d'enforcement de SPS-0001; verificat a la vista real, però no s'han exercitat els fluxos de guió/takes)*
> >>##### **Dimensions:** 3/10 *(ja implementat)*
> >>##### **Prioritat:** ⭐⭐⭐ (3/10 — correcció d'invariant, no bloquejant)
>
> >#### **Tasques a realitzar per part de l'usuari ABANS de donar-ho per tancat:**
> > * Provar el split **amb el cursor dins el text** (Ctrl+K i botó S amb el caret col·locat): la verificació automàtica va exercitar sobretot el fallback lògic. [__]
> > * Provar-ho també a la **vista standalone** (obrir un `.srt` sol, sense vídeo). [__]
> > * Judici de gust: el **vermell de la columna de timecodes** quan un bloc queda sota el mínim — ¿és prou visible sense ser molest?, ¿o preferiries un altre senyal (p. ex. la durada en vermell, com el CPS)? [__]
> > * Judici de producte: en un bloc massa curt, ara el split **el divideix igualment** (durades degradades, marcades en vermell). ¿Prefereixes que en aquest cas **no divideixi** i prou? [__]
> > * Decidir commit. [__]
>
> ---

> ---
> ## **SPS-0036. El `React.memo` de l'ona tampoc bloqueja al pare PRINCIPAL: `useDocumentHistory` retorna un objecte nou a cada render**
> >> ###### [🗒️] *[2026-07-13] | [17:58:41]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-13] | [22:31:44]*
>
> >#### **Síntoma / Context:**
> >* Descobert en implementar SPS-0035. La premissa d'aquella fitxa («al pare principal el bail-out funciona») era **falsa**: el memo no ha bloquejat **mai, enlloc**, i el comparador que SPS-0034 va sanejar era **codi que no s'havia exercitat mai en producció**.
> >* Causa arrel: `useDocumentHistory` (`frontend/hooks/useDocumentHistory.ts:108-119`) retorna un **objecte literal nou a cada render**. Els seus mètodes sí que són estables (`updateDraft` = `useCallback([])`, `commit` = `useCallback([draft])`), però l'embolcall no. A `VideoSubtitlesEditorView` els **6 handlers que el comparador compara** portaven tots `subsHistory` (l'objecte) a les deps → identitat nova a cada render → el comparador retornava sempre `false`.
> >* **Reproduït al pare REAL abans de tocar res** (veure «Mesura»): 99 renders del pare durant 26 s de reproducció → **99 renders de l'ona**. 1:1.
>
> >#### **Via triada: (ii) — mateix fix que SPS-0035, aplicat al pare principal.**
> >* **(i) `useMemo` al `return` de `useDocumentHistory` → DESCARTADA.** No pel motiu que deia la fitxa original (`isDirty` → factory reset; amb deps completes no es congelaria), sinó perquè el hook té **4 call-sites** — les dues vistes de subtítols **i `App.tsx` × 2, l'editor de guió** — i **36 dep-arrays** en consumeixen el retorn. Avui es recreen a cada render, cosa que **emmascara deps incompletes**; estabilitzar l'objecte les congelaria **totes de cop i en silenci**, i el frontend **no té eslint** que pogués agafar-ne cap. Radi d'impacte molt superior al problema (regla e).
> >* **(iii) treure el memo → no feta, però segueix disponible.** Ara amb la mesura a la mà: veure «Guany real» i la tasca de decisió de sota.
>
> >#### **Pla (ja implementat):**
> >* Els 6 handlers comparats (`handleCueStart`, `handleCueEnd`, `handleCueStartKeepDuration`, `handleRippleFromCue`, `handleSegmentUpdate`, `handleSegmentUpdateEnd`) depenen ara dels **mètodes** (`subsHistory.commit` / `.updateDraft`). Els **15** dep-arrays restants del fitxer segueixen amb l'objecte **a posta**: ningú els compara (teclat, split, merge, insert, delete, batch, save) i tocar-los seria radi d'impacte per res. Un comentari al costat dels 6 explica la convivència dels dos estils (com al standalone).
> >* `WaveformTimeline.tsx`: **només el comentari** del comparador (cap canvi de lògica). Deia que «les props de callback NO hi són a propòsit» quan el codi de sota **en compara 8**. Ara distingeix els dos grups: les **8 d'interacció** (s'han de comparar; el preu és que els pares les mantinguin estables) i les **7 de la toolbar** (fora a propòsit; el que les manté fresques és comparar el *valor d'estat que capturen*). S'hi afegeixen les dues excepcions que feien la «regla 1» literalment falsa (`videoRef`, `currentTime`).
>
> >#### **Mesura (amb la vista REAL, no un pare sintètic):**
> >* Harness que munta `VideoSubtitlesEditorView` **de debò** dins dels providers reals, sense backend, amb un WAV de 30 s injectat pel camí real del `syncRequest`. 26 s de reproducció real, 4 subtítols, comptadors de render temporals (retirats en acabar; `git diff` comprovat):
> >   * **ABANS:** 99 renders del pare → **99 de l'ona** (memo mort).
> >   * **DESPRÉS:** 99 renders del pare → **5 de l'ona**: **1 per frontera de subtítol i 0 entremig**. És el màxim assolible — la resta de re-renders els provoca `activeId`, que **ha** de propagar-se.
> >* **El criteri «bloquejar el 100 % dels ticks» (el que deia SPS-0035) és FALS al pare real**: `handleTimeUpdateThrottled` fa `setActiveSegmentId` a cada frontera quan `syncSubsEnabled` (per defecte true) i `activeId` és una prop comparada.
> >* **L'edició NO queda congelada** (el risc de la fitxa): amb el memo actiu i el vídeo en marxa, arrossegar un bloc el mou (00:00:02,000 → 00:00:02,420), habilita **Desfer** (arriben `onSegmentUpdate` **i** `onSegmentUpdateEnd`), l'ona es re-renderitza 9 cops **durant** el drag i, en deixar anar, **torna a bloquejar el 100 %** dels ticks.
> >* **Guany real: petit.** S'estalvien ~4 passades de VDOM per segon de reproducció; el canvas no es redibuixava en cap d'elles. Es fa perquè un comparador que **no bloqueja mai** és pitjor que no tenir-ne (qualsevol lector assumeix que funciona), no per FPS.
>
> >#### **Arxius afectats:**
> >* `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` (6 dep-arrays + comentari) · `frontend/components/VideoEditor/WaveformTimeline.tsx` (**només el comentari** del comparador).
>
> >>##### **Risc:** 3/10 *(activa un bail-out que no havia saltat mai a l'editor principal; auditat per 4 revisions independents i mesurat al navegador amb la vista real, però els fluxos de guió/correccions/takes no s'han exercitat)*
> >>##### **Dimensions:** 3/10 *(ja implementat)*
> >>##### **Prioritat:** ⭐⭐ (2/10 — rendiment, no correcció)
>
> >#### **⚠️ Dependència dura d'ordre (igual que SPS-0035):**
> >* El comparador de **HEAD** encara no compara `autoScroll` / `minGapMs` / `minDurationMs` — això ho porta el diff **no commitejat** de SPS-0034. Aquest canvi **no pot anar sol**: ha d'anar al mateix commit que SPS-0034 (i, per coherència, SPS-0035), o el bail-out s'activa amb la llista vella i el bug de SPS-0034 passa de teòric a real.
>
> >#### **Tasques a realitzar per part de l'usuari ABANS de donar-ho per tancat:**
> > * Provar l'**editor principal a l'app real** amb un projecte de debò: sincronització amb el guió (takes, scroll lligat), correccions/insercions pendents acceptades **mentre el vídeo va**, `useResumePosition`, i la toolbar de l'ona (autosave, seguiment, mode de scroll, desar, exportar). El harness exercita el memo, **no** aquests fluxos. [__]
> > * Comprovar que el playhead i el recentratge segueixen igual que abans durant la reproducció. [__]
> > * **No commitejar sense SPS-0034** (veure «Dependència dura»). [__]
> > * **Decidir la sortida final**, ara amb la mesura a la mà: mantenir el memo (aquest canvi) o **treure'l** (via iii — reversió petita: 6 deps aquí + 6 al standalone + el comparador). El guany mesurat és ~4 passades de VDOM/segon, sense impacte en FPS. [__]
> > * Esborrar els harness temporals quan ja no calguin: `frontend/__wave_harness.{html,tsx}` (SPS-0035) i `frontend/__main_wave_harness.{html,tsx}` (SPS-0036) — untracked, no els he esborrat jo. [__]
>
> >**Detall a** history.md (H-00021)
>
> ---

> ---
> ## **SPS-0035. Al `VideoSrtStandaloneEditorView` el `React.memo` de l'ona no bloqueja mai (sis handlers amb identitat nova cada render)**
> >> ###### [🗒️] *[2026-07-13] | [16:12:07]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-13] | [17:41:05]*
>
> >#### **Síntoma / Context (corregit respecte a la fitxa original):**
> >* El comparador del `React.memo` de `WaveformTimeline` compara **8 props de callback**. Al standalone cap dels 6 que hi passa el pare tenia identitat estable → el comparador retornava sempre `false` → **el memo era mort**: l'ona es re-renderitzava a cada tick de `currentTime` (250 ms) durant la reproducció.
> >* La fitxa original en culpava **dos** (`handleSegmentUpdate`, funció plana; `onSegmentUpdateEnd`, arrow inline). En realitat en són **sis**: els 4 cue handlers (`handleCueStart`/`handleCueEnd`/`handleCueStartKeepDuration`/`handleRippleFromCue`) sí que eren `useCallback`, però amb **l'objecte `subsHistory` a les deps** — i `useDocumentHistory` en retorna un **literal nou a cada render**, o sigui que la memoització no servia de res.
> >* La fitxa original també afirmava que «al pare principal el bail-out funciona». **És fals**: allà els 6 handlers equivalents tenen exactament el mateix problema (`subsHistory` a les deps). El memo **no ha bloquejat mai, enlloc** → registrat com a **SPS-0036**.
>
> >#### **Mesura (la fitxa demanava «no obrir-ho si no es nota»):**
> >* **Mesurat al navegador** amb un harness que munta el `WaveformTimeline` **real** (export memoitzat) i el `useDocumentHistory` **real**, simulant el pare standalone (tick de `currentTime` cada 250 ms, `isPlaying=true`). Finestra de 4 s:
> >   * **Cablejat d'ABANS:** 16 renders del pare → **16 renders de l'ona** (1:1 — el memo no bloquejava mai).
> >   * **Cablejat de DESPRÉS:** 16 renders del pare → **0 renders de l'ona** (bloqueja el **100 %** dels ticks).
> >* **Quant val, doncs?** Poc en CPU: `WaveformTimeline` no té cap `.map()` ni `useMemo` al render (els segments es pinten al **canvas**, no al DOM) i el redibuix penja d'efectes amb deps estables durant un tick → **el render que s'estalvia no redibuixava el canvas**. S'estalvien ~4 passades de VDOM per segon de reproducció, no FPS.
> >* Es fa igualment perquè el cost és de 6 línies i deixar viu un comparador que **no bloqueja mai** (i que SPS-0034 acaba de sanejar i documentar) és pitjor: qualsevol lector assumeix que funciona. Si es prefereix l'altra sortida coherent —treure el memo—, és la via (iii) de SPS-0036.
>
> >#### **Pla (ja implementat):**
> >* Els 6 handlers depenen ara dels **mètodes** (`subsHistory.commit`, `subsHistory.updateDraft`), que sí són estables, en lloc de l'**objecte**. `handleSegmentUpdate` passa a `useCallback`; l'arrow inline `onSegmentUpdateEnd={() => subsHistory.commit()}` passa a ser un `handleSegmentUpdateEnd` memoitzat amb la guarda `if (!isEditing) return` (simetria amb el pare principal; és un no-op funcional perquè `commitHistory` ja descarta un draft idèntic).
> >* `WaveformTimeline.tsx` **no s'ha tocat**.
> >* **Auditoria d'allò que podria quedar ranci en activar el bail-out** (dues revisions independents, cap troballa MAJOR): tots els refs que `WaveformTimeline` assigna al render deriven de props **comparades** (`segments`, `activeId`, `scrollMode`, `autoScroll`) o d'estat intern; `minDurMsRef` té dep comparada; `currentTime` només s'usa en dos efectes **guardats per `isPlaying`** (durant el play mana el RAF, que llegeix `videoRef.current.currentTime`). Les 7 props de callback **no** comparades (toolbar) capturen estat que sí es compara (`autosaveEnabled`, `autoScrollWave`, `canUndo`/`canRedo`) o criden mètodes estables (`undo`/`redo`).
> >* **Invariant que sosté la seguretat del bail-out** (escriure-ho aquí perquè és silenciós si algú el trenca): `segments` **és exactament** `subsHistory.present` === `draft` (la mateixa referència). És això el que manté fresc l'`onSave` de l'ona, que **no** es compara: mentre el memo bloqueja, `draft` no pot haver canviat. Si algú fa que `segments` passi a ser un array derivat/copiat, el botó Desar de l'ona podria persistir un draft ranci **sense cap error visible**.
>
> >#### **Dependència dura amb SPS-0034 (⚠️ ordre de commit):**
> >* El comparador de **HEAD** encara **no** compara `autoScroll`, `minGapMs` ni `minDurationMs`: això ho afegeix el diff **no commitejat** de SPS-0034. Si SPS-0035 es commiteja **sense** SPS-0034, el bail-out s'activa amb el comparador vell → `minDurMsRef` i `followEnabledRef` rancis durant la reproducció, que és exactament el bug de SPS-0034 però ara **viu**. **SPS-0035 no pot anar sola.**
>
> >#### **Arxius afectats:**
> >* `frontend/components/VideoSubtitlesEditor/VideoSrtStandaloneEditorView.tsx` (únic fitxer).
>
> >>##### **Risc:** 3/10 *(activa un bail-out que no havia saltat mai; auditat, però no exercitat encara al navegador)*
> >>##### **Dimensions:** 2/10 *(ja implementat)*
> >>##### **Prioritat:** ⭐⭐ (2/10 — rendiment, no correcció)
>
> >#### **Verificació ja feta (no cal repetir-la):**
> >* `tsc --noEmit` net — i **insuficient per si sol** (l'objectiu és una propietat de runtime).
> >* Harness al navegador amb el component real: el memo passa de bloquejar **0 %** a **100 %** dels ticks (números a «Mesura»). El test és **capaç de fallar**: amb el cablejat vell reprodueix el bug.
> >* **L'edició no queda congelada pel bail-out** (era el risc de la fitxa). Amb el memo actiu i el vídeo «en marxa», arrossegar un bloc dona **10 `onSegmentUpdate` + 1 `onSegmentUpdateEnd`**, el bloc es mou (0 → 0,72 s), `canUndo` passa a cert, l'ona es re-renderitza **11 cops durant el drag** i, en deixar anar, **torna a bloquejar el 100 %** dels ticks. Exactament el comportament desitjat.
>
> >#### **Tasques a realitzar per part de l'usuari ABANS de donar-ho per tancat:**
> > * Provar-ho a l'**app real** (el harness feia servir un pare sintètic i un vídeo fals): al standalone amb un vídeo de debò **en marxa**, arrossegar/redimensionar un bloc, modificador+clic per fixar les 4 cues, undo/redo, i els botons de la toolbar de l'ona (autosave, seguiment, mode de scroll, desar). El playhead i el recentratge han de seguir igual que abans. [__]
> > * **No commitejar aquest canvi sense el de SPS-0034** (veure «Dependència dura» a dalt). [__]
> > * Decidir si es tira endavant amb SPS-0036 (mateix problema al pare principal) o si, vist que el guany mesurat és petit, es prefereix treure el memo del tot. → **SPS-0036 ja s'ha implementat** (via ii); la decisió de treure el memo del tot segueix oberta, ara amb la mesura del pare real a la mà. [__]
>
> >#### **⚠️ Correcció (2026-07-13, en implementar SPS-0036):**
> >* El «**100 % dels ticks**» que aquesta fitxa dona per mesurat és un **artefacte del harness sintètic**: el pare simulat no reproduïa la sincronització del segment actiu per temps. A l'app real, `syncSubsEnabled` (per defecte true) fa `setActiveSegmentId` a cada frontera de subtítol i `activeId` **és una prop comparada** → el bail-out correcte és «0 renders entre fronteres, **1 per frontera**», també aquí. No invalida el fix (mesurat al pare real a SPS-0036), sí el número. Detall a `history.md` (H-00021).
>
> ---

> ---
> ## **SPS-0034. El comparador de `React.memo` de l'ona s'empassa canvis de `minGapMs` / `minDurationMs` durant la reproducció**
> >> ###### [🗒️] *[2026-07-13] | [12:40:39]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-13] | [16:04:18]*
>
> >#### **Síntoma / Context:**
> >* Detectat per la revisió adversarial de SPS-0030 (preexistent, fora d'abast allà). El comparador de `React.memo` de `WaveformTimeline.tsx` només es dispara `if (prev.isPlaying && next.isPlaying)`, i a la seva llista **no hi ha** `minGapMs` ni `minDurationMs`. Si l'usuari els canvia a Settings **mentre el vídeo es reprodueix**, el bail-out impedeix el re-render → l'efecte que sincronitza `minDurMsRef` no s'executa i `gapSec`/`getNeighborBounds` es queden amb el valor antic. Conseqüència: redimensionar o moure un esdeveniment a l'ona aplica **el mínim ranci** fins que un altre canvi de prop forci el re-render. En pausa no passa (el comparador retorna `false` i sempre re-renderitza).
>
> >#### **Pla (ja implementat):**
> >* Afegides `prev.minGapMs === next.minGapMs && prev.minDurationMs === next.minDurationMs` al comparador. Mateixa classe de bug que la que SPS-0030 va tancar per a `autoScroll`.
> >* **Repàs sencer de la llista** (el que demanava la fitxa). De les 35 props de la interfície, el comparador en mirava 21; en queden fora, i és **correcte** que hi quedin:
> >   * `currentTime` — és el motiu de ser del memo (el playhead el pinta el RAF llegint `videoRef`, no el render).
> >   * `isPlaying` — el cobreix la guarda `prev.isPlaying && next.isPlaying`: si canvia, un dels dos és fals i es re-renderitza.
> >   * `videoRef` — `RefObject` d'un `useRef` del pare: identitat estable per contracte de React.
> >   * `viewMode` / `onToggleViewMode` — declarades a la interfície però **mai desestructurades**: props mortes (ja inventariades a SPS-0031). Comparar-les faria re-renders per res.
> >   * **Les props de callback** (`onUndo`, `onRedo`, `onToggleAutoScrollWave`, `onToggleAutosave`, `onSave`, `onExportSrt`, `onScrollModeChangeWave`) — els pares en passen d'**inline** (`onUndo={() => subsHistory.undo()}`), amb identitat nova a cada render; comparar-les desactivaria el memo a cada tick. El que les manté fresques és que **el comparador ja mira el valor d'estat que capturen** (`canUndo`/`canRedo`, `autosaveEnabled`, `autoScrollWave`…): si canvia, hi ha re-render i els botons es reconstrueixen amb la closure nova. Aquest disseny (comparar el valor capturat, no la closure) queda ara escrit en un comentari sobre el comparador, perquè és justament el que fa que la llista sembli incompleta quan no ho és.
> >* La conclusió del repàs és que **`minGapMs` i `minDurationMs` eren les dues úniques absències reals**. La tercera troballa del repàs (el memo mai bloqueja al pare standalone) no és d'aquesta fitxa: registrada com a **SPS-0035** a PENDENTS.
>
> >#### **Arxius afectats:**
> >* `frontend/components/VideoEditor/WaveformTimeline.tsx` (únic fitxer; només el comparador del `React.memo` + el comentari que n'explica la regla. Cap prop nova → els dos pares no s'han tocat).
>
> >>##### **Risc:** (no aplica — ja implementat; `tsc --noEmit` net. **Sense verificació al navegador:** cal reproduir vídeo i canviar el mínim a Settings a mig play → va a les tasques de l'usuari)
> >>##### **Dimensions:** (no aplica — ja implementat)
> >>##### **Prioritat:** ⭐⭐ (2/10 — cal canviar els mínims just mentre es reprodueix; sense pèrdua de dades, però aplica una regla que l'usuari ja no té configurada)
>
> >#### **⚠️ Correcció (2026-07-13, en implementar SPS-0035):**
> >* Aquesta fitxa donava per fet que **al pare principal el memo sí que bloqueja**. **És fals**: allà els 6 handlers que el comparador compara porten l'objecte `subsHistory` a les deps, i `useDocumentHistory` en retorna un **literal nou a cada render** → el comparador retorna sempre `false`. **El bail-out no ha saltat mai, en cap de les dues vistes**, i per tant el bug que aquesta fitxa arregla **no es podia manifestar** encara. Això no invalida el fix (és correcte i necessari: sense ell, activar el bail-out desperta el bug de debò), però sí la seva **verificació**: tal com estava escrita, hauria «passat» igual abans i després del canvi. Detall a `history.md` (H-00020); continuació a **SPS-0036**.
> >* Conseqüència pràctica: **SPS-0035 depèn d'aquesta fitxa.** Si es commiteja SPS-0035 sense aquest comparador, el bail-out s'activa al standalone amb la llista vella (sense `minGapMs`/`minDurationMs`/`autoScroll`) → el bug d'aquesta fitxa passa a ser **real**.
>
> >#### **Tasques a realitzar per part de l'usuari ABANS de donar-ho per tancat:**
> > * Verificar a l'**app real, a la vista STANDALONE** (que, un cop aplicat SPS-0035, és **l'única on el memo bloqueja de debò**; a la principal el test no prova res fins que es faci SPS-0036): posa el vídeo **a reproduir**, canvia `minDurationMs` a Settings **sense pausar**, i tot seguit redimensiona un esdeveniment a l'ona → ha d'aplicar el mínim **nou**. Repetir amb `minGapMs` i un esdeveniment enganxat al veí. [__]
> > * Comprovar de passada que la reproducció **no s'ha tornat més lenta** (el canvi no hauria d'afegir re-renders: `minGapMs`/`minDurationMs` només canvien quan l'usuari toca Settings). [__]
> > * Decidir si commitejar el fix (1 fitxer: `WaveformTimeline.tsx`; sense commitejar per la regla a de la Part I). **Ha d'anar al mateix commit que SPS-0035, o abans.** [__]
>
> ---

> ---
> ## **SPS-0033. El hit-test de l'ona només mira la X (regla i barra de scroll inclosos)**
> >> ###### [🗒️] *[2026-07-13] | [11:56:32]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-13] | [14:33:53]*
>
> >#### **Síntoma / Context:**
> >* Detectat per la revisió adversarial de SPS-0029. `hitTestSegment` només compara la coordenada X: qualsevol punt de la columna vertical d'un segment hi encerta, incloent-hi la **regla de timecodes** (els 22 px de dalt, `RULER_H`) i la **barra de scroll horitzontal** de sota. Conseqüència: prémer i arrossegar sobre la regla o sobre la barra de scroll damunt d'un segment pot **moure'l**; i arrossegar la barra de scroll en espai buit fa scrub. Preexistent.
> >* **Reproduït al navegador abans de tocar res** (harness amb el component real + gestos de Playwright): amb el hit-test cec a la Y, arrossegar 100 px sobre la **regla** damunt d'un subtítol dona **10 `onSegmentUpdate` + 1 `onSegmentUpdateEnd`** — el subtítol es mou i es **compromet a l'historial**; arrossegar la **barra de scroll** fa **seek**; i el **doble clic** sobre la regla o la barra **selecciona** l'esdeveniment de sota.
> >* Geometria mesurada a l'app (visor de 900×120): `scrollRef` ocupa **tota** l'alçada (120 px) però `clientHeight` és **110** → la barra de scroll nativa (`scrollbar-width: thin`) reserva una franja de **10 px** de layout, i el canvas —que és `pointer-events-none` i es pinta a sobre— hi dibuixa **a sota**. Per això la franja és invisible però **interactiva**.
>
> >#### **Pla (ja implementat):**
> >* **Partició per zones** (`zoneAt(clientY)` → `ruler` | `content` | `scrollbar`): `y < RULER_H` = regla; `y >= sc.clientHeight` = barra de scroll (mesurada, no constant: quan l'ona hi cap sencera no hi ha barra i la franja val 0, sense zona morta). La **barra mana sobre la regla** si el visor s'estrenyés fins a solapar-les.
> >* `hitTestSegment(clientX, clientY)` retorna `null` fora de `content` → tanca alhora l'**armat del drag** (`handleMouseDown`) i el **cursor de hover**. La branca de hover **no** es filtra per zona amb un return anticipat: és qui neteja el cursor `grab`/`col-resize` en sortir d'un esdeveniment.
> >* **Barra de scroll:** `handleMouseDown` en surt d'hora sense armar **res** (ni latch, ni drag, ni scrub) → el mouseup veu `startedInWave === false` i no fa seek. Va **després** del filtre de botó (si anés abans, prémer el dret damunt la barra enmig d'un drag el consumiria → reobriria SPS-0032), i tanca amb `finishGesture()` i **no** amb un reset parcial: deixar `dragArmed` viu amb `mouseDownActive` fals **desactivaria la xarxa de seguretat** del mousemove (que mira `mouseDownActive`) sense aturar el drag (que no la mira) — el segment seguiria el punter amb el botó ja deixat anar.
> >* **Decisió sobre la regla (la que demanava la fitxa):** clic = **seek pur**, arrossegar = **scrub**, mai drag/resize/selecció — com la regla de timecodes de qualsevol editor. Surt de franc: allà `hit` és sempre `null`, o sigui que `dragSegIdRef` es queda buit i el gest cau a la branca d'scrub. Els **modificadors** (Shift/Ctrl/Alt+clic → fixar cues) hi segueixen actius a posta: actuen sobre l'esdeveniment **actiu**, no sobre el de sota el punter, i la regla és igualment un eix de temps.
> >* **Doble clic:** es filtra per la zona **latched** del **primer** clic (`firstClickZoneRef`), no per la Y viva del segon. Barrejar marcs obria les dues portes que la tasca tanca: prémer la regla i derivar 2 px avall (dins la distància de doble clic del SO) **seleccionava igualment**, i un doble clic legítim ran de la regla **es perdia**. Mateix principi de coherència de marc que SPS-0029.
>
> >#### **Arxius afectats:**
> >* `frontend/components/VideoEditor/WaveformTimeline.tsx` (únic fitxer; cap prop nova → els dos pares no s'han tocat). El comparador del `React.memo` **no** s'ha tocat: és SPS-0034.
>
> >>##### **Risc:** (no aplica — ja implementat; `tsc --noEmit` net, **10/10 assercions al navegador** amb el component real, i el control negatiu reprodueix el bug)
> >>##### **Dimensions:** (no aplica — ja implementat)
> >>##### **Prioritat:** ⭐⭐⭐ (3/10 — pot moure un subtítol sense voler, però cal apuntar a una franja estreta)
>
> >#### **Tasques a realitzar per part de l'usuari ABANS de donar-ho per tancat:**
> > * **Judici d'UX (només el pots fer tu):** la barra de scroll horitzontal és **invisible** (el canvas opac s'hi pinta a sobre) però ocupa 10 px reals a baix de l'ona. Ara ja no mou subtítols, però continua sent una franja on **la part baixa d'un subtítol no es pot agafar** (hi veus l'ona, i el clic va a la barra). Valorar si molesta prou per obrir una tasca nova: o bé **amagar-la** de debò (`scrollbar-width: none` — segueix scrollant amb roda/trackpad i per codi), o bé **fer-la visible** encongint el canvas 10 px. Cap de les dues entra en aquesta tasca (regla e: canvi mínim). [__]
> > * **Judici d'UX:** durant la **reproducció amb el seguiment actiu**, arrossegar la barra de scroll ja no fa seek (correcte) però el RAF loop torna a centrar la vista cada frame → la barra sembla que «no obeeix». És la semàntica del seguiment (SPS-0030: per moure't lliurement, apaga'l). Valorar si així està bé o si un gest a la barra hauria de suspendre el seguiment temporalment. [__]
> > * Verificar a l'**app real** amb ratolí físic: prémer i arrossegar sobre la **regla de timecodes** damunt d'un subtítol → ha de fer **scrub** (moure el cursor), mai moure el subtítol; doble clic a la regla → **no** ha de seleccionar-lo. [__]
> > * Decidir si commitejar el fix (1 fitxer: `WaveformTimeline.tsx`; sense commitejar per la regla a de la Part I). [__]
>
> **Detall a** `history.md` (**H-00019**).
>
> ---

> ---
> ## **SPS-0032. `handleMouseUp` de l'ona no filtra `e.button`**
> >> ###### [🗒️] *[2026-07-13] | [11:56:32]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-13] | [13:53:29]*
>
> >#### **Síntoma / Context:**
> >* Detectat per la revisió adversarial de SPS-0029 (no és cap dels seus 3 símptomes → fora d'abast allà). `handleMouseDown` filtra el botó (`if (e.button !== 0) return`), però `handleMouseUp` no. Si l'usuari manté premut el botó esquerre dins l'ona i prem/deixa anar el botó **dret** (a Windows el menú contextual surt al mouse-up), el handler consumeix el gest: fa el seek i reseteja tot l'estat d'interacció amb l'esquerre encara premut.
> >* **Reproduït al navegador abans de tocar res** (harness amb el component real + gestos de Playwright amb botó dret de veritat), i els dos símptomes són pitjors del que deia la fitxa: (a) **clic simple:** amb l'esquerre encara premut, el mouseup del dret **executa el seek** (mesurat: seek a 15,00 s abans que l'usuari deixés anar res); (b) **enmig d'un drag:** el mouseup del dret **compromet l'esdeveniment a l'historial** (`onSegmentUpdateEnd`) i **mata el drag** — l'usuari continua arrossegant amb l'esquerre premut i el subtítol ja no el segueix (es queda clavat a 8,50 s).
>
> >#### **Pla (ja implementat):**
> >* `if (e && e.button !== 0) return;` com a **primera línia** de `handleMouseUp` (simètric amb `handleMouseDown`). Verificat el punt que la fitxa demanava comprovar: **no s'empassa cap `onSegmentUpdateEnd()` degut** — en tornar abans, `dragMovedRef`/`dragSegIdRef` es conserven i el commit el fa el mouseup **de l'esquerre** (o el `mouseleave`), un sol cop.
> >* **Xarxa de seguretat obligatòria (no era a la fitxa; sense això el fix obria un forat pitjor):** un cop el mouseup filtra el botó, l'**únic** esdeveniment que tanca el gest és el mouseup de l'esquerre — i a Windows aquest es pot **perdre** (el menú contextual natiu del botó dret captura el ratolí mentre és obert). Un drag armat quedaria **enganxat al punter amb el botó ja deixat anar**. Per tancar-ho, `handleMouseMove` mira l'estat **viu** dels botons (`e.buttons & 1`): si el gest consta com a actiu però el primari ja no està premut, tanca el gest (commit del drag si s'havia mogut + reset). La neteja compartida s'ha extret a `finishGesture` (la mateixa que ja feia el `mouseleave`, ara reutilitzada — no duplicada).
>
> >#### **Arxius afectats:**
> >* `frontend/components/VideoEditor/WaveformTimeline.tsx` (únic fitxer; cap prop nova → els pares no s'han tocat).
>
> >>##### **Risc:** (no aplica — ja implementat; `tsc --noEmit` i `vite build` nets, **8/8 assercions al navegador** amb gestos reals de botó dret)
> >>##### **Dimensions:** (no aplica — ja implementat)
> >>##### **Prioritat:** ⭐⭐ (2/10 — cas rar, sense pèrdua de dades)
>
> >#### **Tasques a realitzar per part de l'usuari ABANS de donar-ho per tancat:**
> > * Verificar a l'**app real** amb **ratolí físic** (el harness no pot obrir el menú contextual **natiu** de Windows: Playwright dispara els esdeveniments DOM del botó dret, però el menú del SO no surt, i és precisament el menú qui pot empassar-se el mouseup de l'esquerre). Amb un subtítol a l'ona: prémer l'esquerre i **arrossegar-lo**, i sense deixar-lo anar fer **clic dret**; després deixar anar l'esquerre. Esperat: el subtítol **segueix el punter** fins que deixes anar l'esquerre, i **no** queda enganxat després. [__]
> > * Judici d'UX (només el pots fer tu): avui el clic dret sobre l'ona **no fa res** (ni menú contextual propi ni acció). Valorar si mereix un menú contextual real (tallar/dividir/esborrar l'esdeveniment sota el punter) — seria una tasca nova, no aquesta. [__]
> > * Decidir si commitejar el fix (1 fitxer: `WaveformTimeline.tsx`; sense commitejar per la regla a de la Part I). [__]
>
> **Detall a** `history.md` (**H-00018**).
>
> ---

> ---
> ## **SPS-0030. El botó «Seguiment» de l'ona és cosmètic (l'autoscroll no es pot desactivar)**
> >> ###### [🗒️] *[2026-07-13] | [10:42:34]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-13] | [12:40:39]*
>
> >#### **Síntoma / Context:**
> >* Descobert avaluant SPS-0015 (veure H-00015). `WaveformTimeline` declarava la prop `autoScroll` (L40) però **mai la desestructurava**, i el RAF loop condicionava l'autoscroll únicament a `isDraggingRef`. El botó «Seguiment» només canviava icona i estils. Resultat: **apagar el seguiment no aturava el desplaçament de l'ona** — precisament la vàlvula d'escapament que un usuari buscaria per interactuar amb una ona en moviment (relacionat amb SPS-0029).
>
> >#### **Pla (ja implementat):**
> >* **Què governa el botó (decisió, veure H-00017):** el «Seguiment» governa el **seguiment durant la reproducció** (el RAF loop). L'efecte d'autoscroll **en pausa** queda **intacte** a posta: no és seguiment, sinó **revelar** el cursor després d'un esdeveniment discret (només salta si el punt ja ha quedat FORA de la finestra). El pla original de la fitxa («probablement sí, inhibir-lo també») s'ha **descartat** durant la revisió: aquell efecte és qui rescata la vista en canviar el zoom, en saltar des de la llista o el teclat, en canviar de media i en restaurar la posició (SPS-0007). Inhibir-lo hauria creat tres bugs nous.
> >* `autoScroll` desestructurada amb default `true`; **una sola veritat** per al comportament i per a l'estat encès/apagat del botó (`followEnabled = autoScrollWave ?? autoScroll`) — si es llegissin props diferents, el botó podria tornar a mentir, que és exactament la classe de bug d'aquesta tasca. Mirallada a `followEnabledRef` (patró de `scrollModeRef`) i afegida a la guarda del RAF loop. `updatePlayheadPos` queda FORA de la guarda: el cursor continua actualitzant-se dins la vista congelada i s'amaga en sortir-ne.
> >* Les branques de dins del RAF (salt de pàgina / recentratge estacionari) queden **byte-idèntiques** — la línia que H-00016 protegeix explícitament no s'ha tocat.
>
> >#### **Arxius afectats:**
> >* `frontend/components/VideoEditor/WaveformTimeline.tsx` (únic fitxer; cap prop nova → els dos pares no s'han tocat).
>
> >>##### **Risc:** (no aplica — ja implementat; `tsc --noEmit` i `vite build` nets, 8/8 escenaris al harness i **verificat a l'app real** amb backend+Mongo, vídeo i ona de veritat)
> >>##### **Dimensions:** (no aplica — ja implementat)
> >>##### **Prioritat:** ⭐⭐⭐⭐⭐ (5/10 — control visible que menteix a l'usuari)
>
> >#### **Tasques a realitzar per part de l'usuari ABANS de donar-ho per tancat:**
> > * ~~Verificar a l'**app real** que el botó atura de veritat el desplaçament de l'ona.~~ **[✅ fet per la IA, 2026-07-13]** Provat a l'app real (stack sencer: Docker+Mongo, backend NestJS, frontend :3000, projecte amb SRT + vídeo + ona extreta), en **Duo + estacionari** i amb clics reals al botó: seguiment ON reproduint → la vista segueix el cursor (scroll 2363 → 2615 px); **seguiment OFF → la vista queda CONGELADA (2618 px) mentre el vídeo avança 4 s**; tornar-lo a encendre → recupera el cursor (2618 → 3160 px). El botó exposa `aria-pressed` coherent en tots dos estats.
> > * **Judici d'UX (només el pots fer tu — conseqüència acceptada conscientment):** amb el seguiment APAGAT i reproduint, si deixes que el cursor **surti de la finestra visible**, en prémer **pausa** la vista **salta** cap a ell (mesurat a l'app real: 14 s de reproducció congelada → el cursor surt de la vista → pausa = salt de **2322 px**). Si el cursor encara es veu, **no salta** (verificat: 6 s de deriva → cap salt). O sigui: la vista es desfà només quan ja havies perdut el cursor de vista. A zoom 100 px/s i una vista de ~1920 px això vol dir ~19 s de reproducció. És l'efecte de «revelar el cursor», deixat viu a posta perquè és qui rescata la vista en pausa (zoom, salt des de la llista, teclat…). Valorar si molesta prou: si sí, la mitigació és estreta — suprimir la revelació **només** en la transició `reproduint → pausa` amb el seguiment apagat (els quatre rescats en pausa hi sobreviuen). El cost és el documentat a «El que NO ha funcionat» d'H-00017: el senyal és la transició `isPlaying`, i una actualització **tardana** del `currentTime` escapçat pot colar-s'hi → el salt passaria **de vegades** (intermitent). [__]
> > * Valorar si el «Seguiment» hauria de **persistir** entre sessions (avui és `useState(true)`: sempre encès en obrir). ⚠️ Si algun dia es persisteix, cal revisar SPS-0007: obrir un projecte amb el seguiment apagat NO ha de deixar el cursor invisible. [__]
> > * Decidir si commitejar el fix (1 fitxer: `WaveformTimeline.tsx`; sense commitejar per la regla a de la Part I). [__]
>
> **Detall a** `history.md` (**H-00017**).
>
> ---

> ---
> ## **SPS-0029. Gestos de ratolí contra una vista en moviment durant la reproducció**
> >> ###### [🗒️] *[2026-07-13] | [10:42:34]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-13] | [11:56:32]*
>
> >#### **Síntoma / Context:**
> >* Descobert avaluant SPS-0015 (veure H-00015). Els handlers de ratolí de `WaveformTimeline` derivaven el temps del `scrollLeft` **viu**, i durant la reproducció el RAF loop l'escriu a 60 fps → el marc de coordenades es mou **enmig del gest**. Els 3 símptomes, que la fitxa original tenia només com a **anàlisi estàtica**, s'han **reproduït al navegador** abans de tocar res (harness amb el component real + vídeo simulat + gestos de Playwright; zoom 100 px/s, viewport 1000 px):
> >   1. **Doble clic en estacionari mentre reprodueix selecciona l'esdeveniment equivocat.** Mesurat: clicant a 380 px del centre, la vista salta −364 px entre el clic 1 i el 2 → selecciona un esdeveniment que l'usuari no ha assenyalat mai (o cap). A 350 px a la dreta: apuntava l'Event 7, seleccionava el 8. **Només encerta prop del centre horitzontal.** A més, el 2n clic feia un `onSeek` de brossa (clicat a 24,81 s → seek a 21,17 s).
> >   2. **Clic simple i modificador+clic (cues) arriben tard.** Mesurat: error = durada exacta de la pressió (+110 ms amb 100 ms de clic, +250 ms amb 250 ms). Només quan el clic comença en **espai buit**: si comença sobre un segment, el hold-timer arma el drag i `isDraggingRef` **congela l'autoscroll**, acotant l'error a ~50 ms (troballa nova, no registrada a la fitxa original).
> >   3. **Salt de pàgina enmig d'un clic.** Mesurat: el seek aterra **9,42 s** lluny del punt clicat.
> >* **Bug addicional trobat durant la reproducció** (mateixa arrel, no registrat abans): el mateix error de selecció existeix **en pausa i en mode pàgina** quan es fa doble clic a la **vora dreta** (>97% del viewport): allà qui mou la vista entre els dos clics no és el RAF sinó l'**efecte de pausa** (L452-459). És el bug d'H-00014 encara viu al 3% dret.
>
> >#### **Pla (ja implementat):**
> >* Tot el fix viu a la **capa de gest**. El **RAF loop NO s'ha tocat** (veure «El que NO ha funcionat» a H-00016: la finestra de gràcia `suppressRecenterUntilRef` que proposava la fitxa original queda **descartada** — era incompleta, perquè no cobreix el camí de pausa, i hauria col·lidit amb SPS-0030).
> >* **Latch del marc del gest:** el temps del clic es captura al `mousedown` (`downRawTimeRef`) i la branca de clic simple de `handleMouseUp` l'usa en lloc de recalcular-lo al mouseup. Es guarda **sense clamp** (`rawTimeAt`), perquè clampar a `[0, duration]` convertiria la zona morta de la dreta en un fals positiu sobre l'últim esdeveniment; el clamp s'aplica només en derivar el temps per al seek/cues. Cobreix (2) i (3).
> >* **El doble clic es resol contra el marc del PRIMER clic** (`firstClickRawTimeRef` + `hitTestAtTime`), passi el que passi amb la vista entremig. Cobreix (1) i el bug de la vora dreta. El latch s'invalida si la cadena de clics comença fora de l'ona (listener de `mousedown` en captura a `document`) o si el gest acaba sent drag/scrub.
> >* **Regla de paritat:** un `mousedown` amb `detail` **parell** és el 2n clic d'una parella → no reexecuta l'acció de clic simple (evitava el seek/cue de brossa i el **ripple aplicat dues vegades**), no arma drag (evitava **moure un subtítol que l'usuari no ha tocat mai**, amb commit a l'historial) i no arma scrub. El 3r clic torna a ser un clic simple de ple dret. Excepció: si els **modificadors difereixen** dels del primer clic (p. ex. clic i tot seguit Shift+clic), el 2n clic sí que s'executa — és una acció deliberada i distinta.
>
> >#### **Arxius afectats:**
> >* `frontend/components/VideoEditor/WaveformTimeline.tsx` (únic fitxer; cap prop nova → els dos pares no s'han tocat).
>
> >>##### **Risc:** (no aplica — ja implementat; `tsc --noEmit` i `vite build` nets, i 15/15 assercions al navegador)
> >>##### **Dimensions:** (no aplica — ja implementat)
> >>##### **Prioritat:** ⭐⭐⭐⭐⭐⭐⭐ (7/10)
>
> >#### **Tasques a realitzar per part de l'usuari ABANS de donar-ho per tancat:**
> > * Verificar a l'**app real** (:3000, projecte amb ona i vídeo de veritat, **amb ratolí físic**), en **Duo + estacionari** i **reproduint**: (a) doble clic sobre un subtítol lluny del centre horitzontal el selecciona correctament; (b) clic simple deixa el cursor exactament on s'ha clicat; (c) Shift/Ctrl/Alt/Ctrl+Shift + clic fixen les cues al punt exacte. [__]
> > * Comprovar el **comportament de doble clic real** (el harness no ho pot verificar: els esdeveniments sintètics de Playwright no repliquen el comptador de clics natiu del navegador, que depèn dels llindars de temps i distància del SO): (a) un doble clic normal selecciona i **no** fa dos seeks; (b) **triple clic** al mateix punt → el 3r clic torna a moure el cursor; (c) clic i tot seguit **Shift+clic** al mateix punt (ràpid) → la cue **sí** que es fixa (no s'ha de descartar). [__]
> > * Judici d'UX (només el pots fer tu): en estacionari **reproduint**, la vista continua fent un **bot** en el primer clic (recentra el cursor: és el contracte del mode, no s'ha tocat). Valorar si molesta prou per prioritzar **SPS-0030** (fer que el botó «Seguiment» funcioni de veritat és la vàlvula d'escapament real). [__]
> > * Decidir si commitejar el fix (1 fitxer: `WaveformTimeline.tsx`; sense commitejar per la regla a de la Part I). [__]
>
> **Nota:** el harness de verificació al navegador es conserva a `.claude/to_claude/waveform-harness/` (amb README i instruccions). Per fer les verificacions de dalt es pot fer servir aquell banc de proves o directament l'app real.
>
> **Detall a** `history.md` (**H-00016**).
>
> ---

> ---
> ## **SPS-0014. Mode Duo + estacionari: model de ratolí alternatiu**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-13] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: pendent #1)* El nou model de ratolí de l'editor de subtítols (clic = seek sense recentrar · doble clic = seleccionar · arrossegar = moure/redimensionar · modificador+clic = fixar cues) depenia del **page-follow**. En mode **ESTACIONARI** (dins de Duo), l'efecte "auto-scroll quan està en pausa" de `WaveformTimeline.tsx` recentrava la vista (`scrollLeft = px - viewportWidth/2`) en CADA canvi de `currentTime`, també quan el canvi venia d'un clic manual i no de reproducció real. Un doble-clic genera dos cicles mousedown/mouseup abans de l'esdeveniment `dblclick` natiu: el primer clic ja disparava `onSeek` → `currentTime` canviava → la vista es recentrava ABANS que arribés el segon clic, de manera que `hitTestSegment` de `handleDoubleClick` ja no trobava l'esdeveniment sota el cursor (la vista havia fugit). El mateix recentratge interferia amb el modificador+clic (fixar cues) si just abans hi havia hagut un seek.
>
> >#### **Pla (ja implementat):**
> >* S'ha estès a estacionari el mateix principi arrel documentat a H-00011 pel mode Pàgina: *"l'autoscroll no s'ha de recentrar mai en una acció manual — només ha de seguir durant la reproducció real"*. L'efecte "Auto-scroll when paused" de `WaveformTimeline.tsx` ja NO distingeix `scrollMode`: sempre fa servir la lògica estil pàgina (només salta si el punt surt de la finestra visible), en comptes de centrar sempre en estacionari. El RAF loop de reproducció real (que sí distingeix page/stationary) queda INTACTE — és on estacionari conserva la seva identitat pròpia: cursor centrat de manera CONTÍNUA mentre el vídeo es reprodueix de veritat. **Descartat explícitament** (ja documentat a H-00011): reintroduir "Ctrl+clic per editar" a estacionari — afegeix fricció a l'operació més freqüent i divergeix del model ja adoptat a Pàgina.
> >* **Efecte secundari acceptat:** en pausa, saltar el cursor (des de la llista de subtítols, teclat, o en restaurar la posició en obrir un projecte — SPS-0007) ja NO centra el punt quan s'està en estacionari: salta a prop del punt igual que en Pàgina (el punt queda a l'esquerra de la nova vista en lloc de centrat). Estacionari només centra contínuament DURANT la reproducció real.
>
> >#### **Arxius afectats:**
> >* `frontend/components/VideoEditor/WaveformTimeline.tsx` (únic fitxer — efecte "Auto-scroll when paused"; el RAF loop de reproducció no s'ha tocat).
>
> >>##### **Risc:** (no aplica — ja implementat; `tsc --noEmit` i `vite build` nets)
> >>##### **Dimensions:** (no aplica — ja implementat)
> >>##### **Prioritat:** ⭐ (no consta)
>
> >#### **Tasques a realitzar per part de l'usuari ABANS de donar-ho per tancat:**
> > * Verificar en navegador (a :3000, app real amb un projecte amb ona), amb el toggle **Duo** actiu i el botó intern del timeline en **estacionari**: (a) doble clic sobre un subtítol el selecciona correctament (abans podia fallar o seleccionar el veí per culpa del recentratge entre els dos clics); (b) clic simple mou el cursor al punt exacte sense que la vista salti de manera desconcertant; (c) modificador+clic (Shift/Ctrl/Alt/Ctrl+Shift) sobre l'esdeveniment seleccionat fixa les cues correctament; (d) DURANT la reproducció, estacionari continua mantenint el cursor centrat de manera contínua (aquest comportament NO ha de canviar); (e) en pausa, saltar des de la llista de subtítols o restaurar la posició en obrir un projecte ja no centra el punt — apareix a prop de l'esquerra de la nova vista (comportament nou i intencionat; valorar si és còmode). Repetir amb el toggle a **pàgina** dins Duo per confirmar que no ha canviat res (ja garantit des de SPS-0012). [__]
> > * Decidir si commitejar el fix (1 fitxer: `WaveformTimeline.tsx`; sense commitejar per la regla a de la Part I). [__]
>
> **Ja documentat a** `history.md` (**H-00014**).
>
> ---

> ---
> ## **SPS-0013. Fase B (part 1): modificador+clic per fixar cues a l'ona**
> >> ###### [🗒️] *[2026-07-08] | [hora no consta]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-08] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: T13)* Segona fase del rediseny d'interacció de l'ona (SPS-0025). Afegeix l'eina de timing més ràpida de Subtitle Edit: **modificador+clic** (sense arrossegar) que fixa els temps de l'esdeveniment **seleccionat** al punt clicat — Shift=inici, Ctrl/Cmd=final, Alt=inici mantenint durada (mou tot), Ctrl+Shift=ripple (desplaça l'actiu + tots els següents). Executat amb el flux autònom (spec → ralph-loop amb condicions de sortida objectives → implementació + verificació).
>
> >#### **Pla (ja implementat):**
> >* Dispatch a `handleMouseUp` de `WaveformTimeline` (Ctrl+Shift→ripple, Shift→start, Ctrl/Cmd→end, Alt→startKeepDuration, cap→seek), 4 callbacks nous al comparador de `React.memo`. **Repurposat `Ctrl+clic`:** eliminat el `seekOnly`/`getCtrlClickSeek` de la Fase 2 antiga i el toggle de SettingsModal (ja no cal amb el mode Pàgina). Clau `WAVEFORM_CTRL_CLICK_SEEK` queda deprecada (inofensiva). 4 `useCallback` nous a cada vista editora reutilitzant els clamps de `handleSetTcIn`/`handleSetTcOut`. **Bug caçat pel ralph-loop (ronda 2, major):** els 4 callbacks fora del dep array de `handleMouseUp` haurien conservat una closure rància sobre `segments` i revertit totes les edicions en usar un cue — corregit afegint-los al dep array.
>
> >#### **Arxius afectats:**
> >* `frontend/components/VideoEditor/WaveformTimeline.tsx`, `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` i `VideoSrtStandaloneEditorView.tsx`, `frontend/components/SettingsModal.tsx`.
>
> >>##### **Risc:** (no aplica — ja implementat i verificat tècnicament; risc residual = pendent de verificació humana)
> >>##### **Dimensions:** (no aplica — ja implementat)
> >>##### **Prioritat:** ⭐ (no consta)
>
> >#### **Tasques a realitzar per part de l'usuari ABANS de donar-ho per tancat:**
> > * Verificar en navegador (a :3000, app real amb un projecte amb ona), amb un subtítol **seleccionat**: (a) Shift+clic a un punt → l'INICI del subtítol es fixa allà; (b) Ctrl/Cmd+clic → el FINAL; (c) Alt+clic → mou tot el subtítol perquè comenci allà (mateixa durada); (d) Ctrl+Shift+clic → desplaça aquest subtítol i tots els següents; (e) cada acció = un sol Ctrl+Z; (f) respecta el gap/durada mínima; (g) `Ctrl+clic` ja NO és "seek pur" i el toggle de Ajustos ha desaparegut. Verificar a les DUES vistes (principal i standalone SRT). [__]
> > * Decidir si commitejar la Fase B1 (4 fitxers: `WaveformTimeline.tsx`, `VideoSubtitlesEditorView.tsx`, `VideoSrtStandaloneEditorView.tsx`, `SettingsModal.tsx` + specs/plans; sense commitejar per la regla a de la Part I del CLAUDE.md). [__]
>
> **Ja documentat a** `history.md` (**H-00013**) — implementació i verificació tècnica completes; detall del ralph-loop de 4 rondes i del bug de dep-array.
>
> ---

> ---
> ## **SPS-0012. Fase A del rediseny de l'ona: mode Pàgina/Duo (default Pàgina)**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-07] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: T12)* Primera fase (base) del rediseny d'interacció del visualitzador d'ona (SPS-0025). El doble-clic sobre un esdeveniment i l'edició durant la reproducció no funcionaven: en mode ESTACIONARI (default vell) la vista es recentra a cada seek i l'esdeveniment fuig. Objectiu: fer del mode **Pàgina** el comportament per defecte, sense perdre l'estacionari.
>
> >#### **Pla (ja implementat):**
> >* Nova clau `WAVEFORM_VIEW_MODE` (`'page'|'duo'`, default `'page'`) + control segmentat Pàgina/Duo a `SettingsModal` + entrada a factoryReset. En **Pàgina**, `effectiveScrollMode` es força a `page` a les dues vistes editores i el botó intern estacionari/pàgina del timeline queda **ocult i inert** (`invisible pointer-events-none` + guard `onClick` + `aria-hidden`/`tabIndex=-1`) però es manté al DOM (no mou la resta de botons). En **Duo**, comportament actual intacte. Nova prop `scrollModeLocked` a `WaveformTimeline` (al comparador de `React.memo`). **No es toca** la lògica d'autoscroll: el mode `page` ja no recentra en clics dins la finestra → arregla el doble-clic i l'edició durant playback. `MediaPreviewView` va quedar **fora d'abast** (no renderitza `WaveformTimeline` — descobert per la revisió, el seu `scrollMode` és un passthrough mort).
>
> >#### **Arxius afectats:**
> >* `frontend/constants.ts`, `frontend/utils/factoryReset.ts`, `frontend/components/VideoEditor/WaveformTimeline.tsx`, `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` i `VideoSrtStandaloneEditorView.tsx`, `frontend/components/SettingsModal.tsx`.
>
> >>##### **Risc:** (no aplica — ja implementat i verificat tècnicament; risc residual = pendent de verificació humana)
> >>##### **Dimensions:** (no aplica — ja implementat)
> >>##### **Prioritat:** ⭐ (no consta)
>
> >#### **Tasques a realitzar per part de l'usuari ABANS de donar-ho per tancat:**
> > * Verificar en navegador (a :3000, app real amb un projecte amb ona): (a) Ajustos › editor de subtítols mostra "Mode de l'ona d'àudio" amb Pàgina/Duo (Pàgina per defecte); (b) en Pàgina el botó estacionari/pàgina del timeline no es veu (però l'espai es manté i la resta de botons no es mouen); (c) doble clic sobre un esdeveniment el selecciona sense que la vista fugi, també durant la reproducció; (d) canviar a Duo fa aparèixer el botó del timeline en viu (sense recarregar) i es pot tornar a estacionari. [__]
> > * Decidir si commitejar la Fase A (6 fitxers: `constants.ts`, `factoryReset.ts`, `WaveformTimeline.tsx`, `VideoSubtitlesEditorView.tsx`, `VideoSrtStandaloneEditorView.tsx`, `SettingsModal.tsx` + specs/plans; sense commitejar per la regla a de la Part I). [__]
>
> **Ja documentat a** `history.md` (**H-00012**) — implementació i verificació tècnica completes; detall del ralph-loop de 4 rondes i de la premissa falsa (`MediaPreviewView`) caçada a la ronda 1.
>
> ---

> ---
> ## **SPS-0010. Clic simple = seek al punt exacte / doble clic = seleccionar + guarda de la barra superior**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-07] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: T10)* El clic simple sobre un esdeveniment cridava `onSegmentClick` → el cursor saltava a l'INICI del bloc en comptes d'on es clicava. Regressió detectada: `handleMouseUp`/`handleDoubleClick` vivien a l'element ARREL (que embolcalla la barra superior) → clicar la barra també feia seek.
>
> >#### **Pla (ja implementat):**
> >* Estil Subtitle Edit: **clic simple = seek al punt EXACTE clicat** (mai selecciona) · **doble clic = seleccionar** (`handleDoubleClick`, respectant el mode Ctrl). Guardes: el seek només si el gest ha començat dins la zona d'ona (`mouseDownActiveRef`), i el doble-clic només si el target és dins `scrollRef` (`scrollRef.contains`).
>
> >#### **Arxius afectats:**
> >* `frontend/components/VideoEditor/WaveformTimeline.tsx`.
>
> >>##### **Risc:** (no aplica — ja implementat i verificat amb harness)
> >>##### **Dimensions:** (no aplica — ja implementat)
> >>##### **Prioritat:** ⭐ (no consta)
>
> >#### **Tasques a realitzar per part de l'usuari ABANS de donar-ho per tancat:**
> > * Verificar en navegador (a :3000, app real amb un media amb ona) el drag de l'ona (grup T8/T9/T10): (a) arrossegar un esdeveniment respon de seguida (~50 ms); (b) mantenir premut i moure poc (<6 px) → clic, no mou; (c) Ctrl/Cmd+clic mou el cursor sense tocar l'event i Ctrl+arrossegar = scrub; (d) clic simple = seek al punt clicat, doble clic = seleccionar; (e) clic a la barra superior (Timeline/zoom/mode) NO mou el cursor. NOTA: el rediseny SPS-0025 canvia bona part d'això (page-mode, model SE). [__]
> > * Decidir si commitejar el treball de l'ona (grup T8–T11: `WaveformTimeline.tsx`, `SettingsModal.tsx`, `constants.ts`, `factoryReset.ts`, `backend_nest_mvp/tsconfig.json`; sense commitejar per la regla a de la Part I). [__]
>
> **Ja documentat a** `history.md` (**H-00011**, dins de la decisió arquitectònica conjunta amb SPS-0008/SPS-0009).
>
> ---

> ---
> ## **SPS-0009. Ctrl/Cmd + clic = seek pur i Ctrl/Cmd + arrossegar = scrub (Fase 2)**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-07] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: T9)* Es volia una manera de moure el cursor sense arriscar-se a tocar/moure un esdeveniment de l'ona per accident.
>
> >#### **Pla (ja implementat):**
> >* Nova clau `WAVEFORM_CTRL_CLICK_SEEK` (default true) + toggle a SettingsModal + factoryReset. Amb Ctrl (o Cmd a Mac), l'ona es tracta com a espai buit: `Ctrl+clic` mou el cursor i mai toca un esdeveniment; `Ctrl+arrossegar` fa scrub (es salta el hit-test de segments quan `seekOnly = (ctrlKey||metaKey) && getCtrlClickSeek()`).
>
> >#### **Arxius afectats:**
> >* `frontend/components/VideoEditor/WaveformTimeline.tsx`, `SettingsModal.tsx`, `constants.ts`, `factoryReset.ts`.
>
> >>##### **Risc:** (no aplica — ja implementat i verificat amb harness ctrlKey/metaKey)
> >>##### **Dimensions:** (no aplica — ja implementat)
> >>##### **Prioritat:** ⭐ (no consta)
>
> >#### **Tasques a realitzar per part de l'usuari ABANS de donar-ho per tancat:**
> > * Mateixa verificació de navegador i decisió de commit que SPS-0010 (grup T8/T9/T10, drag de l'ona). [__]
>
> **Nota:** aquesta feature queda **repurposada/substituïda** per SPS-0013 (T13) — amb page-mode el clic normal ja és segur i `Ctrl+clic` va passar a "fixar final" (paritat SE). Clau `WAVEFORM_CTRL_CLICK_SEEK` deprecada des de SPS-0013.
>
> **Ja documentat a** `history.md` (**H-00011**, dins de la decisió arquitectònica conjunta amb SPS-0008/SPS-0010).
>
> ---

> ---
> ## **SPS-0008. Hold per defecte 50 ms + zona morta anti-tremolor a l'arrossegament (Fase 1)**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-07] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: T8)* El temps de pulsació mantinguda per armar el drag d'un esdeveniment (`WAVEFORM_HOLD_MS`) era massa lent per als usuaris de proves (default 500 ms).
>
> >#### **Pla (ja implementat):**
> >* `WAVEFORM_HOLD_MS` default 500→**50 ms**. Per compensar moviments accidentals, nova clau `WAVEFORM_DRAG_DEADZONE_PX` (default 6 px, 0 = desactivat): un cop armat el drag, ignora moviments per sota del marge, i si no se supera es tracta com a clic. Reancoratge al creuar la zona morta per evitar el "salt" del llindar.
>
> >#### **Arxius afectats:**
> >* `frontend/constants.ts`, `frontend/components/VideoEditor/WaveformTimeline.tsx`, `SettingsModal.tsx`, `factoryReset.ts`.
>
> >>##### **Risc:** (no aplica — ja implementat i verificat amb harness aïllat, 7 escenaris)
> >>##### **Dimensions:** (no aplica — ja implementat)
> >>##### **Prioritat:** ⭐ (no consta)
>
> >#### **Tasques a realitzar per part de l'usuari ABANS de donar-ho per tancat:**
> > * Mateixa verificació de navegador i decisió de commit que SPS-0010 (grup T8/T9/T10, drag de l'ona). [__]
>
> **Ja documentat a** `history.md` (**H-00011**, dins de la decisió arquitectònica conjunta amb SPS-0009/SPS-0010).
>
> ---

> ---
> ## **SPS-0007. Restaurar l'última posició en reobrir un projecte de subtítols**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-07] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: T7)* En reobrir un projecte a l'editor de subtítols, sempre començava a 0:00 en comptes de tornar a la posició on l'usuari es va quedar.
>
> >#### **Pla (ja implementat):**
> >* Persistència **backend** (cross-device): nou camp `project.settings.resumeState = { currentTime, activeSegmentId, updatedAt }` via `PATCH /projects/:id/resume-state`. Hook compartit `frontend/hooks/useResumePosition.ts`: fetch → aplicació quan es coneix `duration` (clamp a `duration-0.1`), throttle de desat de 5s, `flush()` a onPause/unmount/onClose amb guards. Afegit `key={currentDoc.id}` a les vistes d'editor a `App.tsx` (corregeix `autoLoadAttemptedRef` no reiniciat en canviar de `docId`). Dissenyat amb **ralph-loop de 6 iteracions adversarials** (1 crític + diversos majors abans de codificar).
>
> >#### **Arxius afectats:**
> >* `backend_nest_mvp/src/modules/projects/projects.service.ts` i `.controller.ts`, `frontend/services/api.ts`, `frontend/hooks/useResumePosition.ts` (nou), `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` i `VideoSrtStandaloneEditorView.tsx`, `frontend/App.tsx`.
>
> >>##### **Risc:** (no aplica — ja implementat; `tsc --noEmit` net a frontend i backend)
> >>##### **Dimensions:** (no aplica — ja implementat)
> >>##### **Prioritat:** ⭐ (no consta)
>
> >#### **Tasques a realitzar per part de l'usuari ABANS de donar-ho per tancat:**
> > * Verificar en navegador (cal MongoDB + auth + un projecte real amb vídeo; proves 5-14 de la spec original): (a) obrir projecte, reproduir fins a ~0:30, tancar i reobrir → el vídeo arrenca a ~0:30 i el subtítol actiu és el correcte; (b) `resumeState.currentTime` > durada real → obre al final menys 0.1s sense error; (c) projecte nou sense resumeState → obre a 0:00 i, després de reproduir i tancar, recupera la posició en reobrir; (d) standalone SRT lligat a projecte → mateixa restauració; SRT solt → sense efecte; (e) reproducció contínua >5s → almenys un PATCH periòdic; (f) canviar directament de projecte A→B (sense passar per Home) → A desa la seva posició i B obre net restaurant la SEVA posició. [__]
> > * Decidir si commitejar la feature (6 fitxers: `useResumePosition.ts` nou; `projects.service.ts`, `projects.controller.ts`, `api.ts`, `VideoSubtitlesEditorView.tsx`, `VideoSrtStandaloneEditorView.tsx`, `App.tsx` modificats; sense commitejar per la regla a de la Part I). [__]
>
> **Ja documentat a** `history.md` (**H-00009**) — detall complet del ralph-loop de 6 iteracions i dels 7 bugs de disseny caçats abans de codificar.
>
> ---

> ---
> ## **SPS-0006. Cerca i substitució tipus Word a l'editor de subtítols**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-07] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: T6)* L'editor de subtítols no tenia manera de localitzar ni substituir un terme. Petició: buscador tipus Microsoft Word. Decisió d'abast validada: NOMÉS l'editor de subtítols (l'editor de guions queda a SPS-0020).
>
> >#### **Pla (ja implementat):**
> >* Barra de cerca desplegable (lupa + Ctrl+F), cerca literal en viu (debounce 150ms), opcions Aa i paraula completa, comptador «N de M», navegació ▲/▼, ressaltat via CSS Custom Highlight API. Substituir (un a un) i Substituir-ho tot (1 sol pas d'undo). Mòdul pur nou `searchReplace.ts` + `SearchReplaceBar.tsx`. Dissenyat amb ralph-loop de 7 iteracions (9 BUG + 19 MINOR corregits abans de codificar).
>
> >#### **Arxius afectats:**
> >* `frontend/utils/SubtitlesEditor/searchReplace.ts` (nou), `frontend/components/VideoSubtitlesEditor/SearchReplaceBar.tsx` (nou), `SubtitlesEditor.tsx`, `constants.ts`, `index.html`.
>
> >>##### **Risc:** (no aplica — ja implementat; 40/40 casos de lògica pura, `tsc`+build nets)
> >>##### **Dimensions:** (no aplica — ja implementat)
> >>##### **Prioritat:** ⭐ (no consta)
>
> >#### **Tasques a realitzar per part de l'usuari ABANS de donar-ho per tancat:**
> > * Verificar en navegador (les dues vistes): (a) lupa i Ctrl+F obren la barra; Esc/✕ tanquen; (b) cerca en viu amb comptador «N de M», ▲/▼ amb scroll i ressaltat; (c) opcions Aa i paraula completa (provar accents); (d) Substituir → 1 pas d'undo i salta a la següent; (e) Substituir-ho tot → 1 sol pas d'undo + missatge «S'han fet N substitucions»; (f) cas amb format (`buenos <i>días</i>` + substituir) → sense tags residuals; (g) mode lectura: cerca funciona, fila de substituir absent. [__]
> > * Decidir si commitejar la feature (5 fitxers: `searchReplace.ts` i `SearchReplaceBar.tsx` nous; `SubtitlesEditor.tsx`, `constants.ts`, `index.html` modificats; sense commitejar per la regla a de la Part I). [__]
>
> **Ja documentat a** `history.md` (**H-00008**) — detall complet del ralph-loop de 7 iteracions.
>
> ---

> ---
> ## **SPS-0005. En reobrir un projecte es carregava el vídeo original, no l'últim vinculat**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-07] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: T5)* En canviar de vídeo, el nou asset es guardava bé a `linkedMediaId` del document SRT, però els dos efectes de sync de media d'`App.tsx` llegien sempre el `mediaDocumentId` del registre del projecte (que només s'estableix a la creació i mai s'actualitza) i disparaven el sync amb el vídeo original.
>
> >#### **Pla (ja implementat):**
> >* Fix mínim al costat de lectura, simètric als dos efectes: `const linkedId = doc.linkedMediaId; const mediaId = linkedId || proj?.mediaDocumentId || proj?.mediaDocId;` (prioritza l'últim vídeo vinculat). Sense tocar backend ni el flux de guardat.
>
> >#### **Arxius afectats:**
> >* `frontend/App.tsx` (dos punts de sync de media).
>
> >>##### **Risc:** (no aplica — ja implementat; `tsc --noEmit` net)
> >>##### **Dimensions:** (no aplica — ja implementat)
> >>##### **Prioritat:** ⭐ (no consta)
>
> >#### **Tasques a realitzar per part de l'usuari ABANS de donar-ho per tancat:**
> > * Verificar en navegador el cicle: crear/obrir un projecte, canviar el vídeo (importar-ne un altre), guardar, tancar i reobrir → ha de reaparèixer l'ÚLTIM vídeo vinculat, no l'original de la creació. Provar també amb la pestanya de l'editor de vídeo i amb l'standalone SRT. [__]
> > * Decidir si commitejar el fix (`frontend/App.tsx`; sense commitejar per la regla a de la Part I). [__]
>
> **Ja documentat a** `history.md` (**H-00007**).
>
> ---

> ---
> ## **SPS-0004. Inserir subtítol al cursor (playhead) + reparació del botó "+després"**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-07] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: T4)* La drecera "Inserir subtítol" inseria sempre DESPRÉS del segment actiu/últim amb durada fixa ~2s, no al playhead. A més, el botó "+després" de cada bloc trepitjava el següent subtítol per defecte (pis de durada mal ordenat respecte al clamp del veí).
>
> >#### **Pla (ja implementat):**
> >* Nou `handleInsertSegmentAtCursor` (dues vistes): crea el bloc EXACTAMENT al playhead amb durada = durada mínima configurada; si el cursor és massa a prop del següent, desplaça l'inici enrere per mantenir la durada mínima; si no hi cap, escurça (mai solapa). "+després" reescrit perquè el clamp contra el veí sigui l'ÚLTIM pas (abans un `Math.max` reobria el solapament).
>
> >#### **Arxius afectats:**
> >* `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx`, `VideoSrtStandaloneEditorView.tsx`.
>
> >>##### **Risc:** (no aplica — ja implementat; `tsc` net)
> >>##### **Dimensions:** (no aplica — ja implementat)
> >>##### **Prioritat:** ⭐ (no consta)
>
> >#### **Tasques a realitzar per part de l'usuari ABANS de donar-ho per tancat:**
> > * Verificar en navegador (les dues vistes): (a) drecera Inserir amb el playhead en un buit ampli → bloc de 1000ms exactament al cursor; (b) playhead a menys de 1000ms del següent subtítol → l'inici es desplaça enrere per mantenir 1000ms sense trepitjar; (c) buit lliure < 1000ms → bloc més curt, sense solapar; (d) botó "+després" en un bloc enganxat al següent → ja no el trepitja; (e) "+abans" segueix igual. [__]
> > * Decidir si commitejar la reparació (2 fitxers: `VideoSubtitlesEditorView.tsx`, `VideoSrtStandaloneEditorView.tsx`; sense commitejar per la regla a de la Part I). [__]
>
> **Ja documentat a** `history.md` (**H-00006**).
>
> ---

> ---
> ## **SPS-0003. Selecció múltiple de blocs + format B/I/U en lot no destructiu**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-07] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: T3)* L'editor de subtítols només tenia un "segment actiu"; els botons B/I/U aplicaven format via `document.execCommand` sobre un sol bloc. Petició: checkbox per bloc, Maj+clic per rangs inclusius, i toggle de format en lot normalitzador (mai tags niats, mai tocar `<b>`/`<u>` en manipular `<i>`).
>
> >#### **Pla (ja implementat):**
> >* Checkbox nou (canal flex, grid intacte), clic=toggle, Maj+clic=rang inclusiu per **índex d'array** (mai per id, que no és seqüencial). Nou mòdul pur `utils/SubtitlesEditor/formatTags.ts` (`stripTag`, `isFullyTagged`, `wrapTagPerLine`, `toggleTagOnTexts` amb semàntica "make consistent"; 35 casos verificats). Botons B/I/U reutilitzats: amb selecció activa → lot; sense → comportament clàssic. Un lot = un sol `commit` (un pas d'undo). **Bug caçat pel ralph-loop (it1):** mutar `anchorIdRef` DINS de l'updater de `setSelectedIds` trencava el rang sota `React.StrictMode` (doble invocació) — corregit traient l'efecte secundari de l'updater.
>
> >#### **Arxius afectats:**
> >* `frontend/utils/SubtitlesEditor/formatTags.ts` (nou), `frontend/components/VideoSubtitlesEditor/SegmentItem.tsx`, `SubtitlesEditor.tsx`, `VideoSubtitlesEditorView.tsx`, `VideoSrtStandaloneEditorView.tsx`.
>
> >>##### **Risc:** (no aplica — ja implementat; 35/35 lògica, `tsc`+build nets, revisió final "Ready to hand off: Yes")
> >>##### **Dimensions:** (no aplica — ja implementat)
> >>##### **Prioritat:** ⭐ (no consta)
>
> >#### **Tasques a realitzar per part de l'usuari ABANS de donar-ho per tancat:**
> > * Verificar en navegador (les dues vistes): (a) clic al checkbox del bloc N + Maj+clic al bloc M → tots els intermedis seleccionats, inclosos N i M; (b) amb "hola <i>com</i> estas" seleccionat, botó I → `<i>hola com estas</i>` (normalitzat) i les negretes intactes; (c) segona I amb tot en cursiva → la treu; (d) un sol Ctrl+Z reverteix tot el lot i la selecció es manté; (e) split/merge/delete buiden la selecció. [__]
> > * Decidir si commitejar la feature (5 fitxers al working tree; sense commitejar per la regla a de la Part I — Claude pot fer els commits per tasques si es demana). [__]
>
> **Ja documentat a** `history.md` (**H-00005**) — detall del bug de StrictMode i de la normalització de tags.
>
> ---

> ---
> ## **SPS-0002. Split lògic a l'editor de subtítols (cursor + fallback per línia/paraula)**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-07] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: T2)* El split tenia 3 disparadors i només Ctrl+K amb focus dins del text usava el cursor; el botó S i la drecera global tallaven a cegues pel punt mig en caràcters, partint paraules i línies per qualsevol lloc.
>
> >#### **Pla (ja implementat):**
> >* Botó S conscient del cursor: si la selecció cau dins l'editor del segment → split al cursor; si no → fallback lògic nou (`computeSmartSplit` a `utils/SubtitlesEditor/splitHelpers.ts`): multilínia → talla pel salt de línia més equilibrat; una línia → per l'espai més proper al centre; mai dins d'un tag. Afegit el fallback que faltava a la vista standalone. Higiene del `splitPayloadRef` (consumit sempre a l'entrada del handler).
>
> >#### **Arxius afectats:**
> >* `frontend/utils/SubtitlesEditor/splitHelpers.ts` (nou), `frontend/components/VideoSubtitlesEditor/SegmentItem.tsx`, `VideoSubtitlesEditorView.tsx`, `VideoSrtStandaloneEditorView.tsx`.
>
> >>##### **Risc:** (no aplica — ja implementat; 10 casos verificats + `tsc --noEmit` net)
> >>##### **Dimensions:** (no aplica — ja implementat)
> >>##### **Prioritat:** ⭐ (no consta)
>
> >#### **Tasques a realitzar per part de l'usuari ABANS de donar-ho per tancat:**
> > * Verificar en navegador el nou split (3 gestos): (a) cursor a mitja línia 2 + botó S → talla exactament al cursor; (b) botó S sense cursor al text en un bloc de 2 línies → separa línia 1 / línia 2; (c) Ctrl+K amb el focus fora del text → tall pel salt de línia o espai més proper al centre del segment actiu. [__]
>
> **Ja documentat a** `history.md` (**H-00004**).
>
> ---

---

## ✅ **ACABAT**

> *Històric de tasques acabades. Les més recents, a dalt.*

> ---
> ## **SPS-0038. `VideoPlayer`: l'overlay perd el format als tags en forma de bloc**
> >> ###### [🗒️] *[2026-07-14] | [11:26:05]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-14] | [11:31:40]*
> >> ###### [✅] *[2026-07-14] | [11:43:15]*
>
> >#### **Síntoma / Context:**
> >* Detectat en tancar SPS-0017. `SubtitleLines` (`VideoPlayer.tsx:23-37`) feia `text.split('\n')` i cridava `plainToRich` **per línia**. Amb la forma en bloc `<i>línia1\nlínia2</i>` — habitual en SRT **importats** de fora — la línia 1 sortia en cursiva (el parser d'HTML l'autotancava) però la **línia 2 no**: el seu `</i>` orfe el descartava el parser. L'overlay del vídeo mostrava mitja frase en cursiva i mitja no.
> >* No era una regressió de SPS-0017 (ja hi era abans), i el camí habitual no en patia: el format en lot de Sonilab (SPS-0003, `wrapTagPerLine`) escriu els tags **per línia**, no en bloc. Només afectava fitxers de tercers.
>
> >#### **Arxius afectats:**
> >* `frontend/components/VideoEditor/VideoPlayer.tsx`.
>
> >>##### **Risc:** (tancat — sense incidències)
> >>##### **Dimensions:** (tancat)
> >>##### **Prioritat:** ⭐⭐ (2/10 — cosmètic, i només amb SRT importats)
>
> ---

#### Què ha canviat al tancar-ho:
A `SubtitleLines` (`VideoPlayer.tsx`), el `text.split('\n').map(line => plainToRich(line))` s'ha substituït per una sola crida a `plainToRichLines(text)` — el helper de `richTextHelpers.ts` escrit per a SPS-0017, que propaga els tags oberts d'una línia a la següent. Canvi de 3 línies + l'import; cap altre fitxer tocat. `tsc --noEmit` net i verificació al navegador amb un harness temporal de Vite que renderitza el `VideoPlayer` real, comprovant els `getComputedStyle` de cada línia en 6 casos: bloc `<i>` multilínia (**el bug: ara les dues línies surten en cursiva**), per línia (format Sonilab — sense regressió), sense tags, bloc `<b><i>` imbricats, tag obert que no es tanca mai, i text amb `<`/`>` literals (que segueixen escapats correctament). El harness s'ha esborrat en acabar.

**Nota:** sense entrada a `history.md` — per proporcionalitat (fix cosmètic de 3 línies, sense causa arrel no òbvia ni decisió arquitectònica). La causa i el helper ja queden documentats a l'entrada de SPS-0017.

---

> ---
> ## **SPS-0011. Fix del warning de deprecació `baseUrl` al tsconfig del backend**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-07] | [hora no consta]*
> >> ###### [✅] *[2026-07-10] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: T11)* VS Code marcava `backend_nest_mvp/tsconfig.json:13` amb "Option 'baseUrl' is deprecated…", contraintuïtiu perquè el `tsc` del workspace (5.9.3) compilava net i el fitxer ja tenia `"ignoreDeprecations": "5.0"`. Causa: el TS intern de VS Code és més nou que el 5.9.3 del workspace.
>
> >#### **Arxius afectats:**
> >* `backend_nest_mvp/tsconfig.json`.
>
> >>##### **Risc:** (tancat — sense incidències)
> >>##### **Dimensions:** (tancat)
> >>##### **Prioritat:** ⭐ (no consta)
>
> >#### **Tasques a realitzar per part de l'usuari ABANS de donar-ho per tancat:**
> > * Decidir si commitejar el treball de l'ona i aquest fix col·lateral (grup T8–T11: `WaveformTimeline.tsx`, `SettingsModal.tsx`, `constants.ts`, `factoryReset.ts`, `backend_nest_mvp/tsconfig.json`; sense commitejar per la regla a de la Part I). [✅]
>
> ---

#### Què ha canviat al tancar-ho:
Eliminats `baseUrl` i `ignoreDeprecations` de `backend_nest_mvp/tsconfig.json` (no s'usava `baseUrl` enlloc). `tsc --noEmit` i `nest build` nets. Confirmat per `git log`/`git status` que el fitxer ja està commitejat sense aquestes claus (part del grup T8–T11, commits `4e28f29` i `71be927`) i que l'arbre de treball està net — la decisió de commit pendent ja està resolta.

**Detall a** history.md (**H-00010**)

---

> ---
> ## **SPS-0001. Durada mínima configurable per bloc de subtítol**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-07] | [hora no consta]*
> >> ###### [✅] *[2026-07-07] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: T1)* L'editor no tenia cap manera de configurar la durada mínima d'un bloc; l'únic límit era el pis absolut intern `MIN_SEG_DURATION_MS = 100` ms, no configurable. A més, `VideoSrtStandaloneEditorView.tsx` tenia `0.1` hardcoded en lloc de la constant real.
>
> >#### **Arxius afectats:**
> >* `frontend/constants.ts`, `frontend/types/Subtitles.ts`, `frontend/utils/factoryReset.ts`, `frontend/components/SettingsModal.tsx`, `frontend/components/VideoEditor/WaveformTimeline.tsx`, `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` i `VideoSrtStandaloneEditorView.tsx`.
>
> >>##### **Risc:** (tancat — sense incidències)
> >>##### **Dimensions:** (tancat)
> >>##### **Prioritat:** ⭐ (no consta)
>
> ---

#### Què ha canviat al tancar-ho:
Nova clau `EDITOR_MIN_DURATION_MS` (`snlbpro_editor_min_duration_ms`, default 1000 ms), camp `minDurationMs?: number` a `GeneralConfig`, control "Durada mínima de subtítol" a SettingsModal. Enforcement als 6 punts existents: `handleSetTcIn`, `handleSetTcOut`, `handleSegmentChange` (dues vistes), drag `resize-start`/`resize-end` (WaveformTimeline). Corregit el bug de `0.1` hardcoded a l'standalone. `KEYS_TO_REMOVE` de factoryReset.ts actualitzat. 7 fitxers modificats, build net. **Única tasca del bloc TERMINADO antic sense cap pendent a «Tareas manuales del usuario»** — per això és l'única que migra directament a ACABAT.

**Detall a** history.md (**H-00003**)

---

## 🛑 **CANCELATS**

> *Tasques descartades o revertides. Les més recents, a dalt.*

> ---
> ## **SPS-0015. Presets d'interacció de ratolí page vs duo**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
> >> ###### [🏃‍♂️‍➡️] *[2026-07-13] | [10:42:34]*
> >> ###### [🛑] *[2026-07-13] | [11:05:00]*
>
> >#### **Síntoma / Context:**
> >* *(abans: pendent #2)* Potser cal separar explícitament els presets d'interacció de ratolí per mode (page vs duo) en comptes de derivar-los del mode de scroll actiu.
>
> >#### **Pla:**
> >* Avaluar si val la pena un preset explícit per mode o mantenir la derivació actual.
>
> >#### **Arxius afectats:**
> >* Cap (avaluació; no s'ha tocat codi).
>
> >>##### **Risc:** 2/10 *(orig.: «bajo»)*
> >>##### **Dimensions:** 2/10 *(orig.: «pequeño»)*
> >>##### **Prioritat:** ⭐ (no consta)
>
> ---

#### Motiu de la cancel·lació / resolució:
**Avaluada i descartada: la premissa ja no és certa.** La tasca es va incorporar el 2026-07-07, ABANS de les Fases A i B de l'ona. Auditat el codi real (2026-07-13), **cap** handler de ratolí branca per mode: `handleMouseDown/Move/Up/DoubleClick/Leave/Wheel` no llegeixen mai `scrollMode`/`waveViewMode`, i els paràmetres del ratolí (`WAVEFORM_HOLD_MS`, `WAVEFORM_DRAG_DEADZONE_PX`, `EDGE_HIT_PX`, llindar de scrub, mapa de modificador+clic) ja són **globals i únics**. L'única lectura funcional del mode a tot `WaveformTimeline.tsx` és **una línia** — el RAF loop de reproducció (L481-490) — més la visibilitat del botó de mode. Per tant no hi ha cap «derivació» a substituir: no hi ha res a separar.

Quatre raons independents per no crear-los igualment:
1. **Error de categoria:** `scrollMode` ja no és una dimensió d'interacció, sinó un estil de seguiment durant la reproducció.
2. **Eix mal plantejat:** «page vs duo» no és l'eix real — `effectiveScrollMode = waveViewMode === 'page' ? 'page' : scrollModeWave`, o sigui que **Duo també pot ser page**; un «preset de Duo» s'activaria per a usuaris amb comportament idèntic al de Pàgina.
3. **Reobriria un carreró ja descartat dos cops:** l'únic preset per mode amb sentit real seria «Ctrl+clic per editar / per fer seek en estacionari» → dos models de clic diferents dins la mateixa app, rebutjat a H-00011 i re-rebutjat a H-00014.
4. **Contradiu l'esquema mestre:** `Shortcuts Subtitols - Consolidat.csv` no té columna ni secció de mode i la seva base tècnica diu literalment «Mode PAGINA unic»; la Fase C ja fixa «un sol joc de dreceres, independent del mode de scroll».

**Cost evitat:** ≥2 claus de localStorage per paràmetre, superfície nova a SettingsModal + factoryReset + comparador de `React.memo`, i sobretot una **matriu de verificació manual ×2 per a cada gest futur** de l'ona (Fase B2, Fase C, snapping) — cost que l'estimació original de 2/10 infravalorava.

**El que SÍ ha sortit d'aquesta avaluació** (l'asimetria real entre modes existeix, però es resol amb UN invariant, no amb dos presets): SPS-0029 (gestos contra una vista en moviment durant la reproducció — inclou el doble-clic encara trencat en estacionari **mentre reprodueix**), SPS-0030 (el botó «Seguiment» és cosmètic) i SPS-0031 (neteja de deute mort).

**Detall a** history.md (**H-00015**)

---

## 📌 Notes informatives (decisions preses — no reobrir sense context nou)

> *Aquestes dues entrades de l'antic `tareas.md` no són tasques amb estat (no encaixen a PENDENTS/EN_PROCES/ACABAT/CANCELATS): documenten decisions ja preses de NO fer alguna cosa. Es conserven aquí, en secció pròpia, perquè no es reobrin sense context — tal com demanava l'original ("Informacionales (no tocar)").*

### Residu acceptat — selecció múltiple sobreviu al sync d'SRT amb la mateixa longitud *(2026-07-07)*

Vincular un SRT nou sobre el mateix document (drag&drop o modal Vincular; també a l'standalone) substitueix tot l'array via `commit(parseSrt(...))` sense remount. La selecció múltiple (SPS-0003) es buida quan canvia `segments.length`; si el fitxer nou té **exactament el mateix nombre de blocs**, la selecció sobreviu apuntant al contingut nou.

**Decisió: no cobrir-ho.** Conseqüència acotada (els checkboxes queden visiblement marcats i el lot s'aplicaria a allò marcat); cobrir-ho exigiria un `docKey`/invalidació extra que no compensa. Detall a la spec local `docs/superpowers/specs/2026-07-01-multi-select-batch-format-design.md` §4.4.

### Notes de disseny — dreceres vs ratolí *(2026-07-07)*

Les **dreceres de teclat** (nudges Alt/Alt+Shift+fletxes, F9–F12, Ctrl+fletxes, Ctrl+Shift+M, Ctrl+Alt+V, etc.) són **independents del mode de scroll** → un sol joc, vàlid a pàgina i estacionari. No cal preset per mode per al teclat.

~~El que és dependent del mode és **només el ratolí**.~~

> **Actualització *(2026-07-13, en tancar SPS-0015)*:** aquesta última frase **ha quedat obsoleta** i era l'origen de la premissa de SPS-0015. Des de les Fases A i B (SPS-0012/0013) i el fix de SPS-0014, **el ratolí tampoc depèn del mode**: cap handler de `WaveformTimeline` branca per `scrollMode`; l'única cosa que en depèn és l'autoscroll DURANT la reproducció real (RAF loop). Model d'interacció: **un de sol, mode-agnòstic** (ratolí i teclat). Veure CANCELATS → SPS-0015 i history.md → H-00015.

Documents relacionats: `Shortcuts Subtitols - Consolidat.csv`.

---
