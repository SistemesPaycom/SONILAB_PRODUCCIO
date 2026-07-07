// components/Library/LibraryView.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useLibrary } from '../../context/Library/SonilabLibraryContext';
import { ViewType, SortByKey, SortOrder, LibraryItem, TranslationTask, TranscriptionTask } from '../../appTypes';
import { importPdfFile } from '../../utils/Import/pdfImporter';
import { importDocxFile } from '../../utils/Import/docxImporter';
import { ImportOptions } from '../../utils/Import/importShared';
import { parseScript } from '../../utils/EditorDeGuions/scriptParser';
import { scriptToCsv } from '../../utils/EditorDeGuions/csvConverter';
import { FileItem } from './LibraryFileItem';
import * as Icons from '../icons';
import OpenWithModal from './OpenWithModal';
import SrtEditorModeModal from './SrtEditorModeModal';
import ImportFilesModal from '../Import/ImportFilesModal';
import { api } from '@/services/api';
import { CreateProjectModal } from '../Projects/CreateProjectModal';
import { LOCAL_STORAGE_KEYS } from '../../constants';
import useLocalStorage from '../../hooks/useLocalStorage';
import { useAuth } from '../../context/Auth/AuthContext';
import { useUploadContext } from '../../context/Upload/UploadContext';
import { AdminPanel } from '../Admin/AdminPanel';

type OpenMode = 'editor' | 'editor-video' | 'editor-video-subs' | 'editor-ssrtlsf' | 'editor-srt-standalone';

interface LibraryViewProps {
  onOpenDocument: (docId: string, mode: OpenMode, editingMode: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
  onOpenSettings: () => void;
  onOpenNotifications: () => void;
  onOpenPujades: () => void;
  page: 'library' | 'media' | 'projects';
  onChangePage: (p: 'library' | 'media' | 'projects') => void;
}

const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  cleanSpaces: true,
  applyTabHeuristic: true,
};

