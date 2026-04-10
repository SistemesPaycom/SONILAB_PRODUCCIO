# Reporte de Alineación y Grid del Editor de Subtítulos

## 📋 Parte 1: Explicación y Prompt para Claude

Hola Claude, necesito optimizar el editor de subtítulos, empleando la herramienta `superpowers debug` y posteriormente un `code-review` para comprobar los cambios. 

Tenemos que arreglar problemas de alineación y reestructurar elementos visuales del grid con el fin de eliminar la "barra extra" que aparece debajo de las líneas de los subtítulos actualmente, comprimiendo visualmente cada bloque sin dejar "líneas vacías" molestas. 

Requisitos conceptuales:
1. **Reubicación de Botones (Toolbar)**: Todas las acciones deben colocarse en los espacios disponibles laterales para así poder eliminar la barra subyacente. 
   - Las flechas para "crear subtítulo arriba o abajo" (+↑ y +↓) muévelas a la izquierda del todo, en la fila de arriba (misma fila donde pone el número del subtítulo).
   - Justo debajo de estas (en la segunda fila de la izquierda), coloca el "Split" (identificado con una "S") y el "Merge" (identificado con una "U").
   - La "X" para eliminar el subtítulo muévela a la esquina inferior también (o un lugar lógico a la izquierda/derecha debajo), eliminando la barra que originalmente los contenía a todos.
2. **Alineación Vertical (Texto vs Caracteres CPL)**: El texto del subtítulo está visualmente desfasado hacia abajo comparado con el mostrador de caracteres por línea. Tienen que estar perfectamente alineados.
3. **Alineación Horizontal (Códigos de tiempo IN/OUT)**: Los timecodes deben estar justificados. Al cambiar el tamaño de la letra, el texto IN y el texto OUT no mantienen la misma alineación porque la palabra "OUT" ocupa más espacio que "IN", desplazando horizontalmente los números. Quiero que el "IN" justifique a la izquierda, pero force al texto inferior a ubicarse exactamente por debajo "como si estuvieran enlazados en After Effects".

Claude, revisa el reporte técnico escrito a continuación con pistas para tu análisis antes de realizar cualquier cambio:

---

## 💻 Parte 2: Informe Técnico Detallado (Para analizar con Claude)

### Ubicación de la refactorización:
* **Archivo de Segmentos:** `frontend/components/VideoSubtitlesEditor/SegmentItem.tsx`
* **Archivo de Tiempo:** `frontend/components/VideoSubtitlesEditor/TimecodeInput.tsx`

### 1. Reubicación del Toolbar (Botones extra)
* **Estado Actual:** Existe un section en `SegmentItem.tsx` (cerca de la línea 646) renderizado *fuera* de la iteración del grid ( `isEditable && (<div className="flex items-center gap-0.5 mt-0.5 pt-0.5 border-t...">`) que provoca ese gran espaciado inferior.
* **Propuesta Técnica:** Este bloque debe ser totalmente eliminado. Los botones requeridos (Añadir Antes, Añadir Después, Split, Merge, Delete) deben inyectarse al inicio de las iteraciones de la celda de la **Columna 1** `(TaKe + DIFF)` o **Columna 2** `(#id y CPS)`. 
  * Para iteración 0 (`i === 0`): Mostrar Botones de Añadir (+↑ / +↓).
  * Para iteración 1 (`i === 1`): Mostrar Botón Split ("S"), Merge ("U") y Delete ("x").
* **Advertencia de Conflictos:** El contenedor de las columnas tiene estilos definidos globales mediante variables CSS (`var(--us-sub-grid-columns)`). Al mover los botones dentro de columnas existentes como la de `#id`, podrías causar que el contenido se expanda asincrónicamente o se desborde. Una posible solución será agrupar los componentes usando posicionamiento `relative / absolute` si se desplaza en `hover` sobre una celda inicial, o crear un cluster flexbox alineado con el ID, sin romper el grid subyacente. 

### 2. Alineación Vertical (Problema Text vs CPL)
* **Estado Actual:** 
  * En la iteración que renderiza el CPL (Columna 4), el contenedor usa utilidades que centran el elemento (`flex items-center`).
  * En la iteración que renderiza el Texto del subtítulo Editable (Columna 5), el `contentEditable` no está bajo un flujo `flex` que centralice, sino que el contenedor de texto en sí mismo utiliza un padding (`py-0.5 px-1.5`) y un `minHeight` / `lineHeight` forzado globalmente. Este micro-padding `py-0.5` sobreescribe el enraizado natural del baseline y es el que baja el texto unos píxeles debajo de su CPL adyacente.
* **Propuesta Técnica:** Retirar u homogeneizar los paddings en forma de Y (`py-0.5`) de la Columna 5, o alinear el padre (Columna 5) para usar un comportamiento `flex items-center / place-content-center` idéntico a la columna del CPL para que compartan la misma línea base independientemente del tamaño de fuente por defecto.

### 3. Alineación Horizontal de Timecodes
* **Estado Actual:** Dentro del componente `TimecodeInput.tsx`, la etiqueta del Input *"IN" ó "OUT"* está envuelta en un span (`labelEl`) con el diseño `<span className="px-1 rounded flex-shrink-0 select-none">`. Al no tener un ancho definido, HTML asume el min-content. "OUT" es un carácter más largo que "IN". En la interfaz, esto empuja el contador `00:00:00:00` y al cambiar el tamaño de letra en variables CSS, provoca asimetría total en el eje X para la cifra de los números resultantes.
* **Propuesta Técnica:** El `labelEl` que contiene "IN" / "OUT" debe tener una anchura forzada y relativa (`ch`) (ejemplo: `w-[3.5ch]`) con `text-center` o `text-left`, para que ambas celdillas midan exactamente lo mismo. Gracias a esto, el timecode generador a su derecha empezará a renderizarse siempre desde el mismo "eje X fijo" del componente contenedor sin importar si la viñeta superior tiene 2 caracteres (IN) y la inferior posee 3 caracteres (OUT).
* **Advertencia de Conflictos:** Asegurate de testear la variable de tamaño de fuente (`--us-sub-timecode-size`); usar unidades `ch` asegura que la escala se mantiene unida a la tipografía y es preferible frente a usar píxeles rudos (`w-10`) para no romper el aspecto responsivo. 
