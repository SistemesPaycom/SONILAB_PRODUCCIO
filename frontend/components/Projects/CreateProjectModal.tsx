import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import { useLibrary } from '../../context/Library/LibraryContext';
import type { Document, OpenMode } from '../../types';

const MEDIA_EXTS = ['mp4', 'mov', 'webm', 'wav', 'mp3', 'ogg', 'm4a'];

const MODEL_LABELS: Record<string, string> = {
  tiny: 'tiny — muy rápido, menor precisión',
  base: 'base — rápido',
  small: 'small — equilibrado',
  medium: 'medium — buena calidad',
  'large-v2': 'large-v2 — alta calidad',
  'large-v3': 'large-v3 — mejor calidad',
  'large-v3-turbo': 'large-v3-turbo — rápido y alta calidad',
};

function isMediaDoc(d: Document) {
  const st = (d.sourceType || '').toLowerCase();
  return MEDIA_EXTS.includes(st);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const CreateProjectModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onOpenDocument: (docId: string | null, mode: OpenMode | null, edit: boolean) => void;
}> = ({ open, onClose, onOpenDocument }) => {
  const { state, reloadTree, dispatch } = useLibrary();

  const [tab, setTab] = useState<'transcribe' | 'importSrt'>('transcribe');

  const mediaDocs = useMemo(() => state.documents.filter(isMediaDoc), [state.documents]);

  const [name, setName] = useState('');
  const [mediaId, setMediaId] = useState<string>('');

  // settings
  const [options, setOptions] = useState<any>(null);
  const [model, setModel] = useState('small');
  const [profile, setProfile] = useState('VE');
  const [language, setLanguage] = useState('ca');
  const [device, setDevice] = useState<'cpu' | 'cuda'>('cpu');
  const [batchSize, setBatchSize] = useState(8);
  const [diarization, setDiarization] = useState(false);
  const [offline, setOffline] = useState(false);

  // import srt
  const [srtFile, setSrtFile] = useState<File | null>(null);

  // progress/job
  const [busy, setBusy] = useState(false);
  const [jobProgress, setJobProgress] = useState<number>(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setJobProgress(0);

    void (async () => {
      try {
        const opt = await api.transcriptionOptions();
        setOptions(opt);

        const d = opt?.defaults || {};
        setModel(d.model || 'small');
        setProfile(d.profile || 'VE');
        setLanguage(d.language || 'ca');
        setDevice((d.device || 'cpu') as any);
        setBatchSize(Number(d.batchSize || 8));
        setDiarization(!!d.diarization);
        setOffline(!!d.offline);
      } catch (e: any) {
        // no bloquea el modal si falla options
        console.warn(e);
      }
    })();
  }, [open]);

  if (!open) return null;

  const settings = {
    model,
    profile,
    language,
    batchSize,
    device,
    diarization,
    offline,
  };

  const triggerAutoSyncMedia = (mediaDocId: string) => {
    // Esto dispara el mecanismo ya existente de syncRequest
    dispatch({ type: 'TRIGGER_SYNC_REQUEST', payload: { docId: mediaDocId, type: 'media' } });
  };

  const createByTranscribe = () => {
    void (async () => {
      setErr(null);
      if (!name.trim()) return setErr('Falta el nombre del proyecto');
      if (!mediaId) return setErr('Selecciona un vídeo');

      setBusy(true);
      try {
        const res = await api.createProject({
          name: name.trim(),
          mediaDocumentId: mediaId,
          settings,
        });

        const jobId = res?.job?.id;
        const srtDocId = res?.srtDocument?.id;
        const mediaDocId = res?.project?.mediaDocumentId || mediaId;
        if (!jobId || !srtDocId) throw new Error('Respuesta inválida al crear proyecto');
        dispatch({
          type: 'ADD_TRANSCRIPTION_TASK',
          payload: {
            id: jobId,
            projectId: res.project.id,
            projectName: name.trim(),
            srtDocumentId: srtDocId,
            mediaDocumentId: mediaDocId,
            status: res.job.status,
            progress: Number(res.job.progress || 0),
            error: null,
            timestamp: new Date().toISOString(),
          },
        });

        // polling
        for (let i = 0; i < 600; i++) { // hasta ~10 min
          const j = await api.getJob(jobId);
          const progress = Number(j.progress || 0);
  setJobProgress(progress);
           dispatch({
    type: 'UPDATE_TRANSCRIPTION_TASK',
    payload: {
      id: jobId,
      patch: {
        status: j.status,
        progress,
        error: j.error || null,
      },
    },
  });

          if (j.status === 'done') break;
          if (j.status === 'error') throw new Error(j.error || 'Job error');
          await sleep(1000);
        }

        await reloadTree();

        onClose();
        onOpenDocument(srtDocId, 'editor-video-subs', true);
        triggerAutoSyncMedia(mediaDocId);
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
      if (!srtFile) return setErr('Selecciona un archivo .srt');

      setBusy(true);
      try {
        const srtText = await srtFile.text();

        const res = await api.createProjectFromExisting({
          name: name.trim(),
          mediaDocumentId: mediaId,
          srtText,
          settings,
        });

        const srtDocId = res?.srtDocument?.id;
        const mediaDocId = res?.project?.mediaDocumentId || mediaId;
        if (!srtDocId) throw new Error('Respuesta inválida al importar SRT');

        await reloadTree();

        onClose();
        onOpenDocument(srtDocId, 'editor-video-subs', true);
        triggerAutoSyncMedia(mediaDocId);
      } catch (e: any) {
        setErr(e?.message || 'Error importando SRT');
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleUploadNewMedia = (file: File) => {
    void (async () => {
      setErr(null);
      setBusy(true);
      try {
        const r = await api.uploadMedia(file);
        const newId = r?.document?.id;
        await reloadTree();
        if (newId) setMediaId(newId);
      } catch (e: any) {
        setErr(e?.message || 'Error subiendo vídeo');
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <div className="fixed inset-0 z-[900] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-white">Crear proyecto</h2>
          <button className="text-gray-400 hover:text-white text-2xl leading-none" onClick={onClose}>&times;</button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            className={`px-3 py-1.5 rounded-lg text-sm font-bold ${tab === 'transcribe' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-200'}`}
            onClick={() => setTab('transcribe')}
          >
            Transcribir
          </button>
          <button
            className={`px-3 py-1.5 rounded-lg text-sm font-bold ${tab === 'importSrt' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-200'}`}
            onClick={() => setTab('importSrt')}
          >
            Importar SRT
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <div className="text-xs font-bold text-gray-400 mb-1">Nombre</div>
              <input
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Proyecto 01"
              />
            </div>

            <div>
              <div className="text-xs font-bold text-gray-400 mb-1">Vídeo / Audio</div>
              <select
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100"
                value={mediaId}
                onChange={(e) => setMediaId(e.target.value)}
              >
                <option value="">Selecciona...</option>
                {mediaDocs.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <div className="mt-2">
                <label className="text-xs text-gray-300 font-semibold cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    accept={MEDIA_EXTS.map((x) => `.${x}`).join(',')}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadNewMedia(f);
                      e.currentTarget.value = '';
                    }}
                  />
                  <span className="inline-block px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700">
                    Subir nuevo vídeo
                  </span>
                </label>
              </div>
            </div>

            {tab === 'importSrt' && (
              <div>
                <div className="text-xs font-bold text-gray-400 mb-1">Archivo SRT</div>
                <input
                  type="file"
                  accept=".srt"
                  onChange={(e) => setSrtFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-200"
                />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="text-xs font-bold text-gray-400">Configuración WhisperX</div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-400 mb-1">Modelo</div>
                <select className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100"
                  value={model} onChange={(e) => setModel(e.target.value)}>
                  {(options?.models || ['tiny','base','small','medium','large-v2','large-v3','large-v3-turbo']).map((m: string) => (
                    <option key={m} value={m}>{MODEL_LABELS[m] ?? m}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-xs text-gray-400 mb-1">Perfil</div>
                <select className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100"
                  value={profile} onChange={(e) => setProfile(e.target.value)}>
                  {(options?.profiles || ['VE','VCAT']).map((p: string) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-xs text-gray-400 mb-1">Idioma</div>
                <input className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100"
                  value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="ca / es / en" />
              </div>

              <div>
                <div className="text-xs text-gray-400 mb-1">Batch</div>
                <input type="number" min={1} max={64}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100"
                  value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))} />
              </div>

              <div>
                <div className="text-xs text-gray-400 mb-1">Device</div>
                <select className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100"
                  value={device} onChange={(e) => setDevice(e.target.value as any)}>
                  <option value="cpu">cpu</option>
                  <option value="cuda">cuda</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-200">
              <input type="checkbox" checked={diarization} onChange={(e) => setDiarization(e.target.checked)} />
              Diarización
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-200">
              <input type="checkbox" checked={offline} onChange={(e) => setOffline(e.target.checked)} />
              Offline
            </label>

            {busy && (
              <div className="mt-2">
                <div className="text-xs text-gray-300 mb-1">Progreso</div>
                <div className="h-2 w-full bg-gray-700 rounded overflow-hidden">
                  <div className="h-2 bg-blue-500" style={{ width: `${jobProgress}%` }} />
                </div>
                <div className="text-xs text-gray-300 mt-1">{jobProgress}%</div>
              </div>
            )}

            {err && <div className="text-sm text-red-300">{err}</div>}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold">
                Cancelar
              </button>

              {tab === 'transcribe' ? (
                <button
                  disabled={busy}
                  onClick={createByTranscribe}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-60"
                >
                  Transcribir
                </button>
              ) : (
                <button
                  disabled={busy}
                  onClick={createFromExistingSrt}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-60"
                >
                  Importar SRT
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};