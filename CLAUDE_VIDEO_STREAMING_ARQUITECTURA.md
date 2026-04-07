# Arquitectura de Video Streaming y Waveform — Sonilab

> **Propósito de este documento:** Registrar el funcionamiento final del sistema de carga de vídeo y generación de onda en el editor SRT, las decisiones de diseño tomadas y por qué se descartaron otras alternativas. Escrito para que cualquier agente o desarrollador futuro entienda el contexto sin tener que reanalizar el código desde cero.

---

## Contexto: el problema que se resolvió

Antes de esta arquitectura, abrir un proyecto en el editor SRT requería descargar el archivo de vídeo **completo** al navegador antes de poder reproducirlo. Un vídeo de 1 GB tardaba 10–15 minutos antes de que apareciera cualquier cosa en pantalla. En producción (servidor en red), esto era inviable.

El objetivo era **mínima latencia**: el vídeo debe empezar a reproducirse en segundos y la onda debe estar lista casi instantáneamente.

---

## Arquitectura final

### 1. Vídeo — Streaming directo con Range requests

**Cómo funciona:**

El componente `<video>` del navegador recibe directamente la URL del endpoint de streaming del servidor, sin pasar por ninguna descarga previa:

```
<video src="http://servidor/api/media/{docId}/stream?token={jwt}" />
```

El servidor (`media.controller.ts`) sirve el archivo con soporte completo de **HTTP Range requests (206 Partial Content)**:
- Si no hay header `Range` → devuelve el archivo completo
- Si hay header `Range` → devuelve solo el fragmento solicitado (`Content-Range: bytes X-Y/Z`)

El navegador gestiona automáticamente las Range requests: descarga solo los segundos que necesita reproducir en cada momento. El vídeo empieza a reproducirse en 1–2 segundos independientemente del tamaño del archivo.

**Por qué no se usa Blob URL:**

La alternativa (descartada) era `fetch → blob → URL.createObjectURL(blob) → <video src={blobUrl}>`. Este patrón obliga a descargar el 100% del archivo antes de reproducir el primer frame. Con archivos de cientos de MB o GB en una red, el tiempo de espera es inaceptable. Además, mantener el archivo entero en la RAM del navegador es innecesario.

**El obstáculo de autenticación y cómo se resolvió:**

El tag `<video src="...">` del navegador no puede enviar headers HTTP personalizados (como `Authorization: Bearer ...`). La API de Sonilab usa JWT via Bearer header en todas sus rutas.

Solución: el `JwtStrategy` de Passport (`jwt.strategy.ts`) se modificó para extraer el token desde **dos fuentes** en orden de prioridad:
1. Header `Authorization: Bearer <token>` — para todas las llamadas normales de la API (fetch, axios, etc.)
2. Query parameter `?token=<token>` — exclusivamente para el uso del tag `<video>`

```typescript
// backend_nest_mvp/src/modules/auth/jwt.strategy.ts
jwtFromRequest: ExtractJwt.fromExtractors([
  ExtractJwt.fromAuthHeaderAsBearerToken(),   // todas las llamadas normales
  ExtractJwt.fromUrlQueryParameter('token'),  // para <video src="...?token=...">
]),
```

El frontend construye la URL autenticada con `api.streamUrlWithToken(docId)`:

```typescript
// frontend/services/api.ts
streamUrlWithToken(docId: string): string {
  const token = getToken();
  const base = `${API_URL}/media/${docId}/stream`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
},
```

**Nota de seguridad:** Exponer el JWT en la URL tiene implicaciones (logs del servidor, historial del navegador, header `Referer`). Para Sonilab, que es una aplicación de red local/intranet, esto es aceptable. Si en el futuro la app se expone públicamente, considerar migrar a signed URLs de tiempo limitado o a autenticación por cookie httpOnly.

---

### 2. Onda (Waveform) — Pre-generada en servidor, cargada desde caché

**Cómo funciona:**

La onda se genera **una sola vez** en el servidor, en el momento en que se sube el vídeo:

```
POST /media/upload
  → guarda archivo en disco
  → calcula SHA-256 del archivo
  → lanza ensureWaveformCache() en BACKGROUND (no bloquea la respuesta)
      → FFmpeg extrae audio mono a 8 kHz (-vn -ac 1 -ar 8000 -f f32le)
      → se calculan peaks (100 peaks/segundo)
      → se guarda como binario en {CACHE_ROOT}/waveform/{sha256}.wfcache
```

Cuando el editor SRT abre un proyecto y necesita la onda:

```
GET /media/{docId}/waveform
  → lee doc.media.sha256
  → busca {sha256}.wfcache en disco
  → si existe (cache HIT) → responde JSON con peaks en <100ms
  → si no existe (cache MISS) → genera con FFmpeg ahora (5–30s según tamaño)
                               → guarda .wfcache → responde
```

**Formato del archivo `.wfcache` (binario, muy compacto):**

```
[4B  uint32  version]
[4B  uint32  peaksPerSecond = 100]
[8B  float64 duration]
[4B  uint32  sampleRate]
[4B  uint32  peakCount]
[peakCount × 4B float32 peaks...]
```

Un vídeo de 1 hora genera ~360.000 peaks → ~1.4 MB de cache. Muy eficiente.

**Identificación por SHA-256:**

El cache se identifica por el hash del contenido del archivo, no por el nombre ni el ID de documento. Esto garantiza que si el mismo archivo se sube dos veces (o desde dos usuarios distintos), el cache se reutiliza sin regenerar.

