# Dominio: Timeline y Waveform

## Qué es este dominio

Timeline y waveform son las superficies de edición basadas en tiempo del editor de subtítulos con vídeo. Dependen de que la relación entre media, subtítulos y tiempo se mantenga coherente. Son módulos sensibles — no tocar como efecto lateral de cambios en biblioteca.

## Componentes involucrados

| Archivo | Rol |
|---------|-----|
| `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` | Componente principal: gestiona `currentTime`, throttling, sincronización tiempo↔segmento, importa WaveformTimeline |
| `frontend/components/VideoEditor/WaveformTimeline` | Componente de waveform + timeline de segmentos |

## TimelineViewMode

```ts
// frontend/types.ts
export type TimelineViewMode = 'waveform' | 'segments' | 'both' | 'hidden';
```

Controla qué muestra la zona de timeline en el editor. El usuario puede cambiar este modo.

## Gestión del tiempo (currentTime)

```ts
// VideoSubtitlesEditorView.tsx
const [currentTime, setCurrentTime] = useState(0);  // state para renders
const currentTimeRef = useRef(0);                    // ref para lógica a 60fps
```

**Por qué dos:** el state causa rerenders React (costoso a 60fps). El ref se actualiza en cada frame del `timeupdate` del video; la lógica de sincronización usa el ref. El state se actualiza de forma throttled (~5fps) para los renders que sí lo necesitan.

No colapsar `currentTimeRef` y `currentTime` en uno solo — rompe rendimiento.

## Sincronización externa por postMessage

`VideoSubtitlesEditorView.tsx` escucha y emite mensajes `postMessage` para sincronización con el editor de guion externo:

```ts
// Escucha mensajes de seek desde el guion
if (msg.type === 'seek' && msg.source === 'script-external' && typeof msg.currentTime === 'number') {
  videoRef.current.currentTime = msg.currentTime;
  currentTimeRef.current = msg.currentTime;
  setCurrentTime(msg.currentTime);
}

// Emite time-sync throttled al guion
// tipo: 'time-sync', payload: { currentTime }
```

No romper este canal — es la forma en que el editor de guion y el editor de subtítulos se coordinan en tiempo real.

## syncRequest (sincronización de media desde biblioteca)

```ts
// LibraryDataContext dispatch
dispatch({ type: 'TRIGGER_SYNC_REQUEST', payload: { docId: mediaId, type: 'media' } });
```

Cuando el editor de subtítulos cambia de media vinculada, se dispara un `TRIGGER_SYNC_REQUEST` hacia el contexto de biblioteca para mantener coherencia entre el editor y la biblioteca.

Ver `App.tsx` para el useEffect que escucha `syncRequest` y lanza el handler.

## Qué hacer si se toca este dominio

- **Se modifica la lógica de currentTime** → no eliminar el throttle; no sustituir `currentTimeRef` por state sin medir impacto de rendimiento.
- **Se toca WaveformTimeline** → verificar que la selección de segmentos al clicar en el waveform sigue funcionando; verificar que el playhead es coherente con `currentTime`.
- **Se modifica el canal postMessage** → mantener retrocompatibilidad con el formato `{ type, source, currentTime }`; verificar que el editor de guion sigue recibiendo actualizaciones.
- **Se toca syncRequest** → ver `App.tsx` useEffect que lo consume; no romper la sincronización de media entre editor y biblioteca.
- **Se añade un nuevo modo de timeline** → añadir a `TimelineViewMode` en `types.ts`; verificar que el componente WaveformTimeline lo renderiza correctamente.

## No romper

- Throttle de currentTime (60fps → ~5fps para renders)
- `currentTimeRef` síncrono para lógica de sincronización
- Canal postMessage con el editor de guion
- syncRequest hacia LibraryDataContext
- Segmento activo auto-seleccionado al reproducir
