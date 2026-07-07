/**
 * TranscriptCorrectionModal.tsx
 *
 * Modal per configurar i llançar la correcció de transcripció amb guió.
 * FLUX NOU (inline review):
 *   1. L'usuari configura el mètode i opcions
 *   2. Clic "Corregir" → crida backend POST /projects/:id/correct-transcript
 *   3. En rebre el resultat, crida onCorrectionReady(result) i tanca el modal
 *   4. El pare (VideoSubtitlesEditorView) presenta les correccions inline
 *      a l'editor SRT, on l'usuari pot acceptar/rebutjar cada canvi per separat.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { api } from '../../services/api';

// ─────────────────────── Tipus ────────────────────────────────────────────────

interface ChangeRecord {
  seg_idx: number;   // -1 per a propose_new_cue
  start: string;
  end: string;
  original: string;
  corrected: string;
  guion_speaker: string;
  guion_text: string;
  score: number;
  method: string;
  take_num?: number;
  // Camps nous (Phase 3 - LLM àrbitre local)
  action?: string;   // "no_change"|"replace_existing"|"rebalance_with_prev"|"rebalance_with_next"|"propose_new_cue"
  proposed_after_seg_idx?: number;  // Per a propose_new_cue: inserir DESPRÉS d'aquest seg_idx
}

interface CorrectionResult {
  correctedSrt: string;
  changes: ChangeRecord[];
  summary: { totalSegments: number; changed: number; unchanged: number };
}

interface LlmOption { value: string; label: string; }

interface CorrectionOptions {
  llmModes: LlmOption[];
  llmModels: LlmOption[];
  defaults: { llmMode: string; llmModel: string; threshold: number; window: number };
}

interface TranscriptCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  /** Cridat amb el resultat quan la correcció s'ha completat (per revisió inline) */
  onCorrectionReady: (result: CorrectionResult) => void;
  hasGuion: boolean;
}

// ─────────────────────── Modal principal ──────────────────────────────────────

