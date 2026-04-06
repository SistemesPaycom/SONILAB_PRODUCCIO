// frontend/context/UserStyles/factoryStyles.ts
import type {
  ScriptEditorStyleSet,
  SubtitleEditorStyleSet,
  HomeStyleSet,
  StyleAtom,
} from '../../types/UserStyles/userStylesTypes';

const courier = (size: number, color: string, bold = false, italic = false): StyleAtom => ({
  fontFamily: 'Courier Prime, monospace',
  fontSize: size,
  color,
  bold,
  italic,
});

const sans = (size: number, color: string, bold = false, italic = false): StyleAtom => ({
  fontFamily: 'sans-serif',
  fontSize: size,
  color,
  bold,
  italic,
});

const mono = (size: number, color: string, bold = false, italic = false): StyleAtom => ({
  fontFamily: 'monospace',
  fontSize: size,
  color,
  bold,
  italic,
});

/**
 * Reproduce exactamente DEFAULT_STYLES de App.tsx:35-42 — cualquier usuario que migre
 * desde el sistema legacy debe ver el editor de guiones idéntico a antes.
 */
export const FACTORY_SCRIPT_STYLES: ScriptEditorStyleSet = {
  take:                         courier(16, '#000000', true,  false),
  speaker:                      courier(14, '#000000', true,  false),
  timecode:                     courier(13, '#666666', false, false),
  dialogue:                     courier(14, '#000000', false, false),
  dialogueParentheses:          courier(14, '#555555', false, true),
  dialogueTimecodeParentheses:  courier(13, '#0055aa', true,  false),
};

/**
 * Colors per defecte que deleguen en les CSS vars del tema admin.
 * D'aquesta manera, el factory es adaptable a qualsevol tema (sonilab,
 * dark, light, midnight) sense hard-codar hex. L'usuari pot seguir
 * personalitzant el color amb el color picker, i llavors el valor
 * guardat sera un hex fix (override explicit).
 */
export const FACTORY_SUBTITLE_STYLES: SubtitleEditorStyleSet = {
  content:        courier(14, 'var(--th-editor-text)'),
  timecode:       courier(10, 'var(--th-editor-timecode)'),
  // idCps i charCounter usen `font-black` (900) en SegmentItem.tsx; bold (700) és la
  // millor aproximació amb el StyleAtom actual (que només té bold:boolean).
  idCps:          mono(11,    'var(--th-editor-text-muted)', true),
  takeLabel:      sans(10,    'var(--th-accent-text)', true),
  charCounter:    mono(11,    'var(--th-editor-text-muted)', true),
  actionButtons:  sans(9,     'var(--th-editor-meta)'),
};

/**
 * Reproduce el aspecto actual del home/llibreria (SonilabLibraryView.tsx,
 * LibraryFileItem.tsx). Igual que FACTORY_SUBTITLE_STYLES, els colors
 * referencien les CSS vars del tema per adaptar-se a qualsevol tema actiu.
 */
export const FACTORY_HOME_STYLES: HomeStyleSet = {
  fileName:     sans(14, 'var(--th-text-primary)'),
  formatLabel:  sans(10, 'var(--th-text-muted)', true),
  dateTime:     mono(10, 'var(--th-text-secondary)'),
  tableHeader:  sans(10, 'var(--th-text-muted)', true),
  navTabs:      sans(14, 'var(--th-text-primary)', true),
  breadcrumb:   sans(14, 'var(--th-text-secondary)'),
};
