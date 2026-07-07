# Restaurar l'última posició en reobrir un projecte de subtítols

**Data:** 2026-07-03
**Estat:** Disseny aprovat (persistència: backend `project.settings`)

## 1. Objectiu

Quan l'usuari reobre un projecte a l'editor de subtítols, l'editor ha de tornar
automàticament al punt on es va quedar l'últim cop (posició de reproducció del
vídeo i subtítol actiu), en comptes de començar sempre a 0:00.

## 2. Abast

Cobreix els dos editors de subtítols:

- `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` (editor
  de vídeo + subtítols; ja resol el projecte via `getProjectBySrt`).
- `frontend/components/VideoSubtitlesEditor/VideoSrtStandaloneEditorView.tsx`
  (editor SRT autònom; **actualment NO resol el projecte** — cal afegir-hi una
  resolució mínima).

Fora d'abast (YAGNI):

- `SrtPreviewView` (mode només-lectura): no es guarda posició des d'aquesta vista.
- Mides dels panells, nivell de zoom del waveform, estat de col·lapse: no es
  persisteixen. L'scroll de la llista i del waveform és **derivat** de
  `currentTime`, així que restaurar el temps ja restaura l'scroll.
- Sincronització entre dispositius en temps real / resolució de conflictes: es
  fa un "last-write-wins" simple; no cal més.

## 3. Model de dades

S'afegeix un únic camp niat dins el `settings` (bag lliure) del projecte, sense
tocar l'esquema (`settings: Record<string, any>` ja ho permet):

```ts
// project.settings.resumeState
interface ResumeState {
  currentTime: number;          // segons, >= 0
  activeSegmentId: number | null;
  updatedAt: string;            // ISO 8601, escrit pel backend
}
```

Motius:

- El projecte té `ownerId` i és 1 SRT ↔ 1 projecte, així que `project.settings`
  ja és efectivament per-usuari-per-projecte.
- No cal esquema nou ni migració: els projectes sense `resumeState` simplement
  no tenen el camp i l'editor obre a 0:00 (comportament actual).

## 4. Backend

### 4.1 Servei — `projects.service.ts`

Nou mètode dedicat que fa un `$set` de la ruta niada perquè **no s'esborrin
altres claus de `settings`** (p.ex. `settings.name`, paràmetres whisper):

```ts
async setResumeState(
  projectId: string,
  input: { currentTime: number; activeSegmentId: number | null },
) {
  const currentTime = Math.max(0, Number(input.currentTime) || 0);
  const activeSegmentId =
    input.activeSegmentId == null ? null : Number(input.activeSegmentId);
  const resumeState = {
    currentTime,
    activeSegmentId,
    updatedAt: new Date().toISOString(),
  };
  const res = await this.projectModel.updateOne(
    { _id: projectId },
    { $set: { 'settings.resumeState': resumeState } },
  );
  if (res.matchedCount === 0) throw new NotFoundException('Project not found');
  return resumeState;
}
```

Nota: NO es reutilitza `updateProject(projectId, patch)` (que fa
`updateOne(filter, patch)` sense operadors) perquè passar-li `{ settings: {...} }`
sobreescriuria tot el bag; i passar-li un camp amb punt no és el patró establert.
Un mètode explícit amb `$set` és més segur i clar.

### 4.2 Controller — `projects.controller.ts`

Nova ruta. Com que és una ruta de **dos segments** (`/:id/resume-state`) i un verb
diferent (PATCH), no col·lideix mai amb `GET /:id`, així que l'ordre no és
estrictament necessari; tot i així es col·loca prop de les altres rutes de `/:id/*`
per coherència amb el fitxer. Validació inline a l'estil de `setGuion` (no cal DTO
nou; el `ValidationPipe` global fa `skip` dels bodies amb metatype `Object`, igual
que a `setGuion`):

```ts
@Patch('/:id/resume-state')
@HttpCode(200)
setResumeState(
  @Param('id') id: string,
  @Body() body: { currentTime: number; activeSegmentId?: number | null },
) {
  if (typeof body?.currentTime !== 'number' || !isFinite(body.currentTime)) {
    throw new BadRequestException('currentTime (number) is required');
  }
  return this.projects.setResumeState(id, {
    currentTime: body.currentTime,
    activeSegmentId: body.activeSegmentId ?? null,
  });
}
```

