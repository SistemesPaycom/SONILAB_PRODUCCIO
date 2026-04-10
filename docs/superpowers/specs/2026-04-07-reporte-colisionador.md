# Prompt para Claude: Refactorización Subtítulos y Colisionador

Copiale y pégale el siguiente texto íntegro a Claude para que comience a trabajar en tu petición:

***

Actúa como un experto desarrollador de React y experto en experiencia de usuario (UX). Necesito mejorar la usabilidad visual y funcional del editor de subtítulos en el Frontend de mi aplicación.

## 1. El Objetivo de UX (Lo que quiero que pase visualmente)

Actualmente, al intentar editar una línea de texto de un bloque de subtítulos, debes hacer clic exactamente encima del propio texto. Esto es muy incómodo. 

Lo ideal sería que el "colisionador" (la zona que rodea el texto y permite interaccionar con él o entrar a modo edición) se expanda desde el inicio del texto hacia la derecha, ocupando todo el ancho de la línea hasta casi tocar la derecha del panel de subtítulos general (dejando un poco de margen por estética, parándose un poco antes).

El comportamiento exacto esperado que necesito sería:
- **Si la línea de subtítulo TIENE texto (incluido si solo se trata de un simple espacio en blanco):** El colisionador ocupará desde el principio hasta casi el final de la derecha de su celda.
- **Si la línea de subtítulo ESTÁ TOTALMENTE VACÍA:** El colisionador deberá comprimirse y ocupar solo el espacio equivalente a 1 carácter.

Esto tiene un propósito clave: quiero que el usuario final, solo con pasear y flotar el ratón encima de las líneas, distinga si un bloque de subtítulo tiene en verdad 2 líneas (donde la segunda sea solo un "espacio en blanco" metido intencionalmente con la barra espaciadora para mover arriba la primera línea sin escribir texto real) o si la segunda línea está cruda y vacía realmente (no ocuparía espacio y el colisionador se vería como de 1 caracter). Todo esto sin obligarles a meter comandos sucios como `<br>`.

---

## 2. Informe Técnico y Posibles Conflictos a Resolver

> **NOTA IMPORTANTE PARA TI, CLAUDE:** Por favor, no tomes mi lectura e informe del código como la verdad absoluta. Úsalo solo como punto de partida y contexto acelerador. Utiliza encarecidamente tus herramientas `superpowers debug` (y tal vez `code-review` si es pertinente) para ejecutar tu propio análisis sobre los componentes afectados, verificando que nada se desajuste en el flujo.

El renderizado y edición de estas celdas y filas está centralizado en el componente llamado `SegmentItem.tsx`. Funciona basado en CSS Grid (`--us-sub-grid-columns`), donde la columna 5 suele alojar al texto interactivo.

Actualmente, el contenedor de la línea que causa incomodidad es algo así:
```tsx
<div style={gridCellStyle} className="px-2 relative">
  <div
    contentEditable={isEditable}
    className={`outline-none whitespace-nowrap transition-colors ...`}
    ...
  />
</div>
```
Al tener un `whitespace-nowrap` y ser un bloque, el colisionador clickable queda atascado al tamaño del propio texto renderizado, sin expandirse.

**Problemas detectados y advertencias que debes vigilar en tu análisis:**

1. **Gestión agresiva (y problemática) de los Espacios (`.trim()`)**:
   Dentro de `SegmentItem.tsx`, parece haber funciones encargadas de leer el DOM editable de vuelta al estado (como `getLinePlain`). Esa función actualmente corta el texto al vuelo, aplicándole un método `.trim()`. 
   **Esto es una alerta roja:** Si el usuario teclea simplemente un `ESPACIO` en una línea vacía para forzar que el SRT guarde un bloque de dos líneas (y que nuestro visualizador expansivo se active al considerar que "ahora esa línea ya tiene texto"), el `.trim()` destrozará este espacio limpiándolo y devolviéndolo a 0. Verifica e investiga cómo readaptar sutilmente la captura de este input, para que si un renglón es 100% un espacio de la barra espaciadora, **no desaparezca** y conserve su estatus de "texto" intencional en la línea.

2. **Propiedades CSS adaptativas**:
   Estudia cómo inyectar la lógica en las prop CSS `className` del editable según su contenido. Posible guía a explorar (sin descartar grid/flex alternativo):
   - Línea con algo (string length > 0): Clases del tipo `w-[calc(100%-24px)] block`.
   - Línea verdaderamente vacía a 0 chars: Clases del tipo `w-[1ch] inline-block` limitadas a la izquierda.

Por favor, empieza utilizando las herramientas de debug para analizar a fondo `SegmentItem.tsx`, y la función de sincronización que pueda estar destruyendo caracteres vacíos (los espacios limpios). Confirma que tienes el contexto, avísame de los archivos en los que tienes pensado actuar y plantéame el Action Plan claro antes de alterar el código fuente.
