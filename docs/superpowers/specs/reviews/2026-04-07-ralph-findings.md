# Ralph Loop — Revisió iterativa del spec del Factory Reset + canvis Fase A

**Objectiu:** trobar qualsevol desviació, bug, edge case perdut, suposició incorrecta, inconsistència o errada de disseny al spec del Factory Reset (`docs/superpowers/specs/2026-04-07-reset-configuracio-frontend.md`) i als canvis de codi de la Fase A ja aplicats:

- `frontend/constants.ts` — canvi de defaults d'atajos `I/O` → `Q/W` (línies 92-93).
- `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` — `handleSetTcIn` i `handleSetTcOut` llegeixen de `videoRef.current.currentTime` amb fallback (línies 838-865).

---

## Format per a cada issue

```
## Issue N — <títol curt>
**Iteration:** <número d'iteració>
**Angle:** <quin angle de revisió s'ha fet servir>
**Severity:** critical | important | minor
**Type:** bug | design-flaw | missed-edge-case | wrong-assumption | inconsistency | doc-error
**Location:** <fitxer:línia o secció del spec>
**Description:** <què és el problema>
**Recommended fix:** <solució concreta>
**Spec update needed:** yes | no
```

---

## Angles coberts

Cada iteració ha de triar un angle NOU d'aquesta llista (o afegir-ne un de nou si cal) i marcar-lo aquí quan l'hagi cobert. No repetir angles ja coberts.

