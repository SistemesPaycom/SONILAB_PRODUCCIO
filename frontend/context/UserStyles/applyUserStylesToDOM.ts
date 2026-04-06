// frontend/context/UserStyles/applyUserStylesToDOM.ts
import type {
  StyleAtom,
  UserStylesPayload,
  SubtitleEditorStyleSet,
  ScriptEditorStyleSet,
  HomeStyleSet,
  ScopeState,
  StyleScope,
} from '../../types/UserStyles/userStylesTypes';

/** Devuelve el preset activo del scope, o el primero si el activo no existe. */
function activePreset<S extends StyleScope>(state: ScopeState<S>) {
  return state.presets.find(p => p.id === state.activePresetId) ?? state.presets[0];
}

/** Aproximación 1ch → px en función de si la familia es monospace o sans. */
function isMono(family: string): boolean {
  const f = family.toLowerCase();
  return /courier|consolas|monaco|menlo|monospace|fira ?code|cascadia/.test(f);
}

function chOf(atom: StyleAtom): number {
  return atom.fontSize * (isMono(atom.fontFamily) ? 0.6 : 0.55);
}

function emitAtomVars(prefix: string, atom: StyleAtom): Record<string, string> {
  return {
    [`${prefix}-family`]: atom.fontFamily,
    [`${prefix}-size`]:   `${atom.fontSize}px`,
    [`${prefix}-color`]:  atom.color,
    [`${prefix}-weight`]: atom.bold ? '700' : '400',
    [`${prefix}-style`]:  atom.italic ? 'italic' : 'normal',
  };
}

function computeSubGridCols(sb: SubtitleEditorStyleSet): string {
  const takeCol     = `${Math.ceil(chOf(sb.takeLabel)   * 10)}px`;
  const idCpsCol    = `${Math.ceil(chOf(sb.idCps)       * 12)}px`;
  const timecodeCol = `${Math.ceil(chOf(sb.timecode)    * 21)}px`;
  const charCntCol  = `${Math.ceil(chOf(sb.charCounter) *  5)}px`;
  return `${takeCol} ${idCpsCol} ${timecodeCol} ${charCntCol} max-content`;
}

function computeSubRowHeight(sb: SubtitleEditorStyleSet): number {
  const maxAtomSize = Math.max(
    sb.content.fontSize,
    sb.timecode.fontSize,
    sb.idCps.fontSize,
    sb.takeLabel.fontSize,
    sb.charCounter.fontSize,
  );
  return Math.max(24, Math.ceil(maxAtomSize * 1.55));
}

export interface DerivedSubtitleMetrics {
  rowHeight: number;        // px
  rowPaddingY: number;      // px
  /** Estimate por fila para virtual scroll = rowHeight * maxLines + acción + padding */
  rowEstimate(maxLines: number): number;
}

export function computeSubtitleMetrics(sb: SubtitleEditorStyleSet): DerivedSubtitleMetrics {
  const rowHeight = computeSubRowHeight(sb);
  const rowPaddingY = Math.ceil(rowHeight * 0.16);
  return {
    rowHeight,
    rowPaddingY,
    rowEstimate: (maxLines: number) => rowHeight * Math.max(1, maxLines) + 32,
  };
}

export function applyUserStylesToDOM(payload: UserStylesPayload): void {
  const root = document.documentElement;
  const all: Record<string, string> = {};

  // ── Script editor ────────────────────────────────────────────────────────
  const se: ScriptEditorStyleSet = activePreset(payload.scriptEditor).styles;
  Object.assign(all, emitAtomVars('--us-script-take',                          se.take));
  Object.assign(all, emitAtomVars('--us-script-speaker',                       se.speaker));
  Object.assign(all, emitAtomVars('--us-script-timecode',                      se.timecode));
  Object.assign(all, emitAtomVars('--us-script-dialogue',                      se.dialogue));
  Object.assign(all, emitAtomVars('--us-script-dialogueparen',                 se.dialogueParentheses));
  Object.assign(all, emitAtomVars('--us-script-dialoguetcparen',               se.dialogueTimecodeParentheses));

  // ── Subtitle editor ──────────────────────────────────────────────────────
  const sb: SubtitleEditorStyleSet = activePreset(payload.subtitleEditor).styles;
  Object.assign(all, emitAtomVars('--us-sub-content',       sb.content));
  Object.assign(all, emitAtomVars('--us-sub-timecode',      sb.timecode));
  Object.assign(all, emitAtomVars('--us-sub-idcps',         sb.idCps));
  Object.assign(all, emitAtomVars('--us-sub-takelabel',     sb.takeLabel));
  Object.assign(all, emitAtomVars('--us-sub-charcounter',   sb.charCounter));
  Object.assign(all, emitAtomVars('--us-sub-actionbuttons', sb.actionButtons));

  const metrics = computeSubtitleMetrics(sb);
  all['--us-sub-row-height']    = `${metrics.rowHeight}px`;
  all['--us-sub-row-padding-y'] = `${metrics.rowPaddingY}px`;
  all['--us-sub-grid-columns']  = computeSubGridCols(sb);

  // ── Home ─────────────────────────────────────────────────────────────────
  const hm: HomeStyleSet = activePreset(payload.home).styles;
  Object.assign(all, emitAtomVars('--us-home-filename',    hm.fileName));
  Object.assign(all, emitAtomVars('--us-home-format',      hm.formatLabel));
  Object.assign(all, emitAtomVars('--us-home-datetime',    hm.dateTime));
  Object.assign(all, emitAtomVars('--us-home-tableheader', hm.tableHeader));
  Object.assign(all, emitAtomVars('--us-home-navtabs',     hm.navTabs));
  Object.assign(all, emitAtomVars('--us-home-breadcrumb',  hm.breadcrumb));

  for (const [k, v] of Object.entries(all)) {
    root.style.setProperty(k, v);
  }
}
