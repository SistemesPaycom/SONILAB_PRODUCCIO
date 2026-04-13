# Informe Técnico: Persistencia de Pestañas en el Explorador de Archivos

Este informe detalla la causa raíz y la solución propuesta para el problema de pérdida de estado de la pestaña activa (Files, Media, Projects) tras el refresco de la aplicación.

## 📝 Resumen para Claude (Funcionalidad)

Actualmente, cuando un usuario navega por las pestañas del explorador (Files, Media, Projects) y recarga la página, el sistema siempre vuelve por defecto a la pestaña de **Files**. Esto ocurre porque la aplicación no "recuerda" en qué pestaña estaba el usuario antes de la recarga.

**Objetivo:**
Modificar el sistema de navegación lateral para que la pestaña activa se guarde de forma persistente. Al recargar, la aplicación debe consultar este valor guardado y restaurar la pestaña correspondiente (si no se encuentra dentro de un editor).

---

## 🔍 Análisis Técnico Detallado

### 1. Estado Duplicado y No Persistente
Se ha identificado que el estado `page` (que controla la pestaña activa) está definido de forma independiente en dos lugares, y en ninguno de ellos se persiste:

*   **`App.tsx` (Línea 283):** 
    ```tsx
    const [page, setPage] = useState<'library' | 'media' | 'projects'>('library');
    ```
*   **`SonilabLibraryView.tsx` (Línea 110):**
    ```tsx
    const [page, setPage] = useState<'library'|'media'|'projects'>('library');
    ```

### 2. Desconexión de Props
En `App.tsx`, el componente `LibraryView` se invoca pasando `page` y `onChangePage` como props, pero la interfaz `LibraryViewProps` en `SonilabLibraryView.tsx` **no incluye estos campos**. Como resultado, el componente `LibraryView` utiliza su propio estado local interno, ignorando lo que le llega del padre.

### 3. Falta de Persistencia en localStorage
A diferencia de otros parámetros (como `libraryWidth`), el estado `page` no utiliza el hook `useLocalStorage`. Al reiniciar el ciclo de vida de React (refresco), el valor vuelve a su valor inicial hardcodeado: `'library'`.

---

## 🛠️ Solución Propuesta

### Paso A: Unificación y Persistencia del Estado
1.  **En `constants.ts`:** Añadir una nueva clave en `LOCAL_STORAGE_KEYS` para la pestaña activa (ej: `ACTIVE_PAGE: 'snlbpro_active_page'`).
2.  **En `App.tsx`:** Cambiar el `useState` por `useLocalStorage` para la variable `page`.
3.  **En `SonilabLibraryView.tsx`:** 
    *   Actualizar la interfaz `LibraryViewProps` para incluir `page` y `onChangePage`.
    *   Eliminar el estado local `page` interno del componente.
    *   Utilizar las props del padre para asegurar que solo haya una "fuente de verdad".

### Paso B: Refactorización de la Navegación
Asegurarse de que las funciones `goLibrary`, `goMedia` y `goProjects` dentro de `LibraryView` llamen a la prop `onChangePage` para que el cambio se suba al padre y se guarde en `localStorage`.

---

## ⚠️ Posibles Conflictos y Observaciones

*   **Conflictos de Renderizado:** Al unificar el estado, hay que asegurarse de que `App.tsx` reaccione correctamente al cambio para no resetear estados innecesarios.
*   **Integración con Editor:** El sistema de `useHashRoute` ya maneja la persistencia de los Editores. Hay que asegurar que la restauración de la pestaña solo ocurra cuando el hash no indique que estamos dentro de un documento.
*   **Herramientas para Claude:** 
    > [!IMPORTANT]
    > Se recomienda a Claude utilizar sus capacidades de **`superpowers debug`** y **`code-review`** para validar la integridad de la interfaz de props entre `App.tsx` y `LibraryView.tsx`, ya que existen discrepancias actuales en el código.

---

## 📂 Archivos Involucrados
*   [App.tsx](file:///d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend/App.tsx)
*   [SonilabLibraryView.tsx](file:///d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend/components/Library/SonilabLibraryView.tsx)
*   [constants.ts](file:///d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend/constants.ts)
