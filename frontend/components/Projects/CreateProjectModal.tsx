import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../services/api';
import { useLibrary } from '../../context/Library/SonilabLibraryContext';
import { useUploadContext } from '../../context/Upload/UploadContext';
import type { Document, OpenMode, WhisperConfig } from '../../appTypes';
import { importStructuredScriptFromFile } from '../../utils/Import/scriptImportPipeline';

// ─── Constants ──────────────────────────────────────────────────────────────

const MEDIA_EXTS = ['mp4', 'mov', 'webm', 'wav', 'mp3', 'ogg', 'm4a'];

const FACTORY_PRESETS: Record<string, WhisperConfig> = {
  VE: {
    engine: 'purfview-xxl', model: 'large-v3', language: 'es',
    batchSize: 16, device: 'cpu', timingFix: true,
    diarization: false, minSubGapMs: 160, enforceMinSubGap: true,
  },
  VCAT: {
    engine: 'purfview-xxl', model: 'large-v3', language: 'ca',
    batchSize: 16, device: 'cpu', timingFix: true,
    diarization: false, minSubGapMs: 160, enforceMinSubGap: true,
  },
};

const MODEL_LABELS: Record<string, string> = {
  tiny: 'tiny — muy rápido, menor precisión',
  base: 'base — rápido',
  small: 'small — equilibrado',
  medium: 'medium — buena calidad',
  'large-v2': 'large-v2 — alta calidad',
  'large-v3': 'large-v3 — mejor calidad',
  'large-v3-turbo': 'large-v3-turbo — rápido y alta calidad',
};

const ENGINE_LABELS: Record<string, string> = {
  'faster-whisper': 'faster-whisper — timestamps nativos',
  'purfview-xxl': 'Purfview XXL — + post-procesado',
  'whisperx': 'whisperx — alineación externa',
  'script-align': 'Script-Align — alineación con guion (máxima calidad)',
};

