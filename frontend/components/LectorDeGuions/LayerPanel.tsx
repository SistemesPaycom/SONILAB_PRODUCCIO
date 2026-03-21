// components/LectorDeGuions/LayerPanel.tsx
import React, { useState } from 'react';
import * as Icons from '../icons';
import type { Layer } from '../../types/LectorDeGuions/annotation';
import { Modal } from './Modal';

type LayerPanelProps = {
  layers: Layer[];
  activeLayerId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, name: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onToggleAllVisible: () => void;
  onToggleAllLocked: () => void;
  onSetLayerPassword: (id: string, password: string | null) => void;
  maxLayers: number;
};

const MASTER_PASSWORD = 'Admin2025';

export const LayerPanel: React.FC<LayerPanelProps> = (props) => {
  const { layers, activeLayerId, maxLayers } = props;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  const [passwordModal, setPasswordModal] = useState<{
    isOpen: boolean;
    layer: Layer | null;
    action: 'unlock' | 'delete' | 'rename' | 'set' | 'remove' | null;
  }>({ isOpen: false, layer: null, action: null });
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [deleteConfirmationModal, setDeleteConfirmationModal] = useState<{
    isOpen: boolean;
    target: 'single' | 'all';
    layer?: Layer;
    unlockedLayerIds?: string[];
  }>({ isOpen: false, target: 'single' });
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [deleteConfirmationError, setDeleteConfirmationError] = useState('');

  const startEditing = (layer: Layer) => {
    if (layer.password) {
      setPasswordModal({ isOpen: true, layer, action: 'rename' });
    } else {
      setEditingId(layer.id);
      setTempName(layer.name);
    }
  };

  const finishEditing = () => {
    if (editingId && tempName.trim()) {
      props.onRename(editingId, tempName);
    }
    setEditingId(null);
  };
  
  const closePasswordModal = () => {
    setPasswordModal({ isOpen: false, layer: null, action: null });
    setPasswordInput('');
    setPasswordError('');
  };

  const proceedWithDelete = (layer: Layer) => {
    setDeleteConfirmationModal({ isOpen: true, target: 'single', layer });
  };
  
  const closeDeleteConfirmationModal = () => {
    setDeleteConfirmationModal({ isOpen: false, target: 'single' });
    setDeleteConfirmationInput('');
    setDeleteConfirmationError('');
  };

  const handleAttemptUnlock = (layer: Layer) => {
    if (layer.locked && layer.password) {
      setPasswordModal({ isOpen: true, layer, action: 'unlock' });
    } else {
      props.onToggleLocked(layer.id);
    }
  };

  const handleAttemptDelete = (layer: Layer) => {
    if (layer.password) {
      setPasswordModal({ isOpen: true, layer, action: 'delete' });
    } else {
      proceedWithDelete(layer);
    }
  };
  
  const handleTogglePassword = (layer: Layer) => {
     if (layer.password) {
       setPasswordModal({isOpen: true, layer, action: 'remove'});
     } else {
       setPasswordModal({isOpen: true, layer, action: 'set'});
     }
  };

  const handlePasswordVerification = () => {
    if (!passwordModal.layer || !passwordModal.action) return;

    const isCorrect = passwordInput === passwordModal.layer.password || passwordInput === MASTER_PASSWORD;
    if (!isCorrect) {
      setPasswordError('Contrasenya incorrecta.');
      return;
    }

    const layer = passwordModal.layer;
    const action = passwordModal.action;

    closePasswordModal();

    switch (action) {
      case 'unlock':
        props.onSetLayerPassword(layer.id, null);
        break;
      case 'delete':
        proceedWithDelete(layer);
        break;
      case 'rename':
        setEditingId(layer.id);
        setTempName(layer.name);
        break;
      case 'remove':
        props.onSetLayerPassword(layer.id, null);
        break;
    }
  };
  
  const handlePasswordSet = () => {
    if (!passwordModal.layer || passwordModal.action !== 'set') return;
    if (passwordInput.length > 10) {
      setPasswordError('Màxim 10 caràcters.');
      return;
    }
    props.onSetLayerPassword(passwordModal.layer.id, passwordInput);
    closePasswordModal();
  };
  
  const handleDeleteConfirmation = () => {
    const { target, layer, unlockedLayerIds } = deleteConfirmationModal;
    const expectedText = target === 'single' ? 'ELIMINAR' : 'ELIMINAR TOTES';
    
    if (deleteConfirmationInput !== expectedText) {
      setDeleteConfirmationError(`Text incorrecte. Escriu "${expectedText}".`);
      return;
    }
    
    if (target === 'single' && layer) {
      props.onDelete(layer.id);
    } else if (target === 'all' && unlockedLayerIds) {
      props.onDelete(unlockedLayerIds.join(','));
    }
    
    closeDeleteConfirmationModal();
  };

  const handleDeleteAllUnlocked = () => {
    const unlockedLayers = props.layers.filter(l => !l.locked);
    if (unlockedLayers.length === 0) {
      alert("No hi ha capes desbloquejades per eliminar.");
      return;
    }
    setDeleteConfirmationModal({ isOpen: true, target: 'all', unlockedLayerIds: unlockedLayers.map(l => l.id) });
  };

  const sortedLayers = [...layers].sort((a, b) => b.order - a.order);
  const isAnyLayerVisible = sortedLayers.some(l => l.visible);
  const isAnyLayerUnlocked = sortedLayers.some(l => !l.locked);

  const getPasswordModalTitle = () => {
    if (!passwordModal.action) return '';
    switch(passwordModal.action) {
      case 'set': return `Establir contrasenya per a "${passwordModal.layer?.name}"`;
      case 'unlock': return `Desbloquejar "${passwordModal.layer?.name}"`;
      case 'delete': return `Eliminar "${passwordModal.layer?.name}"`;
      case 'rename': return `Canviar nom de "${passwordModal.layer?.name}"`;
      case 'remove': return `Eliminar protecció de "${passwordModal.layer?.name}"`;
      default: return 'Acció protegida';
    }
  }
  
  const getDeleteModalTitle = () => {
    if (deleteConfirmationModal.target === 'single') {
        return `Eliminar capa "${deleteConfirmationModal.layer?.name}"?`;
    }
    return 'Eliminar totes les capes no bloquejades?';
  }
  
  const getDeleteModalPrompt = () => {
      if (deleteConfirmationModal.target === 'single') {
        return `Aquesta acció no es pot desfer. Per confirmar, escriu ELIMINAR.`;
    }
    return `Aquesta acció eliminarà ${deleteConfirmationModal.unlockedLayerIds?.length || 0} capes de forma permanent. Per confirmar, escriu ELIMINAR TOTES.`;
  }

  return (
    <div className="flex flex-col flex-grow bg-gray-800 text-sm min-h-0 text-gray-200">
      <div className="p-2 flex items-center justify-start gap-2 border-b border-gray-700">
         {/* FIX: Replaced non-existent Icons.FilePlus with Icons.Plus. */}
         <button onClick={props.onCreate} disabled={layers.length >= maxLayers} className="p-2 rounded-md hover:bg-gray-600 disabled:opacity-50" aria-label="Nova capa"><Icons.Plus size={16} /></button>
         <button onClick={props.onToggleAllVisible} className="p-2 rounded-md hover:bg-gray-600" aria-label="Mostrar/Ocultar totes">
           {isAnyLayerVisible ? <Icons.EyeIcon size={16} /> : <Icons.EyeOffIcon size={16} />}
         </button>
         <button onClick={props.onToggleAllLocked} className="p-2 rounded-md hover:bg-gray-600" aria-label="Bloquejar/Desbloquejar totes">
           {isAnyLayerUnlocked ? <Icons.LockIcon size={16} /> : <Icons.UnlockIcon size={16}/>}
         </button>
         <button onClick={handleDeleteAllUnlocked} className="p-2 rounded-md hover:bg-red-900/50 text-red-500" aria-label="Eliminar totes les capes desbloquejades"><Icons.Trash2 size={16} /></button>
      </div>

      <div className="flex-grow overflow-y-auto p-2">
        {sortedLayers.map(layer => {
          const isActive = layer.id === activeLayerId;
          const isEditing = editingId === layer.id;
          
          return (
            <div
              key={layer.id}
              onClick={() => !isActive && props.onSelect(layer.id)}
              className={`p-2 rounded-lg mb-2 cursor-pointer ${isActive ? 'border' : 'bg-gray-900/50 hover:bg-gray-700/50'}`}
              style={isActive ? { backgroundColor: 'var(--th-accent-muted)', borderColor: 'var(--th-accent)' } : undefined}
            >
              <div className="flex items-center gap-2">
                <button onClick={() => props.onToggleVisible(layer.id)} className="p-1 rounded-md hover:bg-gray-700">
                  {layer.visible ? <Icons.EyeIcon size={14} style={{ color: 'var(--th-accent-text)' }} /> : <Icons.EyeOffIcon size={14} className="text-gray-500" />}
                </button>
                
                {isEditing ? (
                  <input
                    type="text"
                    autoFocus
                    value={tempName}
                    onChange={e => setTempName(e.target.value)}
                    onBlur={finishEditing}
                    onKeyDown={e => e.key === 'Enter' && finishEditing()}
                    className="flex-grow bg-gray-900 border border-gray-600 rounded px-1 py-0 text-sm"
                  />
                ) : (
                  <span onDoubleClick={() => startEditing(layer)} className={`flex-grow truncate ${isActive ? 'font-semibold' : ''}`} style={isActive ? { color: 'var(--th-accent-text)' } : undefined}>
                    {layer.name}
                  </span>
                )}

                {layer.password && <Icons.Shield size={14} className="text-yellow-500" />}
                <button onClick={() => handleAttemptUnlock(layer)} className="p-1 rounded-md hover:bg-gray-700">
                  {layer.locked ? <Icons.LockIcon size={14} className="text-red-500" /> : <Icons.UnlockIcon size={14} className="text-gray-500" />}
                </button>
              </div>

              {isActive && (
                <div className="mt-2 pt-2 border-t border-gray-700 flex items-center justify-end gap-2">
                  <button onClick={() => handleTogglePassword(layer)} className="p-1 rounded-md hover:bg-gray-700" aria-label="Protegir capa">
                    <Icons.Shield size={14} className={layer.password ? "text-yellow-500" : "text-gray-500"} />
                  </button>
                  <button onClick={() => props.onMoveUp(layer.id)} className="p-1 rounded-md hover:bg-gray-700"><Icons.ArrowUp size={14} /></button>
                  <button onClick={() => props.onMoveDown(layer.id)} className="p-1 rounded-md hover:bg-gray-700"><Icons.ArrowDown size={14} /></button>
                  <button 
                    onClick={() => handleAttemptDelete(layer)} 
                    disabled={layer.locked}
                    className="p-1 rounded-md hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <Icons.Trash2 size={14} className="text-red-500" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Modal isOpen={passwordModal.isOpen} onClose={closePasswordModal} title={getPasswordModalTitle()}>
          <div className="mt-4 space-y-4">
              <p className="text-sm text-gray-400">
                  {passwordModal.action === 'set' && 'Crea una contrasenya (màx 10 caràcters) per protegir aquesta capa.'}
                  {passwordModal.action !== 'set' && 'Aquesta capa està protegida. Introdueix la contrasenya o la contrasenya mestra.'}
              </p>
              <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Contrasenya"
                  maxLength={10}
                  className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 bg-gray-900"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && (passwordModal.action === 'set' ? handlePasswordSet() : handlePasswordVerification())}
              />
              {passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
              <div className="mt-4 flex justify-end gap-2">
                  <button onClick={closePasswordModal} className="px-4 py-2 bg-gray-700 text-gray-200 rounded-md text-sm font-semibold hover:bg-gray-600">Cancel·lar</button>
                  {passwordModal.action === 'set' ? (
                      <button onClick={handlePasswordSet} className="px-4 py-2 text-white rounded-md text-sm font-semibold" style={{ backgroundColor: 'var(--th-btn-primary-bg)', color: 'var(--th-btn-primary-text)' }}>Establir</button>
                  ) : (
                      <button onClick={handlePasswordVerification} className="px-4 py-2 text-white rounded-md text-sm font-semibold" style={{ backgroundColor: 'var(--th-btn-primary-bg)', color: 'var(--th-btn-primary-text)' }}>Confirmar</button>
                  )}
              </div>
          </div>
      </Modal>
      
      <Modal isOpen={deleteConfirmationModal.isOpen} onClose={closeDeleteConfirmationModal} title={getDeleteModalTitle()}>
          <div className="mt-4 space-y-4">
              <p className="text-sm text-gray-400">{getDeleteModalPrompt()}</p>
              <input
                  type="text"
                  value={deleteConfirmationInput}
                  onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 bg-gray-900"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleDeleteConfirmation()}
              />
              {deleteConfirmationError && <p className="text-sm text-red-500">{deleteConfirmationError}</p>}
              <div className="mt-4 flex justify-end gap-2">
                  <button onClick={closeDeleteConfirmationModal} className="px-4 py-2 bg-gray-700 text-gray-200 rounded-md text-sm font-semibold hover:bg-gray-600">Cancel·lar</button>
                  <button onClick={handleDeleteConfirmation} className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-semibold hover:bg-red-700">Eliminar</button>
              </div>
          </div>
      </Modal>
    </div>
  );
};
