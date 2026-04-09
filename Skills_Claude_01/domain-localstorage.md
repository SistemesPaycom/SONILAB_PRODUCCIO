# Dominio: Persistencia local (localStorage)

## Qué es este dominio

Todas las claves de `localStorage` del frontend están centralizadas en el objeto `LOCAL_STORAGE_KEYS` de `frontend/constants.ts`. Todas usan el prefijo `snlbpro_`.

El prefijo anterior era `slsf_`. Las claves antiguas en browsers de desarrollo son órfanas inofensivas — el código ya no las lee ni escribe.

## Claves actuales

```ts
// frontend/constants.ts
export const LOCAL_STORAGE_KEYS = {
  SHORTCUTS:            'snlbpro_shortcuts',
  EDITOR_STYLES:        'snlbpro_editor_styles',  // DEPRECATED — solo lectura para migración legacy
  LIBRARY_WIDTH:            'snlbpro_library_width',
  LIBRARY_NAME_COL_WIDTH:   'snlbpro_library_name_col_width',
  LIBRARY_FORMAT_COL_WIDTH: 'snlbpro_library_format_col_width',
  LIBRARY_DATE_COL_WIDTH:   'snlbpro_library_date_col_width',
  TAKE_MARGIN:          'snlbpro_take_margin',
  TAKE_START_MARGIN:    'snlbpro_take_start_margin',
  MAX_LINES_SUBS:       'snlbpro_max_lines_subs',
  SUB_GRID_OPACITY:     'snlbpro_sub_grid_opacity',
  WAVEFORM_HOLD_MS:     'snlbpro_waveform_hold_ms',
  AUTOSAVE_SRT:         'snlbpro_autosave_srt',
  TASKS_TRANSLATION:    'snlbpro_tasks_translation',
  TASKS_TRANSCRIPTION:  'snlbpro_tasks_transcription',
  SRT_EDITOR_MODE:      'snlbpro_srt_editor_mode',
  EDITOR_MIN_GAP_MS:    'snlbpro_editor_min_gap_ms',
  THEME:                'snlbpro_theme',
  CUSTOM_THEME_TOKENS:  'snlbpro_custom_theme_tokens',
};
```

Además, `LibraryDataContext.tsx`, `versionStore.ts` y `UserStylesContext.tsx` tienen sus propias claves:

```ts
// frontend/context/Library/LibraryDataContext.tsx
const LOCAL_STORAGE_KEY = 'snlbpro_library_v3';

// frontend/utils/history/versionStore.ts
const STORAGE_PREFIX = 'snlbpro_versions_';  // prefijo + docId

// frontend/context/UserStyles/userStylesMigration.ts
const USER_STYLES_LOCAL_STORAGE_PREFIX = 'snlbpro_user_styles_';  // prefijo + userId (scoped per user)
```

## Estilos del usuario (snlbpro_user_styles_<userId>)

Cada usuario tiene su propio JSON de presets de estilos tipográficos en una clave scoped por userId. Lo gestiona `UserStylesContext`. La clave antigua `snlbpro_editor_styles` está marcada como `@deprecated` en `constants.ts` — solo se lee como fuente para la migración inicial cuando un usuario nuevo arranca con la versión nueva. Ver `domain-user-styles.md`.

## Qué hacer si se añade o renombra una clave

1. Añadir o renombrar **solo** en `frontend/constants.ts` (objeto `LOCAL_STORAGE_KEYS`).
2. Usar siempre `LOCAL_STORAGE_KEYS.NOMBRE_CLAVE` en el código — nunca el string literal directamente.
3. Mantener el prefijo `snlbpro_` en todas las claves nuevas.
4. Si se renombra una clave existente: los datos anteriores del usuario en localStorage se pierden (reset silencioso al leer). Valorar si hace falta migración o si el reset es aceptable.
5. Actualizar este archivo.
6. **Factory Reset**: decidir si la nueva clave debe restablecerse al "factory reset" (Settings → General). Si sí, añadirla a la lista `KEYS_TO_REMOVE` de `frontend/utils/factoryReset.ts`. Si no (porque es trabajo del usuario, datos del documento, o la sesión), dejarla fuera de esa lista y añadir un comentario aquí explicando por qué. Ver `docs/superpowers/specs/2026-04-07-reset-configuracio-frontend.md` para el criterio completo.

## Limpieza de claves legacy slsf_ (si hace falta)

Para limpiar manualmente claves legacy en un browser de desarrollo:
```js
Object.keys(localStorage).filter(k => k.startsWith('slsf_')).forEach(k => localStorage.removeItem(k));
```

No hace falta hacerlo en producción salvo que se detecte conflicto real.
