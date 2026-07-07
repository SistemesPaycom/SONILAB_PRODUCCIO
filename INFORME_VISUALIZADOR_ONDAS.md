# Visualizador de ondas de sonido (Waveform) — Informe técnico completo para portabilidad

> **Propósito de este documento:** describir de forma autocontenida TODO el funcionamiento del
> sistema de visualización de ondas de audio de Sonilab, con el nivel de detalle necesario para
> reimplementarlo o importarlo en otro proyecto sin acceso a este repositorio.
>
> Fecha del informe: 2026-06-13. Generado a partir del código real en la rama `ModificacionesMarcMayo2026`.

---

## Índice

1. [Visión general de la arquitectura](#1-visión-general-de-la-arquitectura)
2. [Backend — generación y caché de peaks](#2-backend--generación-y-caché-de-peaks)
3. [Backend — endpoints HTTP](#3-backend--endpoints-http)
4. [Autenticación para `<video>` y streaming](#4-autenticación-para-video-y-streaming)
5. [Frontend — capa de API](#5-frontend--capa-de-api)
6. [Frontend — hook `useWaveformExtractor`](#6-frontend--hook-usewaveformextractor)
7. [Frontend — componente `WaveformTimeline`](#7-frontend--componente-waveformtimeline)
8. [Integración en el editor (cableado de props y gestión del tiempo)](#8-integración-en-el-editor)
9. [Theming (CSS custom properties)](#9-theming-css-custom-properties)
10. [Constantes, tipos y dependencias auxiliares](#10-constantes-tipos-y-dependencias-auxiliares)
11. [Invariantes de rendimiento — qué NO romper](#11-invariantes-de-rendimiento--qué-no-romper)
12. [Checklist para portar a otro proyecto](#12-checklist-para-portar-a-otro-proyecto)

---

## 1. Visión general de la arquitectura

El sistema tiene **dos mitades** claramente separadas:

```
┌─────────────────────────────  BACKEND (NestJS)  ─────────────────────────────┐
│                                                                               │
│  POST /media/upload ──► SHA-256 ──► ensureWaveformCache() (fire-and-forget)  │
│                                          │                                    │
│                                          ▼                                    │
│                          FFmpeg: audio mono f32le @ 8 kHz                     │
│                                          │                                    │
│                                          ▼                                    │
│                          Cálculo de peaks (100 peaks/segundo, máx abs)        │
│                                          │                                    │
│                                          ▼                                    │
│                {CACHE_ROOT}/waveform/{sha256}.wfcache  (binario, ~1.4MB/hora) │
│                                                                               │
│  GET /media/:docId/waveform ──► cache HIT → JSON <100ms                       │
│                                 cache MISS → genera ahora (5-30s) → JSON      │
│                                                                               │
│  GET /media/:docId/stream ──► HTTP Range requests (206) para <video>/<audio>  │
└───────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────  FRONTEND (React)  ─────────────────────────────┐
│                                                                               │
│  useWaveformExtractor (hook)                                                  │
│    Estrategia 1: GET /media/:id/waveform (con 2 reintentos × 2s)              │
│    Estrategia 2 (fallback): Web Audio API decodificando el File local         │
│         │                                                                     │
│         ▼  peaks: Float32Array                                                │
│                                                                               │
│  WaveformTimeline (componente)                                                │
│    • Canvas del tamaño del viewport (NO del audio completo)                   │
│    • Redibuja la porción visible en cada scroll                               │
│    • Playhead como elemento DOM movido con transform (no canvas)              │
│    • RAF loop a 60fps durante reproducción                                    │
│    • Segmentos de subtítulos dibujados sobre la onda (drag/resize/click)      │
│    • Zoom 20–500 px/segundo (Ctrl+rueda o slider)                             │
│    • Auto-scroll en 2 modos: stationary (cursor centrado) / page (paginado)   │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Principio de diseño:** mínima latencia. El vídeo arranca en 1-2 s (Range requests, sin
descargar el archivo) y la onda aparece en <100 ms cuando hay caché. La generación de
peaks es responsabilidad del **servidor** (FFmpeg); el cliente solo dibuja. La generación
client-side con Web Audio API existe únicamente como red de seguridad offline.

**Identidad del caché = SHA-256 del archivo**, no el id del documento. Dos usuarios que
suben el mismo archivo comparten el mismo `.wfcache` sin regenerarlo.

---

## 2. Backend — generación y caché de peaks

### Archivo: `backend_nest_mvp/src/modules/media/media-cache.service.ts`

Servicio NestJS inyectable (`MediaCacheService`). Sin dependencias npm más allá de
`@nestjs/common`, `@nestjs/config` y Node estándar (`fs`, `path`, `child_process`, `util`).
**Requiere `ffmpeg` y `ffprobe` en el PATH del servidor.**

### Constantes

```ts
const CACHE_VERSION = 1;
const PEAKS_PER_SECOND = 100;   // resolución temporal de la onda
const MAX_AGE_DAYS = 30;        // lifetime del caché
```

### Ubicación del caché

```
{CACHE_ROOT}/waveform/{sha256}.wfcache
```

`CACHE_ROOT` viene de la variable de entorno homónima (default `./cache`, resuelto
relativo a `process.cwd()` si no es absoluto). El directorio se crea con
`fs.mkdirSync(..., { recursive: true })` en el constructor y de nuevo antes de escribir
(por si fue borrado en caliente).

### Formato binario `.wfcache` (little-endian, header de 24 bytes)

| Offset | Tamaño | Tipo    | Campo            | Valor típico |
|--------|--------|---------|------------------|--------------|
| 0      | 4 B    | uint32  | `version`        | 1            |
| 4      | 4 B    | uint32  | `peaksPerSecond` | 100          |
| 8      | 8 B    | float64 | `duration`       | segundos     |
| 16     | 4 B    | uint32  | `sampleRate`     | sample rate ORIGINAL del audio (de ffprobe), no el de extracción |
| 20     | 4 B    | uint32  | `peakCount`      | ≈ duration × 100 |
| 24+    | 4 B ×N | float32 | `peaks[]`        | amplitud 0.0–1.0 (máximo absoluto por ventana) |

Tamaño: un vídeo de 1 hora → ~360.000 peaks → **~1.4 MB**.

Si se cambia el formato, hay que **bumpear `CACHE_VERSION`**: `readCache()` valida el
uint32 de versión y devuelve `null` si no coincide, lo que fuerza regeneración transparente.

### Pipeline de generación (`generateAndCache(filePath, sha256)`)

**Paso 1 — ffprobe** (metadata, no crítico — si falla se sigue igual):

```
ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate,duration -of json {filePath}
```
Timeout 30 s. Extrae `sample_rate` (default 44100) y `duration` (default 0).

**Paso 2 — FFmpeg extrae PCM crudo a stdout:**

```
ffmpeg -i {filePath} -vn -ac 1 -ar 8000 -f f32le -
```

- `-vn` → descarta vídeo
- `-ac 1` → mezcla a mono
- `-ar 8000` → downsample a 8 kHz (suficiente: a 100 peaks/s salen 80 muestras por peak)
- `-f f32le` → PCM float32 little-endian crudo por stdout

Se ejecuta con `execFile` y `maxBuffer: 500 * 1024 * 1024` (500 MB) para soportar archivos
largos, `encoding: 'buffer'`. Detalle importante del callback: si hay error PERO stdout
tiene datos, se acepta el stdout (FFmpeg a veces sale con código ≠0 tras volcar todo
el audio útil):

```ts
(err, stdout: Buffer) => {
  if (err && !stdout?.length) return reject(err);
  resolve(stdout);
}
```

**Paso 3 — cálculo de peaks en Node:**

```ts
const totalSamples = rawPcm.length / 4;            // float32 = 4 bytes
const actualDuration = totalSamples / 8000;
if (duration === 0) duration = actualDuration;     // fallback si ffprobe falló

const samplesPerPeak = Math.floor(8000 / 100);     // = 80
const peakCount = Math.floor(totalSamples / samplesPerPeak);

for (let i = 0; i < peakCount; i++) {
  let max = 0;
  for (let j = 0; j < samplesPerPeak; j++) {
    const offset = (i * samplesPerPeak + j) * 4;
    if (offset + 4 > rawPcm.length) break;
    const val = Math.abs(rawPcm.readFloatLE(offset));
    if (val > max) max = val;
  }
  peaks[i] = max;   // peak = MÁXIMO ABSOLUTO de la ventana (no RMS)
}
```

**Paso 4 — escritura del binario** con el layout de la tabla anterior (`Buffer.alloc` +
`writeUInt32LE`/`writeDoubleLE`/`writeFloatLE`, luego `fs.writeFileSync`).

### Lectura del caché

- `hasCache(sha256)` — existe y mide ≥24 bytes.
- `readCache(sha256)` — devuelve el `Buffer` o `null` (valida versión).
- `readCacheAsJSON(sha256)` — parsea el header, valida que `buf.length >= 24 + peakCount*4`
  y devuelve `{ version, peaksPerSecond, duration, sampleRate, peakCount, peaks: number[] }`.
  Los peaks se devuelven como array JS normal (serializable a JSON).

### Limpieza

- `cleanOldCaches()` — borra `.wfcache` con `mtime` > 30 días. Devuelve `{deleted, errors}`.
- `isInCleanupWindow()` — `true` entre 21:00 y 05:00 (hora local del servidor).
- El **controller** programa un `setInterval` cada 30 min que llama a la limpieza solo si
  `isInCleanupWindow()`; también un intento único a los 5 s del arranque.

---

## 3. Backend — endpoints HTTP

### Archivo: `backend_nest_mvp/src/modules/media/media.controller.ts`

Controller bajo `@Controller('/media')` con `@UseGuards(JwtAuthGuard)` a nivel de clase
(todos los endpoints requieren JWT).

### `GET /media/:docId/waveform`

```
1. doc = library.getDocument(userId, docId)
2. Si !doc.media?.path → 400 "Document has no media"
3. Si doc.isDeleted    → 404 "Media not found"
4. sha256 = doc.media.sha256; si falta → 400 "Media has no SHA-256 hash"
5. cached = mediaCache.readCacheAsJSON(sha256)
   ├─ HIT  → return { cached: true,  waveform: cached }          (<100 ms)
   └─ MISS → resolver path físico seguro → generateAndCache()    (5-30 s primera vez)
             → releer caché → return { cached: false, waveform }
             (si FFmpeg falla → 400 "Failed to generate waveform. FFmpeg may not be available.")
```

**Forma exacta de la respuesta JSON:**

```json
{
  "cached": true,
  "waveform": {
    "version": 1,
    "peaksPerSecond": 100,
    "duration": 3625.43,
    "sampleRate": 48000,
    "peakCount": 362543,
    "peaks": [0.012, 0.43, 0.81, ...]
  }
}
```

### `GET /media/:docId/stream` (necesario para que la onda tenga vídeo/audio que seguir)

Streaming con **soporte completo de HTTP Range requests**:

- Headers siempre presentes: `Accept-Ranges: bytes`, `Content-Type` (del mime guardado),
  y **`Cross-Origin-Resource-Policy: cross-origin`** — imprescindible si frontend y backend
  corren en orígenes/puertos distintos, porque Helmet pone `same-origin` por defecto y el
  navegador bloquea el `<video>`.
- Sin header `Range` → 200 con `Content-Length` total y stream completo.
- Con `Range: bytes=X-Y` → 206 con `Content-Range: bytes X-Y/Total` y `fs.createReadStream(filePath, {start, end})`.
- Range mal formado o fuera de límites → 416.

### Generación proactiva en upload (`ensureWaveformCache`)

En `POST /media/upload`, tras validar y mover el archivo a su ruta final, se llama:

```ts
private ensureWaveformCache(sha256, mediaRelPath, mediaRootAbs) {
  if (this.mediaCache.hasCache(sha256)) return;        // ya existe → no-op
  const filePath = resolveSafeMediaPath(mediaRootAbs, mediaRelPath);
  if (!fs.existsSync(filePath)) return;                // archivo no está → warn y salir
  // Fire-and-forget: NO se hace await — la respuesta del upload no espera
  this.mediaCache.generateAndCache(filePath, sha256)
    .then(() => log OK)
    .catch((err) => warn);
}
```

Puntos clave:
- Se llama **después** del `fs.renameSync(tmp → final)` — el caché siempre se genera con la ruta definitiva.
- También se llama cuando el upload detecta un **duplicado por SHA-256** (regenera si por lo que sea falta el caché del asset existente).
- Como es fire-and-forget, puede que el editor pida la waveform antes de que termine —
  de ahí los reintentos del hook frontend (sección 6).

### Seguridad de paths (`resolveSafeMediaPath`)

Los paths de media se guardan en POSIX (`/`); esta función los convierte al separador
nativo, los resuelve contra `STORAGE_ROOT` y **rechaza con 400 cualquier path que escape
del root** (anti path-traversal, comparación case-insensitive para Windows).

---

## 4. Autenticación para `<video>` y streaming

El tag `<video>`/`<audio>` no puede enviar headers HTTP custom, así que la `JwtStrategy`
de Passport extrae el token de **dos fuentes**, en este orden:

```ts
// backend_nest_mvp/src/modules/auth/jwt.strategy.ts
jwtFromRequest: ExtractJwt.fromExtractors([
  ExtractJwt.fromAuthHeaderAsBearerToken(),   // todas las llamadas normales (fetch)
  ExtractJwt.fromUrlQueryParameter('token'),  // SOLO para <video src="...?token=...">
]),
```

El frontend construye la URL autenticada con `streamUrlWithToken()` (sección 5).

> ⚠️ El JWT en query string acaba en logs, Referer e historial. Aceptable en intranet;
> para exposición pública migrar a signed URLs de tiempo limitado o cookies httpOnly.

La llamada a `/waveform` se hace por `fetch` normal con header `Authorization: Bearer`,
no necesita el query param.

---

## 5. Frontend — capa de API

### Archivo: `frontend/services/api.ts` (fragmentos relevantes)

```ts
streamUrl(docId: string) {
  return `${API_URL}/media/${docId}/stream`;
},

/** Stream URL con token en query param — para usar directamente en <video src> */
streamUrlWithToken(docId: string): string {
  const token = getToken();
  const base = `${API_URL}/media/${docId}/stream`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
},

/** Fetch cached waveform peaks from backend. Returns null if unavailable. */
async getWaveform(docId: string): Promise<{
  cached: boolean;
  waveform: {
    version: number;
    peaksPerSecond: number;
    duration: number;
    sampleRate: number;
    peakCount: number;
    peaks: number[];
  };
} | null> {
  try {
    return await request(`/media/${docId}/waveform`);
  } catch {
    return null;
  }
},
```

`request()` es el helper genérico de la app (fetch + `Authorization: Bearer` + parseo JSON).
Nota: `getWaveform` **traga errores y devuelve `null`** — el hook decide el fallback.

---

## 6. Frontend — hook `useWaveformExtractor`

### Archivo: `frontend/hooks/useWaveformExtractor.ts` (115 líneas, autocontenido salvo `api`)

```ts
export interface WaveformPeaks {
  data: Float32Array;   // amplitudes 0..1
  length: number;       // peakCount
  duration: number;     // segundos
  sampleRate: number;
}

type ExtractionStatus = 'idle' | 'loading' | 'ready' | 'error';

// API pública:
const { extract, peaks, status } = useWaveformExtractor();
// extract(file: File | null, docId?: string) => Promise<void>
```

### Lógica de `extract(file, docId)`

1. **Deduplicación de extracciones:** se calcula una clave (`docId` o `'local-file'`) y se
   guarda en un ref. Si la clave coincide con la última Y ya hay peaks → return inmediato
   (evita re-extraer cuando el componente re-renderiza con las mismas props).

2. **Estrategia 1 — caché del backend (camino principal):** si hay `docId`:
   - Hasta **3 intentos** (`MAX_RETRIES = 2` reintentos) con **2000 ms de espera** entre ellos.
     Razón: si el archivo se acaba de subir, la generación fire-and-forget puede estar aún
     corriendo en el servidor.
   - Si `api.getWaveform(docId)` devuelve `result?.waveform`:
     ```ts
     setPeaks({
       data: new Float32Array(wf.peaks),   // JSON array → Float32Array
       length: wf.peakCount,
       duration: wf.duration,
       sampleRate: wf.sampleRate,
     });
     setStatus('ready');
     return;
     ```

3. **Estrategia 2 — fallback Web Audio API (solo edge cases):** se ejecuta únicamente si
   no hay `docId`, el backend es inalcanzable o FFmpeg falló. Requiere el `File` con los
   bytes; si `file === null` → `status = 'error'` y fin.
   ```ts
   const audioContext = new (window.AudioContext || webkitAudioContext)();
   const arrayBuffer = await file.arrayBuffer();
   const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
   const channelData = audioBuffer.getChannelData(0);   // canal 0
   // mismo algoritmo que el servidor: 100 peaks/s, máximo absoluto por ventana
   const samplesPerPeak = Math.floor(sampleRate / 100);
   // ... bucle de máximos ...
   await audioContext.close();
   ```

**Importante:** ambas estrategias producen el mismo formato (`100 peaks/s`, máximos
absolutos 0..1), así que el componente de dibujo no distingue el origen.

---

## 7. Frontend — componente `WaveformTimeline`

### Archivo: `frontend/components/VideoEditor/WaveformTimeline.tsx` (~1000 líneas)

Es el corazón visual. Combina: onda + regla de timecodes + segmentos de subtítulos
interactivos + playhead + toolbar. Exportado con `React.memo` y comparador custom.

### 7.1 Arquitectura de render — "viewport canvas"

**La decisión clave de rendimiento:** el `<canvas>` NO mide lo que dura el audio
(eso serían cientos de miles de px); mide exactamente el viewport visible y se
**redibuja entero en cada scroll** a partir de `scrollLeft`.

Estructura DOM:

```
<div container (flex-col, h-full)>
  <div header/toolbar />                          ← estado, undo/redo, zoom, save…
  <div containerRef (flex-1, relative)>           ← observado por ResizeObserver
    <div scrollRef (absolute inset-0, overflow-x-auto)  onScroll/onMouseDown/onMouseMove>
      <div style={{ width: totalWidth, height: 1 }} />   ← spacer invisible: genera el scrollbar
    </div>
    <canvas canvasRef (absolute inset-0, pointer-events-none) />   ← SIEMPRE tamaño viewport
    <div playheadRef (absolute, willChange: transform)>            ← playhead DOM
      <div rombo blanco rotado 45° />
      <div línea vertical 1px />
    </div>
    {loading && <overlay con video loading.webm />}
    {!videoFile && !mediaDocId && <div>Sense àudio</div>}
  </div>
</div>
```

- `totalWidth = Math.max(duration * zoom, viewportWidth)` — el spacer fija el ancho scrollable.
- El canvas tiene `pointer-events-none`; **todos los eventos de ratón van al div de scroll**.
- El playhead es un **elemento DOM** movido con `transform: translateX(px)` —
  así se actualiza a 60 fps sin redibujar el canvas.
- `ResizeObserver` sobre el contenedor mantiene `viewportWidth/Height` al día.
- HiDPI: el backing store del canvas se escala por `devicePixelRatio`
  (`canvas.width = ceil(w * dpr)`; `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`).

### 7.2 Constantes

```ts
const MIN_ZOOM = 20;        // px por segundo
const MAX_ZOOM = 500;
const DEFAULT_ZOOM = 100;
const EDGE_HIT_PX = 8;      // zona de agarre en los bordes de un segmento
const RULER_H = 22;         // alto de la franja de timecodes
const MIN_SEG_DURATION = MIN_SEG_DURATION_MS / 1000;   // 0.1 s (de constants.ts)
// HOLD_MS: configurable por usuario vía localStorage (clave WAVEFORM_HOLD_MS),
// clamp 0–2000 ms, default 500 — tiempo de pulsación para "armar" el drag de segmento
```

### 7.3 Algoritmo de dibujo (`drawVisible(scrollLeft)`)

Se ejecuta en cada scroll, zoom, cambio de peaks/segments/activeId/viewport. Pasos:

1. **Ventana temporal visible:** `timeStart = scrollLeft / zoom`; `timeEnd = (scrollLeft + w) / zoom`.
2. **Zonas:** regla arriba (`RULER_H = 22px`), contenido debajo (`contentH = h - 22`).
3. **Fondo + fondo de regla + línea separadora + línea central** del contenido.
4. **Grid de timecodes** con paso adaptativo al zoom:
   | zoom (px/s) | paso |
   |---|---|
   | < 10 | 30 s |
   | < 30 | 10 s |
   | < 80 | 5 s |
   | < 200 | 2 s |
   | ≥ 200 | 1 s |
   Líneas de grid a toda altura; etiquetas `m:ss` solo en la regla.
5. **Onda** — por **cada píxel x** del viewport:
   ```ts
   const peaksPerSec = data.length / (peaks.duration || duration || 1);
   const tAtPx = timeStart + px / zoom;
   const idxStart = floor(tAtPx * peaksPerSec);
   const idxEnd   = min(ceil((timeStart + (px+1)/zoom) * peaksPerSec), data.length);
   max = máximo de data[idxStart..idxEnd];          // re-agregación por píxel
   barH = Math.max(1, max * (contentH / 2));
   ctx.fillRect(px, centerY - barH, 1, barH * 2);   // barra simétrica de 1px de ancho
   ```
   Color: token `waveform-bar`, o `waveform-bar-play` si `isPlaying` (la onda entera
   cambia de color al reproducir).
6. **Segmentos** (leídos de un **ref** para no recrear el callback): para cada segmento
   que intersecta la ventana → rectángulo de fondo, borde (1.5px activo / 0.5px idle),
   asas de 2px en cada borde, y la primera línea del texto (HTML stripped, 10px,
   clipped al rect, solo si el segmento mide >24px en pantalla).

### 7.4 Playhead y auto-scroll

- `updatePlayheadPos(time, scrollLeft)`: `px = time * zoom - scrollLeft`; si está dentro
  del viewport (±2px) → `display:flex` + `translateX(px)`; si no → `display:none`.
- **Durante reproducción** corre un bucle `requestAnimationFrame` que en cada frame:
  1. lee `video.currentTime` **directamente del elemento `<video>`** (vía `videoRef`) —
     no del state de React;
  2. auto-scroll (si no hay drag en curso):
     - **modo `stationary`**: `scrollLeft = px - viewportW / 2` — el cursor queda clavado
       en el centro y la onda corre por debajo;
     - **modo `page`**: si el cursor pasa del 97% del borde derecho o sale por la
       izquierda → salto de página: `scrollLeft = px - viewportW * 0.03`;
  3. reposiciona el playhead.
  Mover `scrollLeft` dispara `onScroll` → `drawVisible` → la onda se redibuja sola.
- **En pausa** hay un `useEffect` equivalente alimentado por la prop `currentTime`
  (throttled ~250 ms). Deliberadamente NO corre durante reproducción para no pelearse
  con el RAF loop (un valor stale en modo page provocaría saltos de página hacia atrás).

### 7.5 Interacciones de ratón (máquina de estados con refs)

Todo el estado de interacción vive en refs (no state) para no provocar renders:

**mouseDown (botón izquierdo):**
- Hit-test de segmentos (en orden inverso, con ±2px de tolerancia). Zonas por segmento:
  `start` (primeros 8px), `end` (últimos 8px), `body` (centro). Para segmentos estrechos
  (<16px) las zonas de borde se reducen a 25% del ancho (mínimo 2px) para que siempre
  exista zona `body`.
- Si cae en un segmento: se guarda anchor + tiempos originales y se arma un **hold timer**
  (`HOLD_MS`, default 500 ms, configurable). Si el usuario mantiene pulsado ese tiempo →
  se arma el drag (`move` / `resize-start` / `resize-end` según zona) y el cursor cambia
  a `grabbing` / `col-resize`.
- **No se hace seek ni selección en mouseDown** — la decisión se toma en mouseUp.

**mouseMove:**
1. Drag de segmento armado → calcula delta temporal y aplica límites:
   - `move`: desplaza start y end manteniendo duración; clamp contra vecinos
     (`prevEnd + gap` / `nextStart - gap`, con `gap = minGapMs/1000`, default 160 ms)
     salvo que se mantenga **Shift** (permite solapamiento); clamp a `[0, duration]`.
   - `resize-start` / `resize-end`: mueve solo un extremo; respeta gap con el vecino
     (salvo Shift) y duración mínima `MIN_SEG_DURATION` (0.1 s).
   - Llama `onSegmentUpdate(id, newStart, newEnd)` en cada movimiento (actualización live).
2. Hold timer pendiente → no hacer nada (se tolera movimiento pequeño).
3. Botón pulsado sobre espacio vacío y desplazamiento >3px → **scrubbing**: seek continuo
   throttled por RAF (`throttledSeek` coalesce los mousemove en 1 seek por frame).
4. Sin botón → feedback de cursor (`grab` sobre body, `col-resize` sobre bordes).

**mouseUp:**
- Si había drag de segmento → `onSegmentUpdateEnd()` (el padre hace commit en su historial undo).
- Si fue **click corto** (< HOLD_MS, sin drag ni scrub):
  - sobre segmento → `onSegmentClick(id)` (el padre selecciona y suele hacer seek);
  - sobre vacío → `onSeek(pixelToTime(x))` directo.
- Si hubo scrubbing → flush del último seek pendiente.
- Reset de todos los refs de interacción y del cursor.

**mouseLeave:** misma limpieza pero **sin seek** (y commit del drag si estaba en curso).

### 7.6 Zoom

- `Ctrl/Cmd + rueda` → `zoom *= 1.15` (o ÷), clamp [20, 500] px/s. `preventDefault()`.
- Botones −/+ del toolbar (factor 1.5) y un `<input type="range">`.
- El valor se muestra como `NNNpx/s`.

### 7.7 Props (contrato completo del componente)

| Prop | Tipo | Rol |
|---|---|---|
| `videoFile` | `File \| null` | Solo para el fallback Web Audio; `null` con streaming |
| `mediaDocId` | `string \| null` | Id del doc de media → dispara `extract()` vía backend |
| `segments` | `Segment[]` | Segmentos de subtítulos a pintar |
| `duration` | `number` | Duración del media (segundos) |
| `currentTime` | `number` | Tiempo throttled (~4 fps) — usado solo en pausa |
| `onSeek` | `(t: number) => void` | El padre mueve `video.currentTime` |
| `isPlaying` | `boolean` | Activa el RAF loop y el color "play" de la onda |
| `videoRef` | `RefObject<HTMLVideoElement>` | Lectura directa de `currentTime` a 60 fps |
| `activeId` | `Id \| null` | Segmento resaltado |
| `onSegmentUpdate` | `(id, start, end) => void` | Actualización live durante drag |
| `onSegmentUpdateEnd` | `() => void` | Commit al soltar (historial undo) |
| `onSegmentClick` | `(id) => void` | Click corto en segmento |
| `scrollMode` | `'stationary' \| 'page'` | Modo de auto-scroll |
| `minGapMs` | `number` (default 160) | Margen mínimo entre subtítulos vecinos |
| `onUndo/onRedo/canUndo/canRedo` | — | Botones del toolbar (opcionales) |
| `autoScrollWave/onToggleAutoScrollWave` | — | Toggle de seguimiento (toolbar) |
| `scrollModeWave/onScrollModeChangeWave` | — | Conmutador stationary/page (toolbar) |
| `autosaveEnabled/onToggleAutosave/onSave/onExportSrt` | — | Botones de guardado (toolbar) |

(`viewMode`/`onToggleViewMode`/`autoScroll` existen en la interfaz pero el componente
actual no los consume internamente.)

### 7.8 `React.memo` con comparador custom

Durante reproducción (`prev.isPlaying && next.isPlaying`) el componente **ignora cambios
de `currentTime`** y solo re-renderiza si cambian props estructurales (segments, duration,
activeId, callbacks, toggles del toolbar…). Fuera de reproducción → siempre re-render
(`return false`). Esto, junto al RAF + ref del vídeo, es lo que permite playhead a 60 fps
sin renders de React.

---

## 8. Integración en el editor

### Archivos: `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` y `VideoSrtStandaloneEditorView.tsx`

### 8.1 Doble representación del tiempo (patrón crítico)

```ts
const [currentTime, setCurrentTime] = useState(0);  // state → renders (~4 fps)
const currentTimeRef = useRef(0);                    // ref → lógica a 60 fps
```

El handler del `timeupdate` del `<video>` hace:

```ts
const handleTimeUpdateThrottled = useCallback((t: number) => {
  currentTimeRef.current = t;                        // siempre, síncrono
  // detecta si cambió el segmento activo (eso SÍ requiere render)
  // ...
  if (segChanged || now - lastTimeUpdateRef.current > 250) {
    lastTimeUpdateRef.current = now;
    setCurrentTime(t);                               // state solo cada ~250 ms
  }
}, []);
```

**No colapsar ref y state en uno** — el state a 60 fps re-renderizaría todo el editor.
Nota adicional del código: el evento `timeupdate` de los navegadores dispara a ~4-6 Hz,
así que para operaciones que exigen precisión (TC-in/TC-out con tecla) se lee
`videoRef.current.currentTime` directamente, no el ref.

### 8.2 Carga del media (streaming, sin descarga)

```ts
// handleSyncMedia(doc):
setVideoFile(null);                                // NO se descarga el binario
setMediaDocId(doc.id);
setVideoSrc(api.streamUrlWithToken(doc.id));       // <video src=...?token=...>
setIsPlaying(false);
setCurrentTime(0);
setDuration(0);                                    // se rellena con loadedmetadata
```

`WaveformTimeline` recibe `videoFile={null}` y `mediaDocId={doc.id}` → su `useEffect`
llama `extract(null, docId)` → camino backend.

### 8.3 Handlers que el editor pasa al timeline

```ts
const onSeek = useCallback((time: number) => {
  if (videoRef.current) videoRef.current.currentTime = time;
  currentTimeRef.current = time;
  setCurrentTime(time);
  // notifica a la ventana externa del guion (BroadcastChannel), sin throttle
  scriptSyncChannelRef.current?.postMessage({ type: 'time-sync', currentTime: time, isPlaying: true });
}, []);

const handleSegmentUpdate = useCallback((id, newStart, newEnd) => {
  if (!isEditing) return;
  subsHistory.updateDraft(prev => prev.map(seg =>
    seg.id === id ? { ...seg, startTime: newStart, endTime: newEnd } : seg));
}, [isEditing, subsHistory]);                       // draft live, sin commit

const handleSegmentUpdateEnd = useCallback(() => {
  if (!isEditing) return;
  subsHistory.commit();                             // 1 entrada de undo por drag completo
}, [isEditing, subsHistory]);

const handleSegmentClick = useCallback((id) => {
  setActiveSegmentId(numericId);
  if (syncSubsEnabled && segment) onSeek(Math.max(0, segment.startTime - 0.05));
  // + scroll del panel de guion al take vinculado
}, [...]);
```

Patrón a conservar al portar: **updateDraft durante el drag, commit al soltar** — así un
drag entero es una sola entrada del historial de undo.

### 8.4 Estado del toolbar

```ts
const [autoScrollWave, setAutoScrollWave] = useState(true);
const [scrollModeWave, setScrollModeWave] = useState<'stationary' | 'page'>('stationary');
```

(Estado de sesión, no persistido. Lo único persistido en localStorage relativo al
waveform es `WAVEFORM_HOLD_MS`, que lee el propio componente.)

### 8.5 JSX de montaje (referencia completa)

```tsx
<WaveformTimeline
  videoFile={videoFile}
  mediaDocId={mediaDocId}
  segments={linkedSegmentsWithDiff}
  currentTime={currentTime}
  duration={duration}
  onSeek={onSeek}
  isPlaying={isPlaying}
  videoRef={videoRef}
  activeId={activeSegmentId}
  onSegmentUpdate={handleSegmentUpdate}
  onSegmentUpdateEnd={handleSegmentUpdateEnd}
  onSegmentClick={handleSegmentClick}
  autoScroll={autoScrollWave}
  scrollMode={scrollModeWave}
  onUndo={() => subsHistory.undo()}
  onRedo={() => subsHistory.redo()}
  canUndo={subsHistory.canUndo}
  canRedo={subsHistory.canRedo}
  autoScrollWave={autoScrollWave}
  onToggleAutoScrollWave={() => setAutoScrollWave(!autoScrollWave)}
  scrollModeWave={scrollModeWave}
  onScrollModeChangeWave={setScrollModeWave}
  autosaveEnabled={autosave}
  onToggleAutosave={() => setAutosave(!autosave)}
  onSave={handleSave}
  onExportSrt={handleExportSrt}
  minGapMs={generalConfig.minGapMs}
/>
```

---

## 9. Theming (CSS custom properties)

El componente lee sus colores de variables CSS `--th-*` en `document.documentElement`
(vía `getComputedStyle`), con fallback hardcoded. Tokens consumidos en canvas:

| Token CSS (`--th-…`) | Uso | Fallback |
|---|---|---|
| `waveform-bg` | Fondo del canvas y del contenedor | `#111827` |
| `waveform-ruler-bg` | Fondo de la franja de timecodes | `rgba(0,0,0,0.25)` |
| `waveform-line` | Línea central horizontal | `#374151` |
| `waveform-grid` | Líneas de grid vertical + separador de regla | `rgba(55,65,81,0.3)` |
| `waveform-grid-text` | Etiquetas `m:ss` | `rgba(107,114,128,0.6)` |
| `waveform-bar` | Barras de onda (pausa) | `rgba(113,113,122,0.5)` |
| `waveform-bar-play` | Barras de onda (reproduciendo) | `rgba(16,185,129,0.6)` |
| `waveform-seg` | Fondo segmento activo | `rgba(79,70,229,0.2)` |
| `waveform-seg-idle` | Fondo segmento inactivo | `rgba(148,163,184,0.08)` |
| `waveform-seg-border` / `-idle` | Borde segmento | `#6366f1` / `#64748b` |
| `waveform-seg-handle` / `-idle` | Asas de los bordes | `#818cf8` / `#94a3b8` |
| `waveform-seg-text` / `-idle` | Texto del segmento | `rgba(199,210,254,0.9)` / `rgba(156,163,175,0.7)` |
| `waveform-scrollbar` | `scrollbar-color` del div de scroll | — |

Además el JSX usa `--th-border`, `--th-bg-secondary`, `--th-bg-tertiary`, `--th-bg-surface`,
`--th-accent`, `--th-accent-text` para el toolbar.

Los temas se definen en `frontend/context/Theme/themes.ts` (4 temas: cada uno define
los 16 tokens waveform). Al portar: o se replican las variables CSS, o se sustituye
`getThemeColors()` por colores fijos.

---

## 10. Constantes, tipos y dependencias auxiliares

### Tipos (`frontend/appTypes.ts`)

```ts
export interface Segment {
  id: number;
  startTime: number;     // segundos
  endTime: number;       // segundos
  originalText: string;  // puede contener HTML — el timeline lo strippea para pintar
  translatedText?: string;
  richText?: string;
  status?: 'ok' | 'warning' | 'error';
  hasDiff?: boolean;
}

export type Id = string | number;
export type TimelineViewMode = 'waveform' | 'segments' | 'both' | 'hidden';
```

### Constantes (`frontend/constants.ts`)

```ts
LOCAL_STORAGE_KEYS.WAVEFORM_HOLD_MS = 'snlbpro_waveform_hold_ms'
// → ms de pulsación sostenida para armar drag de segmento; clamp 0–2000; default 500.
//   Es preferencia de usuario configurable desde SettingsModal.

export const MIN_SEG_DURATION_MS = 100;   // duración mínima de subtítulo (compartida con
                                          // el pipeline de transcripción --min-dur-ms)
```

### Otros recursos que importa `WaveformTimeline`

- `../icons` → `Icons.ArrowDown` (toggle de seguimiento).
- `./PlayerIcons` → `DownloadIcon`, `CursorStationaryIcon`, `CursorPageIcon` (SVGs simples).
- `/assets/loading.webm` → animación del overlay de carga (vídeo loop muted).
- Tailwind CSS para clases utilitarias del JSX (el canvas en sí no depende de Tailwind).

### Variables de entorno del backend

| Variable | Uso | Default |
|---|---|---|
| `CACHE_ROOT` | Raíz del caché (`{CACHE_ROOT}/waveform/`) | `./cache` |
| `STORAGE_ROOT` (o `MEDIA_ROOT`) | Carpeta plana de media | `./media` |

### Binarios requeridos en el servidor

- `ffmpeg` y `ffprobe` accesibles en PATH. Sin FFmpeg, el endpoint `/waveform` devuelve
  400 y el frontend cae al fallback Web Audio (que con streaming no tiene `File`, así
  que mostraría "Error d'extracció" — el fallback solo funciona con archivo local).

---

## 11. Invariantes de rendimiento — qué NO romper

1. **Canvas = viewport, nunca = duración total.** Redibujar la ventana visible en scroll
   es O(anchura en px), independiente de la duración del audio.
2. **Playhead en DOM con `transform`, no en canvas.** Evita redibujar el canvas a 60 fps.
3. **RAF loop lee `video.currentTime` del elemento**, no de props/state de React.
4. **`currentTime` (state) throttled a ~250 ms** y solo usado en pausa; el ref y el
   elemento `<video>` llevan la verdad a 60 fps. No colapsar en un solo state.
5. **`React.memo` con comparador que ignora `currentTime` durante reproducción.**
6. **Segments y activeId se leen desde refs dentro de `drawVisible`** para no recrear el
   callback de dibujo (y con él los efectos) en cada cambio.
7. **Seeks de scrubbing coalescidos por RAF** (1 `onSeek` por frame como máximo).
8. **El efecto de auto-scroll en pausa no corre durante reproducción** (lucharía contra el
   RAF loop; en modo page provoca saltos hacia atrás).
9. **Backend:** peaks pre-generados en upload (fire-and-forget) + caché por SHA-256.
   La generación client-side es SOLO fallback; no convertirla en flujo principal.
10. **`Cross-Origin-Resource-Policy: cross-origin`** en `/stream` si frontend y backend
    viven en orígenes distintos (Helmet bloquea `<video>` cross-origin por defecto).

---

## 12. Checklist para portar a otro proyecto

### Mínimo imprescindible (solo visualización de onda)

**Backend (si quieres peaks server-side):**
- [ ] Copiar `media-cache.service.ts` (autocontenido; cambiar la inyección de `ConfigService` si no usas NestJS — solo necesita una ruta de caché).
- [ ] Un endpoint equivalente a `GET /media/:id/waveform` que: resuelva el path físico del archivo + su SHA-256 → `readCacheAsJSON()` → si null, `generateAndCache()` y releer.
- [ ] Llamar a la generación en el momento de la ingesta del archivo (fire-and-forget) para que el primer open sea instantáneo.
- [ ] FFmpeg + ffprobe instalados.

**Frontend:**
- [ ] Copiar `useWaveformExtractor.ts` — sustituir `api.getWaveform` por tu cliente HTTP. Si no tienes backend, puedes usar solo la rama Web Audio (pásale siempre un `File`).
- [ ] Copiar `WaveformTimeline.tsx` y resolver sus imports:
  - `Segment`, `Id`, `TimelineViewMode` (de `appTypes.ts` — copiar los tipos de la sección 10),
  - `LOCAL_STORAGE_KEYS.WAVEFORM_HOLD_MS` y `MIN_SEG_DURATION_MS` (de `constants.ts`),
  - iconos (`ArrowDown`, `DownloadIcon`, `CursorStationaryIcon`, `CursorPageIcon`) — son SVGs triviales, sustituibles,
  - `/assets/loading.webm` — sustituible por cualquier spinner,
  - variables CSS `--th-waveform-*` — definirlas o hardcodear `getThemeColors()`.
- [ ] En el padre: implementar el patrón de tiempo dual (state throttled + ref + lectura directa del `<video>`), y los handlers `onSeek` / `onSegmentUpdate` (draft) / `onSegmentUpdateEnd` (commit) / `onSegmentClick`.

### Si también quieres el streaming autenticado

- [ ] Endpoint `/stream` con Range requests (código completo en sección 3) + header CORP.
- [ ] Extractor JWT dual (header + query param `token`) y helper `streamUrlWithToken()`.

### Si NO necesitas segmentos de subtítulos

Puedes recortar del componente: hit-testing, hold timer, drag/resize, `getNeighborBounds`,
y el bloque de dibujo de segmentos. Queda: extracción de peaks + dibujo de onda + regla +
playhead + scroll/zoom + seek/scrubbing. Esa es la mitad "visualizador puro".

### Resumen de archivos fuente originales

| Archivo | Líneas | Rol |
|---|---|---|
| `backend_nest_mvp/src/modules/media/media-cache.service.ts` | 263 | FFmpeg → peaks → `.wfcache`; lectura; limpieza |
| `backend_nest_mvp/src/modules/media/media.controller.ts` | 371 | Endpoints `/waveform`, `/stream`, `/upload` (+ `ensureWaveformCache`) |
| `backend_nest_mvp/src/modules/auth/jwt.strategy.ts` | — | Extractor JWT dual (header + `?token=`) |
| `frontend/services/api.ts` | (parcial) | `getWaveform()`, `streamUrl()`, `streamUrlWithToken()` |
| `frontend/hooks/useWaveformExtractor.ts` | 115 | Estrategia backend + fallback Web Audio |
| `frontend/components/VideoEditor/WaveformTimeline.tsx` | ~1006 | Render, interacción, toolbar |
| `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` | (parcial) | Cableado, tiempo dual, handlers |
| `frontend/context/Theme/themes.ts` | (parcial) | 16 tokens `waveform-*` por tema |
| `frontend/constants.ts` | (parcial) | `WAVEFORM_HOLD_MS`, `MIN_SEG_DURATION_MS` |
| `frontend/appTypes.ts` | (parcial) | `Segment`, `Id`, `TimelineViewMode` |
