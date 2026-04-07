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
import { useAuth } from '../../context/Auth/AuthContext';
import { AdminPanel } from '../Admin/AdminPanel';

type OpenMode = 'editor' | 'editor-video' | 'editor-video-subs' | 'editor-ssrtlsf' | 'editor-srt-standalone';

interface LibraryViewProps {
  onOpenDocument: (docId: string, mode: OpenMode, editingMode: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
  onOpenSettings: () => void;
  onOpenNotifications: () => void;
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

export const LibraryView: React.FC<LibraryViewProps> = ({
  onOpenDocument,
  isCollapsed,
  setIsCollapsed,
  onOpenSettings,
  onOpenNotifications,
}) => {
  const { state, dispatch, currentItems, currentFolder,useBackend, createFolderRemote, createDocumentRemote, uploadMediaRemote, reloadTree } = useLibrary();
  const { isAdmin } = useAuth();
 const { view, sortBy, sortOrder, selectedIds, folders, translationTasks, transcriptionTasks } = state;

  const [isCreateFolderModalOpen, setCreateFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [openWithDocId, setOpenWithDocId] = useState<string | null>(null);
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState(false);
  const [isRenameModalOpen, setRenameModalOpen] = useState(false);
const [renameValue, setRenameValue] = useState('');
const [page, setPage] = useState<'library'|'media'|'projects'>('library');

  const [projectFolderIds, setProjectFolderIds] = useState<Set<string>>(new Set());
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
const MEDIA_EXTS = ['mp4', 'mov', 'webm', 'wav', 'mp3', 'ogg', 'm4a'];
  const [nameColWidth, setNameColWidth] = useState(200);
  const [formatColWidth, setFormatColWidth] = useState(100);
  const [uploadProgress, setUploadProgress] = useState<{ name: string; pct: number } | null>(null);
  const [duplicateNotice, setDuplicateNotice] = useState<{ fileName: string; existingName: string; existingDocId: string; folderPath: string; file: File; targetParentId: string | null; tentative?: boolean } | null>(null);
  const [clipboard, setClipboard] = useState<{ itemIds: string[]; mode: 'copy' | 'cut' } | null>(null);
  const [pasteError, setPasteError] = useState<string | null>(null);
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
  setPage('library');
};

const goMedia = () => {
  dispatch({ type: 'SET_VIEW', payload: 'library' });
  dispatch({ type: 'SET_CURRENT_FOLDER', payload: null });
  setIsCollapsed(false);
  setPage('media');
};

const goProjects = () => {
  dispatch({ type: 'SET_VIEW', payload: 'library' });
  setIsCollapsed(false);
  setPage('projects');
};

const goTrash = () => {
  dispatch({ type: 'SET_VIEW', payload: 'trash' });
  setIsCollapsed(false);
  // page lo dejamos igual o lo puedes resetear si quieres:
  // setPage('library');
};

  // Fetch project folder IDs from the backend when the projects tab is active
  useEffect(() => {
    if (!useBackend || page !== 'projects') return;
    api.listProjects()
      .then((projects) => {
        setProjectFolderIds(new Set((projects || []).map((p: any) => p.folderId).filter(Boolean)));
      })
      .catch(() => {});
  }, [useBackend, page]);

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

  const handleSortChange = (key: SortByKey) => {
    const newOrder = sortBy === key && sortOrder === SortOrder.Asc ? SortOrder.Desc : SortOrder.Asc;
    dispatch({ type: 'SET_SORT', payload: { sortBy: key, sortOrder: newOrder } });
  };

 const handleCreateFolder = async () => {
  if (!newFolderName.trim()) return;

  if (useBackend) {
    await createFolderRemote(newFolderName.trim(), state.currentFolderId);
  } else {
    dispatch({ type: 'CREATE_FOLDER', payload: { name: newFolderName.trim(), parentId: state.currentFolderId } });
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
      setDuplicateNotice({ fileName: file.name, existingName: existingDoc.name, existingDocId: existingDoc.id || existingDoc._id, folderPath, file, targetParentId: null, tentative: true });
    } else {
      // No probable match — proceed with normal upload
      setUploadProgress({ name: file.name, pct: 0 });

      const uploadResult = await api.uploadMedia(file, (pct) => {
        setUploadProgress({ name: file.name, pct });
      }, null);

      setUploadProgress(null);

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
        setDuplicateNotice({ fileName: file.name, existingName: existingDoc.name, existingDocId: existingDoc.id || existingDoc._id, folderPath, file, targetParentId: null });
      } else {
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
      console.error(`Error important arxiu ${file.name}:`, error);
      setUploadBlockError(`Error important ${file.name}: ${(error as any)?.message || 'error desconegut'}`);
    }
  };

  const handleContinueUpload = async () => {
    if (!duplicateNotice) return;
    const { file, targetParentId } = duplicateNotice;
    const savedNotice = duplicateNotice; // snapshot for error recovery
    // Close modal — progress bar takes over during upload
    setDuplicateNotice(null);
    try {
      setUploadProgress({ name: file.name, pct: 0 });
      const uploadResult = await api.uploadMedia(file, (pct) => setUploadProgress({ name: file.name, pct }), targetParentId);
      setUploadProgress(null);
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
        setDuplicateNotice({ fileName: file.name, existingName: existingDoc.name, existingDocId: existingDoc.id || existingDoc._id, folderPath, file, targetParentId: null });
      } else {
        await reloadTree();
      }
    } catch (err) {
      setUploadProgress(null);
      console.error('Error en continue upload:', err);
      // Restore modal with error so user doesn't lose context silently
      setDuplicateNotice(savedNotice);
    }
  };

  const handleCreateRef = async () => {
    if (!duplicateNotice) return;
    const { existingDocId, targetParentId } = duplicateNotice;
    if (!existingDocId) return;
    try {
      await api.createMediaRef(existingDocId, targetParentId);
      setDuplicateNotice(null);
      await reloadTree();
    } catch (err) {
      console.error('Error creant accés directe:', err);
    }
  };

  const itemsToRender = page === 'media'
    ? state.documents.filter(
        (doc) => !doc.isDeleted && MEDIA_EXTS.includes((doc.sourceType || '').toLowerCase()) && !!(doc as any).media && !(doc as any).refTargetId
      )
    : currentItems.filter((item) => {
        if (view === 'trash') return true;
        // Media canònica pertany exclusivament a la pestanya Media: no ha d'aparèixer a library/projects.
        // Un LNK (refTargetId poblat, media null) no és media canònica i sí pertany a Arxius.
        // També s'exclouen documents amb sourceType de media sense camp media (documents legacy).
        if (item.type === 'document' && !(item as any).refTargetId && (
          !!(item as any).media || MEDIA_EXTS.includes((item.sourceType || '').toLowerCase())
        )) return false;
        if (page === 'library') return true;
        if (page === 'projects' && state.currentFolderId === null) {
          return item.type === 'folder' && projectFolderIds.has(item.id);
        }
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
  // Copiar: only accepts document IDs (folders not supported)
  const handleClipboardCopy = (ids: string[]) => {
    const docIds = ids.filter(id => state.documents.some(d => d.id === id));
    if (docIds.length === 0) return;
    setPasteError(null);
    setClipboard({ itemIds: docIds, mode: 'copy' });
  };
  const handleClipboardCut = (ids: string[]) => {
    setPasteError(null);
    setClipboard({ itemIds: ids, mode: 'cut' });
  };
  const handleClipboardPaste = async () => {
    if (!clipboard) return;
    setPasteError(null);
    try {
      if (clipboard.mode === 'cut') {
        // Guard atòmic: si el lot conté algun document de media canònica, s'avorta tot.
        // Un LNK (refTargetId poblat) no és media canònica i no queda blocat.
        // Les carpetes no poden ser media canònica, no cal comprovar-les.
        const cutBatchHasCanonicalMedia = clipboard.itemIds.some(id => {
          const doc = state.documents.find(d => d.id === id);
          return !!(doc && (doc as any).media && !(doc as any).refTargetId);
        });
        if (cutBatchHasCanonicalMedia) {
          setPasteError('No es pot moure un asset de media canònica per clipboard. Usa «Crear referència» per vincular-lo.');
          setClipboard(null);
          return;
        }
        dispatch({ type: 'MOVE_ITEMS', payload: { itemIds: clipboard.itemIds, destinationFolderId: state.currentFolderId } });
        if (useBackend) {
          for (const id of clipboard.itemIds) {
            const isFolder = state.folders.some(f => f.id === id);
            if (isFolder) await api.patchFolder(id, { parentId: state.currentFolderId });
            else await api.patchDocument(id, { parentId: state.currentFolderId });
          }
          await reloadTree();
        }
      } else if (clipboard.mode === 'copy') {
        // clipboard.itemIds guaranteed to contain only document IDs (filtered at source)
        if (!useBackend) { setClipboard(null); return; }
        // Prefetch de tot el lot ABANS de crear res.
        // Permet inspecció atòmica: si algun document és media canònica, s'avorta el lot sencer
        // sense haver creat cap còpia parcial.
        const fullDocs = await Promise.all(clipboard.itemIds.map(id => api.getDocument(id)));
        const batchHasCanonicalMedia = fullDocs.some(d => d.media && !d.refTargetId);
        if (batchHasCanonicalMedia) {
          setPasteError('No es pot copiar un asset de media canònica. Usa «Crear referència» per vincular-lo.');
          setClipboard(null);
          return;
        }
        // Tot el lot és net: procedir amb les còpies.
        for (const fullDoc of fullDocs) {
          const origName: string = fullDoc.name || '';
          const dotIdx = origName.lastIndexOf('.');
          const copyName = dotIdx > 0
            ? origName.substring(0, dotIdx).replace(/ \(còpia\)$/, '') + ' (còpia)' + origName.substring(dotIdx)
            : origName.replace(/ \(còpia\)$/, '') + ' (còpia)';
          await api.createDocument({
            name: copyName,
            parentId: state.currentFolderId,
            sourceType: fullDoc.sourceType,
            contentByLang: fullDoc.contentByLang ?? {},
            csvContentByLang: fullDoc.csvContentByLang ?? {},
            sourceLang: fullDoc.sourceLang ?? null,
            media: fullDoc.media ?? null,
            refTargetId: fullDoc.refTargetId ?? null,
          });
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
        return [{ id: null, name: rootName }, { id: 'trash', name: 'Paperera' }];
    }
    const path: { id: string | null; name: string }[] = [];
    let current = currentFolder;
    while (current) {
      path.unshift({ id: current.id, name: current.name });
      current = folders.find(f => f.id === current.parentId);
    }
    return [{ id: null, name: rootName }, ...path];
  }, [currentFolder, folders, view, page]);

  const handleGoBack = () => { 
    if (view === 'trash') {
        dispatch({ type: 'SET_VIEW', payload: 'library' });
    } else if (currentFolder) {
        dispatch({ type: 'SET_CURRENT_FOLDER', payload: currentFolder.parentId }); 
    }
  };
  const handleRenameConfirm = () => {
  if (!selectedItem) return;
  const newName = renameValue.trim();
  if (!newName) return;

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

  const gridColumns = `32px ${nameColWidth}px ${formatColWidth}px 140px 40px`;
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
    <Icons.Folder className="w-4 h-4" />
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
    <span>📌</span>
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
    <span>🎞️</span>
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
    <Icons.Trash className="w-4 h-4" />
  </button>
</div>

          <div className="flex items-center gap-2">
            {!isCollapsed && (
                <div className="h-10 flex items-center gap-2">
                    {selectedIds.size > 0 ? (
                        <>  {view === 'library' && selectedIds.size === 1 && selectedItem && (
  <button
    onClick={() => {
      setRenameValue(selectedItem.name);
      setRenameModalOpen(true);
    }}
    className="px-2.5 py-1.5 hover:brightness-125 text-white rounded-lg text-sm font-semibold flex items-center justify-center"
    style={{ backgroundColor: 'var(--th-bg-tertiary)' }}
    title="Renombrar"
    aria-label="Renombrar"
  >
    <Icons.Pencil />
  </button>
)}
                            {view === 'library' && (
                                <button onClick={handleDeleteSelected} className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center" title={`Esborrar (${selectedIds.size})`} aria-label={`Esborrar ${selectedIds.size} elements`}>
                                    <Icons.Trash />
                                </button>
                            )}
                            {view === 'library' && (
                              <div className="relative">
                                <button
                                  onClick={() => setToolbarMenuOpen(v => !v)}
                                  className="px-2.5 py-1.5 hover:brightness-125 text-white rounded-lg text-sm font-bold flex items-center justify-center"
                                  style={{ backgroundColor: 'var(--th-bg-tertiary)' }}
                                  title="Més accions"
                                  aria-label="Més accions"
                                >⋯</button>
                                {toolbarMenuOpen && (
                                  <>
                                    <div className="fixed inset-0 z-[400]" onClick={() => setToolbarMenuOpen(false)} />
                                    <div className="absolute right-0 top-full mt-1 z-[401] rounded-lg shadow-xl py-1 min-w-[140px]" style={{ backgroundColor: 'var(--th-bg-surface)', border: '1px solid var(--th-border)' }}>
                                      {selectedIds.size > 0 && !selectionHasCanonicalMedia && Array.from(selectedIds).every(id => state.documents.some(d => d.id === id)) && (
                                        <button onClick={() => { handleClipboardCopy(Array.from(selectedIds)); setToolbarMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:brightness-125" style={{ color: 'var(--th-text-secondary)' }}>
                                          <span>📋</span><span>Copiar</span></button>
                                      )}
                                      {!selectionHasCanonicalMedia && (
                                        <button onClick={() => { handleClipboardCut(Array.from(selectedIds)); setToolbarMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:brightness-125" style={{ color: 'var(--th-text-secondary)' }}>
                                          <span>✂️</span><span>Retallar</span></button>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
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
                            {view === 'library' && clipboard && clipboard.itemIds.length > 0 && (
                              <div className="flex flex-col items-end gap-1">
                                <button onClick={handleClipboardPaste} className="px-2.5 py-1.5 hover:brightness-125 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5" style={{ backgroundColor: 'var(--th-accent)' }} title={`Enganxar ${clipboard.itemIds.length} element(s) aquí (${clipboard.mode === 'cut' ? 'moure' : 'copiar'})`} aria-label="Enganxar">
                                  📌 <span className="text-xs">Enganxar ({clipboard.itemIds.length})</span>
                                </button>
                                {pasteError && (
                                  <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md" style={{ backgroundColor: 'var(--th-bg-surface)', color: '#f87171', border: '1px solid #f87171' }}>
                                    <span>⚠</span>
                                    <span>{pasteError}</span>
                                    <button onClick={() => setPasteError(null)} className="ml-1 opacity-60 hover:opacity-100" aria-label="Tancar error">✕</button>
                                  </div>
                                )}
                              </div>
                            )}
                            {view === 'library' && (
                                 <>
                                    <button onClick={() => setCreateFolderModalOpen(true)} className="px-3 py-2 text-gray-200 rounded-lg text-sm font-semibold flex items-center gap-2 hover:brightness-125" style={{ backgroundColor: 'var(--th-bg-tertiary)' }} title="Crear carpeta"><Icons.FolderPlus /></button>
                                    <button onClick={() => setImportModalOpen(true)} className="px-3 py-2 text-gray-200 rounded-lg text-sm font-semibold flex items-center gap-2 hover:brightness-125" style={{ backgroundColor: 'var(--th-bg-tertiary)' }} title="Importar fitxer"><Icons.Upload /></button>
                                    <button
    onClick={() => setIsCreateProjectOpen(true)}
    className="px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: 'var(--th-btn-primary-bg)', color: 'var(--th-btn-primary-text)' }}
    title="Crear projecte"
  >
    Crear projecte
  </button>
                                 </>
                            )}
                        </>
                    )}
                </div>
            )}
          </div>
        </div>
        
        {!isCollapsed && (
            <div
              className="flex items-center gap-2 px-4 py-2 mb-2 mx-2 min-h-10"
              style={{
                color: 'var(--th-text-secondary)',
                borderBottom: '1px solid var(--th-border)',
                fontFamily: 'var(--us-home-breadcrumb-family)',
                fontSize:   'var(--us-home-breadcrumb-size)',
                fontWeight: 'var(--us-home-breadcrumb-weight)' as any,
                fontStyle:  'var(--us-home-breadcrumb-style)',
              }}
            >
                <button onClick={handleGoBack} disabled={view === 'library' && !currentFolder} className="p-1 rounded-full hover:bg-white/10 disabled:opacity-0 transition-opacity" title="Enrere"><Icons.ArrowLeft className="w-4 h-4" /></button>
                <div className="flex items-center gap-1 truncate">
                    {breadcrumbs.map((crumb, index) => (
                        <React.Fragment key={crumb.id ?? crumb.name}>
                            {index > 0 && <span className="text-gray-500 mx-1">/</span>}
                            <button 
                                onClick={() => {
                                    if (crumb.id === 'trash') return;
                                    dispatch({ type: 'SET_VIEW', payload: 'library' });
                                    dispatch({ type: 'SET_CURRENT_FOLDER', payload: crumb.id });
                                }} 
                                disabled={index === breadcrumbs.length - 1} 
                                className={`px-2 py-1 rounded transition-colors ${index === breadcrumbs.length - 1 ? 'font-black text-gray-200 bg-transparent cursor-default' : 'hover:bg-white/10 text-gray-400'}`}
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
                  color: 'var(--th-text-muted)',
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
                <div className="relative group/header flex items-center h-full border-r border-[var(--th-border)]">
                  <div onClick={() => handleSortChange(SortByKey.Name)} className="flex-1 cursor-pointer px-4 h-full flex items-center hover:bg-white/5 transition-colors">
                    <span>Nom</span>
                  </div>
                  <div onMouseDown={handleResizeNameMouseDown} onClick={(e) => e.stopPropagation()} className="absolute -right-0.5 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/20 group-hover/header:bg-white/10 transition-colors z-40" title="Canviar amplada">
                    <div className="h-full w-[1px] bg-white/10 group-hover/header:bg-white/20 mx-auto" />
                  </div>
                </div>
                <div className="relative group/header flex items-center h-full border-r border-[var(--th-border)]">
                  <div onClick={() => handleSortChange(SortByKey.Format)} className="flex-1 cursor-pointer px-4 h-full flex items-center hover:bg-white/5 transition-colors">
                    <span>Format</span>
                  </div>
                  <div onMouseDown={handleResizeFormatMouseDown} onClick={(e) => e.stopPropagation()} className="absolute -right-0.5 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/20 group-hover/header:bg-white/10 transition-colors z-40" title="Canviar amplada">
                    <div className="h-full w-[1px] bg-white/10 group-hover/header:bg-white/20 mx-auto" />
                  </div>
                </div>
                <div onClick={() => handleSortChange(SortByKey.Date)} className="cursor-pointer whitespace-nowrap px-4 h-full flex items-center hover:bg-white/5 transition-colors border-r border-[var(--th-border)]">
                  <span>Data i hora</span>
                </div>
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
      // Comprova si hi ha preferència guardada
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.SRT_EDITOR_MODE);
      if (saved === 'editor-video-subs' || saved === 'editor-srt-standalone') {
        window.open(`${window.location.origin}${window.location.pathname}#/editor/${saved}/${effectiveDocId}`, '_blank');
      } else {
        // Mostrar modal de selecció; consultar si el projecte té guió
        setSrtModeDocId(effectiveDocId);
        setSrtModeHasGuion(false); // default; actualitzem async
        setSrtModeModalOpen(true);
        api.getProjectBySrt(effectiveDocId)
          .then(p => setSrtModeHasGuion(Boolean(p?.guionDocumentId)))
          .catch(() => {});
      }
    } else {
      setOpenWithDocId(effectiveDocId);
    }
  }} gridColumns={gridColumns} onCopy={handleClipboardCopy} onCut={handleClipboardCut} isCut={clipboard?.mode === 'cut' && clipboard.itemIds.includes(item.id)} />
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
      <input
        value={renameValue}
        onChange={(e) => setRenameValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleRenameConfirm()}
        className="w-full px-3 py-2 rounded text-gray-100 text-sm outline-none"
        style={{ backgroundColor: 'var(--th-bg-primary)', border: '1px solid var(--th-border)' }}
        placeholder="Nou nom"
        autoFocus
      />
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={() => setRenameModalOpen(false)} className="px-4 py-1.5 text-sm rounded text-gray-200 font-medium hover:brightness-125" style={{ backgroundColor: 'var(--th-bg-tertiary)' }}>Cancel·lar</button>
        <button onClick={handleRenameConfirm} className="px-4 py-1.5 text-sm rounded font-medium lib-nav-active text-white">Guardar</button>
      </div>
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
{uploadProgress && (
  <div className="fixed bottom-4 left-4 z-[600] text-gray-100 px-4 py-3 rounded-xl shadow-xl" style={{ backgroundColor: 'var(--th-bg-surface)', border: '1px solid var(--th-border)' }}>
    <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--th-text-muted)' }}>Upload</div>
    <div className="text-sm font-semibold truncate max-w-[320px]">{uploadProgress.name}</div>
    <div className="mt-2 h-2 w-80 rounded overflow-hidden" style={{ backgroundColor: 'var(--th-bg-tertiary)' }}>
      <div className="h-2" style={{ width: `${uploadProgress.pct}%`, backgroundColor: 'var(--th-accent)' }} />
    </div>
    <div className="mt-1 text-xs text-gray-300">{uploadProgress.pct}%</div>
  </div>
)}
<CreateProjectModal
  open={isCreateProjectOpen}
  onClose={() => setIsCreateProjectOpen(false)}
  onOpenDocument={onOpenDocument}
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
      {isImportModalOpen && <ImportFilesModal isOpen={isImportModalOpen} onClose={() => setImportModalOpen(false)} onFilesSelect={handleFilesUpload} accept=".pdf,.docx,.srt,.mp4,.wav,.mov,.webm,.ogg" title="Importar Fitxers" description="Selecciona o arrossega guions (PDF, DOCX), subtítols (SRT) o vídeo/àudio." />}

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