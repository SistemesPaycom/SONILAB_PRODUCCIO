# Dominio: Clasificación de documentos por sourceType

## Qué es este dominio

`sourceType` es un campo string en los documentos MongoDB que indica el formato/origen del documento. Se usa para clasificación visual, detección de tipo de apertura y routing al editor correcto.

**Importante:** `sourceType` solo es parte de la clasificación. Para distinguir media canónica de LNK, ver `domain-library-model.md` — `sourceType` solo no es suficiente.

## Valores de sourceType en uso

| Valor | Qué es | Tab visible | Cómo se asigna |
|-------|--------|------------|----------------|
| `snlbpro` | Guion (PDF/DOCX importado, o creado con el editor de guion) | Files | `LibraryView.tsx` al importar PDF/DOCX; `scriptImportPipeline.ts` |
| `srt` | Subtítulos | Files | `LibraryView.tsx` al subir .srt |
| `txt` | Texto plano | Files | `LibraryView.tsx` al subir .txt |
| `pdf` | PDF original (antes de conversión — legacy) | Files | Subida directa antes de la pipeline de importación |
| `docx` | DOCX original (legacy) | Files | Subida directa antes de la pipeline de importación |
| `mp4`, `mov`, `webm` | Vídeo | Media (si `!!media && !refTargetId`) | Backend al subir media |
| `wav`, `mp3`, `ogg`, `m4a` | Audio | Media (si `!!media && !refTargetId`) | Backend al subir media |
| `slsf` | **Legacy** — nombre anterior de `snlbpro` | Files | Documentos viejos en MongoDB — no se vuelve a asignar |
| `unknown` | Fallback si la extensión no se reconoce | Files | `LibraryView.tsx` como último recurso |

## Archivos que leen o escriben sourceType

| Archivo | Qué hace con sourceType |
|---------|------------------------|
| `frontend/components/Library/LibraryView.tsx` | Asigna al crear documento (PDF/DOCX → `'snlbpro'`; .srt → `'srt'`; etc.) |
| `frontend/components/Library/FileItem.tsx` | Lee para icono y etiqueta de formato en la fila |
| `frontend/components/Library/OpenWithModal.tsx` | Detecta tipo para ofrecer el editor correcto |
| `frontend/utils/Import/scriptImportPipeline.ts` | Devuelve `sourceType: 'snlbpro'` en el resultado del pipeline |
| `frontend/context/Library/LibraryDataContext.tsx` | Lee para clasificación en `currentItems` (filtro legacy de media sin campo media) |
| `frontend/types.ts` | `SortByKey.Format = 'sourceType'` — se usa como clave de ordenación |
| `frontend/App.tsx` | Lee para decidir el modo de apertura |

## Detección con compatibilidad legacy en OpenWithModal

```ts
// frontend/components/Library/OpenWithModal.tsx
const isSnlbpro =
  doc.sourceType?.toLowerCase() === 'snlbpro'
  || doc.sourceType?.toLowerCase() === 'slsf'   // legacy MongoDB
  || doc.name.toLowerCase().endsWith('.slsf');   // legacy nombre de archivo
```

No eliminar las comprobaciones legacy hasta confirmar que no existen documentos `slsf` en producción.

## Detección de extensión en exportUtils

```ts
// frontend/utils/EditorDeGuions/exportUtils.ts
if (doc.name.endsWith('.snlbpro')) return doc.name.slice(0, -8);
if (doc.name.endsWith('.slsf')) return doc.name.slice(0, -5);  // legacy
```

## Qué hacer si se añade un sourceType nuevo

1. Asignarlo en el punto de creación del documento (LibraryView.tsx o pipeline de importación).
2. Verificar `FileItem.tsx`: ¿muestra icono y etiqueta correctos?
3. Verificar `OpenWithModal.tsx`: ¿detecta el tipo y ofrece el editor correcto?
4. Verificar `LibraryDataContext.tsx`: ¿la lógica de filtrado legacy lo clasifica correctamente en la tab correcta?
5. Si el tipo tiene extensión descargable, verificar `exportUtils.ts` y `VideoSubtitlesEditorView.tsx`.
6. Actualizar esta tabla.
