// components/Library/FileItem.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { LibraryItem, Document } from '../../appTypes';
import { useLibrary } from '../../context/Library/SonilabLibraryContext';
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
  onCopy?: (ids: string[]) => void;
  onCut?: (ids: string[]) => void;
  isCut?: boolean;
  isProject?: boolean;
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
  onCopy,
  onCut,
  isCut,
  isProject,
}) => {
  const { state, dispatch } = useLibrary();
  const { view, folders, documents, currentFolderId, selectedIds } = state;
  const itemRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  const isLocked = item.type === 'document' && item.isLocked;
  const sourceType = item.type === 'document' ? item.sourceType : '';
  const isRef = item.type === 'document' && !!(item as any).refTargetId;
  const isOrphanLnk = isRef && !documents.find(d => d.id === (item as any).refTargetId && !d.isDeleted);

  const [menuOpen, setMenuOpen] = useState(false);

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
      if (isOrphanLnk) return; // target deleted or missing — do not attempt to open
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
      // Guard: media canònica no es pot moure com un fitxer clàssic.
      // Un LNK (refTargetId poblat) no queda blocat per aquesta regla.
      const hasCanonicalMediaInDrag = draggedItemIds.some(id => {
        const doc = documents.find(d => d.id === id);
        return !!(doc && (doc as any).media && !(doc as any).refTargetId);
      });
      if (hasCanonicalMediaInDrag) return;

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
          draggedElement.className = 'px-3 py-2 text-white rounded-xl shadow-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 border-2 border-white/20 backdrop-blur-md';
          draggedElement.style.backgroundColor = 'var(--th-accent)';
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
                // Moviment genèric a carpeta: bloquejat si algun element és media canònica.
                // Un LNK (refTargetId poblat) no és media canònica i no queda blocat.
                const dragHasCanonicalMedia = draggedIds.some(id => {
                  const doc = documents.find(d => d.id === id);
                  return !!(doc && (doc as any).media && !(doc as any).refTargetId);
                });
                isCompatible = !dragHasCanonicalMedia;
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
                  if (!dropAction) {
                    // Moviment genèric a carpeta: bloquejat si algun element és media canònica.
                    const dropHasCanonicalMedia = draggedIds.some(id => {
                      const doc = documents.find(d => d.id === id);
                      return !!(doc && (doc as any).media && !(doc as any).refTargetId);
                    });
                    canProceed = finalDropTargetId !== item.id && !dropHasCanonicalMedia;
                  } else if (draggedIds.length === 1) {
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
              else if (item.type === 'document') {
                if (isOrphanLnk) return; // target deleted or missing — do not attempt to preview
                onPreviewDocument(item.id);
              }
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
  const rawFormat = ((item as Document).sourceType || 'snlbpro').toUpperCase();
  const formatLabel = item.type === 'folder' ? (isProject ? 'Projecte' : 'Carpeta') : isRef ? `LNK (${rawFormat})` : rawFormat;

  return (
    <div
      ref={itemRef}
      data-id={item.id}
      data-droptarget={item.type === 'folder' && view === 'library'}
      className={`group grid gap-0 px-0 py-2 text-sm border-b border-[var(--th-border)] transition-all duration-150
        ${isSelected ? 'bg-white/10' : 'hover:bg-white/5'}
        ${isDropTarget ? 'ring-2 rounded-md' : ''}
        ${isLocked ? 'opacity-70' : ''}
        ${isCut ? 'opacity-40' : ''}
      `}
      style={{ gridTemplateColumns: gridColumns, ...(isDropTarget ? { backgroundColor: 'var(--th-bg-tertiary)' } : {}) }}
    >
      <div
        onClick={handleToggleSelection}
        className="cursor-pointer z-10 h-full flex items-center justify-center"
        aria-label={`Seleccionar ${item.name}`}
      >
        <div
          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
            isSelected
              ? ''
              : 'border-gray-500 group-hover:border-gray-400'
          }`}
          style={isSelected ? { backgroundColor: 'var(--th-accent)', borderColor: 'var(--th-accent)' } : undefined}
        >
          {isSelected && <Icons.Check className="w-3 h-3 text-white" />}
        </div>
      </div>

      <div
        ref={dragHandleRef}
        onDoubleClick={handleDoubleClick}
        className="flex items-center gap-2 cursor-pointer select-none overflow-hidden px-4"
      >
        {/* Icon: shortcut arrow overlay for refs */}
        <span className="relative flex-shrink-0">
          {item.type === 'folder' ? (isProject ? '🗃️' : '📁') : getFileIcon(sourceType || '', isLocked)}
          {isRef && (
            <span
              className="absolute -bottom-1 -right-1.5 text-[13px] leading-none select-none font-bold"
              style={{ color: isOrphanLnk ? '#ef4444' : 'var(--th-accent)', textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
              title={isOrphanLnk ? 'Accés directe trencat (original eliminat o no trobat)' : 'Accés directe'}
            >{isOrphanLnk ? '⚠' : '↗'}</span>
          )}
        </span>
        <span
          className={`truncate ${isLocked ? 'italic' : ''} ${isRef ? 'opacity-80' : ''} ${isOrphanLnk ? 'line-through' : ''}`}
          style={{
            fontFamily: 'var(--us-home-filename-family)',
            fontSize:   'var(--us-home-filename-size)',
            color:      isOrphanLnk ? '#6b7280' : (isLocked ? '#9ca3af' : 'var(--us-home-filename-color)'),
            fontWeight: 'var(--us-home-filename-weight)' as any,
            fontStyle:  'var(--us-home-filename-style)',
          }}
        >{item.name}</span>
        {isLocked && <Icons.LockIcon size={12} className="animate-pulse flex-shrink-0" style={{ color: 'var(--th-accent-text)' }} />}
      </div>

      <div
        className="flex items-center px-4 uppercase select-none min-w-0 overflow-hidden"
        style={{
          fontFamily: 'var(--us-home-format-family)',
          fontSize:   'var(--us-home-format-size)',
          color:      'var(--us-home-format-color)',
          fontWeight: 'var(--us-home-format-weight)' as any,
          fontStyle:  'var(--us-home-format-style)',
        }}
      >
        <span className="truncate">{formatLabel}</span>
      </div>

      <div
        className="hidden sm:flex items-center gap-2 select-none whitespace-nowrap px-4 min-w-0 overflow-hidden"
        style={{
          fontFamily: 'var(--us-home-datetime-family)',
          fontSize:   'var(--us-home-datetime-size)',
          color:      'var(--us-home-datetime-color)',
          fontWeight: 'var(--us-home-datetime-weight)' as any,
          fontStyle:  'var(--us-home-datetime-style)',
        }}
      >
        <span className="truncate">{formattedDate}</span>
        <span className="opacity-40 truncate">{formattedTime}</span>
      </div>
      
      <div className="z-10 flex items-center justify-center px-2 relative">
        {(() => {
          const ids = selectedIds.has(item.id) && selectedIds.size > 1 ? Array.from(selectedIds) : [item.id];
          // Copiar: visible only if ALL items in the effective selection are documents.
          // Never filter silently — if any folder is in the selection, hide the action entirely.
          const allAreDocs = ids.every(id => documents.some(d => d.id === id));
          // Amaga Copiar/Retallar si la selecció conté algun asset de media canònica
          // (media poblat i sense refTargetId). Un LNK no és media canònica.
          const selectionHasCanonicalMedia = ids.some(id => {
            const doc = documents.find(d => d.id === id);
            return !!(doc && (doc as any).media && !(doc as any).refTargetId);
          });
          const menuItems: { label: string; icon: string; action: () => void }[] = [];
          if (onCopy && allAreDocs && !selectionHasCanonicalMedia) menuItems.push({ label: 'Copiar', icon: '📋', action: () => onCopy(ids) });
          if (onCut && !selectionHasCanonicalMedia) menuItems.push({ label: 'Retallar', icon: '✂️', action: () => onCut(ids) });
          if (isRef && !isOrphanLnk) {
            const targetDoc = documents.find(d => d.id === (item as any).refTargetId && !d.isDeleted);
            if (targetDoc) {
              menuItems.push({
                label: 'Mostrar ubicació real',
                icon: '📂',
                action: () => {
                  dispatch({ type: 'SET_VIEW', payload: 'library' });
                  dispatch({ type: 'SET_CURRENT_FOLDER', payload: targetDoc.parentId ?? null });
                },
              });
            }
          }
          if (menuItems.length === 0) return null;
          return (
            <>
              <button
                title="Opcions"
                aria-label="Opcions"
                onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
                className="opacity-50 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded text-sm font-bold"
                style={{ color: 'var(--th-text-muted)' }}
              >⋯</button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-[400]" onClick={e => { e.stopPropagation(); setMenuOpen(false); }} />
                  <div
                    className="absolute right-0 top-full mt-1 z-[401] rounded-lg shadow-xl py-1 min-w-[160px]"
                    style={{ backgroundColor: 'var(--th-bg-surface)', border: '1px solid var(--th-border)' }}
                  >
                    {menuItems.map((mi, i) => (
                      <button
                        key={i}
                        onClick={e => { e.stopPropagation(); mi.action(); setMenuOpen(false); }}
                        className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:brightness-125"
                        style={{ color: 'var(--th-text-secondary)' }}
                      >
                        <span>{mi.icon}</span><span>{mi.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
};