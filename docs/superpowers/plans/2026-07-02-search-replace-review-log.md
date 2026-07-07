# Log de revisiones — Cerca i substitució a l'editor de subtítols

Bucle ralph de revisión iterativa de spec + plan. Condiciones de salida: 2 revisiones consecutivas con 0 BUG, o 3 consecutivas solo-MINOR.

## Iteración 1 — 2026-07-02

Tres revisores adversariales en paralelo: (A) lógica pura ejecutada realmente, (B) contraste con código real del repo, (C) coherencia spec↔plan.

**BUG confirmados: 2** (ambos corregidos)
1. [C-1] `closeSearchBar` no restauraba el focus al contenedor del editor como promete spec §4.1. → Corregido: `scrollContainerRef.current?.focus()` + `tabIndex={-1}` en el contenedor de scroll (plan Task 3 Steps 3 y 5).
2. [C-2] Ctrl+F con la barra ya abierta re-prefilaba el término con la selección (spec §4.1 dice solo re-enfocar). → Corregido: guard `if (searchOpen)` en `handleShortcutAction`.

**MINOR confirmados: 11** (todos corregidos salvo los marcados como aceptados)
- [A-1] NBSP en el query (prefill desde DOM con `&nbsp;`) no se normalizaba → normalización del needle en `findMatchesInText` + test nuevo + spec §5.2 ampliada.
- [A-2] NBSP literales invisibles en el código del plan → sustituidos por escapes ` ` explícitos (módulo y tests).
- [B-1] Ressaltat en mode lectura puede no pintarse (contentEditable no hidratado con `!isEditable`) → documentado como caveat en spec §9 y plan Task 5.
- [B-2] Nota sobre AuthContext imprecisa (solo re-escribe localStorage si el perfil tiene shortcuts) → reformulada en plan Task 4.
- [B-3] Ancla falsa en Task 4 Step 2 (`.custom-scrollbar` no vive en index.html) → corregida.
- [B-5]/[C-9] `handleReplaceAll` devolvía `matches.length` ignorando la guarda defensiva → devuelve `count` acumulado.
- [B-6]/[C-4] Posición del botón lupa: spec alineada con el plan (entre sync y separador).
- [C-3] Criterio de case-folding: spec alineada con el plan (conservar carácter original).
- [C-5] Prefill: plan ahora exige ancestro `[contenteditable]` (alineado con spec §4.1).
- [C-6] Nota de idempotencia §7.3: añadida la normalización NBSP del segmento tocado.
- [C-7] Estilo de toggles activos: spec alineada con patrón real B/I/U (`--th-text-inverse`).
- [C-8] Mensaje singular agramatical → «S'ha fet 1 substitució».
- [I-1] Spec §2 ambigua sobre a qué botón aplica el mensaje → aclarado (solo Substituir-ho tot).
- Aceptados sin cambio: [A-3] whole-word con query de bordes no-palabra (spec-compliant), [B-4] `@types/react` ausente (baseline del repo), [A-2-bis] comptador durante la ventana de debounce de 150 ms (imperceptible).

**Verificación de lógica**: script del plan ejecutado de verdad → 39/39 OK; +36 casos límite extra OK (surrogates, İ, offsets fuera de rango, tokens opacos, replacement con \n, tags adyacentes/huérfanos).

**Resultado iteración 1: 2 BUG + 11 MINOR → no converge. Sigue iteración 2.**

## Iteración 2 — 2026-07-02

Dos revisores: (A) re-ejecución real de la lógica del plan corregido, (B) revisión fresca completa spec+plan contra el repo.

**Verificación de lógica**: 40/40 OK (script del plan, extraído por bytes) + 12 casos extra OK (NBSP query × caseSensitive/wholeWord, replacement con NBSP). La rama `caseSensitive` usa el query normalizado — correcto.