- Guard: ja existeix `@UseGuards(JwtAuthGuard)` a nivell de controller.
- Ownership: la resta de rutes del mòdul (`guion`, `correct-transcript`) NO
  filtren per propietari i els projectes són compartits (`list()` ho documenta).
  Es manté la mateixa política — cap comprovació addicional de propietari.
- Cal importar `Patch` de `@nestjs/common` (i `HttpCode`/`BadRequestException` ja
  hi són).

### 4.3 Lectura

**No hi ha endpoint GET nou.** `getProjectBySrt` (`GET /projects/by-srt/:id`) ja
retorna el projecte sencer, inclòs `settings.resumeState`. L'editor ja crida
aquest endpoint en obrir-se, així que la restauració reaprofita aquesta resposta.

## 5. Frontend

### 5.1 Client API — `services/api.ts`

```ts
async saveResumeState(
  projectId: string,
  input: { currentTime: number; activeSegmentId: number | null },
): Promise<{ currentTime: number; activeSegmentId: number | null; updatedAt: string }> {
  return request<{ currentTime: number; activeSegmentId: number | null; updatedAt: string }>(
    `/projects/${projectId}/resume-state`,
    { method: 'PATCH', body: input },
  );
}
```

### 5.2 Hook compartit — `frontend/hooks/useResumePosition.ts`

Tota la lògica (fetch del resum, aplicació de la restauració i desat) viu en un
únic hook consumit per les dues vistes. Es col·loca a `frontend/hooks/` (on viuen
tots els hooks del projecte: `useDocumentHistory`, `useLocalStorage`, etc.), **no**
a un `hooks/` local de components (que no existeix). Centralitzar-ho evita la
divergència entre les dues vistes germanes — risc que el `CLAUDE.md` de frontend
marca explícitament.

**Contracte:**

```ts
interface ResumeState { currentTime: number; activeSegmentId: number | null; updatedAt?: string; }

interface UseResumePositionParams {
  docId: string;                       // currentDoc.id — clau de reinici
  useBackend: boolean;
  duration: number;                    // 0 fins que el vídeo reporta metadata
  currentTime: number;
  activeSegmentId: number | null;
  segments: Segment[];                 // per resoldre el temps d'un segment (cas sense vídeo)
  mediaMissing: boolean;               // = linkedMediaMissing de la vista (media que falla)
  seekTo: (t: number) => void;         // vídeo: video.currentTime=t + setCurrentTime; sense vídeo: setCurrentTime
  setActiveSegmentId: (id: number) => void;
}
function useResumePosition(p: UseResumePositionParams): { flush: () => void };
```

**Determinació de "hi ha vídeo" (dins el hook, no a la vista):**

