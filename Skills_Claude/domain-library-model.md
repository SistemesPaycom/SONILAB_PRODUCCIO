# Dominio: Modelo de biblioteca (Files / Media / Projectes / Paperera)

## Qué es este dominio

El sistema de biblioteca clasifica todos los documentos y carpetas en cuatro vistas:
`Files` (library), `Media`, `Projectes` y `Paperera` (trash).

La clasificación **no** depende de en qué carpeta esté el documento, sino de los campos `media`, `refTargetId` e `isDeleted` del documento en MongoDB, más el estado `projectFolderIds` en el frontend.

## Definiciones canónicas

```ts
// Media canónica: tiene campo media poblado y NO es LNK
const isCanonicalMedia = (doc) => !!doc.media && !doc.refTargetId;

// LNK: referencia a media; refTargetId apunta al doc canónico
const isLnk = (doc) => !!doc.refTargetId;

// LNK huérfano: su target ya no existe o está borrado
const isOrphanLnk = (doc, allDocs) =>
  isLnk(doc) && !allDocs.find(d => d.id === doc.refTargetId && !d.isDeleted);
```

Nunca basar clasificación solo en `sourceType` — no es fiable para distinguir media canónica de LNK.

## Constante MEDIA_EXTS

```ts
// frontend/components/Library/LibraryView.tsx
const MEDIA_EXTS = ['mp4', 'mov', 'webm', 'wav', 'mp3', 'ogg', 'm4a'];
```

Se usa para detección legacy de media canónica por extensión (documentos anteriores a que el campo `media` fuera obligatorio).

## itemsToRender — lógica de filtrado por tab

Definido en `frontend/components/Library/LibraryView.tsx`:

```ts
const itemsToRender = page === 'media'
  ? documents.filter(doc =>
      !doc.isDeleted
      && MEDIA_EXTS.includes((doc.sourceType || '').toLowerCase())
      && !!doc.media && !doc.refTargetId
    )
  : page === 'projects'
  ? currentItems.filter(item =>
      item.type === 'folder' && projectFolderIds.has(item.id)
    )
  : currentItems.filter(item => {
      // Files: excluir media canónica y documentos legacy de media
      if (item.type === 'document' && !item.refTargetId && (
        !!item.media || MEDIA_EXTS.includes((item.sourceType || '').toLowerCase())
      )) return false;
      return true;
    });
```

`itemsToRender` es la fuente de verdad para render, selección (`handleSelectAll`, `isAllSelected`) y acciones de lote. Nunca operar sobre un subconjunto diferente.

## Estado compartido

| Variable | Dónde vive | Qué controla |
|----------|-----------|-------------|
| `page` | `App.tsx` (useState) | Tab activa: 'library' \| 'media' \| 'projects' |
| `currentFolderId` | `LibraryDataContext` reducer | Carpeta navegada en Files |
| `view` | `LibraryDataContext` reducer | 'library' \| 'trash' |
| `currentItems` | `LibraryDataContext` (useMemo) | Base filtrada por carpeta/trash desde el contexto |
| `projectFolderIds` | `LibraryView.tsx` (useState<Set<string>>) | IDs de carpetas que son proyectos |
| `selectedIds` | `LibraryDataContext` reducer | Set de IDs seleccionados |

## Archivos involucrados

| Archivo | Rol |
|---------|-----|
| `frontend/components/Library/LibraryView.tsx` | `itemsToRender`, `projectFolderIds`, todas las acciones |
| `frontend/context/Library/LibraryDataContext.tsx` | `currentItems`, `currentFolderId`, `view`, `selectedIds`, reducers |
| `frontend/context/Library/LibraryContext.tsx` | Contratos del contexto compartido |
| `frontend/components/Library/FileItem.tsx` | Render de cada fila; lee `isProject`, `sourceType`, `refTargetId` |
| `frontend/types.ts` | `Segment`, `ViewType`, `SortByKey`, `SortOrder`, `OpenMode` |

## Qué hacer si se toca este dominio

- **Se añade un tipo de documento nuevo** → verificar que `itemsToRender` lo clasifica correctamente en cada tab; verificar que `FileItem.tsx` lo renderiza con el icono/formato correcto.
- **Se modifica `isCanonicalMedia` o `isLnk`** → revisar que delete/purge siga protegiendo LNK activos; revisar `OpenWithModal.tsx`; revisar `SyncLibraryModal.tsx`.
- **Se toca `currentItems`** → verificar que selección (`selectedIds`, `TOGGLE_SELECT_ALL`) no se rompe; verificar que tabs no se contaminan entre sí.
- **Se toca `projectFolderIds`** → ver también `domain-projectes.md`.

## No romper

- `currentFolderId` al cambiar de tab (se pone a null al cambiar `view`)
- `selectedIds` al recargar `currentItems`
- `TOGGLE_SELECT_ALL` opera sobre `itemsToRender`, no sobre `currentItems`
- `MOVE_ITEMS` no debe mezclar media canónica entre tabs
- restore / delete / purge con conjunto total efectivo