**Lifetime del caché:** 30 días. Se limpia automáticamente en la ventana nocturna (21:00–05:00) mediante `cleanOldCaches()`.

**Por qué no se genera en el cliente (Web Audio API):**

La alternativa (mantenida solo como fallback) es usar la Web Audio API del navegador:
```javascript
const arrayBuffer = await file.arrayBuffer(); // descarga TODO el archivo
const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
// luego calcular peaks...
```

Esto tiene dos problemas graves:
1. Requiere descargar el archivo completo (mismo problema que el Blob URL del vídeo)
2. Descodificar audio de un vídeo de 1h en el navegador tarda varios segundos y bloquea recursos

El fallback de Web Audio API **solo se activa** si: no hay `docId`, el backend no está disponible, o FFmpeg falló en el servidor. En el flujo normal nunca se ejecuta.

---

### 3. Flujo completo al abrir el editor SRT

```
Usuario abre proyecto SRT
         │
         ▼
handleSyncMedia(doc)
  → setVideoSrc( api.streamUrlWithToken(doc.id) )   ← URL directa, sin descarga
  → setMediaDocId( doc.id )
  → setVideoFile( null )                             ← ya no se necesita el File
         │
         ├─► <video src={videoSrc}> empieza a reproducirse en ~1-2s
         │       El navegador hace Range requests automáticamente
         │
         └─► WaveformTimeline recibe mediaDocId
                  │
                  ▼
             useWaveformExtractor.extract(null, mediaDocId)
                  │
                  ▼
             GET /media/{docId}/waveform
                  │
                  ├─ Cache HIT → peaks en <100ms → onda visible instantáneamente ✓
                  └─ Cache MISS → FFmpeg genera (5-30s, solo primera vez) → onda visible ✓
```

---

### 4. Gestión del estado `videoFile`

Con el nuevo sistema, `videoFile` (el objeto `File` con los bytes del vídeo) ya no se descarga ni se almacena. Su valor es siempre `null` en el editor SRT cuando se usa el modo stream.

Los componentes que dependían de `videoFile` se adaptaron:

| Componente / Hook | Uso anterior de `videoFile` | Adaptación |
|---|---|---|
| `<video>` tag | `src={URL.createObjectURL(videoFile)}` | `src={videoSrc}` (URL directa) |
| `WaveformTimeline` | `if (videoFile) extract(videoFile, mediaDocId)` | `if (mediaDocId \|\| videoFile) extract(videoFile ?? null, mediaDocId)` |
| `useWaveformExtractor` | `file: File` (requerido) | `file: File \| null` (nullable); fallback guarded |
| `useSubtitleAIOperations` | Guard: `if (!videoFile)` | Guard: `if (!videoSrc)` |
| Empty state "Sense àudio" | `{!videoFile && <div>Sense àudio</div>}` | `{!videoFile && !mediaDocId && <div>Sense àudio</div>}` |

**`VideoEditorView` y `MediaPreviewView` no se modificaron** — estos componentes no tienen `mediaDocId` en su flujo y siguen usando el sistema anterior de descarga + Blob URL. Solo el editor SRT (`VideoSubtitlesEditorView` y `VideoSrtStandaloneEditorView`) usa el nuevo streaming.

---

### 5. Vídeos ya subidos antes del cambio

No es necesario re-subir ningún vídeo. El streaming funciona para todos los archivos ya almacenados en el servidor.

Respecto a la onda:
- Si el `.wfcache` ya existe (vídeo subido con esta versión) → carga instantánea
- Si el `.wfcache` no existe (vídeos subidos antes) → se genera la primera vez que se abre el editor para ese proyecto (5–30 segundos una sola vez), luego queda cacheado permanentemente

---

### 6. Archivos clave

| Archivo | Responsabilidad |
|---|---|
| `backend_nest_mvp/src/modules/media/media.controller.ts` | Endpoint `/stream` (Range requests) y `/waveform` (caché + generación on-demand) |
| `backend_nest_mvp/src/modules/media/media-cache.service.ts` | Generación FFmpeg, lectura/escritura de `.wfcache`, limpieza nocturna |
| `backend_nest_mvp/src/modules/auth/jwt.strategy.ts` | Extracción JWT desde header Y desde query param `?token=` |
| `frontend/services/api.ts` | `streamUrl()`, `streamUrlWithToken()`, `getWaveform()` |
| `frontend/hooks/useWaveformExtractor.ts` | Lógica dual: backend cache (primario) → Web Audio API (fallback) |
| `frontend/components/VideoEditor/WaveformTimeline.tsx` | Renderizado canvas de la onda, dispara extracción |
| `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` | Editor SRT principal, gestiona `videoSrc` y `mediaDocId` |
| `frontend/components/VideoSubtitlesEditor/VideoSrtStandaloneEditorView.tsx` | Editor SRT standalone, misma lógica |

---

## Métricas de mejora

| Métrica | Antes | Después |
|---|---|---|
| Tiempo hasta primer frame | ~10–15 min (descarga completa) | ~1–2 segundos |
| Tiempo de carga de onda | Variable (generación en cliente) | <100ms (cache HIT) |
| RAM usada por el vídeo | Tamaño completo del archivo | Solo buffers de reproducción (~MB) |
| Dependencia de red para reproducir | 100% descargado antes de empezar | Streaming continuo (Range requests) |