- `mediaReady = duration > 0` — es deriva **internament** de `duration` (no és un
  paràmetre separat; s'elimina la redundància `mediaReady`/`duration`).
- El hook sap si s'espera vídeo a partir del **projecte que ell mateix carrega**:
  `mediaExpectedRef = !!proj.mediaDocumentId`. A l'esquema `mediaDocumentId` és
  **obligatori**, així que per a tot projecte resolt val `true`; el senyal útil és
  el negatiu (`false`) del cas SRT sense projecte (404), on el hook ja és inert.
  Tot projecte real **espera vídeo** perquè l'efecte de càrrega de media d'`App.tsx`
  (`:427-462`) dispara un sync amb `linkedMediaId || proj.mediaDocumentId ||
  proj.mediaDocId` (`:450`): encara que l'SRT no tingui `linkedMediaId`, el
  `mediaDocumentId` del projecte serveix de **fallback** i el vídeo es carrega. Per
  això s'abandona l'heurística `!linkedMediaId && !videoSrc` (que hauria classificat
  incorrectament com a "sense vídeo" un projecte carregat pel fallback).
- Lògica de settle: **amb vídeo** quan `mediaReady`; **sense vídeo** quan
  `mediaMissing` (el media enllaçat no existeix) o quan salta la xarxa de seguretat
  (`forceSettle`, sota); **esperar** mentre `mediaExpectedRef && !mediaMissing &&
  !forceSettle && duration===0` (media encara carregant → restaura amb precisió quan
  arribi la durada, ja vingui de `linkedMediaId` o del fallback `mediaDocumentId`).
- **Xarxa de seguretat (settle timeout):** en resoldre el fetch (`resumeLoaded`),
  s'arma un timer únic (`settleTimeoutRef`, ~8s). Si en disparar-se encara no s'ha
  aplicat i hi ha segments, es força la branca sense-vídeo (best-effort) i/o es
  marca `resumeApplied` perquè el desat pugui arrencar. Evita que un projecte el
  media del qual no arriba mai (sense que `mediaMissing` s'activi) deixi el hook
  penjat i el resum sense bootstrapar. Es cancel·la a l'aplicació i al reset `[docId]`.

**Estat intern** (state, no refs, per fer re-avaluar els efectes — corregeix la
cursa de càrrega):

- `projectIdRef` (ref) — id del projecte, omplert pel fetch.
- `pendingResume: ResumeState | null` (**state**) — resum llegit; en state perquè
  omplir-lo re-executi l'efecte d'aplicació encara que `duration` ja hagués canviat.
- `resumeLoaded: boolean` (state) — el fetch ha resolt (amb o sense resum).
- `resumeApplied: boolean` (state) — restauració feta **o** no aplicable; a partir
  d'aquí ja es pot desar. **Desacoblat de si hi havia res a restaurar.**
- `resumeAppliedRef` (**ref**, mirall de `resumeApplied`) — `resumeAppliedRef.current
  = resumeApplied` a cada render. Cal perquè `flush()` s'invoca des de cleanups amb
  dep `[docId]`/`[]` que **no** poden llegir el valor actual de l'state (capturarien
  el de muntatge). Els efectes d'aplicació/desat segueixen usant l'state; flush i els
  cleanups usen el ref.
- `mediaExpectedRef` (**ref**) — `true` si el projecte carregat té `mediaDocumentId`
  (sempre, per esquema); l'omple el fetch. Distingeix "encara carregant vídeo" de
  "no hi ha vídeo".
- `forceSettle: boolean` (state) — l'activa la xarxa de seguretat (settle timeout)
  per desbloquejar l'aplicació si el vídeo no arriba mai.
- `settleTimeoutRef` (ref) — timer únic de la xarxa de seguretat.
- `lastSavedKeyRef`, `lastWriteRef`, `trailingTimerRef`, `latestRef`, `flushRef`,
  `useBackendRef` (refs) — control del throttle i flush estable. `flushRef.current =
  flush` i `useBackendRef.current = useBackend` a cada render perquè els cleanups
  cridin sempre l'última versió / valor actual.

**Prerequisit — remuntar l'editor per document (`key`):** a `App.tsx` s'afegeix
`key={currentDoc.id}` a totes dues vistes d'editor (posicions `:584`, `:588`, `:973`,
`:975`). Motiu: les vistes només reinicien l'estat de vídeo (`videoSrc`, `duration`,
`currentTime`, `autoLoadAttemptedRef`) dins `handleSyncMedia`, i `autoLoadAttemptedRef`
**no** es reinicia en canviar de `docId`; sense `key`, obrir un altre document a la
mateixa instància deixaria `duration`/`videoSrc` del document anterior i el hook
restauraria B contra el vídeo d'A. Amb `key`, cada document munta un editor net (tot
l'estat a l'inicial) i el desat del document sortint es fa al **desmuntatge**. És un
canvi mínim que, a més, corregeix un defecte latent preexistent. Anar a Home o
canviar de **mode** d'editor ja desmunta la vista; però obrir un document germà del
**mateix mode** (via `handleOpenDocument`, `App.tsx:517-526`, que només canvia
`openDocId`/`openMode`) **reutilitza** la instància — és el cas que `key` fa correcte.

**1) Reinici + flush** — efecte amb dep `[docId]`. Amb `key`, el `docId` d'una
instància no canvia: el **cos** corre un cop en muntar (reset inicial, majoritàriament
redundant amb els valors inicials) i el **cleanup** corre un cop en **desmuntar**,
cridant `flushRef.current()` per desar la posició del projecte sortint. Es manté la
dep `[docId]` (equivalent a mount/unmount sota `key`, i robust si mai es tragués la
`key`). **Important:** el reset viu al **cos de l'efecte**, no durant el render; això
és el que garanteix que, en el cleanup de desmuntatge, `projectIdRef`/`latestRef`/
`resumeAppliedRef` encara reflecteixin el projecte sortint i el flush en desi les
dades. No moure aquest reset al render.