**BUG confirmados: 2** (ambos corregidos)
1. Ctrl+F con el foco en el input «Substituir per...»: `stopPropagation` ocultaba el evento al listener global y el navegador abría su buscador nativo. → Corregido: rama Ctrl+F en `handleReplaceKeyDown` que devuelve el foco al campo de cerca (plan Task 2) + fila nueva en spec §9.
2. La «correspondencia exacta» texto visible↔DOM era falsa con tokens no canónicos (`<font>`: `plainToRich` los muestra como texto literal; `toVisibleText` los elimina) → el ressaltat se pintaría desplazado. → Corregido: helper `domVisibleLength` + guard en el efecto (si las longitudes no cuadran, el segmento no se pinta; cerca/comptador/substitució siguen funcionando) + spec §6.2/§9 reescritas.

**MINOR confirmados: 3** (corregidos)
- Notas falsas sobre `.custom-scrollbar` (no tiene regla propia en ningún sitio) en spec §6.2 y plan Task 4 → reescritas.
- Fondo del fallback (sin Highlight API) puede quedar tapado por fondos propios del bloque → documentado como aceptado en spec §9.
- Replacement con U+00A0 pegado queda como NBSP crudo (aceptable, offsets 1↔1) → comentario de `VisChar` ajustado.

**Resultado iteración 2: 2 BUG + 3 MINOR → no converge. Sigue iteración 3.**

## Iteración 3 — 2026-07-02

Un revisor con ojos frescos, revisión completa (lógica ejecutada + código it2 + coherencia + formato).

**Verificación de lógica**: 40/40 OK (extracción por bytes) + 13 casos adversariales extra OK (surrogates, İ, tokens opacos trailing, offsets fuera de rango, «a»→«aa», NBSP en replacement). Código de it2 (guard `domVisibleLength`, Ctrl+F en fila 2, docstring) verificado correcto contra `plainToRich` real, con simulaciones de longitud para NBSP/multilínea/`<font>`.

**BUG confirmados: 1** (corregido)
1. El efecto de scroll dependía de la identidad del array `matches` (nuevo en cada pulsación dentro de cualquier contentEditable) → teclear con la barra abierta arrastraba el viewport hacia la coincidencia activa en cada tecla, contra spec §6.1. → Corregido: deps derivadas de la POSICIÓN de la activa (`activeMatchSeg`/`activeMatchStart`/`activeMatchIndex`), no del array.

**MINOR confirmados: 2** (corregidos)
- Esc con el foco en un botón/toggle de la barra no cerraba (spec §4.1 promete «focus dins de la barra») → `onKeyDown` de Escape en el contenedor de la barra.
- Glifo del toggle de palabra completa: sketch de spec `|ab|` vs botón `[ab]` → sketch alineado; retirada también la analogía imprecisa «com el de selecció múltiple» en §6.2.

**Formato**: fences balanceados, línea reparada de §6.2 verificada, sin placeholders, escapes ` ` correctos en todo el código.

**Resultado iteración 3: 1 BUG + 2 MINOR → no converge. Sigue iteración 4.**

## Iteración 4 — 2026-07-02

Un revisor con ojos frescos; lógica ejecutada (40/40 + 26 casos adversariales extra OK; módulo limpio con `tsc --strict` standalone) y simulación fiel a React del efecto de scroll de it3.

**BUG confirmados: 1** (corregido)
1. La corrección de scroll de it3 era incompleta: el efecto seguía disparándose cuando una edición desplazaba el índice o el `start` de la activa (doble scroll con frame de índice caducado al añadir una ocurrencia en un bloque anterior; re-centrado en cada tecla al editar antes del match en el propio bloque). → Corregido con el rediseño «scroll por intención» validado por simulación (8/8): `pendingScrollRef` marcado por término/opciones nuevos y por Substituir; scroll dentro del efecto de re-anclaje solo si hay intención pendiente; scroll imperativo en `gotoMatch`; eliminado el efecto dependiente de posición.

**MINOR confirmados: 2** (corregidos)
- Enter/▼ con una sola coincidencia no re-scrolleaba a ella tras scroll manual → resuelto por el scroll imperativo incondicional de `gotoMatch`.
- Quedaban 3 NBSP crudos en comentarios del módulo (plan líneas 154/179, spec línea 100) → sustituidos por la mención explícita «U+00A0» (los NBSP entre backticks en prosa se conservan deliberadamente).

