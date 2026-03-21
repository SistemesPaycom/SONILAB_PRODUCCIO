// context/Theme/themes.ts
// Definició central dels temes de color de l'aplicació.
// Cada tema defineix tokens semàntics (CSS custom properties).

export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  /** Colors de mostra per a la previsualització */
  preview: [string, string, string, string];
  /** Tokens CSS (sense el prefix --) */
  tokens: Record<string, string>;
}

// ── TEMA SONILAB (corporatiu — per defecte) ──────────────────────────────
export const THEME_SONILAB: ThemeDefinition = {
  id: 'sonilab',
  name: 'Sonilab',
  description: 'Tema corporatiu: negre profund, accent vermell',
  preview: ['#0A0A0A', '#161616', '#C40000', '#FFFFFF'],
  tokens: {
    'bg-app':           '#0A0A0A',
    'bg-primary':       '#121212',
    'bg-secondary':     '#1A1A1A',
    'bg-tertiary':      '#242424',
    'bg-surface':       '#161616',
    'bg-hover':         'rgba(255, 255, 255, 0.06)',
    'bg-active':        'rgba(196, 0, 0, 0.15)',
    'bg-overlay':       'rgba(0, 0, 0, 0.88)',

    'text-primary':     '#FFFFFF',
    'text-secondary':   '#B8B8B8',
    'text-muted':       '#808080',
    'text-disabled':    '#555555',
    'text-inverse':     '#0A0A0A',

    'border':           '#2A2A2A',
    'border-strong':    '#3A3A3A',
    'border-subtle':    'rgba(255, 255, 255, 0.08)',

    'accent':           '#C40000',
    'accent-hover':     '#E00000',
    'accent-muted':     'rgba(196, 0, 0, 0.20)',
    'accent-text':      '#FF4444',

    'success':          '#22c55e',
    'warning':          '#eab308',
    'error':            '#ef4444',
    'info':             '#38bdf8',

    'editor-bg':        '#121212',
    'editor-row-hover': 'rgba(255, 255, 255, 0.04)',
    'editor-row-active':'rgba(196, 0, 0, 0.12)',
    'editor-text':      '#FFFFFF',
    'editor-text-active':'#FFFFFF',
    'editor-text-muted':'#808080',
    'editor-caret':     '#FFFFFF',
    'editor-timecode':  '#B8B8B8',
    'editor-meta':      '#808080',
    'editor-label-bg':  'rgba(255, 255, 255, 0.06)',
    'waveform-bg':      '#0E0E0E',
    'waveform-ruler-bg':'#0A0A0A',
    'waveform-line':    '#2A2A2A',
    'waveform-grid':    'rgba(60, 60, 60, 0.3)',
    'waveform-grid-text':'rgba(160, 160, 160, 0.6)',
    'waveform-bar':     'rgba(180, 180, 180, 0.45)',
    'waveform-bar-play':'rgba(196, 0, 0, 0.7)',
    'waveform-seg':     'rgba(196, 0, 0, 0.12)',
    'waveform-seg-idle':'rgba(255, 255, 255, 0.06)',
    'waveform-seg-border':'#C40000',
    'waveform-seg-border-idle':'#555555',
    'waveform-seg-handle':'#FF4444',
    'waveform-seg-handle-idle':'#888888',
    'waveform-seg-text':'rgba(255, 200, 200, 0.9)',
    'waveform-seg-text-idle':'rgba(180, 180, 180, 0.7)',
    'waveform-scrollbar':'#4b5563 #0E0E0E',
    'header-bg':        'rgba(22, 22, 22, 0.95)',
    'divider':          '#1A1A1A',

    'tab-active-bg':    '#C40000',
    'tab-active-text':  '#FFFFFF',
    'tab-active-border':'#C40000',
    'btn-primary-bg':   '#C40000',
    'btn-primary-hover':'#A80000',
    'btn-primary-text': '#FFFFFF',
    'focus-ring':       'rgba(196, 0, 0, 0.5)',
    'link':             '#FF4444',
    'badge-bg':         'rgba(196, 0, 0, 0.15)',
    'badge-text':       '#FF4444',
    'badge-border':     'rgba(196, 0, 0, 0.3)',
  },
};