```ts
useEffect(() => {
  // cos: reset inicial d'aquesta instància
  projectIdRef.current = null; mediaExpectedRef.current = false;
  setPendingResume(null); setResumeLoaded(false); setResumeApplied(false);
  setForceSettle(false); resumeAppliedRef.current = false;
  lastSavedKeyRef.current = ''; lastWriteRef.current = 0; latestRef.current = { t: 0, seg: null };
  if (trailingTimerRef.current) { clearTimeout(trailingTimerRef.current); trailingTimerRef.current = null; }
  if (settleTimeoutRef.current) { clearTimeout(settleTimeoutRef.current); settleTimeoutRef.current = null; }
  return () => { flushRef.current(); };   // flush del projecte sortint en desmuntar
}, [docId]);
```

**2) Fetch del resum** — efecte `[docId, useBackend]`:

```ts
if (!useBackend) { setResumeLoaded(true); return; }   // res a llegir del backend
let cancelled = false;
void api.getProjectBySrt(docId).then(proj => {
  if (cancelled || !proj?.id) return;
  projectIdRef.current = proj.id;
  mediaExpectedRef.current = !!proj.mediaDocumentId;    // esperem vídeo?
  const rs = proj.settings?.resumeState;
  if (rs && typeof rs.currentTime === 'number' && rs.currentTime > 0) setPendingResume(rs);
}).catch(() => {}).finally(() => { if (!cancelled) setResumeLoaded(true); });
return () => { cancelled = true; };
```

**2b) Xarxa de seguretat** — efecte `[resumeLoaded]`: quan `resumeLoaded` passa a
`true` i hi ha projecte, arma `settleTimeoutRef = setTimeout(() => setForceSettle(true), 8000)`.
Cleanup: `clearTimeout`. (També es cancel·la en aplicar-se, vegeu pas 3.)

