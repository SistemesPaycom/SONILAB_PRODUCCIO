// components/Library/LibraryView.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useLibrary } from '../../context/Library/LibraryContext';
import { ViewType, SortByKey, SortOrder, LibraryItem, EditorStyles, TranslationTask, TranscriptionTask } from '../../types';
import { importPdfFile } from '../../utils/Import/pdfImporter';
import { importDocxFile } from '../../utils/Import/docxImporter';
import { ImportOptions } from '../../utils/Import/importShared';
import { parseScript } from '../../utils/EditorDeGuions/scriptParser';
import { scriptToCsv } from '../../utils/EditorDeGuions/csvConverter';
import { FileItem } from './FileItem';
import * as Icons from '../icons';
import OpenWithModal from './OpenWithModal';
import ImportFilesModal from '../Import/ImportFilesModal';
import { api } from '@/services/api';
import { CreateProjectModal } from '../Projects/CreateProjectModal';

type OpenMode = 'editor' | 'lector' | 'editor-video' | 'editor-video-subs';

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
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
          <Icons.Trash className="w-6 h-6 text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-white text-center mb-2">{title}</h3>
        <p className="text-gray-400 text-center text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-200 font-bold rounded-xl text-xs uppercase tracking-widest transition-all">Cancel·lar</button>
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
const MEDIA_EXTS = ['mp4', 'mov', 'webm', 'wav', 'mp3', 'ogg', 'm4a'];
  const [nameColWidth, setNameColWidth] = useState(200);
  const [formatColWidth, setFormatColWidth] = useState(100);
  const [uploadProgress, setUploadProgress] = useState<{ name: string; pct: number } | null>(null);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);

  const goLibrary = () => {
  dispatch({ type: 'SET_VIEW', payload: 'library' });
  setIsCollapsed(false);
  setPage('library');
};

