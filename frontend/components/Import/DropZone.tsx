
import React, { useRef, useState } from 'react';

interface DropZoneProps {
  onFilesSelect: (files: File[]) => void;
  accept: string;
  label: string;
  subtext: string;
  file: File | null; // Manté la compatibilitat per a visualització única si cal
  onClear: () => void;
  multiple?: boolean;
}

// Icones senzilles en SVG
const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const FileIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const DropZone: React.FC<DropZoneProps> = ({
  onFilesSelect,
  accept,
  label,
  subtext,
  file,
  onClear,
  multiple = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const related = e.relatedTarget as Node | null;
    if (!related || !(e.currentTarget as HTMLDivElement).contains(related)) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.dataTransfer.dropEffect = 'copy';
    } catch {}
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const dt = e.dataTransfer;
    let dropped: File[] = [];

    if (dt.files && dt.files.length > 0) {
      dropped = Array.from(dt.files);
    } else if (dt.items && dt.items.length > 0) {
      for (let i = 0; i < dt.items.length; i++) {
        const item = dt.items[i];
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f) dropped.push(f);
        }
      }
    }

    if (dropped.length > 0) {
      onFilesSelect(multiple ? dropped : [dropped[0]]);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFilesSelect(Array.from(files));
    }
    e.currentTarget.value = '';
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  const handleClearClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (inputRef.current) inputRef.current.value = '';
    onClear();
  };

  return (
    <div
      className={`rounded-lg border-2 border-dashed border-gray-500 bg-gray-800/60 flex items-center justify-center text-center h-full relative cursor-pointer transition-colors ${
        isDragOver ? 'border-indigo-400 bg-gray-800' : 'hover:bg-gray-800'
      }`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${label}. ${subtext}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileChange}
        className="hidden"
      />

      {file ? (
        <div className="flex flex-col items-center justify-center space-y-2 text-gray-300">
          <FileIcon className="w-10 h-10 text-indigo-300" />
          <p className="font-bold break-all text-sm">{file.name}</p>
          <p className="text-xs text-gray-400">{formatBytes(file.size)}</p>
          <button
            onClick={handleClearClick}
            className="mt-1 bg-red-600 hover:bg-red-500 text-white font-semibold py-1 px-3 rounded-lg text-xs"
          >
            Eliminar
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center space-y-3 text-gray-400 w-full h-full p-6">
          <DownloadIcon className="w-8 h-8" />
          <p className="font-bold text-sm text-gray-200">{label}</p>
          <p className="text-xs px-4">{subtext}</p>
        </div>
      )}
    </div>
  );
};

export default DropZone;
