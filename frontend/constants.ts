import { AppShortcuts, Shortcut } from './appTypes';

export const LOCAL_STORAGE_KEYS = {
  SHORTCUTS: 'snlbpro_shortcuts',
  EDITOR_STYLES: 'snlbpro_editor_styles',
  LIBRARY_WIDTH: 'snlbpro_library_width',
  TAKE_MARGIN: 'snlbpro_take_margin',
  TAKE_START_MARGIN: 'snlbpro_take_start_margin',
  MAX_LINES_SUBS: 'snlbpro_max_lines_subs',
  SUB_GRID_OPACITY: 'snlbpro_sub_grid_opacity',
  WAVEFORM_HOLD_MS: 'snlbpro_waveform_hold_ms',
  AUTOSAVE_SRT: 'snlbpro_autosave_srt',
  TASKS_TRANSLATION: 'snlbpro_tasks_translation',
  TASKS_TRANSCRIPTION: 'snlbpro_tasks_transcription',
  /** Preferència d'editor per als SRT: 'editor-video-subs' | 'editor-srt-standalone' */
  SRT_EDITOR_MODE: 'snlbpro_srt_editor_mode',
  /** Marge mínim entre subtítols a l'editor (ms). Preferència d'usuari, independent del projecte. */
  EDITOR_MIN_GAP_MS: 'snlbpro_editor_min_gap_ms',
  /** Tema de color de la interfície */
  THEME: 'snlbpro_theme',
  /** Tokens del tema personalitzat (fallback local) */
  CUSTOM_THEME_TOKENS: 'snlbpro_custom_theme_tokens',
};

export const A4_WIDTH_PX = 794;

export const SUPPORTED_LANGUAGES = [
  { code: 'ca', name: 'Català' },
  { code: 'es', name: 'Castellà' },
  { code: 'en', name: 'Anglès' },
  { code: 'fr', name: 'Francès' },
];

export const MAX_SPEAKER_CHARS_PER_LINE = 30;

/**
 * Merge user overrides onto DEFAULT_SHORTCUTS by shortcut id.
 * Only the `combo` field is overridden; new defaults not present in overrides are kept.
 */
export function mergeShortcuts(
  defaults: AppShortcuts,
  overrides: Partial<Record<keyof AppShortcuts, Shortcut[]>> | null | undefined,
): AppShortcuts {
  if (!overrides) return defaults;
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof AppShortcuts)[]) {
    const overs = overrides[key];
    if (!overs) continue;
    result[key] = defaults[key].map((def) => {
      const ov = overs.find((s) => s.id === def.id);
      return ov ? { ...def, combo: ov.combo } : def;
    });
  }
  return result;
}

export const DEFAULT_SHORTCUTS: AppShortcuts = {
  general: [
    { id: 'g_undo', action: 'UNDO', label: 'Desfer', combo: 'Ctrl+Z' },
    { id: 'g_redo', action: 'REDO', label: 'Refer', combo: 'Ctrl+Shift+Z' },
    { id: 'g_save', action: 'SAVE', label: 'Guardar canvis', combo: 'Ctrl+S' },
  ],
  scriptEditor: [
    { id: 'se_mode_csv', action: 'MODE_CSV', label: 'Canviar a mode Dades', combo: 'Ctrl+M' },
  ],
  videoEditor: [
    { id: 've_play', action: 'TOGGLE_PLAY', label: 'Reproduir / Pausa', combo: 'Ctrl+Space' },
  ],
  subtitlesEditor: [
    { id: 'sub_new', action: 'INSERT_SUBTITLE', label: 'Nou subtítol (playhead)', combo: 'Ctrl+N' },
    { id: 'sub_delete', action: 'DELETE_SEGMENT', label: 'Esborrar subtítol', combo: 'Delete' },
    { id: 'sub_delete_active', action: 'DELETE_ACTIVE_SEGMENT', label: 'Esborrar subtítol actiu', combo: 'Shift+Delete' },

    { id: 'sub_split', action: 'SPLIT_SEGMENT', label: 'Dividir subtítol al cursor', combo: 'Ctrl+K' },
    { id: 'sub_split_ph', action: 'SPLIT_AT_PLAYHEAD', label: 'Dividir al playhead', combo: 'Ctrl+Shift+K' },

    { id: 'sub_merge', action: 'MERGE_SEGMENT', label: 'Unir amb següent', combo: 'Ctrl+Shift+M' },
    { id: 'sub_play', action: 'TOGGLE_PLAY_PAUSE', label: 'Reproduir / Pausa', combo: 'Ctrl+Space' },

    { id: 'sub_next_line', action: 'NAVIGATE_NEXT_LINE', label: 'Següent línia / subtítol', combo: 'Ctrl+Enter' },
    { id: 'sub_prev_line', action: 'NAVIGATE_PREV_LINE', label: 'Anterior línia / subtítol', combo: 'Ctrl+Shift+Enter' },

    { id: 'sub_set_tc_in', action: 'SET_TC_IN', label: 'Marcar TC IN al playhead', combo: 'I' },
    { id: 'sub_set_tc_out', action: 'SET_TC_OUT', label: 'Marcar TC OUT al playhead', combo: 'O' },
  ]
};