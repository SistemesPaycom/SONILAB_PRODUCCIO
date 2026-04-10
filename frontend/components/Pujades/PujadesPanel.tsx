import React, { useState } from 'react';
import * as Icons from '../icons';
import { useUploadContext, UploadJob } from '../../context/Upload/UploadContext';

type TabFilter = 'active' | 'history';

interface PujadesPanelProps {
  onClose: () => void;
}

const PujadesPanel: React.FC<PujadesPanelProps> = ({ onClose }) => {
  const { jobs } = useUploadContext();
  const [tab, setTab] = useState<TabFilter>('active');

  const activeJobs = jobs.filter(j => j.status === 'uploading');
  const historyJobs = jobs.filter(j => j.status === 'done' || j.status === 'error');
  const displayJobs = tab === 'active' ? activeJobs : historyJobs;

  const statusLabel = (s: UploadJob['status']) => {
    switch (s) {
      case 'uploading': return 'Pujant';
      case 'done': return 'Completat';
      case 'error': return 'Error';
    }
  };

  const statusColor = (s: UploadJob['status']) => {
    switch (s) {
      case 'uploading': return 'animate-pulse pujades-uploading';
      case 'done': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'error': return 'bg-red-500/20 text-red-400 border-red-500/30';
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Ara mateix';
    if (diffMin < 60) return `Fa ${diffMin} min`;
    return d.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[500] p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <style>{`.pujades-uploading { background-color: var(--th-accent-muted); color: var(--th-accent-text); border-color: var(--th-focus-ring); }`}</style>
      <div
        className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
          <h4 className="font-bold text-xl text-white flex items-center gap-3">
            <Icons.Upload className="w-6 h-6" style={{ color: 'var(--th-accent-text)' }} />
            Pujades
          </h4>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-3xl leading-none transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700/50 bg-gray-900/30">
          <button
            onClick={() => setTab('active')}
            className={`flex-1 py-3 text-sm font-black uppercase tracking-widest transition-colors relative ${
              tab === 'active' ? '' : 'text-gray-500 hover:text-gray-300'
            }`}
            style={tab === 'active' ? { color: 'var(--th-accent-text)' } : undefined}
          >
            En curs
            {activeJobs.length > 0 && (
              <span
                className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold border"
                style={{ backgroundColor: 'var(--th-accent-muted)', color: 'var(--th-accent-text)', borderColor: 'var(--th-accent)' }}
              >
                {activeJobs.length}
              </span>
            )}
            {tab === 'active' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: 'var(--th-accent)' }} />
            )}
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex-1 py-3 text-sm font-black uppercase tracking-widest transition-colors relative ${
              tab === 'history' ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Historial
            {tab === 'history' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          {displayJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              {tab === 'active' ? (
                <>
                  <span className="text-4xl mb-3">📂</span>
                  <p className="text-sm font-bold">Cap pujada activa</p>
                  <p className="text-xs mt-1">Les pujades en curs apareixeran aquí</p>
                </>
              ) : (
                <>
                  <span className="text-4xl mb-3">📋</span>
                  <p className="text-sm font-bold">Historial buit</p>
                  <p className="text-xs mt-1">Les pujades completades es mostraran aquí</p>
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
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0 pr-3">
                      <h5 className="text-sm font-bold text-gray-100 truncate" title={job.name}>
                        {job.name}
                      </h5>
                      <span className="text-[10px] font-mono text-gray-500">
                        {formatTime(job.startedAt)}
                      </span>
                    </div>
                    <span
                      className={`flex-shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusColor(job.status)}`}
                    >
                      {statusLabel(job.status)}
                    </span>
                  </div>

                  {job.status === 'uploading' && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(job.pct, 2)}%`, backgroundColor: 'var(--th-accent)' }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-gray-500">Pujant...</span>
                        <span className="text-[10px] font-mono text-gray-400">{job.pct}%</span>
                      </div>
                    </div>
                  )}

                  {job.status === 'error' && job.error && (
                    <div className="mt-2 px-3 py-2 rounded-lg bg-red-900/20 border border-red-800/30">
                      <p className="text-[11px] text-red-300 break-words">{job.error}</p>
                    </div>
                  )}

                  {job.status === 'done' && job.finishedAt && (
                    <div className="mt-1 text-[10px] text-emerald-500/70">
                      Completat {formatTime(job.finishedAt)}
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
              ? `${activeJobs.length} pujada${activeJobs.length > 1 ? 's' : ''} activa${activeJobs.length > 1 ? 's' : ''}`
              : 'Cap pujada activa'}
          </span>
          <span>{historyJobs.length} al historial</span>
        </div>
      </div>
    </div>
  );
};

export default PujadesPanel;