- [x] **A1. systematic-debugging sobre els canvis de codi de Fase A** (precisió del temps, scope de `videoRef`, condicions de `useCallback` deps, efectes secundaris en altres handlers del mateix fitxer) — **iter 3, 1 minor issue trobat (comentari inexacte); codi funcionalment correcte**
- [ ] **A2. code-review formal sobre els canvis de codi de Fase A** (estil, convencions, comentaris, naming, patrons del codebase)
- [x] **A3. Verificació de les referències a codi del spec** (comprovar que els fitxers, línies i comportaments referenciats al spec realment existeixen i coincideixen amb el que el spec descriu) — **iter 7, 1 issue menor consolidat (3 off-by-some en refs)**
- [x] **A4. Inventari de keys `snlbpro_*` no cobertes pel spec** (buscar tot el codebase keys que es llegeixen/escriuen i que el spec pot haver oblidat a incloure a la llista d'esborrat o a la de preservats) — **iter 1, 2 issues trobats**
- [x] **A5. Inventari de contextos React que inicialitzen de localStorage** (el spec diu que `ThemeContext`, `AuthContext`, `LibraryDataContext` ho fan — cal comprovar que no n'hi ha més, tipus `TranslationContext`, `TranscriptionContext`, `UserStylesContext`, etc.) — **iter 2, 2 issues trobats (1 important doc-gap, 1 important race condition)**
- [x] **A6. Verificació backend: hi ha altres endpoints o llocs on les preferences de l'usuari es persisteixen?** (si el spec només toca `api.updateMe` però hi ha altres rutes que escriuen a `me.preferences`, podrien ser fonts d'arrossegament d'estat antic) — **iter 4, clean (cap issue)**
- [x] **A7. Race conditions i multi-pestanya** (què passa si l'usuari té 2 pestanyes obertes i fa Reset en una? els `BroadcastChannel` / `storage` events sincronitzen res? el spec ho contempla?) — **iter 5, 1 issue important trobat**
- [x] **A8. Edge cases a la modal del spec** (què passa si `window.location.reload()` falla, si l'usuari tanca el modal a mig reset, si `sessionStorage` està deshabilitat, si l'usuari està en mode incognito) — **iter 6, 4 issues trobats (1 important, 3 minor)**
- [x] **A9. Coherència entre les seccions del spec** (la taula de la secció 3.2 contradiu res de les seccions 4-9? els nombres de línies estimats són realistes? les referències internes al spec són coherents?) — **iter 8, 2 issues menors trobats**
- [ ] **A10. Migració inversa / desistement** (què passa si un usuari fa Reset, es penedeix, i vol recuperar els atajos antics — el spec ha de contemplar-ho o confirmar explícitament que no és un objectiu)

---

## Hallazgos

## Issue 1 — Keys `sonilab_guion_<docId>` no mencionades a la llista de preservats
**Iteration:** 1
**Angle:** A4
**Severity:** important
**Type:** doc-error / missed-edge-case
**Location:** spec secció 3.2 (taula "Preservats")
**Description:**
El spec documenta una llista explícita de keys a esborrar (section 3.2) i una llista de keys preservades, però **falta completament** mencionar les keys `sonilab_guion_<docId>`. Aquestes keys són usades activament pel codi per persistir localment el text del guió vinculat a cada document:
- [VideoSubtitlesEditorView.tsx:207](frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx#L207): `const _localGuionKey = \`sonilab_guion_${currentDoc?.id}\`;`
- [VideoSubtitlesEditorView.tsx:479, 488](frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx#L479): `localStorage.getItem(\`sonilab_guion_${currentDoc.id}\`)`
- [ScriptExternalView.tsx:22](frontend/components/ScriptExternalView.tsx#L22): `return \`sonilab_guion_${docId}\`;`
- [ScriptViewPanel.tsx:38](frontend/components/VideoSubtitlesEditor/ScriptViewPanel.tsx#L38): `return \`sonilab_guion_${docId}\`;`

Aquestes keys contenen **contingut del guió escrit per l'usuari** que es desa localment quan no hi ha projecte de backend (vegeu el comentari a `VideoSubtitlesEditorView.tsx:209-213` — "Desa el guió a localStorage quan no hi ha projecte (per persistir entre sessions)"). És per-document data que pot contenir feina sense desar, igual que `snlbpro_versions_<docId>`.

**Per què funciona igualment el comportament**: com que el spec fa servir una llista d'esborrat (blocklist), qualsevol key no mencionada s'ignora i, per tant, es preserva per defecte. Això vol dir que el comportament real del reset ja és correcte sense cap canvi. Però el spec no ho documenta, creant un gap que pot confondre a qui mantingui el feature.

**Un punt interessant**: aquestes keys utilitzen un prefix **diferent** (`sonilab_` en lloc de `snlbpro_`), la qual cosa desmenteix la suposició implícita del spec que "tot allò persistit pel frontend té prefix `snlbpro_`".

**Recommended fix:**
Afegir una línia a la taula "Preservats" de la secció 3.2:
> - `sonilab_guion_<docId>` (còpia local del text del guió per document — pot contenir feina sense desar)

I afegir una nota breu a la secció 3.2 explicant que el codebase té **dos** prefixes actius per localStorage: `snlbpro_` (majoria) i `sonilab_` (dos casos: token i guions locals). Això evita que un futur implementador assumeixi que pot fer un prefix scan `snlbpro_*` i capturar-ho tot.

**Spec update needed:** yes

---

## Issue 2 — Key d'autenticació `sonilab_token` no especificada explícitament al spec
**Iteration:** 1
**Angle:** A4
**Severity:** minor
**Type:** doc-error
**Location:** spec secció 3.2 (taula "Preservats") i [api.ts:8](frontend/services/api.ts#L8)
**Description:**
El spec diu a la llista de preservats: "Token d'autenticació (Reset ≠ Logout)". Això és conceptualment correcte, però **no especifica el nom real de la key**, que és `sonilab_token` (definida a [api.ts:8](frontend/services/api.ts#L8) com `const TOKEN_KEY = 'sonilab_token';`).

**Per què és rellevant**: si un futur implementador del feature decidís ignorar la recomendació del spec i implementar l'esborrat com a prefix scan, faria `Object.keys(localStorage).filter(k => k.startsWith('snlbpro_'))` — això **no** esborraria `sonilab_token` i seria correcte per casualitat. Però si algú fa un prefix scan `sonilab_`, **sí esborraria el token** i desbloquejaria la sessió, violant la garantia de "Reset ≠ Logout". Aquesta ambiguïtat està latent perquè el spec mai mencina que el prefix de la key del token és `sonilab_`, no `snlbpro_`.

**Recommended fix:**
Afegir una línia a la taula "Preservats" de la secció 3.2:
> - `sonilab_token` (token d'autenticació JWT — Reset ≠ Logout)

I afegir a les "Coses que NO es fan" (secció 8) o al comentari sobre la llista explícita a 3.2:
> Nota: no es fa cap prefix scan (ni `snlbpro_*` ni `sonilab_*`) precisament perquè `sonilab_token` conviuria amb d'altres keys del mateix prefix i podria ser esborrat per error.

**Spec update needed:** yes

---

## Issue 3 — Llista de contextos que inicialitzen de localStorage és incompleta al spec
**Iteration:** 2
**Angle:** A5
**Severity:** important
**Type:** doc-error / wrong-assumption
**Location:** spec secció 5, apartat "Per què la recàrrega és obligatòria"
**Description:**
El spec justifica la recàrrega obligatòria dient:
> `ThemeContext`, `AuthContext`, `LibraryDataContext` inicialitzen estat al mount llegint `localStorage`.

Aquesta llista és **substancialment incompleta**. Hi ha almenys tres contextos MÉS que llegeixen de localStorage al mount i que la llista no menciona:

1. **`TranscriptionContext`** ([TranscriptionContext.tsx:79-85](frontend/context/Library/TranscriptionContext.tsx#L79-L85)):
   ```ts
   const [state, dispatch] = useReducer(transcriptionReducer, {
     transcriptionTasks: deduplicateTasks(
       loadLocal<TranscriptionTask[]>(LOCAL_STORAGE_KEYS.TASKS_TRANSCRIPTION, [])
     ),
   });
   ```
   Llegeix `TASKS_TRANSCRIPTION` només una vegada al reducer init.

2. **`TranslationContext`** ([TranslationContext.tsx:18](frontend/context/Library/TranslationContext.tsx#L18)): mateix patró amb `TASKS_TRANSLATION`.

3. **`UserStylesContext`** ([UserStylesContext.tsx:74, 90](frontend/context/UserStyles/UserStylesContext.tsx#L74)): llegeix `scopedKey(userId)` i el legacy `EDITOR_STYLES`.

A més, hi ha **9 components** que usen el hook `useLocalStorage` directament i que inicialitzen el seu estat al mount llegint de localStorage:
- `App.tsx:251` (LIBRARY_WIDTH)
- `SettingsModal.tsx:134, 340-346` (SHORTCUTS, LIBRARY_WIDTH, TAKE_MARGIN, TAKE_START_MARGIN, MAX_LINES_SUBS, SUB_GRID_OPACITY, EDITOR_MIN_GAP_MS, WAVEFORM_HOLD_MS)
- `SonilabLibraryView.tsx:88-90` (LIBRARY_*_COL_WIDTH)
- `SegmentItem.tsx:77` (SUB_GRID_OPACITY)
- `VideoSubtitlesEditorView.tsx:71-73, 129, 238` (TAKE_MARGIN, TAKE_START_MARGIN, MAX_LINES_SUBS, AUTOSAVE_SRT, EDITOR_MIN_GAP_MS)
- `VideoSrtStandaloneEditorView.tsx:33-34, 74` (MAX_LINES_SUBS, AUTOSAVE_SRT, EDITOR_MIN_GAP_MS)
- `VideoEditorView.tsx:58-59` (TAKE_MARGIN, TAKE_START_MARGIN)
- `ThemeContext.tsx:413-414` (THEME, CUSTOM_THEME_TOKENS) — ja comptat com a ThemeContext

**Per què importa**: la correctesa del spec no es trenca del tot (la recàrrega soluciona tots els contextos i components alhora, independentment de quants en siguin), però:
1. Un futur mantenidor pot llegir el spec i pensar "només cal pensar en aquests 3 contextos" i prendre decisions (p. ex. "provem a fer in-place refresh en lloc de reload") basades en una llista incompleta.
2. La llista donaria més credibilitat a l'argument "la recàrrega és l'opció honesta i alineada amb el principi del CLAUDE.md" si mostrés la magnitud real del problema.
3. Relacionat amb Issue 4 (race condition) — els contextos no mencionats tenen `useEffect` de persistència que poden empitjorar la race.

**Recommended fix:**
Substituir el bullet de la secció 5 per una versió més precisa:
> - Almenys 6 contextes React inicialitzen estat al mount llegint `localStorage`: `ThemeContext`, `AuthContext`, `LibraryDataContext`, `TranscriptionContext`, `TranslationContext`, `UserStylesContext`.
> - A més, 9+ components consumeixen `useLocalStorage(KEY, initial)` que llegeix la key al mount i no es refresca quan `localStorage.removeItem(KEY)` es fa directament (el hook només escolta events `storage` explícits, vegeu [useLocalStorage.ts:33-51](frontend/hooks/useLocalStorage.ts#L33-L51), i `removeItem` no en dispara cap).
> - Aquesta suma fa que un in-place refresh sigui inviable sense modificar 15+ punts i afegir una convenció global de "escoltar reset"-events.

**Spec update needed:** yes

---

## Issue 4 — Race condition: useEffect de persistència pot re-escriure keys durant la finestra de reset
**Iteration:** 2
**Angle:** A5
**Severity:** important
**Type:** bug / design-flaw
**Location:** spec secció 5 (flux d'execució, pas 2 i pas 3)
**Description:**
Hi ha una **race condition real** entre el pas 2 (`localStorage.removeItem`) i el pas 3 (`window.location.reload()`) del flux del spec.

**Mecanisme**:
1. `factoryReset()` executa `localStorage.removeItem(TASKS_TRANSCRIPTION)` — la key desapareix.
2. `factoryReset()` retorna. El cridador crida `window.location.reload()` — això és una operació de navegació **no síncrona**. El navegador encua la descàrrega però segueix executant el JS pendent uns mil·lisegons més (microtasks, fetch responses en vol, setTimeout, polling loops).
3. Durant aquesta finestra, qualsevol dispatch que modifiqui `state.transcriptionTasks` (p. ex. una resposta del polling de jobs del backend — [TranscriptionContext.tsx:103](frontend/context/Library/TranscriptionContext.tsx#L103) — que arribi) provoca que React executi el useEffect de [línies 93-96](frontend/context/Library/TranscriptionContext.tsx#L93-L96):
   ```ts
   useEffect(() => {
     localStorage.setItem(LOCAL_STORAGE_KEYS.TASKS_TRANSCRIPTION, JSON.stringify(state.transcriptionTasks));
   }, [state.transcriptionTasks]);
   ```
   Això **re-escriu** `TASKS_TRANSCRIPTION` amb l'estat en memòria (l'estat "antic" previ al reset).
4. El navegador completa la recàrrega. La nova pàgina munta `TranscriptionProvider`, que llegeix `TASKS_TRANSCRIPTION` del localStorage — i troba les tasks velles re-escrites al pas 3.

**Resultat**: el reset aparent no elimina les tasks de transcripció/traducció. L'usuari torna a veure el mateix estat.

**Contextos afectats** (tots amb `useEffect` d'escriptura reactiva):
- `TranscriptionContext` → `TASKS_TRANSCRIPTION` (useEffect [93-96](frontend/context/Library/TranscriptionContext.tsx#L93-L96))
- `TranslationContext` → `TASKS_TRANSLATION` (useEffect ~60)
- `ThemeContext` → `THEME`, `CUSTOM_THEME_TOKENS` (useEffects [439-444](frontend/context/Theme/ThemeContext.tsx#L439-L444))
- Probablement `LibraryDataContext` → `snlbpro_library_v3`

**Probabilitat**: baixa però no negligible. Depèn de:
- Si hi ha un polling loop actiu (TranscriptionContext en té a partir de línia 103; TranslationContext segurament també).
- Si hi ha respostes de fetch en vol o timers pendents.
- Quant de temps triga el navegador a tirar la pàgina avall (en la pràctica, 50-500ms).

**Components que usen `useLocalStorage` tenen un risc similar**: el hook [useLocalStorage.ts:14-31](frontend/hooks/useLocalStorage.ts#L14-L31) fa `localStorage.setItem` dins de `setValue`, i qualsevol `setValue` que es dispari durant la finestra de reset repoblarà la key corresponent.

**Recommended fix:**
Canviar el flux del spec per fer la recàrrega **abans** de la neteja, no després. Nou flux:

```ts
// Fase 1 (dins del modal, abans del reload):
1. await api.updateMe({ preferences: { shortcuts: null, customThemeTokens: null } })
2. Si fails → sessionStorage.setItem('snlbpro_factory_reset_warn', '1')
3. sessionStorage.setItem('snlbpro_factory_reset_pending', '1')   // marca que cal netejar al init
4. window.location.reload()

// Fase 2 (a l'entrypoint del frontend, p. ex. index.tsx, ABANS del render inicial):
5. if (sessionStorage.getItem('snlbpro_factory_reset_pending')) {
     // Neteja síncrona de localStorage ABANS que cap provider munti
     for (const key of KEYS_TO_REMOVE) {
       try { localStorage.removeItem(key); } catch {}
     }
     sessionStorage.removeItem('snlbpro_factory_reset_pending');
   }
6. ReactDOM.createRoot(...).render(<App />);
```

Això elimina la race perquè la neteja es fa al moment en què cap `useEffect` és actiu (abans que els providers existeixin) i cap polling loop pot haver començat.

**Cost d'implementació**: afegir ~15 línies al punt d'entrada (`index.tsx` o abans del primer render) i moure la funció `clearLocalStorageKeys` de `factoryReset.ts` a un lloc compartit. Canvi contingut, però requereix actualitzar l'arquitectura del spec (la secció 4.1 i 4.2 i 5 canvien).

**Spec update needed:** yes (flux sencer del pas 3 cal re-escriure'l)

---

## Issue 5 — Comentari de `handleSetTcIn` imprecis sobre el mecanisme de throttling
**Iteration:** 3
**Angle:** A1
**Severity:** minor
**Type:** doc-error
**Location:** [VideoSubtitlesEditorView.tsx:840-842](frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx#L840-L842)
**Description:**
El comentari que he afegit al `handleSetTcIn` diu:
```ts
// Lectura directa de l'element <video> per precisió: currentTimeRef es nutreix
// del callback throttlejat de timeupdate (~250 ms) i pot quedar desfasat respecte
// a la posició visual del playhead. Fallback al ref si encara no hi ha vídeo muntat.
```

La part "callback throttlejat de timeupdate" és **imprecisa**. Revisant [VideoSubtitlesEditorView.tsx:89-121](frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx#L89-L121):

```ts
const handleTimeUpdateThrottled = useCallback((t: number) => {
  currentTimeRef.current = t;   // ← es desa a CADA crida, no throttlejat
  // ...
  if (segChanged || now - lastTimeUpdateRef.current > 250) {
    lastTimeUpdateRef.current = now;
    setCurrentTime(t);    // ← NOMÉS el setState està throttlejat a 250ms
  }
}, []);
```

El callback **no** està throttlejat; el que està throttlejat és la crida a `setCurrentTime` dins del callback. El `currentTimeRef.current = t` s'executa a CADA event `timeupdate` del `<video>`, sense cap delay artificial.

**Per què encara funciona el fix**: el navegador dispara l'event nadiu `timeupdate` a una taxa pròpia (4-6 Hz a Chrome, ~150-250 ms entre ticks). Així que el ref està al dia amb aquesta taxa, però encara és ~150-250 ms per darrere de la posició real del playhead visual en el moment d'un keypress arbitrari — que és el que el comentari volia transmetre. El desfase és real, però l'explicació del seu origen és incorrecta.

**Un lector del comentari pot pensar**: "ah, el callback està throttlejat a 250ms, doncs potser baixant el throttle a 50ms resoldré el bug sense haver de llegir del videoRef". Però mirant el codi veuria que no hi ha cap paràmetre de throttle a tocar — el delay ve del navegador, no del nostre codi.

**Recommended fix:**
Substituir el comentari per un més precís:
```ts
// Lectura directa de l'element <video> per precisió. El ref currentTimeRef es
// refresca amb cada event nadiu `timeupdate` del <video>, que els navegadors
// disparen a ~4-6 Hz (~150-250 ms entre ticks). Això fa que el ref pugui
// quedar fins a ~250 ms per darrere del playhead real quan es llegeix en
// resposta a un keypress. Llegint directament de l'element HTML5 obtenim
// el valor al microsegon. Fallback al ref si encara no hi ha vídeo muntat.
```

O, més curt:
```ts
// Lectura directa del <video> per evitar el lag de ~150-250 ms del ref,
// que només s'actualitza amb events nadius `timeupdate` del navegador.
// Fallback al ref si encara no hi ha vídeo muntat.
```

**Spec update needed:** no (és un comentari al codi, no al spec)

---

## Notes d'iteració 3 — A1 clean (excepte comentari menor)

Verificacions realitzades a la Fase A:

- **Data flow de `videoRef.current.currentTime`**: correcte. `videoRef` és un `useRef<HTMLVideoElement>(null)` a [línia 128](frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx#L128) i s'assigna al `<video>` real a través del prop que es passa al `<WaveformTimeline>` a [línia 1091](frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx#L1091).
- **`useCallback` deps**: correctes. Els refs (`videoRef`, `currentTimeRef`) no necessiten estar als deps. Els valors llegits (`isEditing`, `activeSegmentId`, `segments`, `generalConfig.minGapMs`, `subsHistory`) hi són tots. `MIN_SEG_DURATION` és una constant de mòdul (línia 53), no cal deps.
- **Edge case: videoRef.current existeix però video no carregat**: en teoria `currentTime` pot ser 0 durant ~ms inicials. En pràctica, l'early return `if (!isEditing || !activeSegmentId)` ho evita perquè no hi ha segment actiu abans que el vídeo estigui carregat.
- **Edge case: NaN/Infinity de currentTime**: modern browsers always return a number. No real concern.
- **Sincronia del keypress**: tota la ruta des del keydown fins a `handleSetTcIn` és síncrona (`useKeyboardShortcuts` → `onAction` → switch → handler). El read del `videoRef.current.currentTime` passa en microsegons després del keypress. Correcte.
- **Side effects en altres handlers**: els altres usos de `currentTimeRef.current` al fitxer (línies 608, 677, 711) són contextos no-precision-critical (snapshot a finestra externa, jump relatiu, find-nearest segment). Cap regressió.
- **Regressió lògica als clamps de TC IN/OUT**: els clamps `prevSeg.endTime + gap` i `seg.endTime - MIN_SEG_DURATION` segueixen aplicant-se. Amb `t` més precís, el clamp s'aplica només si el valor REAL és fora de rang, cosa que és el comportament correcte.
- **`tsc --noEmit` amb aquests canvis**: ja verificat durant la Fase A — cap error introduït.

Conclusió: la Fase A és **funcionalment correcta i segura**. L'única observació és el comentari imprecís (Issue 5, severity minor) que no afecta el comportament del codi.

---

## Notes d'iteració 4 — A6 clean (cap issue)

Verificacions backend:

- **Únic punt d'escriptura de `preferences`**: `UsersService.update()` a [users.service.ts:59-80](backend_nest_mvp/src/modules/users/users.service.ts#L59-L80), invocat només des de `AuthController.updateMe()` a [auth.controller.ts:47-56](backend_nest_mvp/src/modules/auth/auth.controller.ts#L47-L56). No hi ha cap altre servei, controller, repository ni model que escrigui a `preferences`.
- **Cerca de `userModel.updateOne/updateMany/findOneAndUpdate/findByIdAndUpdate/save`**: un sol match a [users.service.ts:76](backend_nest_mvp/src/modules/users/users.service.ts#L76) (el del mateix `update()`). No hi ha escriptures alternatives.
- **Schema Mongoose**: [user.schema.ts:19-20](backend_nest_mvp/src/modules/users/schemas/user.schema.ts#L19-L20) té `@Prop({ type: Object, default: {} }) preferences?: any` — és un camp lliure sense sub-schema. **No hi ha defaults per sub-camps** com `shortcuts`, `themeId`, `customThemeTokens`, `userStyles`. Això vol dir que quan fem `$set: { 'preferences.shortcuts': null }`, el valor es desa com a `null` i hi queda.
- **Mongoose hooks/middleware**: cap hook `pre('save')`, `pre('findOneAndUpdate')`, etc. al schema. No hi ha middleware que interfereixi amb el reset.
- **Cron jobs / scheduled tasks**: cercant `@Cron`, `@Scheduled`, `CronJob`, `setInterval`, `setTimeout` a `backend_nest_mvp/src/` → l'únic match és a [media.controller.ts:64, 72, 76](backend_nest_mvp/src/modules/media/media.controller.ts#L64) que gestiona neteja de media files; no toca `preferences`.
- **Scripts de dev**: només hi ha `backend_nest_mvp/scripts/create-admin.js`, que crea un admin nou amb `preferences: {}` per defecte. Només s'executa manualment i només afecta usuaris nous, no els existents.
- **Migrations**: no hi ha cap fitxer de migració al backend que toqui `preferences`.

**Conclusió A6**: el backend té exactament **un** write path per a `preferences`, i és el que el spec preveu. No hi ha cap mecanisme automàtic de re-populació que pugui desfer el reset des del servidor. El comportament "posar `null` → el frontend veu `null` → fallback als defaults" és estable i persistent. Cap issue.

---

## Issue 6 — Multi-pestanya: el spec no contempla altres pestanyes obertes i el reset pot ser desfet indefinidament
**Iteration:** 5
**Angle:** A7
**Severity:** important
**Type:** missed-edge-case / design-flaw
**Location:** spec (tot el document, especialment secció 5 i 9)
**Description:**
El spec **no menciona en cap lloc** què passa si l'usuari té **dues o més pestanyes** de l'aplicació obertes simultàniament quan fa el Reset. Aquest escenari és realista (un usuari pot tenir la Library en una pestanya i un editor en una altra) i té conseqüències greus.

### Escenari
1. Usuari obre tab **A** (Library) i tab **B** (editor de subtítols amb transcripcions actives) de la mateixa aplicació, mateix compte.
2. A tab **A**: obre Settings → General → Reset, confirma.
3. Tab **A** executa `factoryReset()`:
   - `api.updateMe({ preferences: { shortcuts: null, customThemeTokens: null } })` → backend té `shortcuts = null`. ✓
   - `localStorage.removeItem(...)` per a totes les keys del spec. ✓
   - `window.location.reload()`. Tab A es recarrega i veu defaults.

### Problema 1 — Tab B no sap res del Reset i té estat stale

Tab B segueix funcionant. El seu estat en memòria (React state dels contextos i components) **no ha canviat**. Té:
- `TranscriptionContext.state.transcriptionTasks` = (llista vella, pre-reset)
- `TranslationContext.state.translationTasks` = (llista vella, pre-reset) — confirmat a [TranslationContext.tsx:53-62](frontend/context/Library/TranslationContext.tsx#L53-L62), mateix patró que TranscriptionContext.
- `ThemeContext` estat intern amb paleta custom (pre-reset)
- Etc.

Cap d'aquests contextos escolta `storage` events (verificat al read de `TranslationContext.tsx` i al grep — només `useLocalStorage.ts:46` i `UserStylesContext.tsx:153` tenen listeners). Per tant, tab B continua amb l'estat vell **indefinidament** fins que l'usuari el tanqui o el recarregui manualment.

### Problema 2 — Tab B **desfà activament** el Reset a localStorage

Pitjor encara: els contextos TranscriptionContext i TranslationContext tenen useEffect que persisteix a localStorage **cada vegada que el seu state canvia** ([TranscriptionContext.tsx:93-96](frontend/context/Library/TranscriptionContext.tsx#L93-L96), [TranslationContext.tsx:59-62](frontend/context/Library/TranslationContext.tsx#L59-L62)). I tots dos tenen polling loops actius que disparen dispatches cada pocs segons quan hi ha tasks actives.

**Seqüència que desfà el reset a tab B (i per tant a localStorage)**:
1. t=0: tab A acaba el reset. localStorage queda net. Tab A es recarrega.
2. t=100ms: tab B té un polling actiu → rep resposta del backend → dispatches `UPDATE_TRANSCRIPTION_TASK` → reducer canvia `state.transcriptionTasks` → useEffect fires → `localStorage.setItem('snlbpro_tasks_transcription', ...)` amb l'estat **vell** en memòria + la modificació nova.
3. t=101ms: localStorage té una key nova on n'hi havia cap. Tab A ha estat re-carregada ja, però ara la seva pròxima acció que llegeixi aquesta key veurà dades stale.

El resultat: **tab B repobla silenciosament les keys que tab A havia netejat**, fins i tot després que tab A hagi completat el reset visual.

### Problema 3 — Tab B pot desfer el Reset del **backend**

`SettingsModal.tsx:152-156` té `persistToBackend` que fa:
```ts
api.updateMe({ preferences: { shortcuts: updated } }).catch(() => {});
```

Si l'usuari a tab B intenta editar qualsevol shortcut (o entrar a Settings→Dreceres, on el seu state local és encara l'antic), la propera acció que dispari `persistToBackend` enviarà la versió VELLA de shortcuts al backend, **sobreescrivint** el `null` que tab A hi havia posat. El reset del backend queda desfet.

Igualment pot passar amb `ThemeContext` — si l'usuari a tab B canvia el tema, s'envia `customThemeTokens` amb els tokens vells, sobreescrivint el `null` del backend.

### Per què tot això no es compensa per les proteccions existents

- **`useLocalStorage` hook SÍ escolta `storage` events** ([useLocalStorage.ts:33-51](frontend/hooks/useLocalStorage.ts#L33-L51)) → **això és una protecció parcial**: els components que usen el hook (p. ex. SettingsModal per a shortcuts, SegmentItem per a gridOpacity, etc.) sí es refrescaran automàticament quan tab A netegi localStorage. **Això és un guany accidental**, no dissenyat.
- Però els contextos que usen `loadLocal(...)` manual (TranscriptionContext, TranslationContext, LibraryDataContext) **no tenen aquesta protecció** i mantenen estat stale.
- **`ThemeContext` usa `useLocalStorage`** ([ThemeContext.tsx:413-414](frontend/context/Theme/ThemeContext.tsx#L413-L414)) → parcialment protegit, però té lògica addicional via `USER_PROFILE_LOADED` event que no s'activa per un `storage` event. Comportament mixt incert.

### Recommended fix

Tres opcions, de menor a major robustesa:

**Opció A (mínima, 1 línia de spec)**: afegir un avís a la modal de confirmació:
> ⚠ Abans de continuar, tanca qualsevol altra pestanya de Sonilab oberta en aquest navegador. Si no ho fas, el reset pot ser desfet parcialment per les altres pestanyes.

Això trasllada la responsabilitat a l'usuari. Simple però fràgil (els usuaris no llegeixen).

**Opció B (recomanada, ~15 línies de codi)**: usar un **`BroadcastChannel`** anomenat `snlbpro-factory-reset`. El codebase ja usa `BroadcastChannel` per a altres sincronitzacions entre pestanyes (vegeu [VideoSubtitlesEditorView.tsx:586, 597](frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx#L586), [ScriptExternalView.tsx:52, 213](frontend/components/ScriptExternalView.tsx#L52)), així que és un patró ja acceptat.

```ts
// A factoryReset.ts (abans del reload):
try {
  const bc = new BroadcastChannel('snlbpro-factory-reset');
  bc.postMessage({ type: 'reset' });
  bc.close();
} catch {}

// A App.tsx (o AuthContext), un useEffect al top:
useEffect(() => {
  try {
    const bc = new BroadcastChannel('snlbpro-factory-reset');
    bc.onmessage = (ev) => {
      if (ev.data?.type === 'reset') {
        // Una altra pestanya ha fet un Reset. Recarreguem-nos per agafar l'estat net.
        window.location.reload();
      }
    };
    return () => bc.close();
  } catch {}
}, []);
```

Amb això, quan tab A fa Reset, tab B rep el missatge i es recarrega ella mateixa, agafant els defaults nets. Elimina ambdós problemes (estat stale a memòria i re-escriptura a localStorage/backend).

**Opció C (més robusta)**: combinar B amb un flag `snlbpro_factory_reset_in_progress` a `sessionStorage` (o `localStorage` amb timestamp) que marqui el reset durant ~5 segons. Tab B, en rebre el BroadcastChannel message, aturaria tot polling/persistència abans de recarregar-se. Evita fins i tot la race del segon que triga el reload.

**Nota sobre la interacció amb Issue 4**: l'Opció B de l'Issue 6 (BroadcastChannel) i l'Opció B de l'Issue 4 (moure la neteja al pre-init del reload) són **complementàries**: la primera resol el multi-tab, la segona resol l'intra-tab. S'haurien d'aplicar totes dues.

**Spec update needed:** yes — afegir una nova secció "Multi-pestanya" al spec que contempli els tres escenaris i apliqui l'opció B.

---

## Issue 7 — Reset pot destruir silenciosament canvis sense desar dels documents
**Iteration:** 6
**Angle:** A8
**Severity:** important
**Type:** missed-edge-case / design-flaw
**Location:** spec secció 7 (Edge cases) i secció 6.2 (Modal)
**Description:**
El frontend mostra un indicador visible "**Canvis sense desar**" a [App.tsx:621-625](frontend/App.tsx#L621-L625) quan `history.isDirty === true`:
```tsx
{history.isDirty && (
  <div className="fixed bottom-4 right-4 ...">Canvis sense desar</div>
)}
```

Aquest indicador s'activa quan l'usuari ha editat un document (subtítols, guió, etc.) però encara no ha desat. **No hi ha** cap handler `beforeunload` que bloqui la sortida de la pàgina quan hi ha canvis sense desar (verificat per grep: els dos handlers `beforeunload` a App.tsx [linies 242-246](frontend/App.tsx#L242-L246) i [760-764](frontend/App.tsx#L760-L764) **només** alliberen locks via `releaseLockBeacon`, no consulten `isDirty` ni retornen cap valor per aturar la navegació).

**Conseqüència**: si l'usuari té canvis sense desar i executa el Reset:
1. Reset crida `window.location.reload()`.
2. El `beforeunload` dispara sense confirmació, alliberant el lock.
3. La pàgina es recarrega.
4. Els canvis en memòria del document **es perden silenciosament**. No hi ha banner, no hi ha toast, no hi ha diàleg de confirmació.

**Per què és greu**: l'usuari ha pulsat un botó etiquetat "Restablir **configuració**" que la intuïció diu que afecta "settings", no el seu document en edició. Perdre feina de document és un cost inesperat i no advertit.

**Nota subtil**: si el document està vinculat a backend (és a dir, `history.isDirty` ve de canvis locals que encara no s'han enviat), la feina es perd. Si el sistema té autosave a localStorage (p. ex. via `snlbpro_versions_<docId>`), pot haver-hi una còpia parcial. Però això depèn de si l'autosave s'ha executat recentment o no — no és fiable com a xarxa de seguretat.

**Recommended fix:**
Dues opcions complementàries:

**Opció A (bàsica)**: a `SettingsModal.tsx`, en el handler de "Restablir", abans de fer res més, comprovar si hi ha `history.isDirty` global. Si n'hi ha, mostrar un missatge addicional al modal (o un segon modal encadenat):
> ⚠ Tens canvis sense desar en un document. Si continues amb el reset, **es perdran**. Vols desar primer?
> [Desar i continuar] [Continuar sense desar] [Cancel·lar]

Això requereix exposar el `history.isDirty` global al `SettingsModal` o tenir un mecanisme per consultar-lo. Pot ser via Context o via un ref global.

**Opció B (millora complementària del sistema general)**: afegir un `beforeunload` handler global que comprovi `history.isDirty` i retorni `returnValue` per bloquejar la navegació amb el diàleg nadiu del navegador. Això protegiria l'usuari **en tots els casos** (tancar pestanya, Reset, navegació accidental), no només el Reset. Aquesta és una millora de sistema, més enllà del scope del feature actual, però el spec hauria de deixar constància que el Reset s'aprofita d'aquesta absència d'un `beforeunload` protector i que és un risc.

Mínim per al Reset: afegir almenys un paràgraf a la secció 7 (Edge cases) reconeixent el risc i triant explícitament quina opció s'adopta.

**Spec update needed:** yes

---

## Issue 8 — Contradicció al spec sobre l'estat del botó "Cancel·lar" durant el flux in-flight
**Iteration:** 6
**Angle:** A8
**Severity:** important
**Type:** inconsistency / spec contradiction
**Location:** spec secció 6.2 "Comportament"
**Description:**
El spec descriu el comportament del modal dient dues coses que es contradiuen:

Primer, sobre el botó Cancel·lar:
> **Cancel·lar**: sempre habilitat, tanca el modal. També es tanca amb Escape i amb click al backdrop.

Després, sobre el click a "Restablir configuració":
> Click → mostra spinner + text "Restablint…", **ambdós botons disabled**, executa `factoryReset(me?.id ?? null)`, gestiona el flag d'avís si cal, fa `window.location.reload()`.

**Contradicció**: "Cancel·lar sempre habilitat" vs "ambdós botons disabled" durant l'in-flight. Els dos no poden ser veritat alhora.

**Per què és greu**: aquesta ambigüitat porta a dos comportaments possibles, cadascun amb un bug diferent:

**Interpretació A**: Cancel·lar es queda habilitat durant l'in-flight.
- Usuari clica "Restablir" → spinner → a mig vol (després que `api.updateMe` hagi processat al backend però abans que `reload()` s'executi), l'usuari clica Cancel·lar o fa Escape.
- El modal es tanca. El reload **no** es fa.
- Estat resultant: **backend reset, localStorage encara net (perquè no s'ha arribat al pas 2) o parcialment netejat**, UI sense recarregar mostra estat híbrid.
- Pitjor: si factoryReset havia començat la neteja de localStorage quan l'usuari va cancel·lar, queda a mig. Algunes keys netejades, d'altres no. Reset corrupte.

**Interpretació B**: ambdós botons disabled durant l'in-flight. Cancel·lar també està disabled.
- L'Escape key i el backdrop click haurien d'estar-ho també, si no, l'usuari pot sortir igualment saltant-se el botó.
- Això és més segur però el spec no ho menciona. Un implementador seguint al peu de la lletra la frase "sempre habilitat" podria implementar Interpretació A.

**També no aclarit**: durant l'in-flight, què passa si l'usuari prem Escape o clica al backdrop? El spec només parla del **botó** Cancel·lar, no dels altres dos mecanismes de tancament.

**Recommended fix:**
Aclarir el spec amb una secció explícita:

```
Durant l'in-flight (entre click a "Restablir" i el reload):
- Botó "Cancel·lar": disabled
- Botó "Restablir configuració": disabled, mostra spinner
- Tecla Escape: desactivada (listener global ignora Escape)
- Click al backdrop: desactivat (backdrop no respon a clicks)

Raó: una cancel·lació parcial deixa l'aplicació en un estat inconsistent (backend
reset però local no, o localStorage parcialment netejat). No és recuperable sense
recàrrega manual. És millor forçar l'usuari a esperar els ~1-2 segons del flux.
```

I reformular la descripció del botó Cancel·lar així:
```
- Cancel·lar: habilitat **abans** del click a "Restablir". També es tanca amb Escape 
  i backdrop click en aquest estat. Un cop l'usuari ha clicat "Restablir", tots els
  mecanismes de tancament es bloquegen fins que el reload es dispari.
```

**Spec update needed:** yes

---

## Issue 9 — `sessionStorage.setItem` sense try/catch pot llençar en mode privat / storage full
**Iteration:** 6
**Angle:** A8
**Severity:** minor
**Type:** missed-edge-case
**Location:** spec secció 5 pas 3 i pas 4
**Description:**
El spec té dos punts on escriu a `sessionStorage` sense try/catch:

1. **Pas 3** ([spec:134-138](docs/superpowers/specs/2026-04-07-reset-configuracio-frontend.md)):
   ```ts
   if (!result.backendOk) {
     sessionStorage.setItem('snlbpro_factory_reset_warn', '1');
   }
   window.location.reload();
   ```

2. **Pas 4** (within the useEffect):
   ```ts
   sessionStorage.removeItem('snlbpro_factory_reset_warn');
   ```

**Per què és un risc**: `sessionStorage.setItem` pot llençar `QuotaExceededError` en:
- Safari en mode private/incognito (mode tradicional, no el recent)
- Alguns navegadors embedded (Electron apps, WebViews)
- Quotas extremadament baixes
- Permisos de storage denegats

Si l'excepció es llança durant el pas 3 (dins del handler del modal, no capturat), el codi es trenca abans d'arribar al `reload()`. El modal queda en l'estat in-flight per sempre, ningú notifica cap error, i el reset queda a mig.

Si es llança durant el pas 4 (dins del useEffect post-reload), React captura l'error en un error boundary si n'hi ha, o més probablement es logueja a la consola i l'app continua normalment — el toast no apareix però el reset ja s'ha fet.

**Recommended fix:**
Embolicar totes les crides a `sessionStorage` en try/catch al spec:

```ts
// Pas 3:
if (!result.backendOk) {
  try { sessionStorage.setItem('snlbpro_factory_reset_warn', '1'); } catch {}
}
window.location.reload();

// Pas 4:
try {
  const flag = sessionStorage.getItem('snlbpro_factory_reset_warn');
  if (flag) {
    sessionStorage.removeItem('snlbpro_factory_reset_warn');
    setFactoryResetWarn(true);
  }
} catch { /* sessionStorage disabled, silently skip */ }
```

**Spec update needed:** yes (menor — afegir try/catch als pseudocódis del pas 3 i pas 4)

---

## Issue 10 — Fals negatiu: backend processa la petició però el client creu que ha fallat
**Iteration:** 6
**Angle:** A8
**Severity:** minor
**Type:** missed-edge-case
**Location:** spec secció 5 pas 1 i pas 4 (toast)
**Description:**
Escenari:
1. L'usuari fa click a "Restablir".
2. `factoryReset()` executa `await api.updateMe({ preferences: { shortcuts: null, ... } })`.
3. El servidor rep la petició, la processa, escriu a Mongo → `preferences.shortcuts = null` al backend ✓.
4. El servidor respon 200 OK.
5. Abans que el client rebi la resposta, es perd la connexió (timeout, xarxa interrompuda, request abortada per navegació, ...).
6. El client entra al `catch` → `backendOk = false`.
7. Flux continua: flag a sessionStorage, reload, toast groc post-reload que diu "no s'ha pogut sincronitzar amb el servidor".
8. L'usuari veu el toast i pensa "alguna cosa ha anat malament, potser el Reset no s'ha fet complet". **Però en realitat sí s'ha fet complet**, a tot arreu.

**Probabilitat**: baixa però no nul·la. Depèn de la latència de la xarxa i del moment del reload (`window.location.reload()` aborta totes les peticions pendents, la qual cosa augmenta la probabilitat que una resposta ja en vol es perdi).

**Impacte**: confusió de l'usuari. Pot intentar refer el Reset pensant que no s'ha fet, cosa que és innòcua (re-enviar `null` al backend és idempotent), però és soroll.

**Recommended fix:**
Dues opcions:

**Opció A (simple, no recomanada)**: no fer res. El fals negatiu és un toast innòcu que diu "si tornes a provar-ho més tard, ho pots verificar". Acceptar la imprecissió.

**Opció B (recomanada)**: al useEffect post-reload ([spec:146-157](docs/superpowers/specs/2026-04-07-reset-configuracio-frontend.md)), **verificar** si la preferència del backend realment està a `null` abans de mostrar el toast. Si `profile.preferences?.shortcuts === null` (o undefined, o objecte buit), el reset es va fer correctament i el toast és un fals positiu — no mostrar-lo.

```ts
useEffect(() => {
  try {
    const flag = sessionStorage.getItem('snlbpro_factory_reset_warn');
    if (flag) {
      sessionStorage.removeItem('snlbpro_factory_reset_warn');
      // Verifica si el backend realment té el shortcut netejat.
      // Si sí, el "fallback" de la xarxa era un fals negatiu i no cal avís.
      api.me().then(profile => {
        const backendActuallyReset = !profile?.preferences?.shortcuts;
        if (!backendActuallyReset) {
          setFactoryResetWarn(true);
        }
      }).catch(() => setFactoryResetWarn(true));  // si ni /me funciona, avisar igualment
    }
  } catch {}
}, []);
```

Aquesta verificació afegeix una crida `api.me()` extra (cost mínim) però elimina el fals negatiu. Recomanada.

**Spec update needed:** yes (menor — millorar el pseudocode del pas 4)

---

## Issue 11 — Diverses referències de línia del spec estan desfasades
**Iteration:** 7
**Angle:** A3
**Severity:** minor
**Type:** doc-error
**Location:** spec secció 11 "Referències al codi" i secció 6.1
**Description:**
He verificat totes les referències a codi del spec contra el codi actual. La majoria són correctes però n'hi ha tres off-by-some i una semànticament confusa:

### 1. `[AuthContext.tsx:30-48](...)` — secció 11
Spec diu: "línies 30-48" cobreixen `refreshMe()`.  
Realitat: `refreshMe` està declarat a la **línia 25** (`const refreshMe = useCallback(async () => {`) i tanca a la **línia 48** (`}, []);`).  
La línia 30 és `try {`, a mig cos de la funció. Un lector que faci click al link aterra al mig del bloc, no a la declaració.  
**Fix**: canviar a `[AuthContext.tsx:25-48]`.

### 2. `[users.service.ts:59-79](...)` — secció 11
Spec diu: "línies 59-79" cobreixen el mètode `update()`.  
Realitat: `update()` està a les línies **59-80**. La línia 79 és `const { passwordHash, ...safe } = updated as any;` (penúltim statement del cos). La línia 80 és el `return`.  
**Fix**: canviar a `[users.service.ts:59-80]`.

### 3. `[SettingsModal.tsx:133-322](...)` — secció 11
Spec diu: "línies 133-322" cobreixen el component `ShortcutsTab` inline.  
Realitat: `ShortcutsTab` tanca a la **línia 320** (`};`). La línia 321 és `const USE_BACKEND = ...` (fora del component). La línia 322 és la declaració de `SettingsModal` (un component diferent).  
**Fix**: canviar a `[SettingsModal.tsx:133-320]`.

### 4. `[SettingsModal.tsx:736]` — secció 6.1 (referència semànticament confusa)
Spec diu: "Posició: **al final** del bloc `activeTab === 'general'`, **després de la tarjeta 'Sincronització de Vídeo'** ([SettingsModal.tsx:736](frontend/components/SettingsModal.tsx#L736))".

Realitat inspecció (linies 725-741):
- **Línia 735**: `</div>` — tancament real de la tarjeta "Sincronització de Vídeo".
- **Línia 736**: `</div>` — tancament del **wrapper** `<div className="space-y-6">` del tab General (**no** de la tarjeta).
- **Línia 737**: `) : (` — la branca `else` del ternari (apartats no-general).

La citació `SettingsModal.tsx:736` no és el final de la tarjeta "Sincronització de Vídeo" (que és la línia 735); és el final del wrapper que conté totes les tarjetes del tab. L'implementador ha d'inserir la nova tarjeta **entre les línies 735 i 736**.

**Fix**: reformular la frase per claredat:
> Posició: al final del bloc `activeTab === 'general'`, entre la tarjeta "Sincronització de Vídeo" (que tanca a [SettingsModal.tsx:735](frontend/components/SettingsModal.tsx#L735)) i el `</div>` del wrapper a [SettingsModal.tsx:736](frontend/components/SettingsModal.tsx#L736).

### Verificades correctes (sense canvis necessaris)

- `[constants.ts:3-32]` → ✓ `LOCAL_STORAGE_KEYS` comença a L3 (`export const LOCAL_STORAGE_KEYS = {`) i tanca a L32 (`};`).
- `[SettingsModal.tsx:610-736]` → ✓ bloc `activeTab === 'general'` de L610 a L736 (el wrapper close).
- `[SettingsModal.tsx:190-195]` → ✓ `resetAll` callback exactament a L190-195.
- `[useKeyboardShortcuts.ts:9-18]` → ✓ cache module-level + `getCachedShortcuts()` a L9-18.
- `[ThemeContext.tsx:476-510]` → ✓ (verificat en iteracions anteriors durant brainstorming).

### Per què importa

Aquests off-by-few són menors i no afecten el comportament del feature. Però:
1. L'atracció estètica del spec amb totes les refs precises queda tocada.
2. Un implementador que salti als links per entendre el context pot perdre temps buscant el punt real.
3. És un símptoma que el spec es va escriure ràpidament sense verificar línies — el mateix tipus de descuit que va deixar passar les gaps importants (Issues 1, 3, 6, 7).

**Recommended fix:**
Actualitzar les tres línies específiques a la secció 11 i la secció 6.1 del spec tal com s'indica a sobre. Són canvis textuals mínims, ~5 línies totals.

**Spec update needed:** yes (menor però poli el spec)

---

## Issue 12 — Drift terminològic: "toast" vs "banner" al spec
**Iteration:** 8
**Angle:** A9
**Severity:** minor
**Type:** inconsistency
**Location:** spec secció 5 (pas 4), secció 7, secció 9.2
**Description:**
El spec té un drift terminològic entre diferents seccions sobre com s'anomena l'avís visual post-reload:

- **Secció 5 pas 4**: diu explícitament "**banner inline** a App.tsx". Tot el codi pseudocode usa `factoryResetWarn`, no "toast". El paràgraf d'obertura diu "Per coherència amb aquests patrons, l'avís post-reset es fa amb un **banner inline** propi, NO amb un toast global". Molt clar.

- **Secció 7 "Edge cases"**, fila "Backend caigut":
  > Reset local s'executa igual; flag a sessionStorage; **toast d'avís** post-reload.
  
  Usa la paraula "toast".

- **Secció 9.2 cas 4 "Backend caigut"**:
  > aturar el backend, executar el flux complet → reset local s'executa, recàrrega, apareix **toast groc d'avís**. Refresc posterior: el **toast** NO torna a aparèixer.
  
  Torna a usar "toast" (dues vegades).

**Per què és un risc**: un implementador pot pensar que "toast" implica un component de toast reutilitzable/global, i intentar construir-ne un. La secció 5 pas 4 precisament diu que s'ha d'evitar. La terminologia hauria de ser coherent en tot el spec.

**Recommended fix**: canviar les referències de "toast" a "banner" a les seccions 7 i 9.2:
- Secció 7, fila "Backend caigut" → "...flag a sessionStorage; **banner** d'avís post-reload."
- Secció 9.2 cas 4 → "...apareix **banner** groc d'avís. Refresc posterior: el **banner** NO torna a aparèixer."

**Spec update needed:** yes (4 canvis textuals triviales)

---

## Issue 13 — Nom `KEYS_TO_REMOVE` referenciat a la secció 10 però no definit a la secció 3.2
**Iteration:** 8
**Angle:** A9
**Severity:** minor
**Type:** inconsistency / undefined-reference
**Location:** spec secció 3.2 i secció 10
**Description:**
La secció 3.2 del spec enumera les keys a esborrar dins d'un bloc de codi TypeScript, però **no assigna un nom** a aquesta llista. Les keys hi són com a literals solts:

```ts
// Totes les keys de LOCAL_STORAGE_KEYS excepte THEME:
LOCAL_STORAGE_KEYS.SHORTCUTS,
LOCAL_STORAGE_KEYS.EDITOR_STYLES,
// ...etc
```

Sense cap declaració del tipus `const KEYS_TO_REMOVE = [...]`.

Però després, la secció 10 diu:
> afegir-la a la llista `KEYS_TO_REMOVE` de `frontend/utils/factoryReset.ts`.

El nom `KEYS_TO_REMOVE` només apareix aquí. No s'introdueix enlloc més al spec. Un lector que segueixi el spec de dalt a baix veurà una llista anònima a la 3.2 i, més tard, una referència a un nom mai definit.

També apareix `KEYS_TO_REMOVE` a les recommended fixes dels Issues 4 i 6 d'aquest mateix informe, però això no compta com a definició al spec original.

**Per què és un risc**: un implementador lector del spec pot:
1. Pensar que `KEYS_TO_REMOVE` és una constant preexistent i buscar-la al codebase (no la trobarà).
2. Inventar-se un nom diferent (p. ex. `FACTORY_RESET_KEYS`, `LOCAL_KEYS_TO_WIPE`, `BLOCKLIST`) i perdre la coherència amb futurs issues que referenciin `KEYS_TO_REMOVE`.

**Recommended fix:**
Canviar el pseudocode de la secció 3.2 per introduir explícitament el nom:

```ts
// Dins de frontend/utils/factoryReset.ts:
const KEYS_TO_REMOVE: string[] = [
  // Totes les keys de LOCAL_STORAGE_KEYS excepte THEME:
  LOCAL_STORAGE_KEYS.SHORTCUTS,
  LOCAL_STORAGE_KEYS.EDITOR_STYLES,
  // ...etc
  'snlbpro_library_v3',
];

// La variant scopada es construeix dins de factoryReset() quan hi ha userId:
// KEYS_TO_REMOVE.push(`${LOCAL_STORAGE_KEYS.CUSTOM_THEME_TOKENS}_${userId}`);
```

Això dona nom a la llista i deixa clar que viu dins de `factoryReset.ts`, fent coherent la referència de la secció 10.

**Spec update needed:** yes (canvi cosmètic petit)

---

## Estat final

**Convergència assolida** després de 8 iteracions. Les últimes 2 iteracions (7 i 8) només han trobat issues `minor`, i ja s'han cobert 8 de 10 angles. Els 2 angles no coberts:
- **A2** (code-review formal de Fase A): redundant amb A1 que ja va fer una revisió sistemàtica del mateix codi. No es preveu que reveli res nou.
- **A10** (migració inversa): conceptual, no afecta la correctesa del feature.

### Distribució per severitat

| Severitat | Count | Issues |
|---|---|---|
| critical | 0 | — |
| important | 5 | 1, 3, 4, 6, 7, 8 (= 6? recomptem) |
| minor | 8 | 2, 5, 9, 10, 11, 12, 13 |

**Recompte verificat**: 13 issues totals. Important = Issues 1, 3, 4, 6, 7, 8 → **6 important**. Minor = Issues 2, 5, 9, 10, 11, 12, 13 → **7 minor**.

### Angles coberts

- **A1** — systematic-debugging sobre Fase A → 1 minor (Issue 5)
- **A3** — verificació de refs del spec → 1 minor consolidat (Issue 11)
- **A4** — inventari de keys localStorage → 2 issues (Issue 1 important, Issue 2 minor)
- **A5** — inventari de contextos React → 2 important (Issues 3, 4)
- **A6** — backend write paths → clean (cap issue)
- **A7** — multi-pestanya → 1 important (Issue 6)
- **A8** — edge cases del modal → 4 issues (Issues 7, 8 important; Issues 9, 10 minor)
- **A9** — coherència interna del spec → 2 minor (Issues 12, 13)

### Issues que requereixen actualitzar el spec

**Totes 13**, excepte Issue 5 que és només un comentari al codi (no al spec). Resum del treball pendent per aplicar sobre el spec:

**Important (6)**:
1. **Issue 1** — Afegir `sonilab_guion_<docId>` a la llista de preservats; documentar el prefix `sonilab_` paral·lel.
2. **Issue 3** — Ampliar la llista de contextos/components que inicialitzen de localStorage (6 contextes + 9 components).
3. **Issue 4** — Refactor crític del flux: moure la neteja de localStorage al pre-init post-reload (via flag a sessionStorage), no abans del reload. Això requereix canvis a les seccions 4.1, 4.2 i 5 del spec, i probablement afegir un fitxer nou `frontend/index.tsx` a la llista de modificats (o el seu equivalent).
4. **Issue 6** — Afegir suport multi-pestanya via `BroadcastChannel` per forçar recàrrega a les pestanyes germanes.
5. **Issue 7** — Protegir contra pèrdua de canvis sense desar: comprovar `history.isDirty` abans d'iniciar el reset i mostrar avís addicional al modal.
6. **Issue 8** — Resoldre la contradicció sobre l'estat del botó Cancel·lar durant l'in-flight: especificar que Cancel·lar, Escape i backdrop queden desactivats durant el flux.

**Minor (7)**:
- **Issue 2** — Afegir `sonilab_token` explícitament a la llista de preservats i nota sobre prefix scan.
- **Issue 5** — (només codi) Reformular el comentari de `handleSetTcIn`.
- **Issue 9** — Embolicar les crides `sessionStorage.setItem/getItem/removeItem` en try/catch al pseudocode.
- **Issue 10** — Verificar via `api.me()` post-reload si el backend realment té la preferència nullada abans de mostrar el banner (evita falsos negatius).
- **Issue 11** — Corregir 3 refs de línia desfasades al spec i 1 ref semànticament confusa.
- **Issue 12** — Substituir "toast" per "banner" a les seccions 7 i 9.2 (coherència amb la secció 5 pas 4).
- **Issue 13** — Donar nom explícit a la llista `KEYS_TO_REMOVE` al pseudocode de la secció 3.2.

### Issues que NO requereixen canvis al codi ja commitejat de Fase A

Només **Issue 5** afecta la Fase A i és un comentari al codi, no un bug funcional. Tots els altres issues són sobre el spec del Reset (Fase B), que encara no s'ha implementat.

### Conclusió

El spec és **recuperable amb actualitzacions no catastròfiques** però requereix canvis significatius en particular per Issues 3, 4, 6 i 7 — abans d'iniciar la implementació. La revisió ha revelat concerns reals que haurien portat a bugs en la implementació si el spec s'hagués executat tal com estava:
- Issue 4 hauria causat resets parcials intra-tab (baixa probabilitat, però real).
- Issue 6 hauria causat resets efectivament desfets en escenaris multi-tab (alta probabilitat en usuaris normals).
- Issue 7 hauria destruït silenciosament feina de document (probabilitat moderada, alta gravetat).
- Issue 8 hauria causat un bug d'implementació un cop l'implementador tingués dues interpretacions possibles del spec.

La resta de issues (1, 2, 3, 9-13) són polish i correccions documentals que milloren la qualitat del spec sense ser catastròfiques per si soles.

**Recomanació**: abans d'iniciar la fase d'implementació (invocació de `writing-plans`), actualitzar el spec aplicant almenys els issues `important` (1, 3, 4, 6, 7, 8). Els `minor` es poden aplicar en paral·lel o diferir a una revisió de polish posterior.