const TranscriptCorrectionModal: React.FC<TranscriptCorrectionModalProps> = ({
  isOpen,
  onClose,
  projectId,
  onCorrectionReady,
  hasGuion,
}) => {
  const [method, setMethod] = useState<'fuzzy' | 'take-llm'>('fuzzy');
  const [llmModel, setLlmModel] = useState<string>('llama3.1');
  const [allowSplit, setAllowSplit] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [threshold, setThreshold] = useState(0.45);
  const [windowSize, setWindowSize] = useState(8);
  const [correctionOptions, setCorrectionOptions] = useState<CorrectionOptions | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getCorrectionOptions().then(setCorrectionOptions).catch(() => {});
  }, []);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    try {
      const res = await api.correctTranscript(projectId, {
        threshold,
        window: windowSize,
        llmMode: 'off',
        llmModel,
        allowSplit,
        method,
      });
      // Passar el resultat al pare per a revisió inline i tancar el modal
      onCorrectionReady(res);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Error durant la correcció');
    } finally {
      setIsRunning(false);
    }
  }, [projectId, threshold, windowSize, llmModel, allowSplit, method, onCorrectionReady, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] p-4 backdrop-blur-sm"
      onClick={() => { if (!isRunning) onClose(); }}
    >
      <div
        className="bg-gray-800 border border-gray-700 rounded-3xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Capçalera */}
        <div className="flex-shrink-0 p-5 bg-gray-900/50 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ backgroundColor: 'var(--th-accent-muted)', color: 'var(--th-accent-text)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-tighter">
                Corregir Transcripció
              </h2>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                Les correccions apareixeran directament a l'editor per revisar-les
              </p>
            </div>
          </div>
          <button onClick={() => { if (!isRunning) onClose(); }} className="text-gray-500 hover:text-white transition-colors text-2xl leading-none">&times;</button>
        </div>

        {/* Cos */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {!hasGuion && (
            <div className="m-4 p-4 bg-amber-900/30 border border-amber-700/50 rounded-xl text-amber-200 text-xs">
              No hi ha guió vinculat al projecte. Puja primer el guió (DOCX, RTF o TXT) al panell esquerre.
            </div>
          )}

          {hasGuion && (
            <div className="p-5 space-y-4">
              {/* Selecció de mètode */}
              <div className="space-y-2">
                <div className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                  Mètode de correcció
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setMethod('fuzzy')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      method === 'fuzzy'
                        ? 'text-white'
                        : 'bg-gray-900/40 border-gray-700/50 text-gray-400 hover:border-gray-500/60 hover:text-gray-200'
                    }`}
                    style={method === 'fuzzy' ? { backgroundColor: 'var(--th-accent-muted)', borderColor: 'var(--th-accent)' } : undefined}
                  >
                    <div className="text-lg mb-1">⚡</div>
                    <div className="text-[11px] font-black uppercase tracking-tight">Fuzzy</div>
                    <div className="text-[9px] mt-0.5 opacity-70">Ràpid · Compara paraula a paraula · Sense IA</div>
                  </button>
                  <button
                    onClick={() => setMethod('take-llm')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      method === 'take-llm'
                        ? 'bg-violet-900/30 border-violet-500/60 text-white'
                        : 'bg-gray-900/40 border-gray-700/50 text-gray-400 hover:border-gray-500/60 hover:text-gray-200'
                    }`}
                  >
                    <div className="text-lg mb-1">🤖</div>
                    <div className="text-[11px] font-black uppercase tracking-tight flex items-center gap-1.5">
                      IA per TAKE
                      <span className="text-[8px] font-bold bg-violet-700/60 text-violet-200 px-1.5 py-0.5 rounded uppercase tracking-widest">Recomanat</span>
                    </div>
                    <div className="text-[9px] mt-0.5 opacity-70">LLM veu tot el TAKE · Redistribueix diàlegs</div>
                  </button>
                </div>

                {method === 'take-llm' && (
                  <div className="space-y-1.5">
                    <p className="text-[9px] text-gray-500 px-1">
                      Envia el guió oficial de cada TAKE + els subtítols al LLM (Ollama local), que els corregeix i pot redistribuir diàlegs entre subtítols propers quan Whisper els ha barrejat.
                    </p>
                    <div className="flex items-center gap-3 px-1">
                      <select
                        value={llmModel}
                        onChange={(e) => setLlmModel(e.target.value)}
                        className="flex-1 bg-gray-900/60 border border-gray-700 rounded-lg text-xs text-gray-200 px-2 py-1 focus:outline-none focus:border-violet-500"
                      >
                        {(correctionOptions?.llmModels || [
                          { value: 'llama3.1', label: 'Llama 3.1 8B (recomanat)' },
                          { value: 'qwen2.5', label: 'Qwen 2.5 7B' },
                          { value: 'mistral', label: 'Mistral 7B' },
                        ]).map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                      <span className="text-[9px] text-amber-400/80 bg-amber-900/20 border border-amber-700/30 px-1.5 py-0.5 rounded whitespace-nowrap" title="Requereix Ollama instal·lat i en marxa a http://127.0.0.1:11434">
                        Requereix Ollama
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Toggle divisió de personatges */}
              <div
                className={`p-3 rounded-xl border transition-colors cursor-pointer ${allowSplit ? 'bg-amber-900/20 border-amber-700/50' : 'bg-gray-900/40 border-gray-700/50'}`}
                onClick={() => setAllowSplit((v) => !v)}
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className={`text-[9px] font-black uppercase tracking-widest ${allowSplit ? 'text-amber-400' : 'text-gray-400'}`}>
                      ✂ Dividir subtítols per canvi de personatge
                    </div>
                    <p className="text-[9px] text-gray-500">Separa en dos un subtítol que conté veus de dos personatges DIFERENTS.</p>
                  </div>
                  <div className={`ml-3 flex-shrink-0 w-8 h-4 rounded-full transition-colors ${allowSplit ? 'bg-amber-500' : 'bg-gray-600'}`}>
                    <div className="w-3.5 h-3.5 bg-white rounded-full" style={{ marginTop: '1px', transform: allowSplit ? 'translateX(17px)' : 'translateX(1px)', transition: 'transform 0.15s' }} />
                  </div>
                </div>
              </div>

              {/* Opcions avançades (fuzzy) */}
              {method === 'fuzzy' && (
                <div>
                  <button
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <span className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>▶</span>
                    Opcions avançades
                  </button>
                  {showAdvanced && (
                    <div className="mt-3 space-y-4 pl-3 border-l border-gray-700/50">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">Sensibilitat — {Math.round(threshold * 100)}%</label>
                        <div className="flex items-center gap-3">
                          <input type="range" min={0.2} max={0.9} step={0.05} value={threshold} onChange={(e) => setThreshold(parseFloat(e.target.value))} className="flex-1 accent-current" />
                          <span className="text-[10px] font-mono text-gray-500 w-16 text-right whitespace-nowrap">{threshold <= 0.35 ? 'agressiu' : threshold <= 0.55 ? 'equilibrat' : 'conservador'}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">Finestra de cerca — ±{windowSize}</label>
                        <div className="flex items-center gap-3">
                          <input type="range" min={3} max={20} step={1} value={windowSize} onChange={(e) => setWindowSize(parseInt(e.target.value, 10))} className="flex-1 accent-current" />
                          <span className="text-[10px] font-mono text-gray-500 w-16 text-right whitespace-nowrap">{windowSize <= 5 ? 'precís' : windowSize <= 10 ? 'normal' : 'ampli'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Info inline review */}
              <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-700/30 text-[9px] text-gray-400 space-y-1">
                <div className="font-bold text-gray-300 uppercase tracking-widest mb-1">📋 Revisió inline</div>
                <div>• Les correccions <span className="text-amber-300">s'aplicaran directament</span> a l'editor</div>
                <div>• Cada canvi mostrarà el text proposat en <span className="text-amber-300">groc/amber</span></div>
                <div>• Podràs <span className="text-emerald-400">acceptar ✓</span> o <span className="text-red-400">rebutjar ✗</span> cada subtítol individualment</div>
                <div>• Els timecodes originals <span className="text-gray-300">es preserven sempre</span></div>
              </div>
            </div>
          )}

          {error && (
            <div className="mx-5 mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-xl text-red-300 text-xs">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-4 bg-gray-900/30 border-t border-gray-700 flex items-center justify-between gap-3">
          <button
            onClick={() => { if (!isRunning) onClose(); }}
            disabled={isRunning}
            className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white bg-gray-700/50 hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-40"
          >
            Cancel·lar
          </button>

          {hasGuion && (
            <button
              onClick={handleRun}
              disabled={isRunning}
              className="px-5 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
              style={{ backgroundColor: 'var(--th-btn-primary-bg)', color: 'var(--th-btn-primary-text)' }}
            >
              {isRunning ? (
                <>
                  <span className="animate-spin inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full" />
                  Corregint…
                </>
              ) : (
                'Corregir i Revisar Inline'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TranscriptCorrectionModal;
export type { ChangeRecord, CorrectionResult };