const ConfirmationModal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void; 
  title: string; 
  message: string;
  confirmLabel: string;
}> = ({ isOpen, onClose, onConfirm, title, message, confirmLabel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[500] backdrop-blur-sm p-4" onClick={onClose}>
      <div className="rounded-2xl p-6 w-full max-w-sm shadow-2xl" style={{ backgroundColor: 'var(--th-bg-surface)', border: '1px solid var(--th-border)' }} onClick={e => e.stopPropagation()}>
        <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
          <Icons.Trash className="w-6 h-6 text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-white text-center mb-2">{title}</h3>
        <p className="text-center text-sm mb-6" style={{ color: 'var(--th-text-secondary)' }}>{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-gray-200 font-bold rounded-xl text-xs uppercase tracking-widest transition-all hover:brightness-125" style={{ backgroundColor: 'var(--th-bg-tertiary)' }}>Cancel·lar</button>
          <button onClick={() => { onConfirm(); onClose(); }} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

const PujadesButton: React.FC<{ isCollapsed: boolean; onOpen: () => void }> = ({ isCollapsed, onOpen }) => {
  const { jobs } = useUploadContext();
  const activeCount = jobs.filter(j => j.status === 'uploading').length;
  return (
    <button
      onClick={onOpen}
      className={`rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${isCollapsed ? 'w-10 h-10 justify-center p-0' : 'px-3 py-2 w-full'} text-gray-200 hover:brightness-125 relative`}
      style={{ backgroundColor: 'var(--th-bg-tertiary)' }}
      title="Pujades"
    >
      <Icons.Upload className="w-5 h-5" />
      <span className={isCollapsed ? 'hidden' : 'inline'}>Pujades</span>
      {activeCount > 0 && (
        <span
          className={`absolute -top-1 -right-1 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-2 ring-gray-900 ${isCollapsed ? 'scale-75' : ''}`}
          style={{ backgroundColor: 'var(--th-accent)' }}
        >
          {activeCount}
        </span>
      )}
    </button>
  );
};

// Separa el nom base de l'extensió. Per a carpetes o noms sense punt, retorna ext=''.
// Exemple: "transcript.srt" → { base: "transcript", ext: ".srt" }
function splitFileNameExt(name: string): { base: string; ext: string } {
  const i = name.lastIndexOf('.');
  if (i <= 0) return { base: name, ext: '' };
  return { base: name.substring(0, i), ext: name.substring(i) };
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  onOpenDocument,
  isCollapsed,
  setIsCollapsed,
  onOpenSettings,
  onOpenNotifications,
  onOpenPujades,
  page,
  onChangePage,
}) => {
  const { state, dispatch, currentItems, currentFolder,useBackend, createFolderRemote, createDocumentRemote, uploadMediaRemote, reloadTree } = useLibrary();
  const { isAdmin } = useAuth();
 const { view, sortBy, sortOrder, selectedIds, folders, translationTasks, transcriptionTasks } = state;

  const currentMediaFolder = React.useMemo(
    () => folders.find(f => f.id === state.currentMediaFolderId) || null,
    [state.currentMediaFolderId, folders]
  );

  const [isCreateFolderModalOpen, setCreateFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [openWithDocId, setOpenWithDocId] = useState<string | null>(null);
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState(false);
  const [isRenameModalOpen, setRenameModalOpen] = useState(false);
const [renameValue, setRenameValue] = useState('');
const [renameExt, setRenameExt] = useState('');

  const [projectFolderIds, setProjectFolderIds] = useState<Set<string>>(new Set());
  // Estat de navegació independent per al tab Projectes (no compartit amb Files).
  // null = arrel de Projectes; string = ID de la carpeta de projecte activa (o subcarpeta interna).
  const [currentProjectFolderId, setCurrentProjectFolderId] = useState<string | null>(null);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
const MEDIA_EXTS = ['mp4', 'mov', 'webm', 'wav', 'mp3', 'ogg', 'm4a'];
  const [nameColWidth, setNameColWidth] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.LIBRARY_NAME_COL_WIDTH, 200);
  const [formatColWidth, setFormatColWidth] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.LIBRARY_FORMAT_COL_WIDTH, 100);
  const [dateColWidth, setDateColWidth] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.LIBRARY_DATE_COL_WIDTH, 140);
  const { addJob, updateJob, completeJob, registerAbort } = useUploadContext();
  const [duplicateNotice, setDuplicateNotice] = useState<{ fileName: string; existingName: string; existingDocId: string; folderPath: string; file: File; targetParentId: string | null; tentative?: boolean } | null>(null);
  const [clipboard, setClipboard] = useState<{ itemIds: string[]; mode: 'copy' | 'cut' } | null>(null);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [moveConflict, setMoveConflict] = useState<{
    ids: string[];
    destinationFolderId: string | null;
    conflictName: string;
    isFolder: boolean;
    step: 'choose' | 'rename';
    renameValue: string;  // base del nom sense extensió
    renameExt: string;    // extensió protegida (ex: ".srt"), buida per a carpetes
    // Cua de conflictes secundaris quan s'està en mode Fusionar
    mergeQueue?: {
      remaining: Array<{ id: string; name: string; isFolder: boolean }>;
      sourceToCleanup: string | null;
      cancelledCount: number;
      total: number;
    };
  } | null>(null);
  const [uploadBlockError, setUploadBlockError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toolbarMenuOpen, setToolbarMenuOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [srtModeModalOpen, setSrtModeModalOpen] = useState(false);
  const [srtModeDocId, setSrtModeDocId] = useState<string | null>(null);
  const [srtModeHasGuion, setSrtModeHasGuion] = useState(false);

  // True si qualsevol element seleccionat és un asset de media canònica (media poblat, no és un LNK).
  // S'usa per ocultar Copiar/Retallar sobre media i evitar duplicació de binaris via clipboard clàssic.
  const selectionHasCanonicalMedia = Array.from(selectedIds).some(id => {
    const d = state.documents.find(d2 => d2.id === id);
    return !!(d && (d as any).media && !(d as any).refTargetId);
  });

  const goLibrary = () => {
  dispatch({ type: 'SET_VIEW', payload: 'library' });
  setIsCollapsed(false);
  onChangePage('library');
};

const goMedia = () => {
  dispatch({ type: 'SET_VIEW', payload: 'library' });
  setIsCollapsed(false);
  onChangePage('media');
};

const goProjects = () => {
  dispatch({ type: 'SET_VIEW', payload: 'library' });
  setIsCollapsed(false);
  setCurrentProjectFolderId(null);
  onChangePage('projects');
};

const goTrash = () => {
  dispatch({ type: 'SET_VIEW', payload: 'trash' });
  setIsCollapsed(false);
  // page lo dejamos igual o lo puedes resetear si quieres:
  // setPage('library');
};

  // Fetch project folder IDs at mount so Files tab shows 🗃️ from the first render
  useEffect(() => {
    if (!useBackend) return;
    api.listProjects()
      .then((projects) => {
        setProjectFolderIds(new Set((projects || []).map((p: any) => p.folderId).filter(Boolean)));
      })
      .catch(() => {});
  }, [useBackend]);

  const handleResizeNameMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = nameColWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setNameColWidth(Math.max(100, Math.min(600, startWidth + deltaX)));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleResizeFormatMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = formatColWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setFormatColWidth(Math.max(60, Math.min(250, startWidth + deltaX)));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleResizeDateMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = dateColWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setDateColWidth(Math.max(80, Math.min(300, startWidth + deltaX)));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleSortChange = (key: SortByKey) => {
    const newOrder = sortBy === key && sortOrder === SortOrder.Asc ? SortOrder.Desc : SortOrder.Asc;
    dispatch({ type: 'SET_SORT', payload: { sortBy: key, sortOrder: newOrder } });
  };

 const handleCreateFolder = async () => {
  if (!newFolderName.trim()) return;
  const parentId = page === 'media' ? state.currentMediaFolderId : state.currentFolderId;
  const category: 'files' | 'media' = page === 'media' ? 'media' : 'files';

  if (useBackend) {
    await createFolderRemote(newFolderName.trim(), parentId, category);
  } else {
    dispatch({ type: 'CREATE_FOLDER', payload: { name: newFolderName.trim(), parentId, category } });
  }

  setNewFolderName('');
  setCreateFolderModalOpen(false);
};

  const handleFilesUpload = async (files: File[]) => {
    for (const file of files) {
      await handleSingleFileUpload(file);
    }
  };

  const handleSingleFileUpload = async (file: File) => {
    if (!file) return;
    let _uploadJobId: string | undefined;
    try {
      const originalName = file.name;
      const lastDotIndex = originalName.lastIndexOf('.');
      const baseName = lastDotIndex !== -1 ? originalName.substring(0, lastDotIndex) : originalName;
      const ext = originalName.toLowerCase().split('.').pop();
      let content = '', csvContent = '', sourceType = ext || 'unknown';

      // Guard: des de la pestanya Media no s'accepten guions ni PDFs.
      // Els subtítols (.srt) sí s'accepten des de qualsevol pestanya — s'importen a l'arrel de Files.
      if (page === 'media' && ['pdf', 'docx'].includes(ext || '')) {
        setUploadBlockError('Des de la pestanya Media, només es pot afegir vídeo o àudio.');
        return;
      }

      if (ext === 'pdf') {
        content = await importPdfFile(file, DEFAULT_IMPORT_OPTIONS);
        sourceType = 'snlbpro';
      } else if (ext === 'docx') {
        content = await importDocxFile(file, DEFAULT_IMPORT_OPTIONS);
        sourceType = 'snlbpro';
      } else if (ext === 'srt') {
        content = await file.text();
        sourceType = 'srt';
      } else if (['mp4', 'wav', 'mov', 'webm', 'ogg', 'mp3'].includes(ext || '')) {
        // Guard: media no pot entrar a Arxius pel flux genèric d'importació.
        // L'usuari ha de fer-ho des de la pestanya Media.
        // Un LNK no passa per aquest flux (no s'importa un fitxer per crear LNK).
        if (page !== 'media') {
          setUploadBlockError('Per afegir vídeo o àudio, usa la pestanya Media.');
          return;
        }
        content = '';
        sourceType = ext || 'video';
      } else return;

      if (ext === 'pdf' || ext === 'docx') {
        const { takes } = parseScript(content);
        csvContent = scriptToCsv(takes);
      }
      
      // Nou format: .txt (text pla reestructurat). Els antics .slsf segueixen funcionant per compatibilitat.
      const finalName = (ext === 'pdf' || ext === 'docx') ? `${baseName}.txt` : originalName;
      
     if (useBackend) {
  if (['mp4', 'wav', 'mov', 'webm', 'ogg', 'mp3', 'm4a'].includes(ext || '')) {

    // ── Precheck ligero: nombre + tamaño (sin cargar el archivo en RAM) ──
    const precheck = await api.checkMediaDuplicate(file.name, file.size);

    if (precheck.exists) {
      // Probable duplicate found — show modal WITHOUT uploading
      const existingDoc = precheck.document;
      const pathParts: string[] = [];
      let pid: string | null = existingDoc.parentId ?? null;
      while (pid) {
        const folder = state.folders.find(f => f.id === pid);
        if (!folder) break;
        pathParts.unshift(folder.name);
        pid = folder.parentId ?? null;
      }
      const folderPath = pathParts.length > 0 ? pathParts.join(' / ') : 'Arrel';
      setDuplicateNotice({ fileName: file.name, existingName: existingDoc.name, existingDocId: existingDoc.id || existingDoc._id, folderPath, file, targetParentId: state.currentMediaFolderId, tentative: true });
    } else {
      // No probable match — proceed with normal upload
      _uploadJobId = crypto.randomUUID();
      addJob(_uploadJobId, file.name);

      const { promise: uploadPromise, abort: uploadAbort } = api.uploadMedia(file, (pct) => {
        updateJob(_uploadJobId!, pct);
      }, state.currentMediaFolderId);
      registerAbort(_uploadJobId, uploadAbort);

      const uploadResult = await uploadPromise;

      completeJob(_uploadJobId, true);
      _uploadJobId = undefined;

      if (uploadResult.duplicated) {
        // Backend confirmed real duplicate by SHA-256
        const existingDoc = uploadResult.document;
        const pathParts: string[] = [];
        let pid: string | null = existingDoc.parentId ?? null;
        while (pid) {
          const folder = state.folders.find(f => f.id === pid);
          if (!folder) break;
          pathParts.unshift(folder.name);
          pid = folder.parentId ?? null;
        }
        const folderPath = pathParts.length > 0 ? pathParts.join(' / ') : 'Arrel';
        setDuplicateNotice({ fileName: file.name, existingName: existingDoc.name, existingDocId: existingDoc.id || existingDoc._id, folderPath, file, targetParentId: state.currentMediaFolderId });
      } else {
        if (page === 'library') {
          const newDocId = uploadResult.document.id || uploadResult.document._id;
          await api.createMediaRef(newDocId, state.currentFolderId);
        }
        await reloadTree();
      }
    }
  } else {
    await createDocumentRemote({
      name: finalName,
      parentId: state.currentFolderId,
      content,
      csvContent,
      originalName,
      sourceType,
    });
  }
} else {
  dispatch({
    type: 'IMPORT_DOCUMENT',
    payload: {
      name: finalName,
      parentId: state.currentFolderId,
      content,
      csvContent,
      originalName,
      sourceType,
      file: ['mp4', 'wav', 'mov', 'webm', 'ogg', 'mp3'].includes(ext || '') ? file : undefined,
    },
  });
}
    } catch (error) {
      if (_uploadJobId) completeJob(_uploadJobId, false, (error as any)?.message || 'error desconegut');
      if ((error as any)?.message !== 'Cancel·lat') {
        console.error(`Error important arxiu ${file.name}:`, error);
        setUploadBlockError(`Error important ${file.name}: ${(error as any)?.message || 'error desconegut'}`);
      }
    }
  };

  const handleContinueUpload = async () => {
    if (!duplicateNotice) return;
    const { file, targetParentId } = duplicateNotice;
    const savedNotice = duplicateNotice; // snapshot for error recovery
    // Close modal — panel takes over during upload
    setDuplicateNotice(null);
    const jobId = crypto.randomUUID();
    addJob(jobId, file.name);
    try {
      const { promise: uploadPromise, abort: uploadAbort } = api.uploadMedia(file, (pct) => updateJob(jobId, pct), targetParentId);
      registerAbort(jobId, uploadAbort);
      const uploadResult = await uploadPromise;
      completeJob(jobId, true);
      if (uploadResult.duplicated) {
        // Backend confirmed real duplicate by SHA-256 — show definitive modal (no tentative)
        const existingDoc = uploadResult.document;
        const pathParts: string[] = [];
        let pid: string | null = existingDoc.parentId ?? null;
        while (pid) {
          const folder = state.folders.find(f => f.id === pid);
          if (!folder) break;
          pathParts.unshift(folder.name);
          pid = folder.parentId ?? null;
        }
        const folderPath = pathParts.length > 0 ? pathParts.join(' / ') : 'Arrel';
        setDuplicateNotice({ fileName: file.name, existingName: existingDoc.name, existingDocId: existingDoc.id || existingDoc._id, folderPath, file, targetParentId: state.currentMediaFolderId });
      } else {
        if (page === 'library') {
          const newDocId = uploadResult.document.id || uploadResult.document._id;
          await api.createMediaRef(newDocId, state.currentFolderId);
        }
        await reloadTree();
      }
    } catch (err) {
      completeJob(jobId, false, (err as any)?.message || 'error desconegut');
      if ((err as any)?.message !== 'Cancel·lat') {
        console.error('Error en continue upload:', err);
        // Restore modal with error so user doesn't lose context silently
        setDuplicateNotice(savedNotice);
      }
    }
  };

  const handleCreateRef = async () => {
    if (!duplicateNotice) return;
    const { existingDocId } = duplicateNotice;
    if (!existingDocId) return;
    try {
      // LNK always goes to the active Files folder, not to the Media folder (targetParentId)
      await api.createMediaRef(existingDocId, state.currentFolderId);
      setDuplicateNotice(null);
      await reloadTree();
    } catch (err) {
      console.error('Error creant accés directe:', err);
    }
  };

  const itemsToRender = view === 'trash'
    ? currentItems  // Paperera global — currentItems ja conté tots els eliminats (veure LibraryDataContext)
    : page === 'media'
      ? (() => {
          const mediaItems: (typeof state.folders[0] | typeof state.documents[0])[] = [
            ...state.folders.filter(f =>
              !f.isDeleted &&
              f.category === 'media' &&
              f.parentId === state.currentMediaFolderId
            ),
            ...state.documents.filter(doc =>
              !doc.isDeleted &&
              MEDIA_EXTS.includes((doc.sourceType || '').toLowerCase()) &&
              !!(doc as any).media &&
              !(doc as any).refTargetId &&
              doc.parentId === state.currentMediaFolderId
            ),
          ];
          mediaItems.sort((a, b) => {
            if (a.type === 'folder' && b.type === 'document') return -1;
            if (a.type === 'document' && b.type === 'folder') return 1;
            let valA: any = '', valB: any = '';
            if (sortBy === SortByKey.Name) { valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); }
            else if (sortBy === SortByKey.Date) { valA = a.updatedAt; valB = b.updatedAt; }
            else if (sortBy === SortByKey.Format) {
              valA = (a.type === 'folder' ? 'Media' : (a as any).sourceType || '').toLowerCase();
              valB = (b.type === 'folder' ? 'Media' : (b as any).sourceType || '').toLowerCase();
            }
            if (valA < valB) return sortOrder === SortOrder.Asc ? -1 : 1;
            if (valA > valB) return sortOrder === SortOrder.Asc ? 1 : -1;
            const nameA = a.name.toLowerCase(), nameB = b.name.toLowerCase();
            if (nameA < nameB) return sortOrder === SortOrder.Asc ? -1 : 1;
            if (nameA > nameB) return sortOrder === SortOrder.Asc ? 1 : -1;
            return a.id.localeCompare(b.id);
          });
          return mediaItems;
        })()
      : page === 'projects'
        ? (() => {
            if (currentProjectFolderId === null) {
              // Arrel de Projectes: mostra TOTES les carpetes de projecte de state.folders,
              // independentment del parentId (funciona com un filtre global, no jeràrquic).
              return [...state.folders.filter(f => !f.isDeleted && projectFolderIds.has(f.id))]
                .sort((a, b) => {
                  let valA: any = '', valB: any = '';
                  if (sortBy === SortByKey.Name) { valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); }
                  else if (sortBy === SortByKey.Date) { valA = a.updatedAt; valB = b.updatedAt; }
                  if (valA < valB) return sortOrder === SortOrder.Asc ? -1 : 1;
                  if (valA > valB) return sortOrder === SortOrder.Asc ? 1 : -1;
                  return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
                });
            }
            // Dins d'una carpeta de projecte: mostra el contingut normal (exclou media canònica i carpetes media).
            return currentItems.filter((item) => {
              if (item.type === 'folder' && (item as any).category === 'media') return false;
              if (item.type === 'document' && !(item as any).refTargetId && (
                !!(item as any).media || MEDIA_EXTS.includes((item.sourceType || '').toLowerCase())
              )) return false;
              return true;
            });
          })()
        : currentItems.filter((item) => {
            // Media canònica pertany exclusivament a la pestanya Media: no ha d'aparèixer a library.
            // Un LNK (refTargetId poblat, media null) no és media canònica i sí pertany a Arxius.
            // També s'exclouen documents amb sourceType de media sense camp media (documents legacy).
            // Carpetes de categoria 'media' no apareixen a Files.
            if (item.type === 'folder' && (item as any).category === 'media') return false;
            if (item.type === 'document' && !(item as any).refTargetId && (
              !!(item as any).media || MEDIA_EXTS.includes((item.sourceType || '').toLowerCase())
            )) return false;
            return true;
          });

  const handleSelectAll = () => {
    dispatch({ type: 'TOGGLE_SELECT_ALL', payload: { itemIds: itemsToRender.map((item) => item.id) } });
  };

  const handleLibraryClick = () => {
    if (view === 'library') setIsCollapsed(!isCollapsed);
    else { dispatch({ type: 'SET_VIEW', payload: 'library' }); setIsCollapsed(false); }
  };

  const handleTrashClick = () => {
    if (view === 'trash') setIsCollapsed(!isCollapsed);
    else { dispatch({ type: 'SET_VIEW', payload: 'trash' }); setIsCollapsed(false); }
  };

  const handleDeleteSelected = () => {
  const ids = Array.from(state.selectedIds).map((v) => String(v));

  if (!useBackend) {
    // Cascade soft delete to all descendants of selected folders
    const allIds = new Set<string>(ids);
    const queue = ids.filter((id) => state.folders.some((f) => f.id === id));
    while (queue.length) {
      const cur = queue.shift()!;
      for (const f of state.folders.filter((f) => f.parentId === cur && !f.isDeleted)) {
        allIds.add(f.id); queue.push(f.id);
      }
      for (const d of state.documents.filter((d) => d.parentId === cur && !d.isDeleted)) {
        allIds.add(d.id);
      }
    }
    dispatch({ type: 'DELETE_ITEMS', payload: { itemIds: Array.from(allIds) } });
    return;
  }

  void (async () => {
    const folderIds = ids.filter((id) => state.folders.some((f) => f.id === id));
    const docIds = ids.filter((id) => state.documents.some((d) => d.id === id));

    // Conjunt total efectiu de doc IDs que seran esborrats:
    // docs seleccionats directament + docs dins carpetes seleccionades (i descendents).
    const allEffectiveDocIds = new Set<string>(docIds);
    const allFolderIds = new Set<string>();
    const folderQueue = [...folderIds];
    while (folderQueue.length) {
      const fid = folderQueue.shift()!;
      allFolderIds.add(fid);
      for (const f of state.folders.filter(f => f.parentId === fid && !f.isDeleted)) {
        folderQueue.push(f.id);
      }
    }
    for (const d of state.documents.filter(d => !d.isDeleted && d.parentId && allFolderIds.has(d.parentId))) {
      allEffectiveDocIds.add(d.id);
    }
    const batchDocIds = Array.from(allEffectiveDocIds);

    // Pre-validació local: comprova tots els media canònics del conjunt efectiu.
    // Només bloqueja si queda algun LNK actiu FORA del conjunt total de borrat.
    for (const id of allEffectiveDocIds) {
      const doc = state.documents.find(d => d.id === id);
      if (doc && (doc as any).media && !(doc as any).refTargetId) {
        const hasExternalLnk = state.documents.some(d =>
          !d.isDeleted &&
          (d as any).refTargetId === id &&
          !allEffectiveDocIds.has(d.id),
        );
        if (hasExternalLnk) {
          setDeleteError(`No es pot esborrar "${doc.name}": té referències actives externes. Esborra primer les referències.`);
          return;
        }
      }
    }

    try {
      // Execució seqüencial + batchDocIds perquè cada endpoint vegi el conjunt total.
      for (const id of folderIds) await api.deleteFolder(id, batchDocIds);
      for (const id of docIds) await api.deleteDocument(id, batchDocIds);
      await reloadTree();
    } catch (err: any) {
      setDeleteError(err?.message || 'Error en esborrar');
      await reloadTree();
    }
  })();
};
  const handleRestoreSelected = () => {
  const ids = Array.from(state.selectedIds).map((v) => String(v));

  if (!useBackend) {
    // Cascade restore to all descendants of selected folders
    const allIds = new Set<string>(ids);
    const queue = ids.filter((id) => state.folders.some((f) => f.id === id));
    while (queue.length) {
      const cur = queue.shift()!;
      for (const f of state.folders.filter((f) => f.parentId === cur && f.isDeleted)) {
        allIds.add(f.id); queue.push(f.id);
      }
      for (const d of state.documents.filter((d) => d.parentId === cur && d.isDeleted)) {
        allIds.add(d.id);
      }
    }
    dispatch({ type: 'RESTORE_ITEMS', payload: { itemIds: Array.from(allIds) } });
    return;
  }

  void (async () => {
    const folderIds = ids.filter((id) => state.folders.some((f) => f.id === id));
    const docIds = ids.filter((id) => state.documents.some((d) => d.id === id));

    await Promise.all([
      ...folderIds.map((id) => api.restoreFolder(id)),
      ...docIds.map((id) => api.restoreDocument(id)),
    ]);

    await reloadTree();
  })();
};
  
  const handlePermanentDeleteConfirmed = () => {
  const ids = Array.from(state.selectedIds).map((v) => String(v));
  console.log('[purge] handler invoked, ids:', ids);

  if (!useBackend) {
    dispatch({ type: 'PERMANENTLY_DELETE_ITEMS', payload: { itemIds: ids } });
    return;
  }

  void (async () => {
    const folderIds = ids.filter((id) => state.folders.some((f) => f.id === id));
    const docIds = ids.filter((id) => state.documents.some((d) => d.id === id));

    // Conjunt total efectiu de doc IDs del lot de purge (mateixa lògica que delete normal).
    const allEffectiveDocIds = new Set<string>(docIds);
    const allFolderIds = new Set<string>();
    const folderQueue = [...folderIds];
    while (folderQueue.length) {
      const fid = folderQueue.shift()!;
      allFolderIds.add(fid);
      for (const f of state.folders.filter(f => f.parentId === fid)) {
        folderQueue.push(f.id);
      }
    }
    for (const d of state.documents.filter(d => d.parentId && allFolderIds.has(d.parentId))) {
      allEffectiveDocIds.add(d.id);
    }
    const batchDocIds = Array.from(allEffectiveDocIds);

    // Pre-validació local: comprova tots els media canònics del conjunt efectiu.
    for (const id of allEffectiveDocIds) {
      const doc = state.documents.find(d => d.id === id);
      if (doc && (doc as any).media && !(doc as any).refTargetId) {
        const hasExternalLnk = state.documents.some(d =>
          !d.isDeleted &&
          (d as any).refTargetId === id &&
          !allEffectiveDocIds.has(d.id),
        );
        if (hasExternalLnk) {
          setDeleteError(`No es pot eliminar permanentment "${doc.name}": té referències actives externes. Esborra primer les referències.`);
          return;
        }
      }
    }

    try {
      // Execució seqüencial + batchDocIds perquè el backend vegi el conjunt total.
      for (const id of folderIds) await api.purgeFolder(id, batchDocIds);
      for (const id of docIds) await api.purgeDocument(id, batchDocIds);
      await reloadTree();
      dispatch({ type: 'SET_VIEW', payload: 'trash' });
    } catch (err: any) {
      setDeleteError(err?.message || 'Error en eliminar permanentment');
      await reloadTree();
    }
  })();
};
  const handleClipboardCopy = (ids: string[]) => {
    if (ids.length === 0) return;
    setPasteError(null);
    setClipboard({ itemIds: ids, mode: 'copy' });
  };
  const handleClipboardCut = (ids: string[]) => {
    setPasteError(null);
    setClipboard({ itemIds: ids, mode: 'cut' });
  };
  const handleMoveItemsToBackend = React.useCallback(async (ids: string[], destinationFolderId: string | null) => {
    if (!useBackend) return;
    try {
      for (const id of ids) {
        const isFolder = state.folders.some(f => f.id === id);
        if (isFolder) await api.patchFolder(id, { parentId: destinationFolderId });
        else await api.patchDocument(id, { parentId: destinationFolderId });
      }
      await reloadTree();
    } catch (err: any) {
      await reloadTree(); // reverteix l'update optimista
      const msg: string = err?.message || '';
      if (msg.toLowerCase().includes('ja existeix')) {
        const firstConflictId = ids.find(id => {
          const isF = state.folders.some(f => f.id === id);
          const itm = isF ? state.folders.find(f => f.id === id) : state.documents.find(d => d.id === id);
          return msg.includes(`"${itm?.name}"`);
        }) ?? ids[0];
        const isFolder = state.folders.some(f => f.id === firstConflictId);
        const itm = isFolder
          ? state.folders.find(f => f.id === firstConflictId)
          : state.documents.find(d => d.id === firstConflictId);
        const _mcName = itm?.name || '';
        setMoveConflict({
          ids: [firstConflictId],
          destinationFolderId,
          conflictName: _mcName,
          isFolder,
          step: 'choose',
          renameValue: isFolder ? _mcName : splitFileNameExt(_mcName).base,
          renameExt: isFolder ? '' : splitFileNameExt(_mcName).ext,
        });
      } else {
        setPasteError(msg || 'Error en moure els elements');
      }
    }
  }, [useBackend, state.folders, state.documents, reloadTree]);

  // ── Resolució de conflictes de moviment ────────────────────────────────────

  // Fusionar: mou els fills de la carpeta origen a la destí, un per un.
  // Els fills que entren en conflicte s'encuen per resoldre'ls interactivament.
  // Quan tots els fills s'han mogut, la carpeta origen es purgea (hard-delete, no Paperera).
  const handleMoveConflictMerge = async () => {
    if (!moveConflict) return;
    const sourceId = moveConflict.ids[0];
    const destId = moveConflict.destinationFolderId;
    const destFolder = state.folders.find(f =>
      (f.parentId ?? null) === destId && f.name === moveConflict.conflictName && !(f as any).isDeleted,
    );
    if (!destFolder) { setMoveConflict(null); await reloadTree(); return; }
    const destFolderId = destFolder.id;
    type MergeItem = { id: string; name: string; isFolder: boolean };
    const children: MergeItem[] = [
      ...state.folders.filter(f => f.parentId === sourceId && !(f as any).isDeleted).map(f => ({ id: f.id, name: f.name, isFolder: true })),
      ...state.documents.filter(d => (d as any).parentId === sourceId && !(d as any).isDeleted).map(d => ({ id: d.id, name: d.name, isFolder: false })),
    ];
    const conflictQueue: MergeItem[] = [];
    for (const child of children) {
      try {
        if (child.isFolder) await api.patchFolder(child.id, { parentId: destFolderId });
        else await api.patchDocument(child.id, { parentId: destFolderId });
      } catch (err: any) {
        if ((err?.message || '').toLowerCase().includes('ja existeix')) conflictQueue.push(child);
      }
    }
    await reloadTree();
    if (conflictQueue.length === 0) {
      // Cap conflicte — purge (hard-delete, no Paperera) la carpeta origen buida
      try { await api.purgeFolder(sourceId); } catch {}
      await reloadTree();
      setMoveConflict(null);
    } else {
      const first = conflictQueue[0];
      setMoveConflict({
        ids: [first.id],
        destinationFolderId: destFolderId,
        conflictName: first.name,
        isFolder: first.isFolder,
        step: 'choose',
        renameValue: first.isFolder ? first.name : splitFileNameExt(first.name).base,
        renameExt: first.isFolder ? '' : splitFileNameExt(first.name).ext,
        mergeQueue: { remaining: conflictQueue.slice(1), sourceToCleanup: sourceId, cancelledCount: 0, total: conflictQueue.length },
      });
    }
  };

  // Avança al següent element de la cua de conflictes d'una operació Fusionar.
  // Si la cua s'esgota i no s'ha cancel·lat cap element, purga la carpeta origen.
  const advanceMergeQueue = async (cancelled: boolean) => {
    if (!moveConflict?.mergeQueue) { await reloadTree(); setMoveConflict(null); return; }
    const { remaining, sourceToCleanup, cancelledCount, total } = moveConflict.mergeQueue;
    const newCancelledCount = cancelledCount + (cancelled ? 1 : 0);
    await reloadTree();
    if (remaining.length === 0) {
      if (newCancelledCount === 0 && sourceToCleanup) {
        try { await api.purgeFolder(sourceToCleanup); } catch {}
        await reloadTree();
      }
      setMoveConflict(null);
    } else {
      const next = remaining[0];
      setMoveConflict({
        ids: [next.id],
        destinationFolderId: moveConflict.destinationFolderId,
        conflictName: next.name,
        isFolder: next.isFolder,
        step: 'choose',
        renameValue: next.isFolder ? next.name : splitFileNameExt(next.name).base,
        renameExt: next.isFolder ? '' : splitFileNameExt(next.name).ext,
        mergeQueue: { remaining: remaining.slice(1), sourceToCleanup, cancelledCount: newCancelledCount, total },
      });
    }
  };

  const handleMoveConflictReplace = async () => {
    if (!moveConflict) return;
    const sourceId = moveConflict.ids[0];
    const destId = moveConflict.destinationFolderId;
    const destDoc = state.documents.find(d =>
      (d as any).parentId === destId && d.name === moveConflict.conflictName && !(d as any).isDeleted,
    );
    if (!destDoc) {
      if (moveConflict.mergeQueue) await advanceMergeQueue(false);
      else { await reloadTree(); setMoveConflict(null); }
      return;
    }
    try {
      await api.deleteDocument(destDoc.id);
      await api.patchDocument(sourceId, { parentId: destId });
    } catch (err: any) {
      setPasteError(err?.message || 'Error en reemplazar el fitxer');
      return; // L'usuari pot tornar a intentar-ho o ometre l'element
    }
    if (moveConflict.mergeQueue) await advanceMergeQueue(false);
    else { await reloadTree(); setMoveConflict(null); }
  };

  const handleMoveConflictRenameConfirm = async () => {
    if (!moveConflict) return;
    if (!moveConflict.renameValue.trim()) return;
    const newName = moveConflict.renameValue.trim() + moveConflict.renameExt;
    if (newName === moveConflict.conflictName) return;
    const sourceId = moveConflict.ids[0];
    const destId = moveConflict.destinationFolderId;
    try {
      if (moveConflict.isFolder) await api.patchFolder(sourceId, { name: newName, parentId: destId });
      else await api.patchDocument(sourceId, { name: newName, parentId: destId });
    } catch (err: any) {
      const msg: string = err?.message || '';
      if (msg.toLowerCase().includes('ja existeix')) {
        setPasteError(`El nom "${newName}" ja existeix en aquesta ubicació. Prova un altre nom.`);
      } else {
        setPasteError(msg || 'Error en canviar el nom');
        if (moveConflict.mergeQueue) await advanceMergeQueue(true);
        else setMoveConflict(null);
      }
      return;
    }
    if (moveConflict.mergeQueue) await advanceMergeQueue(false);
    else { await reloadTree(); setMoveConflict(null); }
  };

  const handleClipboardPaste = async () => {
    if (!clipboard) return;
    setPasteError(null);
    try {
      if (clipboard.mode === 'cut') {
        // Guard: media canònica no es pot moure des de Files (usa «Crear referència»).
        // En Media sí es permet retallar i enganxar assets propis.
        if (page !== 'media') {
          const cutBatchHasCanonicalMedia = clipboard.itemIds.some(id => {
            const doc = state.documents.find(d => d.id === id);
            return !!(doc && (doc as any).media && !(doc as any).refTargetId);
          });
          if (cutBatchHasCanonicalMedia) {
            setPasteError('No es pot moure un asset de media canònica per clipboard. Usa «Crear referència» per vincular-lo.');
            setClipboard(null);
            return;
          }
        }
        dispatch({ type: 'MOVE_ITEMS', payload: { itemIds: clipboard.itemIds, destinationFolderId: state.currentFolderId } });
        if (useBackend) {
          try {
            for (const id of clipboard.itemIds) {
              const isFolder = state.folders.some(f => f.id === id);
              if (isFolder) await api.patchFolder(id, { parentId: state.currentFolderId });
              else await api.patchDocument(id, { parentId: state.currentFolderId });
            }
            await reloadTree();
          } catch (clipErr: any) {
            await reloadTree(); // reverteix l'update optimista
            const clipMsg: string = clipErr?.message || '';
            if (clipMsg.toLowerCase().includes('ja existeix')) {
              const firstConflictId = clipboard.itemIds.find(id => {
                const isF = state.folders.some(f => f.id === id);
                const itm = isF ? state.folders.find(f => f.id === id) : state.documents.find(d => d.id === id);
                return clipMsg.includes(`"${itm?.name}"`);
              }) ?? clipboard.itemIds[0];
              const isFolder = state.folders.some(f => f.id === firstConflictId);
              const itm = isFolder
                ? state.folders.find(f => f.id === firstConflictId)
                : state.documents.find(d => d.id === firstConflictId);
              const _cpName = itm?.name || '';
              setMoveConflict({
                ids: [firstConflictId],
                destinationFolderId: state.currentFolderId,
                conflictName: _cpName,
                isFolder,
                step: 'choose',
                renameValue: isFolder ? _cpName : splitFileNameExt(_cpName).base,
                renameExt: isFolder ? '' : splitFileNameExt(_cpName).ext,
              });
              setClipboard(null);
              return;
            } else {
              throw clipErr; // bubble a l'outer catch per mostrar error genèric
            }
          }
        }
      } else if (clipboard.mode === 'copy') {
        if (!useBackend) { setClipboard(null); return; }

        // Còpia d'un document (amb sufix " (còpia)" si topLevel = true)
        const copyDocItem = async (docId: string, destParentId: string | null, topLevel: boolean) => {
          const fullDoc = await api.getDocument(docId);
          if (fullDoc.media && !fullDoc.refTargetId) return; // salta media canònica
          const orig: string = fullDoc.name || '';
          const dot = orig.lastIndexOf('.');
          const copyName = topLevel
            ? (dot > 0
                ? orig.substring(0, dot).replace(/ \(còpia\)$/, '') + ' (còpia)' + orig.substring(dot)
                : orig.replace(/ \(còpia\)$/, '') + ' (còpia)')
            : orig;
          await api.createDocument({
            name: copyName,
            parentId: destParentId,
            sourceType: fullDoc.sourceType,
            contentByLang: fullDoc.contentByLang ?? {},
            csvContentByLang: fullDoc.csvContentByLang ?? {},
            sourceLang: fullDoc.sourceLang ?? null,
            media: fullDoc.media ?? null,
            refTargetId: fullDoc.refTargetId ?? null,
          });
        };

        // Còpia recursiva d'una carpeta
        const copyFolderRecursive = async (folderId: string, destParentId: string | null, topLevel: boolean) => {
          const src = state.folders.find(f => f.id === folderId);
          if (!src) return;
          const newName = topLevel ? src.name.replace(/ \(còpia\)$/, '') + ' (còpia)' : src.name;
          const newFolder = await api.createFolder(newName, destParentId);
          const childDocs = state.documents.filter(d => (d as any).parentId === folderId && !d.isDeleted);
          for (const doc of childDocs) await copyDocItem(doc.id, newFolder.id, false);
          const childFolders = state.folders.filter(f => f.parentId === folderId && !f.isDeleted);
          for (const cf of childFolders) await copyFolderRecursive(cf.id, newFolder.id, false);
        };

        for (const id of clipboard.itemIds) {
          if (state.folders.some(f => f.id === id)) {
            await copyFolderRecursive(id, state.currentFolderId, true);
          } else {
            await copyDocItem(id, state.currentFolderId, true);
          }
        }
        await reloadTree();
      }
    } catch (err: any) {
      const msg = err?.message || 'Error desconegut';
      setPasteError(`Error en enganxar: ${msg}`);
      return; // keep clipboard so user can retry
    }
    setClipboard(null);
  };

  const breadcrumbs = React.useMemo(() => {
    const rootName = page === 'projects' ? 'Projectes' : page === 'media' ? 'Media' : 'Files';
    if (view === 'trash') {
      return [{ id: 'trash', name: 'Paperera' }];
    }
    if (page === 'projects') {
      if (currentProjectFolderId === null) {
        return [{ id: null, name: 'Projectes' }];
      }
      // Construeix el camí des de currentProjectFolderId cap amunt fins a la carpeta de projecte arrel.
      // No segueix la jerarquia de Files per damunt d'ella.
      const path: { id: string | null; name: string }[] = [];
      let fid: string | null = currentProjectFolderId;
      while (fid !== null) {
        const folder = folders.find(f => f.id === fid);
        if (!folder) break;
        path.unshift({ id: folder.id, name: folder.name });
        if (projectFolderIds.has(folder.id)) break; // la carpeta de projecte és l'arrel: parem
        fid = folder.parentId;
      }
      return [{ id: null, name: 'Projectes' }, ...path];
    }
    const path: { id: string | null; name: string }[] = [];
    let current = page === 'media' ? currentMediaFolder : currentFolder;
    while (current) {
      path.unshift({ id: current.id, name: current.name });
      current = folders.find(f => f.id === current!.parentId) || null;
    }
    return [{ id: null, name: rootName }, ...path];
  }, [currentFolder, currentMediaFolder, currentProjectFolderId, folders, view, page, projectFolderIds]);

  const handleGoBack = () => {
    if (view === 'trash') {
      dispatch({ type: 'SET_VIEW', payload: 'library' });
    } else if (page === 'media' && currentMediaFolder) {
      dispatch({ type: 'SET_CURRENT_MEDIA_FOLDER', payload: currentMediaFolder.parentId });
    } else if (page === 'projects' && currentProjectFolderId !== null) {
      const folder = folders.find(f => f.id === currentProjectFolderId);
      if (!folder || projectFolderIds.has(folder.id)) {
        // Estem a la carpeta arrel del projecte → tornem a l'arrel de Projectes
        setCurrentProjectFolderId(null);
      } else {
        // Estem dins d'una subcarpeta → pugem al pare
        setCurrentProjectFolderId(folder.parentId);
        dispatch({ type: 'SET_CURRENT_FOLDER', payload: folder.parentId });
      }
    } else if (currentFolder) {
      dispatch({ type: 'SET_CURRENT_FOLDER', payload: currentFolder.parentId });
    }
  };
  const handleOpenRenameModal = React.useCallback((id: string) => {
    const itm = state.folders.find(f => f.id === id) || state.documents.find(d => d.id === id);
    if (!itm) return;
    dispatch({ type: 'CLEAR_SELECTION' });
    dispatch({ type: 'TOGGLE_SELECTION', payload: { id, isSelected: true } });
    if (itm.type === 'folder') {
      setRenameValue(itm.name);
      setRenameExt('');
    } else {
      const { base, ext } = splitFileNameExt(itm.name);
      setRenameValue(base);
      setRenameExt(ext);
    }
    setRenameModalOpen(true);
  }, [state.folders, state.documents, dispatch]);

  const handleRenameConfirm = () => {
  if (!selectedItem) return;
  if (!renameValue.trim()) return;
  const newName = renameValue.trim() + renameExt;

  if (!useBackend) {
    dispatch({
      type: 'RENAME_ITEM',
      payload: { id: selectedItem.id, type: selectedItem.type, newName },
    });
    setRenameModalOpen(false);
    return;
  }

  void (async () => {
    if (selectedItem.type === 'folder') {
      await api.patchFolder(selectedItem.id, { name: newName });
    } else {
      await api.patchDocument(selectedItem.id, { name: newName });
    }
    await reloadTree();
    setRenameModalOpen(false);
  })();
};
  const handleOpenFromModal = (docId: string, mode: OpenMode) => {
    const isEditing = true;
    onOpenDocument(docId, mode, isEditing);
    setOpenWithDocId(null);
  };

 const handlePreviewDocument = useCallback((docId: string) => {
  const doc = state.documents.find(d => d.id === docId);
  // Resolve ref to its target so media always loads correctly
  const effectiveDocId = doc?.refTargetId || docId;
  const effectiveDoc = state.documents.find(d => d.id === effectiveDocId) || doc;
  const isSrt = effectiveDoc && ((effectiveDoc.sourceType || '').toLowerCase() === 'srt' || effectiveDoc.name.toLowerCase().endsWith('.srt'));
  if (isSrt) {
    onOpenDocument(effectiveDocId, 'editor-srt-standalone' as any, false);
    return;
  }
  onOpenDocument(effectiveDocId, 'editor', false);
}, [onOpenDocument, state.documents]);

  const isAllSelected = itemsToRender.length > 0 && selectedIds.size === itemsToRender.length;
  const singleSelectedId = selectedIds.size === 1 ? Array.from(selectedIds)[0] : null;