**Resultado iteración 4: 1 BUG + 2 MINOR → no converge. Sigue iteración 5.**

## Iteración 5 — 2026-07-03

Un revisor con ojos frescos; lógica ejecutada (40/40 + 17 extra OK, `tsc --strict` limpio) y simulación fiel a React del mecanismo «scroll por intención» de it4 (escenarios a-j: 21/24 OK). Los bugs de scroll de it3/it4 quedan confirmados como cerrados (escenarios b, c, d, i, j correctos).

**BUG confirmados: 2** (ambos corregidos)
1. Sustituir por texto idéntico (terme == substitució): `commitHistory` hace bail por igualdad profunda → sin re-render → `pendingScrollRef` queda huérfano → la siguiente edición en cualquier bloque scrollea el viewport. → Corregido: guard `newRaw === originalText` en `handleReplaceOne` que no toca flags y salta a la siguiente con `gotoMatch` (comportamiento Word); fila nueva en spec §9.
2. Cambiar de término re-ancla por continuidad de posición, pero spec §6.1 prometía «primera coincidència d'un terme nou». → Resuelto por opción A (alinear spec): la continuidad de posición es el comportamiento Word/VSCode y mejor UX; spec §5.3 y §6.1 reescritas.

**MINOR confirmados: 1** (corregido)
- Spec §6.1 no documentaba el mecanismo por intención (scroll también en canvi d'opcions y Substituir; garantía de no-scroll al editar) → §6.1 reescrita íntegramente.

**Resultado iteración 5: 2 BUG + 1 MINOR → no converge. Sigue iteración 6.**

## Iteración 6 — 2026-07-03

Un revisor con ojos frescos; lógica ejecutada (40/40 + 17 casos del guard de it5 OK; barrido exhaustivo 8 raws × rangos × 9 replacements confirmando que `out === raw` solo ocurre en no-ops exactos), anclas del repo verificadas, formato limpio.

**BUG confirmados: 0.**

**MINOR confirmados: 1** (corregido)
- La fila de spec §9 «Substituir amb resultat idèntic» prometía «no es fa cap commit» bajo una condición («terme == substitució en text pla») que no lo garantiza: si la re-serialización normaliza el segmento (forma per-línia, U+00A0, tags desequilibrados) o el match difiere en mayúsculas, sí hay commit. → Fila reescrita con la condición exacta (byte-idéntico) y los subcasos.

**Resultado iteración 6: 0 BUG + 1 MINOR → primera revisión sin bugs (racha 0-BUG: 1/2; racha solo-MINOR: 1/3). Sigue iteración 7.**

## Iteración 7 — 2026-07-03 (revisión de confirmación)

Lógica ejecutada: 40/40 OK + 37 casos adversariales nuevos OK (metacaracteres regex literales, ß/ẞ vs İ, surrogates, inserción pura, tokens opacos arrastrados, los 6 subcasos de la fila §9); `tsc --strict` aislado limpio. Fila §9 de it6 verificada exacta por ejecución. Flujo de UI punta a punta y anclas del repo: limpios. Formato: limpio.

**BUG confirmados: 0.**

**MINOR confirmados: 1** (corregido)
- Contador «0 de N» visible ~1 frame cuando `matches` pasa a no-vacío antes de que el efecto de re-anclaje fije `activeMatchIndex` → clamp `Math.max(0, activeIndex) + 1` en el span del comptador (Task 2).

**Resultado iteración 7: 0 BUG + 1 MINOR → segunda revisión consecutiva con 0 BUG.**

## CONVERGENCIA — 2026-07-03

Condición de salida (a) cumplida: 2 revisiones consecutivas (it6, it7) sin ningún BUG confirmado. El bucle termina tras 7 iteraciones (9 BUG y 19 MINOR corregidos en total). Siguiente paso: ejecución del plan con superpowers:subagent-driven-development.
