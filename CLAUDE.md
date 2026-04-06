# Sonilab Producció — contexto maestro para Claude

Este archivo define el marco global del repositorio. Los `CLAUDE.md` de subcarpetas heredan estas reglas y añaden detalle local.  
Si una instrucción local contradice este archivo, prevalece la más específica **solo** dentro de su carpeta.

## 1. Principio rector

Trabaja siempre con cambios:
- pequeños
- verificables
- reversibles
- limitados al alcance pedido

No rehagas módulos enteros si el problema puede resolverse localmente.  
No mezcles cambios funcionales con cosméticos salvo que sea imprescindible.  
No toques módulos no relacionados.

## 2. Naturaleza del producto

Esta app **no** es una herramienta pequeña ni solo de subtítulos.  
Es una aplicación web grande y modular con áreas de:
- biblioteca
- vídeo
- audio
- subtítulos
- timeline
- waveform
- guion
- traducción
- revisión
- proyectos

Cualquier cambio en biblioteca debe proteger el resto del sistema.

## 3. Modelo funcional cerrado de biblioteca

La biblioteca tiene cuatro módulos con lógica y UI propia. En el frontend son cuatro pestañas: **Files**, **Projectes**, **Media**, **Paperera**.

### Files (antes "Arxius" / "Llibreria")
Sistema clásico de trabajo con estructura real de carpetas/subcarpetas en backend.
- Contiene: txt, srt, pdf, docx, LNK y carpetas de trabajo
- Permite: copiar / cortar / pegar / duplicar / mover / renombrar
- Regla de duplicados: mismo nombre+formato en la misma carpeta = prohibido; en ruta distinta = permitido
- **NO muestra media canónica** (vídeo/audio con `media` poblado y sin `refTargetId`)
- **NO muestra documentos con `sourceType` de media** aunque no tengan `media` poblado (legacy)
- Carpetas de proyecto se identifican por `projectFolderIds` y muestran icono 🗃️ y formato "PROJECTE"
- Carpetas normales muestran icono 📁 y formato "CARPETA"
- El breadcrumb muestra "Files" cuando `page === 'library'`

### Media
Repositorio canónico de assets audiovisuales. **Solo vídeo y audio.**
- Backend: carpeta plana única en disco (`STORAGE_ROOT`), sin subdirectorios reales
- Cada archivo guardado con nombre aleatorio (`nanoid`) + extensión original
- Identidad del asset = SHA-256, no el nombre ni la ruta
- Deduplicación siempre activa: no puede haber dos assets con el mismo SHA-256
- No se comporta como archivo clásico: no hay copiar/cortar/pegar/duplicar binario
- Las "agrupaciones" que ve el usuario son solo vistas del frontend (orden/filtro), no estructura en disco
- Solo muestra documentos con `media` poblado y `refTargetId` vacío
- El breadcrumb muestra "Media" cuando `page === 'media'`

### LNK
Referencia desde Files hacia un asset de Media.
- No duplica binario; apunta al original
- Puede convivir con txt/srt/docs en cualquier carpeta de Files
- Copiar un LNK duplica la referencia, no el media
- LNK huérfano (target borrado): no se puede abrir, se marca visualmente como roto

### Projectes
Capa propia del producto. Lista de carpetas de proyecto.
- No se fusiona con Media ni con Files
- Cada proyecto apunta a un `mediaDocumentId` canónico de Media
- La pestaña Projectes filtra `itemsToRender` mostrando solo carpetas cuyo `id` está en `projectFolderIds`
- `projectFolderIds` se calcula a partir del estado de proyectos del backend
- El breadcrumb muestra "Projectes" cuando `page === 'projects'`
- Las carpetas de proyecto también son visibles en Files (con icono 🗃️ y formato "PROJECTE")

## 4. Definiciones canónicas

```ts
const isCanonicalMedia = (doc: any) =>
  doc?.type === 'document' && !!doc.media && !doc.refTargetId;

const isLnk = (doc: any) =>
  doc?.type === 'document' && !!doc.refTargetId;

const isOrphanLnk = (doc: any, allDocs: any[]) =>
  isLnk(doc) && !allDocs.find(d => d.id === doc.refTargetId && !d.isDeleted);
```

No bases decisiones funcionales solo en `sourceType` si necesitas distinguir:
- media canónica
- documento clásico
- LNK

## 5. Estado actual de fases

### Fase 1
Cerrada funcionalmente.
- Media, Arxius, LNK y Projectes definidos sin ambigüedad.

### Fase 2
Cerrada técnicamente.
La contención ya cubre:
- copy/cut/paste de media canónica
- drag/drop genérico de media
- subida cruzada media ↔ Arxius
- clasificación por tabs
- selección y acciones múltiples
- delete/purge con conjunto total efectivo
- LNK huérfanos

