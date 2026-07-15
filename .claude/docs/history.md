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
> ## **H-00032** — Fase C de l'ona (teclat): Secció D del CSV mestre implementada sencera; el conflicte fletxes↔text es resol amb un guard central de navegació
> >> ###### *[2026-07-15]*
>
> >>#### **Tipus:**
> >> Fita (joc de dreceres de l'editor de subtítols alineat amb l'esquema mestre).
>
> >>#### **Tasques relacionades:**
> >> * SPS-0025 (Fase C → EN_PROCES).
>
> >>#### **Síntoma / Context:**
> >> La Fase C de SPS-0025 demanava "un sol joc de dreceres" de l'ona (cursor 1 s/1 frame, nudge Nuendo, línia, F9–F12, insert, split, merge) segons l'esquema mestre `Shortcuts Subtitols - Consolidat.csv` (arrel, Secció D).
>
> >>#### **El que NO ha funcionat:**
> >> * **Afirmar que el CSV no existia.** En un primer intent es va cercar el CSV amb `Glob` (`**/*Consolidat*.csv`) → cap resultat, i es va concloure (ERRÒNIAMENT) que no hi era, implementant només un subconjunt "segur" amb modificadors i deixant F9–F12 com a "semàntica indefinida". **Causa real:** el `Glob` respecta `.gitignore` i el CSV hi està ignorat; el fitxer sí que és a l'arrel. L'usuari ho va corregir. **Lliçó operativa:** per comprovar l'existència d'un fitxer que pot estar gitignorat, no fiar-se del `Glob` — usar `ls`/`test -f` directe.
> >> * **Pegat local a `SegmentItem` per al conflicte de fletxes.** La primera versió aturava la propagació d'Alt+fletxes només dins de `SegmentItem`. Substituït per un guard CENTRAL a `useKeyboardShortcuts` (cobreix tots els camps editables i totes les combinacions de fletxa, no només Alt dins d'un component) → el pegat local es va retirar.
>
> >>#### **Solució:**
> >> * Defaults de `DEFAULT_SHORTCUTS.subtitlesEditor` alineats a la Secció D sencera: cursor 1 s (`←/→`), 1 frame (`Ctrl+←/→`, fps d'`EDITOR_FPS`), nudge Nuendo (`Alt+←/→` inici, `Shift+Alt+←/→` final), línia (`Alt+↑/↓`), fixar inici/final (`F11`/`F12`), inici+ripple (`F9`), final+següent (`F10`), inserir (`Shift+F9`), dividir (`Ctrl+Alt+V`), fusionar (`Ctrl+Shift+M`). Combos escrits en l'ordre canònic Ctrl→Shift→Alt de `comboFromEvent`.
> >> * Handlers nous als DOS editors (nudge, `seekByFrames`, `fixInRipple`, `fixOutNext`) reutilitzant `handleCueStart/End`/`handleRippleFromCue`; a la vista standalone s'hi van AFEGIR `handleSetTcIn`/`handleSetTcOut`, que només existien a la gestionada.
> >> * **Conflicte fletxes↔text (guard central):** a `useKeyboardShortcuts`, si el focus és en un camp editable i la tecla és de navegació (fletxes/Home/End, amb o sense modificador), es retorna abans de matchejar → navegació de cursor/paraula NATIVA, cap `preventDefault`. Com que el hook filtra per `appId`, les fletxes nues només actuen dins de l'editor de subtítols.
> >> * **Canvis de default:** `SET_TC_IN` Q→F11, `SET_TC_OUT` W→F12, `INSERT_SUBTITLE` Alt+N→Shift+F9, `SPLIT_SEGMENT` Ctrl+K→Ctrl+Alt+V (personalitzables; els overrides de `localStorage` es mantenen).
>
> >>#### **Arxius modificats:**
> >> * `frontend/constants.ts` (Secció D), `frontend/hooks/useKeyboardShortcuts.ts` (guard de navegació en inputs), `VideoSubtitlesEditorView.tsx` i `VideoSrtStandaloneEditorView.tsx` (handlers + casos + `EDITOR_FPS`; `handleSetTcIn/Out` a la standalone), `SegmentItem.tsx` (retirat el pegat Alt+fletxes).
>
> >>#### **Verificació:**
> >> `tsc --noEmit` frontend EXIT 0 + `vite build` EXIT 0. Matching de combos verificat byte-a-byte. Disparament real al navegador passat a l'usuari (SPS-0025).
>
> >>#### **Lliçó:**
> >> Dos punts. (1) Un joc de dreceres amb tecles de navegació nues i un listener global de `window` es reconcilia amb l'edició de text amb UN guard central (navegació en inputs = nativa), no amb pegats per component. (2) `Glob` respecta `.gitignore`: no serveix per verificar l'existència d'un fitxer potencialment ignorat — usar `ls`/`test -f`.
>
> >>#### **Follow-ups (moguts a tasks.md):**
> >> Passos de cursor configurables (0.5 frame, 1 s ajustable) i snapping a canvis de pla queden com a futur a SPS-0025/SPS-0026.
> ---

> ---
> ## **H-00031** — Fase B2 de l'ona: crear-arrossegant amb rang provisional + relocalització del scrub; Part 3 (enllaç de veí) ajornada per manca de contracte de 2 segments
> >> ###### *[2026-07-15]*
>
> >>#### **Tipus:**
> >> Fita (nova infraestructura d'interacció a l'ona) + decisió d'abast.
>
> >>#### **Tasques relacionades:**
> >> * SPS-0028 (→ EN_PROCES). Part de l'umbrella SPS-0025.
>
> >>#### **Síntoma / Context:**
> >> Faltava poder crear un subtítol arrossegant sobre l'ona buida. `WaveformTimeline` no era focusable ni tenia `onKeyDown` (tota la gestió de tecles vivia al pare) i l'arrossegar-buit ja estava ocupat pel scrub.
>
> >>#### **El que NO ha funcionat:**
> >> * **Inserir directament al `mouseup` del drag.** El pla demanava un rang PROVISIONAL confirmat amb Enter (Esc cancel·la) per no crear per accident; s'ha fet així (l'ona rep focus en acabar el drag).
> >> * **Decidir el gest de crear només pels modificadors.** La primera versió armava "crear" també a la regla de timecodes (on `hitTestSegment` sempre és null), trencant l'invariant que la regla fa scrub. La revisió adversarial ho va detectar → es condiciona "crear" a `downZone === 'content'`.
> >> * **`handleKeyDown` sense guard de gest viu.** Com que el focus salta al div arrel al `mousedown`, Enter/Esc premuts amb el botó encara premut interferien amb el drag (rang reaparegut, doble inserció). Corregit: `handleKeyDown` no fa res si hi ha un gest de ratolí actiu.
> >> * **Nudge de Fase C trepitjant el text.** En afegir Alt+fletxes (Fase C), calia que dins del camp editable no disparessin el nudge → `SegmentItem` en fa `stopPropagation`.
> >> * **Part 3 (Alt+arrossegar vora = enllaça veí <500 ms): NO implementada.** `onSegmentUpdate` només actualitza UN segment; enllaçar el veí exigeix un contracte nou d'actualització atòmica de dos segments. És la part de menys valor i més risc → ajornada abans que implementar-la a mitges i cega.
>
> >>#### **Solució:**
> >> * Nou estat `createRange` + refs (`emptyGestureRef`, `createMovedRef`, `createRangeRef`, `rootRef`), dibuix del rang provisional a `drawVisible`, div arrel `tabIndex=0` amb `onKeyDown` (Enter confirma → `onCreateSegment`, Esc cancel·la). Nou `handleCreateSegment` als dos editors (reutilitza `handleInsertSegmentAtCursor`, avorta si el rang solapa un esdeveniment). `onCreateSegment` afegit al comparador de `React.memo`.
> >> * El scrub es relocalitza: arrossegar-buit sense modificador = crear; amb qualsevol modificador (Alt+Shift inclòs) o a la regla = scrub. El tipus es latcha al `mousedown` (SPS-0029).
>
> >>#### **Arxius modificats:**
> >> * `frontend/components/VideoEditor/WaveformTimeline.tsx` (refs/estat/dibuix/handlers/teclat/memo), `VideoSubtitlesEditorView.tsx` + `VideoSrtStandaloneEditorView.tsx` (`handleCreateSegment` + prop), `SegmentItem.tsx` (guard Alt+fletxes).
>
> >>#### **Verificació:**
> >> `tsc --noEmit` frontend EXIT 0 + `vite build` EXIT 0. Revisió adversarial (2 agents en paral·lel) → 3 troballes majors corregides. Interacció de ratolí/teclat passada a verificació d'usuari (SPS-0028).
>
> >>#### **Lliçó:**
> >> En una màquina d'estats de ratolí afinada per capes (SPS-0029..0036), afegir un gest nou obliga a decidir explícitament la ZONA (regla vs contingut) i a tancar tots els camins de sortida (mouseleave, Enter/Esc mid-drag, focus robat) — no només el camí feliç. Un rang provisional focusable barreja el model de ratolí amb el de teclat i cada frontera s'ha de segellar.
>
> >>#### **Follow-ups (moguts a tasks.md):**
> >> Part 3 (Alt+vora enllaça veí) com a ítem obert a la subsecció d'usuari de SPS-0028.
> ---

