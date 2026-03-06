import { AppShortcuts } from './types';

export const LOCAL_STORAGE_KEYS = {
  SHORTCUTS: 'slsf_shortcuts',
  EDITOR_STYLES: 'slsf_editor_styles',
  LIBRARY_WIDTH: 'slsf_library_width',
  TAKE_MARGIN: 'slsf_take_margin',
  TAKE_START_MARGIN: 'slsf_take_start_margin',
  MAX_LINES_SUBS: 'slsf_max_lines_subs',
  SUB_GRID_OPACITY: 'slsf_sub_grid_opacity',
  WAVEFORM_HOLD_MS: 'slsf_waveform_hold_ms',
  AUTOSAVE_SRT: 'slsf_autosave_srt',
   TASKS_TRANSLATION: 'slsf_tasks_translation',
  TASKS_TRANSCRIPTION: 'slsf_tasks_transcription',
};

export const A4_WIDTH_PX = 794;

export const SUPPORTED_LANGUAGES = [
  { code: 'ca', name: 'Català' },
  { code: 'es', name: 'Castellà' },
  { code: 'en', name: 'Anglès' },
  { code: 'fr', name: 'Francès' },
];

export const MAX_SPEAKER_CHARS_PER_LINE = 30;

export const DEFAULT_SHORTCUTS: AppShortcuts = {
  general: [
    { id: 'g_undo', action: 'UNDO', label: 'Desfer', combo: 'Ctrl+Z' },
    { id: 'g_redo', action: 'REDO', label: 'Refer', combo: 'Ctrl+Shift+Z' },
    { id: 'g_save', action: 'SAVE', label: 'Guardar canvis', combo: 'Ctrl+S' },
  ],
  scriptEditor: [
    { id: 'se_mode_csv', action: 'MODE_CSV', label: 'Canviar a mode Dades', combo: 'Ctrl+M' },
  ],
  lector: [
    { id: 'l_zoom_in', action: 'ZOOM_IN', label: 'Zoom In', combo: 'Ctrl+Plus' },
    { id: 'l_zoom_out', action: 'ZOOM_OUT', label: 'Zoom Out', combo: 'Ctrl+Minus' },
  ],
  videoEditor: [
    { id: 've_play', action: 'TOGGLE_PLAY', label: 'Reproduir / Pausa', combo: 'Ctrl+Space' },
  ],
  subtitlesEditor: [
    { id: 'sub_split', action: 'SPLIT_SEGMENT', label: 'Dividir subtítol al cursor', combo: 'Ctrl+K' },
    { id: 'sub_merge', action: 'MERGE_SEGMENT', label: 'Unir amb següent', combo: 'Ctrl+Shift+M' },
    { id: 'sub_play', action: 'TOGGLE_PLAY_PAUSE', label: 'Reproduir / Pausa', combo: 'Ctrl+Space' },
    { id: 'sub_next_line', action: 'NAVIGATE_NEXT_LINE', label: 'Següent línia / subtítol', combo: 'Ctrl+Enter' },
    { id: 'sub_prev_line', action: 'NAVIGATE_PREV_LINE', label: 'Anterior línia / subtítol', combo: 'Ctrl+Shift+Enter' },
  ]
};