### Fase 3
Iniciada. Contrato funcional cerrado y primer bloque implementado.

**Decisiones funcionales cerradas:**
- Media backend = carpeta plana única en disco (sin subdirectorios reales). Las agrupaciones del frontend son solo visuales.
- No existe "forzar nuevo" para duplicados confirmados. La deduplicación por SHA-256 es siempre autoritativa.
- Duplicado probable (precheck nombre+tamaño): modal tentativo — "Continuar i verificar" / "Cancel·lar".
- Duplicado confirmado (SHA-256): modal definitivo — "Usar asset existent" / "↗ Crear accés directe" / "Cancel·lar".
- Subida de media siempre con `parentId: null` (no hereda carpeta de Arxius).
- Reutilizar media = crear LNK, no duplicar binario.

**Implementado en esta fase:**
- Eliminado `forceDuplicate` y `nameOverride` del endpoint `POST /media/upload`.
- Eliminado `forceDuplicate` de `api.ts → uploadMedia()`.
- Eliminada función `handleForceImport` y estados asociados de `LibraryView.tsx`.
- Modal de duplicado confirmado rediseñado sin opción de force.
- `parentId: null` forzado en todas las rutas de subida de media en `LibraryView.tsx`.

**Pendiente en Fase 3:**
- Relación Media ↔ LNK: flujo de "Usar asset existent" (navegación al asset en Media).
- Organización visual dentro de Media (frontend only).
- Compatibilidad con Projectes verificada pero no reforzada explícitamente.

## 6. Reglas de trabajo

1. No abras una fase nueva por tu cuenta.
2. No cambies arquitectura global sin instrucción explícita.
3. Si una zona ya está contenida, no la reabras por perfeccionismo.
4. Si detectas una fuga real, corrígela en el punto más local posible.
5. Si no hay fuga real, no inventes trabajo.
6. Protege especialmente:
   - Projectes
   - editores
   - timeline
   - waveform
   - syncRequest
   - transcripción
   - traducción
   - revisión

## 7. Convenciones prácticas

- Comentarios de código: catalán si ya existe esa convención local.
- Nombres de variables y funciones: inglés.
- Mantén contratos existentes salvo razón fuerte.
- Evita renombrados masivos.
- Evita cambios “de limpieza” sin valor funcional.

## 8. Rutas más sensibles

- `frontend/components/Library/`
- `frontend/context/Library/`
- `backend_nest_mvp/src/modules/library/`
- `frontend/components/Projects/`
- `backend_nest_mvp/src/modules/projects/`

Lee el `CLAUDE.md` local antes de tocar cualquiera de estas zonas.

## 9. Documentación en Skills_Claude/

Los archivos de contexto del proyecto están en `Skills_Claude/`:

| Archivo | Contenido |
|---------|-----------|
| `PRODUCT_CONTEXT.md` | Contexto de producto, módulos y principios funcionales |
| `PROJECT_HISTORY.md` | Decisiones históricas, Fase 1 y Fase 2, qué no reabrir |
| `README.md` | Descripción del monorepo y arranque rápido |
| `Logs/` | Logs de sesiones de trabajo anteriores con Claude |

Los archivos de dominio de cada subsistema se crean aquí progresivamente cuando un área crece lo suficiente para justificarlo. Se pueden organizar en subcarpetas `frontend/` y `backend/` si el volumen lo requiere.

## 10. Coherencia entre subsistemas

Muchos componentes de Sonilab comparten recursos indirectos.
Dos partes de la app pueden no estar conectadas directamente pero depender del mismo contrato compartido.

Ejemplo: añadir un nuevo `sourceType` afecta a `FileItem.tsx` (icono/formato), `LibraryView.tsx` (clasificación), `OpenWithModal.tsx` (detección y apertura), `exportUtils.ts` (extensión del nombre) y posiblemente al backend. Sin consultar todos los afectados, el cambio queda a medias.

### Regla obligatoria

Antes de dar por terminada cualquier modificación, Claude debe preguntarse:

> "¿Este cambio afecta a algún recurso compartido que otros subsistemas también consumen?"

Si la respuesta es sí, consultar el archivo de dominio correspondiente en `Skills_Claude/` y aplicar todos los pasos indicados.

### Dominios registrados

Cada dominio tiene (o tendrá) un archivo `.md` en `Skills_Claude/` que explica qué archivos involucra, qué hacer cuando se añade/modifica/elimina algo, y qué relaciones indirectas existen.

