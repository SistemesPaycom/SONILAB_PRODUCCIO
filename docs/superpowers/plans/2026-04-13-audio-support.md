# Audio Support (MP3 / WAV) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tratar archivos MP3 y WAV como ciudadanos de primera clase — importables desde la biblioteca, reproducibles en el editor con un placeholder "no video" en lugar de imagen.

**Architecture:** Se añade una constante `AUDIO_ONLY_EXTS` autoritativa en `constants.ts` y un componente overlay `AudioOnlyPlaceholder` reutilizable. El player detecta audio-only vía prop `isAudioOnly` calculada en las dos vistas que lo usan (`MediaPreviewView`, `VideoEditorView`). Los tres puntos de entrada de archivos (ImportModal de biblioteca, modal interno del editor, CreateProjectModal) se actualizan para aceptar los MIME types de audio y corregir sus textos.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vite

---

## Mapa de archivos

| Archivo | Acción |
|---------|--------|
| `frontend/constants.ts` | Modificar — añadir `AUDIO_ONLY_EXTS` e `isAudioOnly` |
| `frontend/components/VideoEditor/AudioOnlyPlaceholder.tsx` | Crear |
| `frontend/components/VideoEditor/VideoPlayer.tsx` | Modificar — prop + overlay |
| `frontend/components/VideoEditor/VideoPlaybackArea.tsx` | Modificar — pass-through de prop |
| `frontend/components/VideoEditor/MediaPreviewView.tsx` | Modificar — calcular y pasar `isAudioOnly` |
| `frontend/components/VideoEditor/VideoEditorView.tsx` | Modificar — calcular y pasar `isAudioOnly` + fix accept/textos |
| `frontend/components/Library/SonilabLibraryView.tsx` | Modificar — añadir `.mp3` al accept |
| `frontend/components/Projects/CreateProjectModal.tsx` | Modificar — corregir etiqueta |

---

## Task 1: Añadir `AUDIO_ONLY_EXTS` e `isAudioOnly` a `constants.ts`

**Files:**
- Modify: `frontend/constants.ts`

- [ ] **Step 1: Abrir `frontend/constants.ts` y añadir las dos exportaciones al final del archivo, antes del cierre**

Añadir justo después de `export const DEFAULT_SHORTCUTS = { ... };` (última línea actual):

```ts
export const AUDIO_ONLY_EXTS = ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'];

export const isAudioOnly = (sourceType?: string | null): boolean =>
  AUDIO_ONLY_EXTS.includes((sourceType ?? '').toLowerCase());
```

- [ ] **Step 2: Verificar que TypeScript compila sin errores**

Ejecutar desde `frontend/`:
```bash
npx tsc --noEmit
```
Resultado esperado: sin errores (o solo los pre-existentes, si los hay).

- [ ] **Step 3: Commit**

```bash
git add frontend/constants.ts
git commit -m "feat: add AUDIO_ONLY_EXTS and isAudioOnly to constants"
```

---

## Task 2: Crear `AudioOnlyPlaceholder.tsx`

**Files:**
- Create: `frontend/components/VideoEditor/AudioOnlyPlaceholder.tsx`

- [ ] **Step 1: Crear el archivo con el componente overlay**

```tsx
import React from 'react';

/**
 * Overlay absolut que indica que el media no té pista de vídeo.
 * S'ha de col·locar dins d'un contenidor amb `position: relative`.
 */
export const AudioOnlyPlaceholder: React.FC = () => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
    <span
      className="text-xs font-medium tracking-widest uppercase select-none"
      style={{ color: 'rgba(255,255,255,0.18)' }}
    >
      no video
    </span>
  </div>
);
```

- [ ] **Step 2: Verificar compilación**

```bash
npx tsc --noEmit
```
Resultado esperado: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/VideoEditor/AudioOnlyPlaceholder.tsx
git commit -m "feat: add AudioOnlyPlaceholder component"
```

---

## Task 3: Actualizar `VideoPlayer.tsx` — prop + overlay

**Files:**
- Modify: `frontend/components/VideoEditor/VideoPlayer.tsx`

Contexto: la interface `VideoPlayerProps` está en torno a la línea 39. La desestructuración del componente empieza en la línea ~140. El bloque de render con `<video>` está a partir de la línea ~208.

- [ ] **Step 1: Añadir `isAudioOnly` a la interface `VideoPlayerProps`**

Localizar la interface `VideoPlayerProps`. Añadir la prop opcional antes de `isFloating?`:

```ts
// Antes:
isFloating?: boolean;
onToggleFloating?: () => void;

