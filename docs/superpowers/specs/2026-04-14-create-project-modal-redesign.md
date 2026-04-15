# Spec: Redisseny del Modal "Crear Proyecto" i Sistema de Presets Whisper

**Data:** 2026-04-14  
**Estat:** Aprovat — pendent d'implementació  
**Àmbit:** `frontend/components/Projects/CreateProjectModal.tsx`, `backend_nest_mvp/src/modules/settings/`, `backend_nest_mvp/src/modules/projects/`

---

## 1. Motivació

El modal actual de "Crear Proyecto" mostra tota la configuració tècnica de Whisper directament visible, cosa que carrega visualment una operació que la majoria de vegades és rutinària (nom + vídeo + perfil). A més, la pestanya "Importar SRT" arrossegava els camps de Whisper sense cap ús funcional real.

L'objectiu és:
- Reduir el modal al mínim necessari per a l'ús habitual
- Amagar la configuració avançada darrere un collapsible
- Introduir un sistema de presets Whisper amb presets de fàbrica (VE, VCAT) i presets personalitzats per usuari
- Netejar la pestanya "Importar SRT" eliminant tot el que no hi té sentit
- Fer que el LNK del vídeo dins del projecte es creï automàticament al backend
- Permetre importar un SRT existent de la plataforma (amb opció d'eliminar l'original)

---

## 2. Disseny visual aprovat

Els mockups de referència es troben a:
`.superpowers/brainstorm/671-1776174484/content/`

- `modal-layout-v3.html` — estat collapsat (Transcribir)
- `modal-states.html` — Transcribir amb avançat desplegat + perfil "custom"
- `modal-importsrt-v6.html` — Importar SRT, tots els estats del checkbox

### Layout general (ambdues pestanyes)

```
┌─────────────────────────────────────────────┐
│ Crear proyecto   [Transcribir] [Importar SRT]│  ×
├───────────────────┬─────────────────────────┤
│ NOMBRE            │ VÍDEO / AUDIO           │
│ [input          ] │ [select...       ] [↑]  │
│                   │                         │
│ PERFIL WHISPER    │ GUIÓ (opcional)         │
│ [VE ▾           ] │ [Sin guió        ] [📄] │
├───────────────────┴─────────────────────────┤
│ WHISPER AVANÇAT                          [▶]│  ← línia divisora
├─────────────────────────────────────────────┤
│                        [Cancelar] [Acció]   │  ← línia divisora
└─────────────────────────────────────────────┘
```

La columna esquerra de la pestanya **Importar SRT** substitueix "PERFIL WHISPER" per "ARXIU SRT":

```
│ NOMBRE            │ VÍDEO / AUDIO           │
│ [input          ] │ [select...       ] [↑]  │
│                   │                         │
│ ARXIU SRT         │ GUIÓ (opcional)         │
│ [select...  ] [↑] │ [Sin guió        ] [📄] │
│ [Eliminar original — gris/vermell]          │
```

---

## 3. Frontend: `CreateProjectModal.tsx`

### 3.1 Estat nou

```typescript
// Presets
const [userPresets, setUserPresets] = useState<Record<string, WhisperConfig>>({});
const [advancedOpen, setAdvancedOpen] = useState(false);
const [savePresetOpen, setSavePresetOpen] = useState(false);
const [savePresetError, setSavePresetError] = useState<string | null>(null);

// Tab Importar SRT
const [srtDocId, setSrtDocId] = useState<string>('');       // SRT de plataforma seleccionat
const [deleteOriginalSrt, setDeleteOriginalSrt] = useState(true);
// srtFile (ja existent) segueix per a l'import extern

// Derivat
const srtDocs = useMemo(
  () => state.documents.filter(d => (d.sourceType || '').toLowerCase() === 'srt' && !d.isDeleted && !d.refTargetId),
  [state.documents]
);
```

**Reset al reopening del modal** — el `useEffect([open])` existent ha d'incloure el reset dels nous estats:

