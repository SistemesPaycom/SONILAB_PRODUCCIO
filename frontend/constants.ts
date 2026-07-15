import { AppShortcuts, Shortcut } from './appTypes';

export const LOCAL_STORAGE_KEYS = {
  SHORTCUTS: 'snlbpro_shortcuts',
  /**
   * @deprecated Substituït per `snlbpro_user_styles_<userId>` (UserStylesContext).
   * Es manté perquè la migració legacy pugui llegir-lo en el primer arrencada amb
   * la versió nova. No escriure mai més en aquesta clau.
   */
  EDITOR_STYLES: 'snlbpro_editor_styles',
  LIBRARY_WIDTH: 'snlbpro_library_width',
  /** Amplades de les 3 columnes resizable de la taula de Files (Nom/Format/Data i hora). En pixels. */
  LIBRARY_NAME_COL_WIDTH: 'snlbpro_library_name_col_width',
  LIBRARY_FORMAT_COL_WIDTH: 'snlbpro_library_format_col_width',
  LIBRARY_DATE_COL_WIDTH: 'snlbpro_library_date_col_width',
  TAKE_MARGIN: 'snlbpro_take_margin',
  TAKE_START_MARGIN: 'snlbpro_take_start_margin',
  MAX_LINES_SUBS: 'snlbpro_max_lines_subs',
  SUB_GRID_OPACITY: 'snlbpro_sub_grid_opacity',
  WAVEFORM_HOLD_MS: 'snlbpro_waveform_hold_ms',
  /** Marge de moviment (px) a superar per iniciar l'arrossegament d'un esdeveniment (anti-tremolor). Default: 6. 0 = desactivat. */
  WAVEFORM_DRAG_DEADZONE_PX: 'snlbpro_waveform_drag_deadzone_px',
  /** Mode de visualització de l'ona: 'page' (default, estil Subtitle Edit) o 'duo' (permet triar estacionari/pàgina amb el botó del timeline). Preferència d'usuari. */
  WAVEFORM_VIEW_MODE: 'snlbpro_waveform_view_mode',
  AUTOSAVE_SRT: 'snlbpro_autosave_srt',
  TASKS_TRANSLATION: 'snlbpro_tasks_translation',
  TASKS_TRANSCRIPTION: 'snlbpro_tasks_transcription',
  /** Preferència d'editor per als SRT: 'editor-video-subs' | 'editor-srt-standalone' */
  SRT_EDITOR_MODE: 'snlbpro_srt_editor_mode',
  /** Marge mínim entre subtítols a l'editor (ms). Preferència d'usuari, independent del projecte. */
  EDITOR_MIN_GAP_MS: 'snlbpro_editor_min_gap_ms',
  /** Durada mínima d'un bloc de subtítol a l'editor (ms). Preferència d'usuari. Default: 1000. */
  EDITOR_MIN_DURATION_MS: 'snlbpro_editor_min_duration_ms',
  /** Frames per segon del perfil de temps de l'editor (TV 25 / Cine 24). Preferència d'usuari per a la conversió frame↔ms dels presets. Default: 25. */
  EDITOR_FPS: 'snlbpro_editor_fps',
  /** Tema de color de la interfície */
  THEME: 'snlbpro_theme',
  /** Tokens del tema personalitzat (fallback local) */
  CUSTOM_THEME_TOKENS: 'snlbpro_custom_theme_tokens',
  /** IDs de tasques IA ocultes de l'historial (persistit per l'usuari) */
  TASKS_IA_HIDDEN_IDS: 'snlbpro_tasks_ia_hidden_ids',
  /** Historial de subides (Pujades) persistit per l'usuari. Màx. 50 registres done/error. */
  PUJADES_HISTORY: 'snlbpro_pujades_history',
  /** Pestanya activa de la biblioteca (Files / Media / Projectes). */
  ACTIVE_PAGE: 'snlbpro_active_page',
  /** Vista activa de la biblioteca (library / trash). */
  ACTIVE_VIEW: 'snlbpro_active_view',
  /** Carpeta activa de la biblioteca (ID de carpeta). No s'escriu durant la Paperera. */
  ACTIVE_FOLDER: 'snlbpro_active_folder',
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
    { id: 'se_find', action: 'FIND', label: 'Cercar i substituir', combo: 'Ctrl+F' },
  ],
  videoEditor: [
    { id: 've_play', action: 'TOGGLE_PLAY', label: 'Reproduir / Pausa', combo: 'Ctrl+Space' },
  ],
  subtitlesEditor: [
    // ── Esquema mestre: "Shortcuts Subtitols - Consolidat.csv" (arrel), Secció D. Tot personalitzable. ──
    { id: 'sub_delete', action: 'DELETE_SEGMENT', label: 'Esborrar subtítol', combo: 'Delete' },
    { id: 'sub_delete_active', action: 'DELETE_ACTIVE_SEGMENT', label: 'Esborrar subtítol actiu', combo: 'Shift+Delete' },

    { id: 'sub_split_ph', action: 'SPLIT_AT_PLAYHEAD', label: 'Dividir al playhead', combo: 'Ctrl+Shift+K' },
    { id: 'sub_merge', action: 'MERGE_SEGMENT', label: 'Fusionar subtítols seleccionats', combo: 'Ctrl+Shift+M' },
    { id: 'sub_play', action: 'TOGGLE_PLAY_PAUSE', label: 'Reproduir / Pausa', combo: 'Ctrl+Space' },

    { id: 'sub_next_line', action: 'NAVIGATE_NEXT_LINE', label: 'Següent línia / subtítol', combo: 'Ctrl+Enter' },
    { id: 'sub_prev_line', action: 'NAVIGATE_PREV_LINE', label: 'Anterior línia / subtítol', combo: 'Ctrl+Shift+Enter' },
    { id: 'sub_find', action: 'FIND', label: 'Cercar i substituir', combo: 'Ctrl+F' },

    // Cursor (playhead). Els combos de fletxa NO disparen dins de camps de text (guard a
    // useKeyboardShortcuts): allà les fletxes fan navegació de cursor/paraula nativa.
    { id: 'sub_seek_back', action: 'SEEK_STEP_BACK', label: 'Cursor 1 s enrere', combo: 'ArrowLeft' },
    { id: 'sub_seek_fwd', action: 'SEEK_STEP_FWD', label: 'Cursor 1 s endavant', combo: 'ArrowRight' },
    { id: 'sub_frame_back', action: 'FRAME_STEP_BACK', label: 'Cursor 1 frame enrere', combo: 'Ctrl+ArrowLeft' },
    { id: 'sub_frame_fwd', action: 'FRAME_STEP_FWD', label: 'Cursor 1 frame endavant', combo: 'Ctrl+ArrowRight' },

    // Nudge estil Nuendo de les vores de l'esdeveniment actiu, en passos d'1 frame (fps d'EDITOR_FPS).
    // El pas Alt/Shift+Alt de les fletxes es reconeix amb l'ordre canònic Ctrl→Shift→Alt de comboFromEvent.
    { id: 'sub_nudge_start_back', action: 'NUDGE_START_BACK', label: 'Inici −1 frame (Nuendo)', combo: 'Alt+ArrowLeft' },
    { id: 'sub_nudge_start_fwd', action: 'NUDGE_START_FWD', label: 'Inici +1 frame (Nuendo)', combo: 'Alt+ArrowRight' },
    { id: 'sub_nudge_end_back', action: 'NUDGE_END_BACK', label: 'Final −1 frame (Nuendo)', combo: 'Shift+Alt+ArrowLeft' },
    { id: 'sub_nudge_end_fwd', action: 'NUDGE_END_FWD', label: 'Final +1 frame (Nuendo)', combo: 'Shift+Alt+ArrowRight' },
    { id: 'sub_line_prev', action: 'NAVIGATE_SEGMENT_UP', label: 'Línia anterior', combo: 'Alt+ArrowUp' },
    { id: 'sub_line_next', action: 'NAVIGATE_SEGMENT_DOWN', label: 'Línia següent', combo: 'Alt+ArrowDown' },

    // Fixar cues + inserir + dividir (paritat Subtitle Edit, tecles F del CSV).
    { id: 'sub_fix_in_ripple', action: 'FIX_IN_RIPPLE', label: 'Fixar inici i desplaçar la resta', combo: 'F9' },
    { id: 'sub_fix_out_next', action: 'FIX_OUT_NEXT', label: 'Fixar final i anar a la següent', combo: 'F10' },
    { id: 'sub_set_tc_in', action: 'SET_TC_IN', label: 'Fixar inici al cursor', combo: 'F11' },
    { id: 'sub_set_tc_out', action: 'SET_TC_OUT', label: 'Fixar final al cursor', combo: 'F12' },
    { id: 'sub_new', action: 'INSERT_SUBTITLE', label: 'Inserir subtítol a la posició de vídeo', combo: 'Shift+F9' },
    { id: 'sub_split', action: 'SPLIT_SEGMENT', label: 'Dividir subtítol al cursor', combo: 'Ctrl+Alt+V' },
  ]
};

/** Durada mínima d'un subtítol en mil·lisegons.
 *  Font única per al frontend i per al pipeline de transcripció (--min-dur-ms).
 *  Si es canvia aquí, actualitzar també el default a transcription.processor.ts. */
export const MIN_SEG_DURATION_MS = 100;

export const AUDIO_ONLY_EXTS = ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'];

export const isAudioOnly = (sourceType?: string | null): boolean =>
  AUDIO_ONLY_EXTS.includes((sourceType ?? '').toLowerCase());