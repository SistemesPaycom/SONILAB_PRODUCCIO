# Informe de Análisis: Mejoras en Navegación y Gestión de Archivos 📁

Este informe detalla el funcionamiento actual y las propuestas de mejora para la funcionalidad de arrastrar a carpetas (breadcrumb) y el sistema de portapapeles (copiar/cortar/pegar) en la vista de biblioteca.

## Resumen para Claude (Contexto de Implementación)

El objetivo es mejorar la experiencia de usuario (UX) en la gestión de archivos y carpetas. Actualmente, el sistema de arrastrar y soltar (Drag & Drop) está limitado a las carpetas visibles en la lista, pero no permite mover objetos a carpetas superiores usando la ruta (breadcrumbs) de la parte superior. Además, el menú de acciones ("tres puntitos") es inconstante: solo aparece cuando hay una selección, y la opción de "Pegar" aparece fuera de este menú. 

Se busca unificar el menú de acciones para que sea **siempre visible** en la barra de herramientas superior, mostrando todas las opciones ("Copiar", "Cortar", "Pegar", "Mover") pero manteniéndolas deshabilitadas (o gestionando su visibilidad) según el estado de la selección y el portapapeles. Asimismo, se debe extender la funcionalidad de arrastrar para que los elementos del breadcrumb actúen como destinos válidos.

---

## Análisis Técnico Detallado

### 1. Funcionalidad de Arrastrar y Soltar (Breadcrumbs)

#### Estado Actual
La lógica de arrastrar se implementa de forma personalizada en [LibraryFileItem.tsx](file:///d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend/components/Library/LibraryFileItem.tsx). 
- El sistema utiliza `document.elementFromPoint` durante el `mousemove` para detectar qué elemento está bajo el cursor.
- Solo reconoce como destinos válidos aquellos elementos que tienen el atributo `data-droptarget="true"`.
- En [SonilabLibraryView.tsx](file:///d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend/components/Library/SonilabLibraryView.tsx#L985-L1002), los botones que componen el breadcrumb no poseen este atributo ni el ID de la carpeta correspondiente.

#### Propuesta de Solución
- **Modificar `SonilabLibraryView.tsx`**: Añadir los atributos necesarios a los botones del breadcrumb:
  ```tsx
  <button 
      data-droptarget="true"
      data-id={crumb.id} // El ID de la carpeta destino
      onClick={() => ...}
      ...
  >
      {crumb.name}
  </button>
  ```
- **Revisión de `LibraryFileItem.tsx`**: La lógica existente en `onMouseMove` (líneas 174-211) debería funcionar automáticamente una vez añadidos los atributos, ya que busca el `.closest('[data-droptarget="true"]')`.

#### Posibles Conflictos
- **Media Canónica**: Existe una protección en el código (línea 100 de `LibraryFileItem.tsx`) que impide mover archivos de "media canónica" (archivos reales de vídeo/audio que no son accesos directos). Se debe mantener esta seguridad o adaptarla si se desea permitir el movimiento controlado.
- **Recursividad**: El sistema ya valida que no se mueva una carpeta dentro de sí misma o de sus descendientes (líneas 109-116 de `LibraryFileItem.tsx`).

### 2. Unificación del Menú de Acciones (Toolbar Menu)

#### Estado Actual
El menú de la barra de herramientas se renderiza condicionalmente en [SonilabLibraryView.tsx](file:///d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend/components/Library/SonilabLibraryView.tsx):
- Línea 878: Se comprueba `selectedIds.size > 0` para mostrar los botones de acción.
- Línea 937: El botón de "Engantxar" (Pegar) aparece solo si no hay selección y hay algo en el portapapeles.

#### Propuesta de Solución
- **Menú Siempre Visible**: Extraer el botón de los tres puntos (`⋯`) de las condiciones actuales para que se renderice siempre en la cabecera.
- **Acciones Dinámicas**: Dentro del menú, las opciones deben mostrarse u ocultarse (o deshabilitarse) dinámicamente:
  - **Copiar/Cortar/Mover**: Visibles/Habilitadas solo si `selectedIds.size > 0`.
  - **Engantxar**: Visible/Habilitada solo si `clipboard !== null`.
- **Integración**: Mover el contenido de `handleClipboardPaste` y demás lógica al nuevo menú unificado.

#### Reglas de Negocio a Respetar
- **Protección de Media**: Actualmente no se permite copiar ni mover assets de media canónica vía portapapeles para evitar duplicación de binarios pesados (líneas 645-653 y 670-675 de `SonilabLibraryView.tsx`). Si se intenta hacer, el sistema muestra un error sugiriendo "Crear referencia". **Esta lógica debe preservarse.**

---

## Instrucciones para Claude (Superpowers)

> [!IMPORTANT]
> Al implementar estas mejoras, utiliza tus herramientas de **`superpowers debug`** y **`code-review`** para asegurar que la nueva lógica del menú no rompa las validaciones de seguridad existentes (especialmente las relativas a media canónica y recursividad de carpetas).
> 
> Realiza un análisis exhaustivo de `SonilabLibraryView.tsx` para identificar todas las dependencias del estado `selectedIds` y `clipboard` antes de refactorizar el menú. Asegúrate de que el componente Breadcrumb sea visualmente receptivo cuando un elemento sea arrastrado sobre él (clase `drop-hover`).

## Archivos Clave a Modificar
- [SonilabLibraryView.tsx](file:///d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend/components/Library/SonilabLibraryView.tsx): Gestión del breadcrumb, estado del menú y lógica de portapapeles.
- [LibraryFileItem.tsx](file:///d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend/components/Library/LibraryFileItem.tsx): Validación de compatibilidad en el arrastre.
