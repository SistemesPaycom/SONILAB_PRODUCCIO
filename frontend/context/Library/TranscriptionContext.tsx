// context/Library/TranscriptionContext.tsx
import { LOCAL_STORAGE_KEYS } from '@/constants';
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { TranscriptionTask } from '../../types';
import { api } from '../../services/api';

interface TranscriptionState {
  transcriptionTasks: TranscriptionTask[];
}

type TranscriptionAction =
  | { type: 'ADD_TRANSCRIPTION_TASK'; payload: TranscriptionTask }
  | { type: 'UPDATE_TRANSCRIPTION_TASK'; payload: { id: string; patch: Partial<TranscriptionTask> } }
  | { type: 'CLEAR_TRANSCRIPTION_TASKS_DONE' };

function loadLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function transcriptionReducer(state: TranscriptionState, action: TranscriptionAction): TranscriptionState {
  switch (action.type) {
    case 'ADD_TRANSCRIPTION_TASK':
      return { ...state, transcriptionTasks: [action.payload, ...state.transcriptionTasks] };
    case 'UPDATE_TRANSCRIPTION_TASK':
      return {
        ...state,
        transcriptionTasks: state.transcriptionTasks.map(t =>
          t.id === action.payload.id ? { ...t, ...action.payload.patch } : t
        ),
      };
    case 'CLEAR_TRANSCRIPTION_TASKS_DONE':
      return {
        ...state,
        transcriptionTasks: state.transcriptionTasks.filter(
          t => t.status === 'queued' || t.status === 'processing'
        ),
      };
    default:
      return state;
  }
}

interface TranscriptionContextValue {
  transcriptionTasks: TranscriptionTask[];
  transcriptionDispatch: React.Dispatch<TranscriptionAction>;
}

const TranscriptionContext = createContext<TranscriptionContextValue>({
  transcriptionTasks: [],
  transcriptionDispatch: () => null,
});

export const TranscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(transcriptionReducer, {
    transcriptionTasks: loadLocal<TranscriptionTask[]>(LOCAL_STORAGE_KEYS.TASKS_TRANSCRIPTION, []),
  });

  const useBackend = import.meta.env.VITE_USE_BACKEND === '1';

  // Persist to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LOCAL_STORAGE_KEYS.TASKS_TRANSCRIPTION, JSON.stringify(state.transcriptionTasks));
  }, [state.transcriptionTasks]);

  // Adaptive polling for active transcription jobs
  useEffect(() => {
    if (!useBackend) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loop = async () => {
      const active = state.transcriptionTasks.filter(
        t => t.status === 'queued' || t.status === 'processing'
      );
      if (active.length === 0 || cancelled) return;

      // Adaptive interval: more jobs → less aggressive
      let nextDelay = Math.min(15000, 2500 + active.length * 1500);

      try {
        for (const t of active) {
          const j = await api.getJob(t.id);
          if (cancelled) return;
          dispatch({
            type: 'UPDATE_TRANSCRIPTION_TASK',
            payload: {
              id: t.id,
              patch: {
                status: j.status,
                progress: Number(j.progress || 0),
                error: j.error || null,
              },
            },
          });
        }
      } catch (e: any) {
        if (String(e?.message || '').includes('429')) nextDelay = 15000;
      }

      timer = setTimeout(loop, nextDelay);
    };

    timer = setTimeout(loop, 2000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [useBackend, state.transcriptionTasks]);

  return (
    <TranscriptionContext.Provider value={{ transcriptionTasks: state.transcriptionTasks, transcriptionDispatch: dispatch }}>
      {children}
    </TranscriptionContext.Provider>
  );
};

export const useTranscription = () => useContext(TranscriptionContext);