> ---
> ## **H-00030** — Els presets de temps per frames són GLOBALS, no per projecte: fps com a capa de presentació sobre valors en ms
> >> ###### *[2026-07-15]*
>
> >>#### **Tipus:**
> >> Decisió arquitectònica (on viu el paràmetre fps)
>
> >>#### **Tasques relacionades:**
> >> * SPS-0027 (→ EN_PROCES).
>
> >>#### **Síntoma / Context:**
> >> `minDurationMs` / `minGapMs` es guarden en mil·lisegons; l'usuari demanava presets seleccionables **per projecte** expressats en FRAMES segons perfil (TV 25 fps, Cine 24 fps).
>
> >>#### **Descobriment que simplifica el disseny:**
> >> `minDuration` / `minGap` **ja són preferències GLOBALS d'usuari** (`localStorage` `EDITOR_MIN_GAP_MS` / `EDITOR_MIN_DURATION_MS`), no per projecte. No existeix cap sistema de settings d'editor **per-projecte** al qual penjar el fps.
>
> >>#### **El que NO ha funcionat:**
> >> * **Lligar `minDuration`/`minGap` a un fps-per-projecte.** Hauria exigit **crear de zero** una capa de settings d'editor per-projecte inexistent (endpoint `PATCH /projects/:id/settings` + funció a `api.ts` + model) — arquitectura nova sencera per satisfer una demanda que és, en el fons, de **presentació** (mostrar frames en lloc de ms). Descartat: improvisar arquitectura per una millora cosmètica trenca la regla de canvi mínim.
>
> >>#### **Solució:**
> >> * fps + presets viuen al **MATEIX nivell GLOBAL** que min duration/gap (a `SettingsModal`). Els valors se segueixen **guardant en MS** (contracte intacte amb tots els consumidors de l'editor); **frames és només capa de presentació**. Nou `EDITOR_FPS` (`localStorage`, default 25) + `factoryReset`. Nou helper **pur** `frameTime.ts` (`framesToMs`/`msToFrames`/`FPS_PRESETS`/`presetToMs`/`detectActivePreset`). UI: bloc "Perfil de temps (frames)" amb TV (25 fps) / Cine (24 fps) / Personalitzat + input fps + equivalent en frames al costat dels ms.
> >> * `fps?` afegit a `TranscriptionSettingsDto` (dins `project.settings`) al backend com a **ganxo forward-looking**, sense migració ni tocar `api.ts` — per si la necessitat per-projecte es materialitza més endavant.
>
> >>#### **Arxius modificats:**
> >> * `frontend/constants.ts` (`EDITOR_FPS`), `frontend/utils/factoryReset.ts`, `frontend/utils/SubtitlesEditor/frameTime.ts` (nou, pur), `frontend/components/SettingsModal.tsx` (bloc de perfil de temps); `backend_nest_mvp/.../projects/dto/create-project.dto.ts` (`fps?`).
>
> >>#### **Verificació:**
> >> `tsc --noEmit` frontend+backend EXIT 0. No verificat en navegador (judici de gust d'etiquetes/valors passat a tasques de l'usuari a SPS-0027).
>
> >>#### **Lliçó:**
> >> Quan la demanda ("per projecte") xoca amb l'arquitectura existent (settings globals), no s'inventa la capa que falta per una millora de **presentació**: es resol al nivell que ja existeix (global, en ms) i es deixa un ganxo mínim (`fps` a `project.settings`) per si la necessitat per-projecte esdevé real. Els frames són una vista sobre els ms, no un model de dades nou.
>
> >>#### **Follow-ups (moguts a tasks.md):**
> >> * fps editable **per projecte** post-creació requeriria `PATCH /projects/:id/settings` + funció a `api.ts` (pendent dins SPS-0027).
> ---

> ---
> ## **H-00029** — Detecció de canvis de pla (shot changes): backend FFmpeg amb cache per SHA-256, frontend ajornat amb el redisseny d'ona
> >> ###### *[2026-07-15]*
>
> >>#### **Tipus:**
> >> Fita (primer bloc d'una feature) + decisió d'abast (separar backend de frontend)
>
> >>#### **Tasques relacionades:**
> >> * SPS-0026 (→ EN_PROCES). Fase frontend ajornada amb SPS-0025.
>
> >>#### **Síntoma / Context:**
> >> L'usuari vol detecció de canvis de pla qualitat tipus Premiere per enganxar-hi (snapping) les vores dels subtítols. Subtitle Edit ho fa amb FFmpeg (`select=gt(scene\,0.4),showinfo`, llindar 0.4 configurable, desat en `.shotchanges`).
>
> >>#### **Solució:**
> >> * `ShotChangesService` executa FFmpeg `select='gt(scene,0.4)',showinfo` (llindar default 0.4, configurable), parseja `pts_time` de stderr i **persisteix un JSON per SHA-256** a `{CACHE_ROOT}/shotchanges/{sha256}.json` — **el mateix patró que `MediaCacheService`** de la waveform, idempotent. Endpoints `GET/POST /media/:docId/shotchanges` sota `JwtAuthGuard`. **Cap dependència nova** (FFmpeg del sistema, com ja fa media-cache).
>
> >>#### **El que NO ha funcionat:**
> >> * **PySceneDetect (content-aware).** Millor amb fosos/moviment i ja hi ha worker Python (WhisperX), però afegeix una dependència i un salt d'infraestructura per a un guany que l'FFmpeg `scene` —ja disponible i prou— no justifica encara. Descartat de moment.
> >> * **Fer també el frontend en aquesta tasca.** Pintar les línies i el snapping de vores acobla amb el **redisseny d'interacció d'ona** (SPS-0025), que té la seva pròpia verificació pesada; barrejar-ho hauria bloquejat un backend barat i verificable sol darrere d'una fase gran. Separat expressament.
>
> >>#### **Arxius modificats:**
> >> * `backend_nest_mvp/src/modules/media/shot-changes.service.ts` (nou), `media.module.ts`, `media.controller.ts`.
>
> >>#### **Verificació:**
> >> `tsc --noEmit` backend EXIT 0. **No** provat amb un FFmpeg real sobre un vídeo (llindars, cache HIT, asset àudio-only) — passat a tasques de l'usuari a SPS-0026.
>
> >>#### **Lliçó:**
> >> Reutilitzar el patró de cache **per SHA-256** ja provat (waveform) manté la **identitat de l'asset** com a clau (no el nom ni la ruta), coherent amb el model de Media, i dona idempotència gratis. I separar un backend barat/idempotent d'un frontend acoblat a un redisseny gran evita que l'un quedi ostatge de l'altre.
>
> >>#### **Follow-ups (moguts a tasks.md):**
> >> * Fase frontend (línies de shot change al `WaveformTimeline` + snapping de vores) pendent, dins SPS-0026, lligada a SPS-0025.
> ---

> ---
> ## **H-00028** — Treure el JWT de la URL de streaming amb una cookie només-media — i per què el same-site de dev no és el de producció
> >> ###### *[2026-07-15]*
>
> >>#### **Tipus:**
> >> Decisió arquitectònica (autenticació del streaming) + bug de seguretat resolt (token a la query string)
>
> >>#### **Tasques relacionades:**
> >> * SPS-0023 (→ EN_PROCES). Deute de seguretat **preexistent**, marcat a la revisió de SPS-0007 (no introduït per ell).
>
> >>#### **Síntoma / Context:**
> >> `api.streamUrlWithToken(docId)` passava el JWT com a query param (`?token=...`) al `src` del `<video>`. Els tokens a la query string es filtren a **logs d'accés del servidor, historial del navegador, capçalera `Referer` i proxies**.
>
> >>#### **El que NO ha funcionat:**
> >> * **Un token media dedicat, signat a part.** Afegeix una **segona lògica de signat i d'expiració** sense cap guany real sobre **reutilitzar el JWT existent** com a valor de cookie. Descartat.
> >> * **Retirar el `?token=` global.** L'estratègia JWT (i el seu extractor de query) és **compartida per tots els endpoints** → treure'l és **blast-radius alt** i innecessari: la fuita real (el token al `<video src>`) ja queda tancada sense tocar-lo. Mantingut transitòriament.
>
> >>#### **Solució:**
> >> * Enfocament **(b) cookie**. Nou `POST /media/session` (autenticat per header) emet cookie `media_token` = **JWT reutilitzat**, `HttpOnly, SameSite=Lax, Path=/media`, `Secure` només sota HTTPS, `maxAge` alineat amb `exp` del JWT. `jwt.strategy` afegeix un **extractor de cookie** (entre header i query). Frontend: `ensureMediaCookie()` (POST /media/session) i després `streamUrl(docId)` **sense token** al `<video src>`; els dos editors fan await de la cookie abans del `src`. `cookie-parser` ja hi era (cap dep nova).
>
> >>#### **⚠️ Avís per a producció (documentat expressament):**
> >> Funciona perquè en **dev** el front i l'API són **same-site** (`localhost:3000` ↔ `8000`, mateix domini registrable → `Lax` envia la cookie al subrecurs `<video>`). Si en **PRODUCCIÓ** el `<video>` i l'API queden en dominis registrables **DIFERENTS** (cross-site real), `Lax` **bloquejaria** la cookie i el vídeo no carregaria → caldria `SameSite=None; Secure` + `<video crossorigin="use-credentials">` + CORS amb credencials i origin explícit. **No forçat**: depèn del domini real de producció.
>
> >>#### **Arxius modificats:**
> >> * `backend_nest_mvp/src/modules/auth/jwt.strategy.ts` (extractor de cookie), `media/media.controller.ts` (`POST /media/session`); `frontend/services/api.ts` (`ensureMediaCookie`, `streamUrl` sense token), `VideoSubtitlesEditorView.tsx`, `VideoSrtStandaloneEditorView.tsx`, `__main_wave_harness.tsx`.
>
> >>#### **Verificació:**
> >> `tsc --noEmit` backend+frontend EXIT 0. **No** verificat en app real (Network sense `?token=`, cookie amb els flags, 401 sense auth) ni en el desplegament real (same-site vs cross-site) — passat a tasques de l'usuari a SPS-0023.
>
> >>#### **Lliçó:**
> >> Una cookie `SameSite=Lax` que "funciona" en dev pot ser una il·lusió de same-site: la política de cookies es valida contra la **topologia de dominis de producció**, no la de `localhost`. I retirar un mecanisme **compartit** (l'extractor `?token=`) només perquè un consumidor concret ja no el necessita és obrir blast-radius sense tancar cap fuita — la fuita es tanca al punt exacte on el secret s'exposava (el `<video src>`).
> ---

> ---
> ## **H-00027** — El fals-verd del typecheck: sense `@types/react`, un `tsc` net no valida gairebé res — i amagava dos bugs de runtime
> >> ###### *[2026-07-15]*
>
> >>#### **Tipus:**
> >> Incidència d'higiene de tooling (fals-verd) + dos bugs de runtime descoberts de passada
>
> >>#### **Tasques relacionades:**
> >> * SPS-0021 (→ EN_PROCES). Genera **SPS-0040** (nova, a PENDENTS).
>
> >>#### **Síntoma / Context:**
> >> El frontend no tenia `@types/react` enlloc. `npx tsc --noEmit` passava, però tot `React.*` es resolia com a **`any` silenciós** → el typecheck validava **molt menys** del que semblava (ja marcat com a baseline feble a la revisió de SPS-0006, on va provocar un TS2347 derivat de la cadena d'*any*).
>
> >>#### **El que NO ha funcionat:**
> >> * **Confiar en el `tsc` verd previ com a senyal de correcció.** Era un **fals-verd**. Instal·lar els `@types` va destapar **7 errors TS2322 reals** (prop `style` no declarada) i, per sota d'ells, **2 bugs de runtime**: `icons.tsx` (48 components) i `ControlButton` **declaren** `style` però el cos **no el reenvia** a l'element → el tint d'accent que 6+1 call-sites hi passen es **descarta silenciosament**. Un tipus i un runtime desalineats que el typecheck cec no podia veure.
>
> >>#### **Solució:**
> >> * Instal·lats `@types/react@19.2.17` + `@types/react-dom@19.2.3` (devDeps, major 19 casant amb `react ^19.2`). Els 7 errors arreglats **només de tipus** (afegint `style?: React.CSSProperties` a la forma d'icona compartida i a `ControlButton`), **sense tocar runtime** → nova línia base real (0 errors amb els `@types`).
> >> * Els 2 bugs de runtime **registrats com a SPS-0040**, no arreglats aquí: reenviar `style` és un canvi de **comportament visual** (judici de gust) i barrejar-lo amb el fix de tipus violaria el canvi mínim.
>
> >>#### **Arxius modificats:**
> >> * `frontend/package.json` (`@types/react`, `@types/react-dom` a devDeps), `frontend/components/icons.tsx` (`style?` a la forma compartida), `frontend/components/VideoEditor/VideoEditorToolbar.tsx` (`style?` a `ControlButton`).
>
> >>#### **Verificació:**
> >> `tsc --noEmit` frontend EXIT 0 — i ara sí **significatiu**, perquè amb els `@types` el compilador comprova de debò els tipus de React.
>
> >>#### **Lliçó:**
> >> Un `tsc` verd no val res sense els `@types` del framework: sense ells TypeScript no comprova el que sembla que comprova, i el verd és cosmètic. Afegir-los sol destapar deute latent — aquí, un desalineament tipus↔runtime que amagava una prop descartada. I separar el fix de **tipus** (segur, mecànic) del fix de **runtime** (judici visual) evita colar un canvi de comportament dins una tasca de tooling.
>
> >>#### **Follow-ups (moguts a tasks.md):**
> >> * **SPS-0040** — reenviar `style` a `<svg>`/`<button>` a `icons.tsx` i `ControlButton` per recuperar el tint d'accent que els call-sites ja pretenen (decisió visual pendent).
> ---

> ---
> ## **H-00026** — El write de `linkedMediaId` es mou al mòdul `projects` per poder sincronitzar `mediaDocumentId` — canvi de contracte sense backfill
> >> ###### *[2026-07-15]*
>
> >>#### **Tipus:**
> >> Decisió arquitectònica (frontera `projects` ↔ `library`) + bug de coherència de registre resolt
>
> >>#### **Tasques relacionades:**
> >> * SPS-0019 (→ EN_PROCES). Continuació directa de SPS-0005.
>
> >>#### **Síntoma / Context:**
> >> SPS-0005 llegeix l'últim vídeo des de `linkedMediaId` de l'SRT, però `project.mediaDocumentId` quedava **obsolet** (apuntant al vídeo de creació). No afecta l'obertura (ja no és la font primària), però qualsevol llistat/report/lògica futura que llegís `mediaDocumentId` veuria el vídeo antic.
>
> >>#### **Solució:**
> >> * `api.linkMediaToSrt` **reencaminada** de `PATCH /documents/:id` a un nou `PATCH /projects/link-media/:srtDocumentId`. `ProjectsService.linkMediaToSrt(ownerId, srtDocumentId, mediaDocumentId)` escriu `linkedMediaId` de l'SRT (**delegant** a `library.updateDocument` — direcció `projects → library`, permesa) i sincronitza `project.mediaDocumentId` via `updateOne({ srtDocumentId })` **només si `mediaDocumentId` no és null** (idempotent; si l'SRT no té projecte, 0 matches). `PATCH /documents/:id` es manté **intacte**.
>
> >>#### **El que NO ha funcionat / limitació conscient:**
> >> * **Sense backfill** per a projectes antics: el `mediaDocumentId` ranci només es corregeix **al proper re-vincle**. Acceptat perquè `mediaDocumentId` ja **no** és la font primària d'obertura (SPS-0005 prioritza `linkedMediaId`), així que el desajust és inert fins que es re-vinculi.
>
> >>#### **Arxius modificats:**
> >> * `backend_nest_mvp/.../projects/projects.service.ts` (`linkMediaToSrt`), `projects.controller.ts` (`@Patch('/link-media/:srtDocumentId')`); `frontend/services/api.ts` (reencaminament de `linkMediaToSrt`).
>
> >>#### **Verificació:**
> >> `tsc --noEmit` backend+frontend EXIT 0. SPS-0005 intacte (`App.tsx` segueix prioritzant `linkedMediaId`). No verificat en app real / BD (canvi de vídeo, cas null, SRT standalone) — passat a tasques de l'usuari a SPS-0019.
>
> >>#### **Lliçó:**
> >> Quan un sol write ha de mantenir coherents **dues** entitats (`SRT.linkedMediaId` + `project.mediaDocumentId`), el propietari del write ha de ser el mòdul que pot veure **totes dues** — d'aquí que passi a `projects`, que delega a `library` per l'una i escriu directament l'altra. La separació de paquets es respecta amb la **direcció** correcta de la dependència (`projects → library`), no creant-ne una de prohibida en sentit invers.
> ---

> ---
> ## **H-00025** — Entorn local (Docker/Mongo/Redis) + inventari de contingut NOMÉS local abans d'un trasllat de disc
> >> ###### *[2026-07-15]*
>
> >>#### **Tipus:**
> >> Incidència (documentació d'entorn, no de codi)
>
> >>#### **Tasques relacionades:**
> >> * Cap SPS directa — coneixement operatiu que no vivia enlloc versionat.
>
> >>#### **Síntoma / Context:**
> >> Abans de traslladar aquest projecte a un altre disc dur, es revisa què quedaria fora si el trasllat es fes amb un `git clone` en lloc de copiar la carpeta sencera. Dos temes calia deixar escrits perquè només vivien en memòria personal de Claude (`~/.claude/projects/<ruta-antiga>/memory/`, lligada al path exacte d'aquest checkout — **no viatja** a un path nou, encara que sigui la mateixa màquina) o no vivien enlloc:
> >>
> >> **1. Dependència d'entorn local no documentada:** `backend_nest_mvp` depèn de **MongoDB (port 27017)** i **Redis (port 6379)** corrent dins de **Docker Desktop** (`backend_nest_mvp/docker-compose.yml`, contenidors `script_editor_mongo`/`script_editor_redis`, imatges mongo:7/redis:7). BD real `script_editor` a `mongodb://localhost:27017/script_editor`, usuaris a `users` amb bcrypt cost 12. **Símptoma → causa:** login amb «Failed to fetch» al frontend, o el backend repetint `ERROR [MongooseModule] ... ECONNREFUSED 127.0.0.1:27017` → gairebé sempre Docker Desktop tancat. **Fix:** obrir Docker Desktop, esperar el motor, `cd backend_nest_mvp && docker compose up -d`; `nest --watch` es reconnecta sol (no cal reiniciar-lo). MongoDB NO és un servei natiu instal·lat (no hi ha `mongod.exe` local). Reset de contrasenya admin: `node backend_nest_mvp/scripts/reset-admin-password.js` (default `admin@sonilab.cat` / `Admin1234`); no cal reiniciar el backend, valida contra la BD a cada login.
> >>
> >> **2. Contingut real només al disc, mai a GitHub** (a banda del `.gitignore` habitual de secrets/build): en revisar `git status` hi havia ~15 fitxers de `frontend/` amb canvis substancials **sense commitejar** (bugs i millores de l'ona/subtítols descoberts avaluant SPS-0015, ja documentats a H-00015..H-00024) + 4 fitxers de harness sense trackejar. Més enllà d'això, **gitignorat per disseny i per tant invisible a `git status` també**: `.claude/to_claude/` (material privat, inclou `waveform-harness/` — banc de proves amb README usat per verificar SPS-0016/0029/etc.), `docs/superpowers/` (specs+plans del flux autònom habitual, 16 fitxers / 324 KB — veure `.gitignore` arrel: `/docs/`), i els `.env` reals de `backend_nest_mvp/` i `frontend/` (secrets; només es versionen els `.env.example`).
> >>
> >>#### **El que NO ha funcionat:**
> >> * **Assumir que «tot el important ja és a `.claude/docs/`, doncs ja està cobert»:** fals — `.claude/docs/tasks.md`/`history.md` documenten el disseny i la decisió, però el **codi font en si** (els ~15 fitxers modificats) i els **harnesses de verificació** (`.claude/to_claude/waveform-harness/`, gitignorat expressament) només existeixen al disc. Un `git clone` fresc a la ubicació nova reconstruiria els docs però **no** el codi uncommitted ni els harnesses ni els specs/plans de `docs/superpowers/`.
> >>
> >>#### **Solució:**
> >> * Aquesta entrada + una nota explícita a `tasks.md` (secció EN_PROCES, 2026-07-15) deixen escrit que el mètode de trasllat de disc ha de ser una **còpia de la carpeta sencera del projecte**, no un `git clone` nou — l'únic mètode que preserva alhora el treball uncommitted i tot el contingut gitignorat per disseny (`to_claude/`, `docs/`, `.env`).
> >> * El fet Docker/Mongo/Redis (punt 1) queda documentat aquí perquè no depengui de memòria personal no versionada: és operatiu i necessari per fer arrencar `backend_nest_mvp` en qualsevol disc/màquina nova.
> >>
> >>#### **Arxius modificats:**
> >> * `.claude/docs/history.md` (aquesta entrada).
> >>
> >>#### **Verificació:**
> >> `tsc --noEmit` i `vite build` nets sobre l'arbre de treball complet (incloent-hi tot el WIP uncommitted descrit al punt 2) — el codi compila i buildeja correctament tal com està, encara sense commitejar.
> >>
> >>#### **Lliçó:**
> >> `.gitignore` decideix què **mai** arriba a GitHub encara que es faci commit; per tant «ja ho tinc commitejat» no és el mateix que «ja és segur davant d'un trasllat/pèrdua de disc» quan hi ha carpetes gitignorades a propòsit (`to_claude/`, `docs/`) amb contingut de treball real. La memòria personal de Claude (no `.claude/`) tampoc viatja si canvia el path del projecte, encara que sigui el mateix disc — qualsevol fet operatiu (com dependre de Docker) que calgui recordar entre màquines ha d'anar a `.claude/docs/`, no confiar-se a la memòria personal.
> >>
> >>#### **Follow-ups (moguts a tasks.md):**
> >> * Decidir si commitejar el WIP de ~15 fitxers pendent (grup SPS-0016/17/18/22/29..39) abans del trasllat, o confiar exclusivament en la còpia de carpeta sencera.
> ---

> ---
> ## **H-00024** — Un camp de text que aïlla les seves tecles ha de decidir QUINES aïlla: delegació de les dreceres `general` des de la barra de cerca
> >> ###### *[2026-07-14]*
>
> >>#### **Tipus:**
> >> Decisió arquitectònica (frontera entre els inputs i el sistema global de dreceres) + bug latent de pèrdua de format descobert de passada
> >>
> >>#### **Tasques relacionades:**
> >> * SPS-0022 (→ EN_PROCES). Deute deixat pel review final de SPS-0006 (veure H-00019). Follow-up obert: SPS-0039.
> >>
> >>#### **Síntoma / Context:**
> >> Els inputs de `SearchReplaceBar` feien `e.stopPropagation()` a **TOTES** les tecles. Era una decisió deliberada i documentada al codi: la combo `Delete` està registrada com a drecera (`sub_delete`) i `useKeyboardShortcuts` fa `preventDefault()` en trobar-la **encara que cap vista tracti l'acció** → sense l'aïllament, la tecla Supr no esborraria text dins de l'input. El preu d'aquest «tallafoc total» és que **cap** drecera global travessa la barra: amb el focus al camp de cerca, Ctrl+Z feia l'undo natiu **de l'input** en comptes del del document (Word i VSCode enruten l'undo al document), i Ctrl+S obria el diàleg de desar **del navegador**.
> >>
> >>#### **El que NO ha funcionat:**
> >> * **El prop `onUndo` que proposava la fitxa de la tasca.** Passar `onUndo` a la barra i cridar-lo des d'un `if (ctrl && key === 'z')` funciona, però **hardcodeja la combo**: les dreceres d'aquest projecte són **personalitzables** (`SettingsModal` → `LOCAL_STORAGE_KEYS.SHORTCUTS`). Un usuari que remapegés Desfer tindria la seva combo funcionant a tot arreu **menys** a la barra, i la barra desfent amb una combo que ja no és la seva. La solució correcta no és cablejar la tecla, sinó **preguntar a la configuració real** quina acció li correspon: `findGeneralShortcutAction(e)`. La regla que se'n deriva: si el sistema de dreceres és configurable, **cap component pot comparar `e.key` amb una lletra concreta** per a una acció que ja existeix al registre.
> >> * **Deixar passar totes les combos amb modificador.** Temptador (una línia) i trencat: Ctrl+A / Ctrl+C / Ctrl+V / Ctrl+X són edició nativa de l'input, i qualsevol drecera de mòdul remapejada a una d'elles se les quedaria. El filtre correcte no és «té modificador» sinó «**és una drecera de la llista `general`**» (Desfer/Refer/Guardar: les tres que semànticament pertanyen al **document**, no al camp de text). La llista `general` ja existia i ja era exactament aquesta frontera — només calia llegir-la.
> >>
> >>#### **Solució:**
> >> * `useKeyboardShortcuts.ts` exporta **`findGeneralShortcutAction(e)`**: donat un event (natiu o sintètic de React), retorna l'acció de la llista `general` que li correspon segons la **configuració real** de l'usuari, o `null`. El matching de combos s'ha extret a `mapKeyName`/`comboFromEvent`/`normalizeCombo` per no duplicar-lo (equivalència amb el codi anterior auditada cas per cas: modificadors sols, `Space/Plus/Minus/Comma`, la guarda `isInput && !hasMod && len === 1`).
> >> * `SearchReplaceBar` fa `stopPropagation` de tot **excepte** quan la combo premuda porta Ctrl/Cmd **i** correspon a una drecera `general` → l'event arriba al `window` i la vista fa `subsHistory.undo()` / `.redo()` / `handleSave()`. L'exigència de **Ctrl/Cmd** és una guarda contra un remapeig a tecla simple, que altrament es menjaria el text que s'està escrivint (no s'amplia a `altKey`: als teclats ES/CAT, AltGr = Ctrl+Alt).
> >> * **No cal `preventDefault()` a la barra:** el `useKeyboardShortcuts` del propi `SubtitlesEditor` (sempre actiu) ja el fa en reconèixer la combo, abans de despatxar l'acció. Per això l'undo natiu de l'input no s'arriba a executar.
> >> * **`handleReplaceAll`** deixa de posar al batch (i de comptar) els segments que queden **byte-idèntics**: el missatge deia «S'han fet N substitucions» mentre el commit feia *bail* per igualtat profunda. Ara, si el total real és 0, la barra diu «Cap substitució».
> >>
> >>#### **Descobriment que simplifica el disseny:**
> >> El comptador honest de `handleReplaceAll` **no era només cosmètic: tapava una pèrdua de dades real.** `handleSegmentsBatchChange` posa `richText: ''` a tots els segments del batch (patró de `syncEditorsToState`: un `richText` ranci exportaria text antic). Per tant, una substitució idèntica (terme == substitució) sobre un bloc **amb format** li **esborrava el `richText`** i empenyia un pas d'undo fantasma — tot això mentre la barra celebrava «N substitucions». La guarda `raw === original` ho talla d'arrel. Lliçó lateral: un comptador que menteix sovint és la punta visible d'una escriptura que no hauria d'existir.
> >>
> >>#### **Arxius modificats:**
> >> * `frontend/hooks/useKeyboardShortcuts.ts` (nou export `findGeneralShortcutAction`; matching de combos extret a funcions pures; `useRef` mort tret)
> >> * `frontend/components/VideoSubtitlesEditor/SearchReplaceBar.tsx` (delegació selectiva; missatge «Cap substitució»; el missatge també es neteja en editar el camp de substitució)
> >> * `frontend/components/VideoSubtitlesEditor/SubtitlesEditor.tsx` (`handleReplaceAll`: guarda `raw === original`)
> >>
> >>#### **Verificació:**
> >> `tsc --noEmit` net. Revisió adversarial en paral·lel (2 lents: regressió del refactor · encaix amb el codi existent): cap troballa MAJOR; confirmat que cap acció es dispara dues vegades (els listeners `scriptEditor` d'`App.tsx` estan desactivats en aquests modes i el hook de `SubtitlesEditor` ignora tot el que no sigui `FIND`). **App real** (backend + Mongo/Redis en Docker + Vite, editor SRT standalone, usuari i doc de prova sembrats i esborrats després): substitució idèntica → «Cap substitució» i els 5 blocs byte-idèntics; substitució real → «S'han fet 5 substitucions» i text canviat; des del camp de cerca, Ctrl+Z desfà el **document** deixant el text de l'input intacte, Ctrl+Shift+Z refà, Ctrl+S dispara el `PATCH` de guardat; `defaultPrevented === true` per a Ctrl+Z/Ctrl+Shift+Z/Ctrl+S/Ctrl+F (cap default del navegador s'escapa) i **fals** per a `x` i Supr, que segueixen sense arribar a `window` (l'aïllament original intacte).
> >>
> >>#### **Lliçó:**
> >> Un `stopPropagation()` total és una decisió d'arquitectura disfressada d'una línia: declara que **cap** drecera de l'app existeix mentre el focus és aquí dins. La pregunta correcta no és «aïllo o no aïllo», sinó **quines tecles pertanyen al camp i quines al document**. En aquest projecte la resposta ja estava escrita: la llista `general` del registre de dreceres **és** aquesta frontera.
> >>
> >>#### **Follow-ups (moguts a tasks.md):**
> >> **SPS-0039** — `SettingsModal.tsx` té la seva **pròpia còpia** de la conversió event→combo. Ara que el hook n'exporta la versió canònica hi ha dues fonts de veritat: qui grava el combo i qui el reconeix poden divergir en silenci (una drecera desada deixaria de casar, sense cap error visible).
> ---

> ---
> ## **H-00023** — La drecera morta `SPLIT_AT_PLAYHEAD`: una proporció no és un punt de tall, i una tecla no és teva fins que arriba al listener
> >> ###### *[2026-07-14]*
>
> >>#### **Tipus:**
> >> Feature implementada (drecera declarada però sense `case`) + bug latent de propagació de teclat
> >>
> >>#### **Tasques relacionades:**
> >> * SPS-0037 (→ EN_PROCES). Follow-up obert per H-00022; reutilitza `computeSplitTimes`/`computeSmartSplit` de SPS-0016.
> >>
> >>#### **Síntoma / Context:**
> >> `SPLIT_AT_PLAYHEAD` (Ctrl+Shift+K) estava declarada a `constants.ts`, `useKeyboardShortcuts` li feia `preventDefault()` — o sigui que **es menjava la tecla** — i cap dels dos switch d'accions tenia el `case`: la drecera no feia res. La decisió era implementar-la o retirar-la; es va implementar perquè SPS-0016 ja havia centralitzat la lògica de temps i l'usuari ja veu la drecera documentada («Dividir al playhead»).
> >>
> >>#### **El que NO ha funcionat:**
> >> * **Derivar un `ratio` del playhead i passar-lo a `computeSplitTimes`** — que és exactament el que proposava la fitxa de la tasca, i el pla inicial. **El tall no cau al playhead.** `computeSplitTimes` aplica el `ratio` sobre la durada **útil** (`total − gap`), no sobre la total: amb un bloc de 10→14 s, gap 160 ms i el playhead a 11,5 s, el tall queia a **11,44 s**; amb el playhead a 13,0 s, el gap queia a l'altre costat de la línia. L'error és petit (fins a un gap) i **invisible en un test de lògica pura si només mires que les durades siguin vàlides** — però el playhead és l'única cosa que l'usuari mira en aquesta operació. Una proporció del text i un punt de tall del temps no són la mateixa magnitud, encara que tots dos siguin un número entre 0 i 1. Solució: paràmetre `cutTime` (absolut) que mana sobre `ratio`, amb les mateixes guardes de durada mínima i gap.
> >> * **Donar per fet que afegir el `case` al switch ja fa viva la drecera.** El handler de Ctrl+K del contenteditable de `SegmentItem` era `(e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'` — **sense mirar Shift** — i feia `stopPropagation()`. Com que React arrela els listeners al contenidor de l'app, aturar la propagació allà **impedeix que l'esdeveniment arribi mai al `window`**, on escolta `useKeyboardShortcuts`. Amb el cursor dins del text (el cas normal!), Ctrl+Shift+K hauria dividit pel cursor en silenci. Un `case` nou en un switch global no serveix de res si algú de més avall ja s'ha quedat la tecla.
> >>
> >>#### **Solució:**
> >> * **`computeSmartSplit(text, targetRatio = 0.5)`** — el tall del text ja no és sempre el centre sinó el candidat (salt de línia o espai) més proper a `totalLen × targetRatio`. Default = comportament idèntic al d'abans; el split pel playhead hi passa la proporció temporal. Els ratios extrems es clampen perquè cap meitat quedi buida.
> >> * **`computeSplitTimes({ ..., cutTime? })`** — punt de tall absolut. El primer bloc acaba exactament al playhead i el segon arrenca un gap més tard (estil Subtitle Edit). La jerarquia d'H-00022 es manté **per sobre**: si el playhead cau massa a prop d'una vora, la durada mínima mana i el tall es desplaça.
> >> * **`handleSplitSegmentAtPlayhead`** a les dues vistes, amb `applySplit` extret a un `useCallback` compartit amb el split pel cursor. Opera sobre el bloc que **conté** el playhead (no sobre l'actiu): si el playhead no és dins de cap subtítol, no fa res. Lectura directa de `videoRef.current.currentTime` (el ref de `currentTime` va fins a ~250 ms endarrerit; vegeu `handleSetTcIn`).
> >> * **Guarda `!e.shiftKey`** al handler de Ctrl+K de `SegmentItem`.
> >>
> >>#### **Arxius modificats:**
> >> * `frontend/utils/SubtitlesEditor/splitHelpers.ts` — `targetRatio` a `computeSmartSplit`, `cutTime` a `computeSplitTimes`
> >> * `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` — `applySplit` compartit + `handleSplitSegmentAtPlayhead` + `case` al switch
> >> * `frontend/components/VideoSubtitlesEditor/VideoSrtStandaloneEditorView.tsx` — idem
> >> * `frontend/components/VideoSubtitlesEditor/SegmentItem.tsx` — guarda `!e.shiftKey`
> >> * `constants.ts` i `useKeyboardShortcuts.ts` **no** s'han tocat: la declaració ja hi era i era correcta.
> >>
> >>#### **Verificació:**
> >> * `tsc --noEmit` net.
> >> * **Navegador, mòdul real servit per Vite** (13 casos): default 0.5 idèntic a abans, ratio proporcional, extrems sense meitats buides, tags `<i>` reequilibrats, text buit/1 caràcter → `null`, bloc massa curt → `null`.
> >> * **Navegador, `SegmentItem` + `useKeyboardShortcuts` REALS** (harness temporal, esborrat), amb el cursor dins del contenteditable: Ctrl+K → payload de split pel cursor i cap acció global; Ctrl+Shift+K → acció global `SPLIT_AT_PLAYHEAD` i cap split pel cursor. Sense la guarda de Shift, aquest segon cas hauria fet el primer.
> >> * **No verificat:** l'editor complet amb vídeo (el login demana backend + credencials). Passat a tasques de l'usuari.
> >>
> >>#### **Lliçó:**
> >> Dues, i totes dues són sobre **la frontera entre el que calcules i el que l'usuari veu**. (1) Reutilitzar una funció existent perquè «la lògica ja hi és» amaga que el seu contracte pot no ser el que necessites: `ratio` era exacte per al cas per al qual es va escriure (repartir text) i aproximat per al nou (clavar un temps). (2) Una drecera global no existeix perquè la declaris ni perquè el switch la gestioni: existeix si l'esdeveniment **arriba** al listener. Abans de donar per viva una tecla nova, comprova qui la pot interceptar pel camí — i comprova-ho amb el focus on el tindrà l'usuari de veritat, no amb el focus al `body`.
> ---

> ---
> ## **H-00022** — Decisió: el split ja no pot fabricar blocs invàlids — jerarquia `minDur > minGap`, i el no-solapament per sobre de tots dos
> >> ###### *[2026-07-13]*
>
> >>#### **Tipus:**
> >> Bug resolt + decisió de disseny (jerarquia d'invariants de temps de l'editor)
> >>
> >>#### **Tasques relacionades:**
> >> * SPS-0016 (→ EN_PROCES). Follow-up obert per H-00004; completa els 6 punts d'enforcement de SPS-0001/H-00003.
> >>
> >>#### **Síntoma / Context:**
> >> El split (per cursor o lògic) repartia la durada del bloc proporcionalment al text (`splitPoint = start + total * ratio`) i separava les dues meitats amb un **gap fix d'1 ms**, sense mirar ni `minDurationMs` ni `minGapMs`. Dividir un bloc de 2 s amb la config per defecte deixava dues meitats d'~1 s enganxades: cap dels dos paràmetres que l'usuari havia configurat es respectava. Era l'únic punt de l'editor que podia fabricar un estat que la resta de l'editor prohibeix.
> >>
> >>#### **La pregunta real (i la resposta):**
> >> La fitxa plantejava «bloquejar el split o només avisar». La revisió va demostrar que **la pregunta important era una altra: qui mana quan els dos paràmetres no hi caben alhora?**. Amb els defaults (minDur 1000 ms, gap 160 ms) un bloc necessita 2160 ms per satisfer tots dos, i **la majoria de subtítols reals fan menys de 2,16 s**. Segons quin invariant cedeixi primer, el mateix bloc de 2,1 s acaba amb dues meitats vàlides o amb dues d'invàlides.
> >> Jerarquia adoptada, llegida del comportament ja existent (`handleSetTcIn/Out`, `handleCueStart/End`, `handleSegmentChange`): **no-solapament > durada mínima > gap mínim**. El gap és una preferència estètica; la durada mínima és de llegibilitat; el solapament és corrupció del fitxer.
> >>
> >>#### **El que NO ha funcionat:**
> >> * **`usable = total - gap` i repartir el que quedi** (el primer esborrany del pla). Inverteix la jerarquia: reserva el gap sencer *abans* de mirar les durades, i per a tot bloc entre 2,00 s i 2,16 s degrada **les dues meitats per sota del mínim** quan n'hi hauria prou amb encongir el gap 60 ms. Empitjorava el cas més freqüent respecte del codi que volia arreglar.
> >> * **Bloquejar el split quan no hi caben dues meitats mínimes.** Descartat: l'editor **no té cap canal de notificació** (no hi ha toasts als editors de subtítols), i un botó que no fa res sense dir per què és pitjor que un resultat imperfecte i visible. A més contradiu el precedent d'`handleInsertSegment`, que ja degrada abans que bloquejar.
> >> * **Justificar la degradació dient «ja saltarà l'alerta de durada mínima»** — un comentari del codi (`VideoSubtitlesEditorView.tsx`, `handleInsertSegment`) prometia aquesta alerta, **però no existia**: l'única validació visual del `SegmentItem` era el CPS > 20. La degradació silenciosa hauria deixat l'usuari sense saber mai que tenia blocs invàlids.
> >>
> >>#### **Solució:**
> >> * **`computeSplitTimes` (funció pura, `splitHelpers.ts`)**, única font de veritat per als **4 camins** de split (2 vistes × payload del cursor / fallback lògic). Càlcul en **mil·lisegons sencers** (els timecodes SRT tenen resolució de ms i `secondsToSrtTime` arrodoneix: un split en float podia generar `,1000`). Ordre de concessions: si el bloc no dona per a `2 × minDur + gap`, **s'encongeix el gap** (fins a 1 ms — mai 0: dos subtítols no poden compartir timecode); només si ni així hi caben, es **degraden les dues durades per igual**, amb pis absolut `MIN_SEG_DURATION_MS`. `ratio` es clampa a [0,1] (el del payload es calcula amb numerador del DOM i denominador de l'estat: pot sortir de rang si divergeixen). Retorna `null` si el bloc no admet ni dues meitats del pis absolut. **`endTime` del bloc original no es toca mai** → el buit amb el subtítol següent queda intacte per construcció.
> >> * **Fuita col·lateral tancada a `handleSegmentChange` (les dues vistes):** clampava el final contra el veí i *tot seguit* l'estirava incondicionalment a `startTime + minDur`, de manera que **qualsevol bloc més curt que el mínim es menjava el següent a la primera tecla**. Ara l'estirada està limitada per la frontera del veí. Sense això, les meitats degradades del split es convertien en solapament real en començar a escriure-hi.
> >> * **Marcador de validació (l'«avisar» de la fitxa):** `SegmentItem` tenyeix la columna de timecodes de vermell (`bg-red-500/10` + tooltip amb el mínim configurat) quan la durada queda sota el mínim — mateix idioma visual que l'alerta de caràcters per línia. Cap component nou.
> >>
> >>#### **Arxius modificats:**
> >> * `frontend/utils/SubtitlesEditor/splitHelpers.ts` — `computeSplitTimes` (nova, pura)
> >> * `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` — split unificat (`applySplit`), guarda `isEditing` també al camí del payload, fix d'`handleSegmentChange`
> >> * `frontend/components/VideoSubtitlesEditor/VideoSrtStandaloneEditorView.tsx` — idem
> >> * `frontend/components/VideoSubtitlesEditor/SegmentItem.tsx` — marcador de durada sota el mínim
> >>
> >>#### **Verificació:**
> >> * **78/78 asserts** de la lògica pura (tsc + node, el patró d'H-00004): bloc llarg, ratio 0/1/fora de rang, gap encongit, degradació uniforme, config extrema (minDur 5000, minGap 0, minGap 1000), bloc degenerat → null, quantització a ms.
> >> * `tsc --noEmit` net · `vite build` net.
> >> * **Navegador, vista REAL** (harness temporal amb `VideoSubtitlesEditorView` sense backend, esborrat en acabar): bloc de 5 s → 2466 ms + **gap 160** + 2374 ms; bloc de 2,1 s → **1000 + gap 100 + 1000** (cedeix el gap, no les durades); bloc d'1,5 s → 750 + 1 + 749, marcats en vermell. Escrivint dins d'una meitat degradada, el final s'atura a `inici del següent − gap` (15,591) en comptes d'estirar-se a 16,000 i solapar.
> >>
> >>#### **Lliçó:**
> >> Quan dos paràmetres configurables poden entrar en conflicte, la feature no està definida fins que no hi ha una **jerarquia explícita** entre ells — i la jerarquia no s'inventa: es llegeix del comportament que la resta del sistema ja té. La pregunta «bloquejar o avisar» era una distracció; la que decidia el resultat era «quin invariant cedeix primer». I un invariant només és real si sobreviu al *següent* gest de l'usuari: emetre estat vàlid no serveix de res si el primer keystroke el corromp.
> >>
> >>#### **Follow-ups (moguts a tasks.md):**
> >> * `SPLIT_AT_PLAYHEAD` (Ctrl+Shift+K) està declarat a `constants.ts` i menja la tecla, però **no té cap `case`** als switch de les dues vistes: drecera morta (SPS-0037).
> ---

---

> ---
> ## **H-00021** — El memo de l'ona ja bloqueja al pare principal — i el harness sintètic que ho «provava» no podia fallar
> >> ###### *[2026-07-13]*
>
> >>#### **Tipus:**
> >> Bug resolt (tanca l'arrel oberta a H-00020) + lliçó de mètode de verificació (la part que val)
> >>
> >>#### **Tasques relacionades:**
> >> * SPS-0036 (→ EN_PROCES). Continuació directa de SPS-0035 / H-00020. Fa útil el comparador de SPS-0034.
> >>
> >>#### **Síntoma / Context:**
> >> H-00020 va descobrir que el `React.memo` de `WaveformTimeline` **no havia bloquejat mai, enlloc**, perquè els handlers que el comparador compara porten l'**objecte** `subsHistory` a les deps i `useDocumentHistory` en retorna un literal nou a cada render. SPS-0035 ho va arreglar **només al standalone**; al pare principal (`VideoSubtitlesEditorView`) els 6 handlers equivalents tenien el mateix defecte. Aquesta entrada tanca aquell forat, però **el que val la pena recordar és com es va verificar**.
> >>
> >>#### **El que NO ha funcionat:**
> >> * **El harness de SPS-0035 (pare sintètic) reaplicat al pare principal → INSERVIBLE, i s'ha llençat.** Un harness que **re-implementa** el cablejat del pare respon «sí, el memo bloqueja» **per construcció**: no pot descobrir que una prop real del pare real (p. ex. `handleSegmentClick`, `generalConfig`, `onSeek`) tingui identitat inestable, perquè no les conté. Passaria igual amb el fix, sense el fix, o amb el fix a mitges. És el **tercer** cop que aquest projecte escriu un test infalsificable sobre aquest mateix memo (SPS-0034 el va sanejar a cegues, SPS-0035 el va mesurar sobre un pare fals). El que sí serveix: muntar el **component real dins la vista real**.
> >> * **El criteri d'acceptació «ha de bloquejar el 100 % dels ticks» → FALS al pare real.** Durant la reproducció **no** només canvia `currentTime`: `handleTimeUpdateThrottled` fa `setActiveSegmentId` a cada **frontera de subtítol** quan `syncSubsEnabled` (per defecte **true**), i `activeId` **és una prop comparada**. El bail-out correcte és «0 renders entre fronteres, **1 per frontera**». Si s'hagués aplicat el criteri del 100 %, la mesura correcta s'hauria llegit com un fracàs. (Corol·lari: el «100 %» que H-00020 dona per mesurat al standalone també és un artefacte del pare sintètic — allà la sincronització per temps existeix igualment.)
> >> * **La via d'arrel (`useMemo` al `return` de `useDocumentHistory`) → DESCARTADA de nou, però pel motiu correcte.** H-00020 la va descartar sobretot per por de congelar `isDirty` (guarda del factory reset); amb deps completes això **no** passaria. El motiu sòlid és un altre: el hook té **4 call-sites** (les dues vistes de subtítols **i `App.tsx` × 2 — l'editor de guió**) i **36 dep-arrays** en consumeixen el retorn. Avui es recreen a cada render, cosa que **emmascara deps incompletes**; estabilitzar l'objecte les congela **totes de cop, en silenci**, i el frontend **no té eslint** (`react-hooks/exhaustive-deps` inclòs) que pogués agafar-ne cap. Radi d'impacte molt superior al problema.
> >>
> >>#### **Solució:**
> >> * Els 6 handlers que el comparador compara al pare principal (`handleCueStart`, `handleCueEnd`, `handleCueStartKeepDuration`, `handleRippleFromCue`, `handleSegmentUpdate`, `handleSegmentUpdateEnd`) depenen ara dels **mètodes** (`subsHistory.commit` / `.updateDraft`), no de l'objecte. Els **15** dep-arrays restants del fitxer segueixen amb l'objecte a posta: **ningú els compara** (teclat, split, merge, insert, delete, batch, save) i tocar-los seria obrir radi d'impacte per res. La convivència dels dos estils queda explicada en un comentari al costat dels 6, com al standalone.
> >> * Comentari del comparador (`WaveformTimeline.tsx`) reescrit: deia «les props de callback NO hi són a propòsit» quan el codi de sota **en compara 8**. Ara distingeix els **dos grups no intercanviables**: les **8 d'interacció** (s'han de comparar; el preu és que els pares les mantinguin estables) i les **7 de la toolbar** (queden fora; el que les manté fresques és comparar el *valor d'estat que capturen*). S'hi afegeixen les dues excepcions que feien la «regla 1» literalment falsa: `videoRef` i `currentTime`.
> >>
> >>#### **Arxius modificats:**
> >> * `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` — 6 dep-arrays (objecte → mètode) + comentari de simetria.
> >> * `frontend/components/VideoEditor/WaveformTimeline.tsx` — **només el comentari** del comparador (cap canvi de lògica).
> >>
> >>#### **Verificació:**
> >> **Mesurat amb la vista REAL** (`VideoSubtitlesEditorView` muntada dins dels providers reals, sense backend, amb un WAV sintètic de 30 s injectat pel camí real del `syncRequest` i `api.streamUrlWithToken`/`getWaveform` monkeypatchats). Comptadors de render temporals als dos components, retirats en acabar (`git diff` comprovat). Finestra de 26 s de reproducció real, 4 subtítols:
> >> * **ABANS:** 99 renders del pare → **99 de l'ona** (1:1 — el memo no bloquejava mai). **El test és capaç de fallar: aquest és el bug, reproduït al pare real.**
> >> * **DESPRÉS:** 99 renders del pare → **5 de l'ona**, i el log de fronteres confirma **exactament 1 render per frontera de subtítol i 0 entremig**. És el màxim assolible: la resta de re-renders els provoca `activeId`, que **ha** de propagar-se.
> >> * **L'edició no queda congelada** (el risc real): amb el memo actiu i el vídeo en marxa, arrossegar un bloc a l'ona el mou (00:00:02,000 → 00:00:02,420), habilita **Desfer** (o sigui, `onSegmentUpdate` **i** `onSegmentUpdateEnd` arriben amb closures fresques), re-renderitza l'ona 9 cops **durant** el drag, i en deixar anar **torna a bloquejar el 100 %** dels ticks (0 renders de l'ona en 3 s).
> >> * `tsc --noEmit` net (i, com sempre en aquest fitxer, irrellevant per si sol).
> >> * **No verificat** (a les tasques de l'usuari): sincronització amb el guió, correccions pendents, takes, `useResumePosition` i la toolbar de l'ona amb un vídeo i un projecte de debò. La mesura de dalt exercita el memo, no aquests fluxos.
> >>
> >>#### **Lliçó:**
> >> **Un test que munta una còpia del pare no prova res sobre el pare.** La pregunta d'aquesta tasca era «les props reals són estables?», i qualsevol harness que reescrigui el cablejat contesta que sí abans de començar. Muntar el component **real dins la vista real** va costar una hora (providers, un WAV generat, dos monkeypatches d'`api`) i va donar un número que **pot** ser dolent — que és l'única mena de número que serveix.
> >> **Segona:** abans de mesurar, escriu el criteri d'acceptació **derivant-lo del codi**, no de la intuïció. «Ha de bloquejar el 100 %» era intuïtiu i fals; el codi deia «tot menys les fronteres de subtítol». Un criteri equivocat converteix una mesura bona en un fals negatiu.
> >>
> >>#### **Follow-ups (a tasks.md):**
> >> * L'invariant d'H-00020 queda **corregit allà mateix** (tres clàusules; la versió original només valia per al standalone).
> >> * Queda oberta la pregunta que planteja SPS-0036: el guany real és petit (s'estalvien ~4 passades de VDOM per segon, i el canvas no es redibuixava en cap d'elles). Si l'usuari prefereix la coherència de **treure el memo**, és una reversió petita — ara, però, amb la mesura a la mà.
> ---

> ---
> ## **H-00020** — Descobriment: el `React.memo` de l'ona **no ha bloquejat mai**, en cap de les dues vistes — una dep d'objecte retornat per un hook és una memoització falsa
> >> ###### *[2026-07-13]*
>
> >>#### **Tipus:**
> >> Bug resolt (parcial: standalone) + decisió arquitectònica (on va el fix d'arrel) + correcció d'una premissa falsa que ja havia contaminat dues fitxes
> >>
> >>#### **Tasques relacionades:**
> >> * SPS-0035 (→ EN_PROCES). SPS-0036 (nova, l'arrel al pare principal). Correcció dins SPS-0034.
> >>
> >>#### **Síntoma / Context:**
> >> SPS-0035 denunciava que al pare **standalone** el memo de `WaveformTimeline` no bloqueja mai perquè **dos** handlers (`handleSegmentUpdate`, funció plana; `onSegmentUpdateEnd`, arrow inline) tenen identitat nova a cada render, i afirmava que **al pare principal sí que funciona**. En anar a implementar-ho, les dues afirmacions han resultat ser incorrectes.
> >>
> >>#### **Descobriment que canvia el disseny:**
> >> **`useDocumentHistory` retorna un objecte literal nou a cada render** (`frontend/hooks/useDocumentHistory.ts:108-119`). Els seus mètodes **sí** són estables (`updateDraft` = `useCallback([])`, `commit` = `useCallback([draft])`), però l'embolcall no ho és mai. I hi ha **~20 dep-arrays** als dos editors escrits com `[..., subsHistory]` — o sigui, **20 `useCallback` que no memoitzen res**. Entre ells, els **6 handlers que el comparador del memo compara**, als **dos** pares. Conseqüència: el comparador retorna sempre `false` i **el bail-out no ha saltat mai, enlloc**. El memo és decoratiu des del dia que es va escriure.
> >> Corol·lari incòmode: el comparador que **SPS-0034** acaba de sanejar (afegint-hi `minGapMs`/`minDurationMs`) és **codi que no s'ha exercitat mai en producció**, i la verificació humana que aquella fitxa demanava («provar-ho a la vista principal, que és on el memo sí bloqueja») hauria **passat igual sense el fix**: un test infalsificable. El fix de SPS-0034 no deixa de ser correcte —de fet passa a ser **necessari**—, perquè activar el bail-out sense ell desperta el seu bug de debò.
> >>
> >>#### **El que NO ha funcionat:**
> >> * **El pla literal de la fitxa (memoitzar els dos handlers que hi surten) → NO assoleix el seu propi objectiu.** El comparador mira **8** props de callback; els **4 cue handlers** (`handleCueStart`/`End`/`KeepDuration`/`RippleFromCue`) **ja eren `useCallback`** i per això no havien aixecat sospites — però amb `subsHistory` a les deps. Memoitzant només els dos «obvis», el memo hauria continuat **igual de mort**, i el canvi hauria semblat fet.
> >> * **`useMemo` al `return` de `useDocumentHistory` (la via d'arrel temptadora) → DESCARTADA.** Arreglaria els dos pares de cop sense tocar cap dep-array, però: (a) `isDirty` (L116) es calcula **inline amb `JSON.stringify` a cada render** i `App.tsx:469-476` el publica a `window.__sonilabIsDirtyRef`, que és **la guarda que SettingsModal consulta abans del factory reset** → una dep oblidada al `useMemo` el congela i el reset esborra estat creient que no hi ha res brut: **risc de pèrdua de dades en una tasca de rendiment**; (b) activaria el bail-out **a l'editor principal en silenci**, canviant la semàntica de ~20 dep-arrays alhora, i just amb `WaveformTimeline.tsx` ple de canvis sense commitejar; (c) conceptualment **amaga** dep-lists imprecises darrere la identitat d'un objecte memoitzat, en lloc de dir la veritat sobre la dependència real (que és el **mètode**, no l'objecte).
> >> * **Confiar en `tsc --noEmit` com a verificació.** Aquí no prova absolutament res: l'objectiu de la tasca és «el memo ara bloqueja», que és una propietat de **runtime**. (Agreujant, per SPS-0021 el frontend no té `@types/react` → tot `React.*` és `any`.) La verificació real —comptador de renders durant la reproducció— queda a mans de l'usuari, i s'ha dit explícitament en comptes d'afirmar que funciona.
> >>
> >>#### **Solució:**
> >> * Al standalone, els 6 handlers depenen ara dels **mètodes** (`subsHistory.commit`, `subsHistory.updateDraft`) i no de l'**objecte**. És la dep certa: `updateDraft` no canvia mai, i `commit` canvia exactament quan canvia el `draft` — o sigui, **mai més tard** que `segments`, que ja és a la llista.
> >> * `onSegmentUpdateEnd` deixa de ser una arrow inline i passa a ser un `handleSegmentUpdateEnd` memoitzat amb la guarda `if (!isEditing) return` (simetria amb el pare principal; funcionalment un no-op, perquè `commitHistory` ja descarta un draft idèntic).
> >> * **L'arrel es deixa viva a posta** i es registra com a **SPS-0036** amb les tres vies (memoitzar el hook / repetir el fix local al pare principal / treure el memo), perquè activar el bail-out a l'editor principal —script sync, correccions, takes— mereix la seva pròpia verificació i no es cola dins una tasca de dues línies.
> >> * **Invariant que sosté la seguretat del bail-out**, escrit perquè és silenciós si algú el trenca: `segments` **és exactament** `subsHistory.present` === `draft` (la mateixa referència). És això —i no el comparador— el que manté fresc l'`onSave` de l'ona, que **no** es compara: mentre el memo bloqueja, `draft` no pot haver canviat. Si algú converteix `segments` en un array derivat o copiat, el botó Desar de l'ona pot persistir un draft **ranci**, sense error de tipus ni test que ho agafi.
> >>
> >>#### **Arxius modificats:**
> >> * `frontend/components/VideoSubtitlesEditor/VideoSrtStandaloneEditorView.tsx` — 6 dep-arrays (objecte → mètode), `handleSegmentUpdate` a `useCallback`, `handleSegmentUpdateEnd` nou, i un comentari que explica per què les deps són mètodes. **Únic fitxer.** `WaveformTimeline.tsx` no s'ha tocat.
> >>
> >>#### **Verificació:**
> >> `tsc --noEmit` net — i explícitament **insuficient** (veure «El que NO ha funcionat»). L'auditoria de què podria quedar ranci un cop el bail-out s'activa (refs assignats al render, efectes amb props no comparades, closures de la toolbar, `currentTime`) s'ha fet amb **tres revisions adversarials independents** + una quarta sobre el diff real: cap troballa MAJOR.
> >> **Mesurat al navegador** (harness temporal amb el `WaveformTimeline` real i el `useDocumentHistory` real, simulant el pare standalone: tick de `currentTime` cada 250 ms amb `isPlaying=true`). Finestra de 4 s: amb el cablejat **vell**, 16 renders del pare → **16 de l'ona** (1:1, memo mort); amb el **nou**, 16 renders del pare → **0 de l'ona** (bloqueja el **100 %**). **El test s'ha demostrat capaç de fallar** (contramesura d'H-00017): el mode «vell» del harness reprodueix el bug.
> >> **El bail-out no congela l'edició** —que era el risc real de la tasca—: amb el memo actiu i el vídeo «en marxa», arrossegar un bloc dona **10 `onSegmentUpdate` + 1 `onSegmentUpdateEnd`**, el segment es mou (0 → 0,72 s), `canUndo` passa a cert, l'ona es re-renderitza **11 cops durant el drag** (bail-in exactament quan toca, perquè `segments` canvia) i, en deixar anar, **torna a bloquejar el 100 %** dels ticks. Queda per validar a l'**app real** (el harness usa un pare sintètic i un vídeo fals) → tasques de l'usuari a SPS-0035.
> >> **Dependència dura d'ordre:** el comparador de **HEAD** encara no compara `autoScroll`/`minGapMs`/`minDurationMs` (això ho porta el diff no commitejat de SPS-0034). **SPS-0035 no es pot commitejar sense SPS-0034**, o el bail-out s'activa amb la llista vella i el bug de SPS-0034 passa de teòric a real.
> >>
> >>#### **Lliçó:**
> >> **Una dep que és un objecte retornat per un hook és una memoització falsa.** `useCallback(fn, [obj])` on `obj` és un literal reconstruït a cada render **no memoitza res**, però *sembla* que sí — i és invisible a la revisió, perquè el `useCallback` hi és. Aquí n'hi havia 20, i quatre d'ells eren precisament els que feien creure que la vista principal estava bé. La dep ha de ser **el que el cos llegeix de debò** (el mètode), no el contenidor.
> >> Segona lliçó, més cara: **un bail-out que no salta mai és pitjor que no tenir memo.** Dona una falsa sensació de contenció, converteix el seu comparador en codi mort que ningú pot provar (SPS-0034 el va sanejar **a cegues**), i fa que qualsevol test sobre ell sigui infalsificable. Quan una optimització depèn d'una condició que mai es compleix, el primer que cal verificar **no** és si la condició és correcta, sinó **si s'arriba a avaluar**.
> >> Tercera: quan una fitxa acota l'abast («arxius afectats: només X») i el diagnòstic real desborda aquell abast, el que s'ha de corregir és **la fitxa**, no l'abast en silenci.
> >>
> >>#### **Follow-ups (a tasks.md):**
> >> * **SPS-0036** — la mateixa arrel al pare principal (i la decisió de si el memo val la pena). Fins que no es faci, el comparador de SPS-0034 no serveix de res a `VideoSubtitlesEditorView`.
> >> * Aclarir el comentari de `WaveformTimeline.tsx:1238-1242`: diu que «les props de callback no es comparen a propòsit», però el codi de sota **en compara 8**. Tal com està, convida a «arreglar» el comparador esborrant justament el que el fa útil. (Anotat dins SPS-0036 per no tocar aquell fitxer ara.)
> >>
> >>#### **⚠️ Correcció de l'invariant (2026-07-13, en implementar SPS-0036 — veure H-00021):**
> >> L'invariant escrit a «Solució» (**`segments` és exactament `draft`, la mateixa referència**) descriu el **standalone**, i com a regla general **és fals**: el pare principal passa `segments={linkedSegmentsWithDiff}`, un array **derivat i copiat** (`VideoSubtitlesEditorView.tsx:1235`), i tot i així el bail-out hi és segur. Enunciat correcte, en tres clàusules:
> >> 1. El comparador ha de comparar `segments` **per referència** (`WaveformTimeline.tsx`). Si algú l'«optimitza» comparant longitud o contingut, tota la seguretat cau en silenci.
> >> 2. La identitat de la **prop** `segments` ha de canviar **sempre** que canviï el `draft`. Al standalone es compleix trivialment (és el draft); al principal, perquè `linkSegmentsToTakeRanges` i `applyGuionDiff` fan `.map()` en tots els seus braços → array nou sempre. Un `useMemo` amb deps incompletes, o una util que retornés el mateix array quan no hi ha canvis, trencaria això.
> >> 3. Cap prop **no comparada** pot capturar estat que no quedi reflectit en alguna prop **comparada**. És la clàusula general que fa segures les 7 callbacks de la toolbar. Avui hi ha una excepció coneguda i benigna: `onExportSrt` captura `currentDoc.name` (renombrar el doc a mig play deixa ranci el nom del fitxer exportat des de l'ona, fins al següent re-render).
> ---

> ---
> ## **H-00019** — Bug: el hit-test de l'ona era cec a la Y, i `scrollRef` amaga tres superfícies diferents sota la mateixa caixa
> >> ###### *[2026-07-13]*
>
> >>#### **Tipus:**
> >> Bug resolt (el fix «obvi» —descartar `y < RULER_H`— només tapava la meitat del forat)
> >>
> >>#### **Tasques relacionades:**
> >> * SPS-0033 (→ EN_PROCES). Detectat per la revisió adversarial de SPS-0029, fora d'abast allà.
> >>
> >>#### **Síntoma / Context:**
> >> `hitTestSegment` convertia només la **X** del punter a temps i retornava el segment d'aquella columna. Com que els handlers de ratolí viuen a `scrollRef` —un `absolute inset-0` que ocupa **tota** l'alçada del visor— qualsevol punt de la columna vertical d'un esdeveniment hi encertava. Reproduït al navegador **abans de tocar res** (harness amb el component real + gestos de Playwright): arrossegar 100 px sobre la **regla de timecodes** damunt d'un subtítol dona **10 `onSegmentUpdate` + 1 `onSegmentUpdateEnd`** (el subtítol es mou **i es compromet a l'historial**); arrossegar la **barra de scroll** fa **seek**; i el **doble clic** sobre qualsevol de les dues **selecciona** l'esdeveniment de sota.
> >>
> >>#### **Descobriment que canvia el disseny:**
> >> **`scrollRef` no és «l'ona»: és una sola caixa sota la qual conviuen TRES superfícies amb semàntica diferent** — la regla (22 px, que pinta el canvas), el contingut, i la **barra de scroll horitzontal nativa**. I la barra és el cas lleig: mesurat a l'app (visor 900×120), `offsetHeight` val 120 però `clientHeight` val **110** → la barra reserva **10 px de layout**, i com que el canvas es pinta **a sobre** (germà posicionat posterior, opac, `pointer-events-none`), la franja és **invisible però interactiva**. O sigui: hi veus ona i subtítol, però el ratolí hi troba la barra. Un usuari no pot ni saber que és allà. Per això el fix ha de partir per zones i **no** simplement descartar la regla.
> >>
> >>#### **El que NO ha funcionat:**
> >> * **El pla literal de la fitxa (descartar `y < RULER_H`) tot sol → INSUFICIENT.** Tanca la regla i deixa la barra de scroll oberta, que és **la meitat pitjor**: és invisible, o sigui que el bug hi és inexplicable per a l'usuari.
> >> * **Fer el reset «mínim» al sortir d'hora sobre la barra** (`mouseDownActiveRef = false` i prou) → **obre un bug pitjor**, exactament de la família d'H-00018. Les dues branques del `mousemove` estan protegides de forma **asimètrica**: la xarxa de seguretat mira `mouseDownActiveRef`, però la branca de drag **no**. Si un gest anterior va acabar malament (el mouseup empassat pel menú contextual natiu — el cas d'H-00018) i el següent press cau a la barra, el reset parcial deixaria `dragArmed` **viu** amb `mouseDownActive` **fals**: la xarxa queda desactivada i el segment **segueix el punter amb el botó ja deixat anar**. Es tanca amb `finishGesture()`, que ja fa la neteja sencera. **Invariant a no trencar mai: `dragArmed` viu amb `mouseDownActive` fals és un estat prohibit.**
> >> * **Posar la guarda de zona com a primera línia de `handleMouseDown`** (abans del filtre de botó) → **reobre SPS-0032**: un clic **dret** damunt la barra enmig d'un drag armat consumiria el gest. L'ordre correcte és filtre de botó → guarda de zona.
> >> * **Filtrar el doble clic per la Y viva del segon clic** → dues fuites simètriques, perquè el `dblclick` resol el **temps** contra el latch del **primer** clic (SPS-0029) i barrejar marcs és el mateix error d'aquella tasca: (a) prémer la **regla** i derivar 2 px avall (dins la distància de doble clic del SO) **seguia seleccionant**; (b) un doble clic **legítim** just sota la regla es **perdia**. La zona ha de sortir del **mateix marc** que el temps → `firstClickZoneRef`.
> >> * **Fer un `return` anticipat per zona al capdamunt de `handleMouseMove`** (la versió «neta») → deixaria el cursor **enganxat** a `grab`/`col-resize`: la branca de hover és qui el neteja, i ha de continuar executant-se sobre la regla i la barra.
> >>
> >>#### **Solució:**
> >> * `zoneAt(clientY)` → `ruler` | `content` | `scrollbar`. La franja de la barra es **mesura** (`sc.clientHeight`), no es codifica: quan l'ona hi cap sencera no hi ha barra, la franja val 0 i no queda cap zona morta. La **barra mana sobre la regla** en l'ordre de comprovació, per si el visor s'estrenyés fins a solapar-les.
> >> * `hitTestSegment(clientX, clientY)` retorna `null` fora de `content` → tanca alhora l'armat del drag i el cursor de hover, amb un sol canvi.
> >> * Press sobre la **barra**: `handleMouseDown` en surt sense armar **res**, amb `finishGesture()` i **després** del filtre de botó.
> >> * **Regla = eix de temps pur:** clic → seek, arrossegar → scrub, mai drag/resize/selecció. No ha calgut cap branca nova: allà `hit` és `null`, `dragSegIdRef` es queda buit i el gest cau sol a l'scrub. Els modificadors (fixar cues) hi segueixen actius a posta — actuen sobre l'esdeveniment **actiu**, no sobre el de sota el punter.
> >>
> >>#### **Arxius modificats:**
> >> * `frontend/components/VideoEditor/WaveformTimeline.tsx` — `PointerZone` + `zoneAt` (nous), `hitTestSegment` amb Y, guarda de zona a `handleMouseDown`, `firstClickZoneRef` latched i consultat a `handleDoubleClick`, hover amb Y. Cap prop nova → els pares no s'han tocat. El comparador del `React.memo` **no** s'ha tocat (és SPS-0034).
> >>
> >>#### **Verificació:**
> >> `tsc --noEmit` net. Al navegador, harness temporal amb el component **real** i gestos de Playwright (esborrat en acabar): **10/10 assercions**. Regla: arrossegar-hi dona **0 `onSegmentUpdate`** i **10 seeks** (scrub); doble clic → **0 seleccions**. Barra de scroll: arrossegar-hi i doble-clicar-hi donen **el log buit** (0 updates, 0 seeks, 0 seleccions). No-regressió del contingut: moure un esdeveniment segueix donant 10 updates + **1** commit; el resize per l'extrem, 8 updates + 1 commit; el doble clic segueix **seleccionant** (`s1`). Marcs creuats: 1r clic a la regla + 2n derivat 2 px al contingut → **no** selecciona; 1r clic al contingut + 2n derivat a la regla → **sí** selecciona.
> >> **El test s'ha demostrat capaç de fallar** (contramesura d'H-00017): neutralitzant `zoneAt` (que retorni sempre `content`) es **reprodueix el bug sencer** — la regla mou el subtítol i el commiteja (10 updates + 1 commit), la barra fa seek, i tots dos seleccionen al doble clic.
> >>
> >>#### **Lliçó:**
> >> **Quan un handler viu en un contenidor que ocupa més que allò que representa, el hit-test ha de partir el contenidor, no confiar-hi.** Aquí `scrollRef` semblava «l'ona» i n'era **tres coses**; la tercera (la barra de scroll) era **invisible** perquè el canvas s'hi pinta a sobre, i per això no havia sortit mai a cap revisió visual. Generalitzable: **una superfície interactiva que no es veu és pitjor que una que es veu malament** — el canvas `pointer-events-none` amaga la barra però no la desactiva, i la geometria real només la diu el DOM (`offsetHeight - clientHeight`), no el disseny. Segona lliçó, ja recurrent en aquest component (H-00018): en un component amb **estat de gest en refs**, tot camí que surt d'hora ha de sortir per la **neteja completa** (`finishGesture`), mai per un reset a mà de dues refs — les guardes de les branques són asimètriques i un reset parcial en desactiva unes i no les altres.
> >>
> >>#### **Follow-ups (a tasks.md):**
> >> * **Judici d'UX obert** (a les tasques manuals d'SPS-0033): la barra de scroll invisible ocupa 10 px on la part baixa d'un subtítol **no es pot agafar**. Les dues sortides —amagar-la de debò (`scrollbar-width: none`) o fer-la visible encongint el canvas— són tasca nova, no aquesta (regla e: canvi mínim).
> >> * **Judici d'UX obert:** durant la reproducció amb el seguiment actiu, arrossegar la barra ja no fa seek, però el RAF loop recentra cada frame i la barra sembla que no obeeix. És la semàntica d'SPS-0030 (per moure't lliurement, apaga el seguiment); valorar si un gest a la barra hauria de suspendre'l temporalment.
> ---

> ---
> ## **H-00018** — Bug: filtrar el botó al `mouseup` de l'ona obliga a tenir una xarxa de seguretat per al mouseup perdut
> >> ###### *[2026-07-13]*
>
> >>#### **Tipus:**
> >> Bug resolt (petit d'abast, però amb una trampa: el fix «obvi» n'obria un de pitjor)
> >>
> >>#### **Tasques relacionades:**
> >> * SPS-0032 (→ EN_PROCES). Detectat per la revisió adversarial de SPS-0029, fora d'abast allà.
> >>
> >>#### **Síntoma / Context:**
> >> `handleMouseDown` filtrava el botó (`if (e.button !== 0) return`) però `handleMouseUp` **no**. Reproduït al navegador amb gestos reals de botó dret abans de tocar res: (a) amb l'esquerre premut en espai buit, el mouseup del **dret** executava el **seek** (a 15,00 s) sense que l'usuari hagués deixat anar res; (b) enmig d'un **drag**, el mouseup del dret **comprometia l'esdeveniment a l'historial** (`onSegmentUpdateEnd`) i **matava el gest**: l'usuari continuava arrossegant amb l'esquerre premut i el subtítol es quedava clavat (8,50 s). A Windows això no és exòtic: el menú contextual surt al **mouse-up** del botó dret.
> >>
> >>#### **Descobriment que canvia el disseny:**
> >> **El `mouseup` no és només l'acció de clic: és l'ÚNIC punt on el component tanca el gest** (commit del drag + reset de tot l'estat d'interacció). Filtrar-lo per botó — el fix d'una línia que demanava la fitxa — vol dir que **cap altre esdeveniment** no pot tancar el gest. I el mouseup de l'esquerre **es pot perdre**: mentre el menú contextual natiu de Windows és obert, captura el ratolí. El resultat hauria estat un **drag enganxat al punter amb el botó ja deixat anar** — un bug més greu (mou subtítols sols) que el que s'anava a arreglar (cas rar, sense pèrdua de dades).
> >>
> >>#### **El que NO ha funcionat:**
> >> * **El fix literal de la fitxa, tot sol (`if (e && e.button !== 0) return;` i prou) → INSUFICIENT.** És correcte, però deixa el gest sense cap altra via de tancament que un esdeveniment que el SO pot no lliurar mai. La fitxa avisava de comprovar que no s'empassés cap `onSegmentUpdateEnd()` **degut** (i no se n'empassa cap: `dragMovedRef`/`dragSegIdRef` es conserven i el commit el fa el mouseup de l'esquerre); el que no veia és el risc **contrari** — que el commit no arribi **mai**.
> >> * **Confiar en el `mouseleave` com a xarxa** (ja feia la neteja): només salta si el punter **surt** del contenidor de l'ona. Amb el menú contextual obert damunt de la mateixa ona, el punter no surt de res: el gest quedaria viu i el següent moviment arrossegaria el subtítol sense cap botó premut.
> >> * **Fer que el `contextmenu` tanqui el gest** (`onContextMenu` → cleanup): rebutjat perquè ataca **un sol** camí de pèrdua del mouseup. `e.buttons` al `mousemove` és l'estat **viu** dels botons segons el navegador: cobreix el menú contextual i **qualsevol** altra pèrdua (canvi de finestra, alt-tab, drag fora del document) amb la mateixa línia i sense endevinar la causa.
> >>
> >>#### **Solució:**
> >> * `if (e && e.button !== 0) return;` com a primera línia de `handleMouseUp` (simètric amb `handleMouseDown`).
> >> * **Xarxa de seguretat al `mousemove`:** si el gest consta com a actiu (`mouseDownActiveRef`) però el botó primari ja **no** està premut (`(e.buttons & 1) === 0`), es tanca el gest. Commiteja el drag si s'havia mogut de veritat i reseteja l'estat — o sigui: el treball de l'usuari **no es perd**, simplement es tanca on toca.
> >> * La neteja compartida s'extreu a `finishGesture` i el `mouseleave` **la reutilitza** (mateixa lògica que ja tenia, ara en un sol lloc; el `mouseleave` és ara un àlies).
> >>
> >>#### **Arxius modificats:**
> >> * `frontend/components/VideoEditor/WaveformTimeline.tsx` — `finishGesture` (neteja compartida, nova), guard de botó a `handleMouseUp`, guarda `e.buttons` a `handleMouseMove`, `handleMouseLeave` reduït a `finishGesture`. Cap prop nova → els pares no s'han tocat.
> >>
> >>#### **Verificació:**
> >> `tsc --noEmit` i `vite build` nets. Al navegador, harness temporal amb el component real i gestos de Playwright amb **botó dret de veritat** (esborrat en acabar): **8/8 assercions**. Amb el guard: el mouseup del dret **no** fa seek (log buit) i el seek arriba, exacte (15,00 s), en deixar anar l'esquerre; enmig d'un drag, el botó dret dona **0 commits prematurs** i el drag **continua viu** (8,50 → 9,10 s en seguir arrossegant), amb **un sol** commit en deixar anar l'esquerre i **cap seek espuri**. Xarxa de seguretat: simulant el mouseup perdut (moviment amb `buttons=0`), el gest es tanca sol amb **1 commit** i moure 400 px més **no** arrossega el subtítol (queda a 8,50 s). No-regressió del model de ratolí d'SPS-0029: clic simple → seek; clic dret sol → no fa res; doble clic → segueix seleccionant; Shift+clic → segueix fixant la cue; scrub → segueix fent seeks.
> >> **El test s'ha demostrat capaç de fallar** (la contramesura que exigeix H-00017): desactivant el guard, els dos escenaris **reprodueixen el bug** (seek a 15,00 s amb l'esquerre premut; 1 commit prematur i drag mort).
> >>
> >>#### **Lliçó:**
> >> **Abans d'afegir una guarda a un handler, pregunta't què més feia aquell handler.** Aquí el `mouseup` era alhora *l'acció* (seek/cue) i *el tancament del gest* (commit + reset); filtrar-lo per botó arregla la primera i **desprotegeix** la segona. Regla generalitzable per a aquest component: **tot gest que s'obre amb un `mousedown` ha de tenir una via de tancament que no depengui d'un esdeveniment que el SO pot no lliurar mai** — i `e.buttons` (estat viu, no històric) és la via barata, perquè no cal enumerar les causes de la pèrdua. Corol·lari de procés: una fitxa etiquetada «risc 2/10, dimensions 1/10, una línia» **no és una excusa per saltar-se la revisió de casos límit**; el forat que va obrir el fix trivial era més greu que el bug original.
> >>
> >>#### **Follow-ups (a tasks.md):**
> >> * **Judici d'UX obert** (a les tasques manuals d'SPS-0032): el clic dret sobre l'ona avui **no fa res**. Si es vol un menú contextual propi (tallar/dividir/esborrar l'esdeveniment sota el punter), és una tasca nova.
> >> * La verificació del **menú contextual natiu** (el camí real de pèrdua del mouseup) només la pot fer un humà amb ratolí físic: Playwright dispara els esdeveniments DOM del botó dret, però no obre el menú del SO.
> ---

> ---
> ## **H-00017** — Bug + decisió: què governa exactament el botó «Seguiment» de l'ona (seguir ≠ revelar)
> >> ###### *[2026-07-13]*
>
> >>#### **Tipus:**
> >> Bug resolt (+ decisió de producte: l'abast del control)
> >>
> >>#### **Tasques relacionades:**
> >> * SPS-0030 (→ EN_PROCES) · toca la vora de SPS-0031 (la prop `autoScroll` deixa de ser deute mort)
> >>
> >>#### **Síntoma / Context:**
> >> El botó «Seguiment» de l'ona era **purament cosmètic**: `WaveformTimeline` declarava la prop `autoScroll` i **mai la desestructurava**; el RAF loop de reproducció condicionava l'autoscroll només a `isDraggingRef`. Apagar el seguiment canviava la icona i prou — l'ona continuava desplaçant-se sota el punter. Era, a més, **la vàlvula d'escapament que falta** per al «bot» de la vista en estacionari+reproduint que va quedar viu després d'H-00016.
> >>
> >>#### **Descobriment que canvia el disseny:**
> >> **El component té DOS camins que mouen la vista sols, i NO són la mateixa cosa.** (a) El **RAF loop** durant la reproducció: **segueix** el cursor de manera contínua (recentratge en estacionari, salt de pàgina en pàgina). (b) L'efecte «auto-scroll when paused»: **NO segueix res** — només salta si el punt ja ha quedat **FORA** de la finestra visible (H-00011/H-00014). Això segon no és seguiment, és **revelar** el cursor després d'un esdeveniment discret. La fitxa original de SPS-0030 proposava inhibir tots dos («probablement sí, per coherència amb el que el botó promet»); la revisió va demostrar que això és el pla equivocat.
> >>
> >>#### **El que NO ha funcionat:**
> >> * **Inhibir també l'efecte de pausa (el pla escrit a la pròpia fitxa de SPS-0030) → DESCARTAT.** Hauria creat **tres bugs nous**, tots invisibles des de la fitxa: (a) **el zoom es converteix en un teletransportador**: `scrollLeft` és en píxels i la finestra visible és `scrollLeft / zoom`, o sigui que canviar el zoom desplaça la vista **en temps**; avui qui la rescata és precisament aquest efecte (`zoom` és a les seves deps). Amb el seguiment apagat, cada mossa de zoom deixaria l'ona en una regió arbitrària amb el cursor amagat i **sense cap via de retorn**. (b) **Els seeks externs es tornen invisibles**: clicar un subtítol a la llista, els salts de teclat o prev/next mourien el vídeo i deixarien l'ona congelada amb el playhead en `display:none` — no hi ha cap afordança de «porta'm al cursor» a la UI. (c) **Canviar de media** deixaria la vista parada a l'offset de l'asset anterior. A més, hauria acoblat en silenci el futur de la persistència del botó amb SPS-0007 (restaurar la posició en reobrir).
> >> * **Suprimir el salt de la transició de pausa** (perquè, amb el seguiment apagat, prémer pausa revela el cursor i «descongela» la vista un cop): temptador, però l'únic senyal net és la transició `isPlaying`, i una actualització **tardana** del `currentTime` escapçat (~250 ms) pot colar-s'hi just després → el salt passaria **de vegades**. Un comportament intermitent és pitjor que un de consistent. Descartada també la variant amb finestra de temps (p. ex. «ignora canvis < 0,35 s»): és exactament la mena de **constant arbitrària** que H-00016 ja va criticar.
> >> * **Gatejar el comportament amb `autoScrollWave`** (la prop que pintava el botó) en comptes d'`autoScroll`: `autoScrollWave` no té default, o sigui que un consumidor que no passi els controls de capçalera tindria el seguiment **apagat per omissió** — congelació silenciosa. La solució és derivar-ne **una sola veritat**.
> >>
> >>#### **Solució:**
> >> * El botó «Seguiment» governa **només el seguiment durant la reproducció**: `followEnabledRef` s'afegeix a la guarda del RAF loop. Les branques de dins (recentratge estacionari / salt de pàgina) queden **byte-idèntiques** — la línia que H-00016 protegeix explícitament **no s'ha tocat**.
> >> * L'efecte de pausa **es queda viu i sense condicionar**, amb el «perquè» escrit al codi perquè ningú no el «corregeixi» després: **revelar ≠ seguir**.
> >> * `updatePlayheadPos` queda **fora** de la guarda: amb la vista congelada, el cursor continua movent-se dins la finestra i s'amaga en sortir-ne.
> >> * **Una sola veritat** per al comportament i per a l'estat encès/apagat del botó: `followEnabled = autoScrollWave ?? autoScroll` (amb `autoScroll = true` per defecte). Abans, el botó es pintava amb una prop i el comportament no en llegia cap: si algun dia divergien, el botó tornaria a mentir — que és la classe de bug d'aquesta entrada.
> >>
> >>#### **Arxius modificats:**
> >> * `frontend/components/VideoEditor/WaveformTimeline.tsx` (destructuring d'`autoScroll`, `followEnabled` + `followEnabledRef`, guarda del RAF loop, estat del botó + `aria-pressed`, comparador de `React.memo`). **Cap prop nova → els dos pares no s'han tocat.**
> >>
> >>#### **Verificació:**
> >> `tsc --noEmit` i `vite build` nets. Al navegador, amb el component real i un rellotge de media simulat (harness temporal, esborrat en acabar), **8/8 escenaris**: seguiment ON reproduint → la vista segueix el cursor (2597 px vs objectiu 2599); **seguiment OFF reproduint → la vista queda CONGELADA mentre l'àudio avança 1,52 s** (estacionari i pàgina); reactivar-lo en ple playback → recupera el cursor al frame següent (2782 vs 2784); el playhead s'amaga en sortir de la vista congelada i la vista no es mou; en **pausa** amb seguiment OFF, un seek fora de la finestra **sí que revela** el cursor (0 → 8970 px) i un seek dins la finestra **no mou** la vista (invariant d'H-00014 intacte); seguiment ON en mode pàgina → el salt de pàgina segueix funcionant (llindar 5010 px → vista a 4980).
> >> **A l'APP REAL** (stack sencer: Docker+Mongo, backend NestJS, frontend :3000; projecte amb SRT, vídeo i ona extreta; clics reals als controls, en Duo + estacionari): seguiment ON reproduint → la vista segueix (2363 → 2615 px); **seguiment OFF → vista CONGELADA a 2618 px mentre el vídeo avança 4 s**; reactivar-lo → recupera el cursor (2618 → 3160 px). La conseqüència acceptada també queda mesurada: 14 s congelats → el cursor surt de la vista → **la pausa fa un salt de 2322 px** per revelar-lo; amb només 6 s de deriva (cursor encara visible) **no salta**.
> >>
> >>#### **Lliçó:**
> >> **Un control no es «connecta»: primer cal decidir QUÈ governa.** El pla escrit a la fitxa («que el botó ho aturi tot, per coherència») semblava el més honest i era el més destructiu: hauria apagat un mecanisme que, tot i viure a la mateixa funció i dir-se igual («autoscroll»), fa una feina **oposada** — no seguir el cursor, sinó **rescatar-lo** quan un altre mecanisme (zoom, seek extern, canvi de media) el deixa fora de la vista. La pregunta útil no era «el botó ho apaga tot?» sinó «quantes coses diferents fa això que anomenem autoscroll?». Corol·lari de tooling: verificar-ho va donar **cinc falsos verds** abans del primer verd de veritat, i **tots deien el mateix** («la vista no s'ha mogut») — que és precisament el que el test buscava sentir. Al harness: (1) pestanya en segon plànol → Chromium escanya el `requestAnimationFrame` (cal `bringToFront()`; ja avisat a H-00016); (2) sense el CSS de l'app, `overflow-x-auto` no té efecte → el contenidor **no és scrollable** i `scrollLeft` es queda a 0 passi el que passi. A l'app real: (3) el timeline estava en **mode pàgina**, que amb prou feines mou la vista (només salta al 97% del marge dret) — l'escenari on es veu el bug és **estacionari**; (4) conduir el `<video>` per codi (`v.play()`) reprodueix l'element però **no** canvia l'`isPlaying` de React → el RAF loop no arrenca mai (el play de debò és el **clic sobre l'àrea del vídeo**, un `role="button"`); (5) amb la `duration` de l'app a 0, el contingut del timeline fa exactament l'amplada del viewport → **el component escrivia `scrollLeft = 2042` i l'element el rellegia com a 0**. La contramesura barata i obligatòria: comprovar SEMPRE que el test **pot fallar** — verificar primer que amb el seguiment ENCÈS la vista SÍ que es mou. Un test que no pot fallar no prova res.
> >>
> >>#### **Follow-ups (a tasks.md):**
> >> * **SPS-0031** — s'ha anotat a la seva fitxa que la prop `autoScroll` de `WaveformTimeline` **ja NO és deute mort** (no esborrar-la); el que sí que ho continua sent és l'`autoScroll` que viatja dins de `playerProps` cap a `VideoPlaybackArea`, un camí de props diferent que es diu igual.
> >> * **Judici d'UX obert** (a les tasques manuals de SPS-0030): amb el seguiment apagat, prémer **pausa** revela el cursor amb un salt. Acceptat conscientment; si molesta, la supressió té el cost documentat més amunt.
> >> * **Persistència del botó** entre sessions: avui és `useState(true)` (sempre encès en obrir). Si es persisteix, cal revisar SPS-0007 perquè reobrir un projecte amb el seguiment apagat no deixi el cursor invisible.
> ---

---

> ---
> ## **H-00016** — Bug: els gestos de ratolí llegien una vista que es movia sota el gest (doble clic, cues i seek durant la reproducció)
> >> ###### *[2026-07-13]*
>
> >>#### **Tipus:**
> >> Bug resolt (+ decisió arquitectònica: on viu la correcció)
> >>
> >>#### **Tasques relacionades:**
> >> * SPS-0029 (→ EN_PROCES) · engendra SPS-0032, SPS-0033
> >>
> >>#### **Síntoma / Context:**
> >> Els handlers de ratolí de `WaveformTimeline` derivaven el temps del `scrollLeft` **viu**: `handleMouseUp` recalculava el punt clicat al final de la pressió i `handleDoubleClick` feia el hit-test amb el punter viu. Durant la reproducció, el RAF loop reescriu `scrollLeft` a 60 fps → **el marc de coordenades es movia enmig del gest**. Els 3 símptomes que SPS-0029 tenia registrats només com a anàlisi estàtica es van **reproduir primer al navegador** (harness amb el component real, vídeo simulat i gestos de Playwright): doble clic en estacionari+reproduint seleccionant l'esdeveniment equivocat (la vista saltava −364 px entre els dos clics; només encertava prop del centre horitzontal), clic i modificador+clic aterrant tard exactament la durada de la pressió (+110 ms / +250 ms), i un clic que travessa un salt de pàgina aterrant **9,42 s** lluny.
> >>
> >>#### **Descobriment que simplifica el disseny:**
> >> Dos, tots dos sortits de la reproducció i cap dels dos previst per la fitxa:
> >> 1. **El codi ja tractava «gest en curs → no moguis la vista» com a invariant, però incomplet.** Quan el clic comença **sobre un segment**, el hold-timer arma el drag i posa `isDraggingRef = true`, que congela l'autoscroll → l'error queda acotat a ~50 ms i el salt de pàgina no s'hi manifesta. L'error complet només apareix quan el clic comença en **espai buit** (cap hit → cap hold-timer → autoscroll viu tota la pressió).
> >> 2. **El bug no és exclusiu de la reproducció ni d'estacionari.** El mateix error de selecció existeix **en pausa i en mode pàgina** si es fa doble clic a la **vora dreta** (>97% del viewport): allà qui mou la vista entre els dos clics no és el RAF, sinó l'**efecte de pausa**. És el bug d'H-00014 encara viu al 3% dret. Això va decidir **on** havia d'anar el fix: a la capa de gest (immune a qualsevol moviment de la vista), no al RAF.
> >>
> >>#### **El que NO ha funcionat:**
> >> * **La finestra de gràcia al RAF loop (`suppressRecenterUntilRef`), que era el pla escrit a la pròpia fitxa de SPS-0029 i al follow-up d'H-00015 → DESCARTADA.** Tres motius: (a) **és incompleta** — no cobreix el camí de pausa (la vora dreta), on el bug també existeix; (b) introdueix una **constant arbitrària** lligada al llindar de doble clic del SO (configurable a Windows), quan `e.detail` ja dona la mateixa informació de forma exacta i autoconsistent (`dblclick` es dispara ⟺ `detail` és parell); (c) hauria **col·lidit amb SPS-0030**, que ha de tocar la mateixa guarda del RAF.
> >>   > ⚠️ **Delimitació explícita de l'invariant d'H-00011/H-00014, perquè ningú no reobri això:** «l'autoscroll no recentra mai en una acció manual» s'aplica al camí de **PAUSA**. El recentratge continu del RAF durant **reproducció real** (`scroll.scrollLeft = px - vw/2`) **NO és la variant vella pendent d'arreglar: és la definició del mode estacionari**, i H-00014 el va deixar intacte a posta. **Aquella línia es queda.** La Lliçó d'H-00014 («comprovar TOTS els camins que implementen la variant antiga») **no** demana tocar-la.
> >> * **Latchar el temps ja clampat a `[0, duration]`** (la primera versió del pla): trencava el hit-test. `pixelToTime` clampa però `hitTestSegment` treballa amb píxels absoluts **sense clamp**; amb un media més curt que el viewport a zoom baix, un doble clic a la zona morta de la dreta hauria caigut dins la tolerància `x2 + 2` i **hauria seleccionat l'últim esdeveniment** (avui no en selecciona cap). I amb `duration = 0` (media absent o abans de `loadedmetadata`) tot temps latched hauria valgut 0. Es latcha el temps **cru**.
> >> * **Latchar píxels absoluts en comptes de temps:** aparentment equivalent i més directe, però un píxel latched no significa res sense la seva escala — si el zoom canvia entre els dos clics (Ctrl+roda), el hit-test el reinterpreta amb el zoom nou. El **temps** és invariant d'escala. (Verificat: doble clic amb el zoom canviant de 100 a 150 entre els dos clics → selecció correcta.)
> >> * **`e.detail >= 2` com a `return` anticipat a `handleMouseUp`:** s'emportaria per davant el `onSegmentUpdateEnd()` del drag (**pèrdua de dades**: edició al DOM però no a l'historial — la classe de bug d'H-00013) i el reset d'estat (`mouseDownActiveRef` quedaria a `true` → el playhead seguiria el ratolí sense cap botó premut). La guarda ha d'anar **només a la condició de la branca de clic simple**.
> >> * **`e.detail < 2` (en comptes de la paritat):** mataria el **3r clic** d'una cadena (Chromium continua comptant: 3, 4…) i qualsevol clic posterior. La regla correcta és de **paritat**: una cadena llarga són parelles independents, i el clic senar sempre és un clic simple de ple dret.
> >> * **Descartar el 2n clic sense mirar els modificadors:** un clic seguit d'un **Shift+clic** al mateix punt (dins de la finestra del SO) és una acció **deliberada i distinta**, no una repetició; descartar-la la faria desaparèixer en silenci. Per això la supressió només s'aplica si els modificadors coincideixen amb els del primer clic.
> >> * **Tooling — dues trampes que van fer que el bug NO es manifestés al harness:** (a) amb la pestanya en **segon pla**, Chromium escanya el `requestAnimationFrame` → la vista no es movia durant la pressió i tot semblava correcte; cal `page.bringToFront()`. (b) Els esdeveniments sintètics del CDP **no** repliquen el comptador de clics natiu: dos `mouse.down()` seguits donen `detail = 1` i **no** emeten `dblclick`; cal enviar `clickCount: 2` explícit. Qualsevol harness futur de l'ona (SPS-0028, SPS-0030) topa amb totes dues.
> >>
> >>#### **Solució:**
> >> Tot a la **capa de gest** de `WaveformTimeline.tsx`; el RAF loop i l'efecte de pausa queden intactes.
> >> * **Latch del marc del gest:** `downRawTimeRef` (temps sota el punter al `mousedown`, **sense clamp**) i `firstClickRawTimeRef` (el del primer clic de la parella). Nous helpers `rawTimeAt(clientX)` i `hitTestAtTime(t)`; `pixelToTime` i `hitTestSegment` passen a ser-ne embolcalls i conserven la seva semàntica exacta (clamp inclòs) per als seus consumidors actuals (drag, re-àncora de la zona morta, scrub — que han de seguir el punter amb el marc **viu**).
> >> * La branca de clic simple de `handleMouseUp` (seek + els 4 modificadors de cue) usa el latch, clampat a `[0, duration]`.
> >> * `handleDoubleClick` resol el hit-test contra el temps latched del **primer** clic. El latch s'invalida si la cadena comença fora de l'ona (listener de `mousedown` en captura a `document`: el comptador de clics del navegador és temps+distància i **no mira el DOM**, o sigui que una parella pot començar a la capçalera i acabar dins l'ona) o si el gest acaba sent drag/scrub.
> >> * **Regla de paritat** (`detail` parell = 2n clic d'una parella): no reexecuta l'acció de clic simple (excepte si els modificadors difereixen), no arma el hold-timer i no arma el scrub.
> >>
> >>#### **Arxius modificats:**
> >> * `frontend/components/VideoEditor/WaveformTimeline.tsx` (refs del gest, `rawTimeAt`/`hitTestAtTime`, `handleMouseDown`, branca 3 de `handleMouseMove`, `handleMouseUp`, `handleDoubleClick`, `handleMouseLeave`, listener d'invalidació). **Cap prop nova → cap canvi als dos pares ni al comparador de `React.memo`.**
> >>
> >>#### **Verificació:**
> >> `tsc --noEmit` i `vite build` nets. Al navegador, **15/15 assercions** amb el component real: doble clic correcte a x=120/300/500/850 en estacionari+reproduint; doble clic correcte a la vora dreta en pausa i en pàgina **tot i que la vista salta 960 px entre els dos clics**; clic i els 4 modificadors amb error **0 ms** (abans +110/+250/+50 ms); clic travessant el salt de pàgina amb error **0 ms** (abans 9,42 s); doble clic → **exactament 1** seek / 1 cue / 1 ripple (mai dos); cap `segmentUpdate` ni commit espuri amb deriva del punter durant el 2n clic; scrub i drag intactes; triple clic → el 3r clic torna a fer seek; `duration = 0` i zona morta dreta sense falsos positius; Ctrl+clic a la zona morta rep exactament `duration` (el clamp protegeix `endTime`); el callback de cue veu les mutacions de segments (cap closure rància — H-00013). **Pendent:** verificació humana a l'app real amb ratolí físic (tasques manuals a SPS-0029) — el comptador de clics natiu del SO no és verificable amb Playwright.
> >>
> >>#### **Lliçó:**
> >> **Reproduir abans de planificar canvia el pla.** La fitxa prescrivia tocar el RAF loop; la reproducció va demostrar que (a) el bug també viu en pausa i en mode pàgina (la vora dreta), on el RAF ni hi és, i (b) el codi ja congelava la vista durant els gestos que comencen sobre un segment. Amb això, la correcció correcta era **fer el gest immune al moviment de la vista** (latch del marc), no **impedir que la vista es mogués** (finestra de gràcia) — que era incompleta i, a sobre, hauria trepitjat el contracte del mode estacionari i la tasca SPS-0030. Corol·lari sobre el tooling: un harness que no reprodueix el bug **abans** del fix no prova res del **després** — aquí, amb la pestanya en segon pla i sense `clickCount: 2`, tots els tests haurien passat en verd sobre el codi trencat.
> >>
> >>#### **Follow-ups (moguts a tasks.md):**
> >> * **SPS-0032** — `handleMouseUp` no filtra `e.button`: un mouseup de botó dret amb l'esquerre premut consumeix el gest.
> >> * **SPS-0033** — el hit-test només mira la X: la regla de timecodes i la barra de scroll poden arrossegar un segment.
> >> * **SPS-0030** — segueix sent la vàlvula d'escapament real per al bot visual de la vista en estacionari+reproduint (i ara ja no hi ha conflicte de línies amb SPS-0029).
> >>
> >>#### **Eina reutilitzable:**
> >> El harness de verificació de gestos de l'ona (component real + vídeo simulat + API `window.H` per a Playwright) es conserva a **`.claude/to_claude/waveform-harness/`** amb el seu README. `to_claude/` és gitignorat: viatja amb una **còpia de carpeta** però no amb un `git clone`. Si s'ha perdut, és reconstruïble a partir d'aquesta entrada (les dues trampes de Playwright i el patró de mesura hi són descrits) — útil per a SPS-0028/0030/0032/0033.
> ---

---

> ---
> ## **H-00015** — Decisió arquitectònica: un sol model d'interacció de ratolí, mode-agnòstic (es tanquen els presets page/duo)
> >> ###### *[2026-07-13]*
>
> >>#### **Tipus:**
> >> Decisió arquitectònica (tasca avaluada i descartada — cap canvi de codi)
> >>
> >>#### **Tasques relacionades:**
> >> * SPS-0015 (→ CANCELATS) · engendra SPS-0029, SPS-0030, SPS-0031
> >>
> >>#### **Síntoma / Context:**
> >> SPS-0015 (incorporada el 2026-07-07, abans de les Fases A i B de l'ona) proposava «separar explícitament els presets d'interacció de ratolí per mode (page vs duo) en comptes de derivar-los del mode de scroll actiu». La seva font era la nota de disseny «dreceres vs ratolí» de `tasks.md`, que deia: *"El que és dependent del mode és només el ratolí"*.
> >>
> >>#### **Descobriment que tanca la qüestió:**
> >> **Aquella frase ja no és certa, i per tant la tasca no té objecte.** Auditoria del codi real: cap handler de ratolí de `WaveformTimeline.tsx` llegeix mai el mode — `handleMouseDown` (L590, deps `[hitTestSegment, pixelToTime, clearHold]`), `handleMouseMove` (L636), `handleMouseUp` (L739), `handleDoubleClick` (L793), `handleMouseLeave` (L804) i `handleWheel` (L821). Tots els paràmetres del ratolí són **globals i únics** en els dos modes: `WAVEFORM_HOLD_MS` (L628), `WAVEFORM_DRAG_DEADZONE_PX` (L598/L642-647), `EDGE_HIT_PX` (L92), llindar de scrub `dx > 3` (L708) i el mapa de modificador+clic (L758-762). L'ÚNICA lectura funcional del mode a tot el component és **una línia**: el RAF loop de reproducció (L481-490, `page` → salt per pàgines / `stationary` → recentratge continu); la resta és la visibilitat del botó de mode (L898-905) i el comparador de `React.memo`. Dit d'una altra manera: després de SPS-0012/0013/0014, **«estacionari/Duo» ja no és un mode d'interacció, sinó un estil de seguiment durant la reproducció.**
> >>
> >>#### **El que NO ha funcionat** (el cas a favor dels presets, construït expressament com a advocat del diable i refutat):
> >> * **«Fem un preset per mode igualment, per si de cas»:** error de categoria. No es pot parametritzar una dimensió que ja no existeix a la capa d'interacció. No hi ha cap «derivació» a substituir.
> >> * **L'eix «page vs duo» és, a més, l'eix equivocat:** `effectiveScrollMode = waveViewMode === 'page' ? 'page' : scrollModeWave` (`VideoSubtitlesEditorView.tsx:241`) → **Duo també pot ser page**. Un «preset de Duo» s'activaria per a un usuari amb el toggle intern a pàgina i comportament byte-idèntic al de Pàgina.
> >> * **L'únic preset per mode amb contingut real seria «Ctrl+clic per editar / per fer seek en estacionari»** — exactament el carreró ja descartat a H-00011 i re-descartat a H-00014 (dos models de clic diferents dins la mateixa app; fricció a l'operació més freqüent).
> >> * **Contradiria l'esquema mestre:** `Shortcuts Subtitols - Consolidat.csv` no té columna ni secció per mode, i la seva base tècnica diu literalment «Mode PAGINA unic: nomes salta quan el cursor surt de la finestra visible. MAI recentra en un clic manual». La Fase C (SPS-0025) ja fixa «un sol joc de dreceres, independent del mode de scroll»: bifurcar el ratolí mantenint un sol teclat seria incoherent.
> >> * **Cap fase futura no ho reclama:** a la Fase B2 (SPS-0028) el rang provisional de «crear-arrossegant» es guarda en TEMPS (immune al scroll), el scrub suprimeix l'autoscroll als dos modes (`isDraggingRef`, L478) i `Alt`+vora-veí és pur domini temporal.
> >> * **Cost real infravalorat** per l'estimació original (2/10): ≥2 claus de localStorage per paràmetre, superfície nova a SettingsModal/factoryReset/memo, i una **matriu de verificació manual ×2 per a cada gest futur** de l'ona.
> >>
> >>#### **Solució (decisió):**
> >> **Model d'interacció únic i mode-agnòstic — ratolí i teclat.** El mode de vista (Pàgina/Duo) només governa el seguiment de la vista DURANT la reproducció real. Qualsevol futura divergència de comportament entre modes s'ha de resoldre amb **un invariant únic** (una regla que sigui no-op en el mode on no cal), mai amb dos jocs de gestos. SPS-0015 → CANCELATS. Actualitzada la nota de disseny obsoleta a `tasks.md` que va originar la premissa.
> >>
> >>#### **Arxius modificats:**
> >> * Cap fitxer de codi (avaluació). Només documentació: `.claude/docs/tasks.md` (SPS-0015 → CANCELATS amb motiu; noves SPS-0029/0030/0031; nota de disseny «dreceres vs ratolí» corregida; SPS-0025 actualitzada) i aquesta entrada.
> >>
> >>#### **Verificació:**
> >> Auditoria de codi amb tres revisors adversarials en paral·lel (lent de premissa/correcció sobre el codi real, lent d'advocat del diable pro-presets, lent de casos límit durant la reproducció). Convergents: la premissa és falsa i el cas pro-presets no aguanta. **No s'ha executat cap build** perquè no s'ha tocat cap fitxer de codi. Els tres símptomes registrats a SPS-0029 provenen d'anàlisi estàtica del codi i **encara no s'han reproduït al navegador** — així consta a la tasca.
> >>
> >>#### **Lliçó:**
> >> Una tasca «d'avaluar» que porta setmanes al backlog s'ha de re-verificar contra el codi ACTUAL abans de planificar-ne res: aquí la premissa (i la nota de disseny que la sostenia) havien quedat obsoletes per tres tasques posteriors (SPS-0012/0013/0014) que ningú va relacionar amb ella. El resultat correcte d'una avaluació pot ser **descartar-la i esborrar la premissa**, no implementar-la. I la troballa de valor no era la que la tasca demanava: l'asimetria real entre modes existeix (la vista es MOU sota el gest en estacionari mentre reprodueix), però es resol amb un invariant mode-agnòstic (SPS-0029), no partint el model de ratolí en dos.
> >>
> >>#### **Follow-ups (moguts a tasks.md):**
> >> * **SPS-0029** — Gestos de ratolí contra una vista en moviment durant la reproducció: (a) el doble clic en estacionari MENTRE REPRODUEIX encara selecciona l'esdeveniment equivocat (mateixa arrel que H-00014, però al camí del RAF loop, que aquell fix va deixar intacte a posta); (b) clic i modificador+clic aterren tard (el temps es calcula al `mouseUp` amb el `scrollLeft` viu); (c) salt de pàgina enmig d'un clic. Fix mode-agnòstic: latch del temps al `mouseDown` + finestra de gràcia sense recentratge després d'un seek manual.
> >> * **SPS-0030** — El botó «Seguiment» de l'ona és cosmètic: la prop `autoScroll` (L40) mai es desestructura i el RAF loop només mira `isDraggingRef` (L478) → apagar el seguiment no atura res.
> >> * **SPS-0031** — Neteja de deute mort de l'ona: clau `WAVEFORM_CTRL_CLICK_SEEK` (+ comentari que descriu el contrari del que fa el codi), props `viewMode`/`onToggleViewMode`, passthroughs morts (`VideoPlaybackArea`, `VideoSubtitlesToolbar`) i botó vestigial de `MediaPreviewView`.
> ---

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
