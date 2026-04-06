# Dominio: Export del guion a PDF

## Qué es este dominio

La exportación del editor de guion (vista "Guió" en modos `mono`, `cols`) a PDF. Incluye el botón de exportar del Toolbar, la función `exportToPdf` y el contrato de lo que debe contener el PDF resultante.

## Archivos implicados

| Archivo | Rol |
|---------|-----|
| `frontend/utils/EditorDeGuions/exportUtils.ts` | Contiene `exportToPdf` (nueva, print-to-pdf) y `exportToPdfLegacyCanvas` (aislada, no se usa). También el resto de exports (txt, xlsx, csv1, csv2). |
| `frontend/components/EditorDeGuions/Toolbar.tsx` | Único consumer de `exportToPdf`. Llama desde `handleExport` cuando `editorView === 'script'` y `layout !== 'mono'`. |
| `frontend/components/EditorDeGuions/ColumnView.tsx` | Emite los anchors `[data-page-break-anchor="true"]` en cada `<section>` de TAKE. El CSS de impresión los usa para no cortar takes por la mitad. |
| `frontend/App.tsx` | Define los contenedores `#page-content-area` y `#page-content-area-video` que `exportToPdf` clona. |
| `frontend/index.html` | Carga `html2canvas` y `jspdf` via CDN (ya no usados por el export actual, pero presentes para la versión legacy aislada). |

## Contrato funcional del PDF exportado

El PDF resultante DEBE:
1. **Ser texto real** — buscable con Ctrl+F, seleccionable, anotable en Edge/Chrome. No puede ser imagen.
2. **Conservar tipografía y colores** del editor — fontFamily, fontSize, colores por tipo (`take`, `speaker`, `timecode`, `dialogue`, `dialogueParentheses`, `dialogueTimecodeParentheses`). Los paréntesis con números/timecodes tienen estilo distinto a los paréntesis con texto.
3. **Conservar alineación** — speaker a la derecha, dialogue a la izquierda, grid de dos columnas con el ancho definido por `col1Width` del editor.
4. **No cortar un TAKE por la mitad** — el salto de página debe caer entre TAKEs (en la línea superior del siguiente TAKE), no dentro de un TAKE.
5. **Tener márgenes fijos** — 15 mm arriba/abajo, 12 mm laterales. Formato A4 vertical.
6. **No incluir** el fondo oscuro de la app, el shadow del page, ni el focus ring de contentEditable.

## Arquitectura actual (nueva)

`exportToPdf` crea un `<iframe>` oculto fuera del viewport, clona `#page-content-area` (o `#page-content-area-video`), copia todas las `<style>` del documento principal al iframe (incluyendo el CSS generado por Tailwind CDN JIT, accesible via `document.styleSheets` porque es inline), añade un bloque propio de CSS de impresión con `@page`, `break-inside: avoid` y resets del contenedor, y llama `iframe.contentWindow.print()`.

El navegador renderiza el HTML directamente a PDF con su motor nativo (PDFium/Skia). El usuario ve el diálogo de impresión y elige "Guardar como PDF".

**Ventajas frente a la versión legacy:**
- Texto real → se cumplen los requisitos 1 y 2 del contrato.
- Sin límite de `RangeError: Invalid string length` de V8 (la legacy petaba con guiones de ~200+ takes porque jsPDF concatena el PDF en una sola string JS).
- Sin dependencia de `html2canvas` / `jspdf`.
- Escala a guiones de cualquier tamaño.

**Contrapartida:**
- Un click extra para el usuario (elegir "Guardar como PDF" en el diálogo del navegador). Se consideró aceptable a cambio de tener texto real.

## Versión legacy aislada

`exportToPdfLegacyCanvas` está al final de `exportUtils.ts` con `@deprecated`, **sin exportar**. No se llama desde ningún sitio. Se conserva solo como referencia histórica.

Usa `html2canvas` + `jsPDF.addImage('PNG')` → PDFs 100% imagen. **No usar nunca.** Problemas:
- Rompe Ctrl+F, selección de texto y anotaciones textuales.
- `RangeError: Invalid string length` en guiones grandes (`pdf.save()` concatena todo el contenido en una string JS que supera los ~512 MB del límite de V8).

Si se decide eliminarla en el futuro, se pueden también quitar los scripts `html2canvas` y `jspdf` de `index.html` — ningún otro archivo del frontend los referencia.

## Cuándo tocar este dominio

**Tocar `exportToPdf` si:**
- Se cambian márgenes, formato de página o reglas de salto.
- Se añaden nuevas clases/estilos al editor que deben aparecer en el PDF y no aparecen (revisar si la copia de stylesheets las captura).
- Se añade un nuevo contenedor `#page-content-area-xxx` en otra vista que también debe ser exportable.
- Las fuentes custom no se cargan en el iframe (revisar el `<base>` y el await `fonts.ready`).

**NO tocar si:**
- Se añade un nuevo tipo de export no-PDF (txt, xlsx, csv) → va en su propia función.
- Se cambia el estilo del editor (colores, fuentes, grid) → `exportToPdf` clona el DOM tal cual, no hay que tocar nada aquí.

## Qué hacer ante cambios relacionados

### Si se cambia la estructura del ColumnView

Verificar que `[data-page-break-anchor="true"]` sigue estando en cada `<section>` de TAKE (línea 518 de `ColumnView.tsx` aprox.). Sin ese atributo, el CSS `break-inside: avoid` no protege los TAKEs y se cortan por la mitad.

### Si se añade una nueva vista con su propio editor

Añadir el nuevo id (`#page-content-area-newview`) al selector del reset en el CSS de impresión dentro de `exportToPdf`. También al `getElementById` inicial como fallback.

### Si se elimina la función legacy

1. Borrar `exportToPdfLegacyCanvas` del archivo.
2. Eliminar `declare const html2canvas: any;` y `declare const jspdf: any;` del principio de `exportUtils.ts`.
3. Eliminar los `<script>` de `html2canvas` y `jspdf` del `index.html`.
4. Verificar con grep que no quedan referencias.

### Si Tailwind cambia de CDN a build estático

`document.styleSheets` seguirá incluyendo las hojas — si son mismo origen, la copia `cssRules` funciona igual; si no, el fallback `<link href>` se activa. Probar ambos caminos.

## Verificación rápida tras cambios

1. Abrir un guion de cualquier tamaño (idealmente grande, 100+ takes).
2. Vista "Guió" → "Columnes".
3. Click en exportar. Debe abrirse el diálogo de impresión del navegador.
4. Elegir "Guardar como PDF" → guardar.
5. Abrir el PDF en Edge o Chrome:
   - **Ctrl+F** debe encontrar palabras del guion.
   - Seleccionar una línea con el ratón debe seleccionar texto real.
   - Los colores de los paréntesis de timecode deben ser distintos a los paréntesis normales.
   - Los TAKEs no deben quedar partidos entre páginas.
   - Los márgenes deben verse consistentes.
