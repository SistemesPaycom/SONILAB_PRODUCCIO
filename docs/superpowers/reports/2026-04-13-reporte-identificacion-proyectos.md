# Informe Detallado: Detección Persistente de Proyectos en la Biblioteca

Este informe analiza el comportamiento actual del sistema de archivos y proyectos, identificando por qué los proyectos se visualizan inicialmente como carpetas genéricas en la pestaña **Files** y proporcionando una hoja de ruta para su corrección.

---

## Explicación para Claude (Guía de Implementación)

> [!NOTE]
> Esta sección está diseñada para ser leída por un agente de IA para realizar las mejoras necesarias sin entrar en detalles técnicos de implementación inmediata.

Actualmente, existe una inconsistencia visual en la biblioteca de archivos: los proyectos (que son carpetas especiales con metadatos de proyecto) aparecen con el icono de carpeta estándar (`📁`) cuando se accede por primera vez a la pestaña **Files**. Sin embargo, una vez que el usuario entra en la pestaña **Projectes** y regresa a **Files**, esas mismas carpetas cambian su apariencia a "Projecte" con un icono distintivo (`🗃️`).

**Objetivo:**
Asegurar que las carpetas que son proyectos sean identificadas y renderizadas correctamente como tales desde el primer momento en que se carga la aplicación, independientemente de si el usuario ha visitado la pestaña de proyectos o no.

**Acciones requeridas:**
1.  **Centralizar el estado de proyectos:** La información sobre qué ID de carpeta corresponde a un proyecto debe estar disponible de forma global en el contexto de la biblioteca (`LibraryContext`), no solo de forma local en el componente de vista.
2.  **Carga proactiva:** El listado de proyectos debe recuperarse al inicializar la aplicación o al recargar el árbol de archivos, no solo cuando se activa la pestaña de proyectos.
3.  **Sincronización:** Asegurar que cualquier cambio en la estructura de archivos (borrados, renombrados, recargas) mantenga sincronizada la lista de IDs de proyectos.

---

## Análisis Técnico y Diagnóstico

### Componentes Involucrados

1.  **`SonilabLibraryView.tsx`**: Gestiona el estado local `projectFolderIds` y el efecto de carga.
2.  **`LibraryFileItem.tsx`**: Renderiza cada elemento individualmente basándose en la prop `isProject`.
3.  **`SonilabLibraryContext.tsx` / `LibraryDataContext.tsx`**: Proveen el estado base de la biblioteca pero actualmente carecen de la noción de "qué es un proyecto".

### Error Identificado (Bug de Estado Local)

El problema reside en la definición de la carga de proyectos en `SonilabLibraryView.tsx`:

```tsx
// frontend/components/Library/SonilabLibraryView.tsx L164-171
useEffect(() => {
  if (!useBackend || page !== 'projects') return; // <-- BLOQUEO AQUÍ
  api.listProjects()
    .then((projects) => {
      setProjectFolderIds(new Set((projects || []).map((p: any) => p.folderId).filter(Boolean)));
    })
    .catch(() => {});
}, [useBackend, page]);
```

El efecto solo se ejecuta si `page === 'projects'`. Como el estado inicial de `page` es `'library'`, la lista `projectFolderIds` permanece vacía hasta que el usuario cambia de pestaña. 

Posteriormente, en el renderizado de los ítems en `SonilabLibraryView.tsx` (L1290):

```tsx
isProject={projectFolderIds.has(item.id)}
```

Si el Set está vacío, `isProject` es falso, y `FileItem.tsx` muestra el icono y etiqueta de carpeta genérica.

### Conflictos y Posibles Errores

1.  **Persistencia tras Reload:** Al recargar la página (`F5`), el estado de React se pierde. Si no se invoca el fetch al inicio, el problema persiste en cada inicio de sesión.
2.  **Rendimiento:** Invocar `api.listProjects()` cada vez que se cambia de pestaña podría ser redundante. Es mejor integrarlo en la lógica de `reloadTree()`.
3.  **Race Conditions:** Si se carga el árbol de archivos muy rápido pero la lista de proyectos tarda, el usuario verá un "brincado" de iconos (de carpeta a proyecto).

---

## Soluciones Propuestas

### Solución A: Elevación de Estado al Contexto (Recomendado)

Mover `projectFolderIds` al `LibraryDataContext.tsx`.

1.  **Modificar `LibraryDataState`** para incluir `projectFolderIds: Set<string>`.
2.  **Actualizar `reloadTree`** en `LibraryDataContext.tsx` para que realice ambos fetchs (`getTree` y `listProjects`) y actualice el estado simultáneamente.
3.  **Ventaja:** Los datos están disponibles para cualquier componente (incluso breadcrumbs o modales) y se mantienen sincronizados con las recargas del árbol.

### Solución B: Carga Genérica en View

Modificar el `useEffect` en `SonilabLibraryView.tsx` eliminando la restricción de página.

```tsx
useEffect(() => {
  if (!useBackend) return;
  api.listProjects()
    .then((projects) => {
      setProjectFolderIds(new Set((projects || []).map((p: any) => p.folderId).filter(Boolean)));
    });
}, [useBackend]); // Se ejecuta al montar el componente una sola vez
```

---

## Guía para la Revisión de Código (Code-Review)

Para el agente encargado de la corrección (Claude), se recomienda encarecidamente:

1.  **Usar `superpowers debug`**: Verificar la respuesta de la red para confirmar que `api.listProjects()` devuelve los `folderId` correctos.
2.  **`code-review`**: Revisar si otros componentes dependen de esta lógica local y si el cambio al contexto requiere actualizar las acciones del reducer (`LibraryDataAction`).
3.  **Validar modo Offline**: El sistema tiene un modo sin backend (`useBackend === false`). Asegurarse de que la lógica no rompa la persistencia en `localStorage`.

> [!IMPORTANT]
> No asumas que solo `SonilabLibraryView` necesita el cambio. Centralizarlo en el Contexto es la vía más robusta para evitar este tipo de *state-glitches* en el futuro.
