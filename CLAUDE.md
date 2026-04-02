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
