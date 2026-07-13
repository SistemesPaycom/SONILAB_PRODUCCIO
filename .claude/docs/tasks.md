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
> ## **SPS-0015. Presets d'interacció de ratolí page vs duo**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: pendent #2)* Potser cal separar explícitament els presets d'interacció de ratolí per mode (page vs duo) en comptes de derivar-los del mode de scroll actiu.
>
> >#### **Pla:**
> >* Avaluar si val la pena un preset explícit per mode o mantenir la derivació actual.
>
> >#### **Arxius afectats:**
> >* *(no consta a l'original)*
>
> >>##### **Risc:** 2/10 *(orig.: «bajo»)*
> >>##### **Dimensions:** 2/10 *(orig.: «pequeño»)*
> >>##### **Prioritat:** ⭐ (no consta)
>
> ---

> ---
> ## **SPS-0016. Split: respectar la durada mínima configurable**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: pendent #3)* El split (per cursor o lògic) reparteix la durada proporcionalment al text, però no comprova `minDurationMs`: dividir un bloc curt pot crear dos blocs per sota de la durada mínima configurada (SPS-0001/T1 va cobrir els 6 punts d'enforcement existents; el split va quedar fora). Tampoc aplica `minGapMs` entre les dues meitats (gap fix de 0.001 s).
>
> >#### **Pla:**
> >* Decidir si el split ha de bloquejar-se quan cap meitat pot arribar a la durada mínima, o només avisar (Subtitle Edit permet el split i marca l'error de validació). Si s'aplica, fer-ho als dos handlers `handleSplitSegmentAtCursor` (vista principal i standalone).
>
> >#### **Arxius afectats:**
> >* `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx`, `VideoSrtStandaloneEditorView.tsx`.
>
> >>##### **Risc:** 2/10 *(orig.: «bajo»)*
> >>##### **Dimensions:** 2/10 *(orig.: «pequeño»)*
> >>##### **Prioritat:** ⭐ (no consta)
>
> ---

> ---
> ## **SPS-0017. SrtPreviewView: renderitzar tags SRT en comptes de mostrar-los literals**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: pendent #4)* La vista prèvia de fitxers SRT de la biblioteca (`SrtPreviewView.tsx`) mostra el text cru: un bloc en cursiva es veu com a `<i>Hola</i>` literal. Preexistent, però ara més visible perquè el format en lot (SPS-0003) farà més habituals els tags. L'overlay del vídeo ja ho fa bé (`VideoPlayer.tsx` usa `plainToRich` + `dangerouslySetInnerHTML`, que escapa tot excepte i/b/u).
>
> >#### **Pla:**
> >* Renderitzar les línies amb el mateix patró `plainToRich` + `dangerouslySetInnerHTML` (segur: escapa qualsevol altre HTML).
>
> >#### **Arxius afectats:**
> >* `frontend/components/VideoSubtitlesEditor/SrtPreviewView.tsx`.
>
> >>##### **Risc:** 2/10 *(orig.: «bajo»)*
> >>##### **Dimensions:** 2/10 *(orig.: «pequeño»)*
> >>##### **Prioritat:** ⭐ (no consta)
>
> ---

> ---
> ## **SPS-0018. Polits menors del review final de selecció múltiple**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: pendent #5)* La revisió final de la feature de selecció múltiple (SPS-0003) va deixar 4 polits triats com a "LEAVE" (cap bloqueja res): (a) typo al comentari de `handleToggleSelect` ("corra"→"corre", `SubtitlesEditor.tsx`); (b) el canal del checkbox de 22px té zona morta — només el botó de 14px fa toggle; es podria reenviar el clic del canal al toggle per ampliar la diana; (c) `useState<Set<number>>(new Set())` alloca un Set per render — lazy init `useState(() => new Set<number>())`; (d) `onSegmentsBatchChange` declarat al final de la interfaz en lloc de després d'`onDelete`.
>
> >#### **Pla:**
> >* Agrupar-los en el proper retoc de `SubtitlesEditor.tsx`/`SegmentItem.tsx`; no obrir una tasca dedicada només per això.
>
> >#### **Arxius afectats:**
> >* `frontend/components/VideoSubtitlesEditor/SubtitlesEditor.tsx`, `SegmentItem.tsx`.
>
> >>##### **Risc:** 2/10 *(orig.: «bajo»)*
> >>##### **Dimensions:** 2/10 *(orig.: «pequeño»)*
> >>##### **Prioritat:** ⭐ (no consta)
>
> ---

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
> ## **SPS-0022. Polits menors del review final de cerca/substitució**
> >> ###### [🗒️] *[2026-07-07] | [hora no consta]*
>
> >#### **Síntoma / Context:**
> >* *(abans: pendent #9)* La revisió final de SPS-0006 (T6) va deixar 2 polits triats "LEAVE" (cap bloqueja res): (a) amb el focus als inputs de la barra de cerca, Ctrl+Z fa l'undo natiu de l'input, no el del document — conseqüència del `stopPropagation` total (decisió documentada al codi per la tecla Supr); Word/VSCode enruten l'undo al document; es podria delegar amb un prop `onUndo`; (b) si TOTES les substitucions d'un «Substituir-ho tot» són byte-idèntiques, el commit fa *bail* però el missatge diu igualment «S'han fet N substitucions» (cosmètic).
>
> >#### **Pla:**
> >* Agrupar-los en el proper retoc de `SearchReplaceBar.tsx`/`SubtitlesEditor.tsx`; no obrir tasca dedicada.
>
> >#### **Arxius afectats:**
> >* `frontend/components/VideoSubtitlesEditor/SearchReplaceBar.tsx`, `SubtitlesEditor.tsx`.
>
> >>##### **Risc:** 2/10 *(orig.: «bajo»)*
> >>##### **Dimensions:** 2/10 *(orig.: «pequeño»)*
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
> >* **Sub-parts ajornades:** model de ratolí per a estacionari/Duo (SPS-0014), presets explícits page/duo (SPS-0015).
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

---

## 🟡 **EN_PROCES**

> *Implementació ja feta (verificada tècnicament amb `tsc --noEmit`/`vite build`) però **pendent de verificació humana en navegador i/o decisió de commit** — per això, segons la semàntica del model nou, NO són ACABAT encara. Veure nota de migració a dalt. Ordenades de la més recent a la més antiga (mateix ordre que l'antic bloc TERMINADO).*

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

> *Tasques descartades o revertides. Cap fins ara en aquest projecte — secció buida, es manté per format.*

---

## 📌 Notes informatives (decisions preses — no reobrir sense context nou)

> *Aquestes dues entrades de l'antic `tareas.md` no són tasques amb estat (no encaixen a PENDENTS/EN_PROCES/ACABAT/CANCELATS): documenten decisions ja preses de NO fer alguna cosa. Es conserven aquí, en secció pròpia, perquè no es reobrin sense context — tal com demanava l'original ("Informacionales (no tocar)").*

### Residu acceptat — selecció múltiple sobreviu al sync d'SRT amb la mateixa longitud *(2026-07-07)*

Vincular un SRT nou sobre el mateix document (drag&drop o modal Vincular; també a l'standalone) substitueix tot l'array via `commit(parseSrt(...))` sense remount. La selecció múltiple (SPS-0003) es buida quan canvia `segments.length`; si el fitxer nou té **exactament el mateix nombre de blocs**, la selecció sobreviu apuntant al contingut nou.

**Decisió: no cobrir-ho.** Conseqüència acotada (els checkboxes queden visiblement marcats i el lot s'aplicaria a allò marcat); cobrir-ho exigiria un `docKey`/invalidació extra que no compensa. Detall a la spec local `docs/superpowers/specs/2026-07-01-multi-select-batch-format-design.md` §4.4.

### Notes de disseny — dreceres vs ratolí *(2026-07-07)*

Les **dreceres de teclat** (nudges Alt/Alt+Shift+fletxes, F9–F12, Ctrl+fletxes, Ctrl+Shift+M, Ctrl+Alt+V, etc.) són **independents del mode de scroll** → un sol joc, vàlid a pàgina i estacionari. No cal preset per mode per al teclat.

El que és dependent del mode és **només el ratolí**.

Documents relacionats: `Shortcuts Subtitols - Consolidat.csv`.

---