// ── TEMA FOSC (neutre) ───────────────────────────────────────────────────
export const THEME_DARK: ThemeDefinition = {
  id: 'dark',
  name: 'Fosc',
  description: 'Tema fosc neutre amb accent blau',
  preview: ['#18181b', '#27272a', '#3b82f6', '#f4f4f5'],
  tokens: {
    'bg-app':           '#09090b',
    'bg-primary':       '#18181b',
    'bg-secondary':     '#27272a',
    'bg-tertiary':      '#3f3f46',
    'bg-surface':       '#1c1c1f',
    'bg-hover':         'rgba(63, 63, 70, 0.5)',
    'bg-active':        'rgba(59, 130, 246, 0.12)',
    'bg-overlay':       'rgba(0, 0, 0, 0.82)',

    'text-primary':     '#f4f4f5',
    'text-secondary':   '#a1a1aa',
    'text-muted':       '#71717a',
    'text-disabled':    '#52525b',
    'text-inverse':     '#18181b',

    'border':           '#3f3f46',
    'border-strong':    '#52525b',
    'border-subtle':    'rgba(63, 63, 70, 0.5)',

    'accent':           '#3b82f6',
    'accent-hover':     '#2563eb',
    'accent-muted':     'rgba(59, 130, 246, 0.15)',
    'accent-text':      '#60a5fa',

    'success':          '#22c55e',
    'warning':          '#f59e0b',
    'error':            '#ef4444',
    'info':             '#06b6d4',

    'editor-bg':        '#18181b',
    'editor-row-hover': 'rgba(39, 39, 42, 0.5)',
    'editor-row-active':'rgba(59, 130, 246, 0.1)',
    'editor-text':      '#f4f4f5',
    'editor-text-active':'#ffffff',
    'editor-text-muted':'#71717a',
    'editor-caret':     '#f4f4f5',
    'editor-timecode':  '#a1a1aa',
    'editor-meta':      '#71717a',
    'editor-label-bg':  'rgba(63, 63, 70, 0.5)',
    'waveform-bg':      '#111113',
    'waveform-ruler-bg':'#0c0c0e',
    'waveform-line':    '#374151',
    'waveform-grid':    'rgba(55, 65, 81, 0.3)',
    'waveform-grid-text':'rgba(107, 114, 128, 0.6)',
    'waveform-bar':     'rgba(113, 113, 122, 0.5)',
    'waveform-bar-play':'rgba(16, 185, 129, 0.6)',
    'waveform-seg':     'rgba(59, 130, 246, 0.15)',
    'waveform-seg-idle':'rgba(148, 163, 184, 0.08)',
    'waveform-seg-border':'#3b82f6',
    'waveform-seg-border-idle':'#64748b',
    'waveform-seg-handle':'#60a5fa',
    'waveform-seg-handle-idle':'#94a3b8',
    'waveform-seg-text':'rgba(147, 197, 253, 0.9)',
    'waveform-seg-text-idle':'rgba(156, 163, 175, 0.7)',
    'waveform-scrollbar':'#4b5563 #111113',
    'header-bg':        'rgba(39, 39, 42, 0.85)',
    'divider':          '#111113',

    'tab-active-bg':    '#3b82f6',
    'tab-active-text':  '#FFFFFF',
    'tab-active-border':'#3b82f6',
    'btn-primary-bg':   '#3b82f6',
    'btn-primary-hover':'#2563eb',
    'btn-primary-text': '#FFFFFF',
    'focus-ring':       'rgba(59, 130, 246, 0.5)',
    'link':             '#60a5fa',
    'badge-bg':         'rgba(59, 130, 246, 0.15)',
    'badge-text':       '#60a5fa',
    'badge-border':     'rgba(59, 130, 246, 0.3)',
  },
};