const selectedItem =
  singleSelectedId
    ? (state.folders.find((f) => f.id === singleSelectedId) ||
       state.documents.find((d) => d.id === singleSelectedId) ||
       null)
    : null;
  const renderEmptyState = () => (
    <div className="text-center py-20 min-w-full flex flex-col items-center">
      <div className="mx-auto h-16 w-16 text-gray-600"><Icons.Folder className="w-16 h-16" /></div>
      <h3 className="mt-2 text-lg font-medium text-gray-400">
        {view === 'library' ? (currentFolder ? 'Aquesta carpeta és buida' : 'Files és buit') : 'La paperera és buida'}
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        {view === 'library' ? 'Crea una carpeta o importa un recurs.' : 'Els elements esborrats apareixeran aquí.'}
      </p>
    </div>
  );

  const gridColumns = view === 'trash'
    ? `32px ${nameColWidth}px ${formatColWidth}px ${dateColWidth}px 100px 40px`
    : `32px ${nameColWidth}px ${formatColWidth}px ${dateColWidth}px 40px`;
 const activeTasksCount =
  translationTasks.filter(t => t.status === 'processing').length +
  state.transcriptionTasks.filter(t => t.status === 'queued' || t.status === 'processing').length;
  return (
    <div className={`rounded-none shadow-sm h-full flex flex-col overflow-hidden relative ${isCollapsed ? 'p-1.5' : 'p-4 sm:p-6'}`} style={{ backgroundColor: 'var(--th-bg-primary)' }}>
      <style>{`
        .lib-nav-active { background-color: var(--th-accent) !important; }
        .lib-nav-inactive { background-color: var(--th-bg-tertiary); }
        .lib-nav-inactive:hover { background-color: var(--th-bg-hover); }
      `}</style>
      <div className="flex-1 flex flex-col min-h-0">
        <div className={`flex items-start mb-4 ${isCollapsed ? 'flex-col items-center gap-3' : 'sm:flex-row justify-between items-start sm:items-center gap-4'}`}>
        <div className={`flex items-center ${isCollapsed ? 'flex-col gap-3' : 'gap-2'}`}>
  <button
    onClick={goLibrary}
    className={`px-2.5 py-2 rounded-lg transition-colors flex items-center justify-center
      ${(view === 'library' && page === 'library') ? 'lib-nav-active' : 'lib-nav-inactive'}
      ${isCollapsed ? 'w-10 h-10 !p-0' : ''}`}
    style={{
      fontFamily: 'var(--us-home-navtabs-family)',
      fontSize:   'var(--us-home-navtabs-size)',
      color:      'var(--us-home-navtabs-color)',
      fontWeight: 'var(--us-home-navtabs-weight)' as any,
      fontStyle:  'var(--us-home-navtabs-style)',
    }}
    title="Files"
    aria-label="Files"
  >
    <Icons.Folder className="w-[1em] h-[1em]" />
  </button>

  <button
    onClick={goProjects}
    className={`px-2.5 py-2 rounded-lg transition-colors flex items-center justify-center
      ${(view === 'library' && page === 'projects') ? 'lib-nav-active' : 'lib-nav-inactive'}
      ${isCollapsed ? 'w-10 h-10 !p-0' : ''}`}
    style={{
      fontFamily: 'var(--us-home-navtabs-family)',
      fontSize:   'var(--us-home-navtabs-size)',
      color:      'var(--us-home-navtabs-color)',
      fontWeight: 'var(--us-home-navtabs-weight)' as any,
      fontStyle:  'var(--us-home-navtabs-style)',
    }}
    title="Projectes"
    aria-label="Projectes"
  >
    <Icons.Pin className="w-[1em] h-[1em]" />
  </button>

  <button
    onClick={goMedia}
    className={`px-2.5 py-2 rounded-lg transition-colors flex items-center justify-center
      ${(view === 'library' && page === 'media') ? 'lib-nav-active' : 'lib-nav-inactive'}
      ${isCollapsed ? 'w-10 h-10 !p-0' : ''}`}
    style={{
      fontFamily: 'var(--us-home-navtabs-family)',
      fontSize:   'var(--us-home-navtabs-size)',
      color:      'var(--us-home-navtabs-color)',
      fontWeight: 'var(--us-home-navtabs-weight)' as any,
      fontStyle:  'var(--us-home-navtabs-style)',
    }}
    title="Media"
    aria-label="Media"
  >
    <Icons.Film className="w-[1em] h-[1em]" />
  </button>

  <button
    onClick={goTrash}
    className={`px-2.5 py-2 rounded-lg transition-colors flex items-center justify-center
      ${view === 'trash' ? 'lib-nav-active' : 'lib-nav-inactive'}
      ${isCollapsed ? 'w-10 h-10 !p-0' : ''}`}
    style={{
      fontFamily: 'var(--us-home-navtabs-family)',
      fontSize:   'var(--us-home-navtabs-size)',
      color:      'var(--us-home-navtabs-color)',
      fontWeight: 'var(--us-home-navtabs-weight)' as any,
      fontStyle:  'var(--us-home-navtabs-style)',
    }}
    title="Paperera"
    aria-label="Paperera"
  >
    <Icons.Trash className="w-[1em] h-[1em]" />
  </button>
</div>

          <div className="flex items-center gap-2">
            {!isCollapsed && (
                <div className="h-10 flex items-center gap-2">
                    {selectedIds.size > 0 ? (
                        <>
                            {view === 'library' && selectedIds.size === 1 && selectedItem && (
                              <button
                                onClick={() => {
                                  if (selectedItem.type === 'folder') {
                                    setRenameValue(selectedItem.name);
                                    setRenameExt('');
                                  } else {
                                    const { base, ext } = splitFileNameExt(selectedItem.name);
                                    setRenameValue(base);
                                    setRenameExt(ext);
                                  }
                                  setRenameModalOpen(true);
                                }}
                                className="px-2.5 py-1.5 rounded-lg flex items-center justify-center hover:brightness-125"
                                style={{ backgroundColor: 'var(--th-bg-tertiary)', color: 'var(--th-text-secondary)' }}
                                title="Renombrar"
                                aria-label="Renombrar"
                              >
                                <Icons.Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {view === 'library' && (
                              <button
                                onClick={handleDeleteSelected}
                                className="px-2.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold leading-none"
                                style={{ fontFamily: 'var(--us-home-navtabs-family)', fontSize: 'var(--us-home-navtabs-size)', fontWeight: 'var(--us-home-navtabs-weight)' as any, fontStyle: 'var(--us-home-navtabs-style)' }}
                                title={`Eliminar (${selectedIds.size})`}
                                aria-label={`Eliminar ${selectedIds.size} elements`}
                              >Eliminar</button>
                            )}
                            {view === 'trash' && (
                                <>
                                    <button onClick={handleRestoreSelected} className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center" title={`Restaurar (${selectedIds.size})`} aria-label={`Restaurar ${selectedIds.size} elements`}>
                                        <Icons.Restore />
                                    </button>
                                    <button onClick={() => setShowPermanentDeleteConfirm(true)} className="px-3 py-1.5 bg-red-800 hover:bg-red-900 text-white rounded-lg text-sm font-semibold flex items-center gap-2" title="Esborrar permanentment">
                                        <Icons.Trash />
                                    </button>
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            {view === 'library' && (
                                 <>
                                    <button onClick={() => setCreateFolderModalOpen(true)} className="px-2.5 py-2 rounded-lg font-semibold flex items-center leading-none hover:brightness-125" style={{ backgroundColor: 'var(--th-bg-tertiary)', fontFamily: 'var(--us-home-navtabs-family)', fontSize: 'var(--us-home-navtabs-size)', color: 'var(--us-home-navtabs-color)', fontWeight: 'var(--us-home-navtabs-weight)' as any, fontStyle: 'var(--us-home-navtabs-style)' }} title="Crear carpeta"><Icons.FolderPlus className="w-[1em] h-[1em]" /></button>
                                    <button onClick={() => setImportModalOpen(true)} className="px-2.5 py-2 rounded-lg font-semibold flex items-center leading-none hover:brightness-125" style={{ backgroundColor: 'var(--th-bg-tertiary)', fontFamily: 'var(--us-home-navtabs-family)', fontSize: 'var(--us-home-navtabs-size)', color: 'var(--us-home-navtabs-color)', fontWeight: 'var(--us-home-navtabs-weight)' as any, fontStyle: 'var(--us-home-navtabs-style)' }} title="Importar fitxer"><Icons.Upload className="w-[1em] h-[1em]" /></button>
                                    <button
                                      onClick={() => setIsCreateProjectOpen(true)}
                                      className="px-2.5 py-2 rounded-lg font-semibold leading-none" style={{ backgroundColor: 'var(--th-btn-primary-bg)', color: 'var(--th-btn-primary-text)', fontFamily: 'var(--us-home-navtabs-family)', fontSize: 'var(--us-home-navtabs-size)', fontWeight: 'var(--us-home-navtabs-weight)' as any, fontStyle: 'var(--us-home-navtabs-style)' }}
                                      title="Crear projecte"
                                    >Crear projecte</button>
                                 </>
                            )}
                        </>
                    )}
                    {/* ⋯ sempre visible quan view === 'library' */}
                    {view === 'library' && (() => {
                      const canCopy = page === 'library' && selectedIds.size > 0 && !selectionHasCanonicalMedia;
                      // En Files: bloca media canònica. En Media: permet tallar qualsevol asset.
                      const canCut  = page === 'library'
                        ? selectedIds.size > 0 && !selectionHasCanonicalMedia
                        : page === 'media'
                          ? selectedIds.size > 0
                          : false;
                      const canPaste = !!(clipboard && clipboard.itemIds.length > 0);
                      const hasMenuItems = canCopy || canCut || canPaste;
                      return (
                        <div className="relative">
                          <button
                            onClick={() => { if (hasMenuItems) setToolbarMenuOpen(v => !v); }}
                            className={`px-2.5 py-1.5 rounded-lg text-sm font-bold flex items-center justify-center transition-opacity ${hasMenuItems ? 'hover:brightness-125' : 'opacity-30 cursor-default'}`}
                            style={{ backgroundColor: 'var(--th-bg-tertiary)', color: 'var(--th-text-secondary)' }}
                            title="Més accions"
                            aria-label="Més accions"
                          >⋯</button>
                          {toolbarMenuOpen && hasMenuItems && (
                            <>
                              <div className="fixed inset-0 z-[400]" onClick={() => setToolbarMenuOpen(false)} />
                              <div className="absolute right-0 top-full mt-1 z-[401] rounded-lg shadow-xl py-1 min-w-[180px]" style={{ backgroundColor: 'var(--th-bg-surface)', border: '1px solid var(--th-border)' }}>
                                {canPaste && (
                                  <button onClick={() => { handleClipboardPaste(); setToolbarMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:brightness-125" style={{ color: 'var(--th-text-secondary)' }}>
                                    <span>📌</span><span>Enganxar ({clipboard!.itemIds.length})</span>
                                  </button>
                                )}
                                {canCopy && (
                                  <button onClick={() => { handleClipboardCopy(Array.from(selectedIds)); setToolbarMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:brightness-125" style={{ color: 'var(--th-text-secondary)' }}>
                                    <span>📋</span><span>Copiar</span>
                                  </button>
                                )}
                                {canCut && (
                                  <button onClick={() => { handleClipboardCut(Array.from(selectedIds)); setToolbarMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:brightness-125" style={{ color: 'var(--th-text-secondary)' }}>
                                    <span>✂️</span><span>Retallar</span>
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                          {pasteError && (
                            <div className="absolute right-0 top-full mt-1 flex items-center gap-1.5 text-xs px-2 py-1 rounded-md z-[402]" style={{ backgroundColor: 'var(--th-bg-surface)', color: '#f87171', border: '1px solid #f87171', minWidth: '220px' }}>
                              <span>⚠</span>
                              <span className="flex-1">{pasteError}</span>
                              <button onClick={() => setPasteError(null)} className="ml-1 opacity-60 hover:opacity-100" aria-label="Tancar error">✕</button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                </div>
            )}
          </div>
        </div>
        
        {!isCollapsed && (
            <div
              className="flex items-center gap-2 px-4 py-2 mb-2 mx-2 min-h-10"
              style={{
                color: 'var(--us-home-breadcrumb-color)',
                borderBottom: '1px solid var(--th-border)',
                fontFamily: 'var(--us-home-breadcrumb-family)',
                fontSize:   'var(--us-home-breadcrumb-size)',
                fontWeight: 'var(--us-home-breadcrumb-weight)' as any,
                fontStyle:  'var(--us-home-breadcrumb-style)',
              }}
            >
                <button onClick={handleGoBack} disabled={view === 'trash' || (view === 'library' && (
                  page === 'media' ? !currentMediaFolder :
                  page === 'projects' ? currentProjectFolderId === null :
                  !currentFolder
                ))} className="p-1 rounded-full hover:bg-white/10 disabled:opacity-0 transition-opacity" title="Enrere"><Icons.ArrowLeft className="w-4 h-4" /></button>
                <div className="flex items-center gap-1 truncate">
                    {breadcrumbs.map((crumb, index) => (
                        <React.Fragment key={crumb.id ?? crumb.name}>
                            {index > 0 && <span className="mx-1">/</span>}
                            <button
                                onClick={() => {
                                    if (crumb.id === 'trash') return;
                                    if (page === 'media') {
                                      dispatch({ type: 'SET_CURRENT_MEDIA_FOLDER', payload: crumb.id });
                                    } else if (page === 'projects') {
                                      setCurrentProjectFolderId(crumb.id);
                                      if (crumb.id !== null) {
                                        dispatch({ type: 'SET_CURRENT_FOLDER', payload: crumb.id });
                                      }
                                    } else {
                                      dispatch({ type: 'SET_VIEW', payload: 'library' });
                                      dispatch({ type: 'SET_CURRENT_FOLDER', payload: crumb.id });
                                    }
                                }}
                                disabled={index === breadcrumbs.length - 1}
                                {...(view !== 'trash' && page !== 'projects' && index < breadcrumbs.length - 1 ? {
                                  'data-droptarget': 'true',
                                  'data-id': crumb.id ?? '__root__',
                                } : {})}
                                className={`px-2 py-1 rounded transition-colors ${index === breadcrumbs.length - 1 ? 'font-black bg-transparent cursor-default' : 'hover:bg-white/10'}`}
                            >
                                {crumb.name}
                            </button>
                        </React.Fragment>
                    ))}
                </div>
            </div>
        )}

        {!isCollapsed && (
          <div className="flex-1 overflow-auto custom-scrollbar">
            <div className="min-w-max inline-block align-middle pb-8 w-full">
              <header
                className="grid gap-0 items-center uppercase tracking-widest sticky top-0 z-30 py-2.5 mx-2"
                style={{
                  color: 'var(--us-home-tableheader-color)',
                  backgroundColor: 'var(--th-bg-secondary)',
                  borderBottom: '1px solid var(--th-border)',
                  gridTemplateColumns: gridColumns,
                  fontFamily: 'var(--us-home-tableheader-family)',
                  fontSize:   'var(--us-home-tableheader-size)',
                  fontWeight: 'var(--us-home-tableheader-weight)' as any,
                  fontStyle:  'var(--us-home-tableheader-style)',
                }}
              >
                <div onClick={handleSelectAll} className="cursor-pointer h-full flex items-center justify-center border-r border-[var(--th-border)]" aria-label="Seleccionar tot">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${isAllSelected ? '' : 'border-gray-600 hover:border-gray-500'}`} style={isAllSelected ? { backgroundColor: 'var(--th-accent)', borderColor: 'var(--th-accent)' } : undefined}>
                    {isAllSelected && <Icons.Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
                <div className="relative group/header flex items-center h-full border-r border-[var(--th-border)] overflow-hidden">
                  <div onClick={() => handleSortChange(SortByKey.Name)} className="flex-1 min-w-0 cursor-pointer px-4 h-full flex items-center hover:bg-white/5 transition-colors">
                    <span className="truncate">Nom</span>
                  </div>
                  <div onMouseDown={handleResizeNameMouseDown} onClick={(e) => e.stopPropagation()} className="absolute -right-0.5 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/20 group-hover/header:bg-white/10 transition-colors z-40" title="Canviar amplada">
                    <div className="h-full w-[1px] bg-white/10 group-hover/header:bg-white/20 mx-auto" />
                  </div>
                </div>
                <div className="relative group/header flex items-center h-full border-r border-[var(--th-border)] overflow-hidden">
                  <div onClick={() => handleSortChange(SortByKey.Format)} className="flex-1 min-w-0 cursor-pointer px-4 h-full flex items-center hover:bg-white/5 transition-colors">
                    <span className="truncate">Format</span>
                  </div>
                  <div onMouseDown={handleResizeFormatMouseDown} onClick={(e) => e.stopPropagation()} className="absolute -right-0.5 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/20 group-hover/header:bg-white/10 transition-colors z-40" title="Canviar amplada">
                    <div className="h-full w-[1px] bg-white/10 group-hover/header:bg-white/20 mx-auto" />
                  </div>
                </div>
                <div className="relative group/header flex items-center h-full border-r border-[var(--th-border)] overflow-hidden">
                  <div onClick={() => handleSortChange(SortByKey.Date)} className="flex-1 min-w-0 cursor-pointer px-4 h-full flex items-center hover:bg-white/5 transition-colors">
                    <span className="truncate">Data i hora</span>
                  </div>
                  <div onMouseDown={handleResizeDateMouseDown} onClick={(e) => e.stopPropagation()} className="absolute -right-0.5 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/20 group-hover/header:bg-white/10 transition-colors z-40" title="Canviar amplada">
                    <div className="h-full w-[1px] bg-white/10 group-hover/header:bg-white/20 mx-auto" />
                  </div>
                </div>
                {view === 'trash' && (
                  <div className="flex items-center h-full border-r border-[var(--th-border)] overflow-hidden">
                    <div className="flex-1 min-w-0 px-4 h-full flex items-center">
                      <span className="truncate">Procedència</span>
                    </div>
                  </div>
                )}
                <div className="h-full" />
              </header>

              <div className="divide-y divide-[var(--th-border)] mx-2">
                {itemsToRender.length > 0 ? (
                  itemsToRender.map((item) => (
                    <FileItem key={item.id} item={item} isSelected={selectedIds.has(item.id)} isDragging={isDragging} setIsDragging={setIsDragging} dropTargetId={dropTargetId} setDropTargetId={setDropTargetId} isProject={item.type === 'folder' && projectFolderIds.has(item.id)} onPreviewDocument={handlePreviewDocument} onDoubleClickOpen={(docId) => {
    const doc = state.documents.find(d => d.id === docId);
    // If this is a reference/shortcut, open the target document instead
    const effectiveDocId = doc?.refTargetId || docId;
    const effectiveDoc = state.documents.find(d => d.id === effectiveDocId) || doc;
    const isSrt = effectiveDoc && ((effectiveDoc.sourceType || '').toLowerCase() === 'srt' || effectiveDoc.name.toLowerCase().endsWith('.srt'));
    if (isSrt) {
      window.open(`${window.location.origin}${window.location.pathname}#/editor/editor-video-subs/${effectiveDocId}`, '_blank');
    } else {
      setOpenWithDocId(effectiveDocId);
    }
  }} gridColumns={gridColumns} onCopy={handleClipboardCopy} onCut={handleClipboardCut} isCut={clipboard?.mode === 'cut' && clipboard.itemIds.includes(item.id)}
                  isMediaFolder={item.type === 'folder' && (item as any).category === 'media'}
                  page={page}
                  provenance={view === 'trash' ? ((item.type === 'folder' ? (item as any).category === 'media' : !!(item as any).media && !(item as any).refTargetId) ? 'Media' : 'Files') : undefined}
                  onMoveItemsToBackend={handleMoveItemsToBackend}
                  onRename={view === 'library' ? handleOpenRenameModal : undefined}
                  onEnterFolder={(folderId) => {
                    if (page === 'media') {
                      dispatch({ type: 'SET_CURRENT_MEDIA_FOLDER', payload: folderId });
                    } else if (page === 'projects') {
                      setCurrentProjectFolderId(folderId);
                      dispatch({ type: 'SET_CURRENT_FOLDER', payload: folderId });
                    } else {
                      dispatch({ type: 'SET_CURRENT_FOLDER', payload: folderId });
                    }
                  }} />
                  ))
                ) : (
                  renderEmptyState()
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={`flex-shrink-0 mt-4 pt-4 space-y-3 ${!isCollapsed ? 'mx-2' : 'flex flex-col items-center'}`} style={!isCollapsed ? { borderTop: '1px solid var(--th-border)' } : undefined}>
        <button onClick={onOpenNotifications} className={`rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${isCollapsed ? 'w-10 h-10 justify-center p-0' : 'px-3 py-2 w-full'} text-gray-200 hover:brightness-125 relative`} style={{ backgroundColor: 'var(--th-bg-tertiary)' }} title="Notificacions">
          <Icons.Bell className={isCollapsed ? 'w-5 h-5' : 'w-5 h-5'} />
          <span className={isCollapsed ? 'hidden' : 'inline'}>Tasques IA</span>
          {activeTasksCount > 0 && <span className={`absolute -top-1 -right-1 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-2 ring-gray-900 ${isCollapsed ? 'scale-75' : ''}`} style={{ backgroundColor: 'var(--th-accent)' }}>{activeTasksCount}</span>}
        </button>
        <PujadesButton isCollapsed={isCollapsed} onOpen={onOpenPujades} />
        {isAdmin && (
          <button onClick={() => setIsAdminPanelOpen(true)} className={`rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${isCollapsed ? 'w-10 h-10 justify-center p-0' : 'px-3 py-2 w-full'} bg-amber-700/40 hover:bg-amber-700/60`} style={{ color: 'var(--th-text-primary)' }} title="Administració d'usuaris">
            <span className="text-base">👥</span>
            <span className={isCollapsed ? 'hidden' : 'inline'}>Administrador</span>
          </button>
        )}
        <button onClick={onOpenSettings} className={`rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${isCollapsed ? 'w-10 h-10 justify-center p-0' : 'px-3 py-2 w-full'} text-gray-200 hover:brightness-125`} style={{ backgroundColor: 'var(--th-bg-tertiary)' }} title="Configuració">
          <Icons.Settings className={isCollapsed ? 'w-5 h-5' : 'w-5 h-5'} />
          <span className={isCollapsed ? 'hidden' : 'inline'}>Configuració</span>
        </button>
      </div>
      
      {isAdminPanelOpen && <AdminPanel onClose={() => setIsAdminPanelOpen(false)} />}

      <ConfirmationModal 
        isOpen={showPermanentDeleteConfirm}
        onClose={() => setShowPermanentDeleteConfirm(false)}
        onConfirm={handlePermanentDeleteConfirmed}
        title="Eliminació permanent"
        message={`Estàs segur que vols eliminar permanentment ${selectedIds.size} element(s)? Aquesta acció és irreversible.`}
        confirmLabel="Eliminar definitivament"
      />

      {isCreateFolderModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[500]">
          <div className="rounded-xl p-4 w-full max-w-sm shadow-2xl" style={{ backgroundColor: 'var(--th-bg-surface)', border: '1px solid var(--th-border)' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-2">Nova carpeta</h2>
            <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()} className="w-full px-3 py-2 rounded text-gray-100 text-sm outline-none" style={{ backgroundColor: 'var(--th-bg-primary)', border: '1px solid var(--th-border)' }} placeholder="Nom de la carpeta" autoFocus />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setCreateFolderModalOpen(false)} className="px-4 py-1.5 text-sm rounded text-gray-200 font-medium hover:brightness-125" style={{ backgroundColor: 'var(--th-bg-tertiary)' }}>Cancel·lar</button>
              <button onClick={handleCreateFolder} className="px-4 py-1.5 text-sm rounded font-medium lib-nav-active text-white">Crear</button>
            </div>
          </div>
        </div>
      )}
      {isRenameModalOpen && (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[500]">
    <div className="rounded-xl p-4 w-full max-w-sm shadow-2xl" style={{ backgroundColor: 'var(--th-bg-surface)', border: '1px solid var(--th-border)' }} onClick={e => e.stopPropagation()}>
      <h2 className="text-lg font-semibold text-white mb-2">Renombrar</h2>
      <div className="flex items-center rounded overflow-hidden" style={{ border: '1px solid var(--th-border)' }}>
        <input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleRenameConfirm()}
          className="flex-1 px-3 py-2 text-gray-100 text-sm outline-none"
          style={{ backgroundColor: 'var(--th-bg-primary)' }}
          placeholder="Nou nom"
          autoFocus
        />
        {renameExt && (
          <span className="px-2 py-2 text-sm select-none flex-shrink-0" style={{ backgroundColor: 'var(--th-bg-tertiary)', color: 'var(--th-text-muted)', borderLeft: '1px solid var(--th-border)' }}>
            {renameExt}
          </span>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={() => setRenameModalOpen(false)} className="px-4 py-1.5 text-sm rounded text-gray-200 font-medium hover:brightness-125" style={{ backgroundColor: 'var(--th-bg-tertiary)' }}>Cancel·lar</button>
        <button onClick={handleRenameConfirm} className="px-4 py-1.5 text-sm rounded font-medium lib-nav-active text-white">Guardar</button>
      </div>
    </div>
  </div>
)}
{/* Modal de resolució de conflicte de moviment */}
{moveConflict && (
  <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[500] backdrop-blur-sm p-4">
    <div className="rounded-2xl p-6 w-full max-w-sm shadow-2xl" style={{ backgroundColor: 'var(--th-bg-surface)', border: '1px solid var(--th-border)' }} onClick={e => e.stopPropagation()}>
      <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center mb-4 mx-auto text-2xl flex-shrink-0">⚠️</div>

      {/* Progrés quan estem en mode fusionar */}
      {moveConflict.mergeQueue && (
        <p className="text-xs text-center mb-2" style={{ color: 'var(--th-text-muted)' }}>
          Element {moveConflict.mergeQueue.total - moveConflict.mergeQueue.remaining.length} de {moveConflict.mergeQueue.total} en conflicte
        </p>
      )}

      {moveConflict.step === 'choose' && (
        <>
          <h3 className="text-base font-bold text-white text-center mb-2">Nom ja existent</h3>
          <p className="text-sm text-center mb-5" style={{ color: 'var(--th-text-secondary)' }}>
            {moveConflict.isFolder ? 'Ja existeix una carpeta' : 'Ja existeix un fitxer'} amb el nom{' '}
            <span className="font-medium" style={{ color: 'var(--th-text-primary)' }}>"{moveConflict.conflictName}"</span>{' '}
            en aquesta ubicació.
          </p>
          <div className="flex flex-col gap-2">
            {/* Fusionar: només si és carpeta i NO estem ja en una cua de merge */}
            {moveConflict.isFolder && !moveConflict.mergeQueue && (
              <button onClick={handleMoveConflictMerge} className="w-full py-2 px-4 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: 'var(--th-accent)' }}>
                Fusionar carpetes
              </button>
            )}
            {/* Reemplazar: només per a fitxers */}
            {!moveConflict.isFolder && (
              <button onClick={handleMoveConflictReplace} className="w-full py-2 px-4 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700">
                Reemplazar
              </button>
            )}
            <button onClick={() => setMoveConflict(prev => prev ? { ...prev, step: 'rename' } : null)} className="w-full py-2 px-4 rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--th-bg-tertiary)', color: 'var(--th-text-primary)' }}>
              Canviar nom
            </button>
            {moveConflict.mergeQueue ? (
              <>
                <button onClick={() => advanceMergeQueue(true)} className="w-full py-2 px-4 rounded-lg text-sm font-medium" style={{ color: 'var(--th-text-muted)' }}>
                  Ometre aquest element
                </button>
                <button onClick={() => setMoveConflict(null)} className="w-full py-1 rounded text-xs" style={{ color: 'var(--th-text-muted)', opacity: 0.5 }}>
                  Avortar tota la fusió
                </button>
              </>
            ) : (
              <button onClick={() => setMoveConflict(null)} className="w-full py-2 px-4 rounded-lg text-sm font-medium" style={{ color: 'var(--th-text-muted)' }}>
                Cancel·lar
              </button>
            )}
          </div>
        </>
      )}

      {moveConflict.step === 'rename' && (
        <>
          <h3 className="text-base font-bold text-white text-center mb-2">Canviar nom</h3>
          <p className="text-sm text-center mb-4" style={{ color: 'var(--th-text-secondary)' }}>
            Introdueix un nom nou per a{' '}
            <span className="font-medium" style={{ color: 'var(--th-text-primary)' }}>"{moveConflict.conflictName}"</span>.
          </p>
          <div className="flex items-center rounded-lg overflow-hidden mb-3" style={{ border: '1px solid var(--th-border)' }}>
            <input
              autoFocus
              value={moveConflict.renameValue}
              onChange={e => setMoveConflict(prev => prev ? { ...prev, renameValue: e.target.value } : null)}
              onKeyDown={e => { if (e.key === 'Enter') handleMoveConflictRenameConfirm(); if (e.key === 'Escape') setMoveConflict(prev => prev ? { ...prev, step: 'choose' } : null); }}
              className="flex-1 px-3 py-2 text-sm outline-none"
              style={{ backgroundColor: 'var(--th-bg-tertiary)', color: 'var(--th-text-primary)' }}
              placeholder="Nou nom..."
            />
            {moveConflict.renameExt && (
              <span className="px-2 py-2 text-sm select-none flex-shrink-0" style={{ backgroundColor: 'var(--th-bg-primary)', color: 'var(--th-text-muted)', borderLeft: '1px solid var(--th-border)' }}>
                {moveConflict.renameExt}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={handleMoveConflictRenameConfirm}
              disabled={!moveConflict.renameValue.trim() || (moveConflict.renameValue.trim() + moveConflict.renameExt) === moveConflict.conflictName}
              className="w-full py-2 px-4 rounded-lg text-sm font-medium text-white disabled:opacity-40"
              style={{ backgroundColor: 'var(--th-accent)' }}
            >
              Confirmar
            </button>
            <button onClick={() => setMoveConflict(prev => prev ? { ...prev, step: 'choose' } : null)} className="w-full py-2 px-4 rounded-lg text-sm font-medium" style={{ color: 'var(--th-text-muted)' }}>
              Tornar
            </button>
          </div>
        </>
      )}
    </div>
  </div>
)}

{uploadBlockError && (
  <div className="fixed bottom-4 left-4 z-[600] px-4 py-3 rounded-xl shadow-xl flex items-center gap-2" style={{ backgroundColor: 'var(--th-bg-surface)', border: '1px solid #f87171', color: '#f87171' }}>
    <span>⚠</span>
    <span className="text-sm">{uploadBlockError}</span>
    <button onClick={() => setUploadBlockError(null)} className="ml-2 opacity-60 hover:opacity-100 text-xs" aria-label="Tancar">✕</button>
  </div>
)}
{deleteError && (
  <div className="fixed bottom-4 left-4 z-[600] px-4 py-3 rounded-xl shadow-xl flex items-center gap-2" style={{ backgroundColor: 'var(--th-bg-surface)', border: '1px solid #f87171', color: '#f87171' }}>
    <span>⚠</span>
    <span className="text-sm">{deleteError}</span>
    <button onClick={() => setDeleteError(null)} className="ml-2 opacity-60 hover:opacity-100 text-xs" aria-label="Tancar">✕</button>
  </div>
)}
<CreateProjectModal
  open={isCreateProjectOpen}
  onClose={() => {
    setIsCreateProjectOpen(false);
    // Refresca projectFolderIds: pot haver-se creat un projecte nou
    if (useBackend) {
      api.listProjects()
        .then(projects => setProjectFolderIds(new Set((projects || []).map((p: any) => p.folderId).filter(Boolean))))
        .catch(() => {});
    }
  }}
  onOpenDocument={onOpenDocument}
  parentFolderId={page === 'library' ? state.currentFolderId : null}
/>
      {openWithDocId && <OpenWithModal docId={openWithDocId} onClose={() => setOpenWithDocId(null)} onOpen={handleOpenFromModal} />}
      <SrtEditorModeModal
        isOpen={srtModeModalOpen}
        hasGuion={srtModeHasGuion}
        onSelect={(mode, remember) => {
          if (remember) localStorage.setItem(LOCAL_STORAGE_KEYS.SRT_EDITOR_MODE, mode);
          setSrtModeModalOpen(false);
          if (srtModeDocId) {
            const url = `${window.location.origin}${window.location.pathname}#/editor/${mode}/${srtModeDocId}`;
            window.open(url, '_blank');
          }
          setSrtModeDocId(null);
        }}
        onClose={() => { setSrtModeModalOpen(false); setSrtModeDocId(null); }}
      />
      {isImportModalOpen && <ImportFilesModal isOpen={isImportModalOpen} onClose={() => setImportModalOpen(false)} onFilesSelect={handleFilesUpload} accept=".pdf,.docx,.srt,.mp4,.mp3,.wav,.mov,.webm,.ogg" title="Importar Fitxers" description="Selecciona o arrossega guions (PDF, DOCX), subtítols (SRT) o vídeo/àudio." />}

      {duplicateNotice && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[500] backdrop-blur-sm p-6"
        >
          <div
            className="rounded-2xl p-6 w-full max-w-lg shadow-2xl"
            style={{ backgroundColor: 'var(--th-bg-surface)', border: '1px solid var(--th-border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto text-2xl flex-shrink-0" style={{ backgroundColor: 'var(--th-bg-tertiary)' }}>
              ⚠️
            </div>
            <h3 className="text-lg font-bold text-white text-center mb-3">
              {duplicateNotice.tentative ? 'Possible arxiu duplicat' : 'Arxiu ja existent'}
            </h3>

            {/* Filename: break-all only on the filename span, prose wraps naturally */}
            <p className="text-center text-sm mb-3" style={{ color: 'var(--th-text-secondary)' }}>
              <span className="font-semibold text-white" style={{ wordBreak: 'break-all' }}>{duplicateNotice.fileName}</span>
              {duplicateNotice.tentative
                ? <span> coincideix en nom i mida amb un arxiu ja existent a la biblioteca.</span>
                : <span> ja existeix a la biblioteca i no s&apos;ha tornat a importar.</span>
              }
            </p>

            {/* Location box */}
            <div className="rounded-lg px-4 py-3 mb-5 text-xs" style={{ backgroundColor: 'var(--th-bg-tertiary)', color: 'var(--th-text-secondary)', overflowWrap: 'anywhere' }}>
              <span style={{ color: 'var(--th-text-muted)' }}>Ubicació: </span>
              <span className="font-semibold text-white">{duplicateNotice.folderPath}</span>
              {duplicateNotice.existingName !== duplicateNotice.fileName && (
                <>
                  <br />
                  <span style={{ color: 'var(--th-text-muted)' }}>Nom guardat: </span>
                  <span className="font-semibold text-white">{duplicateNotice.existingName}</span>
                </>
              )}
            </div>

            {/* Buttons */}
            {duplicateNotice.tentative ? (
              <div className="flex flex-col gap-2">
                <div className="flex gap-3">
                  <button
                    onClick={() => { setDuplicateNotice(null); }}
                    className="flex-1 py-2.5 font-bold rounded-xl text-xs uppercase tracking-widest transition-all hover:brightness-125"
                    style={{ backgroundColor: 'var(--th-bg-tertiary)', color: 'var(--th-text-secondary)' }}
                  >
                    Tancar
                  </button>
                  <button
                    onClick={handleContinueUpload}
                    className="flex-1 py-2.5 text-white font-bold rounded-xl text-xs uppercase tracking-widest transition-all hover:brightness-125"
                    style={{ backgroundColor: 'var(--th-accent)' }}
                  >
                    Continuar i verificar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex gap-3">
                  <button
                    onClick={() => { setDuplicateNotice(null); }}
                    className="flex-1 py-2.5 font-bold rounded-xl text-xs uppercase tracking-widest transition-all hover:brightness-125"
                    style={{ backgroundColor: 'var(--th-bg-tertiary)', color: 'var(--th-text-secondary)', border: '1px solid var(--th-border)' }}
                  >
                    Cancel·lar
                  </button>
                  <button
                    onClick={handleCreateRef}
                    className="flex-1 py-2.5 font-bold rounded-xl text-xs uppercase tracking-widest transition-all hover:brightness-125"
                    style={{ backgroundColor: 'var(--th-accent)', color: 'white' }}
                  >
                    ↗ Crear accés directe
                  </button>
                </div>
                <button
                  onClick={() => { setDuplicateNotice(null); }}
                  className="w-full py-2.5 font-bold rounded-xl text-xs uppercase tracking-widest transition-all hover:brightness-125"
                  style={{ backgroundColor: 'var(--th-bg-tertiary)', color: 'var(--th-text-secondary)', border: '1px solid var(--th-border)' }}
                >
                  Usar asset existent
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};