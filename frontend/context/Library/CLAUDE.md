# Frontend Context Library — reglas para Claude

Este archivo aplica a `frontend/context/Library/`.

## 1. Rol de esta carpeta

Aquí vive el estado base y derivado de biblioteca.  
Tócala solo cuando el problema no pueda resolverse de forma segura en componentes.

## 2. Regla principal

No cambies el contexto para arreglar un problema que sea:
- solo de render
- solo de menú contextual
- solo de toolbar
- solo de handler local
- solo de filtro de vista

Primero intenta resolverlo en `LibraryView.tsx` o `FileItem.tsx`.

## 3. currentItems

`currentItems` representa el conjunto base del folder/vista desde el contexto.  
No asumas que coincide automáticamente con el subconjunto funcionalmente visible en cada tab.

Por eso:
- no uses `currentItems` como verdad final de la vista si `LibraryView` ya aplica filtros adicionales
- si una acción debe operar sobre lo visible, usa la derivación visible correcta

## 4. Riesgos típicos

- romper selección al tocar `currentItems`
- contaminar tabs con lógica que debería ser local de `LibraryView`
- intentar resolver en contexto algo que solo afecta a `media/library/projects`
- tocar reducers por un caso que solo exigía una variable derivada local

## 5. Cuándo sí tocar esta carpeta

Solo si el problema exige de verdad:
- corregir la construcción base de `currentItems`
- corregir sincronización de estado compartido
- corregir una incoherencia imposible de resolver localmente sin duplicar lógica peligrosa

Y aun así:
- cambia lo mínimo
- no rehagas reducers
- no cambies contratos del contexto si no es necesario

## 6. No regresión

No romper:
- `currentFolderId`
- `view`
- `selectedIds`
- `TOGGLE_SELECT_ALL`
- `MOVE_ITEMS`
- restore/delete/purge
- sincronización con proyectos
