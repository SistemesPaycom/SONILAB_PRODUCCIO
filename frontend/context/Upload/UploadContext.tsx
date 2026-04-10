import React, { createContext, useContext, useState, useEffect } from 'react';
import { LOCAL_STORAGE_KEYS } from '../../constants';

export interface UploadJob {
  id: string;
  name: string;
  pct: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

interface UploadContextValue {
  jobs: UploadJob[];
  addJob: (id: string, name: string) => void;
  updateJob: (id: string, pct: number) => void;
  completeJob: (id: string, success: boolean, error?: string) => void;
  clearHistory: () => void;
}

const UploadContext = createContext<UploadContextValue | null>(null);

const MAX_HISTORY = 50;

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<UploadJob[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.PUJADES_HISTORY);
      if (!stored) return [];
      const parsed: UploadJob[] = JSON.parse(stored);
      // Subides en curs quan es va tancar la pàgina: marquem com error
      return parsed.map(j =>
        j.status === 'uploading'
          ? { ...j, status: 'error' as const, error: 'Subida interrompuda', finishedAt: j.finishedAt ?? new Date().toISOString() }
          : j
      );
    } catch {
      return [];
    }
  });

  // Sincronitzar amb localStorage cada vegada que canvien els jobs (només done/error, màx MAX_HISTORY)
  useEffect(() => {
    const toSave = jobs.filter(j => j.status !== 'uploading').slice(-MAX_HISTORY);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.PUJADES_HISTORY, JSON.stringify(toSave));
    } catch { /* silently fail */ }
  }, [jobs]);

  const addJob = (id: string, name: string) => {
    setJobs(prev => [...prev, {
      id,
      name,
      pct: 0,
      status: 'uploading',
      startedAt: new Date().toISOString(),
    }]);
  };

  const updateJob = (id: string, pct: number) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, pct } : j));
  };

  const completeJob = (id: string, success: boolean, error?: string) => {
    setJobs(prev => prev.map(j =>
      j.id === id
        ? { ...j, status: success ? 'done' : 'error', pct: success ? 100 : j.pct, finishedAt: new Date().toISOString(), ...(error ? { error } : {}) }
        : j
    ));
  };

  const clearHistory = () => {
    setJobs(prev => prev.filter(j => j.status === 'uploading'));
  };

  return (
    <UploadContext.Provider value={{ jobs, addJob, updateJob, completeJob, clearHistory }}>
      {children}
    </UploadContext.Provider>
  );
};

export const useUploadContext = (): UploadContextValue => {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error('useUploadContext must be used within UploadProvider');
  return ctx;
};
