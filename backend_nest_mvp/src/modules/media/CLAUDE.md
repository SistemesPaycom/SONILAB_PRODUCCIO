# Backend Media — contrato local para Claude

Este archivo aplica a `backend_nest_mvp/src/modules/media/`.

> **Git — regla heredada del CLAUDE.md raíz:** NO hagas commits, ramas, push ni ninguna operación de git/GitHub a menos que el usuario lo pida EXPLÍCITAMENTE.

## 1. Modelo funcional del módulo

Media es el repositorio canónico de assets audiovisuales.

- Almacenamiento físico: **carpeta plana única** (`STORAGE_ROOT` o `MEDIA_ROOT`). Sin subdirectorios reales.
- Cada archivo se guarda con nombre aleatorio (`nanoid`) + extensión original.
- La identidad de un asset es su **SHA-256**, no su nombre ni su ruta.
- No puede haber dos documentos de media activos con el mismo SHA-256.

## 2. Flujo de subida — reglas que NO debes romper

### Precheck ligero (`GET /media/check-duplicate`)
- Comprueba nombre + tamaño contra documentos activos.
- Solo detecta coincidencias probables, no confirma duplicado real.
- Devuelve `{ exists: boolean; document?: any }`.

### Upload real (`POST /media/upload`)
1. Multer guarda el archivo en `STORAGE_ROOT/tmp/` con nombre aleatorio (directorio de tránsito).
1b. Tras la validación y creación del documento en BD, el archivo se mueve con `fs.renameSync` a `STORAGE_ROOT/<nanoid><ext>`. Solo en ese momento pasa a almacenamiento definitivo.
2. Se valida extensión (`mp4, mov, m4v, mp3, wav, m4a, aac, flac, ogg`) y mime type.
3. Se calcula SHA-256 del archivo recién subido.
4. Se busca documento existente por SHA-256 en BD.
5. Si existe → **borrar el archivo recién subido del disco** y devolver `{ document: existing, duplicated: true }`.
6. Si no existe → crear documento en BD y devolver `{ document: newDoc }`.

### Lo que NO debe existir
- `forceDuplicate`: eliminado. No lo reintroduzcas.
- `nameOverride`: eliminado. El nombre siempre es `file.originalname`.
- Subdirectorios permanentes dentro de `STORAGE_ROOT`: el almacenamiento definitivo siempre es plano. `tmp/` es la única excepción y es un directorio de tránsito — los archivos solo residen allí durante la subida activa. Al arrancar el servidor, `cleanOrphanTmpFiles()` elimina los archivos en `tmp/` con más de 1 hora de antigüedad.

## 3. Parámetros del endpoint de upload

```
POST /media/upload
Body (FormData):
  - file: File         (obligatorio)
  - parentId?: string  (ignorado funcionalmente — siempre null desde frontend)
```

No hay ni debe haber `forceDuplicate` ni `nameOverride`.

## 4. Extensiones y tipos MIME permitidos

```
Extensiones: mp4, mov, m4v, mp3, wav, m4a, aac, flac, ogg
MIME:        video/mp4, video/quicktime,
             audio/wav, audio/x-wav, audio/wave, audio/vnd.wave,  ← variantes WAV (Windows reporta audio/wave)
             audio/mpeg, audio/mp3,                                ← variantes MP3
             audio/mp4, audio/aac, audio/flac, audio/ogg
```

Cualquier archivo fuera de estos valores debe rechazarse y el archivo debe borrarse del disco.

## 5. Waveform cache

Tras una subida exitosa, se llama a `ensureWaveformCache()` de forma no bloqueante (fire-and-forget).
No modifiques este comportamiento.

## 6. Entry points sensibles

- `upload()` — lógica principal de ingestión y deduplicación
- `checkDuplicate()` — precheck ligero
- `stream()` — streaming con range requests
- `waveform()` — cache de waveform (generación con FFmpeg)
- `ensureWaveformCache()` — generación async post-upload

## 7. No regresión

No romper:
- Deduplicación SHA-256 (siempre activa, sin bypass)
- Borrado del archivo físico cuando hay duplicado confirmado
- Precheck por nombre + tamaño
- Stream con range requests (necesario para video player)
- Waveform cache
- `listMedia` del LibraryService (usada por otros módulos)
