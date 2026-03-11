/**
 * TranscriptCorrectionModal.tsx
 *
 * Modal per corregir el text de la transcripció SRT usant el guió vinculat.
 *
 * Flux:
 *  1. L'usuari configura threshold i window
 *  2. Clic "Corregir" → crida backend POST /projects/:id/correct-transcript
 *  3. Es mostra previsualització de canvis (original vs corregit)
 *  4. L'usuari pot "Aplicar" (guarda) o "Descartar"
 */

import React, { useState, useCallback, useEffect } from 'react';
import { api } from '../../services/api';

// ─────────────────────── Tipus ────────────────────────────────────────────────

interface ChangeRecord {
  seg_idx: number;
  start: string;
  end: string;
  original: string;
  corrected: string;
  guion_speaker: string;
  guion_text: string;
  score: number;
  method: string;
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
  /** Cridat quan l'usuari aplica la correcció. Rep el SRT corregit. */
  onApply: (correctedSrt: string, changes: ChangeRecord[]) => void;
  hasGuion: boolean;
}

// ─────────────────────── Subcomponents ────────────────────────────────────────

const ScoreBar: React.FC<{ score: number }> = ({ score }) => {
  const pct = Math.round(score * 100);
  const color = score >= 0.75 ? 'bg-emerald-500' : score >= 0.55 ? 'bg-amber-500' : 'bg-orange-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] text-gray-500 w-7 text-right">{pct}%</span>
    </div>
  );
};

const DiffText: React.FC<{ original: string; corrected: string }> = ({ original, corrected }) => {
  if (original === corrected) return <span className="text-gray-400">{original}</span>;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-red-400/70 line-through text-[10px]">{original}</span>
      <span className="text-emerald-300 text-[11px]">{corrected}</span>
    </div>
  );
};

// ─────────────────────── Modal principal ──────────────────────────────────────

