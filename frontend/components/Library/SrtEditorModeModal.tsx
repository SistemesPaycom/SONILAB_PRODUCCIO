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
        className="rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        style={{ backgroundColor: 'var(--th-bg-surface)', border: '1px solid var(--th-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Capçalera */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-tighter" style={{ color: 'var(--th-text-primary)' }}>
            Obrir SRT amb…
          </h2>
          <button
            onClick={onClose}
            className="transition-colors text-xl leading-none"
            style={{ color: 'var(--th-text-muted)' }}
          >
            &times;
          </button>
        </div>

        {/* Opcions */}
        <div className="px-4 pb-4 space-y-2">
          {/* Opció A: Editor complet */}
          <button
            onClick={() => setSelected('editor-video-subs')}
            className="w-full text-left rounded-xl border p-3.5 transition-colors"
            style={selected === 'editor-video-subs'
              ? { borderColor: 'var(--th-accent)', backgroundColor: 'var(--th-accent-muted)' }
              : { borderColor: 'var(--th-border)', backgroundColor: 'var(--th-bg-hover)' }
            }
          >
            <div className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                style={selected === 'editor-video-subs'
                  ? { borderColor: 'var(--th-accent)' }
                  : { borderColor: 'var(--th-text-disabled)' }
                }
              >
                {selected === 'editor-video-subs' && (
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--th-accent)' }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold" style={{ color: 'var(--th-text-primary)' }}>✦ Editor complet</span>
                  {(hasGuion) && (
                    <span className="text-[9px] font-bold border px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--th-accent-muted)', color: 'var(--th-accent-text)', borderColor: 'var(--th-accent)' }}>
                      Recomanat
                    </span>
                  )}
                </div>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--th-text-muted)' }}>
                  Panell de guió, corrector automàtic i sincronització
                </p>
              </div>
            </div>
          </button>

          {/* Opció B: Editor bàsic */}
          <button
            onClick={() => setSelected('editor-srt-standalone')}
            className="w-full text-left rounded-xl border p-3.5 transition-colors"
            style={selected === 'editor-srt-standalone'
              ? { borderColor: 'var(--th-accent)', backgroundColor: 'var(--th-accent-muted)' }
              : { borderColor: 'var(--th-border)', backgroundColor: 'var(--th-bg-hover)' }
            }
          >
            <div className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                style={selected === 'editor-srt-standalone'
                  ? { borderColor: 'var(--th-accent)' }
                  : { borderColor: 'var(--th-text-disabled)' }
                }
              >
                {selected === 'editor-srt-standalone' && (
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--th-accent)' }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold" style={{ color: 'var(--th-text-primary)' }}>Editor bàsic</div>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--th-text-muted)' }}>
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
              className="w-3.5 h-3.5"
              style={{ accentColor: 'var(--th-accent)' }}
            />
            <span className="text-[10px]" style={{ color: 'var(--th-text-muted)' }}>
              Recordar la meva elecció (es pot canviar des de Configuració)
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl transition-colors"
            style={{ color: 'var(--th-text-muted)', backgroundColor: 'var(--th-bg-hover)' }}
          >
            Cancel·lar
          </button>
          <button
            onClick={handleOpen}
            className="px-5 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-colors"
            style={{ backgroundColor: 'var(--th-btn-primary-bg)', color: 'var(--th-btn-primary-text)' }}
          >
            Obrir
          </button>
        </div>
      </div>
    </div>
  );
};

export default SrtEditorModeModal;
