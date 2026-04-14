# Spec: Soporte completo de audio (MP3 / WAV) en Sonilab

**Fecha:** 2026-04-13
**Estado:** Aprobado — pendiente de implementación

---

## Contexto

El backend ya acepta archivos de audio (`mp3`, `wav`, `m4a`, `aac`, `flac`, `ogg`) y genera waveform correctamente (FFmpeg usa `-vn`, lo que funciona para audio puro). Sin embargo, el frontend tiene tres puntos de entrada con restricciones que excluyen parcialmente estos formatos, y el player no tiene tratamiento visual para archivos sin pista de vídeo.

**Objetivo:** tratar los archivos de audio como ciudadanos de primera clase, de la misma manera que VLC reproduce MP3 mostrando la ventana de vídeo en negro.

---

## Lo que ya funciona (no tocar)

- `backend/media.controller.ts` — `allowedExt` y `allowedMime` ya incluyen mp3, wav, m4a, aac, flac, ogg.
- `media-cache.service.ts` — generación de waveform con FFmpeg usa `-vn`; funciona para audio puro.
- `MEDIA_EXTS` en `App.tsx` y `SonilabLibraryView.tsx` — ya incluye mp3/wav.
- `LibraryFileItem.tsx` — ya muestra el icono 🔊 para extensiones de audio.
- Clasificación en pestaña Media — ya reconoce audio por `sourceType`.

---

## Cambios diseñados

### 1. Constante de detección — `frontend/constants.ts`

Añadir junto a las constantes existentes:

```ts
export const AUDIO_ONLY_EXTS = ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'];

export const isAudioOnly = (sourceType?: string | null): boolean =>
  AUDIO_ONLY_EXTS.includes((sourceType ?? '').toLowerCase());
```

Fuente de verdad única. Todo el código que necesite detectar audio-only importa solo esto.

---

### 2. Componente `AudioOnlyPlaceholder`

**Archivo nuevo:** `frontend/components/VideoEditor/AudioOnlyPlaceholder.tsx`

Overlay absoluto sobre el `<video>`. Texto "no video" sutil (opacidad 18%) sobre fondo negro. No intrusivo — comunica el estado sin distraer.

```tsx
import React from 'react';

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

Se muestra cuando: `isAudioOnly === true && src !== null`.
No se muestra cuando: `src === null` (ese caso tiene su propio placeholder "VIDEO" existente).

---

### 3. Cadena de props del player

**Archivos afectados:** `VideoPlayerProps`, `VideoPlaybackAreaProps`, `VideoPlayer.tsx`, `VideoPlaybackArea.tsx`, `MediaPreviewView.tsx`, `VideoEditorView.tsx`

#### `VideoPlayerProps` y `VideoPlaybackAreaProps`
Añadir prop opcional:
```ts
isAudioOnly?: boolean;
```

#### `VideoPlayer.tsx`
Importar `AudioOnlyPlaceholder`. Dentro del bloque que renderiza el `<video>`, añadir el overlay:
```tsx
{isAudioOnly && src && <AudioOnlyPlaceholder />}
```
El elemento `<video>` permanece intacto — sigue gestionando la reproducción de audio de forma nativa.

#### `MediaPreviewView.tsx`
```tsx
import { isAudioOnly } from '../../constants';
// ...
const audioOnly = isAudioOnly(currentDoc.sourceType);
// en playerProps:
isAudioOnly: audioOnly,
```

#### `VideoEditorView.tsx`
Mismo patrón: calcular `isAudioOnly(currentDoc.sourceType)` y pasarlo a `VideoPlaybackArea`.

---

### 4. Correcciones de accept y textos

#### `SonilabLibraryView.tsx` — línea 1186
```
antes:   accept=".pdf,.docx,.srt,.mp4,.wav,.mov,.webm,.ogg"
después: accept=".pdf,.docx,.srt,.mp4,.mp3,.wav,.mov,.webm,.ogg"
```

#### `VideoEditorView.tsx` — línea 238 (ImportFilesModal interno del editor)
```
title:       "Importar Vídeo/Audio"
description: "Arrossega un arxiu de vídeo/audio per a la sincronització."
accept:      "video/mp4,video/webm,video/ogg,video/quicktime,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/flac,audio/ogg"
```

#### `CreateProjectModal.tsx` — línea 380
```
antes:   "Subir nuevo vídeo"
después: "Subir vídeo/audio"
```

---

## Archivos afectados

| Archivo | Tipo de cambio |
|---------|---------------|
| `frontend/constants.ts` | Añadir `AUDIO_ONLY_EXTS` e `isAudioOnly` |
| `frontend/components/VideoEditor/AudioOnlyPlaceholder.tsx` | Archivo nuevo |
| `frontend/components/VideoEditor/VideoPlayer.tsx` | Añadir prop + overlay |
| `frontend/components/VideoEditor/VideoPlaybackArea.tsx` | Pass-through de prop |
| `frontend/components/VideoEditor/MediaPreviewView.tsx` | Calcular y pasar `isAudioOnly` |
| `frontend/components/VideoEditor/VideoEditorView.tsx` | Calcular y pasar `isAudioOnly` + fix accept/textos |
| `frontend/components/Library/SonilabLibraryView.tsx` | Añadir `.mp3` al accept |
| `frontend/components/Projects/CreateProjectModal.tsx` | Cambiar etiqueta |

**Backend:** sin cambios. Ya soporta audio completo.

---

## Fuera de alcance

- Renombrar la prop `videoFile` a `mediaFile` (cambio cosmético sin valor funcional).
- Cambiar el elemento `<video>` por `<audio>` para archivos de audio (el navegador reproduce audio vía `<video>` correctamente; el cambio sería una refactorización mayor sin beneficio visible).
- Soporte de nuevos formatos más allá de los que ya acepta el backend.

---

## No regresión

- El flujo de vídeo existente no cambia: `isAudioOnly` es `false` para mp4/mov/webm, el overlay no aparece.
- El placeholder "VIDEO" cuando `src === null` queda intacto.
- La deduplicación SHA-256 del backend no se toca.
- La pestaña Media, Files y Projectes no se alteran.