```typescript
useEffect(() => {
  if (!open) return;
  setBusy(false);
  setErr(null);
  setJobProgress(0);
  // Nous:
  setSrtDocId('');
  setDeleteOriginalSrt(true);
  setAdvancedOpen(false);
  setSavePresetOpen(false);
  setSavePresetError(null);

  setSrtFile(null);  // ← NOU: reset síncron fora del bloc async (es reseteja fins i tot si l'API falla)

  void (async () => {
    try {
      const [opt, presets] = await Promise.all([
        api.transcriptionOptions(),
        api.getWhisperPresets(),   // ← NOU: carrega presets de l'usuari
      ]);
      setUserPresets(presets ?? {});
      // ... resta de la càrrega d'options (igual que ara)
    } catch (e) { console.warn(e); }
  })();
}, [open]);
```

### 3.2 Detecció de "custom"

```typescript
useEffect(() => {
  if (profile === 'custom') return;
  const allPresets = { ...FACTORY_PRESETS, ...userPresets };
  const current = allPresets[profile];
  if (!current) return;
  const changed =
    engine !== current.engine ||
    model !== current.model ||
    language !== current.language ||
    batchSize !== current.batchSize ||
    device !== current.device ||
    timingFix !== current.timingFix ||
    diarization !== current.diarization ||
    minSubGapMs !== current.minSubGapMs ||
    enforceMinSubGap !== current.enforceMinSubGap;
  if (changed) setProfile('custom');
}, [engine, model, language, batchSize, device, timingFix, diarization, minSubGapMs, enforceMinSubGap]);
```

`FACTORY_PRESETS` és una constant local al component:

```typescript
const FACTORY_PRESETS: Record<string, WhisperConfig> = {
  VE:   { engine: 'purfview-xxl', model: 'large-v3', language: 'es', batchSize: 16, device: 'cpu', timingFix: true, diarization: false, minSubGapMs: 160, enforceMinSubGap: true },
  VCAT: { engine: 'purfview-xxl', model: 'large-v3', language: 'ca', batchSize: 16, device: 'cpu', timingFix: true, diarization: false, minSubGapMs: 160, enforceMinSubGap: true },
};
```

### 3.3 Selecció de perfil

En canviar el perfil al desplegable, s'apliquen tots els valors del preset seleccionat:

```typescript
const applyPreset = (name: string) => {
  const allPresets = { ...FACTORY_PRESETS, ...userPresets };
  const p = allPresets[name];
  if (!p) return;
  setProfile(name);
  setEngine(p.engine);
  setModel(p.model);
  setLanguage(p.language);
  setBatchSize(p.batchSize);
  setDevice(p.device);
  setTimingFix(p.timingFix);
  setDiarization(p.diarization);
  setMinSubGapMs(p.minSubGapMs);
  setEnforceMinSubGap(p.enforceMinSubGap);
  // Si el preset desactiva diarització, reset numSpeakers per evitar valor orfè
  if (!p.diarization) setNumSpeakers('auto');
};
```

El desplegable mostra:
1. Presets de fàbrica: VE, VCAT (readonly — no es poden esborrar)
2. Separador visual `──────` **només si** `Object.keys(userPresets).length > 0` — no mostrar separador buit
3. Presets de l'usuari (si en té)
4. Si `profile === 'custom'`: opció addicional `<option value="custom" disabled>` en cursiva — renderitzada però no seleccionable manualment. Sense `disabled`, l'usuari podria seleccionar "custom" com a preset real i trencar la lògica de detecció.

### 3.4 Guardar perfil

Botó "Guardar perfil…" visible a la capçalera de la secció avançada (només quan `advancedOpen`).

Al clicar, obre un mini-form inline (dins el modal, no un overlay separat) amb:
- Input de nom (trim automàtic)
- Botó `✕` o "Cancel·lar" per tancar sense guardar — fa `setSavePresetOpen(false)` + `setSavePresetError(null)`
- Validació client: no buit, no `VE`, no `VCAT` (case-insensitive)
- Si el nom coincideix amb un preset existent de l'usuari → avís "Sobreescriurà el preset existent"
- Botó "Guardar" → crida `api.saveWhisperPreset(name, currentConfig)` on `currentConfig` és:
  ```typescript
  const currentConfig: WhisperConfig = { engine, model, language, batchSize, device, timingFix, diarization, minSubGapMs, enforceMinSubGap };
  ```
  - **En èxit**: actualitza `userPresets` localment (`setUserPresets(prev => ({ ...prev, [name]: currentConfig }))`) + `setProfile(name)` + tanca el mini-modal
  - **En error**: mostra el missatge d'error dins el mini-modal via `savePresetError` — no tancar el modal fins que l'usuari ho resolgui

