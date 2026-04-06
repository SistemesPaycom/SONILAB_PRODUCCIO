// context/Library/LibraryDataContext.tsx
import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useMemo,
} from 'react';
import type { Folder, Document } from '../../appTypes';
import { ViewType, SortByKey, SortOrder, LibraryItem } from '../../appTypes';
import { indexCharacters } from '../../utils/ScriptUtils/indexers';
import { findTakesWithRanges } from '../../utils/ScriptUtils/takes';
import { api } from '../../services/api';

// Session-only registry for binary media files (not persisted to localStorage)
const mediaRegistry: Record<string, File> = {};

interface LibraryDataState {
  folders: Folder[];
  documents: Document[];
  currentFolderId: string | null;
  selectedIds: Set<string>;
  view: ViewType;
  sortBy: SortByKey;
  sortOrder: SortOrder;
  isLoading: boolean;
  syncRequest: { docId: string; type: 'media' | 'subtitles'; timestamp: number } | null;
}

export type LibraryDataAction =
  | { type: 'SET_INITIAL_STATE'; payload: Omit<LibraryDataState, 'isLoading' | 'syncRequest'> }
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
  | { type: 'LOCK_DOCUMENT'; payload: { docId: string } }
  | { type: 'UNLOCK_DOCUMENT'; payload: { docId: string } }
  | { type: 'TRIGGER_SYNC_REQUEST'; payload: { docId: string; type: 'media' | 'subtitles' } }
  | { type: 'CLEAR_SYNC_REQUEST' };

const LOCAL_STORAGE_KEY = 'snlbpro_library_v3';

const initialState: LibraryDataState = {
  folders: [],
  documents: [],
  currentFolderId: null,
  selectedIds: new Set(),
  view: 'library',
  sortBy: SortByKey.Name,
  sortOrder: SortOrder.Asc,
  isLoading: true,
  syncRequest: null,
};

function libraryDataReducer(state: LibraryDataState, action: LibraryDataAction): LibraryDataState {
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
        documents: state.documents.map(doc =>
          doc.id === documentId
            ? { ...doc, contentByLang: { ...doc.contentByLang, [lang]: content }, csvContentByLang: { ...doc.csvContentByLang, [lang]: csvContent }, updatedAt: new Date().toISOString() }
            : doc
        ),
      };
    }

    case 'UPDATE_DOCUMENT_DATA': {
      const { documentId, data } = action.payload;
      return {
        ...state,
        documents: state.documents.map(doc =>
          doc.id === documentId ? { ...doc, ...data, updatedAt: new Date().toISOString() } : doc
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
            return { ...doc, sourceLang: lang, contentByLang: newContentByLang, csvContentByLang: newCsvContentByLang, updatedAt: new Date().toISOString() };
          }
          return doc;
        }),
      };
    }

    case 'ADD_TRANSLATION': {
      const { documentId, lang, content, csvContent } = action.payload;
      return {
        ...state,
        documents: state.documents.map(doc =>
          doc.id === documentId
            ? { ...doc, contentByLang: { ...doc.contentByLang, [lang]: content }, csvContentByLang: { ...doc.csvContentByLang, [lang]: csvContent }, updatedAt: new Date().toISOString() }
            : doc
        ),
      };
    }

    case 'RENAME_ITEM': {
      const now = new Date().toISOString();
      if (action.payload.type === 'folder') {
        return { ...state, folders: state.folders.map(f => f.id === action.payload.id ? { ...f, name: action.payload.newName, updatedAt: now } : f) };
      }
      return { ...state, documents: state.documents.map(d => d.id === action.payload.id ? { ...d, name: action.payload.newName, updatedAt: now } : d) };
    }

    case 'MOVE_ITEMS': {
      const now = new Date().toISOString();
      const { itemIds, destinationFolderId } = action.payload;
      return {
        ...state,
        folders: state.folders.map(f => itemIds.includes(f.id) ? { ...f, parentId: destinationFolderId, updatedAt: now } : f),
        documents: state.documents.map(d => itemIds.includes(d.id) ? { ...d, parentId: destinationFolderId, updatedAt: now } : d),
        selectedIds: new Set(),
      };
    }

    case 'DELETE_ITEMS': {
      const now = new Date().toISOString();
      const { itemIds } = action.payload;
      return {
        ...state,
        folders: state.folders.map(f => itemIds.includes(f.id) ? { ...f, isDeleted: true, updatedAt: now } : f),
        documents: state.documents.map(d => itemIds.includes(d.id) ? { ...d, isDeleted: true, updatedAt: now } : d),
        selectedIds: new Set(),
      };
    }

    case 'RESTORE_ITEMS': {
      const now = new Date().toISOString();
      const { itemIds } = action.payload;
      return {
        ...state,
        folders: state.folders.map(f => itemIds.includes(f.id) ? { ...f, isDeleted: false, updatedAt: now } : f),
        documents: state.documents.map(d => itemIds.includes(d.id) ? { ...d, isDeleted: false, updatedAt: now } : d),
        selectedIds: new Set(),
      };
    }

    case 'PERMANENTLY_DELETE_ITEMS': {
      const { itemIds } = action.payload;
      const allIdsToDelete = new Set<string>(itemIds);
      const foldersToDelete = state.folders.filter(f => itemIds.includes(f.id));
      const q: Folder[] = [...foldersToDelete];
      while (q.length > 0) {
        const current = q.shift()!;
        for (const f of state.folders.filter(f => f.parentId === current.id)) { allIdsToDelete.add(f.id); q.push(f); }
        for (const d of state.documents.filter(d => d.parentId === current.id)) allIdsToDelete.add(d.id);
      }
      return {
        ...state,
        folders: state.folders.filter(f => !allIdsToDelete.has(f.id)),
        documents: state.documents.filter(d => !allIdsToDelete.has(d.id)),
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
      return { ...state, selectedIds: allSelected ? new Set() : new Set(action.payload.itemIds) };
    }

    case 'CLEAR_SELECTION':
      return { ...state, selectedIds: new Set() };

    case 'SET_VIEW':
      return { ...state, view: action.payload, currentFolderId: null, selectedIds: new Set() };

    case 'SET_SORT':
      return { ...state, sortBy: action.payload.sortBy, sortOrder: action.payload.sortOrder };

    case 'LOCK_DOCUMENT':
      return { ...state, documents: state.documents.map(doc => doc.id === action.payload.docId ? { ...doc, isLocked: true } : doc) };

    case 'UNLOCK_DOCUMENT':
      return { ...state, documents: state.documents.map(doc => doc.id === action.payload.docId ? { ...doc, isLocked: false } : doc) };

    case 'TRIGGER_SYNC_REQUEST':
      return { ...state, syncRequest: { ...action.payload, timestamp: Date.now() } };

    case 'CLEAR_SYNC_REQUEST':
      return { ...state, syncRequest: null };

    default:
      return state;
  }
}

