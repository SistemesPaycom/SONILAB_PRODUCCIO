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
 * Reproduce el aspecto actual hardcoded del editor de subtítulos
 * (SegmentItem.tsx, TimecodeInput.tsx). Los colores que originalmente leían
 * var(--th-*) se resuelven a hex en el momento de la migración (ver
 * resolveSubtitleFactoryColors en userStylesMigration.ts).
 */
export const FACTORY_SUBTITLE_STYLES: SubtitleEditorStyleSet = {
  content:        courier(14, '#e5e7eb'),
  timecode:       courier(10, '#9ca3af'),
  // idCps i charCounter usen `font-black` (900) en SegmentItem.tsx; bold (700) és la
  // millor aproximació amb el StyleAtom actual (que només té bold:boolean).
  idCps:          mono(11,    '#9ca3af', true),
  takeLabel:      sans(10,    '#ef4444', true),
  charCounter:    mono(11,    '#9ca3af', true),
  actionButtons:  sans(9,     '#9ca3af'),
};

/**
 * Reproduce el aspecto actual del home/llibreria (SonilabLibraryView.tsx,
 * LibraryFileItem.tsx).
 */
export const FACTORY_HOME_STYLES: HomeStyleSet = {
  fileName:     sans(14, '#f3f4f6'),
  formatLabel:  sans(10, '#6b7280', true),
  dateTime:     mono(10, '#9ca3af'),
  tableHeader:  sans(10, '#6b7280', true),
  navTabs:      sans(14, '#ffffff', true),
  breadcrumb:   sans(14, '#b8b8b8'),
};