### 3.5 Collapsible "Whisper avançat"

- Línia divisora superior sempre visible
- Botó-fila amb `WHISPER AVANÇAT` + fletxa ▶/▼ + botó "Guardar perfil…" (alineat a la dreta, visible només quan obert). En tancar el collapsible (`advancedOpen → false`), fer `setSavePresetOpen(false)` per evitar que el mini-form quedi obert en un panell ocult.
- El contingut intern: grid 2 col amb motor, model, idioma, batch, device + checkboxes waveform i diarització
- "Marge mínim": checkbox `enforceMinSubGap` que, quan actiu, mostra l'input numèric `minSubGapMs` (en ms). Quan `enforceMinSubGap === false`, l'input queda ocult (igual que en el modal actual)
- Si `diarization === true`: mostra sub-control `numSpeakers` (auto / 2–8) igual que en el modal actual — s'ha de preservar
- Si `engine === 'script-align'`: amagar model, batch, device (igual que ara) + mostrar el camp de guion text (`scriptText` / `scriptFile`) **just dessota del panell avançat i per sobre dels botons de footer**, visible únicament quan `engine === 'script-align'`. No apareix a la zona superior de 2 columnes. En el modal actual aquest camp estava a la columna esquerra; en el nou layout es mou aquí per no contaminar la zona simplificada.

### 3.6 Pestanya Importar SRT — lògiques sagrades

#### ARXIU SRT — desplegable (seleccionar existent de la plataforma)
- Llista `srtDocs` (documents `.srt` de la plataforma, no esborrats, no LNK)
- En seleccionar: `setSrtDocId(id)` + `setDeleteOriginalSrt(true)` + `setSrtFile(null)`
- El contingut es **duplica** com a nou SRT dins el projecte. L'original no es toca fins al final.
- Apareix checkbox "Eliminar original" en estat actiu (vermell, marcat per defecte)
- Si l'usuari desmarca: l'original es conserva intacte

#### ARXIU SRT — botó ↑ (importar fitxer extern)
- Obre selector de fitxers del sistema (accept `.srt`)
- En seleccionar: `setSrtFile(file)` + `setSrtDocId('')` + `setDeleteOriginalSrt(false)` (no hi ha original)
- El checkbox "Eliminar original" passa a gris deshabilitat

#### VÍDEO / AUDIO — desplegable (seleccionar existent de MEDIA)
- Llista `mediaDocs` filtrat per `isCanonicalMedia` (definició de CLAUDE.md: `doc.type === 'document' && !!doc.media && !doc.refTargetId`) — mai de Files, mai LNK. **No usar `sourceType` per a aquest filtre**: és la definició canònica del model de biblioteca.
- En seleccionar: `setMediaId(id)` — el frontend no fa res més
- **El LNK es crea al backend en el moment del submit** (creació del projecte), no en seleccionar el vídeo (veure Secció 5.1)
- **Regla absoluta: mai mostrar vídeos/àudios de Files en aquest desplegable**

#### VÍDEO / AUDIO — botó ↑ (importar fitxer nou)
- Obre selector de fitxers (mp4, mov, webm, wav, mp3, ogg, m4a)
- El fitxer es puja a l'arrel de **MEDIA** (mai a Files — regla absoluta)
- `parentId: null` sempre en la crida `uploadMedia`
- Un cop pujat: `setMediaId(newId)` — el LNK es crea al backend en el submit, igual que en el cas del desplegable

#### Checkbox "Eliminar original"
- **Sempre visible** al mateix lloc (estructura estable, sense salts de layout)
- **Gris / deshabilitat**: quan no hi ha SRT de plataforma seleccionat (estat inicial, SRT extern)
- **Vermell / actiu / marcat per defecte**: quan hi ha un SRT de plataforma seleccionat al desplegable
- L'usuari pot desmarcar-lo per conservar l'original

### 3.7 Flux `createFromExistingSrt` actualitzat

