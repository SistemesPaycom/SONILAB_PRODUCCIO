# Frontend Library — contrato local para Claude

Este archivo aplica a `frontend/components/Library/`.

## 1. Modelo de datos — definiciones canónicas

### Media canónica
```ts
doc.type === 'document' && !!doc.media && !doc.refTargetId
```

### Documento clásico (Files)
```ts
doc.type === 'document' && !doc.media && !doc.refTargetId
```

### LNK
```ts
doc.type === 'document' && !!doc.refTargetId  // media siempre null
```

### Carpeta de proyecto
```ts
item.type === 'folder' && projectFolderIds.has(item.id)
```

**Importante:** `media` debe estar presente en el objeto normalizado. Si no aparece, revisar `normalizeDocument` en `LibraryDataContext.tsx` — el campo `media: d.media ?? null` debe estar incluido.

## 2. Sistema de pestañas (page)

### `page === 'library'` → pestaña "Files"
Muestra:
- Carpetas (tipo `folder`), incluyendo las de proyecto (con icono 🗃️ y formato "PROJECTE")
- Documentos clásicos (txt, srt, pdf, docx...)
- LNK

**No muestra:**
- Media canónica (`media` poblado + sin `refTargetId`)
- Documentos con `sourceType` de media aunque `media` sea null (legacy)

Filtro en `itemsToRender`:
```ts
if (item.type === 'document' && !item.refTargetId && (
  !!item.media || MEDIA_EXTS.includes((item.sourceType || '').toLowerCase())
)) return false;
```

Breadcrumb raíz: **"Files"**

### `page === 'media'` → pestaña "Media"
Muestra solo:
- Media canónica: `!doc.isDeleted && MEDIA_EXTS.includes(doc.sourceType) && !!doc.media && !doc.refTargetId`

No muestra LNK ni documentos clásicos.

Breadcrumb raíz: **"Media"**

### `page === 'projects'` → pestaña "Projectes"
En raíz: solo carpetas cuyo `id` está en `projectFolderIds`.
Dentro de una carpeta de proyecto: contenido normal de Files/LNK.

Breadcrumb raíz: **"Projectes"**

### `view === 'trash'` → Paperera
Muestra todo lo eliminado sin separación estricta de tabs.

## 3. Regla clave de render

`itemsToRender` es la fuente de verdad para lo visible.
Selección, `handleSelectAll`, `isAllSelected` y acciones de lote deben operar siempre sobre `itemsToRender`, nunca sobre `currentItems` directamente.

## 4. Breadcrumb dinámico

El breadcrumb raíz cambia según `page`:
- `library` → "Files"
- `projects` → "Projectes"
- `media` → "Media"

El `useMemo` de breadcrumbs tiene `page` en sus dependencias.

## 5. Iconos y formato por tipo de item

| Tipo | Icono | Formato |
|------|-------|---------|
| Carpeta normal | 📁 | CARPETA |
| Carpeta de proyecto | 🗃️ | PROJECTE |
| Media canónica | 🎬 / 🔊 | MP4 / WAV... |
| LNK | 📄 + overlay ↗ | LNK (MP4)... |
| Documento clásico | 📄 | SRT / TXT... |

La prop `isProject` en `FileItem` se calcula como:
```ts
isProject={item.type === 'folder' && projectFolderIds.has(item.id)}
```
Se pasa en cualquier `page`, no solo en `projects`, para que en Files también se distinga visualmente.

## 6. Acciones visibles por tipo

### Media canónica
- Sí: renombrar, borrar, preview/open
- No: copiar, cortar, pegar, duplicar (semántica de archivo clásico)

### Documento clásico
- Sí: copiar, cortar, pegar, duplicar, renombrar, borrar

### LNK
- Sí: copiar, cortar, mover, renombrar, borrar, mostrar ubicación real
- No si huérfano: abrir, mostrar ubicación real

### LNK huérfano
- No se abre (ni single click ni double click)
- Se marca visualmente como roto
- Se puede seleccionar y borrar

## 7. Flujo de subida de media — contrato cerrado

`handleSingleFileUpload` implementa dos fases:

### Fase 1 — Precheck ligero (nombre + tamaño)
- `api.checkMediaDuplicate(name, size)`
- Si coincidencia probable → modal `tentative: true`
  - "Continuar i verificar" (`handleContinueUpload`) / "Cancel·lar"
- Si no → upload directo

### Fase 2 — Verificación fuerte (SHA-256 en backend)
- Si `duplicated: true` → modal `tentative: false`
  - "Usar asset existent" / "↗ Crear accés directe" (`handleCreateRef`) / "Cancel·lar"
- Si nuevo → `reloadTree()`

### Reglas permanentes
- `parentId` siempre `null` en subidas de media
- No existe `handleForceImport`, `duplicateForceMode`, `duplicateForceName`
- Modal de duplicado confirmado NO ofrece "forzar" ni formulario de nombre
- `handleCreateRef` crea un LNK en Files apuntando al asset existente en Media

## 8. Superficies críticas

Antes de tocar algo, revisa si afecta a:
- `handleSingleFileUpload` / `handleContinueUpload` / `handleCreateRef`
- `handleClipboardPaste`
- `handleDeleteSelected` / `handlePermanentDeleteConfirmed`
- `handlePreviewDocument`
- `itemsToRender`
- toolbar / menú contextual por fila
- single click vs double click
- `breadcrumbs` (depende de `page`, `view`, `currentFolder`, `folders`)

## 9. Regla de alcance

- Si el problema puede resolverse en `LibraryView.tsx`, no toques el contexto
- Si puede resolverse en `FileItem.tsx`, no toques el backend
- Si puede resolverse con un guard local, no rediseñes la UX
