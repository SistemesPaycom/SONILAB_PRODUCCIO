// components/Library/FileItem.tsx
import React, { useRef, useEffect, useCallback } from 'react';
import type { LibraryItem, Document } from '../../types';
import { useLibrary } from '../../context/Library/LibraryContext';
import * as Icons from '../icons';

interface FileItemProps {
  item: LibraryItem;
  isSelected: boolean;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  dropTargetId: string | null;
  setDropTargetId: (id: string | null) => void;
  onPreviewDocument: (documentId: string) => void;
  onDoubleClickOpen: (documentId: string) => void;
  gridColumns: string;
}

const MEDIA_EXTS = ['mp4', 'mov', 'webm', 'wav', 'mp3', 'ogg', 'm4a'];

const getFileIcon = (type: string, isLocked: boolean) => {
  if (isLocked) return '⏳';
  const t = type.toLowerCase();
  if (['mp4', 'mov', 'webm'].includes(t)) return '🎬';
  if (['wav', 'mp3', 'ogg', 'm4a'].includes(t)) return '🔊';
  if (t === 'srt') return '🗒️';
  return '📄';
};

export const FileItem: React.FC<FileItemProps> = ({
  item,
  isSelected,
  setIsDragging,
  dropTargetId,
  setDropTargetId,
  onPreviewDocument,
  onDoubleClickOpen,
  gridColumns,
}) => {
  const { state, dispatch } = useLibrary();
  const { view, folders, documents, currentFolderId, selectedIds } = state;
  const itemRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  const isLocked = item.type === 'document' && item.isLocked;
  const sourceType = item.type === 'document' ? item.sourceType : '';

  const handleToggleSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({
      type: 'TOGGLE_SELECTION',
      payload: { id: item.id, isSelected: !isSelected },
    });
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type === 'document') {
      onDoubleClickOpen(item.id);
    }
  };

  const handleDrop = useCallback((draggedItemIds: string[], destinationFolderId: string | null, dropAction?: string) => {
      // 1. GESTIÓ DE VINCULACIÓ DIRECTA (LINKING)
      if (dropAction === 'link-media' || dropAction === 'link-subs') {
          if (draggedItemIds.length > 1) return;
          
          const targetDocId = draggedItemIds[0];
          const targetDoc = documents.find(d => d.id === targetDocId);
          if (!targetDoc) return;

          const sType = targetDoc.sourceType?.toLowerCase() || '';
          const isMedia = MEDIA_EXTS.includes(sType);
          const isSrt = sType === 'srt';

          if (dropAction === 'link-media' && isMedia) {
              dispatch({ type: 'TRIGGER_SYNC_REQUEST', payload: { docId: targetDocId, type: 'media' } });
          } else if (dropAction === 'link-subs' && isSrt) {
              dispatch({ type: 'TRIGGER_SYNC_REQUEST', payload: { docId: targetDocId, type: 'subtitles' } });
          }
          return;
      }

      // 2. GESTIÓ DE MOVIMENT DE FITXERS (FILE MOVE)
      if (destinationFolderId === currentFolderId && item.type === 'folder') return;
      if (draggedItemIds.includes(destinationFolderId as string)) return;

      for (const draggedId of draggedItemIds) {
        let currentParentId = destinationFolderId;
        while (currentParentId) {
          if (currentParentId === draggedId) return;
          const parentFolder = folders.find((f) => f.id === currentParentId);
          currentParentId = parentFolder ? parentFolder.parentId : null;
        }
      }

      dispatch({
        type: 'MOVE_ITEMS',
        payload: { itemIds: draggedItemIds, destinationFolderId },
      });
    },
    [dispatch, folders, currentFolderId, item.type, documents]
  );

  useEffect(() => {
    const handle = dragHandleRef.current;
    if (!handle) return;

    const onMouseDown = (e: MouseEvent) => {
      if (view !== 'library' || e.button !== 0) return;
      e.stopPropagation();

      const startPos = { x: e.clientX, y: e.clientY };
      let draggedElement: HTMLElement | null = null;
      let isDragAction = false;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startPos.x;
        const dy = moveEvent.clientY - startPos.y;

        if (!isDragAction && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
          isDragAction = true;
          moveEvent.preventDefault();

          setIsDragging(true);
          document.body.style.cursor = 'grabbing';
          document.body.style.userSelect = 'none';
          document.body.classList.add('is-dragging-from-library'); 

          const selectedItems = selectedIds.has(item.id) ? [...folders, ...documents].filter((i) => selectedIds.has(i.id)) : [item];

          draggedElement = document.createElement('div');
          draggedElement.style.position = 'fixed';
          draggedElement.style.left = `0px`;
          draggedElement.style.top = `0px`;
          draggedElement.style.pointerEvents = 'none';
          draggedElement.style.zIndex = '2000';
          draggedElement.className = 'px-3 py-2 bg-blue-600 text-white rounded-xl shadow-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 border-2 border-white/20 backdrop-blur-md';
          draggedElement.innerHTML = `<span>📂</span> <span>${selectedItems.length} element(s)</span>`;
          document.body.appendChild(draggedElement);

          selectedItems.forEach((i) => {
            const el = document.querySelector(`[data-id='${i.id}']`) as HTMLElement;
            if (el) el.style.opacity = '0.5';
          });
        }

        if (isDragAction && draggedElement) {
          draggedElement.style.transform = `translate(${moveEvent.clientX + 15}px, ${moveEvent.clientY + 15}px)`;

          let newDropTargetId = null;
          const elementUnderCursor = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
          const dropTargetElement = elementUnderCursor?.closest('[data-droptarget="true"]');

          if (dropTargetElement) {
            const dropAction = dropTargetElement.getAttribute('data-drop-action');
            let isCompatible = false;
            const draggedIds = selectedIds.has(item.id) ? Array.from(selectedIds) : [item.id];
            
            if (!dropAction) {
                isCompatible = true;
            } else if (draggedIds.length === 1) {
                const doc = documents.find(d => d.id === draggedIds[0]);
                if (doc && doc.type === 'document') {
                    const sType = doc.sourceType?.toLowerCase() || '';
                    if (dropAction === 'link-media') isCompatible = MEDIA_EXTS.includes(sType);
                    else if (dropAction === 'link-subs') isCompatible = sType === 'srt';
                }
            }

            if (isCompatible) {
                newDropTargetId = dropTargetElement.getAttribute('data-id') || dropAction;
                dropTargetElement.classList.add('drop-hover');
            }
          }

          document.querySelectorAll('.drop-hover').forEach(el => {
              const elId = el.getAttribute('data-id') || el.getAttribute('data-drop-action');
              if (elId !== newDropTargetId) el.classList.remove('drop-hover');
          });

          if (dropTargetId !== newDropTargetId) setDropTargetId(newDropTargetId);
        }
      };

      const onMouseUp = (upEvent: MouseEvent) => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        
        try {
            document.body.classList.remove('is-dragging-from-library');
            document.querySelectorAll('.drop-hover').forEach(el => el.classList.remove('drop-hover'));

            if (isDragAction) {
              document.body.style.cursor = 'default';
              document.body.style.userSelect = '';
              setIsDragging(false);

              const elementUnderCursor = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
              const dropTargetElement = elementUnderCursor?.closest('[data-droptarget="true"]');
              
              if (dropTargetElement) {
                  const dropAction = dropTargetElement.getAttribute('data-drop-action');
                  const finalDropTargetId = dropTargetElement.getAttribute('data-id');
                  const draggedIds = selectedIds.has(item.id) ? Array.from(selectedIds) : [item.id];
                  
                  let canProceed = false;
                  if (!dropAction) canProceed = finalDropTargetId !== item.id;
                  else if (draggedIds.length === 1) {
                      const doc = documents.find(d => d.id === draggedIds[0]);
                      if (doc) {
                          const sType = doc.sourceType?.toLowerCase() || '';
                          if (dropAction === 'link-media') canProceed = MEDIA_EXTS.includes(sType);
                          else if (dropAction === 'link-subs') canProceed = sType === 'srt';
                      }
                  }

                  if (canProceed) handleDrop(draggedIds, finalDropTargetId, dropAction || undefined);
              }
            } else {
              if (item.type === 'folder') dispatch({ type: 'SET_CURRENT_FOLDER', payload: item.id });
              else if (item.type === 'document') onPreviewDocument(item.id);
            }
        } finally {
            setDropTargetId(null);
            setIsDragging(false);
            if (draggedElement) draggedElement.remove();
            const itemsToUnhide = selectedIds.has(item.id) ? Array.from(selectedIds) : [item.id];
            itemsToUnhide.forEach((id) => {
                const el = document.querySelector(`[data-id='${id}']`) as HTMLElement;
                if (el) el.style.opacity = '1';
            });
            document.body.style.cursor = 'default';
            document.body.style.userSelect = '';
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    handle.addEventListener('mousedown', onMouseDown);
    return () => handle.removeEventListener('mousedown', onMouseDown);
  }, [item.id, item.type, selectedIds, folders, documents, handleDrop, setIsDragging, setDropTargetId, dropTargetId, view, dispatch, onPreviewDocument]);

  const isDropTarget = item.type === 'folder' && dropTargetId === item.id && !selectedIds.has(item.id);
  const formattedDate = new Date(item.updatedAt).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formattedTime = new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatLabel = item.type === 'folder' ? 'Carpeta' : ((item as Document).sourceType || 'slsf').toUpperCase();

  return (
    <div
      ref={itemRef}
      data-id={item.id}
      data-droptarget={item.type === 'folder' && view === 'library'}
      className={`group grid gap-0 px-0 py-2 text-sm border-b border-gray-800 transition-all duration-150
        ${isSelected ? 'bg-blue-900/40' : 'hover:bg-gray-800/60'}
        ${isDropTarget ? 'bg-blue-800 ring-2 ring-blue-500 rounded-md' : ''}
        ${isLocked ? 'opacity-70' : ''}
      `}
      style={{ gridTemplateColumns: gridColumns }}
    >
      <div
        onClick={handleToggleSelection}
        className="cursor-pointer z-10 h-full flex items-center justify-center"
        aria-label={`Seleccionar ${item.name}`}
      >
        <div
          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
            isSelected
              ? 'bg-blue-600 border-blue-500'
              : 'border-gray-500 group-hover:border-gray-400'
          }`}
        >
          {isSelected && <Icons.Check className="w-3 h-3 text-white" />}
        </div>
      </div>

      <div 
        ref={dragHandleRef}
        onDoubleClick={handleDoubleClick}
        className="flex items-center gap-2 cursor-pointer select-none overflow-hidden px-4"
      >
        <span className="flex-shrink-0">{item.type === 'folder' ? '📁' : getFileIcon(sourceType || '', isLocked)}</span>
        <span className={`truncate text-gray-100 ${isLocked ? 'italic text-gray-400' : ''}`}>{item.name}</span>
        {isLocked && <Icons.LockIcon size={12} className="text-blue-400 animate-pulse flex-shrink-0" />}
      </div>

      <div className="flex items-center px-4 text-[10px] font-black uppercase text-gray-500 select-none truncate">
        {formatLabel}
      </div>

      <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-gray-400 select-none whitespace-nowrap px-4">
        <span className="text-gray-200">{formattedDate}</span>
        <span className="opacity-40">{formattedTime}</span>
      </div>
      
      <div className="z-10" />
    </div>
  );
};