Validació prèvia al submit:
- Si `!name.trim()` → `setErr('Falta el nombre del proyecto')`
- Si `!mediaId` → `setErr('Selecciona un vídeo')`
- Si `!srtDocId && !srtFile` → `setErr('Selecciona o importa un arxiu SRT')`

`settings` enviat des d'aquesta pestanya: `{}` (objecte buit). La pestanya no mostra ni usa configuració Whisper; no té sentit enviar valors tècnics que el backend no aplica.

```typescript
// Si hi ha srtDocId (SRT de plataforma), enviar-lo al backend
// Si hi ha srtFile (extern), llegir-ne el text i enviar-lo com fins ara
// IMPORTANT: settings sempre {} en aquest tab — no s'usa configuració Whisper
const payload = srtDocId
  ? { name, mediaDocumentId: mediaId, sourceSrtDocumentId: srtDocId, deleteOriginalSrt, settings: {} }
  : { name, mediaDocumentId: mediaId, srtText: await srtFile!.text(), settings: {} };

const res = await api.createProjectFromExisting(payload);
```

---

## 4. Backend: `settings` module

### 4.1 Schema nou: `user-settings.schema.ts`

```typescript
export interface WhisperConfig {
  engine: string;
  model: string;
  language: string;
  batchSize: number;
  device: 'cpu' | 'cuda';
  timingFix: boolean;
  diarization: boolean;
  minSubGapMs: number;
  enforceMinSubGap: boolean;
}

@Schema({ timestamps: true })
export class UserSettings {
  @Prop({ required: true, unique: true, index: true })
  userId: string;

  @Prop({ type: Object, default: {} })
  whisperPresets: Record<string, WhisperConfig>;
}

// Patró estàndard del codebase — necessari per a la injecció de Mongoose
export type UserSettingsDocument = HydratedDocument<UserSettings>;
export const UserSettingsSchema = SchemaFactory.createForClass(UserSettings);
```

### 4.2 Service: `UserSettingsService`

Mètodes:
- `getWhisperPresets(userId): Promise<Record<string, WhisperConfig>>`
- `saveWhisperPreset(userId, name, config): Promise<void>` — upsert
- `deleteWhisperPreset(userId, name): Promise<void>`

Validació al service:
- Noms reservats `['VE', 'VCAT']` (case-insensitive) → `BadRequestException`
- Nom buit o només espais → `BadRequestException`
- `deleteWhisperPreset`: si el preset no existeix → retornar silenciosament (idempotent, no llençar 404)

### 4.3 Endpoints nous a `SettingsController`

Tots autenticats amb `@UseGuards(JwtAuthGuard)`, user-scoped via `@CurrentUser()`:

| Mètode | Ruta | Descripció |
|--------|------|------------|
| `GET` | `/settings/whisper-presets` | Retorna els presets de l'usuari en sessió. Retorna sempre `{}` si no en té — mai `null` ni `undefined`. |
| `POST` | `/settings/whisper-presets` | Guarda o sobreescriu un preset. Body: `{ name: string, config: WhisperConfig }`. Retorna `200` (`@HttpCode(200)`) — és un upsert, no un create pur. |
| `DELETE` | `/settings/whisper-presets/:name` | Elimina un preset de l'usuari |

---

## 5. Backend: `projects` module

### 5.1 LNK automàtic al crear projecte

Els mètodes `createProject` i `createProjectFromExisting` del `ProjectsService` creen un LNK dins la carpeta del projecte com a pas final del flux.

**Nota per a `createProject`**: aquest mètode no fetcheja `mediaDoc` en el codi actual. Caldrà afegir `const mediaDoc = await this.library.getDocument(ownerId, mediaDocumentId)` al principi per obtenir el nom del fitxer per al LNK (i per validar que existeix).

Pseudocodi (al final de cada mètode, after `projectModel.create`):

```typescript
// Crea LNK del media dins la carpeta del projecte
await this.library.createMediaRef(ownerId, {
  parentId: folder.id,
  targetDocumentId: mediaDocumentId,
  name: mediaDoc.name,  // nom del fitxer original de media
});
```

