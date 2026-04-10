import React, { createContext, useContext, useState } from 'react';

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
}

const UploadContext = createContext<UploadContextValue | null>(null);

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<UploadJob[]>([]);

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

  return (
    <UploadContext.Provider value={{ jobs, addJob, updateJob, completeJob }}>
      {children}
    </UploadContext.Provider>
  );
};

export const useUploadContext = (): UploadContextValue => {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error('useUploadContext must be used within UploadProvider');
  return ctx;
};
