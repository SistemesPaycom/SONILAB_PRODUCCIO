/**
 * SrtEditorModeModal.tsx
 *
 * Modal mínim que apareix quan l'usuari fa doble-clic sobre un SRT a la Library.
 * Permet triar entre:
 *   A) Editor complet (editor-video-subs) — amb panell de guió i corrector
 *   B) Editor bàsic (editor-srt-standalone) — sense guió
 *
 * Opció "Recordar la meva elecció" → desa a localStorage (SRT_EDITOR_MODE).
 */

import React, { useState } from 'react';

type EditorMode = 'editor-video-subs' | 'editor-srt-standalone';

interface SrtEditorModeModalProps {
  isOpen: boolean;
  /** Si el document/projecte ja té guió vinculat → suggerim editor complet */
  hasGuion: boolean;
  onSelect: (mode: EditorMode, remember: boolean) => void;
  onClose: () => void;
}

const SrtEditorModeModal: React.FC<SrtEditorModeModalProps> = ({
  isOpen,
  hasGuion,
  onSelect,
  onClose,
}) => {
  const [selected, setSelected] = useState<EditorMode>('editor-video-subs');
  const [remember, setRemember] = useState(false);

  if (!isOpen) return null;

  const handleOpen = () => onSelect(selected, remember);

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[300] p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Capçalera */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <h2 className="text-sm font-black text-white uppercase tracking-tighter">
            Obrir SRT amb…
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Opcions */}
        <div className="px-4 pb-4 space-y-2">
          {/* Opció A: Editor complet */}
          <button
            onClick={() => setSelected('editor-video-subs')}
            className={`w-full text-left rounded-xl border p-3.5 transition-colors ${
              selected === 'editor-video-subs'
                ? 'border-blue-500/70 bg-blue-900/20'
                : 'border-gray-700 bg-gray-700/30 hover:bg-gray-700/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                selected === 'editor-video-subs' ? 'border-blue-400' : 'border-gray-500'
              }`}>
                {selected === 'editor-video-subs' && (
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-white">✦ Editor complet</span>
                  {(hasGuion) && (
                    <span className="text-[9px] font-bold bg-blue-700/50 text-blue-200 border border-blue-600/40 px-1.5 py-0.5 rounded">
                      Recomanat
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Panell de guió, corrector automàtic i sincronització
                </p>
              </div>
            </div>
          </button>

          {/* Opció B: Editor bàsic */}
          <button
            onClick={() => setSelected('editor-srt-standalone')}
            className={`w-full text-left rounded-xl border p-3.5 transition-colors ${
              selected === 'editor-srt-standalone'
                ? 'border-gray-400/70 bg-gray-700/40'
                : 'border-gray-700 bg-gray-700/30 hover:bg-gray-700/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                selected === 'editor-srt-standalone' ? 'border-gray-300' : 'border-gray-500'
              }`}>
                {selected === 'editor-srt-standalone' && (
                  <div className="w-2 h-2 rounded-full bg-gray-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white">Editor bàsic</div>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Edició ràpida de subtítols sense panell de guió
                </p>
              </div>
            </div>
          </button>

          {/* Checkbox "Recordar" */}
          <label className="flex items-center gap-2.5 px-1 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-3.5 h-3.5 accent-blue-500"
            />
            <span className="text-[10px] text-gray-400">
              Recordar la meva elecció (es pot canviar des de Configuració)
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white bg-gray-700/50 hover:bg-gray-700 rounded-xl transition-colors"
          >
            Cancel·lar
          </button>
          <button
            onClick={handleOpen}
            className="px-5 py-2 text-xs font-black uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors"
          >
            Obrir
          </button>
        </div>
      </div>
    </div>
  );
};

export default SrtEditorModeModal;