// ── TEMA CLAR ────────────────────────────────────────────────────────────
export const THEME_LIGHT: ThemeDefinition = {
  id: 'light',
  name: 'Clar',
  description: 'Tema clar professional amb fons blanc',
  preview: ['#ffffff', '#f4f4f5', '#2563eb', '#18181b'],
  tokens: {
    'bg-app':           '#f0f0f2',
    'bg-primary':       '#ffffff',
    'bg-secondary':     '#f4f4f5',
    'bg-tertiary':      '#e4e4e7',
    'bg-surface':       '#ffffff',
    'bg-hover':         'rgba(0, 0, 0, 0.04)',
    'bg-active':        'rgba(37, 99, 235, 0.08)',
    'bg-overlay':       'rgba(0, 0, 0, 0.5)',

    'text-primary':     '#18181b',
    'text-secondary':   '#3f3f46',
    'text-muted':       '#52525b',
    'text-disabled':    '#9ca3af',
    'text-inverse':     '#ffffff',

    'border':           '#d4d4d8',
    'border-strong':    '#a1a1aa',
    'border-subtle':    'rgba(0, 0, 0, 0.08)',

    'accent':           '#2563eb',
    'accent-hover':     '#1d4ed8',
    'accent-muted':     'rgba(37, 99, 235, 0.10)',
    'accent-text':      '#2563eb',

    'success':          '#16a34a',
    'warning':          '#ca8a04',
    'error':            '#dc2626',
    'info':             '#0891b2',

    'editor-bg':        '#ffffff',
    'editor-row-hover': 'rgba(0, 0, 0, 0.03)',
    'editor-row-active':'rgba(37, 99, 235, 0.08)',
    'editor-text':      '#18181b',
    'editor-text-active':'#1e3a5f',
    'editor-text-muted':'#71717a',
    'editor-caret':     '#18181b',
    'editor-timecode':  '#3f3f46',
    'editor-meta':      '#52525b',
    'editor-label-bg':  'rgba(0, 0, 0, 0.06)',
    'waveform-bg':      '#f4f4f5',
    'waveform-ruler-bg':'#e4e4e7',
    'waveform-line':    '#d4d4d8',
    'waveform-grid':    'rgba(0, 0, 0, 0.08)',
    'waveform-grid-text':'rgba(0, 0, 0, 0.4)',
    'waveform-bar':     'rgba(100, 100, 120, 0.4)',
    'waveform-bar-play':'rgba(37, 99, 235, 0.6)',
    'waveform-seg':     'rgba(37, 99, 235, 0.10)',
    'waveform-seg-idle':'rgba(0, 0, 0, 0.04)',
    'waveform-seg-border':'#2563eb',
    'waveform-seg-border-idle':'#a1a1aa',
    'waveform-seg-handle':'#3b82f6',
    'waveform-seg-handle-idle':'#a1a1aa',
    'waveform-seg-text':'rgba(37, 99, 235, 0.9)',
    'waveform-seg-text-idle':'rgba(80, 80, 100, 0.7)',
    'waveform-scrollbar':'#a1a1aa #f4f4f5',
    'header-bg':        'rgba(244, 244, 245, 0.95)',
    'divider':          '#e4e4e7',

    'tab-active-bg':    '#2563eb',
    'tab-active-text':  '#FFFFFF',
    'tab-active-border':'#2563eb',
    'btn-primary-bg':   '#2563eb',
    'btn-primary-hover':'#1d4ed8',
    'btn-primary-text': '#FFFFFF',
    'focus-ring':       'rgba(37, 99, 235, 0.4)',
    'link':             '#2563eb',
    'badge-bg':         'rgba(37, 99, 235, 0.10)',
    'badge-text':       '#2563eb',
    'badge-border':     'rgba(37, 99, 235, 0.25)',
  },
};

