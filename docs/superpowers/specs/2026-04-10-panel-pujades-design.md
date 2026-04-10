# Disseny: Panel de Pujades

**Data:** 2026-04-10  
**Estat:** Aprovat

---

## Problema

El widget actual de pujada (`fixed bottom-4 left-4`) té tres problemes:
1. Tapa botons i components de la interfície
2. No té botó de tancar
3. Es queda bloquejat al 100% quan `setUploadProgress(null)` no s'executa al bloc `catch` de `handleSingleFileUpload` (bug confirmat a la línia 345-348 de `SonilabLibraryView.tsx`)

A més, la pujada des de `CreateProjectModal.tsx` (línia 300) no té cap callback de progrés — les pujades de creació de projecte eren completament invisibles.

---

## Solució triada: UploadContext + PujadesPanel (Opció B)

Un context lleuger proveït a nivell d'`App.tsx` perquè les pujades puguin ser visibles des de qualsevol vista de l'app, independentment d'on s'originin.

---

## Arquitectura

### Flux de dades

```
UploadProvider (App.tsx)
  ├── LibraryView → useUploadContext() → addJob / updateJob / completeJob
  │     └── CreateProjectModal → useUploadContext() → addJob / updateJob / completeJob
  └── App.tsx → useUploadContext().jobs → <PujadesPanel />
```

### Tipus

```ts
// context/Upload/UploadContext.tsx
interface UploadJob {
  id: string;          // nanoid generat just abans d'iniciar la pujada
  name: string;        // nom original de l'arxiu
  pct: number;         // 0–100
  status: 'uploading' | 'done' | 'error';
  error?: string;
  startedAt: string;   // ISO timestamp
  finishedAt?: string; // ISO timestamp quan acaba
}

interface UploadContextValue {
  jobs: UploadJob[];
  addJob: (id: string, name: string) => void;
  updateJob: (id: string, pct: number) => void;
  completeJob: (id: string, success: boolean, error?: string) => void;
}
```

Totes les actualitzacions d'estat usen la forma funcional `setJobs(prev => ...)` per evitar el stale-closure bug en callbacks asíncrons de XHR.

---

## Fitxers afectats

| Fitxer | Acció | Descripció |
|--------|-------|------------|
| `frontend/context/Upload/UploadContext.tsx` | Crear | Context + Provider + hook `useUploadContext` |
| `frontend/components/Pujades/PujadesPanel.tsx` | Crear | Panel modal idèntic visualment a `TasksIAPanel` |
| `frontend/App.tsx` | Modificar | Afegir `UploadProvider`, `isPujadesOpen`, `<PujadesPanel>`, prop `onOpenPujades` |
| `frontend/components/Library/SonilabLibraryView.tsx` | Modificar | Context + fix bug + botó + eliminar widget |
| `frontend/components/Projects/CreateProjectModal.tsx` | Modificar | Context + progress callback |

---

## UploadContext

**Fitxer:** `frontend/context/Upload/UploadContext.tsx`

- `UploadProvider`: wraps children, gestiona `useState<UploadJob[]>([])`
- `useUploadContext()`: hook que llança error si usat fora del provider
- `addJob(id, name)`: afegeix un job nou amb `status: 'uploading'`, `pct: 0`, `startedAt: now`
- `updateJob(id, pct)`: actualitza el percentatge amb `setJobs(prev => prev.map(...))`
- `completeJob(id, success, error?)`: canvia `status` a `'done'` o `'error'`, posa `finishedAt`

---

## PujadesPanel

**Fitxer:** `frontend/components/Pujades/PujadesPanel.tsx`

Estructura visual idèntica a `TasksIAPanel.tsx`:

- Overlay: `fixed inset-0 bg-black/70 backdrop-blur-sm z-[500]`
- Caixa: `bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh]`
- Header: icona Upload + títol "Pujades" + botó `×`
- Dues pestanyes:
  - **"En curs"** — jobs amb `status === 'uploading'`, amb barra de progrés animada
  - **"Historial"** — jobs `done` o `error`, amb estat i timestamp
- Badge d'estat per job: uploading (accent/pulse), done (emerald), error (red)
- Footer: `"X pujant / Y completats"`
- Rep dades via `useUploadContext()` — sense props d'estat

**Props:**
```ts
interface PujadesPanelProps {
  onClose: () => void;
}
```

---

## Canvis a App.tsx

1. Importar `UploadProvider` i `PujadesPanel`
2. Embolcallar el contingut principal amb `<UploadProvider>`
3. Afegir `const [isPujadesOpen, setIsPujadesOpen] = useState(false)`
4. Renderitzar `{isPujadesOpen && <PujadesPanel onClose={() => setIsPujadesOpen(false)} />}` al costat de `TasksIAPanel`
5. Passar `onOpenPujades={() => setIsPujadesOpen(true)}` a `LibraryView`

---

## Canvis a SonilabLibraryView.tsx

1. Afegir `onOpenPujades: () => void` a `LibraryViewProps`
2. Eliminar `const [uploadProgress, setUploadProgress] = useState<...>(null)`
3. Consumir `useUploadContext()` → `{ addJob, updateJob, completeJob }`
4. A `handleSingleFileUpload`:
   - Generar `const jobId = nanoid()` abans de la pujada
   - Cridar `addJob(jobId, file.name)`
   - Callback de progrés: `(pct) => updateJob(jobId, pct)`
   - Al finalitzar OK: `completeJob(jobId, true)`
   - Al bloc `catch`: `completeJob(jobId, false, err.message)` ← **fix del bug de bloqueig**
5. Mateixa adaptació a `handleContinueUpload`
6. Eliminar el `<div className="fixed bottom-4 left-4 z-[600]...">` del widget de progrés
7. Afegir botó "Pujades" al sidebar just sota "Tasques IA":
   - Mateixa estructura visual que el botó "Tasques IA"
   - Icona: `Icons.Upload` (o similar disponible)
   - Badge: compte de jobs amb `status === 'uploading'`
   - `onClick={onOpenPujades}`

---

## Canvis a CreateProjectModal.tsx

A `handleUploadNewMedia`:
1. Consumir `useUploadContext()`
2. Generar `const jobId = nanoid()` abans de `api.uploadMedia`
3. Cridar `addJob(jobId, file.name)`
4. Afegir `onProgress: (pct) => updateJob(jobId, pct)` com a segon argument de `api.uploadMedia`
5. Al finalitzar OK: `completeJob(jobId, true)`
6. Al bloc `catch`: `completeJob(jobId, false, e?.message)`

---

## Correccions de bugs incloses

| Bug | Localització | Fix |
|-----|-------------|-----|
| Bloqueig al 100% | `handleSingleFileUpload` catch (línia ~345) | Cridar `completeJob(id, false)` al catch |
| Stale closure en uploads múltiples | Tots els `setUploadProgress` | Usat `setJobs(prev => ...)` a tot el context |
| Pujades de CreateProjectModal invisibles | `handleUploadNewMedia` (línia 300) | Afegir progress callback + context |

---

## No inclòs en aquest disseny

- Persistència de l'historial entre recàrregues (localStorage) — no requerit
- Cancel·lació d'una pujada en curs — no requerit
- Límit de jobs a l'historial — YAGNI
