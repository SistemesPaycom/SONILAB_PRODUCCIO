// components/DirtyGuardModal.tsx
import React from 'react';

interface DirtyGuardModalProps {
  isOpen: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export const DirtyGuardModal: React.FC<DirtyGuardModalProps> = ({ isOpen, onSave, onDiscard, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[300] backdrop-blur-md p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-3xl p-8 max-w-sm w-full shadow-2xl">
        <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mb-6 mx-auto">
          <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-xl font-black text-white text-center uppercase tracking-tight mb-2">Canvis sense desar</h3>
        <p className="text-gray-400 text-center text-sm mb-8">Vols guardar els canvis fets en aquest document abans de continuar?</p>
        
        <div className="flex flex-col gap-3">
          <button onClick={onSave} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all shadow-lg">Guardar i sortir</button>
          <button onClick={onDiscard} className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-gray-200 font-black uppercase text-xs tracking-widest rounded-xl transition-all">No guardar</button>
          <button onClick={onCancel} className="w-full py-3 text-gray-500 hover:text-gray-300 font-bold text-xs uppercase tracking-widest transition-all">Cancel·lar</button>
        </div>
      </div>
    </div>
  );
};
