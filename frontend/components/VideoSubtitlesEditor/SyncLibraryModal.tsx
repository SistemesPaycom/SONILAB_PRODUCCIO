
import React, { useState, useMemo } from 'react';
import { useLibrary } from '../../context/Library/LibraryContext';
import * as Icons from '../icons';
import { Document } from '../../types';

interface SyncLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncMedia: (doc: Document) => void;
  onSyncSubtitles: (doc: Document) => void;
}

const SyncLibraryModal: React.FC<SyncLibraryModalProps> = ({ isOpen, onClose, onSyncMedia, onSyncSubtitles }) => {
  const { state } = useLibrary();
  const [activeTab, setActiveTab] = useState<'media' | 'subs'>('media');

  const filteredItems = useMemo(() => {
    if (activeTab === 'media') {
      return state.documents.filter(d => 
        !d.isDeleted && // Excloure fitxers de la paperera
        ['mp4', 'wav', 'mov', 'webm', 'ogg', 'mp3'].includes(d.sourceType?.toLowerCase() || '')
      );
    } else {
      return state.documents.filter(d => 
        !d.isDeleted && // Excloure fitxers de la paperera
        d.sourceType?.toLowerCase() === 'srt'
      );
    }
  }, [state.documents, activeTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[150] p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col h-[500px] overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Capçalera */}
        <div className="p-5 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <Icons.Hash className="w-6 h-6" style={{ color: 'var(--th-accent-text)' }} />
            Sincronitzar amb Llibreria
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl transition-colors">&times;</button>
        </div>

        {/* Pestanyes */}
        <div className="flex bg-gray-900/80 border-b border-gray-700">
          <button
            onClick={() => setActiveTab('media')}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'media' ? 'border-b-2' : 'text-gray-500 hover:text-gray-300'}`}
            style={activeTab === 'media' ? { backgroundColor: 'var(--th-accent-muted)', color: 'var(--th-accent-text)', borderColor: 'var(--th-accent)' } : undefined}
          >
            Vídeo / Àudio
          </button>
          <button
            onClick={() => setActiveTab('subs')}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'subs' ? 'border-b-2' : 'text-gray-500 hover:text-gray-300'}`}
            style={activeTab === 'subs' ? { backgroundColor: 'var(--th-accent-muted)', color: 'var(--th-accent-text)', borderColor: 'var(--th-accent)' } : undefined}
          >
            Subtítols (SRT)
          </button>
        </div>

        {/* Llista filtrada (Mini-explorador) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-800/30">
          {filteredItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 italic text-sm">
              <Icons.Folder className="w-12 h-12 mb-3 opacity-20" />
              No s'han trobat {activeTab === 'media' ? 'mitjans' : 'subtítols'} a la llibreria.
            </div>
          ) : (
            filteredItems.map(item => (
              <div 
                key={item.id}
                className="group flex items-center justify-between p-3 rounded-xl bg-gray-900/40 border border-gray-700/50 hover:border-gray-500/50 hover:bg-gray-900/80 transition-all cursor-default"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="text-xl">
                    {activeTab === 'media' ? (['wav', 'mp3'].includes(item.sourceType || '') ? '🔊' : '🎬') : '🗒️'}
                  </span>
                  <div className="truncate">
                    <p className="text-sm font-bold text-gray-200 truncate">{item.name}</p>
                    <p className="text-[10px] text-gray-500 uppercase font-mono">{item.sourceType} • {new Date(item.updatedAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (activeTab === 'media') {
                      onSyncMedia(item);
                      // No tanquem el modal en vincular mitjans per permetre vincular SRT a continuació
                    } else {
                      onSyncSubtitles(item);
                      onClose(); // Tanquem només en vincular subtítols (acció final típica)
                    }
                  }}
                  className="px-4 py-1.5 text-[10px] font-black rounded-lg opacity-0 group-hover:opacity-100 transition-all uppercase tracking-wider"
                  style={{ backgroundColor: 'var(--th-btn-primary-bg)', color: 'var(--th-btn-primary-text)' }}
                >
                  Vincular
                </button>
              </div>
            ))
          )}
        </div>

        {/* Peu */}
        <div className="p-4 border-t border-gray-700 bg-gray-900/50 text-[10px] text-gray-500 text-center uppercase tracking-widest font-bold">
          Selecciona un fitxer ja importat per vincular-lo a aquest editor
        </div>
      </div>
    </div>
  );
};

export default SyncLibraryModal;
