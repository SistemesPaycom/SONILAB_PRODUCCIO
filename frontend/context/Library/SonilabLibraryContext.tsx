// context/Library/LibraryContext.tsx
// Compatibility layer — composes LibraryDataContext + TranscriptionContext + TranslationContext
// All existing consumers can continue using useLibrary() without changes.
import React, { useCallback, useContext, createContext } from 'react';
import type { Folder, Document, TranslationTask, TranscriptionTask } from '../../appTypes';
import { ViewType, SortByKey, SortOrder, LibraryItem } from '../../appTypes';
import { LibraryDataProvider, useLibraryData, LibraryDataAction } from './LibraryDataContext';
import { TranscriptionProvider, useTranscription } from './TranscriptionContext';
import { TranslationProvider, useTranslation } from './TranslationContext';

// ─── Combined state shape (backward-compatible) ──────────────────────────────

export interface LibraryState {
  folders: Folder[];
  documents: Document[];
  currentFolderId: string | null;
  selectedIds: Set<string>;
  view: ViewType;
  sortBy: SortByKey;
  sortOrder: SortOrder;
  isLoading: boolean;
  syncRequest: { docId: string; type: 'media' | 'subtitles'; timestamp: number } | null;
  transcriptionTasks: TranscriptionTask[];
  translationTasks: TranslationTask[];
}

// ─── Combined action type (backward-compatible) ───────────────────────────────

export type Action =
  | LibraryDataAction
  | { type: 'ADD_TRANSCRIPTION_TASK'; payload: TranscriptionTask }
  | { type: 'UPDATE_TRANSCRIPTION_TASK'; payload: { id: string; patch: Partial<TranscriptionTask> } }
  | { type: 'CLEAR_TRANSCRIPTION_TASKS_DONE' }
  | { type: 'ADD_TRANSLATION_TASK'; payload: TranslationTask }
  | { type: 'UPDATE_TRANSLATION_TASK_STATUS'; payload: { id: string; status: 'completed' | 'error' } }
  | { type: 'CLEAR_COMPLETED_TASKS' };

// ─── Context ──────────────────────────────────────────────────────────────────

interface LibraryContextValue {
  state: LibraryState;
  dispatch: React.Dispatch<Action>;
  currentItems: LibraryItem[];
  currentFolder: Folder | null;
  getMediaFile: (docId: string) => File | null;
  useBackend: boolean;
  reloadTree: () => Promise<void>;
  createFolderRemote: (name: string, parentId: string | null) => Promise<void>;
  createDocumentRemote: (payload: { name: string; parentId: string | null; content: string; csvContent?: string; originalName?: string; sourceType?: string }) => Promise<void>;
  uploadMediaRemote: (file: File) => Promise<void>;
  ensureMediaFile: (docId: string, filename: string) => Promise<File>;
}

const LibraryContext = createContext<LibraryContextValue>({
  state: {
    folders: [], documents: [], currentFolderId: null, selectedIds: new Set(),
    view: 'library', sortBy: SortByKey.Name, sortOrder: SortOrder.Asc,
    isLoading: true, syncRequest: null, transcriptionTasks: [], translationTasks: [],
  },
  dispatch: () => null,
  currentItems: [],
  currentFolder: null,
  getMediaFile: () => null,
  useBackend: false,
  reloadTree: async () => {},
  createFolderRemote: async () => {},
  createDocumentRemote: async () => {},
  uploadMediaRemote: async () => {},
  ensureMediaFile: async () => { throw new Error('not ready'); },
});

// ─── Inner bridge (needs all 3 contexts in scope) ─────────────────────────────

const LibraryBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state: libState, libraryDispatch, currentItems, currentFolder, getMediaFile, useBackend, reloadTree, createFolderRemote, createDocumentRemote, uploadMediaRemote, ensureMediaFile } = useLibraryData();
  const { transcriptionTasks, transcriptionDispatch } = useTranscription();
  const { translationTasks, translationDispatch } = useTranslation();

  // Routing dispatch: sends each action to the correct sub-context
  const dispatch = useCallback((action: Action) => {
    switch (action.type) {
      // ── Transcription ──
      case 'ADD_TRANSCRIPTION_TASK':
      case 'UPDATE_TRANSCRIPTION_TASK':
      case 'CLEAR_TRANSCRIPTION_TASKS_DONE':
        transcriptionDispatch(action as any);
        break;

      // ── Translation (+ document isLocked side-effect) ──
      case 'ADD_TRANSLATION_TASK':
        translationDispatch(action as any);
        libraryDispatch({ type: 'LOCK_DOCUMENT', payload: { docId: action.payload.documentId } });
        break;

      case 'UPDATE_TRANSLATION_TASK_STATUS': {
        translationDispatch(action as any);
        const task = translationTasks.find(t => t.id === action.payload.id);
        if (task) libraryDispatch({ type: 'UNLOCK_DOCUMENT', payload: { docId: task.documentId } });
        break;
      }

      case 'CLEAR_COMPLETED_TASKS':
        translationDispatch(action as any);
        break;

      // ── Core library (everything else) ──
      default:
        libraryDispatch(action as LibraryDataAction);
    }
  }, [transcriptionDispatch, translationDispatch, libraryDispatch, translationTasks]);

  const combinedState: LibraryState = {
    ...libState,
    transcriptionTasks,
    translationTasks,
  };

  return (
    <LibraryContext.Provider value={{
      state: combinedState,
      dispatch,
      currentItems,
      currentFolder,
      getMediaFile,
      useBackend,
      reloadTree,
      createFolderRemote,
      createDocumentRemote,
      uploadMediaRemote,
      ensureMediaFile,
    }}>
      {children}
    </LibraryContext.Provider>
  );
};

// ─── Public provider (wraps all sub-providers) ────────────────────────────────

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <TranscriptionProvider>
    <TranslationProvider>
      <LibraryDataProvider>
        <LibraryBridge>
          {children}
        </LibraryBridge>
      </LibraryDataProvider>
    </TranslationProvider>
  </TranscriptionProvider>
);

// ─── Public hook ─────────────────────────────────────────────────────────────

export const useLibrary = () => useContext(LibraryContext);
