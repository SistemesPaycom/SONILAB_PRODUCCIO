# Dominio: Editor de subtítulos

## Qué es este dominio

El editor de subtítulos es uno de los módulos más sensibles de la app. Involucra sincronización entre vídeo, waveform, lista de segmentos y posicionamiento de caret. Un cambio aquí puede romper la edición en tiempo real.

## Modelo de segmento

```ts
// frontend/types.ts
export interface Segment {
  id: number;
  startTime: number;       // en segundos (float)
  endTime: number;         // en segundos (float)
  originalText: string;
  translatedText?: string;
  richText?: string;
  status?: 'ok' | 'warning' | 'error';
  hasDiff?: boolean;
}
```

`startTime` y `endTime` son siempre en **segundos**, no en milisegundos.

## Modos de apertura del editor de subtítulos

Controlado por `OpenMode` en `frontend/types.ts`:

| OpenMode | Componente renderizado | Cuándo |
|----------|----------------------|--------|
| `'editor-video-subs'` | `VideoSubtitlesEditorView` | SRT vinculado a media con vídeo |
| `'editor-srt-standalone'` | `VideoSrtStandaloneEditorView` | SRT sin media o preferencia standalone |

La preferencia del usuario se persiste en `LOCAL_STORAGE_KEYS.SRT_EDITOR_MODE`.

## SubtitleEditorContext

```ts
// frontend/context/SubtitleEditorContext.tsx
```

Contexto ligero que provee **refs** síncronas (no estado React) para coordinar entre componentes sin causar rerenders:

- `caretHintRef` — posición de caret para split de segmento
- `splitPayloadRef` — payload pendiente de split

Se usa así porque los `useLayoutEffect` de `SegmentItem.tsx` necesitan acceso síncrono a estos valores. No añadir estado React aquí — si se necesita rerender, usar state en el componente padre.

## Componentes del editor

| Archivo | Rol |
|---------|-----|
| `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` | Componente principal: vídeo + waveform + editor de segmentos. Gestiona `currentTime`, throttling, sincronización tiempo↔segmento activo |
| `frontend/components/VideoSubtitlesEditor/SubtitlesEditor.tsx` | Lista de segmentos; maneja acciones de edición (split, merge, delete, navigate) |
| `frontend/components/VideoSubtitlesEditor/SegmentItem.tsx` | Fila de un segmento; usa `useLayoutEffect` para posicionamiento de caret síncrono |
| `frontend/components/VideoSubtitlesEditor/VideoSrtStandaloneEditorView.tsx` | Editor standalone (sin media/vídeo) |
| `frontend/components/VideoEditor/WaveformTimeline` | Componente de waveform/timeline, importado por `VideoSubtitlesEditorView` |

## Sincronización tiempo↔segmento activo

`VideoSubtitlesEditorView.tsx` mantiene:
- `currentTime` (state) — para renders que dependen del tiempo
- `currentTimeRef` (ref) — actualizado a 60fps; las funciones de sincronización usan el ref para evitar rerenders innecesarios

El segmento activo se determina comparando `currentTime` con `startTime`/`endTime` de cada segmento. Ver el hook de throttle en `VideoSubtitlesEditorView.tsx`.

## TimelineViewMode

```ts
// frontend/types.ts
export type TimelineViewMode = 'waveform' | 'segments' | 'both' | 'hidden';
```

Controla qué muestra la zona inferior del editor (waveform, lista de segmentos en miniatura, ambos, o nada).

## Qué hacer si se toca este dominio

- **Se modifica `Segment`** → verificar SubtitlesEditor, SegmentItem, y toda lógica que lee `startTime`/`endTime` (sincronización de tiempo, export a SRT).
- **Se modifica `SubtitleEditorContext`** → recordar que son refs, no state. No convertir a state sin considerar el impacto en SegmentItem.
- **Se toca `VideoSubtitlesEditorView`** → no romper el throttle de `currentTime`; no crear dependencias circulares en useEffect; proteger la sincronización tiempo↔segmento activo.
- **Se añade un nuevo modo de editor** → añadir a `OpenMode` en `types.ts`, añadir rama en `App.tsx`, verificar que `SettingsModal.tsx` lo lista si es configurable por usuario.
- Ver también `domain-timeline.md` para la sincronización externa por `postMessage`.

## No romper

- Throttle de currentTime (afecta rendimiento a 60fps)
- Split de segmento al cursor (depende de `caretHintRef` síncrono)
- Segmento activo auto-seleccionado al reproducir
- Edición de texto en SegmentItem sin rerenders globales
