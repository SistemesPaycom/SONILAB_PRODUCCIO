
import React from 'react';
import DropZone from './DropZone';

interface ImportFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFilesSelect: (files: File[]) => void;
  accept: string;
  title: string;
  description: string;
}

const ImportFilesModal: React.FC<ImportFilesModalProps> = ({
  isOpen,
  onClose,
  onFilesSelect,
  accept,
  title,
  description,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[150] p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div
        className="bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-xl text-gray-200 flex flex-col gap-5 border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="import-modal-title" className="text-xl font-bold text-white">{title}</h2>
            <p className="text-sm text-gray-400 mt-1">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-3xl leading-none transition-colors"
            aria-label="Tancar"
          >
            &times;
          </button>
        </div>

        <div className="h-[220px]">
          <DropZone
            onFilesSelect={onFilesSelect}
            accept={accept}
            multiple={true}
            label="Arrossega un o més fitxers aquí"
            subtext="Pots importar diversos guions, subtítols o vídeos simultàniament."
            file={null}
            onClear={() => {}}
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95 uppercase text-xs tracking-widest"
          >
            Fet
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportFilesModal;
