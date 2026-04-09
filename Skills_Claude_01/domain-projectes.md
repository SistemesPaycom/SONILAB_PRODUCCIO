# Dominio: Módulo Projectes

## Qué es este dominio

Projectes es una capa funcional propia del producto. No es simplemente una carpeta más. Un proyecto relaciona:
- una carpeta de trabajo (visible también en Files)
- un asset de media vinculado (`mediaDocumentId`)
- un SRT vinculado (opcional)
- un guion (opcional)
- estado de procesamiento / preparación / revisión

## Cómo se identifica una carpeta de proyecto

En el frontend, `projectFolderIds` es un `Set<string>` que contiene los IDs de carpetas que son proyectos. Se calcula a partir del estado de proyectos del backend.

```ts
// frontend/components/Library/LibraryView.tsx
const [projectFolderIds, setProjectFolderIds] = useState<Set<string>>(new Set());
```

Una carpeta es de proyecto si: `item.type === 'folder' && projectFolderIds.has(item.id)`.

## Visibilidad en las tabs

| Tab | Qué muestra |
|-----|------------|
| Projectes (`page === 'projects'`) | Solo carpetas cuyo `id` está en `projectFolderIds` |
| Files (`page === 'library'`) | Todas las carpetas incluyendo las de proyecto, con icono 🗃️ y formato "PROJECTE" |
| Media | Nunca muestra carpetas de proyecto |

## Breadcrumb

- `page === 'projects'` → breadcrumb muestra "Projectes"
- `page === 'library'` → breadcrumb muestra "Files"

## Archivos involucrados

| Archivo | Rol |
|---------|-----|
| `frontend/components/Library/LibraryView.tsx` | `projectFolderIds` state, lógica de `itemsToRender` para tab Projectes, render del icono 🗃️ |
| `frontend/context/Library/LibraryDataContext.tsx` | Base de carpetas y documentos; `currentItems` que LibraryView filtra |
| `frontend/components/Projects/` | Componentes de la UI de proyectos (CreateProjectModal, etc.) |
| `backend_nest_mvp/src/modules/projects/` | API de proyectos — fuente de verdad de `projectFolderIds` |

## Qué hacer si se toca este dominio

- **Se modifica cómo se cargan los proyectos desde backend** → verificar que `projectFolderIds` se actualiza correctamente y que las dos tabs (Projectes y Files) siguen mostrando las carpetas correctas.
- **Se modifica `itemsToRender` para la tab Projectes** → no romper la visualización en Files (las carpetas de proyecto también deben verse en Files con su icono).
- **Se modifica la creación de proyectos** → verificar que el `mediaDocumentId` del proyecto apunta a media canónica real (`!!doc.media && !doc.refTargetId`).
- **Se toca delete/purge de carpetas** → verificar que al borrar una carpeta de proyecto no queda el proyecto huérfano en el backend sin carpeta.

## Reglas de no regresión

- Projectes no se fusiona con Media ni con Files.
- `projectFolderIds` es readonly desde la perspectiva de LibraryView — se actualiza desde el estado de proyectos del backend, nunca se manipula directamente con acciones locales.
- Las carpetas de proyecto son visibles en Files. Eso es correcto y no debe eliminarse.
- No simplificar ni refactorizar Projectes sin encargo explícito.
