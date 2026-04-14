# Informe Detallado: Rediseño del Menú de Creacion de Proyecto y Presets de Whisper

Este informe detalla las especificaciones para la simplificación y mejora del menú de creación de proyectos y transcripción, incluyendo un sistema de presets avanzados configurables.

## Instrucción para Claude (Visión General)

El objetivo es transformar el actual modal de "Crear Proyecto" en una interfaz mucho más limpia y profesional, centrada en la velocidad de uso.

1.  **Simplificación Inicial**: El usuario solo debería ver el Nombre del Proyecto, la selección de vídeo y la selección de guion. Los botones para subir archivos nuevos deben integrarse de forma sutil (iconos cuadrados pequeños a la derecha de los desplegables).
2.  **Presets Inteligentes**: Se usará una lista desplegable sencilla para el "Perfil Whisper" con dos opciones por defecto: `VE` (Vídeo España) y `VCAT` (Vídeo Cataluña).
3.  **Configuración Avanzada**: Todo el detalle técnico de Whisper (modelo, idioma, batch, etc.) debe ocultarse dentro de una sección desplegable llamada "Whisper avançat".
4.  **Logica Custom**: Si el usuario entra en la sección avanzada y modifica cualquier valor, el nombre del perfil debe cambiar automáticamente a *"custom"* (en cursiva).
5.  **Persistencia**: Dentro de la zona avanzada, debe haber un botón "Guardar perfil" que permita al usuario salvar su configuración actual con un nombre personalizado, el cual aparecerá luego en la lista de presets principales.

---

## Especificaciones Técnicas de Implementación

### 1. Frontend: Rediseño de `CreateProjectModal.tsx`

El archivo principal a modificar es [CreateProjectModal.tsx](file:///d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend/components/Projects/CreateProjectModal.tsx).

#### A. Estructura de Inputs "Compactos"
- Reemplazar el selector de vídeo actual por un contenedor `flex` que incluya:
  - El `<select>` de vídeos existentes (ocupando la mayor parte del ancho).
  - Un botón cuadrado pequeño (ej: 32x32px) con un icono de "+" o "upload" para subir nuevos archivos.
- Replicar exactamente esta misma estructura para el campo de "Guion" (docx/pdf), eliminando el bloque actual de "Guion opcional" que es demasiado grande.

#### B. Sección "Whisper avançat"
- Implementar un componente de tipo `collapsible` (o un `disclosure`) debajo del selector de Presets.
- Al desplegarse, mostrará todos los parámetros técnicos que actualmente están en la columna derecha:
  - Motor (Engine)
  - Modelo (Model)
  - Idioma (Language)
  - Batch size
  - Device (cpu/cuda)
  - Auto-ajuste de timings (waveform)
  - Diarización
  - Margen mínimo entre subtítulos.

#### C. Lógica de Perfiles y Presets
- **Valores por Defecto**: Actualizar las constantes para que al seleccionar `VE` o `VCAT` se apliquen los siguientes valores:
  - **VE**: Motor: `Purfview XXL`, Modelo: `large-v3`, Idioma: `es`, Batch: `16`, Device: `cpu`, Waveform: `true`, Diarización: `false`, Margen: `160ms`.
  - **VCAT**: Motor: `Purfview XXL`, Modelo: `large-v3`, Idioma: `ca`, Batch: `16`, Device: `cpu`, Waveform: `true`, Diarización: `false`, Margen: `160ms`.
- **Detección de Cambios**: Implementar un `useEffect` que compare el estado actual de los parámetros técnicos con los valores definidos en los presets de fábrica o guardados. Si hay discrepancia, cambiar `setProfile('custom')`.
- **Guardar Perfil**:
  - Botón en la esquina superior derecha de la sección avanzada.
  - Al pulsar, abrir un mini-modal/pop-up para introducir el nombre.
  - **Validación**:
    - No permitir `VE` ni `VCAT`.
    - Si el nombre existe, mostrar advertencia de "Sobrescribir".

### 2. Backend: Soporte para Presets Personalizados

Para que los perfiles se guarden, necesitamos modificar el backend [`backend_nest_mvp`](file:///d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/backend_nest_mvp/src/).

#### A. Esquema de Datos
- Modificar [GlobalSettingsSchema](file:///d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/backend_nest_mvp/src/modules/settings/settings.schema.ts) para añadir una propiedad `whisperPresets`:
  ```typescript
  whisperPresets: Record<string, WhisperConfig>;
  ```

#### B. API de Configuración
- Crear un nuevo controlador o extender [SettingsController](file:///d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/backend_nest_mvp/src/modules/settings/settings.controller.ts) con endpoints:
  - `POST /settings/whisper-presets`: Guarda o actualiza un preset.
  - `GET /settings/whisper-presets`: Lista los presets disponibles.
- Actualizar `TranscriptionOptionsController` para que combine los presets de fábrica (`VE`, `VCAT`) con los guardados en la base de datos al devolver la lista de `profiles`.

---

## Posibles Conflictos y Soluciones

1.  **Diarización y Motor**: Algunos motores (como `faster-whisper` básico) no soportan diarización nativa tan bien como `whisperx`. El UI debe gestionar qué opciones se deshabilitan según el motor seleccionado en modo avanzado para evitar errores de envío.
2.  **Validación de Nombres**: Asegurarse de que el frontend pase el nombre limpio (trim) y que el backend rechace nombres prohibidos (`VE`, `VCAT`).
3.  **Estilos CSS**: El usuario ha pedido un botón "pequeño y cuadrado". Se debe usar flexbox y asegurar que la altura del botón coincida exactamente con la del `input/select` de al lado para mantener la simetría.
4.  **Estado del Formulario**: Al cambiar el perfil de `VE` a `VCAT` o a un preset guardado, se debe "resetear" el estado de todos los campos avanzados. No basta con cambiar el nombre del perfil, hay que actualizar el objeto `options` local en el componente.

---

## Nota para Claude: Superpowers Debug y Code-Review

> [!IMPORTANT]
> Claude, para esta tarea se recomienda encarecidamente utilizar tus herramientas de **Análisis de Código** (para rastrear cómo fluyen los `settings` desde el modal hasta el servicio de `api`) y de **Depuración** (para validar el estado del componente react al cambiar entre presets y el modo "custom"). 
> 
> Realiza un **Code-Review** exhaustivo de los cambios propuestos en `CreateProjectModal.tsx` para asegurar que las referencias a `var(--th-accent)` y otros estilos del sistema se mantengan coherentes con la estética premium del proyecto.