const goMedia = () => {
  dispatch({ type: 'SET_VIEW', payload: 'library' });
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

      if (ext === 'pdf') {
        content = await importPdfFile(file, DEFAULT_IMPORT_OPTIONS);
        sourceType = 'slsf';
      } else if (ext === 'docx') {
        content = await importDocxFile(file, DEFAULT_IMPORT_OPTIONS);
        sourceType = 'slsf';
      } else if (ext === 'srt') {
        content = await file.text();
        sourceType = 'srt';
      } else if (['mp4', 'wav', 'mov', 'webm', 'ogg', 'mp3'].includes(ext || '')) {
        content = '';
        sourceType = ext || 'video';
      } else return;

      if (ext === 'pdf' || ext === 'docx') {
        const { takes } = parseScript(content);
        csvContent = scriptToCsv(takes);
      }
      
      const finalName = (ext === 'pdf' || ext === 'docx') ? `${baseName}.slsf` : originalName;
      
     if (useBackend) {
  if (['mp4', 'wav', 'mov', 'webm', 'ogg', 'mp3', 'm4a'].includes(ext || '')) {
    setUploadProgress({ name: file.name, pct: 0 });

await api.uploadMedia(file, (pct) => {
  setUploadProgress({ name: file.name, pct });
});

await reloadTree(); // o tu flujo actual

setUploadProgress(null);
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
    } catch (error) { console.error(`Error important arxiu ${file.name}:`, error); }
  };

  const handleSelectAll = () => {
    dispatch({ type: 'TOGGLE_SELECT_ALL', payload: { itemIds: currentItems.map((item) => item.id) } });
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
    dispatch({ type: 'DELETE_ITEMS', payload: { itemIds: ids } });
    return;
  }

  void (async () => {
    const folderIds = ids.filter((id) => state.folders.some((f) => f.id === id));
    const docIds = ids.filter((id) => state.documents.some((d) => d.id === id));

    await Promise.all([
      ...folderIds.map((id) => api.deleteFolder(id)),
      ...docIds.map((id) => api.deleteDocument(id)),
    ]);

    await reloadTree();
  })();
};
  const handleRestoreSelected = () => {
  const ids = Array.from(state.selectedIds).map((v) => String(v));

  if (!useBackend) {
    dispatch({ type: 'RESTORE_ITEMS', payload: { itemIds: ids } });
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

  if (!useBackend) {
    dispatch({ type: 'PERMANENTLY_DELETE_ITEMS', payload: { itemIds: ids } });
    return;
  }

  void (async () => {
    const folderIds = ids.filter((id) => state.folders.some((f) => f.id === id));
    const docIds = ids.filter((id) => state.documents.some((d) => d.id === id));

    await Promise.all([
      ...folderIds.map((id) => api.purgeFolder(id)),
      ...docIds.map((id) => api.purgeDocument(id)),
    ]);

    await reloadTree();
  })();
};
  const breadcrumbs = React.useMemo(() => {
    if (view === 'trash') {
        return [{ id: null, name: 'Llibreria' }, { id: 'trash', name: 'Paperera' }];
    }
    const path: { id: string | null; name: string }[] = [];
    let current = currentFolder;
    while (current) {
      path.unshift({ id: current.id, name: current.name });
      current = folders.find(f => f.id === current.parentId);
    }
    return [{ id: null, name: 'Llibreria' }, ...path];
  }, [currentFolder, folders, view]);

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
    const isEditing = mode !== 'lector';
    onOpenDocument(docId, mode, isEditing);
    setOpenWithDocId(null);
  };

 const handlePreviewDocument = useCallback((docId: string) => {
  const doc = state.documents.find(d => d.id === docId);
  const isSrt = doc && ((doc.sourceType || '').toLowerCase() === 'srt' || doc.name.toLowerCase().endsWith('.srt'));
  if (isSrt) {
    onOpenDocument(docId, 'editor-srt-standalone' as any, true);
    return;
  }
  onOpenDocument(docId, 'editor', false);
}, [onOpenDocument, state.documents]);

  const isAllSelected = currentItems.length > 0 && selectedIds.size === currentItems.length;
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
        {view === 'library' ? (currentFolder ? 'Aquesta carpeta és buida' : 'La llibreria és buida') : 'La paperera és buida'}
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
const itemsToRender = currentItems.filter((item) => {
  // Si estás en Trash, no filtramos por página (o podrías filtrar también si quieres)
  if (view === 'trash') return true;

  if (page === 'library') return true;

  if (page === 'media') {
    return (
      item.type === 'document' &&
      MEDIA_EXTS.includes(((item as any).sourceType || '').toLowerCase())
    );
  }

  if (page === 'projects') {
    const st = ((item as any).sourceType || '').toLowerCase();
    return item.type === 'document' && (st === 'srt' || item.name.toLowerCase().endsWith('.srt'));
  }

  return true;
});
  return (
    <div className={`bg-[#111827] rounded-none shadow-sm h-full flex flex-col overflow-hidden relative ${isCollapsed ? 'p-1.5' : 'p-4 sm:p-6'}`}>
      <div className="flex-1 flex flex-col min-h-0">
        <div className={`flex items-start mb-4 ${isCollapsed ? 'flex-col items-center gap-3' : 'sm:flex-row justify-between items-start sm:items-center gap-4'}`}>
        <div className={`flex items-center ${isCollapsed ? 'flex-col gap-3' : 'gap-2'}`}>
  <button
    onClick={goLibrary}
    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2
      ${(view === 'library' && page === 'library') ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}
      ${isCollapsed ? 'w-10 h-10 justify-center !p-0' : ''}`}
    title="Llibreria"
  >
    <Icons.Library className={isCollapsed ? 'w-5 h-5' : 'w-4 h-4'} />
    <span className={isCollapsed ? 'hidden' : 'inline'}>Llibreria</span>
  </button>

  <button
    onClick={goMedia}
    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2
      ${(view === 'library' && page === 'media') ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}
      ${isCollapsed ? 'w-10 h-10 justify-center !p-0' : ''}`}
    title="Media"
  >
    <span className={isCollapsed ? '' : ''}>🎞️</span>
    <span className={isCollapsed ? 'hidden' : 'inline'}>Media</span>
  </button>

  <button
    onClick={goProjects}
    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2
      ${(view === 'library' && page === 'projects') ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}
      ${isCollapsed ? 'w-10 h-10 justify-center !p-0' : ''}`}
    title="Proyectos"
  >
    <span>📌</span>
    <span className={isCollapsed ? 'hidden' : 'inline'}>Proyectos</span>
  </button>

  <button
    onClick={goTrash}
    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2
      ${view === 'trash' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}
      ${isCollapsed ? 'w-10 h-10 justify-center !p-0' : ''}`}
    title="Paperera"
  >
    <Icons.Trash className={isCollapsed ? 'w-5 h-5' : 'w-4 h-4'} />
    <span className={isCollapsed ? 'hidden' : 'inline'}>Paperera</span>
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
    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
    title="Renombrar"
  >
    <Icons.Pencil />
    <span>Renombrar</span>
  </button>
)}
                            {view === 'library' && (
                                <button onClick={handleDeleteSelected} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2" title="Enviar a la paperera">
                                    <Icons.Trash /><span>{`Esborrar (${selectedIds.size})`}</span>
                                </button>
                            )}
                            {view === 'trash' && (
                                <>
                                    <button onClick={handleRestoreSelected} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2" title="Restaurar">
                                        <Icons.Restore /><span>{`Restaurar (${selectedIds.size})`}</span>
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
                                    <button onClick={() => setCreateFolderModalOpen(true)} className="px-3 py-2 bg-gray-700 text-gray-200 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-gray-600" title="Crear carpeta"><Icons.FolderPlus /></button>
                                    <button onClick={() => setImportModalOpen(true)} className="px-3 py-2 bg-gray-700 text-gray-200 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-gray-600" title="Importar fitxer"><Icons.Upload /></button>
                                    <button
    onClick={() => setIsCreateProjectOpen(true)}
    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold"
    title="Crear proyecto"
  >
    Crear proyecto
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
            <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 border-b border-gray-800/50 mb-2 mx-2 h-10">
                <button onClick={handleGoBack} disabled={view === 'library' && !currentFolder} className="p-1 rounded-full hover:bg-gray-700 disabled:opacity-0 transition-opacity" title="Enrere"><Icons.ArrowLeft className="w-4 h-4" /></button>
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
                                className={`px-2 py-1 rounded transition-colors ${index === breadcrumbs.length - 1 ? 'font-black text-gray-200 bg-transparent cursor-default' : 'hover:bg-gray-700 text-gray-400'}`}
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
                className="grid gap-0 items-center text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-gray-800/50 sticky top-0 bg-[#111827] z-30 py-2.5 mx-2"
                style={{ gridTemplateColumns: gridColumns }}
              >
                <div onClick={handleSelectAll} className="cursor-pointer h-full flex items-center justify-center border-r border-gray-800/30" aria-label="Seleccionar tot">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${isAllSelected ? 'bg-blue-600 border-blue-500' : 'border-gray-600 hover:border-gray-500'}`}>
                    {isAllSelected && <Icons.Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
                <div className="relative group/header flex items-center h-full border-r border-gray-800/30">
                  <div onClick={() => handleSortChange(SortByKey.Name)} className="flex-1 cursor-pointer px-4 h-full flex items-center hover:bg-gray-800/50 transition-colors">
                    <span>Nom</span>
                  </div>
                  <div onMouseDown={handleResizeNameMouseDown} onClick={(e) => e.stopPropagation()} className="absolute -right-0.5 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 group-hover/header:bg-gray-600 transition-colors z-40" title="Canviar amplada">
                    <div className="h-full w-[1px] bg-gray-700/50 group-hover/header:bg-blue-400 mx-auto" />
                  </div>
                </div>
                <div className="relative group/header flex items-center h-full border-r border-gray-800/30">
                  <div onClick={() => handleSortChange(SortByKey.Format)} className="flex-1 cursor-pointer px-4 h-full flex items-center hover:bg-gray-800/50 transition-colors">
                    <span>Format</span>
                  </div>
                  <div onMouseDown={handleResizeFormatMouseDown} onClick={(e) => e.stopPropagation()} className="absolute -right-0.5 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 group-hover/header:bg-gray-600 transition-colors z-40" title="Canviar amplada">
                    <div className="h-full w-[1px] bg-gray-700/50 group-hover/header:bg-blue-400 mx-auto" />
                  </div>
                </div>
                <div onClick={() => handleSortChange(SortByKey.Date)} className="cursor-pointer whitespace-nowrap px-4 h-full flex items-center hover:bg-gray-800/50 transition-colors border-r border-gray-800/30">
                  <span>Data i hora</span>
                </div>
                <div className="h-full" />
              </header>

              <div className="divide-y divide-gray-800/30 mx-2">
                {itemsToRender.length > 0 ? (
                  itemsToRender.map((item) => (
                    <FileItem key={item.id} item={item} isSelected={selectedIds.has(item.id)} isDragging={isDragging} setIsDragging={setIsDragging} dropTargetId={dropTargetId} setDropTargetId={setDropTargetId} onPreviewDocument={handlePreviewDocument} onDoubleClickOpen={(docId) => {
    const doc = state.documents.find(d => d.id === docId);
    const isSrt = doc && ((doc.sourceType || '').toLowerCase() === 'srt' || doc.name.toLowerCase().endsWith('.srt'));
    if (isSrt) onOpenDocument(docId, 'editor-srt-standalone' as any, true);
    else setOpenWithDocId(docId);
  }} gridColumns={gridColumns} />
                  ))
                ) : (
                  renderEmptyState()
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={`flex-shrink-0 mt-4 pt-4 space-y-3 ${!isCollapsed ? 'border-t border-gray-800/50 mx-2' : 'flex flex-col items-center'}`}>
        <button onClick={onOpenNotifications} className={`rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${isCollapsed ? 'w-10 h-10 justify-center p-0' : 'px-3 py-2 w-full'} bg-gray-700 text-gray-200 hover:bg-gray-600 relative`} title="Notificacions">
          <Icons.Bell className={isCollapsed ? 'w-5 h-5' : 'w-5 h-5'} />
          <span className={isCollapsed ? 'hidden' : 'inline'}>Tasques IA</span>
          {activeTasksCount > 0 && <span className={`absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-2 ring-gray-900 ${isCollapsed ? 'scale-75' : ''}`}>{activeTasksCount}</span>}
        </button>
        <button onClick={onOpenSettings} className={`rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${isCollapsed ? 'w-10 h-10 justify-center p-0' : 'px-3 py-2 w-full'} bg-gray-700 text-gray-200 hover:bg-gray-600`} title="Configuració">
          <Icons.Settings className={isCollapsed ? 'w-5 h-5' : 'w-5 h-5'} />
          <span className={isCollapsed ? 'hidden' : 'inline'}>Configuració</span>
        </button>
      </div>
      
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
          <div className="bg-gray-800 rounded-xl p-4 w-full max-w-sm border border-gray-700 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-2">Nova carpeta</h2>
            <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()} className="w-full px-3 py-2 rounded bg-gray-900 text-gray-100 text-sm border border-gray-700 focus:border-blue-500 outline-none" placeholder="Nom de la carpeta" autoFocus />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setCreateFolderModalOpen(false)} className="px-4 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded text-gray-200 font-medium">Cancel·lar</button>
              <button onClick={handleCreateFolder} className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded text-white font-medium">Crear</button>
            </div>
          </div>
        </div>
      )}
      {isRenameModalOpen && (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[500]">
    <div className="bg-gray-800 rounded-xl p-4 w-full max-w-sm border border-gray-700 shadow-2xl" onClick={e => e.stopPropagation()}>
      <h2 className="text-lg font-semibold text-white mb-2">Renombrar</h2>
      <input
        value={renameValue}
        onChange={(e) => setRenameValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleRenameConfirm()}
        className="w-full px-3 py-2 rounded bg-gray-900 text-gray-100 text-sm border border-gray-700 focus:border-blue-500 outline-none"
        placeholder="Nou nom"
        autoFocus
      />
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={() => setRenameModalOpen(false)} className="px-4 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded text-gray-200 font-medium">Cancel·lar</button>
        <button onClick={handleRenameConfirm} className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded text-white font-medium">Guardar</button>
      </div>
    </div>
  </div>
)}
{uploadProgress && (
  <div className="fixed bottom-4 left-4 z-[600] bg-gray-900/90 border border-gray-700 text-gray-100 px-4 py-3 rounded-xl shadow-xl">
    <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Upload</div>
    <div className="text-sm font-semibold truncate max-w-[320px]">{uploadProgress.name}</div>
    <div className="mt-2 h-2 w-80 bg-gray-700 rounded overflow-hidden">
      <div className="h-2 bg-blue-500" style={{ width: `${uploadProgress.pct}%` }} />
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
      {isImportModalOpen && <ImportFilesModal isOpen={isImportModalOpen} onClose={() => setImportModalOpen(false)} onFilesSelect={handleFilesUpload} accept=".pdf,.docx,.srt,.mp4,.wav,.mov,.webm,.ogg" title="Importar Fitxers" description="Selecciona o arrossega guions (PDF, DOCX), subtítols (SRT) o vídeo/àudio." />}
    
    
    </div>
  );
};