| Condición de activación | Dominio | Archivo |
|------------------------|---------|---------|
| Se añade, modifica o elimina un valor de `sourceType` | Clasificación de documentos | `Skills_Claude/domain-source-types.md` |
| Se añade o renombra una clave en `LOCAL_STORAGE_KEYS` | Persistencia local | `Skills_Claude/domain-localstorage.md` |
| Se modifica `isCanonicalMedia`, `isLnk` o la lógica de tab (Files/Media/Projectes) | Modelo de biblioteca | `Skills_Claude/domain-library-model.md` |
| Se modifica el formato `snlbpro` o su pipeline de import/export/apertura | Formato de guion | `Skills_Claude/domain-snlbpro-format.md` |
| Se toca `projectFolderIds` o cualquier lógica del módulo Projectes | Proyectos | `Skills_Claude/domain-projectes.md` |
| Se modifica el modelo de segmento, `SubtitleEditorContext` o el editor de subtítulos | Editor de subtítulos | `Skills_Claude/domain-subtitles.md` |
| Se modifica el flujo de subida de media o la lógica de deduplicación SHA-256 | Upload de media | `Skills_Claude/domain-media-upload.md` |
| Se toca sincronización de tiempo entre media, subtítulos o waveform | Timeline / Waveform | `Skills_Claude/domain-timeline.md` |
| Se añade una ruta nueva en frontend o un endpoint nuevo en backend | Navegación y routing | `Skills_Claude/domain-routing.md` |
| Se modifica `exportToPdf` del editor de guion, el flujo de impresión a PDF o los anchors `[data-page-break-anchor]` | Export del guion a PDF | `Skills_Claude/domain-script-pdf-export.md` |
| Se modifica el sistema de presets de estilos del usuario, las CSS vars `--us-*` o cualquier componente de `frontend/components/Settings/UserStyles/` | User styles | `Skills_Claude/domain-user-styles.md` |

### Cómo crece esta tabla

Cuando se cree un nuevo subsistema con recursos compartidos:
1. Crear `Skills_Claude/domain-<nombre>.md` explicando el subsistema
2. Añadir las condiciones de activación a la tabla de arriba

No hace falta documentar subsistemas que no tienen relaciones indirectas con otros.

### Regla de auto-documentación (sin bucles)

Al terminar cualquier modificación, comprobar UNA VEZ:

1. ¿Lo que acabo de hacer introduce un recurso compartido nuevo no documentado en ningún dominio?
   → Sí: crear `Skills_Claude/domain-<nombre>.md` y añadir condiciones a la tabla.
2. ¿Lo que acabo de hacer añade funcionalidad a un dominio existente que su `.md` actual no cubre?
   → Sí: actualizar el `.md` del dominio con los archivos/pasos nuevos.

**STOP: actualizar documentación de dominio NO activa otra ronda de revisión.**
La revisión de coherencia se hace sobre los cambios funcionales, no sobre cambios en docs.
Actualizar un `.md` es el último paso, no el inicio de uno nuevo.

## 11. Estrategia de integración con aplicaciones externas

### Contexto

Este repositorio está diseñado para absorber en el futuro la lógica de otras aplicaciones relacionadas — en particular, un lector de guiones para doblaje (`script-reader-for-dubbing`) que actúa como aplicación "padre". Esa app comparte origen conceptual con Sonilab pero tiene arquitectura independiente y archivos con los mismos nombres.

Para que la integración futura no destruya código, se ha aplicado una convención de naming preventiva en este repo. Cualquier Claude que trabaje aquí debe respetar esta convención y seguir el protocolo de integración descrito en este apartado.

### Convención de naming anti-colisión

Cuando un archivo de este repo tiene o tenía el mismo nombre que un archivo de una aplicación externa que se va a integrar, se renombra en **este** repo aplicando uno de estos prefijos:

| Caso | Patrón aplicado | Ejemplo |
|------|----------------|---------|
| Componente de biblioteca compartido | prefijo `Sonilab` | `LibraryView.tsx` → `SonilabLibraryView.tsx` |
| Contexto compartido | prefijo `Sonilab` | `LibraryContext.tsx` → `SonilabLibraryContext.tsx` |
| Componente de fila de biblioteca | prefijo `Library` | `FileItem.tsx` → `LibraryFileItem.tsx` |
| Tipos globales de la app | sufijo `app` | `types.ts` → `appTypes.ts` |
| Carpeta de utils compartida | nombre descriptivo | `LectorDeGuions/` → `ScriptUtils/` |

**Archivos que NO se pueden renombrar** porque son puntos de entrada del tooling:

| Archivo | Razón |
|---------|-------|
| `App.tsx` | Entry point de React — Vite lo espera por convención |
| `index.html` | Entry point HTML |
| `index.tsx` | Entry point React DOM |
| `package.json` | Requerido por npm/Node tal cual |
| `tsconfig.json` | Requerido por TypeScript |
| `vite.config.ts` | Requerido por Vite |