On `createMediaRef` és el mecanisme LNK existent a `library.service`. **L'implementador ha de verificar la signatura exacta de `createMediaRef` abans d'usar-la** — el pseudocodi anterior és orientatiu.

Si ja existís un LNK del mateix `targetDocumentId` dins la mateixa carpeta, no crear-ne un de duplicat (guarda d'idempotència).

**Comportament si `createMediaRef` falla**: no fer rollback del projecte — la creació del LNK és **non-fatal**. Registrar l'error amb `console.warn` i continuar. El projecte queda creat correctament; el LNK es pot crear manualment si cal.

### 5.2 DTO estès: `CreateProjectFromExistingDto`

```typescript
export class CreateProjectFromExistingDto {
  name: string;
  mediaDocumentId: string;
  settings?: Record<string, any>;

  // Flux A: SRT de plataforma (nou)
  sourceSrtDocumentId?: string;
  deleteOriginalSrt?: boolean;

  // Flux B: SRT extern (existent, retrocompatible)
  srtText?: string;
}
```

Notes sobre el DTO:
- `deleteOriginalSrt` default implícit: `false` — el service ha de tractar `undefined` com `false`. **Mai esborrar per omissió.**

Validació al service:
- Exactament un dels dos (`sourceSrtDocumentId` o `srtText`) ha d'estar present → `BadRequestException` si cap o tots dos
- Si arriben els dos simultàniament: `sourceSrtDocumentId` té prioritat i `srtText` s'ignora (comportament defensiu)

### 5.3 Lògica `createProjectFromExisting` amb `sourceSrtDocumentId`

```
1. Validar media existeix
2. Si sourceSrtDocumentId:
   a. Llegir el document SRT font (getDocument) → validar que existeix i no està esborrat
   b. Extreure el text: el contingut SRT viu a doc.contentByLang._unassigned (o la primera clau disponible)
   c. srtText = contingut extret
3. Crear carpeta del projecte
4. Crear document SRT dins la carpeta amb srtText
5. Crear projecte (status: 'ready')
6. Crear LNK del media dins la carpeta (Secció 5.1)
7. Si sourceSrtDocumentId && deleteOriginalSrt === true:
   a. Soft-delete del document SRT original
```

---

## 6. `api.ts`: canvis de contracte

```typescript
// Nou: presets Whisper
saveWhisperPreset(name: string, config: WhisperConfig): Promise<void>
getWhisperPresets(): Promise<Record<string, WhisperConfig>>
deleteWhisperPreset(name: string): Promise<void>

// Estès: createProjectFromExisting admet els dos fluxos
createProjectFromExisting(dto: {
  name: string;
  mediaDocumentId: string;
  settings?: any;
  srtText?: string;              // flux extern (ja existent)
  sourceSrtDocumentId?: string;  // flux plataforma (nou)
  deleteOriginalSrt?: boolean;
}): Promise<any>
```

---

## 7. Fora d'abast d'aquesta iteració

- Diarització avançada (ja existent, no es toca)
- Corrector de transcripció (mòdul separat)
- Organització visual dins de Media
- Edició de presets de fàbrica (VE, VCAT) per part de l'admin

---

## 8. Resum de fitxers a modificar/crear

| Fitxer | Tipus de canvi |
|--------|---------------|
| `frontend/components/Projects/CreateProjectModal.tsx` | Redisseny complet |
| `frontend/services/api.ts` | Afegir 3 mètodes de presets + estendre `createProjectFromExisting` |
| `frontend/appTypes.ts` | Afegir tipus `WhisperConfig` si no existeix |
| `backend_nest_mvp/src/modules/settings/user-settings.schema.ts` | **Nou** |
| `backend_nest_mvp/src/modules/settings/user-settings.service.ts` | **Nou** |
| `backend_nest_mvp/src/modules/settings/settings.controller.ts` | Afegir 3 endpoints whisper-presets |
| `backend_nest_mvp/src/modules/settings/settings.module.ts` | Registrar nou schema i service |
| `backend_nest_mvp/src/modules/projects/projects.service.ts` | LNK auto + lògica `sourceSrtDocumentId` |
| `backend_nest_mvp/src/modules/projects/dto/create-project-from-existing.dto.ts` | Estendre DTO |
