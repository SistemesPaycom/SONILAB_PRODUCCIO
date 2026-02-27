// context/Library/LibraryContext.tsx
import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useMemo,
} from 'react';
import type { Folder, Document, TranslationTask, TakeStatus, CharacterNote } from '../../types';
import { ViewType, SortByKey, SortOrder, LibraryItem } from '../../types';
import { indexCharacters } from '../../utils/LectorDeGuions/indexers';
import { findTakesWithRanges } from '../../utils/LectorDeGuions/takes';
import { api } from '../../services/api';
// Registre global de fitxers binaris per a la sessió actual (no es guarda a localStorage)
const mediaRegistry: Record<string, File> = {};

interface LibraryState {
  folders: Folder[];
  documents: Document[];
  currentFolderId: string | null;
  selectedIds: Set<string>;
  view: ViewType;
  sortBy: SortByKey;
  sortOrder: SortOrder;
  isLoading: boolean;
  translationTasks: TranslationTask[];
  // Nou estat per a comunicació Drag & Drop entre components
  syncRequest: { docId: string; type: 'media' | 'subtitles'; timestamp: number } | null;
}

type Action =
  | { type: 'SET_INITIAL_STATE'; payload: Omit<LibraryState, 'isLoading' | 'translationTasks' | 'syncRequest'> }
  | { type: 'CREATE_FOLDER'; payload: { name: string; parentId: string | null } }
  | { type: 'IMPORT_DOCUMENT'; payload: { name: string; parentId: string | null; content: string; csvContent?: string; originalName?: string; sourceType?: string; file?: File } }
  | { type: 'UPDATE_DOCUMENT_CONTENTS'; payload: { documentId: string; lang: string; content: string; csvContent: string } }
  | { type: 'UPDATE_DOCUMENT_DATA'; payload: { documentId: string; data: Partial<Omit<Document, 'id' | 'type'>> } }
  | { type: 'SET_SOURCE_LANG'; payload: { documentId: string; lang: string } }
  | { type: 'ADD_TRANSLATION'; payload: { documentId: string; lang: string; content: string; csvContent: string } }
  | { type: 'RENAME_ITEM'; payload: { id: string; type: 'folder' | 'document'; newName: string } }
  | { type: 'MOVE_ITEMS'; payload: { itemIds: string[]; destinationFolderId: string | null } }
  | { type: 'DELETE_ITEMS'; payload: { itemIds: string[] } }
  | { type: 'RESTORE_ITEMS'; payload: { itemIds: string[] } }
  | { type: 'PERMANENTLY_DELETE_ITEMS'; payload: { itemIds: string[] } }
  | { type: 'SET_CURRENT_FOLDER'; payload: string | null }
  | { type: 'TOGGLE_SELECTION'; payload: { id: string; isSelected: boolean } }
  | { type: 'TOGGLE_SELECT_ALL'; payload: { itemIds: string[] } }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_VIEW'; payload: ViewType }
  | { type: 'SET_SORT'; payload: { sortBy: SortByKey; sortOrder: SortOrder } }
  | { type: 'ADD_TRANSLATION_TASK'; payload: TranslationTask }
  | { type: 'UPDATE_TRANSLATION_TASK_STATUS'; payload: { id: string; status: 'completed' | 'error' } }
  | { type: 'CLEAR_COMPLETED_TASKS' }
  | { type: 'TRIGGER_SYNC_REQUEST'; payload: { docId: string; type: 'media' | 'subtitles' } }
  | { type: 'CLEAR_SYNC_REQUEST' };