const TranscriptCorrectionModal: React.FC<TranscriptCorrectionModalProps> = ({
  isOpen,
  onClose,
  projectId,
  onApply,
  hasGuion,
}) => {
  const [threshold, setThreshold] = useState(0.45);
  const [window, setWindow] = useState(8);
  const [llmMode, setLlmMode] = useState<string>('off');
  const [llmModel, setLlmModel] = useState<string>('llama3.1');
  const [allowSplit, setAllowSplit] = useState(false);
  const [correctionOptions, setCorrectionOptions] = useState<CorrectionOptions | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CorrectionResult | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  // Carregar opcions del backend al muntar
  useEffect(() => {
    api.getCorrectionOptions().then(setCorrectionOptions).catch(() => {});
  }, []);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.correctTranscript(projectId, { threshold, window, llmMode, llmModel, allowSplit });
      setResult(res);
    } catch (e: any) {
      setError(e?.message || 'Error durant la correcció');
    } finally {
      setIsRunning(false);
    }
  }, [projectId, threshold, window, llmMode, llmModel]);

  const handleApply = useCallback(async () => {
    if (!result) return;
    setIsApplying(true);
    setError(null);
    try {
      await api.applyCorrectedSrt(projectId, result.correctedSrt);
      onApply(result.correctedSrt, result.changes);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Error aplicant la correcció');
    } finally {
      setIsApplying(false);
    }
  }, [result, projectId, onApply, onClose]);

  const handleClose = () => {
    if (isRunning || isApplying) return;
    setResult(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] p-4 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="bg-gray-800 border border-gray-700 rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Capçalera */}
        <div className="flex-shrink-0 p-5 bg-gray-900/50 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-tighter">
                Corregir Transcripció
              </h2>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                Usa el guió per corregir el text (preserva timecodes)
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="text-gray-500 hover:text-white transition-colors text-2xl leading-none">&times;</button>
        </div>

        {/* Cos */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">

          {/* Avís sense guió */}
          {!hasGuion && (
            <div className="m-4 p-4 bg-amber-900/30 border border-amber-700/50 rounded-xl text-amber-200 text-xs">
              No hi ha guió vinculat al projecte. Puja primer el guió (DOCX, RTF o TXT) al panell esquerre.
            </div>
          )}

          {/* Configuració */}
          {hasGuion && !result && (
            <div className="p-5 space-y-5">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                  Sensibilitat de correcció — {Math.round(threshold * 100)}%
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={0.2} max={0.9} step={0.05}
                    value={threshold}
                    onChange={(e) => setThreshold(parseFloat(e.target.value))}
                    className="flex-1 accent-blue-500"
                  />
                  <span className="text-[10px] font-mono text-gray-500 w-16 text-right whitespace-nowrap">
                    {threshold <= 0.35 ? 'agressiu' : threshold <= 0.55 ? 'equilibrat' : 'conservador'}
                  </span>
                </div>
                <p className="text-[9px] text-gray-600">
                  Quin % de paraules en comú cal entre la transcripció i el guió per acceptar una correcció.
                  <br/>
                  <span className="text-gray-500">
                    35–45% = corregeix quasi tot (pot errar en frases molt curtes) ·
                    55–70% = només corregeix coincidències clares · Recomanat: <b className="text-gray-400">40–50%</b>
                  </span>
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                  Línies del guió a comparar — ±{window}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={3} max={20} step={1}
                    value={window}
                    onChange={(e) => setWindow(parseInt(e.target.value, 10))}
                    className="flex-1 accent-blue-500"
                  />
                  <span className="text-[10px] font-mono text-gray-500 w-16 text-right whitespace-nowrap">
                    {window <= 5 ? 'precís' : window <= 10 ? 'normal' : 'ampli'}
                  </span>
                </div>
                <p className="text-[9px] text-gray-600">
                  Per cada subtítol, quantes línies del guió (cap endavant i enrere) es miren per trobar la millor coincidència.
                  <br/>
                  <span className="text-gray-500">
                    ±5 = guions ben alineats · ±8–12 = quan la transcripció s'ha saltat línies o reordenat · &gt;±15 = molt desordenat
                  </span>
                </p>
              </div>

              {/* LLM local (Ollama) */}
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                  Motor de correcció
                </label>
                <div className="flex flex-wrap gap-2">
                  {(correctionOptions?.llmModes || [
                    { value: 'off', label: 'Només fuzzy' },
                    { value: 'fast', label: 'LLM ambigus' },
                    { value: 'smart', label: 'LLM complet' },
                  ]).map((mode) => (
                    <button
                      key={mode.value}
                      onClick={() => setLlmMode(mode.value)}
                      className={`px-3 py-1 text-[10px] font-bold rounded-lg border transition-colors ${
                        llmMode === mode.value
                          ? 'bg-violet-700/60 border-violet-500/70 text-violet-200'
                          : 'bg-gray-700/40 border-gray-600/50 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {mode.value === 'off' ? '⚡ ' : '🤖 '}{mode.label}
                    </button>
                  ))}
                </div>
                {llmMode !== 'off' && (
                  <div className="flex items-center gap-3">
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
                    <span
                      className="text-[9px] text-amber-400/80 bg-amber-900/20 border border-amber-700/30 px-1.5 py-0.5 rounded whitespace-nowrap"
                      title="Requereix Ollama instal·lat i en marxa a http://127.0.0.1:11434"
                    >
                      Requereix Ollama
                    </span>
                  </div>
                )}
                {llmMode !== 'off' && (
                  <p className="text-[9px] text-gray-600">
                    {llmMode === 'fast'
                      ? 'LLM s\'activa quan el fuzzy matching és ambigu. Equilibri velocitat / qualitat.'
                      : 'LLM s\'aplica a tots els candidats. Màxima qualitat, però lent.'}
                  </p>
                )}
              </div>

              {/* Toggle divisió de personatges */}
              <div
                className={`p-3 rounded-xl border transition-colors cursor-pointer ${
                  allowSplit
                    ? 'bg-amber-900/20 border-amber-700/50'
                    : 'bg-gray-900/40 border-gray-700/50'
                }`}
                onClick={() => setAllowSplit((v) => !v)}
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className={`text-[9px] font-black uppercase tracking-widest ${allowSplit ? 'text-amber-400' : 'text-gray-400'}`}>
                      ✂ Dividir subtítols per canvi de personatge
                    </div>
                    <p className="text-[9px] text-gray-500">
                      Quan el transcriptor ha unit dues rèpliques de personatges DIFERENTS en un sol subtítol,
                      les separa en dos. Exemple: "Enduriment! Que?" → [RUFFY: "Enduriment!"] + [USOPP: "Que carai?"]
                    </p>
                    <p className="text-[9px] text-amber-600/80">
                      ⚠ Només divideix quan hi ha evidència acústica de les dues veus. Revisa el resultat.
                    </p>
                  </div>
                  <div className={`ml-3 flex-shrink-0 w-8 h-4 rounded-full transition-colors ${allowSplit ? 'bg-amber-500' : 'bg-gray-600'}`}>
                    <div className={`w-3.5 h-3.5 bg-white rounded-full mt-0.25 transition-transform ${allowSplit ? 'translate-x-4' : 'translate-x-0.5'}`} style={{ marginTop: '1px', transform: allowSplit ? 'translateX(17px)' : 'translateX(1px)' }} />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-gray-900/40 rounded-xl border border-gray-700/50 text-[9px] text-gray-500 space-y-1">
                <div className="font-bold text-gray-400 uppercase tracking-widest mb-1">Regles de correcció</div>
                <div>• <span className="text-gray-300">Mai s'eliminen línies</span> de la transcripció</div>
                <div>• {allowSplit ? <span className="text-amber-300">Pot crear línies noves</span> : <span className="text-gray-300">Mai s'afegeixen línies</span>} {allowSplit ? '(divisió per personatge activada)' : 'noves'}</div>
                <div>• Els <span className="text-gray-300">timecodes originals</span> es preserven sempre</div>
                <div>• Tots els canvis queden <span className="text-gray-300">registrats</span> per a revisió</div>
              </div>
            </div>
          )}

          {/* Resultat: previsualització de canvis */}
          {result && (
            <div className="p-5 space-y-4">
              {/* Resum */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total segments', value: result.summary.totalSegments, color: 'text-gray-300' },
                  { label: 'Modificats', value: result.summary.changed, color: 'text-blue-300' },
                  { label: 'Sense canvis', value: result.summary.unchanged, color: 'text-gray-500' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-gray-900/50 rounded-xl p-3 text-center border border-gray-700/50">
                    <div className={`text-2xl font-black ${color}`}>{value}</div>
                    <div className="text-[9px] uppercase tracking-widest text-gray-600 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>

              {/* Llista de canvis */}
              {result.changes.length === 0 ? (
                <div className="text-center py-8 text-gray-600 text-sm">
                  Cap canvi detectat. Prova un threshold més baix.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-gray-500">
                    Previsualització de canvis ({result.changes.length})
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                    {result.changes.map((c) => (
                      <div
                        key={c.seg_idx}
                        className="bg-gray-900/60 border border-gray-700/40 rounded-xl p-3 space-y-1.5"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[9px] font-mono text-gray-600">#{c.seg_idx}</span>
                          <span className="text-[9px] font-mono text-gray-600">{c.start} → {c.end}</span>
                          <span className="text-[9px] text-blue-400/70 bg-blue-900/20 px-1.5 py-0.5 rounded">
                            {c.guion_speaker}
                          </span>
                          {c.method?.startsWith('llm_') && (
                            <span className="text-[9px] text-violet-400/80 bg-violet-900/20 px-1.5 py-0.5 rounded">
                              🤖 LLM
                            </span>
                          )}
                          <div className="flex-1 min-w-[60px]">
                            <ScoreBar score={c.score} />
                          </div>
                        </div>
                        <DiffText original={c.original} corrected={c.corrected} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mx-5 mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-xl text-red-300 text-xs">
              {error}
            </div>
          )}
        </div>

        {/* Footer amb botons */}
        <div className="flex-shrink-0 p-4 bg-gray-900/30 border-t border-gray-700 flex items-center justify-between gap-3">
          <button
            onClick={handleClose}
            disabled={isRunning || isApplying}
            className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white bg-gray-700/50 hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-40"
          >
            {result ? 'Descartar' : 'Cancel·lar'}
          </button>

          {!result && hasGuion && (
            <button
              onClick={handleRun}
              disabled={isRunning}
              className="px-5 py-2 text-xs font-black uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isRunning ? (
                <>
                  <span className="animate-spin inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full" />
                  Corregint…
                </>
              ) : (
                'Corregir Transcripció'
              )}
            </button>
          )}

          {result && (
            <>
              <button
                onClick={() => { setResult(null); setError(null); }}
                disabled={isApplying}
                className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white bg-gray-700/50 hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-40"
              >
                Tornar a configurar
              </button>
              <button
                onClick={handleApply}
                disabled={isApplying || result.changes.length === 0}
                className="px-5 py-2 text-xs font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isApplying ? (
                  <>
                    <span className="animate-spin inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full" />
                    Aplicant…
                  </>
                ) : (
                  `Aplicar ${result.changes.length} canvi${result.changes.length !== 1 ? 's' : ''}`
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TranscriptCorrectionModal;
export type { ChangeRecord };
