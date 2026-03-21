import React, { useState } from 'react';
import DropZone from './DropZone';

interface ImportVideoSrtModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (files: { video: File | null; srt: File | null }) => void;
}

const ImportVideoSrtModal: React.FC<ImportVideoSrtModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [srtFile, setSrtFile] = useState<File | null>(null);

  if (!isOpen) return null;

  const handleImportClick = () => {
    onImport({ video: videoFile, srt: srtFile });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div
        className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-3xl text-gray-200 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="import-modal-title" className="text-xl font-bold">Importar Vídeo i Subtítols</h2>
            <p className="text-sm text-gray-400">Arrossega els arxius de vídeo i/o SRT a les seves zones corresponents.</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-2xl leading-none"
            aria-label="Tancar"
          >
            &times;
          </button>
        </div>
        <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 h-[250px]">
          <DropZone
            // FIX: Changed onFileSelect to onFilesSelect to match DropZoneProps and handled array.
            onFilesSelect={(files) => files.length > 0 && setVideoFile(files[0])}
            accept="video/mp4,video/webm,video/ogg,video/quicktime"
            label="Arrossega l'arxiu de VÍDEO"
            subtext="o fes clic per seleccionar"
            file={videoFile}
            onClear={() => setVideoFile(null)}
          />
          <DropZone
            // FIX: Changed onFileSelect to onFilesSelect to match DropZoneProps and handled array.
            onFilesSelect={(files) => files.length > 0 && setSrtFile(files[0])}
            accept=".srt"
            label="Arrossega l'arxiu de SUBTÍTOLS (.srt)"
            subtext="o fes clic per seleccionar"
            file={srtFile}
            onClear={() => setSrtFile(null)}
          />
        </div>
        <div className="flex justify-end gap-3 mt-2">
            <button onClick={onClose} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition-colors">
                Cancel·lar
            </button>
            <button onClick={handleImportClick} disabled={!videoFile && !srtFile} className="disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded transition-colors" style={{ backgroundColor: 'var(--th-btn-primary-bg)' }}>
                Importar
            </button>
        </div>
      </div>
    </div>
  );
};

export default ImportVideoSrtModal;