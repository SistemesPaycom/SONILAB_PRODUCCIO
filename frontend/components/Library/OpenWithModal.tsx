
// components/Library/OpenWithModal.tsx
import React, { useState } from 'react';
import { useLibrary } from '../../context/Library/LibraryContext';
import * as Icons from '../icons';
import { convertSrtToSnlbpro } from '../../utils/SubtitlesEditor/srtToSnlbpro';
import { convertSrtToSsrtlsf } from '../../utils/SubtitlesEditor/srtToSsrtlsf';

type OpenMode = 'editor' | 'editor-video' | 'editor-video-subs' | 'editor-ssrtlsf' | 'editor-srt-standalone';

interface OpenWithModalProps {
  docId: string;
  onClose: () => void;
  onOpen: (docId: string, mode: OpenMode, isEditing: boolean) => void;
}

const OpenWithModal: React.FC<OpenWithModalProps> = ({ docId, onClose, onOpen }) => {
  const { state, dispatch, useBackend, createDocumentRemote } = useLibrary();
  const [isEditingMode, setIsEditingMode] = useState(true);
  const doc = state.documents.find(d => d.id === docId);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

 const handleConvertToSnlbpro = () => {
  void (async () => {
    if (!doc) return;

    const srtContent =
      doc.contentByLang['_unassigned'] || Object.values(doc.contentByLang)[0] || '';
    const snlbproContent = convertSrtToSnlbpro(srtContent);
    if (!snlbproContent) return;

    // Nou format de nom: .txt (el sourceType és 'snlbpro' per a detecció interna)
    const newName = doc.name.replace(/\.srt$/i, '') + '.txt';

    if (useBackend) {
      await createDocumentRemote({
        name: newName,
        parentId: doc.parentId,
        content: snlbproContent,
        sourceType: 'snlbpro',
      });
    } else {
      dispatch({
        type: 'IMPORT_DOCUMENT',
        payload: {
          name: newName,
          parentId: doc.parentId,
          content: snlbproContent,
          sourceType: 'snlbpro',
        },
      });
    }

    onClose();
  })();
};

const handleConvertToSsrtlsf = () => {
  void (async () => {
    if (!doc) return;

    const srtContent =
      doc.contentByLang['_unassigned'] || Object.values(doc.contentByLang)[0] || '';
    const ssrtlsfContent = convertSrtToSsrtlsf(srtContent);
    if (!ssrtlsfContent) return;

    const newName = doc.name.replace(/\.srt$/i, '') + '.ssrtlsf';

    if (useBackend) {
      await createDocumentRemote({
        name: newName,
        parentId: doc.parentId,
        content: ssrtlsfContent,
        sourceType: 'ssrtlsf',
      });
    } else {
      dispatch({
        type: 'IMPORT_DOCUMENT',
        payload: {
          name: newName,
          parentId: doc.parentId,
          content: ssrtlsfContent,
          sourceType: 'ssrtlsf',
        },
      });
    }

    onClose();
  })();
};

  /** Obre l'editor en una nova pestanya del navegador */
  const openInNewTab = (mode: OpenMode) => {
    const url = `${window.location.origin}${window.location.pathname}#/editor/${mode}/${docId}`;
    window.open(url, '_blank');
    onClose();
  };

  if (!doc) return null;

  const isSrt = doc.sourceType?.toLowerCase() === 'srt' || doc.name.toLowerCase().endsWith('.srt');
  const isSsrtlsf = doc.sourceType?.toLowerCase() === 'ssrtlsf' || doc.name.toLowerCase().endsWith('.ssrtlsf');
  // Compatibilitat: detecta snlbpro (nou) i slsf (legacy)
  const isSnlbpro = doc.sourceType?.toLowerCase() === 'snlbpro' || doc.sourceType?.toLowerCase() === 'slsf' || doc.name.toLowerCase().endsWith('.slsf');

  if (isSsrtlsf) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={handleBackdropClick}>
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-md text-gray-200 border border-gray-700">
           <h2 className="text-xl font-bold text-white mb-6">Obrir SSRTLSF</h2>
           <button
              onClick={() => openInNewTab('editor-ssrtlsf')}
              className="w-full group flex items-center gap-4 p-4 rounded-xl bg-gray-900/50 hover:bg-emerald-600/20 hover:border-emerald-500/50 border border-transparent transition-all text-left"
            >
              <Icons.Hash className="w-8 h-8 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="font-bold text-gray-100 text-sm">Editor SSRTLSF (Cel·les)</p>
                <p className="text-xs text-gray-400">Preparació per a adaptació de guió.</p>
              </div>
            </button>
            <button onClick={onClose} className="mt-4 w-full p-2 text-sm text-gray-500 hover:text-white">Cancel·lar</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-md text-gray-200 flex flex-col gap-6 border border-gray-700" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Obrir amb...</h2>
            <p className="text-sm text-gray-400 truncate mt-1" title={doc.name}>{doc.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        <ul className="space-y-2">
          {isSrt ? (
            <>
              <li>
                <button
                  onClick={() => openInNewTab('editor-srt-standalone')}
                  className="w-full group flex items-center gap-4 p-4 rounded-xl bg-gray-900/50 hover:bg-white/5 hover:border-gray-500/50 border border-transparent transition-all text-left"
                >
                  <Icons.SubtitlesIcon className="w-8 h-8 text-gray-300 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-gray-100 text-sm">Editor de subtítols (Sols SRT)</p>
                    <p className="text-xs text-gray-400">Mode graella clàssica tipus Subtitle Edit.</p>
                  </div>
                </button>
              </li>
            </>
          ) : (
            <>
              <li>
                <button
                  onClick={() => openInNewTab('editor')}
                  className="w-full group flex items-center gap-4 p-4 rounded-xl bg-gray-900/50 hover:bg-white/5 hover:border-gray-500/50 border border-transparent transition-all text-left"
                >
                  <Icons.ScriptEditorIcon className="w-8 h-8 text-gray-300 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-gray-100 text-sm">Editor de guió</p>
                    <p className="text-xs text-gray-400">Processament de text estàndard.</p>
                  </div>
                </button>
              </li>
              
              <li>
                <button
                  onClick={() => openInNewTab('editor-video')}
                  className="w-full group flex items-center gap-4 p-4 rounded-xl bg-gray-900/50 hover:bg-purple-600/20 hover:border-purple-500/50 border border-transparent transition-all text-left"
                >
                  <Icons.VideoEditorIcon className="w-8 h-8 text-purple-400 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-gray-100 text-sm">Editor de vídeo (Guió)</p>
                    <p className="text-xs text-gray-400">Sincronització de takes amb imatge.</p>
                  </div>
                </button>
              </li>

              {isSnlbpro && (
                  <li>
                    <button
                    onClick={() => openInNewTab('editor-video-subs')}
                    className="w-full group flex items-center gap-4 p-4 rounded-xl bg-gray-900/50 hover:bg-indigo-600/20 hover:border-indigo-500/50 border border-transparent transition-all text-left"
                    >
                    <Icons.Hash className="w-8 h-8 text-indigo-400 flex-shrink-0" />
                    <div>
                        <p className="font-bold text-gray-100 text-sm">Editor de subtítols amb guió</p>
                        <p className="text-xs text-gray-400">Híbrid guió + graella SRT (Preparació Whisper).</p>
                    </div>
                    </button>
                </li>
              )}

            </>
          )}
        </ul>
      </div>
    </div>
  );
};

export default OpenWithModal;
