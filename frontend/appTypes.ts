
export type Layout = 'mono' | 'cols';

export interface EditorStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
}

export interface EditorStyles {
  take: EditorStyle;
  speaker: EditorStyle;
  timecode: EditorStyle;
  dialogue: EditorStyle;
  dialogueParentheses: EditorStyle;
  dialogueTimecodeParentheses: EditorStyle;
}

export interface Shortcut {
  id: string;
  action: string;
  label: string;
  combo: string;
}

export interface AppShortcuts {
  general: Shortcut[];
  scriptEditor: Shortcut[];
  videoEditor: Shortcut[];
  subtitlesEditor: Shortcut[];
}

export type ViewType = 'library' | 'trash';

export enum SortByKey {
  Name = 'name',
  Date = 'updatedAt',
  Format = 'sourceType',
}

export enum SortOrder {
  Asc = 'asc',
  Desc = 'desc',
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  type: 'folder';
}

export interface Document {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  type: 'document';
  contentByLang: Record<string, string>;
  csvContentByLang: Record<string, string>;
  sourceLang: string | null;
  isLocked: boolean;
  originalName?: string;
  sourceType?: string;
  refTargetId?: string | null;
  linkedMediaId?: string | null;
  characters: any[];
  takes: any[];
  layers: any[];
  strokes: any[];
  textAnnotations: any[];
  textHighlights: any[];
  annotationLinks: any[];
  takeStatuses: Record<string, Record<string, TakeStatus>>;
  takeNotes: Record<string, string>;
  characterNotes: CharacterNote[];
}

export type TakeStatus = 'pending' | 'done' | 'issue';

export interface CharacterNote {
  id: string;
  characterName: string;
  text: string;
}

export type LibraryItem = Folder | Document;

export interface TranslationTask {
  id: string;
  documentId: string;
  documentName: string;
  fromLang: string;
  toLang: string;
  status: 'processing' | 'completed' | 'error';
  timestamp: string;
}

export interface Segment {
  id: number;
  startTime: number;
  endTime: number;
  originalText: string;
  translatedText?: string;
  richText?: string;
  status?: 'ok' | 'warning' | 'error';
  hasDiff?: boolean;
}

export interface OverlayConfig {
  show: boolean;
  position: 'top' | 'bottom';
  offsetPx: number;
  fontScale: number;
}

export type Id = string | number;

export type TimelineViewMode = 'waveform' | 'segments' | 'both' | 'hidden';

export type OpenMode = 'editor' | 'editor-video' | 'editor-video-subs' | 'editor-ssrtlsf' | 'editor-srt-standalone';

export interface TranscriptionTask {
  id: string;                 // jobId
  projectId: string;
  projectName: string;
  srtDocumentId: string;
  mediaDocumentId: string;
  status: 'queued' | 'processing' | 'done' | 'error';
  progress: number;           // 0..100
  error?: string | null;
  timestamp: string;
}