Estos se fusionan **manualmente** en el momento de la integración — no se renombran.

### Qué hace la aplicación padre (script-reader-for-dubbing)

- Framework: React + Vite + react-router-dom (web, no React Native)
- Sin backend propio — todo en localStorage/AsyncStorage local
- Funcionalidad principal: lector de guiones de doblaje con anotaciones, búsqueda por personaje/take, y visualización de capas de anotación
- Los archivos de lógica pura que sí son reutilizables (y ya están integrados aquí) son:
  - `utils/ScriptUtils/indexers.ts` — indexación de personajes y takes
  - `utils/ScriptUtils/search.ts` — búsqueda de matches en texto
  - `utils/ScriptUtils/takes.ts` — rangos de takes

### Archivos de la app padre que NO se integrarán como código

Estos archivos existen en la app padre pero su lógica está implementada de forma distinta en Sonilab y **no deben mezclarse**:

| Archivo padre | Por qué no se porta |
|--------------|---------------------|
| `LibraryContext.tsx` | Usa AsyncStorage local; Sonilab usa backend NestJS |
| `LibraryView.tsx` | React Native; Sonilab usa React web con Tailwind |
| `FileItem.tsx` | React Native; Sonilab usa React web con Tailwind |
| `types.ts` (biblioteca) | Subconjunto mínimo; Sonilab tiene supertipo completo en `appTypes.ts` |
| `App.tsx` | Usa react-router-dom; Sonilab usa hash routing propio |

### Lo que sí se portará cuando llegue la integración

Los componentes propios del lector que no existen en Sonilab:

| Archivo padre | Descripción | Dónde irá en Sonilab |
|--------------|-------------|----------------------|
| `components/AnnotationCanvas.tsx` | Lienzo de anotaciones sobre el guion | `components/LectorDeGuions/` |
| `components/LayerPanel.tsx` | Panel de capas de anotación | `components/LectorDeGuions/` |
| `components/TakesByCharacterPanel.tsx` | Panel de takes por personaje | `components/LectorDeGuions/` |
| `components/HighlightedScript.tsx` | Vista de guion con highlights | `components/LectorDeGuions/` |
| `components/ConfirmTextModal.tsx` | Modal de confirmación de texto | `components/LectorDeGuions/` |
| `app/index.tsx` (EditorPage) | Página principal del lector | Adaptado como nueva vista en Sonilab |
| `app/library-manager.tsx` | Gestión de biblioteca del lector | Sustituido por la biblioteca de Sonilab |
| `types/annotation.ts` | Tipos de anotación | `types/LectorDeGuions/` |

### Protocolo de integración (cuando llegue el momento)

Seguir estos pasos en orden. No mezclar pasos.

**Paso 1 — Verificar que no hay nuevas colisiones de nombres**
Antes de portar cualquier archivo nuevo, comprobar que su nombre no coincide con ningún archivo existente en Sonilab. Si coincide, aplicar la convención de naming de la sección anterior.

**Paso 2 — Portar únicamente lógica pura (utils y types)**
Copiar los archivos de lógica sin UI a sus carpetas destino. No modificar los existentes en Sonilab. Verificar que los imports son correctos.

**Paso 3 — Portar componentes UI como módulo aislado**
Colocar los componentes del lector en `components/LectorDeGuions/`. No importar desde ellos hacia componentes de Sonilab ni al revés, salvo a través de una interfaz explícita.

**Paso 4 — Añadir la nueva vista al router**
Añadir el nuevo `OpenMode` para el lector en `appTypes.ts`. Añadir la rama de render en `App.tsx`. Añadir la ruta al hash router en `useHashRoute.ts`. Ver `domain-routing.md`.

**Paso 5 — Añadir el botón de apertura en OpenWithModal**
Solo si el documento es un tipo reconocible por el lector. Seguir el patrón existente de `isSnlbpro` para la detección.

**Paso 6 — Fusionar package.json**
Añadir solo las dependencias nuevas que el lector necesite y que no estén ya en Sonilab. No sobrescribir versiones existentes sin verificar compatibilidad.

**Paso 7 — Verificar no regresión**
Comprobar que Files, Media, Projectes, editor de subtítulos y editor de guion siguen funcionando exactamente igual que antes.

### Regla general

Cuando se porta código de otra aplicación a este repo:
1. Primero verificar nombres — aplicar convención si colisionan.
2. Portar como módulo aislado — no mezclar lógica interna.
3. Conectar por interfaz explícita (OpenMode, router, OpenWithModal) — no por imports directos entre módulos.
4. No tocar lo que ya funciona en Sonilab como efecto lateral del port.