Si el document no pertany a cap projecte, `getProjectBySrt` fa 404 → `catch` →
`projectIdRef` queda null → el hook queda inert (no restaura ni desa). Nota: en
`VideoSubtitlesEditorView` això suposa una segona crida a `getProjectBySrt` (l'altra
la fa l'efecte del guió); és una lectura barata i s'accepta a canvi de tenir les
dues vistes idèntiques. (Optimització futura fora d'abast: passar el projecte ja
carregat al hook.)

**3) Aplicació de la restauració** — efecte
`[resumeLoaded, pendingResume, duration, mediaMissing, forceSettle, segments]`. Es depèn
de `segments` (l'array, no `.length`) perquè la branca sense-vídeo fa `segments.find(...)`;
així s'evita resoldre l'`activeSegmentId` contra un array obsolet si la llista es
reemplaça amb la mateixa longitud abans d'aplicar. Un cop `resumeApplied`, l'efecte
retorna d'immediat, així que re-executar-se en cada edició de segments és inofensiu.
`markApplied()` també cancel·la la xarxa de seguretat i actualitza el mirall.

```ts
if (resumeApplied || !resumeLoaded) return;
const mediaReady = duration > 0;                 // derivat, no és paràmetre
const noVideo = mediaMissing || forceSettle || !mediaExpectedRef.current;
const markApplied = () => {
  if (settleTimeoutRef.current) { clearTimeout(settleTimeoutRef.current); settleTimeoutRef.current = null; }
  lastWriteRef.current = performance.now(); resumeAppliedRef.current = true; setResumeApplied(true);
};
if (pendingResume == null) {
  // Res a restaurar: marca "aplicat" perquè el desat pugui començar,
  // però només quan l'editor s'ha estabilitzat (evita marcar en buit).
  if (mediaReady || (noVideo && segments.length > 0)) markApplied();
  return;
}
if (mediaReady) {                                // cas amb vídeo
  const target = Math.min(pendingResume.currentTime, Math.max(0, duration - 0.1));
  seekTo(target);
  // activeSegmentId es deriva de currentTime (efecte de sync de la vista) → no el forcem
  markApplied();
} else if (noVideo && segments.length > 0) {     // cas sense vídeo (o fallback)
  const seg = pendingResume.activeSegmentId != null
    ? segments.find(s => s.id === pendingResume.activeSegmentId) : null;
  if (seg) { seekTo(seg.startTime); setActiveSegmentId(seg.id); }  // temps i segment coherents
  markApplied();
}
// altrament: media esperat i encara carregant → esperar (l'efecte es re-executa amb els deps)
```

On `noVideo` és cert quan el media enllaçat falla (`mediaMissing`), quan el projecte
no espera vídeo (`!mediaExpectedRef.current`, cas rar donat que `mediaDocumentId` és
obligatori), o quan salta la xarxa de seguretat (`forceSettle`). Mentre s'espera
vídeo (`mediaExpectedRef && !mediaMissing && !forceSettle && duration===0`) el hook
**no** aplica: així un projecte amb media només via `project.mediaDocumentId` (encara
carregant) restaura amb precisió quan arriba la durada, en comptes de caure a la
branca sense-vídeo.

Punt clau (corregeix el clobber de l'`activeSegmentId`): en el cas amb vídeo **no**
forcem `activeSegmentId` — el `seekTo` provoca un `timeupdate` i l'efecte de sync
de la vista posa el segment correcte, coherent amb el temps. En el cas sense vídeo
posem `currentTime = seg.startTime`, de manera que l'efecte "sync active segment by
time" (standalone `:108-112`) troba el **mateix** segment i no el sobreescriu.

**4) Desat (throttle amb flanc principal + de cua, NO debounce).** Es defineix
primer una funció `commit()` que **llegeix `latestRef` en el moment de disparar-se**
(no captura valors del render que va armar el timer — corregeix la persistència de
valor obsolet) i que porta tots els guards a dins, així flush pot reutilitzar-la:

```ts
const INTERVAL = 5000;
const commit = () => {                             // llegeix latestRef AL DISPAR
  if (!useBackendRef.current || !resumeAppliedRef.current || !projectIdRef.current) return;
  const { t, seg } = latestRef.current;
  const key = `${t}|${seg}`;
  if (key === lastSavedKeyRef.current) return;
  lastWriteRef.current = performance.now();
  lastSavedKeyRef.current = key;
  void api.saveResumeState(projectIdRef.current, { currentTime: t, activeSegmentId: seg }).catch(() => {});
};
```

Efecte de desat `[currentTime, activeSegmentId, useBackend, resumeApplied]`:

```ts
latestRef.current = { t: Math.round(currentTime * 10) / 10, seg: activeSegmentId };
if (!useBackend || !resumeApplied || !projectIdRef.current) return;
const elapsed = performance.now() - lastWriteRef.current;
if (elapsed >= INTERVAL) { commit(); return; }    // flanc principal
if (!trailingTimerRef.current) {                  // flanc de cua: un sol timer, NO reiniciat
  trailingTimerRef.current = setTimeout(() => { trailingTimerRef.current = null; commit(); }, INTERVAL - elapsed);
}
```

Com que `commit()` llegeix `latestRef.current` quan es dispara, el flanc de cua desa
la **darrera** posició coneguda, no la del moment d'armar-se. S'usa un **throttle**
(flanc principal immediat si ha passat l'interval, si no un únic timer de cua que
**no** es reinicia a cada canvi) en lloc d'un debounce: com que `currentTime`
s'actualitza ~cada 250ms durant la reproducció, un debounce mai s'hauria disparat; el
throttle garanteix un desat com a molt cada 5s. (`currentTime` ja ve throttlejat a
~250ms per `handleTimeUpdateThrottled`.)

**5) Flush** — el hook retorna
`flush = () => { if (trailingTimerRef.current) { clearTimeout(trailingTimerRef.current); trailingTimerRef.current = null; } commit(); }`.
En reutilitzar `commit()`, hereta els **guards** (`useBackend`, `resumeAppliedRef`,
`projectIdRef` no-null) i la comparació amb `lastSavedKeyRef`. Això evita el clobber
amb `0`: si es tanca **abans** que s'apliqui la restauració, `resumeAppliedRef.current`
és `false` → `commit()` no fa res → no sobreescriu la posició desada amb `0|null` ni
fa cap PATCH a `/projects/null/...`. `flush` s'exposa via `flushRef` (`flushRef.current
= flush` a cada render) i es crida:

- des del cleanup `[docId]` (canvi de document i unmount) — pas 1,
- des de `onPause` de cada vista,
- des de `onClose` a la vista standalone (que en té; la principal **no** en té — es
  tanca per navegació externa que la desmunta, cobert pel cleanup `[docId]`).

`useBackendRef` és un mirall ref de `useBackend` (`useBackendRef.current = useBackend`
a cada render) perquè `commit()`, cridat des de cleanups, en llegeixi el valor actual.

Notes de coherència: el desat **no** despatxa `UPDATE_DOCUMENT_CONTENTS` ni res que
re-dispari `handleSyncMedia` (evita el reset de playhead descrit al comentari
`:496-498`); i és independent de l'autosave d'SRT (`:485-507`).

### 5.3 Consum a les vistes

Cada vista passa el seu `onSeek` **ja existent** com a `seekTo` (no se'n defineix un
de reduït): a `VideoSubtitlesEditorView` `onSeek` (`:658-665`) fa `video.currentTime=t`,
`setCurrentTime`, actualitza `currentTimeRef` i emet `time-sync` pel BroadcastChannel
del guió — cal reutilitzar-lo perquè la restauració deixi `currentTimeRef` i la
finestra de guió coherents. A `VideoSrtStandaloneEditorView`, `onSeek` (`:117-120`)
fa `video.currentTime=t` + `setCurrentTime`. (Nota cosmètica acceptada: el `onSeek`
principal emet `isPlaying:true` al BroadcastChannel; en obrir en pausa, la finestra
de guió pot mostrar breument "reproduint" fins al següent sync. Sense impacte
funcional; fora d'abast.)

**Estabilitat de `flush` a `onPause`:** `onPause` es manté amb deps `[]` i crida
`resume.flush()` directament. És segur encara que la identitat de `flush` canviï cada
render, perquè `flush`/`commit` només llegeixen refs; **no** s'ha d'afegir
`resume.flush` a les deps de l'`useCallback` d'`onPause` (provocaria re-renders a cada
tick de reproducció).

**`VideoSubtitlesEditorView.tsx`** — té `videoRef` (`:128`), `duration` (`:81`),
`currentTime`/`setCurrentTime` (`:80`), `activeSegmentId`/`setActiveSegmentId`
(`:260`), `segments` (`:259`), `videoSrc`, `linkedMediaMissing`, `onSeek` (`:658-665`).
Instancia el hook amb `seekTo = onSeek` i crida `resume.flush()` a `onPause`. No té
`onClose`; el tancament el cobreix el cleanup `[docId]`.

**`VideoSrtStandaloneEditorView.tsx`** — té `videoRef` (`:58`), `setCurrentTime`
(`:38`), `activeSegmentId` (`:69`), `onSeek` (`:117-120`), `segments`, `duration`
(`:39`), `linkedMediaMissing` (`:57`), `onClose` (prop), i importa `api` (`:19`).
Aquesta vista **no resol el projecte avui**: el hook mateix fa el `getProjectBySrt`,
així que només cal instanciar-lo (cap `guionProjectId` nou), amb `seekTo = onSeek`, i
cridar `flush()` a `onPause` i `onClose`.

Paràmetres de media que passa cada vista: només `mediaMissing = linkedMediaMissing`
(estat: main `:433` / standalone `:57`; el setter `setLinkedMediaMissing(true)` es
dispara a main `:433` / standalone `:404`, només quan falta el media enllaçat) i
`duration`. El hook
deriva `mediaReady` de `duration` i sap si s'espera vídeo pel `mediaDocumentId` del
projecte que ell carrega — les vistes **ja no** calculen cap heurística `noMedia`
basada en `videoSrc`/`linkedMediaId`.

L'efecte existent standalone `if (segments.length>0 && activeSegmentId==null)
setActiveSegmentId(segments[0].id)` (`:103-105`) s'executa abans de la restauració
(que espera `resumeLoaded`) i queda sobreescrit per aquesta; no cal tocar-lo.

## 6. Flux de dades (resum)

```
Obrir editor
  ├─ hook: getProjectBySrt(docId) → pendingResume (state), resumeLoaded=true ─┐
  └─ handleSyncMedia → video carrega → onDurationChange(duration>0) ──────────┤
                                                                              ▼
        efecte aplicació (deps: resumeLoaded, pendingResume, duration, ...):
          · amb vídeo   → seekTo(min(saved, dur-0.1)); segment derivat del temps
          · sense vídeo → seekTo(seg.startTime) + setActiveSegmentId
          · sense resum → només marca resumeApplied (per poder desar)
                                                                              ▼
  usuari reprodueix/edita → currentTime canvia (throttle 250ms)
                                                                              ▼
        efecte desat (throttle 5s, flanc principal + cua) → PATCH /projects/:id/resume-state
                                                                              ▼
  flush() de l'última posició en: onPause (ambdues vistes), unmount (cleanup [docId],
  ambdues), onClose (només standalone)