// Después:
isAudioOnly?: boolean;
isFloating?: boolean;
onToggleFloating?: () => void;
```

- [ ] **Step 2: Añadir `isAudioOnly` a la desestructuración del componente**

Localizar `const VideoPlayer: React.FC<VideoPlayerProps> = ({`. Añadir `isAudioOnly = false,` antes de `isFloating = false,`:

```tsx
// Antes:
  isFloating = false,
  onToggleFloating,
}) => {

// Después:
  isAudioOnly = false,
  isFloating = false,
  onToggleFloating,
}) => {
```

- [ ] **Step 3: Importar `AudioOnlyPlaceholder`**

Añadir al bloque de imports, junto a `LoadingOverlay`:

```tsx
import { AudioOnlyPlaceholder } from './AudioOnlyPlaceholder';
```

- [ ] **Step 4: Añadir el overlay en el render**

Localizar el bloque dentro del return que contiene `<video ... />` y `{isVideoLoading && <LoadingOverlay />}`. Añadir el overlay inmediatamente después de `<LoadingOverlay />`:

```tsx
      <video
        ref={videoRef}
        src={src}
        onTimeUpdate={(e) => handleTimeUpdateWithSave(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => { if (e.currentTarget.duration > 0) onDurationChange(e.currentTarget.duration); }}
        onDurationChange={(e) => { if (e.currentTarget.duration > 0) onDurationChange(e.currentTarget.duration); }}
        onCanPlay={() => setIsVideoLoading(false)}
        onError={() => setIsVideoLoading(false)}
        onPlay={onPlay}
        onPause={onPause}
        className="w-full h-full object-contain pointer-events-none"
      />
      {isVideoLoading && <LoadingOverlay />}
      {isAudioOnly && <AudioOnlyPlaceholder />}
```

- [ ] **Step 5: Verificar compilación**

```bash
npx tsc --noEmit
```
Resultado esperado: sin errores nuevos.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/VideoEditor/VideoPlayer.tsx
git commit -m "feat: VideoPlayer renders AudioOnlyPlaceholder when isAudioOnly"
```

---

## Task 4: Actualizar `VideoPlaybackArea.tsx` — pass-through de prop

**Files:**
- Modify: `frontend/components/VideoEditor/VideoPlaybackArea.tsx`

Contexto: `VideoPlaybackArea` extiende sus props con `{...props}` a `VideoPlayer`, por lo que basta con añadir la prop a su interface. No hay cambios en el JSX.

- [ ] **Step 1: Añadir `isAudioOnly` a `VideoPlaybackAreaProps`**

Localizar la interface `VideoPlaybackAreaProps`. Añadir antes de `onSegmentUpdate?`:

```ts
// Antes:
  // Waveform-passthrough props (unused here, live at bottom waveform)
  onSegmentUpdate?: (id: Id, newStart: number, newEnd: number) => void;

// Después:
  isAudioOnly?: boolean;
  // Waveform-passthrough props (unused here, live at bottom waveform)
  onSegmentUpdate?: (id: Id, newStart: number, newEnd: number) => void;
```

- [ ] **Step 2: Verificar compilación**

```bash
npx tsc --noEmit
```
Resultado esperado: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/VideoEditor/VideoPlaybackArea.tsx
git commit -m "feat: VideoPlaybackArea passes isAudioOnly to VideoPlayer"
```

---

## Task 5: Actualizar `MediaPreviewView.tsx` — calcular y pasar `isAudioOnly`

**Files:**
- Modify: `frontend/components/VideoEditor/MediaPreviewView.tsx`

Contexto: `playerProps` se construye alrededor de la línea 71. El componente recibe `currentDoc: Document` que contiene `sourceType`.

- [ ] **Step 1: Añadir import de `isAudioOnly`**

Localizar la línea que importa desde `'../../constants'` (actualmente no existe; añadir nuevo import):

```tsx
import { isAudioOnly } from '../../constants';
```

Si ya hay un import desde `'../../constants'`, añadir `isAudioOnly` al mismo import.

- [ ] **Step 2: Añadir `isAudioOnly` a `playerProps`**

Localizar el objeto `playerProps`. Añadir la propiedad `isAudioOnly` usando `currentDoc.sourceType`:

```tsx
const playerProps = {
    isPlaying,
    currentTime,
    duration,
    onSeek,
    videoRef,
    src: videoSrc,
    segments: [],
    activeSegment: null,
    overlayConfig: { 
        original: { show: false, position: 'top' as const, offsetPx: 0, fontScale: 1 }, 
        translated: { show: false, position: 'bottom' as const, offsetPx: 0, fontScale: 1 } 
    },
    onTimeUpdate: setCurrentTime,
    onDurationChange: setDuration,
    onPlay: () => setIsPlaying(true),
    onPause: () => setIsPlaying(false),
    onTogglePlay,
    onJumpSegment: () => {},
    videoFile: videoFile,
    autoScroll: autoScrollWave,
    scrollMode: scrollModeWave,
    isAudioOnly: isAudioOnly(currentDoc.sourceType),
};
```

- [ ] **Step 3: Verificar compilación**

```bash
npx tsc --noEmit
```
Resultado esperado: sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/VideoEditor/MediaPreviewView.tsx
git commit -m "feat: MediaPreviewView passes isAudioOnly to player"
```

---

## Task 6: Actualizar `VideoEditorView.tsx` — prop + fix accept/textos

**Files:**
- Modify: `frontend/components/VideoEditor/VideoEditorView.tsx`

Contexto: `playerProps` se construye en la línea 202. El `ImportFilesModal` está en la línea 238.

- [ ] **Step 1: Añadir import de `isAudioOnly`**

Localizar la línea que importa desde `'../../constants'`:
```tsx
import { ... LOCAL_STORAGE_KEYS } from '../../constants';
```
Añadir `isAudioOnly` al mismo import:
```tsx
import { LOCAL_STORAGE_KEYS, isAudioOnly } from '../../constants';
```

- [ ] **Step 2: Añadir `isAudioOnly` a `playerProps`**

Localizar el objeto `playerProps` (línea ~202). Añadir la propiedad al final del objeto:

```tsx
const playerProps = {
    isPlaying, currentTime, duration, onSeek, videoRef, src: videoSrc, segments: [], activeSegment: null,
    overlayConfig: { original: { show: false, position: 'top' as const, offsetPx: 10, fontScale: 1 }, translated: { show: false, position: 'bottom' as const, offsetPx: 10, fontScale: 1 } },
    onTimeUpdate: setCurrentTime, onDurationChange: setDuration, onPlay: () => setIsPlaying(true), onPause: () => setIsPlaying(false), onTogglePlay, onJumpSegment, videoFile,
    isAudioOnly: isAudioOnly(currentDoc.sourceType),
};
```

- [ ] **Step 3: Actualizar el `ImportFilesModal` interno (línea ~238)**

Localizar:
```tsx
<ImportFilesModal isOpen={isVideoImportModalOpen} onClose={() => setVideoImportModalOpen(false)} onFilesSelect={(files) => files.length > 0 && handleVideoFileChange(files[0])} accept="video/mp4,video/webm,video/ogg,video/quicktime" title="Importar Vídeo" description="Arrossega un arxiu de vídeo per a la sincronització." />
```

Reemplazar por:
```tsx
<ImportFilesModal isOpen={isVideoImportModalOpen} onClose={() => setVideoImportModalOpen(false)} onFilesSelect={(files) => files.length > 0 && handleVideoFileChange(files[0])} accept="video/mp4,video/webm,video/ogg,video/quicktime,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/flac,audio/ogg" title="Importar Vídeo/Audio" description="Arrossega un arxiu de vídeo/audio per a la sincronització." />
```

- [ ] **Step 4: Verificar compilación**

```bash
npx tsc --noEmit
```
Resultado esperado: sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/VideoEditor/VideoEditorView.tsx
git commit -m "feat: VideoEditorView passes isAudioOnly + accepts audio in import modal"
```

---

## Task 7: Añadir `.mp3` al accept de `SonilabLibraryView.tsx`

**Files:**
- Modify: `frontend/components/Library/SonilabLibraryView.tsx`

Contexto: línea 1186.

- [ ] **Step 1: Localizar y editar la línea con el `ImportFilesModal`**

Localizar:
```tsx
accept=".pdf,.docx,.srt,.mp4,.wav,.mov,.webm,.ogg"
```

Reemplazar por:
```tsx
accept=".pdf,.docx,.srt,.mp4,.mp3,.wav,.mov,.webm,.ogg"
```

- [ ] **Step 2: Verificar compilación**

```bash
npx tsc --noEmit
```
Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/Library/SonilabLibraryView.tsx
git commit -m "fix: add .mp3 to library import accept string"
```

---

## Task 8: Corregir etiqueta en `CreateProjectModal.tsx`

**Files:**
- Modify: `frontend/components/Projects/CreateProjectModal.tsx`

Contexto: línea 380.

- [ ] **Step 1: Localizar y editar el texto**

Localizar:
```tsx
Subir nuevo vídeo
```

Reemplazar por:
```tsx
Subir vídeo/audio
```

- [ ] **Step 2: Verificar compilación**

```bash
npx tsc --noEmit
```
Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/Projects/CreateProjectModal.tsx
git commit -m "fix: update CreateProjectModal label to include audio"
```

---

## Verificación final

- [ ] **Arrancar el servidor de desarrollo**

```bash
cd frontend && npm run dev
```

- [ ] **Verificar flujo de audio en la biblioteca:**
  1. Abrir pestaña Media → botón Importar
  2. El selector de archivos debe mostrar ficheros `.mp3` (antes no los mostraba)
  3. Subir un `.mp3` o `.wav` → debe aparecer en Media con icono 🔊

- [ ] **Verificar placeholder "no video" en MediaPreviewView:**
  1. Hacer doble clic sobre el asset de audio en la pestaña Media
  2. La vista de preview debe mostrar el área de vídeo en negro con el texto "no video" en gris muy sutil
  3. La waveform debe seguir funcionando

- [ ] **Verificar placeholder en VideoEditorView:**
  1. Abrir un proyecto que tenga un asset de audio
  2. El área de vídeo muestra "no video" en lugar de imagen
  3. El botón "Importar Vídeo/Audio" del editor acepta archivos `.mp3` y `.wav`

- [ ] **Verificar no regresión con vídeo:**
  1. Abrir un proyecto con un `.mp4`
  2. El vídeo se muestra con normalidad — sin overlay "no video"

- [ ] **Verificar CreateProjectModal:**
  1. Abrir "Crear Projecte" → la opción de subida muestra "Subir vídeo/audio"
