# Història del projecte

Memòria llarga del projecte. NO és un diari de commits (git ja ho fa).
Només s'hi anota el que val la pena recordar per entendre el **«perquè»** de l'estat actual.

Categories que SÍ van aquí:
1. Bugs grossos resolts (sobretot si la causa arrel va ser rara o contraintuïtiva).
2. Decisions arquitectòniques grans.
3. Fites del projecte (features grans, integracions, subprojectes tancats).
4. Incidències (coses que es van trencar i com s'hi va reaccionar).

Ordre: cronològic invers (la més recent, a dalt).
Dates: absolutes, a la capçalera de cada entrada.

> [!NOTE]
> **Migració 2026-07-09.** Aquest arxiu substitueix l'antic `history.md` (format sense IDs),
> migrat al model `H-nnnnn` de `.claude/to_claude/kit-migracio-model/`. Backup íntegre a
> `.claude/_backup-migracio-2026-07-09/history.md`. Les 13 entrades originals es conserven
> **totes**, numerades `H-00001` (més antiga) a `H-00013` (més recent) per ordre de creació —
> reconstruït a partir de l'ordre cronològic invers que ja tenia l'arxiu original (l'entrada que
> hi apareixia més amunt = més recent). Les dates originals no incloïen hora — es manté només el
> dia. Els encapçalaments de secció s'han normalitzat al català del model nou (Tipus, Síntoma /
> Context, El que NO ha funcionat, Solució, Arxius modificats, Verificació, Lliçó, Follow-ups);
> el contingut de cada entrada es conserva íntegre. Referències creuades a tasques (abans «T1»,
> «tareas.md #N») s'han actualitzat als IDs nous `SPS-nnnn` de `tasks.md`.

<!--
Plantilla d'una entrada (copieu-la per crear-ne una de nova):

> ---
> ## **H-nnnnn** — [Títol curt]
> >> ###### *[aaaa-mm-dd]*
>
> >>#### **Tipus:**
> >> (fita · decisió arquitectònica · bug resolt · incidència)
> >>
> >>#### **Tasques relacionades:**
> >> * (ID de la tasca a tasks.md, p. ex. SPS-0001)
> >>
> >>#### **Síntoma / Context:**
> >> (text)
> >>
> >>#### **Descobriment que simplifica el disseny:**
> >> (text — opcional)
> >>
> >>#### **El que NO ha funcionat:**
> >> * **Títol**: (text)
> >> * **Títol**: (text)
> >>
> >>#### **Solució:**
> >> * (punt)
> >>
> >>#### **Arxius modificats:**
> >> * (ruta) (què hi va canviar)
> >>
> >>#### **Verificació:**
> >> (text)
> >>
> >>#### **Lliçó:**
> >> (text)
> >>
> >>#### **Follow-ups (moguts a tasks.md):**
> >> (text)
> ---

Notes:
- ID: «H-» + número de 5 dígits començant per 00001, en ordre de creació.
  Sol anar lligat amb algun element de la llista de tasks.md.
- La secció «El que NO ha funcionat» és la més valuosa: documentar carrerons descartats
  evita repetir investigacions que ja van costar hores.
- Les entrades NO es mouen ni s'esborren. Ordre cronològic invers (la més recent, a dalt).
-->

---

> ---
> ## **H-00014** — Bug: doble-clic i modificador+clic trencats en mode estacionari (Duo)
> >> ###### *[2026-07-13]*
>
> >>#### **Tipus:**
> >> Bug resolt
> >>
> >>#### **Tasques relacionades:**
> >> * SPS-0014 (abans: pendent #1)
> >>
> >>#### **Síntoma / Context:**
> >> El nou model de ratolí (clic=seek exacte sense recentrar, doble clic=seleccionar, modificador+clic=fixar cues) es va dissenyar i verificar íntegrament en mode **Pàgina** (SPS-0012/H-00012), que és el default de l'app. En mode **estacionari** (dins de Duo, l'opció alternativa que es manté per compatibilitat) el mateix model fallava: el doble-clic sovint no seleccionava l'esdeveniment correcte, i el modificador+clic (fixar cues) podia agafar un punt equivocat si just abans hi havia hagut un seek.
> >>
> >>#### **Descobriment que simplifica el disseny:**
> >> La causa NO era el model de clic/doble-clic en si (idèntic en tots dos modes), sinó l'efecte **"Auto-scroll when paused"** de `WaveformTimeline.tsx`: en estacionari recentrava la vista (`scrollLeft = px - viewportWidth/2`) en CADA canvi de `currentTime`, també quan el canvi venia d'un `onSeek` manual (clic) i no de reproducció real. És exactament la mateixa arrel que H-00011 ja va diagnosticar i resoldre per a Pàgina — només que aquell fix es va aplicar únicament al RAF loop de reproducció i a la branca `page` del mateix efecte pausat, deixant la branca `else` (estacionari) intacta amb el recentratge incondicional original.
> >>
> >>#### **El que NO ha funcionat** (carrerons ja descartats a H-00011, revisats i confirmats vàlids també aquí):
> >> * **"Ctrl+clic per editar" a estacionari** (l'esquema que la pròpia tasca SPS-0014 apuntava com a "probable" en incorporar-se): descartat pel mateix motiu que a H-00011 — afegeix fricció a l'operació més freqüent (ajustar temps) i introduiria DOS models de clic diferents entre Pàgina i estacionari dins la mateixa app, cosa que trenca la paritat que Fase B (SPS-0013) ja dona per feta (el modificador+clic fixa cues igual als dos modes).
> >> * **Tractar estacionari com a mode "llegat" sense tocar-lo:** descartat perquè el fix real (extreure el recentratge del camí de pausa) és petit, autocontingut en un sol fitxer i de risc baix — no hi havia motiu per deixar un bug conegut sense arreglar quan la causa arrel ja estava resolta per a l'altre mode.
> >>
> >>#### **Solució:**
> >> Estendre a estacionari el mateix principi de H-00011 («l'autoscroll no s'ha de recentrar mai en una acció manual — només ha de seguir durant la reproducció real»): l'efecte "Auto-scroll when paused" ja no branca per `scrollMode` — sempre aplica la lògica estil pàgina (només salta si el punt surt de la finestra visible, `px > sl + viewportWidth*0.97 || px < sl`). El RAF loop de reproducció real (`scrollModeRef.current === 'page' ? ... : scroll.scrollLeft = px - vw/2`), que SÍ distingeix els dos modes, queda intacte — és on estacionari conserva la seva identitat: cursor centrat de manera contínua mentre el vídeo es reprodueix de veritat. Efecte secundari acceptat: saltar el cursor en pausa (des de la llista, teclat, o restauració de posició en obrir un projecte) ja no centra el punt en estacionari, igual que ja no ho feia en Pàgina.
> >>
> >>#### **Arxius modificats:**
> >> * `frontend/components/VideoEditor/WaveformTimeline.tsx` (efecte "Auto-scroll when paused" — treu la branca `scrollMode==='page'`/`else` i la dependència `scrollMode`)
> >>
> >>#### **Verificació:**
> >> `tsc --noEmit` i `vite build` nets. Verificació manual en navegador (doble-clic i modificador+clic en estacionari dins Duo): **pendent** (tasques manuals a SPS-0014).
> >>
> >>#### **Lliçó:**
> >> Quan un fix de causa arrel es documenta explícitament com a decisió transversal ("l'autoscroll mai recentra en una acció manual"), val la pena comprovar TOTS els camins de codi que implementen la variant antiga del comportament, no només el que estava en context de la tasca original — H-00011 ja tenia la resposta correcta escrita, però només es va aplicar a la meitat dels llocs (RAF loop + branca `page`) i es va deixar la branca `else` d'estacionari amb el comportament vell, generant un segon bug amb la mateixa causa un cop coneguda.
> >>
> >>#### **Follow-ups (moguts a tasks.md):**
> >> * Presets d'interacció de ratolí page vs duo explícits (SPS-0015) — sense relació directa amb aquest fix, no bloquejant.
> >> * Verificació manual en navegador i decisió de commit (tasques manuals a SPS-0014).
> ---

---

> ---
> ## **H-00013** — Fita: Fase B (part 1) — modificador+clic per fixar cues a l'ona
> >> ###### *[2026-07-08]*
>
> >>#### **Tipus:**
> >> Fita
> >>
> >>#### **Tasques relacionades:**
> >> * SPS-0013 (abans: T13)
> >>
> >>#### **Síntoma / Context:**
> >> Segona fase del rediseny d'interacció de l'ona (SPS-0025). Afegeix l'eina de timing més ràpida de Subtitle Edit: **modificador+clic** (sense arrossegar) que fixa els temps de l'esdeveniment SELECCIONAT al punt clicat — Shift=inici, Ctrl/Cmd=final, Alt=inici mantenint durada (mou tot), Ctrl+Shift=ripple (desplaça l'actiu + tots els següents). Executat amb el flux autònom (spec → ralph-loop amb condicions de sortida objectives → implementació + verificació). **Descomposició deliberada:** Fase B són 4 sub-features; crear-arrossegant (necessita fer l'ona focusable + teclat Enter/Escape + dibuix d'un rang provisional — infra que HOY no existeix), scrub→Alt+Shift i Alt+vora=veí queden a Fase B2 (SPS-0028) per fiabilitat. Aquesta part 1 = només el modificador+clic (autocontingut, reutilitza la infra de cues del pare).
> >>
> >>#### **El que NO ha funcionat** (caçat pel ralph-loop, ronda 2 — bug de pèrdua de dades):
> >> * **Afegir el dispatch de cues a `handleMouseUp` sense afegir els 4 callbacks al seu dep array.** `handleMouseUp` és un `useCallback` amb deps `[clearHold, onSegmentUpdateEnd, onSeek, pixelToTime]` — cap d'elles canvia en editar un segment. Els handlers de cue del pare, en canvi, tanquen sobre `segments` (hi és a les seves deps → es recreen a cada edició). Sense els callbacks al dep array, `handleMouseUp` conserva la identitat de MUNTATGE i crida el callback de cue VELL, que fa `subsHistory.commit(segmentsOBSOLET.map(...))` → **revertiria totes les edicions fetes des del muntatge** (pèrdua de dades silenciosa). Es manifesta encara que NO es reprodueixi (el comparador de `React.memo` només curtcircuita durant `isPlaying`). `tsc`/`build` no ho detecten (no hi ha eslint react-hooks/exhaustive-deps). Fix: afegir `onSetCueStart/End/StartKeepDuration/RippleFromCue` al dep array de `handleMouseUp` (patró que el codi ja seguia: `handleDoubleClick` llista `onSegmentClick`).
> >> * (Ronda 1, minor) Prosa del ripple a la spec deia "índex > idxActiu" (només els següents) mentre el codi feia `i < idx return` (i>=idx, l'actiu inclòs). El codi és el correcte (si només es mogués l'actiu.start canviaria la durada de l'actiu i s'obriria forat amb el següent). Alineada la prosa.
> >>
> >>#### **Solució:**
> >> * `WaveformTimeline`: dispatch a la branca de clic simple de `handleMouseUp` (Ctrl+Shift→ripple, Shift→start, Ctrl/Cmd→end, Alt→startKeepDuration, cap→seek), amb els 4 callbacks al dep array. 4 props noves + al comparador de `React.memo`. **Repurposat Ctrl+clic:** eliminat el `seekOnly`/`getCtrlClickSeek` de la Fase 2 (3 punts + la funció) i el toggle de SettingsModal (ja no cal amb el mode Pàgina). Clau `WAVEFORM_CTRL_CLICK_SEEK` queda deprecada.
> >> * Pare (dues vistes): 4 `useCallback` que operen sobre `activeSegmentId` amb el temps rebut, reutilitzant els clamps de `handleSetTcIn`/`handleSetTcOut` (`gap`, `minDur`); ripple desplaça `i>=idx`; keep-duration clampa `[prevEnd+gap, nextStart-gap-dur]`. La standalone no tenia cap cue-setter — ara sí (autocontinguts).
> >> * **Ralph-loop:** 4 rondes (r1 minor prosa, r2 MAJOR dep-array, r3+r4 netes → sortida per 2 netes consecutives).
> >>
> >>#### **Arxius modificats:**
> >> * `frontend/components/VideoEditor/WaveformTimeline.tsx`
> >> * `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` i `VideoSrtStandaloneEditorView.tsx`
> >> * `frontend/components/SettingsModal.tsx`
> >> * Docs: `docs/superpowers/specs/2026-07-08-waveform-fase-b1-modifier-click-cues-design.md`, `docs/superpowers/plans/2026-07-08-waveform-fase-b1-modifier-click-cues.md`
> >>
> >>#### **Verificació:**
> >> `tsc --noEmit` + `vite build` nets. Harness (component real): clic amb Shift→`onSetCueStart(t)`, Ctrl→`onSetCueEnd(t)`, Cmd(meta)→`onSetCueEnd(t)`, Alt→`onSetCueStartKeepDuration(t)`, Ctrl+Shift→`onRippleFromCue(t)`, cap→`onSeek(t)` — cadascun dispara EXACTAMENT un callback amb el temps correcte, sense creuaments; `Ctrl+clic` ja no és seek pur. Verificació en navegador de l'app real (clamps + undo + les dues vistes): **pendent** (tasques manuals a SPS-0013).
> >>
> >>#### **Lliçó:**
> >> 1. Quan afegeixes una crida a un callback dins d'un `useCallback` (o `useMemo`), **afegeix el callback al dep array** — sobretot si aquell callback prové del pare i tanca sobre estat que canvia (aquí `segments`). Sense eslint `react-hooks/exhaustive-deps`, ni `tsc` ni el build ho detecten; el bug és silenciós i destructiu (revertir edicions). La revisió adversarial que EXECUTA la cadena de deps al codi real ho va caçar.
> >> 2. Descompon una fase gran quan una sub-feature necessita infraestructura nova (aquí: teclat + dibuix per a "crear-arrossegant"): entregar la part autocontinguda i verificable primer és millor que un pas gegant i arriscat.
> >>
> >>#### **Follow-ups (moguts a tasks.md):**
> >> * Fase B2 (SPS-0028): crear-arrossegant + scrub→Alt+Shift + Alt+vora=veí.
> >> * Verificació en navegador + decisió de commit (tasques manuals a SPS-0013).
> ---

---

> ---
> ## **H-00012** — Fita: Fase A del rediseny de l'ona — mode Pàgina/Duo (default page)
> >> ###### *[2026-07-08]*
>
> >>#### **Tipus:**
> >> Fita + decisió arquitectònica
> >>
> >>#### **Tasques relacionades:**
> >> * SPS-0012 (abans: T12)
> >>
> >>#### **Síntoma / Context:**
> >> Primera fase (base) del rediseny d'interacció del visualitzador d'ona (SPS-0025). Objectiu: fer del mode **pàgina** el comportament per defecte —que arregla el doble-clic sobre un esdeveniment i l'edició durant la reproducció— sense perdre l'estacionari, via una nova secció d'Ajustos "Ona d'àudio" amb dos modes **Pàgina** (default) i **Duo**. Executada amb el flux autònom de l'usuari: spec+pla datats → ralph-loop de revisió adversarial amb condicions de sortida objectives → implementació automàtica → verificació, sense confirmació intermèdia.
> >>
> >>#### **Descobriment que simplifica el disseny:**
> >> El problema del doble-clic NO calia arreglar-lo tocant l'autoscroll. En mode `'page'` l'efecte de follow (`WaveformTimeline.tsx` L445-448) **només** scrolla quan el cursor SURT de la finestra visible → un clic DINS la finestra no recentra. En canvi `'stationary'` (default vell) sempre centra (L451) → l'esdeveniment fuig i el segon clic falla. Per tant **defaultar a `page` ja fa el "no recentrar en seek manual"** de forma inherent; la Fase A no toca la lògica d'autoscroll.
> >>
> >>#### **El que NO ha funcionat** (caçat pel ralph-loop, ronda 1 — premissa falsa a la spec/pla):
> >> * **Assumir que `MediaPreviewView` renderitza `WaveformTimeline`** (l'spec el llistava com una de "les tres vistes" a modificar): FALS. `MediaPreviewView` renderitza `<VideoPlaybackArea>` i passa `scrollMode` com un **passthrough MORT** (documentat a `VideoPlaybackArea.tsx` L23: "Waveform-passthrough props (unused here, live at bottom waveform)"); no té ona. El seu botó estacionari/pàgina és un botó propi vestigial. Un implementador literal hauria editat props mortes i deixat el botó visible. Corregit: `MediaPreviewView` **fora d'abast**; només les dues vistes editores.
> >> * **Etiquetar l'objecte `playerProps` (~L1049 subtitles / ~L492 standalone) com a "punt on es passa el waveform"** (minor): la seva clau `scrollMode` és el mateix passthrough mort; el punt REAL és el `<WaveformTimeline>` JSX (subtitles ~L1181/L1188, standalone ~L616/L623). Corregit a reapuntar només al JSX.
> >>
> >>#### **Solució:**
> >> * Clau `WAVEFORM_VIEW_MODE` (`'page'|'duo'`, default `'page'`) + factoryReset. Control segmentat Pàgina/Duo a `SettingsModal` (secció de l'ona). Les dues vistes editores llegeixen la clau amb `useLocalStorage` (sync en viu via StorageEvent) i deriven `effectiveScrollMode = waveViewMode==='page' ? 'page' : scrollModeWave`, que passen com a `scrollMode`/`scrollModeWave` al `<WaveformTimeline>` + `scrollModeLocked={waveViewMode==='page'}`.
> >> * `WaveformTimeline`: nova prop `scrollModeLocked`; el botó intern de mode es manté renderitzat però amb `invisible pointer-events-none` + guard a l'`onClick` + `aria-hidden`/`tabIndex=-1` quan està bloquejat (ocupa espai, no mou res). Afegit al comparador de `React.memo`.
> >> * Mode Duo = 100% comportament actual (estat local `scrollModeWave` intacte, botó visible).
> >> * **Ralph-loop:** 4 rondes (r1: 2 major + 2 minor, tots el mateix defecte de MediaPreviewView → corregit; r2: 1 minor de referència creuada §4.7→§4.6 → corregit; r3 i r4: netes). Sortida per les dues condicions (2 netes consecutives + 3 sense-blocking).
> >>
> >>#### **Arxius modificats:**
> >> * `frontend/constants.ts` (+clau), `frontend/utils/factoryReset.ts` (+key)
> >> * `frontend/components/VideoEditor/WaveformTimeline.tsx` (prop `scrollModeLocked` + botó ocult/inert + comparador memo)
> >> * `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` i `VideoSrtStandaloneEditorView.tsx` (`waveViewMode` + `effectiveScrollMode` + props JSX)
> >> * `frontend/components/SettingsModal.tsx` (estat + control Pàgina/Duo)
> >> * Docs: `docs/superpowers/specs/2026-07-07-waveform-fase-a-page-duo-design.md`, `docs/superpowers/plans/2026-07-07-waveform-fase-a-page-duo.md`, `Shortcuts Subtitols - Consolidat.csv`
> >>
> >>#### **Verificació:**
> >> `tsc --noEmit` + `vite build` nets. Harness (component real): en Pàgina el botó de mode és al DOM amb `visibility:hidden`/`pointer-events:none` i ocupa 20×20 px (espai preservat), inert al clic; en Duo és visible i el clic canvia el mode; doble-clic sobre un esdeveniment el selecciona. Verificació en navegador de l'app real: **pendent** (tasques manuals a SPS-0012).
> >>
> >>#### **Lliçó:**
> >> 1. Abans d'escriure una spec que enumera "les N vistes/components afectats", **verifica amb grep** que cadascun realment usa el símbol que creus (aquí: `<WaveformTimeline>`). Una premissa d'abast falsa fa una tasca sencera inexecutable; el ralph-loop la va caçar a la ronda 1 perquè els revisors grepejaven el codi real en comptes de confiar en la spec.
> >> 2. Quan un mode ja existent (`page`) té la propietat que vols (no recentrar en clic), la implementació més neta és **canviar el default i bloquejar-lo**, no reescriure la lògica. Menys codi, menys risc.
> >> 3. Amagar un control mantenint el layout: `invisible` (visibility:hidden) + `pointer-events-none` + guard a l'handler, deixant l'element al DOM — no `hidden`/desmuntar-lo (mouria la resta).
> >>
> >>#### **Follow-ups (moguts a tasks.md):**
> >> * Fase B (SPS-0013/SPS-0028) i Fase C del rediseny (dins SPS-0025); estacionari-en-Duo (SPS-0014).
> >> * Verificació en navegador + decisió de commit (tasques manuals a SPS-0012).
> ---

---

> ---
> ## **H-00011** — Decisió arquitectònica: model d'interacció del visualitzador d'ona (+ Fase 1/2 de drag)
> >> ###### *[2026-07-07]*
>
> >>#### **Tipus:**
> >> Decisió arquitectònica + fita
> >>
> >>#### **Tasques relacionades:**
> >> * SPS-0008, SPS-0009, SPS-0010 (abans: T8, T9, T10) · engendra SPS-0025 (abans: pendent #12)
> >>
> >>#### **Síntoma / Context:**
> >> Petició inicial: baixar el "temps de hold" per arrossegar esdeveniments a l'ona (els usuaris de proves el trobaven lent, ~0,5 s). Va derivar en una sessió llarga de disseny de tota la interacció del visualitzador d'ona, estudiant el **codi font de Subtitle Edit** (clonat a scratchpad) per buscar paritat + millores de Nuendo. Es van implementar dues fases contingudes i es va tancar el disseny del rediseny complet (→ SPS-0025).
> >>
> >>#### **El que NO ha funcionat** (carrerons descartats al buscar per què el DOBLE-CLIC sobre un esdeveniment era impossible):
> >> * **Suposar que el seek es feia al `mousedown`:** fals — ja es feia al `mouseUp` (hi ha el comentari "Don't seek on mouseDown — decision happens on mouseUp"). Canviar down↔up no arreglava res.
> >> * **"Ctrl per editar" (obligar Ctrl per arrossegar events; ratolí sol = només navegar):** descartat — afegeix fricció a l'operació més freqüent (ajustar temps), deixa la Fase 1 (hold+zona morta) sense ús, i divergeix de SE (que arrossega SENSE modificador).
> >> * **"Ctrl per moure el cursor" (seek només amb Ctrl+clic):** descartat — trenca el gest més bàsic de SE ("single click: go to position") i, un cop arreglat l'autoscroll, és innecessari (el clic normal ja és segur).
> >> * **`Ctrl+Shift`+arrossegar per a l'scrub:** descartat — col·lisiona amb `Ctrl+Shift`+clic (ripple, destructiu) via el camí "drag curt < zona morta = clic". Regla: mai barrejar una acció destructiva i una de navegació al mateix modificador. L'scrub va a `Alt+Shift`+arrossegar (sense acció de clic → segur).
> >>
> >>#### **Solució (decisió + implementat):**
> >> * **Arrel del problema del doble-clic i de l'edició durant playback = l'autoscroll recentrant la vista a cada seek manual.** Verificat al codi font de SE (`AudioVisualizer.cs`): el follow és **page-style** (només scrolla quan el cursor SURT de la finestra visible; no recentra en clic), amb un slop clic/drag de **3 px** i gestos `Tapped`/`DoubleTapped` del framework. **Decisió: adoptar page-follow únic + no recentrar en seek manual** com a base (→ Fase A de SPS-0025). No cal ni "Ctrl per editar" ni "Ctrl per seek".
> >> * **Implementat i verificat (harness aïllat amb el component real + esdeveniments sintètics), sense commit:**
> >>   - *Fase 1 (SPS-0008):* `WAVEFORM_HOLD_MS` default 500→**50 ms** + nova `WAVEFORM_DRAG_DEADZONE_PX` (6 px, anti-tremolor, amb reancoratge al creuar la zona morta per evitar el "salt").
> >>   - *Fase 2 (SPS-0009):* `WAVEFORM_CTRL_CLICK_SEEK` (default true) → Ctrl/Cmd+clic = seek pur, Ctrl/Cmd+drag = scrub. **Es reaprofitarà/substituirà** pel rediseny (amb page-mode el clic ja és segur i `Ctrl+clic` passarà a "fixar final", estil SE — veure SPS-0013).
> >>   - *Model de clic (SPS-0010):* clic simple = seek al punt EXACTE (no a l'inici del bloc); doble clic = seleccionar; guardes perquè els clics a la barra superior no facin seek (`mouseDownActiveRef`) ni el doble-clic seleccioni (`scrollRef.contains`).
> >> * **Esquema mestre** de tota la interacció (ratolí + dreceres, paritat SE + Nuendo) consolidat a `Shortcuts Subtitols - Consolidat.csv` (arrel).
> >>
> >>#### **Arxius modificats:**
> >> * `frontend/components/VideoEditor/WaveformTimeline.tsx` (hold, zona morta, reancoratge, seekOnly Ctrl, model clic/doble-clic, guardes de la barra)
> >> * `frontend/components/SettingsModal.tsx`, `frontend/constants.ts`, `frontend/utils/factoryReset.ts` (claus noves + controls)
> >> * `backend_nest_mvp/tsconfig.json` (fix col·lateral del warning `baseUrl` deprecat — veure SPS-0011)
> >> * Docs: `Shortcuts Subtitols - Consolidat.csv`, specs/plans de Fase 1/2 a `docs/superpowers/`
> >>
> >>#### **Verificació:**
> >> Harness aïllat amb el component real i esdeveniments de ratolí sintètics (ctrlKey/metaKey, hold, deadzone). Verificació en navegador de l'app real: **pendent** (tasques manuals a SPS-0008/SPS-0009/SPS-0010).
> >>
> >>#### **Lliçó:**
> >> Quan la vista es mou sola (autoscroll) i alhora s'hi vol interactuar amb el ratolí, són forces oposades: la solució no és afegir modificadors al ratolí sinó **desacoblar l'autoscroll de les accions manuals** (seguir només durant playback, mai recentrar en un clic). Abans d'inventar un model d'interacció nou, val la pena llegir com ho resol una eina de referència oberta (SE): va estalviar dos carrerons sencers (Ctrl-per-editar i Ctrl-per-seek). I cap modificador ha de compartir una acció destructiva (ripple) amb una de navegació (scrub) — el llindar clic/drag fa que un drag curt es converteixi en clic.
> >>
> >>#### **Follow-ups (moguts a tasks.md):**
> >> * Rediseny complet Fases A/B/C (SPS-0025), detecció de canvis de pla (SPS-0026), presets per frames (SPS-0027).
> >> * Model de ratolí per a estacionari/Duo (SPS-0014), presets page/duo (SPS-0015).
> >> * Verificació en navegador i decisió de commit del working tree actual.
> ---

---

> ---
> ## **H-00010** — Bug: warning fantasma de `baseUrl` deprecat al tsconfig del backend
> >> ###### *[2026-07-07]*
>
> >>#### **Tipus:**
> >> Bug resolt (entorn / tooling)
> >>
> >>#### **Tasques relacionades:**
> >> * SPS-0011 (abans: T11)
> >>
> >>#### **Síntoma / Context:**
> >> VS Code marcava en vermell `backend_nest_mvp/tsconfig.json:13`: "Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0. Specify compilerOption '`"ignoreDeprecations": "6.0"`' to silence this error." Contraintuïtiu: el `tsc` del workspace (**5.9.3**) compilava **net** (`tsc --noEmit` exit 0) i el fitxer ja tenia `"ignoreDeprecations": "5.0"`. El diagnòstic persistia fins i tot després de tancar/obrir el panell Problems.
> >>
> >>#### **El que NO ha funcionat:**
> >> * **Pujar `ignoreDeprecations` de "5.0" a "6.0"** (el que suggereix el propi missatge): el `tsc` 5.9.3 del workspace el **rebutja** amb `error TS5103: Invalid value for '--ignoreDeprecations'` → trencaria el build real per silenciar un subratllat de l'editor. Descartat.
> >> * **Reiniciar via el panell Problems / reobrir-lo:** no reinicia el servidor de TS; el diagnòstic ranci persisteix. A més, el comandament "TypeScript: Restart TS Server" NOMÉS apareix amb una pestanya `.ts`/`.js` activa (un `tsconfig.json` és JSON) → cal "Developer: Reload Window" o obrir un `.ts` primer.
> >>
> >>#### **Solució:**
> >> La causa és que el **TS intern del VS Code és més nou** que el 5.9.3 del workspace i marca `baseUrl` com a deprecat-per-eliminar a TS 7.0 (una onada que el valor `"5.0"` ja no cobreix). Com que `baseUrl` **no s'usa** (cap import no-relatiu a `src/`, cap `paths`, cap `tsconfig-paths` a nest-cli/package), s'**eliminen `baseUrl` i `ignoreDeprecations`** → config vàlida a qualsevol versió de TS, sense silenciadors.
> >>
> >>#### **Arxius modificats:**
> >> * `backend_nest_mvp/tsconfig.json` (fora `baseUrl` i `ignoreDeprecations`)
> >>
> >>#### **Verificació:**
> >> `tsc --noEmit` i `nest build` → exit 0.
> >>
> >>#### **Lliçó:**
> >> Un subratllat de TypeScript al VS Code que el `tsc` de la CLI NO reprodueix és quasi sempre un **desajust de versió** (el TS del VS Code ≠ el del workspace). Abans de silenciar amb `ignoreDeprecations`, comprova que el teu `tsc` accepta el valor (una versió anterior el rebutja) i, si l'opció deprecada no s'usa, **elimina-la** en comptes de silenciar-la — així val a totes les versions. `baseUrl` sense `paths` sol ser vestigial de la plantilla de Nest.
> >>
> >>#### **Follow-ups (moguts a tasks.md):**
> >> * Cap (decisió de commit pendent, agrupada amb SPS-0008/SPS-0009/SPS-0010).
> ---

---

> ---
> ## **H-00009** — Fita: Restaurar l'última posició en reobrir un projecte de subtítols
> >> ###### *[2026-07-07]*
>
> >>#### **Tipus:**
> >> Fita + decisió arquitectònica
> >>
> >>#### **Tasques relacionades:**
> >> * SPS-0007 (abans: T7)
> >>
> >>#### **Síntoma / Context:**
> >> L'editor de subtítols sempre obria a 0:00. Petició de l'usuari: en reobrir un projecte, tornar al punt on es va quedar l'últim cop (posició del vídeo + subtítol actiu). Decisió de persistència validada amb l'usuari: **backend** (`project.settings.resumeState`, cross-device) en lloc de localStorage. L'editor es clava en un `document` (l'SRT), no en un projecte; el projecte es resol de forma asíncrona via `getProjectBySrt`. El punt crític del disseny és el timing: `handleSyncMedia` força `currentTime`/`duration` a 0 en carregar el vídeo, així que la restauració ha d'esperar a conèixer la durada real.
> >>
> >>#### **El que NO ha funcionat** (6 iteracions de ralph-loop sobre el DISSENY, abans de codificar; cada troballa és un carreró evitat en execució):
> >> * **Guard `resumeApplied` acoblat a "hi havia res a restaurar" (crític, it1):** el primer disseny no marcava `resumeApplied` si no hi havia resum previ → per a un projecte nou (cas universal en el primer ús) el desat no arrencava mai → la feature no bootstrapava. Fix: desacoblar "llest per desar" de "hi havia resum"; marcar aplicat també quan l'editor s'estabilitza sense resum.
> >> * **Branca sense-vídeo morta + cursa de càrrega (majors it1):** l'efecte d'aplicació depenia només de `[duration]` amb un `duration<=0 return` que feia inabastable la branca sense-vídeo; i `pendingResume` en un **ref** no re-disparava l'efecte si el fetch resolia després que `duration` canviés. Fix: `pendingResume`/`resumeLoaded`/`resumeApplied` en **state** (re-avaluen l'efecte), deps completes.
> >> * **Debounce que mai disparava durant la reproducció (major it1):** un debounce de 1500ms es reiniciava a cada canvi de `currentTime` (~250ms) → no desava mai mentre es reproduïa. Fix: **throttle** de 5s amb flanc principal + un únic timer de cua no reiniciable.
> >> * **L'efecte de sync-per-temps sobreescrivia l'`activeSegmentId` restaurat (major it1):** a l'standalone, `setActiveSegmentId(restored)` amb `currentTime=0` feia que l'efecte "sync active segment by time" tornés al primer bloc. Fix: cas amb vídeo → NO forcem el segment (es deriva del temps); cas sense vídeo → alineem `currentTime = seg.startTime` perquè l'efecte de sync trobi el mateix segment.
> >> * **Throttle de cua desava valor obsolet (major it2):** `write()` capturava `t`/`seg` del render que va armar el timer, no del moment de disparar-se. Fix: `commit()` llegeix `latestRef.current` AL DISPAR.
> >> * **`flush()` sense guards → clobber amb 0 (major it2):** tancar abans d'aplicar la restauració feia un PATCH amb `currentTime: 0` (o a `/projects/null/...`). Fix: `flush()` reutilitza `commit()` i n'hereta els guards (`useBackendRef`, `resumeAppliedRef` — ref, llegible des de cleanups —, `projectIdRef` no-null).
> >> * **Estat de vídeo residual en canviar de document (major it3):** les vistes reinicien l'estat de vídeo NOMÉS dins `handleSyncMedia`, i `autoLoadAttemptedRef` no es reinicia en canviar de `docId`; sense remuntar, obrir B a la mateixa instància restaurava B contra el vídeo d'A. Fix: `key={currentDoc.id}` a les vistes d'editor (`App.tsx`) → editor net per document; el flush del sortint es fa al desmuntatge.
> >> * **Premissa falsa "el vídeo no es carrega mai via `project.mediaDocumentId`" (reclassificat it5):** un revisor ho va marcar com a regressió major (delay de 8s). Verificat directament a `App.tsx:450`: l'efecte de sync dispara amb `linkedMediaId || proj.mediaDocumentId || proj.mediaDocId` → el `mediaDocumentId` SÍ és un fallback de càrrega. La "regressió" quedava refutada; residu real = prosa imprecisa (severitat minor). Reclassificat major→minor **verificant, no racionalitzant** (regla de receiving-code-review).
> >>
> >>#### **Solució:**
> >> * **Backend:** `setResumeState(projectId, {currentTime, activeSegmentId})` a `projects.service.ts` (clamp `currentTime>=0`, `$set` niat `settings.resumeState`, `NotFoundException` si `matchedCount===0` — NO reutilitza `updateProject`, que clobberjaria el bag). Ruta `@Patch('/:id/resume-state')` a `projects.controller.ts` (import `Patch` afegit; validació inline com `setGuion`, el `ValidationPipe` global fa skip dels bodies amb metatype `Object`).
> >> * **Frontend:** `api.saveResumeState` (PATCH, token per capçalera). Hook compartit `frontend/hooks/useResumePosition.ts`: fetch propi de `getProjectBySrt` (dues vistes idèntiques; tradeoff = 2a lectura a la vista principal), `mediaExpectedRef` del `proj.mediaDocumentId`, `mediaReady=duration>0` derivat, xarxa de seguretat `settleTimeout` de 8s (`forceSettle`) perquè un vídeo que no arriba mai bootstrapi igualment, throttle de desat i `flush` amb guards. Reutilitza el `onSeek` existent de cada vista com a `seekTo` (manté `currentTimeRef`/BroadcastChannel del guió coherents).
> >> * **Procés:** spec amb tot el pseudocodi → ralph-loop de 6 iteracions (subagents revisors adversarials verificant contra el codi real; sortida per 3 revisions consecutives només-minor) → execució amb subagents (backend + frontend-core en paral·lel, després wiring) → `tsc --noEmit` net a frontend i backend.
> >>
> >>#### **Arxius modificats:**
> >> * `backend_nest_mvp/src/modules/projects/projects.service.ts` (`setResumeState`)
> >> * `backend_nest_mvp/src/modules/projects/projects.controller.ts` (ruta PATCH + import `Patch`)
> >> * `frontend/services/api.ts` (`saveResumeState`)
> >> * `frontend/hooks/useResumePosition.ts` (nou)
> >> * `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` i `VideoSrtStandaloneEditorView.tsx` (consum del hook + flush)
> >> * `frontend/App.tsx` (`key={currentDoc.id}` a les vistes d'editor)
> >> * Docs: `docs/superpowers/specs/2026-07-03-resume-editor-position-design.md`, `.claude/ralph-loop-ledger.md`
> >>
> >>#### **Verificació:**
> >> `tsc --noEmit` net a frontend i backend. Verificació manual en navegador (proves 5-14 de la spec): **pendent** (tasques manuals a SPS-0007).
> >>
> >>#### **Lliçó:**
> >> 1. En un hook de restauració que depèn de dades asíncrones (fetch del projecte) i d'esdeveniments del media (durada), el que es vol re-avaluar en un efecte ha d'anar en **state**, no en refs; però el que es llegeix des d'un **cleanup** (flush a l'unmount) ha d'anar en **refs** (l'state hi queda capturat al de muntatge). Aquesta tensió state-vs-ref és el nucli de la meitat dels bugs del disseny.
> >> 2. Per desar periòdicament durant un valor que canvia sovint, throttle (flanc principal + cua no reiniciable que llegeix l'últim valor AL DISPAR), mai debounce.
> >> 3. Quan un estat de component depèn de dades que canvien amb el `docId` però la instància es reutilitza (renderitzada sense `key`), qualsevol ref-guard que no es reinicii (`autoLoadAttemptedRef`) filtra estat del document anterior: `key={docId}` és el fix més net.
> >> 4. La revisió adversarial iterativa ha de **verificar les troballes contra el codi real**: un revisor va marcar una regressió major basada en una premissa falsa (mediaDocumentId no carrega vídeo); comprovar `App.tsx:450` la va refutar. Reclassificar una troballa exigeix evidència, no conveniència.
> >>
> >>#### **Follow-ups (moguts a tasks.md):**
> >> * [SEGURETAT · HIGH] Treure el JWT de la URL de streaming de media (SPS-0023) — preexistent, surtat per la revisió de seguretat d'aquesta sessió; no introduït per aquesta feature.
> >> * Evitar la doble crida `getProjectBySrt` a la vista principal (SPS-0024, optimització).
> >> * Verificació manual en navegador (proves 5-14) + decisió de commit (tasques manuals a SPS-0007).
> ---

---

> ---
> ## **H-00008** — Fita: Cerca i substitució tipus Word a l'editor de subtítols
> >> ###### *[2026-07-07]*
>
> >>#### **Tipus:**
> >> Fita + decisió arquitectònica
> >>
> >>#### **Tasques relacionades:**
> >> * SPS-0006 (abans: T6)
> >>
> >>#### **Síntoma / Context:**
> >> L'editor de subtítols no tenia manera de localitzar un terme ni de substituir-lo (corregir un nom mal transcrit en centenars de blocs = repàs visual un a un). Petició de l'usuari: buscador tipus Microsoft Word a la part superior — cerca de termes exactes amb opcions, substituir d'un en un o tot de cop. Decisió d'abast validada: NOMÉS l'editor de subtítols; l'editor de guions (dues columnes original/traducció) queda per a una tasca futura (→ SPS-0020). Aclariment funcional important: en aquest editor cada subtítol té UN sol text visible (el camp `translatedText` del tipus `Segment` és llegat i no es mostra) — la confusió inicial de l'usuari venia del nom intern `originalText`.
> >>
> >>#### **El que NO ha funcionat:**
> >> * **Scroll v1 — efecte amb dependència de l'array `matches`:** `matches` és un `useMemo` sobre `segments`, i el draft d'edició arriba VIU per props → l'array és NOU a cada pulsació dins de qualsevol contentEditable. Amb la barra oberta, teclejar en qualsevol bloc re-disparava el `scrollToIndex` i arrossegava el viewport cap a la coincidència activa a cada tecla.
> >> * **Scroll v2 — dependències derivades de la POSICIÓ de l'activa** (`activeMatchSeg`/`activeMatchStart`): seguia disparant quan una edició desplaçava l'índex o el `start` de l'activa; una simulació fidel a React (efectes post-commit en ordre de declaració, deps per `Object.is`) va demostrar a més un doble scroll amb un frame d'índex caducat en afegir una ocurrència en un bloc anterior a l'activa.
> >> * **Scroll v3 (definitiu) encara amb un forat:** scroll per INTENCIÓ (`pendingScrollRef` marcat per terme/opcions nous i per Substituir; scroll imperatiu a `gotoMatch`). Però substituir per text idèntic deixava el flag ORFE: `commitHistory` fa *bail* per igualtat profunda (`JSON.stringify(present) === JSON.stringify(next)`) → cap re-render consumia el flag → la següent edició en qualsevol bloc scrollejava. Fix: guard `newRaw === originalText` que no toca flags i salta a la següent com Word.
> >> * **Assumir que els inputs de la barra quedaven aïllats dels atajos:** la combo `Delete` (`sub_delete`) està registrada a `DEFAULT_SHORTCUTS` i `useKeyboardShortcuts` fa `e.preventDefault()` en trobar QUALSEVOL combo encara que cap vista tracti l'acció (i el guard d'inputs només salta tecles d'1 caràcter: 'Delete'.length === 6) → sense `stopPropagation` de TOTES les tecles, la tecla Supr no esborraria text als inputs. I amb `stopPropagation`, Ctrl+F dins dels inputs ja no arriba al listener global → cal tractar-lo localment o el navegador obre el SEU cercador natiu.
> >> * **Assumir correspondència exacta text visible ↔ DOM:** falsa amb tokens no canònics (`<font …>`): `plainToRich` els mostra com a TEXT LITERAL però `toVisibleText` els elimina → el ressaltat es pintaria desplaçat. Fix: guard `domVisibleLength(editable) !== toVisibleText(text).length` → el segment no es pinta (cerca/comptador/substitució segueixen funcionant).
> >> * **NBSP crus invisibles als documents de disseny:** el codi del pla contenia U+00A0 literals que semblaven espais normals — un retipeig els perdria en silenci. Norma adoptada: als strings de codi sempre escapes explícits; el caràcter cru només a la prosa.
> >>
> >>#### **Solució:**
> >> Mòdul pur `searchReplace.ts` (model de caràcters visibles amb pila de tags canònics: `toVisibleText`, `findMatchesInText` — literal, case-fold per caràcter que preserva longituds UTF-16, paraula completa amb `\p{L}\p{N}` —, `findMatches`, `replaceVisibleRange` — el text inserit hereta la pila del 1r caràcter substituït, re-serialització balancejada per línia, mai parells buits). UI en `SearchReplaceBar.tsx` (component controlat) integrada a `SubtitlesEditorInner` (estat, matches memoitzats, re-ancoratge per posició, ressaltat amb CSS Custom Highlight API sobre les files virtualitzades, scroll per intenció). Substitucions via `onSegmentsBatchChange` existent → 1 pas d'undo per operació i `richText: ''` garantit per les vistes. Drecera `FIND`/Ctrl+F afegida als defaults (mergeShortcuts la propaga a usuaris amb prefs de backend). Procés: spec + pla amb tot el codi → **ralph-loop de 7 iteracions de revisió adversarial** (subagents executant la lògica de veritat amb node/esbuild i simulant React; sortida per 2 iteracions consecutives amb 0 BUG) → execució amb subagents (implementador + revisor per task + revisió final holística: READY TO HAND OFF YES, 0 critical/important).
> >>
> >>#### **Arxius modificats:**
> >> * `frontend/utils/SubtitlesEditor/searchReplace.ts` (nou)
> >> * `frontend/components/VideoSubtitlesEditor/SearchReplaceBar.tsx` (nou)
> >> * `frontend/components/VideoSubtitlesEditor/SubtitlesEditor.tsx`
> >> * `frontend/constants.ts` (drecera `sub_find`)
> >> * `frontend/index.html` (regles `::highlight()`)
> >> * Docs: `docs/superpowers/specs/2026-07-02-search-replace-subtitles-design.md`, `docs/superpowers/plans/2026-07-02-search-replace-subtitles.md`, `docs/superpowers/plans/2026-07-02-search-replace-review-log.md`
> >>
> >>#### **Verificació:**
> >> 40/40 casos de lògica pura, `tsc` + build nets, revisió final «READY TO HAND OFF: YES». Verificació manual en navegador (les dues vistes): **pendent** (tasques manuals a SPS-0006).
> >>
> >>#### **Lliçó:**
> >> 1. Un efecte que depèn d'un valor recalculat a cada render (arrays derivats d'estat viu) es dispara a cada pulsació: per a reaccions a ACCIONS de l'usuari (scroll, focus), modela la intenció explícitament (flag consumible o crida imperativa al handler), mai la derivis de la identitat de les dades. El mateix bug de scroll va necessitar 3 intents — les dues primeres "correccions" només movien el problema de lloc.
> >> 2. Un `setState` que no canvia res (bail per igualtat) NO produeix re-render: qualsevol protocol de "flag que consumirà el següent render" ha de cobrir el camí en què el render mai arriba.
> >> 3. Amb un sistema d'atajos globals que fa `preventDefault` per combos registrades, un input de text nou dins d'aquella superfície necessita `stopPropagation` de TOTES les tecles (no només les que tracta) i re-implementar localment les combos que sí vol (Ctrl+F).
> >> 4. La revisió adversarial iterativa del DISSENY (executant la lògica real i simulant la semàntica de React abans de codificar) va caçar 9 bugs i va deixar la implementació en transcripció verificada: cap bug nou va aparèixer en execució.
> >>
> >>#### **Follow-ups (moguts a tasks.md):**
> >> * Cerca/substitució a l'editor de guions amb selector de columna (SPS-0020).
> >> * Instal·lar `@types/react` — el typecheck actual valida menys del que sembla (SPS-0021).
> >> * 2 polits LEAVE del review final: Ctrl+Z natiu als inputs de la barra; missatge N en no-op total (SPS-0022).
> >> * Verificació manual en navegador + decisió de commit (tasques manuals a SPS-0006).
> ---

---

> ---
> ## **H-00007** — Bug: en reobrir un projecte tornava al vídeo original, no a l'últim vinculat
> >> ###### *[2026-07-07]*
>
> >>#### **Tipus:**
> >> Bug resolt
> >>
> >>#### **Tasques relacionades:**
> >> * SPS-0005 (abans: T5)
> >>
> >>#### **Síntoma / Context:**
> >> Flux de l'usuari: crear un projecte amb el vídeo A (versió catalana), transcriure, importar/canviar al vídeo B (original en anglès) a l'editor, guardar i tancar. L'endemà, reobrir el projecte tornava a carregar el vídeo A (l'original de la creació) en lloc de l'últim seleccionat (B). La causa era un desajust entre **on es guarda el canvi de vídeo** i **on es llegeix en reobrir**:
> >> - **Guardar (correcte):** en canviar de vídeo, `handleSyncMedia` de `VideoSubtitlesEditorView` crida `api.linkMediaToSrt(currentDoc.id, doc.id)` → `PATCH /documents/{srt}` amb `{ linkedMediaId }`. El nou vídeo es persisteix al camp `linkedMediaId` del document SRT. ✅
> >> - **Llegir (bug):** en obrir/reobrir, els dos efectes de sync de `App.tsx` llegien el vídeo del camp `mediaDocumentId` del **registre del projecte**, que només s'estableix a la CREACIÓ del projecte i **mai s'actualitza** en canviar de vídeo. Sempre disparaven `TRIGGER_SYNC_REQUEST` amb el vídeo original. ❌
> >>
> >>#### **El que NO ha funcionat:**
> >> * **Confiar en l'auto-load intern de l'editor** (`VideoSubtitlesEditorView`/`VideoSrtStandaloneEditorView` ja llegien `linkedMediaId` correctament, useEffect amb `autoLoadAttemptedRef`): arriba massa tard. L'efecte d'`App.tsx` ja ha disparat el `TRIGGER_SYNC_REQUEST` amb el vídeo dolent abans que l'editor munti, i l'auto-load intern només torna a disparar-se quan canvia `state.documents`. En reobrir el projecte, el codi dolent d'`App.tsx` s'executava de nou i reimposava l'original.
> >> * **Actualitzar `project.mediaDocumentId` al backend en vincular media** (fer que el registre del projecte reflectís el vídeo actual): descartat com a fix PRIMARI. Té més blast radius (toca `backend_nest_mvp/src/modules/projects/` i creuar la frontera cap al mòdul Projectes), quan el problema real és de **lectura** al frontend. `linkedMediaId` de l'SRT ja és la font de veritat de l'últim vídeo; només calia llegir-la. Queda com a follow-up opcional (coherència del registre, no bloqueja) — veure SPS-0019.
> >>
> >>#### **Solució:**
> >> Fix mínim al costat de LECTURA, simètric als dos efectes de sync d'`App.tsx` (obertura de pestanya principal i pestanya de l'editor de vídeo): prioritzar el `linkedMediaId` del document SRT (l'últim vídeo seleccionat) i usar el `mediaDocumentId` del projecte només com a fallback.
> >> ```ts
> >> const linkedId = (doc as any).linkedMediaId as string | null | undefined;
> >> const mediaId = linkedId || proj?.mediaDocumentId || proj?.mediaDocId;
> >> ```
> >> `doc` ja estava disponible dins de tots dos efectes (es busca a `state.documents` per l'`openDocId`/`docId`). Sense tocar backend ni el flux de guardat (que ja funcionava).
> >>
> >>#### **Arxius modificats:**
> >> * `frontend/App.tsx` — dos punts de sync de media (obertura de pestanya i editor de vídeo): `linkedMediaId` prioritzat sobre `mediaDocumentId`.
> >>
> >>#### **Verificació:**
> >> `tsc --noEmit` net (exit 0). Verificació manual en navegador del cicle canviar vídeo → guardar → reobrir: **pendent** (tasques manuals a SPS-0005).
> >>
> >>#### **Lliçó:**
> >> Quan un valor es pot escriure en dos llocs (aquí: `linkedMediaId` de l'SRT vs `mediaDocumentId` del projecte), el camí de lectura ha de coincidir amb el d'escriptura o l'estat "reviu" el valor obsolet. El `mediaDocumentId` del projecte és un snapshot de la creació, no la font de veritat de l'últim vídeo — aquesta és `linkedMediaId`. I un "auto-load correcte" dins d'un component fill no arregla una lectura dolenta feta abans (a `App.tsx`) que s'executa cada cop que s'obre la pestanya: cal arreglar-ho al punt més amunt on es dispara la càrrega inicial.
> >>
> >>#### **Follow-ups (moguts a tasks.md):**
> >> * Sincronitzar `project.mediaDocumentId` al backend en vincular media (SPS-0019, opcional, coherència del registre).
> >> * Verificació manual en navegador del cicle canviar vídeo → guardar → reobrir + decisió de commit d'`App.tsx` (tasques manuals a SPS-0005).
> ---

---

> ---
> ## **H-00006** — Bug + decisió: inserir subtítol al cursor i "+després" trepitjava el veí
> >> ###### *[2026-07-07]*
>
> >>#### **Tipus:**
> >> Bug resolt + decisió funcional
> >>
> >>#### **Tasques relacionades:**
> >> * SPS-0004 (abans: T4)
> >>
> >>#### **Síntoma / Context:**
> >> Dos problemes a l'inserció de subtítols de l'editor (dues vistes, amb `handleInsertSegment` idèntic):
> >> 1. La drecera "Inserir subtítol" (INSERT_SUBTITLE) no col·locava el bloc on era el cursor (playhead): l'inseria després del segment actiu/últim amb `target.endTime + 0.1` i durada fixa ~2s.
> >> 2. El botó "+després" de cada bloc respectava la separació amb el segment d'ancoratge però **trepitjava el següent per defecte**: `end = Math.min(next.startTime - 0.1, start + 2)` quedava anul·lat per `Math.max(end, start + 0.5)`, que forçava un pis de 0.5s de durada encara que solapés el veí. ("+abans" sí ho feia bé.)
> >>
> >>#### **El que NO ha funcionat:**
> >> * **Resposta de disseny contradictòria de l'usuari per al cas de col·lisió.** A la pregunta tancada va triar "mantenir 1000ms encara que solapi", però en text lliure va aclarir el contrari: "si és menys, que sigui menys perquè no trepitgi els altres" (ja hi ha alerta per als blocs per sota de la durada mínima). Reconciliació: la prioritat REAL és **no solapar mai** > mantenir 1000ms (desplaçant l'inici enrere) > com a últim recurs, escurçar la durada. El text lliure amb el "perquè" preval sobre l'opció tancada.
> >> * El pis `Math.max(end, start + 0.5)` del codi original era la causa exacta del solapament: aplicar una "durada mínima" DESPRÉS de clampar contra el veí torna a obrir el solapament. L'ordre correcte és clampar contra el veí AL FINAL.
> >>
> >>#### **Solució:**
> >> * Nou `handleInsertSegmentAtCursor` (dues vistes): llegeix `videoRef.current.currentTime` (precisió, com `handleSetTcIn`), calcula el buit lliure al voltant del cursor (`lowerBound`/`upperBound` recorrent tots els segments amb `minGapMs`) i col·loca `[t, t+minDur]` desplaçant per encaixar; si `freeSpace >= minDur` desplaça l'inici enrere per mantenir la durada; si `0 < freeSpace < minDur` omple el buit (durada < minDur) sense solapar; si no hi ha buit, últim recurs `[t, t+minDur]`. Inserció posicionada per temps (`findIndex(s => s.startTime > start)`). `minDur = Math.max(MIN_SEG_DURATION_MS, minDurationMs ?? 1000) / 1000`.
> >> * "+després" reescrit: apunta a `minDur` (o fins a 2s si hi ha marge) però clampa `next.startTime - minGapMs` AL FINAL; si el buit és menor que minDur, durada més curta abans que solapar. La drecera INSERT_SUBTITLE ara crida el handler de cursor en lloc de `handleInsertSegment(id, 'after')`.
> >> * "+abans" sense canvis (ja correcte).
> >>
> >>#### **Arxius modificats:**
> >> * `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx`
> >> * `frontend/components/VideoSubtitlesEditor/VideoSrtStandaloneEditorView.tsx`
> >>
> >>#### **Verificació:**
> >> `tsc` net. Verificació manual en navegador de la inserció al cursor i del "+després": **pendent** (tasques manuals a SPS-0004).
> >>
> >>#### **Lliçó:**
> >> Quan s'aplica una durada mínima i alhora s'ha d'evitar solapar un veí, l'ordre importa: clampar contra el veí ha de ser l'ÚLTIM pas, o el pis de durada reintrodueix el solapament (causa exacta d'aquest bug). I davant respostes de requisits contradictòries de l'usuari (opció tancada vs text lliure), preval el text lliure amb el "perquè"; aquí la invariant és **no trepitjar mai un altre subtítol** — la durada mínima és preferència, no obligació.
> >>
> >>#### **Follow-ups (moguts a tasks.md):**
> >> * Verificació manual en navegador de l'inserció al cursor i del "+després" + decisió de commit dels 2 fitxers (tasques manuals a SPS-0004).
> ---

---

> ---
> ## **H-00005** — Fita: Selecció múltiple de blocs + format B/I/U en lot no destructiu
> >> ###### *[2026-07-07]*
>
> >>#### **Tipus:**
> >> Fita + decisió arquitectònica
> >>
> >>#### **Tasques relacionades:**
> >> * SPS-0003 (abans: T3)
> >>
> >>#### **Síntoma / Context:**
> >> L'editor de subtítols només tenia un "segment actiu" i els botons B/I/U aplicaven format via `document.execCommand` sobre la selecció de text del contentEditable enfocat — no hi havia manera d'aplicar cursiva a 30 blocs de cop. Petició de l'usuari: checkbox a l'esquerra de tot de cada bloc, Maj+clic per rangs inclusius (78 → Maj+104 = 78..104), i toggle de cursiva en lot **normalitzador**: si "com" ja era `<i>com</i>` dins la frase, primer s'elimina la cursiva parcial i després s'embolcalla tot — mai `<i>… <i>…</i> …</i>`, i mai tocar `<b>`/`<u>` en manipular `<i>`.
> >>
> >>#### **El que NO ha funcionat:**
> >> * **Primer disseny de `handleToggleSelect`: mutar `anchorIdRef` DINS de l'updater de `setSelectedIds`.** L'app corre sota `<React.StrictMode>` (index.tsx), que en dev invoca els updaters dues vegades: la primera invocació (descartada) movia l'àncora 78→104 i la segona llegia l'àncora ja moguda → el rang Maj+clic degenerava al bloc clicat. Caçat pel ralph-loop (iteració 1) abans d'escriure codi. Regla: updaters de setState sempre PURS; lectura/escriptura de refs i càlcul de rangs fora de l'updater.
> >> * **Aritmètica d'ids per als rangs** hauria estat un bug latent: els ids NO estan garantits 1..N seqüencials (`parseSrt` conserva la numeració del fitxer original; `handleAcceptInsertion` insereix amb `id: Date.now()`). Els rangs es calculen per **índex d'array** (`findIndex` + `slice`), mai per ids.
> >> * **Afirmació falsa al disseny inicial**: "execCommand ja genera tags per línia en multilínia" — refutat empíricament en revisió (Chromium genera UN tag que travessa el `<br>`: `<i>l1<br>l2</i>`). No canviava la decisió (per-línia segueix sent la convenció més segura) però hauria acabat com a comentari fals al codi.
> >>
> >>#### **Solució:**
> >> * **`utils/SubtitlesEditor/formatTags.ts` (nou, funcions pures):** `stripTag` (elimina NOMÉS el tag demanat, case-insensitive), `isFullyTagged` (recorregut amb comptador de profunditat; blancs fora de regions s'ignoren, tags desequilibrats tolerats), `wrapTagPerLine` (mai `<i></i>` en línies buides), `toggleTagOnTexts` amb semàntica "make consistent": tots-taggejats → treure; mixt → strip+wrap a tots. Verificat amb script de 35 casos (esbuild+node; el projecte no té infra de tests).
> >> * **Estat de selecció a `SubtitlesEditorInner`** (component compartit per les dues vistes → una sola implementació): `selectedIds: Set<number>` + `anchorIdRef`; invalidació automàtica quan canvia `segments.length` (les ops estructurals renumeren ids) o s'surt del mode edició. Checkbox en un canal flex NOU a l'esquerra del grid (sense tocar `--us-sub-grid-columns`); `preventDefault` al mousedown (Maj+clic no estén selecció de text) i `stopPropagation` (no activa el bloc).
> >> * **Reutilització dels botons B/I/U:** amb selecció activa → lot (i `return` abans d'execCommand); sense → comportament clàssic intacte. Ressaltat dels botons via `batchFormatState ?? formatState`. Chip "N sel. ✕" a la capçalera.
> >> * **Vistes:** nou `onSegmentsBatchChange` → mapa canvis per id sobre `subsHistory.present` + `richText: ''` (patró de `syncEditorsToState`; `serializeSrt` fa `richText || originalText`) + **un únic `commit`** = un pas d'undo. El refresc visual el fa el `useLayoutEffect` existent de SegmentItem.
> >> * **Procés:** spec+plan revisats amb ralph-loop (4 iteracions, 1 major + 13 minors corregits; sortida per 3 consecutives només-minor), implementació amb subagents (implementador + revisor fresc per tasca) i revisió final de branca completa: "Ready to hand off: Yes". Spec/plan complets a `docs/superpowers/{specs,plans}/2026-07-01-multi-select-batch-format*` (carpeta ignorada per git — només local).
> >>
> >>#### **Arxius modificats:**
> >> * `frontend/utils/SubtitlesEditor/formatTags.ts` (nou)
> >> * `frontend/components/VideoSubtitlesEditor/SegmentItem.tsx` — 3 props + canal checkbox
> >> * `frontend/components/VideoSubtitlesEditor/SubtitlesEditor.tsx` — selecció, lot B/I/U, chip
> >> * `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` i `VideoSrtStandaloneEditorView.tsx` — handler + prop
> >>
> >>#### **Verificació:**
> >> 35/35 lògica, `tsc` i `npm run build` nets, revisió final "Ready to hand off: Yes". Verificació manual en navegador: **pendent** (tasques manuals a SPS-0003).
> >>
> >>#### **Lliçó:**
> >> Per a operacions de format en lot sobre text amb tags inline, el patró segur és **normalitzar-i-reaplicar per tag** (strip només del tag manipulat + wrap net), mai editar in place — impossibilita niats i tags creuats per construcció, i repara tags trencats de fitxers externs de passada. Sota StrictMode, qualsevol side-effect (refs incloses) dins d'un updater de setState és un bug intermitent només-dev dificilíssim de diagnosticar: treure'l fora sempre. I per revisar diffs sense commits (regla del repo) amb fitxers ja bruts: snapshots pre-tasca + `git diff --no-index` — a més, bona part de `frontend/components/VideoSubtitlesEditor/` està UNTRACKED, per la qual cosa `git diff` normal no mostra res d'aquests fitxers.
> >>
> >>#### **Follow-ups (moguts a tasks.md):**
> >> * SrtPreviewView mostra tags literals (SPS-0017).
> >> * Polits menors del review final (SPS-0018).
> >> * Residu acceptat del sync amb mateixa longitud (nota informativa a `tasks.md`).
> >> * Verificació manual en navegador (tasques manuals a SPS-0003).
> ---

---

> ---
> ## **H-00004** — Bug: split erràtic a l'editor de subtítols (només 1 de 3 disparadors usava el cursor)
> >> ###### *[2026-07-07]*
>
> >>#### **Tipus:**
> >> Bug resolt
> >>
> >>#### **Tasques relacionades:**
> >> * SPS-0002 (abans: T2)
> >>
> >>#### **Síntoma / Context:**
> >> El split de segments "feia el que volia": no tallava on hi havia el cursor i, en blocs de 2 línies, partia la segona línia per qualsevol punt enviant el tros a la línia 1 del bloc següent. La sensació d'aleatorietat venia de que el mateix gest visible prenia camins de codi diferents segons un estat invisible (el focus):
> >> 1. **Ctrl+K amb focus dins del contentEditable** → `performSplitAtCaret` (SegmentItem) → payload amb left/right/ratio → tall al cursor. L'únic camí correcte.
> >> 2. **Botó S** → `onSplit(segment.id)` sense payload → fallback cec: `Math.floor(txt.length / 2)` sobre el text sencer (incloent `\n` i tags SRT) → partia paraules i línies per la meitat en caràcters.
> >> 3. **Ctrl+K amb focus fora del text** → drecera global (window keydown) → mateix fallback cec, aplicat a `activeSegmentId`, que se sincronitza sol amb el playhead del vídeo → podia partir un segment diferent del que l'usuari mirava.
> >>
> >> A més: a la vista standalone (`VideoSrtStandaloneEditorView`) el fallback no existia (`if (!payload) return`) → el botó S no feia res; i el `splitPayloadRef` no es netejava en tots els camins de sortida → perill latent de payload obsolet aplicat a un segment equivocat (els ids es renumeren `i + 1` a cada commit).
> >>
> >>#### **El que NO ha funcionat:**
> >> * El disseny original del fallback (punt mig en caràcters del text cru): és determinista però percebut com a aleatori perquè ignora cursor, paraules, salts de línia i tags. Qualsevol fallback de split ha d'operar sobre fronteres semàntiques (línia > paraula), mai sobre offsets de caràcters.
> >> * Fer que el botó S llegís la selecció directament al `onClick` no és viable sense més: el mousedown del botó desenfoca l'editor i pot destruir la selecció abans del click. Cal `onMouseDown={e => e.preventDefault()}` (truc estàndard de toolbars d'editors rics) per conservar focus i caret.
> >>
> >>#### **Solució:**
> >> Comportament estàndard tipus Subtitle Edit:
> >> * **Botó S conscient del cursor:** si `window.getSelection()` cau dins l'editor d'aquest segment → `performSplitAtCaret` (mateix camí que Ctrl+K); si no → fallback lògic de la vista. `preventDefault` al mousedown per no perdre la selecció.
> >> * **Fallback lògic nou** (`computeSmartSplit` a `utils/SubtitlesEditor/splitHelpers.ts`, funció pura): multilínia → talla pel `\n` que deixa les meitats més equilibrades (longitud sense tags); una línia → per l'espai més proper al centre; paraula única → migpunt dur. Mai talla dins d'un tag; reequilibra tags oberts (`<i>a\nb</i>` → `<i>a</i>` + `<i>b</i>`). Retorna `splitRatio` per repartir la durada proporcionalment al text (abans el fallback partia el temps 50/50 encara que el text quedés 80/20).
> >> * **Vista standalone:** afegit el mateix fallback (el botó S hi era mort).
> >> * **Higiene del payload:** es consumeix sempre a l'entrada del handler (`read + clear`) i es valida `payload.id === idParam` abans d'usar-lo.
> >> * **Guarda anti-bloc-buit:** cursor al principi o final del text → no es divideix.
> >>
> >>#### **Arxius modificats:**
> >> * `frontend/utils/SubtitlesEditor/splitHelpers.ts` (nou — lògica pura, testejada amb 10 casos via tsc+node)
> >> * `frontend/components/VideoSubtitlesEditor/SegmentItem.tsx` — botó S conscient del cursor, guarda anti-buit
> >> * `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` — fallback smart + higiene payload
> >> * `frontend/components/VideoSubtitlesEditor/VideoSrtStandaloneEditorView.tsx` — fallback nou + higiene payload
> >>
> >>#### **Verificació:**
> >> 10 casos verificats + `tsc --noEmit` net. Verificació manual en navegador dels 3 gestos: **pendent** (tasques manuals a SPS-0002).
> >>
> >>#### **Lliçó:**
> >> Quan una acció d'UI té múltiples disparadors (drecera local, drecera global, botó), tots han de convergir en la mateixa semàntica o l'usuari ho percep com a comportament aleatori — el pitjor cas és que el resultat depengui d'un estat invisible com el focus. I per a botons de toolbar que operen sobre la selecció d'un contentEditable, `preventDefault` al mousedown és obligatori. Estat efímer compartit via ref (`splitPayloadRef`) s'ha de consumir sempre (read + clear atòmic a l'entrada), no netejar-lo camí per camí.
> >>
> >>#### **Follow-ups (moguts a tasks.md):**
> >> * Split: respectar `minDurationMs`/`minGapMs` (SPS-0016).
> >> * Verificació manual en navegador dels 3 gestos (tasques manuals a SPS-0002).
> ---

---

> ---
> ## **H-00003** — Fita: Durada mínima configurable per bloc de subtítol (equivalent Subtitle Edit)
> >> ###### *[2026-07-07]*
>
> >>#### **Tipus:**
> >> Fita + bug resolt
> >>
> >>#### **Tasques relacionades:**
> >> * SPS-0001 (abans: T1)
> >>
> >>#### **Síntoma / Context:**
> >> L'editor no tenia cap manera de configurar la durada mínima d'un bloc. L'únic límit existent era el pis absolut intern `MIN_SEG_DURATION_MS = 100` ms (compartit amb el pipeline de transcripció del backend i no configurable). Subtitle Edit ofereix "Minimum duration (ms)" (default 1000 ms) per impedir reduir blocs per sota del llindar triat.
> >>
> >> A més, `VideoSrtStandaloneEditorView.tsx` tenia un bug latent: el punt d'aplicació dins de `handleSegmentChange` usava `0.1` (100 ms) hardcoded en lloc de la constant, cosa que feia el pis efectiu de 100 ms i no reflectia el valor real del sistema.
> >>
> >>#### **El que NO ha funcionat:**
> >> * Cap intent fallit: el disseny va madurar via 3 iteracions de ralph-loop (totes amb findings de severitat MINOR) sense canviar l'arquitectura. La revisió sí va detectar el bug de `0.1` hardcoded i va millorar el pla (hoisting de `minDurSec` al WaveformTimeline).
> >>
> >>#### **Solució:**
> >> Patró idèntic al de `editorMinGapMs` / `EDITOR_MIN_GAP_MS`:
> >> * Clau localStorage `snlbpro_editor_min_duration_ms` (default 1000 ms); afegida a `KEYS_TO_REMOVE` de factoryReset.
> >> * Camp `minDurationMs?: number` a `GeneralConfig` → propagat des de `useLocalStorage` fins a tots els punts d'aplicació.
> >> * `SettingsModal` → control "Durada mínima de subtítol" (step 50, max 5000 ms).
> >> * 6 punts d'aplicació, fórmula única: `Math.max(MIN_SEG_DURATION_MS, generalConfig.minDurationMs ?? 1000) / 1000`.
> >> * WaveformTimeline: `minDurMsRef` (useRef + useEffect) per evitar recrear el callback de drag quan canvia la preferència.
> >>
> >>#### **Arxius modificats:**
> >> * `frontend/constants.ts`, `frontend/types/Subtitles.ts`, `frontend/utils/factoryReset.ts`
> >> * `frontend/components/SettingsModal.tsx`
> >> * `frontend/components/VideoEditor/WaveformTimeline.tsx`
> >> * `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx`
> >> * `frontend/components/VideoSubtitlesEditor/VideoSrtStandaloneEditorView.tsx`
> >>
> >>#### **Verificació:**
> >> Build net. Aquesta va ser l'única de les 13 tasques del bloc TERMINADO antic **sense** cap pendent a «Tareas manuales del usuario» — per això migra directament a ACABAT (SPS-0001).
> >>
> >>#### **Lliçó:**
> >> El patró `editorMinGapMs` (localStorage → `GeneralConfig` → punts d'aplicació) és el model reutilitzable per a qualsevol nova preferència d'editor de subtítols. Per a valors que canvien rarament però que callbacks estables (`useCallback`) han de llegir: `useRef` + `useEffect` (no afegir la prop com a dep del callback — provoca recreació constant del handler de drag).
> >>
> >>#### **Follow-ups (moguts a tasks.md):**
> >> * Cap.
> ---

---

> ---
> ## **H-00002** — Bug: Delete al final de línia no unia amb la línia següent en l'editor de subtítols
> >> ###### *[2026-07-07]*
>
> >>#### **Tipus:**
> >> Bug resolt
> >>
> >>#### **Tasques relacionades:**
> >> * Cap (bug puntual, sense tasca pròpia a `tasks.md`)
> >>
> >>#### **Síntoma / Context:**
> >> En el editor de subtítols (`SegmentItem.tsx`), prémer **Suprimir** (Delete) al final de la línia 1 d'un bloc no unia el text amb la línia 2. En canvi, prémer **Retrocés** (Backspace) al principi de la línia 2 sí que funcionava correctament.
> >>
> >>#### **El que NO ha funcionat:**
> >> * Deixar el comportament per defecte del navegador: `contentEditable` amb separadors `<br>` no gestiona bé la tecla Delete al final d'un node de text (el navegador no elimina el `<br>` correctament en aquesta posició, però sí ho fa Backspace des del costat oposat).
> >>
> >>#### **Solució:**
> >> Afegir un handler explícit per a la tecla `Delete` a `handleKeyDown`, seguint el mateix patró que el handler de `Shift+Enter` (però en sentit invers):
> >> 1. Extreure el text pla abans i després del cursor amb `document.createRange`.
> >> 2. Si `textAfter` comença per `\n` (cursor al final d'una línia no darrera), prevenir el comportament per defecte.
> >> 3. Construir el text unificat (`textBefore + textAfter.slice(1)`) i cridar `onChange`.
> >> 4. Posicionar el cursor exactament a la unió (`charOffset = textBefore.length`) via un nou camp `charOffset` a `CaretHint`, gestionat al `requestAnimationFrame` del `useLayoutEffect`.
> >>
> >> Funció auxiliar nova: `placeCaretAtCharOffset(editor, offset)` — recorre els nodes fills de l'editor (text nodes + `<br>`) acumulant caràcters fins a trobar l'offset exacte.
> >>
> >>#### **Arxius modificats:**
> >> * `frontend/context/SubtitleEditorContext.tsx` — afegit `charOffset?: number` a la interfície `CaretHint`
> >> * `frontend/components/VideoSubtitlesEditor/SegmentItem.tsx` — nova funció `placeCaretAtCharOffset`, handler `Delete` a `handleKeyDown`, cas `charOffset` al `requestAnimationFrame`
> >>
> >>#### **Verificació:**
> >> *(no consta un pas de verificació explícit separat a l'original — el bugfix es dona per validat dins de la mateixa entrada)*
> >>
> >>#### **Lliçó:**
> >> El `contentEditable` amb `<br>` com a separadors de línia té un comportament asimètric entre Delete i Backspace: Backspace des de la línia N+1 funciona nativament, Delete des de la línia N no. Qualsevol editor que faci servir `<br>` com a separador ha d'implementar el handler Delete explícitament. El patró `onChange + caretHintRef + useLayoutEffect + rAF` és el mecanisme establert per a modificacions programàtiques de text amb posicionament de cursor en aquest editor.
> >>
> >>#### **Follow-ups (moguts a tasks.md):**
> >> * Cap.
> ---

---

> ---
> ## **H-00001** — Incidència + decisió arquitectònica: neteja del repo i adopció del model `.claude`
> >> ###### *[2026-07-07]*
>
> >>#### **Tipus:**
> >> Incidència + decisió arquitectònica
> >>
> >>#### **Tasques relacionades:**
> >> * Cap (setup del repo, anterior a tota tasca de `tasks.md`)
> >>
> >>#### **Síntoma / Context:**
> >> La branca `ModificacionesMarcJulio2026` (subconjunt reduït de `main`) no tenia `.gitignore` ni `CLAUDE.md` arrel, tenia ~5.74 GB de media (`backend_nest_mvp/SonilabData/`) commitejats a l'historial que impedien el push (GitHub rebutja arxius >100 MB), i arrossegava artefactes de skills (`docs/`, `.playwright-mcp/`) i arxius amb nom corrupte.
> >>
> >>#### **El que NO ha funcionat:**
> >> *(no consta a l'original)*
> >>
> >>#### **Solució:**
> >> * `.gitignore` arrel nou: ignora `docs/`, `.superpowers/`, `.playwright-mcp/`, `SonilabData/`, builds, logs. Es conserven `.vscode/` i `.claude/` (decisió pròpia d'aquesta branca, oposada a `main`).
> >> * Purga dels 5.74 GB de l'historial amb `git filter-branch --index-filter`.
> >> * `CLAUDE.md` arrel portat de `main` i després **fusionat** amb el model genèric `0000_MODELO_PROYECTO_CLAUDE` (constitució operativa + context de producte Sonilab).
> >> * Adoptada l'estructura `.claude/` del model (settings, docs/tareas.md, docs/history.md, to_claude, commands, skills).
> >>
> >>#### **Arxius modificats:**
> >> * `.gitignore` (nou/reescrit)
> >> * `CLAUDE.md` (arrel, fusionat)
> >> * Estructura `.claude/` (docs/, to_claude/, commands/, skills/)
> >>
> >>#### **Verificació:**
> >> *(no consta un pas de verificació explícit separat a l'original)*
> >>
> >>#### **Lliçó:**
> >> Dades de runtime (media d'usuari) mai en git. La media viu fora del repo; `SonilabData/` està a `.gitignore` a totes dues branques.
> >>
> >>#### **Follow-ups (moguts a tasks.md):**
> >> * Cap directe — aquesta entrada és l'origen del propi model `.claude` que la migració 2026-07-09 (aquest document) porta un pas més enllà (2 estats → 4 estats).
> ---
