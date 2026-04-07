# Prompt para Claude: Corrección de precisión en TC IN / TC OUT y cambio de atajos

Copiale y pégale el siguiente texto íntegro a Claude para que comience a trabajar en tu petición:

***

Actúa como un experto desarrollador de React. Necesito arreglar un bug en el editor de subtítulos relacionado con los atajos de teclado para marcar el tiempo de entrada (TC IN) y tiempo de salida (TC OUT) del subtítulo activo, y mejorar su ergonomía.

## 1. El Objetivo (Lo que quiero que pase visualmente y funcionalmente)

**El problema de precisión:**
Cuando el usuario está reproduciendo el vídeo y presiona el atajo para marcar el TC IN o el TC OUT en ese instante, el código de tiempo que se aplica en el subtítulo siempre queda un poco "atrasado" respecto a la posición real visual de la barra de transporte (playhead). Pareciera que redondea a la baja o coge un tiempo anterior.

Esto sucede porque la aplicación lee el tiempo de una variable/referencia que se actualiza periódicamente mediante el evento del reproductor, en lugar de leer el milisegundo exacto de la instancia del reproductor de video nativo de HTML5 al recibir la pulsación de la tecla. Quiero que se capture el tiempo real de manera precisa y directa.

**Cambio de atajos por ergonomía:**
Actualmente los atajos por defecto para estas dos acciones son la `I` y la `O`. Esto requiere mover la mano constantemente. Para mejorar la usabilidad, quiero cambiar los atajos por defecto de `I` a `Q` (para el TC IN) y de `O` a `W` (para el TC OUT). 
Obviamente, al ser letras sin modificadores (sin Ctrl, Alt, etc.), esto **no debe ejecutarse** si el foco del usuario está dentro de un campo de texto editable y se encuentra escribiendo el subtítulo. 

---

## 2. Informe Técnico y Posibles Conflictos a Resolver

> **NOTA IMPORTANTE PARA TI, CLAUDE:** Por favor, no tomes mi lectura e informe del código como la verdad absoluta. Úsalo solo como punto de partida y contexto acelerador. Utiliza encarecidamente tus herramientas `superpowers debug` (y tal vez `code-review` si es pertinente) para ejecutar tu propio análisis sobre los componentes afectados, verificando que nada se desajuste en el flujo.

### Bug de Desfase de Tiempo
En el archivo principal del editor, `VideoSubtitlesEditorView.tsx` (en `frontend/components/VideoSubtitlesEditor`), las funciones responsables (`handleSetTcIn` y `handleSetTcOut`) están obteniendo el instante así:

```typescript
const t = currentTimeRef.current;
```

`currentTimeRef.current` se nutre de la limitación del evento del reproductor (hasta ~250ms de desfase real en el evento nativo `timeupdate`).

La solución pasaría por forzar la lectura del componente de vídeo subyacente que reacciona de maravilla. Hay una referencia llamada `videoRef` en el mismo componente:

```typescript
const t = videoRef.current ? videoRef.current.currentTime : currentTimeRef.current;
```

Asegúrate de comprobar cómo acceder a este valor, su scope, y aplicarlo.

### Cambio de Atajos I/O a Q/W
1. Tienes que ir a `constants.ts` (posiblemente en `frontend/constants.ts`) y buscar la asignación constante de atajos (`DEFAULT_SHORTCUTS`). Allí verás la sección `subtitlesEditor`, con el ID `sub_set_tc_in` con `I` y el ID `sub_set_tc_out` con `O`. Cámbialos por `Q` y `W`.

2. **Evitar colisiones:** Verifica que en ese mismo archivo no hay otra acción importante asignada a `Q` o `W` que pueda pisarse.

3. **Protección al escribir texto:** La prevención de ejecución accidental al escribir texto ya parece existir en el Hook global `hooks/useKeyboardShortcuts.ts`, validando si `target.tagName === 'INPUT'`, `TEXTAREA` o `target.isContentEditable`. Como `keyName.length === 1`, aborta correctamente la combinación de las teclas únicas con `return`. Confirma que esto funciona bien y protege la `Q` y `W` exactamente igual que lo hacía con la `I` y la `O`.

Por favor, empieza utilizando las herramientas de debug para verificar el scope de `videoRef` en `VideoSubtitlesEditorView.tsx` y analizar `constants.ts` / `useKeyboardShortcuts.ts`. Confirma que tienes el contexto, avísame de los archivos en los que tienes pensado actuar y plantéame el Action Plan claro antes de alterar el código fuente.