```

Nota: `pendingResume` és **state**, així que si `duration` canvia abans que resolgui
el fetch (o a l'inrevés), l'efecte d'aplicació es re-executa quan arriba el que
faltava — no hi ha cursa d'ordre entre fetch i durada.

## 7. Casos límit i tractament

| Cas | Tractament |
|-----|-----------|
| Projecte sense `resumeState` | `pendingResume` queda null → obre a 0:00; `resumeApplied` es marca igualment (via branca "res a restaurar") perquè el desat **sí** arrenqui i el projecte bootstrapi la seva posició. |
| `saved.currentTime > duration` (vídeo canviat/retallat) | Clamp a `duration - 0.1`. |
| Media enllaçat desaparegut (`mediaMissing`) | Branca sense-vídeo: restaura via `activeSegmentId` posant `currentTime = seg.startTime`; sense seek de vídeo. |
| Media només via `project.mediaDocumentId` (encara carregant) | L'efecte d'`App.tsx:450` el carrega com a fallback; el hook **espera** (`mediaExpectedRef && !mediaMissing && !forceSettle && duration===0`) i restaura amb precisió quan arriba `duration>0` — no cau prematurament a la branca sense-vídeo. |
| Vídeo que no arriba mai i `mediaMissing` no s'activa | Xarxa de seguretat: `settleTimeout` (~8s) → `forceSettle` → branca sense-vídeo/best-effort → el resum bootstrapa igualment. |
| SRT sense projecte (standalone) | `getProjectBySrt` → 404 → `catch` → `projectIdRef` null → hook inert. |
| Cursa fetch↔durada | `pendingResume`/`resumeLoaded` en **state** → l'efecte d'aplicació es re-executa; no depèn de l'ordre. |
| Desat abans de restaurar | `commit()`/`flush()` guarden per `resumeAppliedRef` (ref, llegible des de cleanups) → no escriuen `0` abans d'aplicar. |
| Tancar abans d'aplicar la restauració | `flush()`→`commit()` retorna d'immediat (`resumeAppliedRef`=false) → **no** sobreescriu la posició desada amb `0|null` ni fa PATCH a `/projects/null/...`. |
| Flanc de cua desa valor obsolet | `commit()` llegeix `latestRef.current` **al disparar-se**, no al armar el timer → desa la darrera posició. |
| Clobber de `activeSegmentId` | Cas amb vídeo: no es força (derivat del temps). Cas sense vídeo: `currentTime` s'alinea amb el segment → l'efecte de sync no el sobreescriu. |
| Desat durant reproducció contínua | Throttle 5s (flanc de cua no reiniciable) → desa periòdicament; debounce evitat. |
| Escriptures redundants (mateixa posició) | `lastSavedKeyRef` + arrodoniment 0.1s. |
| Fallada de xarxa al desar | `.catch(()=>{})` silenciós; es reintenta al següent canvi. |
| Canviar de projecte A→B | `key={currentDoc.id}` remunta l'editor: A es desmunta (cleanup `[docId]` → **flush d'A**) i B munta net (sense estat de vídeo residual d'A). No es perd la posició d'A ni es restaura B contra el vídeo d'A. |
| Estat de vídeo residual entre documents | Resolt pel remuntatge (`key`); sense ell, `autoLoadAttemptedRef`/`duration` d'A persistirien. |
| `useBackend === false` (mode local) | `resumeLoaded=true` immediat, `projectIdRef` null → ni restaura ni desa (coherent amb la resta). |
| Concurrència (2 pestanyes) | Last-write-wins; acceptable per a posició de lectura. |

## 8. Proves

**Backend (unit/e2e del mòdul projects):**

1. `PATCH /projects/:id/resume-state` amb `{currentTime: 42.5, activeSegmentId: 7}`
   → 200, i `getProjectBySrt` posterior retorna `settings.resumeState` amb aquests
   valors + `updatedAt`.
2. `$set` niat **no** esborra altres claus de `settings` (crear projecte amb
   `settings.name`, desar resumeState, verificar que `name` persisteix).
3. `currentTime` negatiu → clamp a 0. `currentTime` no-numèric → 400.
4. Project id inexistent → 404.

**Frontend (manual / component):**

5. Obrir un projecte, reproduir fins a 0:30, tancar i reobrir → el vídeo comença
   a ~0:30 i el subtítol actiu és el correcte.
6. `resumeState.currentTime` > durada real → obre al final menys 0.1s, sense error.
7. Projecte nou (sense resumeState) → obre a 0:00, **i** després de reproduir i
   tancar, en reobrir recupera la posició (bootstrap: el desat arrenca encara que
   no hi hagués resum previ — regressió de C1).
8. Standalone SRT lligat a projecte → mateixa restauració; SRT solt → sense efecte.
9. La restauració s'aplica **una sola vegada** (no re-salta si l'usuari busca
   manualment després).
10. Reproducció contínua > 5s sense pausar → s'observa almenys un PATCH periòdic
    (regressió de M3: el throttle dispara; un debounce no ho faria).
11. Cas sense vídeo (media desaparegut) amb `activeSegmentId` desat → el subtítol
    actiu restaurat NO és sobreescrit per l'efecte de sync-per-temps (regressió de M4).
12. Obrir projecte desat a 0:30 i tancar-lo **abans** que carregui el vídeo/resum →
    la posició 0:30 es conserva (NO es sobreescriu amb 0), i no s'observa cap PATCH a
    `/projects/null/...` (regressió de F2).
13. Reproduir contínuament i deixar disparar el flanc de cua → el PATCH conté la
    posició **més recent**, no la de fa 5s (regressió de F1).
14. Canviar directament de projecte A→B (sense passar per Home) → gràcies a
    `key={currentDoc.id}`, A es desmunta i desa la seva posició, i B obre net i
    restaura la seva pròpia posició (no la d'A) contra el vídeo de B (regressió de M2
    + major it.3).

## 9. Fitxers afectats

**Backend:**

- `backend_nest_mvp/src/modules/projects/projects.service.ts` — `setResumeState`.
- `backend_nest_mvp/src/modules/projects/projects.controller.ts` — ruta PATCH + import `Patch`.

**Frontend:**

- `frontend/services/api.ts` — `saveResumeState`.
- `frontend/hooks/useResumePosition.ts` — hook nou (compartit; mateixa carpeta que la resta de hooks del projecte).
- `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` — instanciar el hook (`seekTo = onSeek`) + `flush()` a `onPause`.
- `frontend/components/VideoSubtitlesEditor/VideoSrtStandaloneEditorView.tsx` — instanciar el hook (`seekTo = onSeek`) + `flush()` a `onPause`/`onClose`.
- `frontend/App.tsx` — afegir `key={currentDoc.id}` a les vistes d'editor. Els punts
  càrrega-crítics són `:584`/`:588` (`MainAppContent`, on la instància es reutilitza
  entre documents). A `:973`/`:975` (`EditorTabContent`) el `docId` ve del hash i no
  canvia mai per la vida del component, així que el `key` hi és inert però es posa per
  uniformitat.

## 10. Fora d'abast / decisions preses

- Persistència: **backend** (`project.settings`), triada per l'usuari (cross-device).
- No es guarda velocitat de reproducció, zoom de waveform ni layout (YAGNI).
- No es fa migració de dades ni endpoint GET nou.
- No es toca el sistema d'autosave d'SRT ni els locks d'edició.
- **Tradeoff acceptat:** el hook fa el seu propi `getProjectBySrt`, cosa que suposa
  una segona lectura a `VideoSubtitlesEditorView` (l'altra la fa l'efecte del guió).
  És una lectura barata; es prioritza tenir les dues vistes idèntiques per sobre
  d'estalviar una crida. Optimització futura (passar el projecte ja carregat al
  hook via setter) queda fora d'abast.
