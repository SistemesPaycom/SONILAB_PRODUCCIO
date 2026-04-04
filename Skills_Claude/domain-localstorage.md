# Dominio: Persistencia local (localStorage)

## Qué es este dominio

Todas las claves de `localStorage` del frontend están centralizadas en el objeto `LOCAL_STORAGE_KEYS` de `frontend/constants.ts`. Todas usan el prefijo `snlbpro_`.

El prefijo anterior era `slsf_`. Las claves antiguas en browsers de desarrollo son órfanas inofensivas — el código ya no las lee ni escribe.

## Claves actuales

```ts
// frontend/constants.ts
export const LOCAL_STORAGE_KEYS = {
  SHORTCUTS:            'snlbpro_shortcuts',
  EDITOR_STYLES:        'snlbpro_editor_styles',
  LIBRARY_WIDTH:        'snlbpro_library_width',
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

Además, `LibraryDataContext.tsx` y `versionStore.ts` tienen sus propias claves:

```ts
// frontend/context/Library/LibraryDataContext.tsx
const LOCAL_STORAGE_KEY = 'snlbpro_library_v3';

// frontend/utils/history/versionStore.ts
const STORAGE_PREFIX = 'snlbpro_versions_';  // prefijo + docId
```

## Qué hacer si se añade o renombra una clave

1. Añadir o renombrar **solo** en `frontend/constants.ts` (objeto `LOCAL_STORAGE_KEYS`).
2. Usar siempre `LOCAL_STORAGE_KEYS.NOMBRE_CLAVE` en el código — nunca el string literal directamente.
3. Mantener el prefijo `snlbpro_` en todas las claves nuevas.
4. Si se renombra una clave existente: los datos anteriores del usuario en localStorage se pierden (reset silencioso al leer). Valorar si hace falta migración o si el reset es aceptable.
5. Actualizar este archivo.

## Limpieza de claves legacy slsf_ (si hace falta)

Para limpiar manualmente claves legacy en un browser de desarrollo:
```js
Object.keys(localStorage).filter(k => k.startsWith('slsf_')).forEach(k => localStorage.removeItem(k));
```

No hace falta hacerlo en producción salvo que se detecte conflicto real.