// ── TEMA MIDNIGHT ────────────────────────────────────────────────────────
export const THEME_MIDNIGHT: ThemeDefinition = {
  id: 'midnight',
  name: 'Midnight',
  description: 'Tema blau profund amb accent índigo',
  preview: ['#0c1222', '#162032', '#6366f1', '#e2e8f0'],
  tokens: {
    'bg-app':           '#0c1222',
    'bg-primary':       '#0f1729',
    'bg-secondary':     '#162032',
    'bg-tertiary':      '#1e2d45',
    'bg-surface':       '#131d33',
    'bg-hover':         'rgba(30, 45, 69, 0.6)',
    'bg-active':        'rgba(99, 102, 241, 0.12)',
    'bg-overlay':       'rgba(5, 10, 20, 0.85)',

    'text-primary':     '#e2e8f0',
    'text-secondary':   '#94a3b8',
    'text-muted':       '#64748b',
    'text-disabled':    '#475569',
    'text-inverse':     '#0f172a',

    'border':           '#1e3a5f',
    'border-strong':    '#2563eb',
    'border-subtle':    'rgba(30, 58, 95, 0.5)',

    'accent':           '#6366f1',
    'accent-hover':     '#818cf8',
    'accent-muted':     'rgba(99, 102, 241, 0.15)',
    'accent-text':      '#a5b4fc',

    'success':          '#34d399',
    'warning':          '#fbbf24',
    'error':            '#f87171',
    'info':             '#22d3ee',

    'editor-bg':        '#0f1729',
    'editor-row-hover': 'rgba(22, 32, 50, 0.5)',
    'editor-row-active':'rgba(99, 102, 241, 0.12)',
    'editor-text':      '#e2e8f0',
    'editor-text-active':'#ffffff',
    'editor-text-muted':'#64748b',
    'editor-caret':     '#e2e8f0',
    'editor-timecode':  '#94a3b8',
    'editor-meta':      '#64748b',
    'editor-label-bg':  'rgba(30, 58, 95, 0.5)',
    'waveform-bg':      '#0a1020',
    'waveform-ruler-bg':'#060c18',
    'waveform-line':    '#1e3a5f',
    'waveform-grid':    'rgba(30, 58, 95, 0.3)',
    'waveform-grid-text':'rgba(100, 116, 139, 0.6)',
    'waveform-bar':     'rgba(100, 116, 139, 0.5)',
    'waveform-bar-play':'rgba(99, 102, 241, 0.7)',
    'waveform-seg':     'rgba(99, 102, 241, 0.15)',
    'waveform-seg-idle':'rgba(148, 163, 184, 0.08)',
    'waveform-seg-border':'#6366f1',
    'waveform-seg-border-idle':'#475569',
    'waveform-seg-handle':'#818cf8',
    'waveform-seg-handle-idle':'#64748b',
    'waveform-seg-text':'rgba(165, 180, 252, 0.9)',
    'waveform-seg-text-idle':'rgba(148, 163, 184, 0.7)',
    'waveform-scrollbar':'#475569 #0a1020',
    'header-bg':        'rgba(22, 32, 50, 0.9)',
    'divider':          '#0a1020',

    'tab-active-bg':    '#6366f1',
    'tab-active-text':  '#FFFFFF',
    'tab-active-border':'#6366f1',
    'btn-primary-bg':   '#6366f1',
    'btn-primary-hover':'#4f46e5',
    'btn-primary-text': '#FFFFFF',
    'focus-ring':       'rgba(99, 102, 241, 0.5)',
    'link':             '#a5b4fc',
    'badge-bg':         'rgba(99, 102, 241, 0.15)',
    'badge-text':       '#a5b4fc',
    'badge-border':     'rgba(99, 102, 241, 0.3)',
  },
};

/** Tots els temes disponibles */
export const ALL_THEMES: ThemeDefinition[] = [
  THEME_SONILAB,
  THEME_DARK,
  THEME_LIGHT,
  THEME_MIDNIGHT,
];

/** ID del tema per defecte */
export const DEFAULT_THEME_ID = 'sonilab';

/** Obtenir un tema per ID, amb fallback al per defecte */
export function getThemeById(id: string): ThemeDefinition {
  return ALL_THEMES.find(t => t.id === id) ?? THEME_SONILAB;
}
