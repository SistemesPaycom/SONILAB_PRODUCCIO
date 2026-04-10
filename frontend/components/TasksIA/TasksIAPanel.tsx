import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as Icons from '../icons';
import { api } from '../../services/api';

export interface JobRecord {
  id: string;
  projectId: string;
  projectName: string;
  srtDocumentId: string | null;
  mediaDocumentId: string | null;
  projectStatus: string | null;
  type: string;
  status: 'queued' | 'processing' | 'done' | 'error';
  progress: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

type TabFilter = 'active' | 'history';

interface TasksIAPanelProps {
  onClose: () => void;
  /** Callback quan una tasca acaba — per notificar al HOME */
  onTaskCompleted?: (job: JobRecord) => void;
}

const TasksIAPanel: React.FC<TasksIAPanelProps> = ({ onClose, onTaskCompleted }) => {
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [tab, setTab] = useState<TabFilter>('active');
  const [loading, setLoading] = useState(true);
  const prevJobsRef = useRef<Map<string, string>>(new Map());

  const fetchJobs = useCallback(async () => {
    try {
      const data = await api.listJobs({ limit: 100 });
      setJobs(data || []);

      // Detectar tasques que acaben de finalitzar
      if (onTaskCompleted) {
        const prevMap = prevJobsRef.current;
        for (const j of data || []) {
          const prevStatus = prevMap.get(j.id);
          if (prevStatus && prevStatus !== 'done' && j.status === 'done') {
            onTaskCompleted(j);
          }
        }
      }

      // Actualitzar mapa d'estats
      const newMap = new Map<string, string>();
      for (const j of data || []) newMap.set(j.id, j.status);
      prevJobsRef.current = newMap;
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [onTaskCompleted]);

  // Poll cada 3s si hi ha tasques actives
  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const activeJobs = jobs.filter(j => j.status === 'queued' || j.status === 'processing');
  const historyJobs = jobs.filter(j => j.status === 'done' || j.status === 'error');
  const displayJobs = tab === 'active' ? activeJobs : historyJobs;

  const statusLabel = (s: string) => {
    switch (s) {
      case 'queued': return 'En cua';
      case 'processing': return 'Processant';
      case 'done': return 'Finalitzat';
      case 'error': return 'Error';
      default: return s;
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'queued': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'processing': return 'animate-pulse tasks-ia-processing';
      case 'done': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'error': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);

    if (diffMin < 1) return 'Ara mateix';
    if (diffMin < 60) return `Fa ${diffMin} min`;
    if (diffH < 24) return `Fa ${diffH}h`;
    return d.toLocaleDateString('ca-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[500] p-4 backdrop-blur-sm" onClick={onClose}>
      <style>{`.tasks-ia-processing { background-color: var(--th-accent-muted); color: var(--th-accent-text); border-color: var(--th-focus-ring); }`}</style>
      <div
        className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
          <h4 className="font-bold text-xl text-white flex items-center gap-3">
            <Icons.Bell className="w-6 h-6" style={{ color: 'var(--th-accent-text)' }} />
            Tasques IA
          </h4>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none transition-colors">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700/50 bg-gray-900/30">
          <button
            onClick={() => setTab('active')}
            className={`flex-1 py-3 text-sm font-black uppercase tracking-widest transition-colors relative ${
              tab === 'active'
                ? ''
                : 'text-gray-500 hover:text-gray-300'
            }`}
            style={tab === 'active' ? { color: 'var(--th-accent-text)' } : undefined}
          >
            En cua / Processant
            {activeJobs.length > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold border" style={{ backgroundColor: 'var(--th-accent-muted)', color: 'var(--th-accent-text)', borderColor: 'var(--th-accent)' }}>
                {activeJobs.length}
              </span>
            )}
            {tab === 'active' && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: 'var(--th-accent)' }} />}
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex-1 py-3 text-sm font-black uppercase tracking-widest transition-colors relative ${
              tab === 'history'
                ? 'text-emerald-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Historial
            {tab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--th-accent)', borderTopColor: 'transparent' }} />
            </div>
          ) : displayJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              {tab === 'active' ? (
                <>
                  <span className="text-4xl mb-3">🎉</span>
                  <p className="text-sm font-bold">No hi ha tasques actives</p>
                  <p className="text-xs mt-1">Les noves transcripcions apareixeran aquí</p>
                </>
              ) : (
                <>
                  <span className="text-4xl mb-3">📋</span>
                  <p className="text-sm font-bold">Historial buit</p>
                  <p className="text-xs mt-1">Les tasques finalitzades es mostraran aquí</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {displayJobs.map(job => (
                <div
                  key={job.id}
                  className="p-4 bg-gray-900/60 rounded-xl border border-gray-700/50 hover:border-gray-600/60 transition-colors"
                >
                  {/* Row 1: name + status */}
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0 pr-3">
                      <h5 className="text-sm font-bold text-gray-100 truncate" title={job.projectName}>
                        {job.projectName}
                      </h5>
                      <span className="text-[10px] font-mono text-gray-500">
                        {formatDate(job.createdAt)}
                      </span>
                    </div>
                    <span className={`flex-shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusColor(job.status)}`}>
                      {statusLabel(job.status)}
                    </span>
                  </div>

                  {/* Progress bar (only for active jobs) */}
                  {(job.status === 'queued' || job.status === 'processing') && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            job.status === 'queued' ? 'bg-amber-500' : ''
                          }`}
                          style={{
                            width: `${Math.max(job.progress, 2)}%`,
                            ...(job.status !== 'queued' ? { backgroundColor: 'var(--th-accent)' } : {}),
                          }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-gray-500">
                          {job.status === 'queued' ? 'Esperant torn...' : 'Transcrivint...'}
                        </span>
                        <span className="text-[10px] font-mono text-gray-400">{job.progress}%</span>
                      </div>
                    </div>
                  )}

                  {/* Error message */}
                  {job.status === 'error' && job.error && (
                    <div className="mt-2 px-3 py-2 rounded-lg bg-red-900/20 border border-red-800/30">
                      <p className="text-[11px] text-red-300 break-words">{job.error}</p>
                    </div>
                  )}

                  {/* Completed info */}
                  {job.status === 'done' && (
                    <div className="mt-1 text-[10px] text-emerald-500/70">
                      Completat {formatDate(job.updatedAt)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-900/30 flex items-center justify-between text-[10px] text-gray-500">
          <span>
            {activeJobs.length > 0
              ? `${activeJobs.length} tasca${activeJobs.length > 1 ? 'es' : ''} activa${activeJobs.length > 1 ? 'es' : ''}`
              : 'Sense tasques actives'}
          </span>
          <span>{historyJobs.length} al historial</span>
        </div>
      </div>
    </div>
  );
};

export default TasksIAPanel;
