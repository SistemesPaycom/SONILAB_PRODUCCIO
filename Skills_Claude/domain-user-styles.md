# Dominio: User Styles (estilos del usuario)

## Qué es

Capa de personalización tipográfica por usuario para tres zonas de la app:
- Editor de guiones (`ColumnView`)
- Editor de subtítulos (`SegmentItem`, `TimecodeInput`, `SubtitlesEditor`)
- Inici/llibreria (`SonilabLibraryView`, `LibraryFileItem`)

Es **independiente** del sistema de temas (admin). Los temas controlan colores globales, los user styles controlan tipografía/tamaño/color **del texto** de cada elemento concreto, y cada usuario tiene los suyos.

## Archivos clave

- `frontend/types/UserStyles/userStylesTypes.ts` — shape `UserStylesPayload`
- `frontend/context/UserStyles/UserStylesContext.tsx` — provider, presets, debounce backend
- `frontend/context/UserStyles/applyUserStylesToDOM.ts` — emisor de CSS vars `--us-*`
- `frontend/context/UserStyles/factoryStyles.ts` — valores de fábrica
- `frontend/context/UserStyles/userStylesMigration.ts` — `loadOrMigrate` desde legacy
- `frontend/components/Settings/UserStyles/` — UI del panel (StylesTab, panels, previews, atom editor, preset bar)
- Backend: `user.preferences.userStyles` (PATCH /auth/me, sin endpoint nuevo)

## CSS variables emitidas

- `--us-script-{take,speaker,timecode,dialogue,dialogueparen,dialoguetcparen}-{family,size,color,weight,style}`
- `--us-sub-{content,timecode,idcps,takelabel,charcounter,actionbuttons}-{family,size,color,weight,style}`
- `--us-home-{filename,format,datetime,tableheader,navtabs,breadcrumb}-{family,size,color,weight,style}`
- Derivadas (no editables, calculadas en `computeSubtitleMetrics` / `computeSubGridCols`):
  - `--us-sub-row-height`
  - `--us-sub-row-padding-y`
  - `--us-sub-grid-columns`

## Persistencia

- **Backend**: `user.preferences.userStyles` (objeto JSON con `version: 1` y los 3 scopes). Se guarda con `PATCH /auth/me` debounced 1500ms.
- **Cache local**: `snlbpro_user_styles_<userId>` (scoped por usuario). Se reescribe en cada cambio para arranque inmediato y modo offline.
- **Sync entre ventanas**: `UserStylesProvider` escucha el evento `storage` y reaplica el payload cuando otra ventana del mismo userId modifica la cache local. Esto es lo que mantiene sincronizada la `ScriptExternalView` (que vive en una ventana separada y monta su propio provider).

## Qué hacer cuando…

### …se añade un elemento nuevo a un editor que debe ser personalizable

1. Añadir el atom al `StyleSetMap` correspondiente en `userStylesTypes.ts`.
2. Añadir su valor de fábrica en `factoryStyles.ts` (debe reproducir el aspecto actual).
3. Añadir el `emitAtomVars` correspondiente en `applyUserStylesToDOM.ts`.
4. Sustituir los hardcodes en el componente que lo renderiza por `var(--us-...)`.
5. Añadir el `StyleAtomEditor` en el panel correspondiente (`ScriptStylesPanel.tsx`, `SubtitleStylesPanel.tsx`, `HomeStylesPanel.tsx`).
6. Actualizar el preview correspondiente (`*StylePreview.tsx`).
7. **Bumpear `version` del payload** si el cambio es incompatible con shape v1.

### …cambia el shape de un atom (ej. añadir `lineHeight`)

1. Bumpear `version: 1 → 2` en `userStylesTypes.ts` y en `buildInitialPayload`.
2. En `userStylesMigration.ts`, añadir una rama en `loadOrMigrate` que detecta `version: 1` y la transforma a `version: 2`.
3. Verificar que `loadOrMigrate` aplica la migración antes de devolver.

### …se añade un scope nuevo (ej. `videoEditor`)

1. Añadir el tipo `XxxStyleSet` en `userStylesTypes.ts`.
2. Añadirlo al `StyleSetMap` y al `UserStylesPayload`.
3. Añadir factory en `factoryStyles.ts`.
4. Añadir las variables en `applyUserStylesToDOM.ts`.
5. Crear `XxxStylesPanel.tsx` y `XxxStylePreview.tsx`.
6. Añadir sub-pestaña en `StylesTab.tsx`.
7. Bumpear `version` y añadir migración.

## Reglas no negociables

- **No leer estilos del usuario directamente desde localStorage** desde un componente — usar siempre el contexto vía `useUserStyles()` o las CSS vars `--us-*`.
- **No mezclar tema admin con user styles**: el tema controla `--th-*` (colores globales de UI), los user styles controlan `--us-*` (tipografía concreta del usuario).
- **El preset 'Per defecte' (`builtin: true`) no se borra ni se renombra**, solo se restablece a fábrica con "Restablir".
- **`snlbpro_editor_styles` no se borra del localStorage** — está marcada como `@deprecated` y solo se lee como fuente para la migración inicial.
- **Cualquier cambio del shape requiere bumpear la `version`** del payload y añadir lógica de migración.
- **Los componentes NUNCA deben recibir `editorStyles` como prop**. Esa prop legacy fue eliminada. Si necesitas estilos en un componente nuevo, lee directamente las CSS vars con `style={{ fontFamily: 'var(--us-...)', ... }}`.

## Refactor de fragilidad del editor de subtítulos

`SegmentItem.tsx` y `SubtitlesEditor.tsx` tenían valores hardcoded que rompían el layout cuando se cambiaba el tamaño de fuente. El refactor los hizo dinámicos:

- `ROW_HEIGHT` → `var(--us-sub-row-height)` (calculado del max fontSize de los atoms de subs).
- `gridTemplateColumns` → `var(--us-sub-grid-columns)` (calculado en píxeles según la fuente y familia de cada columna).
- `estimateSize` del virtual scroll → `subtitleRowEstimate` del context (`useUserStyles()`), con `useEffect(() => virtualizer.measure(), [subtitleRowEstimate])` para reposicionar cuando cambia.

`SrtPreviewView.tsx` (vista solo lectura del SRT) NO se incluyó en el refactor — sigue con valores hardcoded.

## Relación con otros dominios

- `domain-localstorage.md`: registra la clave `snlbpro_user_styles_<userId>`.
- `domain-subtitles.md`: el refactor de `SegmentItem` y `SubtitlesEditor` para usar `--us-sub-*` afecta el modelo del editor de subtítulos. Cualquier cambio de estructura del grid debe coordinarse con `applyUserStylesToDOM.ts:computeSubGridCols`.
- `domain-script-pdf-export.md`: el export de PDF clona el DOM con estilos inline aplicados, así que los cambios de estilos del editor de guiones se reflejan automáticamente en el PDF — no hay que hacer nada extra.
