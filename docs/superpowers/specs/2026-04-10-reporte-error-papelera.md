# Informe Técnico: Error de Visualización en la Papelera desde la pestaña Media

Este informe detalla el error detectado en la funcionalidad de la "Paperera" (Papelera) cuando se accede desde diferentes pestañas del sistema (Files, Media, Projectes). Se describe la causa raíz, el comportamiento erróneo y las posibles soluciones técnicas.

## 1. Contexto Funcional (Para Claude)

El sistema tiene una barra de navegación superior con tres pestañas principales para gestionar archivos: **Files** (Biblioteca general), **Projectes** (Proyectos) y **Media** (Archivos de vídeo/audio). También existe un botón de **Paperera** que, al pulsarlo, debería mostrar todos los elementos que han sido eliminados (soft-delete).

### El Problema
- Cuando el usuario está en la pestaña **Files** y pulsa **Paperera**, la papelera se visualiza correctamente con sus archivos eliminados.
- Cuando el usuario está en la pestaña **Media** y pulsa **Paperera**, la vista resultante aparece vacía, incluso si hay una gran cantidad de archivos eliminados en el sistema.

### Objetivo
Asegurar que el botón de la Papelera de la barra superior siempre muestre el contenido eliminado, independientemente de la pestaña en la que se encontrara el usuario previamente.

---

## 2. Informe Técnico Detallado

### Análisis del Código Actual

El componente principal que gestiona esta vista es `SonilabLibraryView.tsx`. El estado de la vista se controla mediante dos variables principales:
1. `page`: Puede ser `'library'`, `'media'` o `'projects'`. Define en qué pestaña "lógica" estamos.
2. `view`: Puede ser `'library'` o `'trash'`. Define si estamos viendo archivos activos o eliminados.

#### Causa Raíz
El error reside en la lógica de filtrado de elementos para renderizar (`itemsToRender`) dentro de `SonilabLibraryView.tsx` (líneas 430-447 aprox.).

```tsx
// frontend/components/Library/SonilabLibraryView.tsx

430:   const itemsToRender = page === 'media'
431:     ? state.documents.filter(
432:         (doc) => !doc.isDeleted && MEDIA_EXTS.includes((doc.sourceType || '').toLowerCase()) && !!(doc as any).media && !(doc as any).refTargetId
433:       )
434:     : currentItems.filter((item) => {
435:         if (view === 'trash') return true;
...
```

**Explicación del fallo:**
1. Cuando se activa la pestaña Media, la función `goMedia` establece `page = 'media'`.
2. Al pulsar el botón de la Papelera, la función `goTrash` cambia el estado `view = 'trash'`, pero **no modifica** el estado `page`.
3. El operador ternario de la línea 430 evalúa `page === 'media'` como `true`.
4. El sistema ejecuta la línea 432, que tiene un filtro explícito `!doc.isDeleted`. Esto provoca que se sigan listando los archivos de Media activos, ignorando por completo el estado `view === 'trash'`.
5. Como la vista de la Papelera usa un `renderEmptyState` si no hay items, y probablemente el layout de la papelera no coincide con el de media activos en ese contexto (o simplemente no hay coincidencia de filtros), el usuario percibe que la papelera está vacía.

### Comportamiento en otras pestañas
- En **Files** (`page = 'library'`) y **Projectes** (`page = 'projects'`), el ternario va por la rama del `else` (línea 434), donde la primera instrucción del filtro es `if (view === 'trash') return true;`. Esto permite que la papelera funcione correctamente en esos casos.

### Posibles Soluciones

#### Opción A: Modificar el flujo de navegación (Recomendado por simplicidad)
Actualizar la función `goTrash` para que reinicie la página a `'library'` al entrar en la papelera.

```tsx
const goTrash = () => {
  dispatch({ type: 'SET_VIEW', payload: 'trash' });
  setIsCollapsed(false);
  setPage('library'); // Esta línea solucionaría el conflicto del ternario
};
```

#### Opción B: Modificar la lógica de filtrado (Más robusto)
Priorizar el estado `view === 'trash'` sobre el estado de la página en el cálculo de `itemsToRender`.

```tsx
const itemsToRender = view === 'trash'
  ? currentItems.filter(item => true) // O usar la lógica de currentItems que ya maneja isTrash
  : page === 'media'
    ? state.documents.filter(doc => !doc.isDeleted && ...)
    : currentItems.filter(...);
```

### Posibles Conflictos y Riesgos
- **Pérdida de Contexto**: Si el usuario espera ver *solo* los archivos de media eliminados al pulsar papelera desde Media, la Opción A lo llevará a la papelera global. Sin embargo, el diseño actual del programa parece tratar la Papelera como un contenedor único global.
- **Projectes**: Si se pulsa Papelera desde Proyectos, actualmente se ven todos los documentos eliminados, no solo carpetas de proyectos. Hay que decidir si esto es el comportamiento deseado (normalmente sí en este tipo de apps).

---

## 3. Guía para Claude (Superpowers Debug/Code-Review)

Para el agenteClaude que vaya a implementar esto, se le deben dar las siguientes instrucciones:

> **Instrucciones de Implementación:**
> 
> 1. **Análisis Profundo**: Utiliza tus herramientas de `debug` y `code-review` para validar que el ternario en `SonilabLibraryView.tsx` es efectivamente el único punto de bloqueo. 
> 2. **Verificación de Contextos**: Asegúrate de que al arreglar la vista de Media, no rompas el filtrado especial de la pestaña **Projectes**, que depende de `projectFolderIds`.
> 3. **Consistencia en Breadcrumbs**: Verifica que el componente de *Breadcrumbs* (migas de pan) refleje correctamente "Paperera" independientemente del origen.
> 4. **Pruebas Cruzadas**: Verifica el comportamiento cambiando entre Files -> Papelera, Media -> Papelera y Projectes -> Papelera.
> 5. **No asumas al 100%**: Este informe es un análisis preliminar. Usa tus capacidades de análisis de código para detectar si existen dependencias ocultas en `SonilabLibraryContext.tsx` o `LibraryDataContext.tsx` que afecten a la sincronización del estado `page` vs `view`.

---
*Informe generado por Antigravity - 2026-04-10*
