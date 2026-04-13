# Reporte: Soporte para Importación de Audio (WAV y MP3)

Este informe detalla el estado actual de la funcionalidad de importación de archivos y las acciones necesarias para permitir la carga de archivos de audio (`.wav`, `.mp3`) de manera consistente en toda la aplicación, eliminando la restricción percibida de "solo .mp4".

---

## 1. Explicación para Claude (Contexto de Negocio)

Actualmente, el sistema está orientado principalmente al procesamiento de vídeo, lo que ha derivado en interfaces y validaciones que priorizan o restringen la entrada a archivos `.mp4`. La necesidad detectada es unificar la experiencia para que los archivos de audio puro (`.mp3`, `.wav`) sean tratados como ciudadanos de primera clase en la biblioteca y en la creación de proyectos de transcripción.

Se requiere que el asistente analice los puntos de entrada de archivos (DropZones, inputs de tipo file y modales de importación) y asegure que las cadenas de "accept" y las constantes de tipos permitidos incluyan formalmente los formatos de audio solicitados. Asimismo, se debe verificar que el flujo de procesamiento posterior (generación de formas de onda, transcodificación si aplica y vinculación a proyectos) no presuponga la existencia de una pista de vídeo.

---

## 2. Análisis Técnico Detallado

### 2.1. Frontend: Restricciones de Interfaz

He identificado varios archivos donde la restricción está codificada de forma explícita o mediante omisión:

#### [MODIFY] [SonilabLibraryView.tsx](file:///d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend/components/Library/SonilabLibraryView.tsx)
En la línea 1182, el modal de importación define los formatos aceptados:
```tsx
// Línea 1182
{isImportModalOpen && <ImportFilesModal ... accept=".pdf,.docx,.srt,.mp4,.wav,.mov,.webm,.ogg" ... />}
```
**Observación:** Falta `.mp3` explícitamente en esta lista, lo que impide que el selector de archivos del sistema muestre estos archivos. Aunque `.wav` está presente, la lógica de `handleFilesUpload` debe ser revisada para asegurar que no bloquee formatos de audio.

#### [MODIFY] [VideoEditorView.tsx](file:///d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend/components/VideoEditor/VideoEditorView.tsx)
En la línea 238, el modal de importación técnica para sincronización de vídeo es muy restrictivo:
```tsx
// Línea 238
accept="video/mp4,video/webm,video/ogg,video/quicktime"
```
**Observación:** Aquí se usan mimetypes de vídeo. Si se desea permitir audio para sincronización, se deben añadir `audio/mpeg, audio/wav, audio/x-wav`.

#### [MODIFY] [CreateProjectModal.tsx](file:///d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend/components/Projects/CreateProjectModal.tsx)
Aunque tiene una constante `MEDIA_EXTS` que incluye audio:
```tsx
const MEDIA_EXTS = ['mp4', 'mov', 'webm', 'wav', 'mp3', 'ogg', 'm4a'];
```
El texto de la interfaz (labels) a menudo se refiere a "Subir nuevo vídeo" (Línea 380), lo cual puede confundir al usuario o indicar que el componente espera contenido visual.

### 2.2. Backend: Validación de Archivos

#### [MODIFY] [media.controller.ts](file:///d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/backend_nest_mvp/src/modules/media/media.controller.ts)
El backend parece estar mejor preparado, pero hay que asegurar la consistencia:
```tsx
// Línea 137
const allowedExt = new Set(['mp4', 'mov', 'm4v', 'mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg']);
```
**Conflicto Potencial:** Si el proceso de "ingesta" intenta extraer un frame para thumbnail usando FFmpeg y falla al no encontrar stream de vídeo, el upload podría fallar o quedar en estado inconsistente.

---

## 3. Soluciones Propuestas y Posibles Conflictos

### Soluciones Sugeridas
1.  **Unificar Constantes:** Crear un archivo de constantes compartido en el frontend (ej. `constants/fileTypes.ts`) que defina `AUDIO_EXTS`, `VIDEO_EXTS` y `ALL_MEDIA_EXTS` para evitar discrepancias entre componentes.
2.  **Actualizar Atributos `accept`:** Recorrer todos los `ImportFilesModal` y inputs `<input type="file" />` para asegurar que incluyen `.mp3` y `.wav`.
3.  **Labels Agnosticos:** Cambiar "Vídeo" por "Media" o "Audio/Vídeo" en las etiquetas de la UI.
4.  **Fallback de Thumbnail:** En el backend/frontend, si el archivo es audio, mostrar un icono genérico de audio en lugar de intentar generar una previsualización de vídeo.

### Errores y Conflictos Detectados
- **Thumbnail Generation:** El servicio de media podría lanzar excepciones si FFmpeg intenta procesar un `.wav` buscando vídeo.
- **Waveform:** La generación de la onda de audio (waveform) debe confirmarse que funciona para archivos que no contienen contenedor de vídeo.
- **Transcribe Logic:** Asegurar que los motores de Whisper (`faster-whisper`, `whisperx`) manejen correctamente el archivo de audio directamente sin necesidad de extraerlo de un contenedor de vídeo previamente (normalmente ya lo hacen, pero debe verificarse el pipeline).

---

## 4. Instrucciones para la Implementación (Guía para Claude)

> [!IMPORTANT]
> Se recomienda encarecidamente utilizar las herramientas de **superpowers debug** y **code-review** para analizar las trazas de error durante la carga de archivos de audio. 

Claude debe:
1.  Realizar un análisis exhaustivo de todas las ocurrencias de `.mp4` y compararlas con las de `.wav`/`.mp3`.
2.  Utilizar `grep` para encontrar cualquier validación de extensión "hardcodeada" que no use la constante `MEDIA_EXTS`.
3.  Verificar en el backend si existe algún `MimetypeInterceptor` o validación en el DTO de subida que sea más restrictivo que el controlador.
4.  Proponer un cambio que no rompa la compatibilidad con los proyectos existentes.

---
**Reporte generado por:** Antigravity (Advanced Agentic Coding)
**Fecha:** 2026-04-13