const libraryReducer = (state: LibraryState, action: Action): LibraryState => {
  switch (action.type) {
    case 'SET_INITIAL_STATE':
      return { ...state, ...action.payload, isLoading: false };

    case 'CREATE_FOLDER': {
      const now = new Date().toISOString();
      const newFolder: Folder = {
        id: `folder_${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: action.payload.name,
        parentId: action.payload.parentId,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        type: 'folder',
      };
      return { ...state, folders: [...state.folders, newFolder] };
    }

    case 'IMPORT_DOCUMENT': {
      const now = new Date().toISOString();
      const docId = `doc_${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      if (action.payload.file) mediaRegistry[docId] = action.payload.file;
      const newDoc: Document = {
        id: docId,
        name: action.payload.name,
        parentId: action.payload.parentId,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        type: 'document',
        contentByLang: { '_unassigned': action.payload.content },
        csvContentByLang: { '_unassigned': action.payload.csvContent || '' },
        sourceLang: null,
        isLocked: false,
        originalName: action.payload.originalName,
        sourceType: action.payload.sourceType,
        characters: indexCharacters(action.payload.content),
        takes: findTakesWithRanges(action.payload.content),
        layers: [{ id: `L${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: 'Capa 1', visible: true, locked: false, order: 1 }],
        strokes: [],
        textAnnotations: [],
        textHighlights: [],
        annotationLinks: [],
        takeStatuses: {},
        takeNotes: {},
        characterNotes: [],
      };
      return { ...state, documents: [...state.documents, newDoc] };
    }
    
    case 'UPDATE_DOCUMENT_CONTENTS': {
        const { documentId, lang, content, csvContent } = action.payload;
        return {
          ...state,
          documents: state.documents.map((doc) =>
            doc.id === documentId
              ? { ...doc, 
                  contentByLang: { ...doc.contentByLang, [lang]: content },
                  csvContentByLang: { ...doc.csvContentByLang, [lang]: csvContent },
                  updatedAt: new Date().toISOString() 
                }
              : doc
          ),
        };
      }
    
    case 'UPDATE_DOCUMENT_DATA': {
        const { documentId, data } = action.payload;
        return {
            ...state,
            documents: state.documents.map((doc) =>
                doc.id === documentId
                    ? { ...doc, ...data, updatedAt: new Date().toISOString() }
                    : doc
            ),
        };
    }

    case 'SET_SOURCE_LANG': {
      const { documentId, lang } = action.payload;
      return {
        ...state,
        documents: state.documents.map(doc => {
          if (doc.id === documentId && doc.sourceLang === null && doc.contentByLang['_unassigned']) {
            const newContentByLang = { ...doc.contentByLang };
            newContentByLang[lang] = newContentByLang['_unassigned'];
            delete newContentByLang['_unassigned'];
            const newCsvContentByLang = { ...doc.csvContentByLang };
            newCsvContentByLang[lang] = newCsvContentByLang['_unassigned'];
            delete newCsvContentByLang['_unassigned'];
            return {
              ...doc,
              sourceLang: lang,
              contentByLang: newContentByLang,
              csvContentByLang: newCsvContentByLang,
              updatedAt: new Date().toISOString(),
            };
          }
          return doc;
        }),
      };
    }

    case 'ADD_TRANSLATION': {
      const { documentId, lang, content, csvContent } = action.payload;
      return {
        ...state,
        documents: state.documents.map(doc => {
          if (doc.id === documentId) {
            return {
              ...doc,
              contentByLang: { ...doc.contentByLang, [lang]: content },
              csvContentByLang: { ...doc.csvContentByLang, [lang]: csvContent },
              updatedAt: new Date().toISOString(),
            };
          }
          return doc;
        }),
      };
    }

    case 'RENAME_ITEM': {
      const now = new Date().toISOString();
      if (action.payload.type === 'folder') {
        return {
          ...state,
          folders: state.folders.map((f) =>
            f.id === action.payload.id
              ? { ...f, name: action.payload.newName, updatedAt: now }
              : f
          ),
        };
      }
      return {
        ...state,
        documents: state.documents.map((d) =>
          d.id === action.payload.id
            ? { ...d, name: action.payload.newName, updatedAt: now }
            : d
        ),
      };
    }

    case 'MOVE_ITEMS': {
      const now = new Date().toISOString();
      const { itemIds, destinationFolderId } = action.payload;
      return {
        ...state,
        folders: state.folders.map((f) =>
          itemIds.includes(f.id)
            ? { ...f, parentId: destinationFolderId, updatedAt: now }
            : f
        ),
        documents: state.documents.map((d) =>
          itemIds.includes(d.id)
            ? { ...d, parentId: destinationFolderId, updatedAt: now }
            : d
        ),
        selectedIds: new Set(),
      };
    }

    case 'DELETE_ITEMS': {
      const now = new Date().toISOString();
      const { itemIds } = action.payload;
      return {
        ...state,
        folders: state.folders.map((f) =>
          itemIds.includes(f.id) ? { ...f, isDeleted: true, updatedAt: now } : f
        ),
        documents: state.documents.map((d) =>
          itemIds.includes(d.id) ? { ...d, isDeleted: true, updatedAt: now } : d
        ),
        selectedIds: new Set(),
      };
    }

    case 'RESTORE_ITEMS': {
      const now = new Date().toISOString();
      const { itemIds } = action.payload;
      return {
        ...state,
        folders: state.folders.map((f) =>
          itemIds.includes(f.id) ? { ...f, isDeleted: false, updatedAt: now } : f
        ),
        documents: state.documents.map((d) =>
          itemIds.includes(d.id) ? { ...d, isDeleted: false, updatedAt: now } : d
        ),
        selectedIds: new Set(),
      };
    }

    case 'PERMANENTLY_DELETE_ITEMS': {
      const { itemIds } = action.payload;
      const allIdsToDelete = new Set<string>(itemIds);
      const foldersToDelete = state.folders.filter((f) => itemIds.includes(f.id));
      const q: Folder[] = [...foldersToDelete];
      while (q.length > 0) {
        const current = q.shift()!;
        const childFolders = state.folders.filter((f) => f.parentId === current.id);
        const childDocs = state.documents.filter((d) => d.parentId === current.id);
        for (const f of childFolders) {
          allIdsToDelete.add(f.id);
          q.push(f);
        }
        for (const d of childDocs) allIdsToDelete.add(d.id);
      }
      return {
        ...state,
        folders: state.folders.filter((f) => !allIdsToDelete.has(f.id)),
        documents: state.documents.filter((d) => !allIdsToDelete.has(d.id)),
        selectedIds: new Set(),
      };
    }

    case 'SET_CURRENT_FOLDER':
      return { ...state, currentFolderId: action.payload, selectedIds: new Set() };

    case 'TOGGLE_SELECTION': {
      const newSelectedIds = new Set(state.selectedIds);
      if (action.payload.isSelected) newSelectedIds.add(action.payload.id);
      else newSelectedIds.delete(action.payload.id);
      return { ...state, selectedIds: newSelectedIds };
    }

    case 'TOGGLE_SELECT_ALL': {
      const allSelected = state.selectedIds.size === action.payload.itemIds.length;
      if (allSelected) return { ...state, selectedIds: new Set() };
      return { ...state, selectedIds: new Set(action.payload.itemIds) };
    }

    case 'CLEAR_SELECTION':
      return { ...state, selectedIds: new Set() };

    case 'SET_VIEW':
      return { ...state, view: action.payload, currentFolderId: null, selectedIds: new Set() };

    case 'SET_SORT':
      return { ...state, sortBy: action.payload.sortBy, sortOrder: action.payload.sortOrder };

    case 'ADD_TRANSLATION_TASK': {
      return {
        ...state,
        translationTasks: [action.payload, ...state.translationTasks],
        documents: state.documents.map(doc => doc.id === action.payload.documentId ? { ...doc, isLocked: true } : doc)
      };
    }
    
    case 'UPDATE_TRANSLATION_TASK_STATUS': {
      const task = state.translationTasks.find(t => t.id === action.payload.id);
      return {
        ...state,
        translationTasks: state.translationTasks.map(task => task.id === action.payload.id ? { ...task, status: action.payload.status } : task),
        documents: state.documents.map(doc => (task && doc.id === task.documentId) ? { ...doc, isLocked: false } : doc)
      };
    }

    case 'CLEAR_COMPLETED_TASKS':
      return { ...state, translationTasks: state.translationTasks.filter(task => task.status === 'processing') };

    case 'TRIGGER_SYNC_REQUEST':
        return { ...state, syncRequest: { ...action.payload, timestamp: Date.now() } };
    
    case 'CLEAR_SYNC_REQUEST':
        return { ...state, syncRequest: null };

    default:
      return state;
  }
};

const initialState: LibraryState = {
  folders: [],
  documents: [],
  currentFolderId: null,
  selectedIds: new Set(),
  view: 'library',
  sortBy: SortByKey.Name,
  sortOrder: SortOrder.Asc,
  isLoading: true,
  translationTasks: [],
  syncRequest: null,
};

const LOCAL_STORAGE_KEY = 'slsf_library_v3';

const LibraryContext = createContext<{
  state: LibraryState;
  dispatch: React.Dispatch<Action>;
  currentItems: LibraryItem[];
  currentFolder: Folder | null;
  getMediaFile: (docId: string) => File | null;

  // ✅ Backend helpers
  useBackend: boolean;
  reloadTree: () => Promise<void>;
  createFolderRemote: (name: string, parentId: string | null) => Promise<void>;
  createDocumentRemote: (payload: { name: string; parentId: string | null; content: string; csvContent?: string; originalName?: string; sourceType?: string }) => Promise<void>;
  uploadMediaRemote: (file: File) => Promise<void>;
  ensureMediaFile: (docId: string, filename: string) => Promise<File>;
}>({
  state: initialState,
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

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(libraryReducer, initialState);

 const useBackend = process.env.VITE_USE_BACKEND === '1';

  const normalizeFolder = (f: any): Folder => ({
    id: f.id || f._id,
    name: f.name,
    parentId: f.parentId ?? null,
    createdAt: f.createdAt || new Date().toISOString(),
    updatedAt: f.updatedAt || new Date().toISOString(),
    isDeleted: !!f.isDeleted,
    type: 'folder',
  });

  const normalizeDocument = (d: any): Document => {
    const now = new Date().toISOString();
    const content = d?.contentByLang?._unassigned ?? '';
    return {
      id: d.id || d._id,
      name: d.name,
      parentId: d.parentId ?? null,
      createdAt: d.createdAt || now,
      updatedAt: d.updatedAt || now,
      isDeleted: !!d.isDeleted,
      type: 'document',
      contentByLang: d.contentByLang || { _unassigned: '' },
      csvContentByLang: d.csvContentByLang || { _unassigned: '' },
      sourceLang: d.sourceLang ?? null,
      isLocked: !!d.isLocked,
      originalName: d.originalName,
      sourceType: d.sourceType,

      // defaults para no romper el editor
      characters: indexCharacters(content),
      takes: findTakesWithRanges(content),
      layers: [{ id: `L${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: 'Capa 1', visible: true, locked: false, order: 1 }],
      strokes: [],
      textAnnotations: [],
      textHighlights: [],
      annotationLinks: [],
      takeStatuses: {},
      takeNotes: {},
      characterNotes: [],
    };
  };

  const reloadTree = async () => {
    dispatch({ type: 'SET_INITIAL_STATE', payload: { ...initialState } }); // pone loading false al final
    const tree = await api.getTree();
    dispatch({
      type: 'SET_INITIAL_STATE',
      payload: {
        ...initialState,
        folders: (tree.folders || []).map(normalizeFolder),
        documents: (tree.documents || []).map(normalizeDocument),
        selectedIds: new Set(),
      },
    });
  };

  useEffect(() => {
    if (!useBackend) {
      // modo local (tu lógica actual)
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          dispatch({
            type: 'SET_INITIAL_STATE',
            payload: { ...initialState, ...parsed, selectedIds: new Set() },
          });
        } else {
          dispatch({ type: 'SET_INITIAL_STATE', payload: { ...initialState } });
        }
      } catch (e) {
        dispatch({ type: 'SET_INITIAL_STATE', payload: { ...initialState } });
      }
      return;
    }

    // modo backend
    reloadTree().catch(() => {
      // si falla (401), dejamos librería vacía y no crashea
      dispatch({ type: 'SET_INITIAL_STATE', payload: { ...initialState } });
    });
  }, []);

    useEffect(() => {
    if (useBackend) return;
    if (!state.isLoading) {
      const dataToStore = {
        folders: state.folders,
        documents: state.documents,
        translationTasks: state.translationTasks,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToStore));
    }
  }, [state.folders, state.documents, state.translationTasks, state.isLoading, useBackend]);

  const currentItems = useMemo(() => {
    const { folders, documents, currentFolderId, view, sortBy, sortOrder } = state;
    const isTrash = view === 'trash';
    const filteredFolders = folders.filter((f) => f.isDeleted === isTrash && (isTrash || f.parentId === currentFolderId));
    const filteredDocs = documents.filter((d) => d.isDeleted === isTrash && (isTrash || d.parentId === currentFolderId));
    const combined: LibraryItem[] = [...filteredFolders, ...filteredDocs];
    combined.sort((a, b) => {
      if (a.type === 'folder' && b.type === 'document') return -1;
      if (a.type === 'document' && b.type === 'folder') return 1;
      let valA: any = '';
      let valB: any = '';
      if (sortBy === SortByKey.Name) { valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); }
      else if (sortBy === SortByKey.Date) { valA = a.updatedAt; valB = b.updatedAt; }
      else if (sortBy === SortByKey.Format) {
        valA = (a.type === 'folder' ? 'Carpeta' : (a as Document).sourceType || 'slsf').toLowerCase();
        valB = (b.type === 'folder' ? 'Carpeta' : (b as Document).sourceType || 'slsf').toLowerCase();
      }
      if (valA < valB) return sortOrder === SortOrder.Asc ? -1 : 1;
      if (valA > valB) return sortOrder === SortOrder.Asc ? 1 : -1;
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      if (nameA < nameB) return sortOrder === SortOrder.Asc ? -1 : 1;
      if (nameA > nameB) return sortOrder === SortOrder.Asc ? 1 : -1;
      return a.id.localeCompare(b.id);
    });
    return combined;
  }, [state]);

  const currentFolder = useMemo(
    () => state.folders.find((f) => f.id === state.currentFolderId) || null,
    [state.currentFolderId, state.folders]
  );

  const createFolderRemote = async (name: string, parentId: string | null) => {
    await api.createFolder(name, parentId);
    await reloadTree();
  };

 const createDocumentRemote = async (payload: {
  name: string;
  parentId: string | null;
  content: string;
  csvContent?: string;
  originalName?: string;
  sourceType?: string;
}) => {
  await api.createDocument({
    name: payload.name,
    parentId: payload.parentId,
    sourceType: payload.sourceType || 'txt',
    contentByLang: { _unassigned: payload.content || '' },
    // ❌ NO enviar csvContentByLang ni originalName (backend los rechaza con forbidNonWhitelisted)
  });

  await reloadTree();
};

  const uploadMediaRemote = async (file: File) => {
    await api.uploadMedia(file);
    await reloadTree();
  };

  const getMediaFile = (docId: string) => mediaRegistry[docId] || null;

 const ensureMediaFile = async (docId: string, filename: string) => {
    const existing = getMediaFile(docId);
    if (existing) return existing;

    // Requiere que tengas frontend/services/api.ts con api.downloadMediaAsFile
    const file = await api.downloadMediaAsFile(docId, filename);

    mediaRegistry[docId] = file;
    return file;
  };

    return (
    <LibraryContext.Provider value={{
      state,
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

export const useLibrary = () => useContext(LibraryContext);