// isCanonicalMedia — definició canònica (CLAUDE.md §4)
function isCanonicalMedia(d: Document): boolean {
  return d.type === 'document' && !!d.media && !d.refTargetId;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const CreateProjectModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onOpenDocument: (docId: string | null, mode: OpenMode | null, edit: boolean) => void;
  parentFolderId?: string | null;
}> = ({ open, onClose, onOpenDocument, parentFolderId }) => {
  const { state, reloadTree, dispatch } = useLibrary();
  const { addJob, updateJob, completeJob, registerAbort } = useUploadContext();

  // ─── Tab ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'transcribe' | 'importSrt'>('transcribe');

  // ─── Derived ──────────────────────────────────────────────────────────────
  const mediaDocs = useMemo(
    () => state.documents.filter((d) => isCanonicalMedia(d) && !d.isDeleted),
    [state.documents],
  );
  const srtDocs = useMemo(
    () => state.documents.filter(
      (d) => (d.sourceType || '').toLowerCase() === 'srt' && !d.isDeleted && !d.refTargetId,
    ),
    [state.documents],
  );

  // ─── Common fields ────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [mediaId, setMediaId] = useState('');

  // ─── Whisper config ───────────────────────────────────────────────────────
  const [options, setOptions] = useState<any>(null);
  const [profile, setProfile] = useState('VE');
  const [userPresets, setUserPresets] = useState<Record<string, WhisperConfig>>({});
  const [engine, setEngine] = useState('purfview-xxl');
  const [model, setModel] = useState('large-v3');
  const [language, setLanguage] = useState('es');
  const [device, setDevice] = useState<'cpu' | 'cuda'>('cpu');
  const [batchSize, setBatchSize] = useState(16);
  const [timingFix, setTimingFix] = useState(true);
  const [diarization, setDiarization] = useState(false);
  const [numSpeakers, setNumSpeakers] = useState<number | 'auto'>('auto');
  const [minSubGapMs, setMinSubGapMs] = useState(160);
  const [enforceMinSubGap, setEnforceMinSubGap] = useState(true);

  // ─── Advanced section ─────────────────────────────────────────────────────
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [savePresetName, setSavePresetName] = useState('');
  const [savePresetError, setSavePresetError] = useState<string | null>(null);

  // ─── Script-Align ─────────────────────────────────────────────────────────
  const [scriptText, setScriptText] = useState('');
  const [scriptFile, setScriptFile] = useState<File | null>(null);

  // ─── Guió del projecte (opcional) ─────────────────────────────────────────
  const [guionFile, setGuionFile] = useState<File | null>(null);
  const [guionPreviewText, setGuionPreviewText] = useState('');
  const [guionConverting, setGuionConverting] = useState(false);
  const [guionConvertErr, setGuionConvertErr] = useState<string | null>(null);
  const guionConvertedRef = useRef<{ content: string; fileName: string } | null>(null);

  // ─── Import SRT tab ───────────────────────────────────────────────────────
  const [srtDocId, setSrtDocId] = useState('');
  const [deleteOriginalSrt, setDeleteOriginalSrt] = useState(true);
  const [srtFile, setSrtFile] = useState<File | null>(null);

  // ─── Progress / job ───────────────────────────────────────────────────────
  const [busy, setBusy] = useState(false);
  const [jobProgress, setJobProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  // ─── Reset on open ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setBusy(false);
    setErr(null);
    setJobProgress(0);
    setSrtDocId('');
    setDeleteOriginalSrt(true);
    setAdvancedOpen(false);
    setSavePresetOpen(false);
    setSavePresetError(null);
    setSavePresetName('');
    setSrtFile(null);  // sync reset — must be outside async block
    setGuionFile(null);
    setGuionPreviewText('');
    setGuionConverting(false);
    setGuionConvertErr(null);
    guionConvertedRef.current = null;

    void (async () => {
      try {
        const [opt, presets] = await Promise.all([
          api.transcriptionOptions(),
          api.getWhisperPresets(),
        ]);
        setUserPresets(presets ?? {});
        setOptions(opt);

        // Apply default profile using freshly loaded presets
        const allPresets = { ...FACTORY_PRESETS, ...(presets ?? {}) };
        const defaultProfileName: string = opt?.defaults?.profile || 'VE';
        const defaultPreset = allPresets[defaultProfileName];
        if (defaultPreset) {
          setProfile(defaultProfileName);
          setEngine(defaultPreset.engine);
          setModel(defaultPreset.model);
          setLanguage(defaultPreset.language);
          setBatchSize(defaultPreset.batchSize);
          setDevice(defaultPreset.device);
          setTimingFix(defaultPreset.timingFix);
          setDiarization(defaultPreset.diarization);
          setMinSubGapMs(defaultPreset.minSubGapMs);
          setEnforceMinSubGap(defaultPreset.enforceMinSubGap);
          if (!defaultPreset.diarization) setNumSpeakers('auto');
        } else {
          // Fallback to raw backend defaults if profile not in presets
          const d = opt?.defaults || {};
          setModel(d.model || 'large-v3');
          setEngine(d.engine || 'purfview-xxl');
          setProfile(defaultProfileName);
          setLanguage(d.language || 'es');
          setDevice((d.device || 'cpu') as any);
          setBatchSize(Number(d.batchSize || 16));
          setDiarization(!!d.diarization);
          setTimingFix(d.timingFix !== false);
          setMinSubGapMs(d.minSubGapMs != null ? Number(d.minSubGapMs) : 160);
          setEnforceMinSubGap(d.enforceMinSubGap !== false);
        }
      } catch (e) {
        console.warn('[CreateProjectModal] Failed to load options/presets:', e);
      }
    })();
  }, [open]);

  // ─── Custom detection ─────────────────────────────────────────────────────
  useEffect(() => {
    if (profile === 'custom') return;
    const allPresets = { ...FACTORY_PRESETS, ...userPresets };
    const current = allPresets[profile];
    if (!current) return;
    const changed =
      engine !== current.engine ||
      model !== current.model ||
      language !== current.language ||
      batchSize !== current.batchSize ||
      device !== current.device ||
      timingFix !== current.timingFix ||
      diarization !== current.diarization ||
      minSubGapMs !== current.minSubGapMs ||
      enforceMinSubGap !== current.enforceMinSubGap;
    if (changed) setProfile('custom');
  }, [engine, model, language, batchSize, device, timingFix, diarization, minSubGapMs, enforceMinSubGap]);

  if (!open) return null;

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const applyPreset = (name: string) => {
    const allPresets = { ...FACTORY_PRESETS, ...userPresets };
    const p = allPresets[name];
    if (!p) return;
    setProfile(name);
    setEngine(p.engine);
    setModel(p.model);
    setLanguage(p.language);
    setBatchSize(p.batchSize);
    setDevice(p.device);
    setTimingFix(p.timingFix);
    setDiarization(p.diarization);
    setMinSubGapMs(p.minSubGapMs);
    setEnforceMinSubGap(p.enforceMinSubGap);
    if (!p.diarization) setNumSpeakers('auto');
  };

  const handleSavePreset = async () => {
    const trimmed = savePresetName.trim();
    if (!trimmed) { setSavePresetError('El nom no pot ser buit'); return; }
    if (['ve', 'vcat'].includes(trimmed.toLowerCase())) {
      setSavePresetError('Aquest nom és reservat (preset de fàbrica)');
      return;
    }
    const currentConfig: WhisperConfig = {
      engine, model, language, batchSize, device,
      timingFix, diarization, minSubGapMs, enforceMinSubGap,
    };
    try {
      await api.saveWhisperPreset(trimmed, currentConfig);
      setUserPresets((prev) => ({ ...prev, [trimmed]: currentConfig }));
      setProfile(trimmed);
      setSavePresetOpen(false);
      setSavePresetName('');
      setSavePresetError(null);
    } catch (e: any) {
      setSavePresetError(e?.message || 'Error guardant el preset');
    }
  };

  const handleScriptFileChange = (file: File) => {
    setScriptFile(file);
    void file.text().then((text) => setScriptText(text));
  };

  const handleGuionFileChange = (file: File) => {
    setGuionFile(file);
    setGuionPreviewText('');
    setGuionConvertErr(null);
    guionConvertedRef.current = null;
    setGuionConverting(true);
    void importStructuredScriptFromFile(file)
      .then((result) => {
        guionConvertedRef.current = { content: result.content, fileName: result.fileName };
        setGuionPreviewText(result.content.slice(0, 300));
        setGuionConverting(false);
      })
      .catch((err: Error) => {
        setGuionConvertErr(err?.message || 'Error convertint el guió');
        setGuionConverting(false);
      });
  };

  const uploadGuionToProject = async (projectId: string) => {
    if (!guionFile) return;
    const preConverted = guionConvertedRef.current;
    if (preConverted) {
      await api.setProjectGuion(projectId, preConverted.content, preConverted.fileName);
    } else {
      const result = await importStructuredScriptFromFile(guionFile);
      await api.setProjectGuion(projectId, result.content, result.fileName);
    }
  };

  const handleUploadNewMedia = (file: File) => {
    void (async () => {
      setErr(null);
      setBusy(true);
      const jobId = crypto.randomUUID();
      addJob(jobId, file.name);
      try {
        const { promise: uploadPromise, abort: uploadAbort } = api.uploadMedia(
          file, (pct) => updateJob(jobId, pct),
        );
        registerAbort(jobId, uploadAbort);
        const r = await uploadPromise;
        completeJob(jobId, true);
        const newId = r?.document?.id;
        if (newId) setMediaId(newId);
        try {
          await reloadTree();
        } catch (treeErr) {
          console.warn('[handleUploadNewMedia] reloadTree failed (non-fatal):', treeErr);
        }
      } catch (e: any) {
        completeJob(jobId, false, e?.message || 'Error subiendo vídeo');
        setErr(e?.message || 'Error subiendo vídeo');
      } finally {
        setBusy(false);
      }
    })();
  };

  const settings = {
    model, engine, profile, language, batchSize, device,
    diarization, offline: false, timingFix, minSubGapMs, enforceMinSubGap,
    ...(engine === 'script-align' && scriptText.trim() ? { scriptText: scriptText.trim() } : {}),
    ...(diarization && numSpeakers !== 'auto'
      ? { minSpeakers: numSpeakers, maxSpeakers: numSpeakers }
      : {}),
  };

  // ─── Submit handlers ──────────────────────────────────────────────────────

  const createByTranscribe = () => {
    void (async () => {
      setErr(null);
      if (!name.trim()) return setErr('Falta el nombre del proyecto');
      if (!mediaId) return setErr('Selecciona un vídeo');
      if (engine === 'script-align' && !scriptText.trim())
        return setErr('Script-Align requiere el texto del guion');

      setBusy(true);
      try {
        const res = await api.createProject({
          name: name.trim(),
          mediaDocumentId: mediaId,
          settings,
          ...(parentFolderId ? { parentFolderId } : {}),
        });

        const jobId = res?.job?.id;
        const newSrtDocId = res?.srtDocument?.id;
        const mediaDocId = res?.project?.mediaDocumentId || mediaId;
        if (!jobId || !newSrtDocId) throw new Error('Respuesta inválida al crear proyecto');

        dispatch({
          type: 'ADD_TRANSCRIPTION_TASK',
          payload: {
            id: jobId,
            projectId: res.project.id,
            projectName: name.trim(),
            srtDocumentId: newSrtDocId,
            mediaDocumentId: mediaDocId,
            status: res.job.status,
            progress: Number(res.job.progress || 0),
            error: null,
            timestamp: new Date().toISOString(),
          },
        });

        if (guionFile) {
          uploadGuionToProject(res.project.id).catch((e) => {
            console.warn('Guion upload failed (non-fatal):', e);
          });
        }

        await reloadTree();
        onClose();
      } catch (e: any) {
        setErr(e?.message || 'Error creando proyecto');
      } finally {
        setBusy(false);
      }
    })();
  };

  const createFromExistingSrt = () => {
    void (async () => {
      setErr(null);
      if (!name.trim()) return setErr('Falta el nombre del proyecto');
      if (!mediaId) return setErr('Selecciona un vídeo');
      if (!srtDocId && !srtFile) return setErr('Selecciona o importa un arxiu SRT');

      setBusy(true);
      try {
        const payload = srtDocId
          ? { name: name.trim(), mediaDocumentId: mediaId, sourceSrtDocumentId: srtDocId, deleteOriginalSrt, settings: {}, ...(parentFolderId ? { parentFolderId } : {}) }
          : { name: name.trim(), mediaDocumentId: mediaId, srtText: await srtFile!.text(), settings: {}, ...(parentFolderId ? { parentFolderId } : {}) };

        const res = await api.createProjectFromExisting(payload);

        const newSrtDocId = res?.srtDocument?.id;
        if (!newSrtDocId) throw new Error('Respuesta inválida al importar SRT');

        if (guionFile && res.project?.id) {
          await uploadGuionToProject(res.project.id).catch((e) => {
            console.warn('Guion upload failed (non-fatal):', e);
          });
        }

        await reloadTree();
        onClose();

        if (guionFile && newSrtDocId) {
          onOpenDocument(newSrtDocId, 'editor-video-subs' as any, true);
        }
      } catch (e: any) {
        setErr(e?.message || 'Error importando SRT');
      } finally {
        setBusy(false);
      }
    })();
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const userPresetKeys = Object.keys(userPresets);
  const isDeleteOriginalEnabled = !!srtDocId;  // only active when platform SRT selected

  return (
    <div
      className="fixed inset-0 z-[900] bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <style>{`
        .cpmodal select {
          -webkit-appearance: none;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%239ca3af'%3E%3Cpath fill-rule='evenodd' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' clip-rule='evenodd'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 8px center;
          background-size: 16px 16px;
          padding-right: 2rem;
        }
      `}</style>
      <div
        className="cpmodal w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-2xl px-7 py-6 flex flex-col min-h-[420px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-black text-white">Crear proyecto</h2>
            <div className="flex gap-1.5">
              <button
                className={`px-2.5 py-1 rounded-md text-xs font-bold ${tab === 'transcribe' ? 'text-white' : 'bg-gray-800 text-gray-300'}`}
                style={tab === 'transcribe' ? { backgroundColor: 'var(--th-accent)' } : undefined}
                onClick={() => setTab('transcribe')}
              >
                Transcribir
              </button>
              <button
                className={`px-2.5 py-1 rounded-md text-xs font-bold ${tab === 'importSrt' ? 'text-white' : 'bg-gray-800 text-gray-300'}`}
                style={tab === 'importSrt' ? { backgroundColor: 'var(--th-accent)' } : undefined}
                onClick={() => setTab('importSrt')}
              >
                Importar SRT
              </button>
            </div>
          </div>
          <button
            className="text-gray-400 hover:text-white text-2xl leading-none"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {/* ── 2-column grid ── */}
        <div className="grid grid-cols-2 gap-4 mb-3">
          {/* Left column */}
          <div className="space-y-3 min-w-0">
            {/* Nombre */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Nombre</div>
              <input
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Proyecto 01"
              />
            </div>

            {/* Left col 2nd field — tab dependent */}
            {tab === 'transcribe' ? (
              /* Perfil Whisper */
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Perfil Whisper</div>
                <select
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-sm"
                  value={profile}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val !== 'custom') applyPreset(val);
                  }}
                >
                  <option value="VE">VE</option>
                  <option value="VCAT">VCAT</option>
                  {userPresetKeys.length > 0 && (
                    <option disabled value="">──────────</option>
                  )}
                  {userPresetKeys.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                  {profile === 'custom' && (
                    <option value="custom" disabled style={{ fontStyle: 'italic' }}>
                      (custom)
                    </option>
                  )}
                </select>
              </div>
            ) : (
              /* Arxiu SRT */
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Arxiu SRT</div>
                <div className="flex gap-2 items-center">
                  {srtFile ? (
                    /* External file selected — show filename badge */
                    <div className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-green-400 text-xs font-mono truncate">
                      📂 {srtFile.name}
                    </div>
                  ) : (
                    /* Platform SRT dropdown */
                    <select
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm"
                      style={{ color: srtDocId ? 'var(--us-home-cpmodal-select-color, #ffffff)' : '#6b7280' }}
                      value={srtDocId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setSrtDocId(id);
                        if (id) {
                          setDeleteOriginalSrt(true);
                          setSrtFile(null);
                        }
                      }}
                    >
                      <option value="">Selecciona SRT...</option>
                      {srtDocs.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  )}
                  {/* Upload external SRT button */}
                  <label
                    className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white cursor-pointer text-base"
                    title="Importar fitxer SRT extern"
                  >
                    <input
                      type="file"
                      accept=".srt"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setSrtFile(f);
                          setSrtDocId('');
                          setDeleteOriginalSrt(false);
                        }
                        e.currentTarget.value = '';
                      }}
                    />
                    ↑
                  </label>
                  {/* Clear external file */}
                  {srtFile && (
                    <button
                      className="text-xs text-gray-500 hover:text-red-400"
                      onClick={() => { setSrtFile(null); setDeleteOriginalSrt(true); }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-3 min-w-0">
            {/* Vídeo / Audio */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Vídeo / Audio</div>
              <div className="flex gap-2 items-center min-w-0">
                <select
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm"
                  style={{ color: mediaId ? 'var(--us-home-cpmodal-select-color, #ffffff)' : '#6b7280' }}
                  value={mediaId}
                  onChange={(e) => setMediaId(e.target.value)}
                >
                  <option value="">Selecciona...</option>
                  {mediaDocs.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <label
                  className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white cursor-pointer text-base"
                  title="Importar fitxer de vídeo/àudio"
                >
                  <input
                    type="file"
                    accept={MEDIA_EXTS.map((x) => `.${x}`).join(',')}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadNewMedia(f);
                      e.currentTarget.value = '';
                    }}
                  />
                  ↑
                </label>
              </div>
            </div>

            {/* Guió (opcional) */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">
                Guió <span className="font-normal text-gray-500">(opcional)</span>
              </div>
              <div className="flex gap-2 items-center">
                <div
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs truncate"
                  style={{ color: guionFile ? '#34d399' : '#4b5563' }}
                >
                  {guionFile ? guionFile.name : 'Sin guió'}
                </div>
                <label
                  className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white cursor-pointer text-base"
                  title="Seleccionar guió (DOCX o PDF)"
                >
                  <input
                    type="file"
                    accept=".docx,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleGuionFileChange(f);
                      e.currentTarget.value = '';
                    }}
                  />
                  📄
                </label>
                {guionFile && (
                  <button
                    className="text-xs text-gray-500 hover:text-red-400"
                    onClick={() => {
                      setGuionFile(null);
                      setGuionPreviewText('');
                      setGuionConvertErr(null);
                      guionConvertedRef.current = null;
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
              {guionConverting && (
                <div className="text-[10px] mt-1 animate-pulse" style={{ color: 'var(--th-accent-text)' }}>
                  ⏳ Convertint…
                </div>
              )}
              {guionConvertErr && (
                <div className="text-[10px] mt-1 text-red-400">{guionConvertErr}</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Options slot — Whisper Avançat (transcribe) or Eliminar original (importSrt) ── */}
        <div className="border-t border-gray-700" />
        {tab === 'transcribe' ? (
          <>
            {/* Toggle row */}
            <div
              className="flex items-center justify-between px-1 py-2 cursor-pointer select-none"
              onClick={() => {
                const next = !advancedOpen;
                setAdvancedOpen(next);
                if (!next) setSavePresetOpen(false);
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Whisper avançat
                </span>
                <span className="text-gray-600 text-xs">{advancedOpen ? '▼' : '▶'}</span>
              </div>
              {advancedOpen && (
                <button
                  className="text-[10px] font-semibold px-2 py-1 rounded bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSavePresetOpen((prev) => !prev);
                    setSavePresetError(null);
                    setSavePresetName('');
                  }}
                >
                  Guardar perfil…
                </button>
              )}
            </div>

            {advancedOpen && (
              <div className="pb-3 space-y-3">
                {/* Motor + Model + Idioma + Batch + Device grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Motor — full width */}
                  <div className="col-span-2">
                    <div className="text-[10px] text-gray-400 mb-1">Motor</div>
                    <select
                      className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-sm"
                      value={engine}
                      onChange={(e) => setEngine(e.target.value)}
                    >
                      {(options?.engines || ['faster-whisper', 'purfview-xxl', 'whisperx', 'script-align']).map(
                        (eng: string) => (
                          <option key={eng} value={eng}>{ENGINE_LABELS[eng] ?? eng}</option>
                        ),
                      )}
                    </select>
                    {engine === 'purfview-xxl' && (
                      <div className="mt-1 text-xs rounded px-2 py-1" style={{ color: 'var(--th-accent-text)', backgroundColor: 'var(--th-accent-muted)' }}>
                        Purfview XXL: faster-whisper + post-procesado (fix casing, puntuación, fusión de líneas)
                      </div>
                    )}
                    {engine === 'script-align' && (
                      <div className="mt-1 text-xs text-green-400 bg-green-900/30 rounded px-2 py-1">
                        Script-Align: alinea el texto del guion al audio. Requiere el guion del doblaje.
                      </div>
                    )}
                  </div>

                  {engine !== 'script-align' && (
                    <div>
                      <div className="text-[10px] text-gray-400 mb-1">Modelo</div>
                      <select
                        className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-sm"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                      >
                        {[...new Set<string>(options?.models || ['tiny','base','small','medium','large-v2','large-v3','large-v3-turbo'])].map(
                          (m: string) => <option key={m} value={m}>{MODEL_LABELS[m] ?? m}</option>,
                        )}
                      </select>
                    </div>
                  )}

                  <div>
                    <div className="text-[10px] text-gray-400 mb-1">Idioma</div>
                    <input
                      className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-sm"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      placeholder="ca / es / en"
                    />
                  </div>

                  {engine !== 'script-align' && (
                    <>
                      <div>
                        <div className="text-[10px] text-gray-400 mb-1">Batch</div>
                        <input
                          type="number" min={1} max={64}
                          className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-sm"
                          value={batchSize}
                          onChange={(e) => setBatchSize(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 mb-1">Device</div>
                        <select
                          className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-sm"
                          value={device}
                          onChange={(e) => setDevice(e.target.value as any)}
                        >
                          <option value="cpu">cpu</option>
                          <option value="cuda">cuda</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>

                {/* Checkboxes */}
                <label className="flex items-center gap-2 text-sm text-gray-200">
                  <input
                    type="checkbox"
                    checked={timingFix}
                    onChange={(e) => setTimingFix(e.target.checked)}
                  />
                  Auto-ajuste de timings (waveform)
                </label>

                {engine !== 'script-align' && (
                  <>
                    <label className="flex items-center gap-2 text-sm text-gray-200">
                      <input
                        type="checkbox"
                        checked={diarization}
                        onChange={(e) => {
                          setDiarization(e.target.checked);
                          if (!e.target.checked) setNumSpeakers('auto');
                        }}
                      />
                      Diarización (identificar interlocutors)
                    </label>
                    {diarization && (
                      <div className="flex items-center gap-3 ml-5 text-sm text-gray-300">
                        <span className="text-gray-400">Nº interlocutors:</span>
                        <select
                          value={numSpeakers}
                          onChange={(e) =>
                            setNumSpeakers(e.target.value === 'auto' ? 'auto' : Number(e.target.value))
                          }
                          className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-200 text-sm"
                        >
                          <option value="auto">Auto</option>
                          {[2,3,4,5,6,7,8].map((n) => (
                            <option key={n} value={n}>{n} interlocutors</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}

                {/* Marge mínim entre subtítols */}
                <div>
                  <label className="flex items-center gap-2 text-sm text-gray-200">
                    <input
                      type="checkbox"
                      checked={enforceMinSubGap}
                      onChange={(e) => setEnforceMinSubGap(e.target.checked)}
                    />
                    Margen mínimo entre subtítulos
                  </label>
                  {enforceMinSubGap && (
                    <div className="flex items-center gap-2 ml-5 mt-1">
                      <input
                        type="number" min={0} max={2000} step={10}
                        className="w-20 px-2 py-1 rounded bg-gray-800 border border-gray-600 text-gray-100 text-sm"
                        value={minSubGapMs}
                        onChange={(e) => setMinSubGapMs(Math.max(0, Number(e.target.value)))}
                      />
                      <span className="text-xs text-gray-400">ms entre cues consecutivos</span>
                    </div>
                  )}
                </div>

                {/* Guardar perfil mini-form */}
                {savePresetOpen && (
                  <div className="rounded-lg border border-gray-700 bg-gray-800 p-3 space-y-2">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                      Guardar configuració actual com a preset
                    </div>
                    <input
                      className="w-full px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-gray-100 text-sm"
                      placeholder="Nom del preset..."
                      value={savePresetName}
                      onChange={(e) => {
                        setSavePresetName(e.target.value);
                        setSavePresetError(null);
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') void handleSavePreset(); }}
                      autoFocus
                    />
                    {savePresetName.trim() && userPresets[savePresetName.trim()] && (
                      <div className="text-[10px] text-amber-400">
                        Sobreescriurà el preset existent "{savePresetName.trim()}"
                      </div>
                    )}
                    {savePresetError && (
                      <div className="text-[10px] text-red-400">{savePresetError}</div>
                    )}
                    <div className="flex justify-end gap-2">
                      <button
                        className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-semibold"
                        onClick={() => {
                          setSavePresetOpen(false);
                          setSavePresetName('');
                          setSavePresetError(null);
                        }}
                      >
                        Cancel·lar
                      </button>
                      <button
                        className="px-3 py-1 rounded text-white text-xs font-bold"
                        style={{ backgroundColor: 'var(--th-accent)' }}
                        onClick={() => void handleSavePreset()}
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* Eliminar original — same py-2 as Whisper toggle row to keep modal height consistent */
          <div className="flex items-center px-1 py-2">
            {isDeleteOriginalEnabled ? (
              <label
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer"
                style={{ background: '#2d1515', border: '1px solid #7f1d1d' }}
              >
                <input
                  type="checkbox"
                  checked={deleteOriginalSrt}
                  onChange={(e) => setDeleteOriginalSrt(e.target.checked)}
                  style={{ accentColor: '#ef4444', width: 12, height: 12 }}
                />
                <span className="text-xs font-semibold" style={{ color: '#fca5a5' }}>
                  Eliminar original
                </span>
              </label>
            ) : (
              <label
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg opacity-40 cursor-default"
                style={{ background: '#161616', border: '1px solid #252525' }}
              >
                <input
                  type="checkbox"
                  disabled
                  style={{ accentColor: '#6b7280', width: 12, height: 12 }}
                />
                <span className="text-xs font-semibold text-gray-500">
                  Eliminar original
                </span>
              </label>
            )}
          </div>
        )}

        {/* ── Script-Align field (only when engine = script-align, Transcribir tab) ── */}
        {tab === 'transcribe' && engine === 'script-align' && (
          <div className="mt-3">
            <div className="text-xs font-bold text-gray-400 mb-1">
              Guion del doblaje <span className="text-red-400">*</span>
            </div>
            <label className="block mb-2 text-xs text-gray-400 cursor-pointer">
              <input
                type="file"
                accept=".txt,.srt,.vtt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleScriptFileChange(f);
                  e.currentTarget.value = '';
                }}
              />
              <span className="inline-block px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-200">
                Cargar desde archivo (.txt / .srt)
              </span>
              {scriptFile && <span className="ml-2 text-green-400">{scriptFile.name}</span>}
            </label>
            <textarea
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-xs font-mono resize-none"
              rows={6}
              placeholder="Pega aquí el texto del guion o carga un archivo..."
              value={scriptText}
              onChange={(e) => {
                setScriptText(e.target.value);
                if (scriptFile) setScriptFile(null);
              }}
            />
            <div className="text-xs text-gray-500 mt-1">
              {scriptText.trim().split(/\s+/).filter(Boolean).length} palabras
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="border-t border-gray-700 mt-auto pt-3">
          {busy && (
            <div className="mb-2">
              <div className="h-1.5 w-full bg-gray-700 rounded overflow-hidden">
                <div
                  className="h-1.5 transition-all"
                  style={{ width: `${jobProgress}%`, backgroundColor: 'var(--th-accent)' }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-1">{jobProgress}%</div>
            </div>
          )}
          {err && <div className="text-sm text-red-300 mb-2">{err}</div>}
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold text-sm"
            >
              Cancelar
            </button>
            {tab === 'transcribe' ? (
              <button
                disabled={busy || guionConverting}
                onClick={createByTranscribe}
                className="px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-60"
                style={{ backgroundColor: 'var(--th-btn-primary-bg)', color: 'var(--th-btn-primary-text)' }}
              >
                {engine === 'script-align' ? 'Alinear guion' : 'Transcribir'}
              </button>
            ) : (
              <button
                disabled={busy || guionConverting}
                onClick={createFromExistingSrt}
                className="px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-60"
                style={{ backgroundColor: 'var(--th-btn-primary-bg)', color: 'var(--th-btn-primary-text)' }}
              >
                Importar SRT
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