interface LibraryDataContextValue {
  state: LibraryDataState;
  libraryDispatch: React.Dispatch<LibraryDataAction>;
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

const LibraryDataContext = createContext<LibraryDataContextValue>({
  state: initialState,
  libraryDispatch: () => null,
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

export const LibraryDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(libraryDataReducer, initialState);

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
      refTargetId: d.refTargetId ?? null,
      media: d.media ?? null,
      linkedMediaId: d.linkedMediaId ?? null,
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
    const previousFolderId = state.currentFolderId;
    const tree = await api.getTree();
    const normalizedFolders = (tree.folders || []).map(normalizeFolder);
    const folderStillExists =
      previousFolderId !== null &&
      normalizedFolders.some(f => f.id === previousFolderId && !f.isDeleted);
    dispatch({
      type: 'SET_INITIAL_STATE',
      payload: {
        ...initialState,
        folders: normalizedFolders,
        documents: (tree.documents || []).map(normalizeDocument),
        selectedIds: new Set(),
        currentFolderId: folderStillExists ? previousFolderId : null,
      },
    });
  };

  // Initial load
  useEffect(() => {
    if (!useBackend) {
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          dispatch({ type: 'SET_INITIAL_STATE', payload: { ...initialState, ...parsed, selectedIds: new Set() } });
        } else {
          dispatch({ type: 'SET_INITIAL_STATE', payload: { ...initialState } });
        }
      } catch {
        dispatch({ type: 'SET_INITIAL_STATE', payload: { ...initialState } });
      }
      return;
    }
    reloadTree().catch(() => {
      dispatch({ type: 'SET_INITIAL_STATE', payload: { ...initialState } });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useBackend]);

  // Persist core data to localStorage (local mode only)
  useEffect(() => {
    if (useBackend || state.isLoading) return;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
      folders: state.folders,
      documents: state.documents,
    }));
  }, [state.folders, state.documents, state.isLoading, useBackend]);

  const currentItems = useMemo(() => {
    const { folders, documents, currentFolderId, view, sortBy, sortOrder } = state;
    const isTrash = view === 'trash';
    const deletedFolderIds = isTrash ? new Set(folders.filter(f => f.isDeleted).map(f => f.id)) : null;
    const filteredFolders = folders.filter(f => f.isDeleted === isTrash && (isTrash || f.parentId === currentFolderId) && (!isTrash || !deletedFolderIds!.has(f.parentId!)));
    const filteredDocs = documents.filter(d => d.isDeleted === isTrash && (isTrash || d.parentId === currentFolderId) && (!isTrash || !deletedFolderIds!.has(d.parentId!)));
    const combined: LibraryItem[] = [...filteredFolders, ...filteredDocs];
    combined.sort((a, b) => {
      if (a.type === 'folder' && b.type === 'document') return -1;
      if (a.type === 'document' && b.type === 'folder') return 1;
      let valA: any = '';
      let valB: any = '';
      if (sortBy === SortByKey.Name) { valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); }
      else if (sortBy === SortByKey.Date) { valA = a.updatedAt; valB = b.updatedAt; }
      else if (sortBy === SortByKey.Format) {
        valA = (a.type === 'folder' ? 'Carpeta' : (a as Document).sourceType || 'snlbpro').toLowerCase();
        valB = (b.type === 'folder' ? 'Carpeta' : (b as Document).sourceType || 'snlbpro').toLowerCase();
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
    () => state.folders.find(f => f.id === state.currentFolderId) || null,
    [state.currentFolderId, state.folders]
  );

  const createFolderRemote = async (name: string, parentId: string | null) => {
    await api.createFolder(name, parentId);
    await reloadTree();
  };

  const createDocumentRemote = async (payload: { name: string; parentId: string | null; content: string; csvContent?: string; originalName?: string; sourceType?: string }) => {
    await api.createDocument({
      name: payload.name,
      parentId: payload.parentId,
      sourceType: payload.sourceType || 'txt',
      contentByLang: { _unassigned: payload.content || '' },
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
    const file = await api.downloadMediaAsFile(docId, filename);
    mediaRegistry[docId] = file;
    return file;
  };

  return (
    <LibraryDataContext.Provider value={{
      state,
      libraryDispatch: dispatch,
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
    </LibraryDataContext.Provider>
  );
};

export const useLibraryData = () => useContext(LibraryDataContext);
