// frontend/types/UserStyles/userStylesTypes.ts

export interface StyleAtom {
  fontFamily: string;
  fontSize: number;       // px
  color: string;          // #rrggbb
  bold: boolean;
  italic: boolean;
}

export interface ScriptEditorStyleSet {
  take: StyleAtom;
  speaker: StyleAtom;
  timecode: StyleAtom;
  dialogue: StyleAtom;
  dialogueParentheses: StyleAtom;
  dialogueTimecodeParentheses: StyleAtom;
}

export interface SubtitleEditorStyleSet {
  content: StyleAtom;        // texto editable del subtítulo
  timecode: StyleAtom;       // IN/OUT en TimecodeInput
  idCps: StyleAtom;          // ID y CPS
  takeLabel: StyleAtom;      // etiqueta TAKE
  charCounter: StyleAtom;    // contador de caracteres
  actionButtons: StyleAtom;  // barra de acciones de la fila
}

export interface HomeStyleSet {
  fileName: StyleAtom;
  formatLabel: StyleAtom;
  dateTime: StyleAtom;
  tableHeader: StyleAtom;
  navTabs: StyleAtom;
  breadcrumb: StyleAtom;
}

export type StyleScope = 'scriptEditor' | 'subtitleEditor' | 'home';

export interface StyleSetMap {
  scriptEditor: ScriptEditorStyleSet;
  subtitleEditor: SubtitleEditorStyleSet;
  home: HomeStyleSet;
}

export interface UserStylePreset<S extends StyleScope = StyleScope> {
  id: string;
  name: string;
  builtin?: boolean;
  styles: StyleSetMap[S];
}

export interface ScopeState<S extends StyleScope> {
  activePresetId: string;
  presets: UserStylePreset<S>[];
}

export interface UserStylesPayload {
  version: 1;
  scriptEditor:    ScopeState<'scriptEditor'>;
  subtitleEditor:  ScopeState<'subtitleEditor'>;
  home:            ScopeState<'home'>;
}
