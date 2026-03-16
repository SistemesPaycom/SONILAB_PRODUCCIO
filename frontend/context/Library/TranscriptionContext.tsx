// context/Library/TranscriptionContext.tsx
import { LOCAL_STORAGE_KEYS } from '@/constants';
import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import type { TranscriptionTask } from '../../types';
import { api } from '../../services/api';

interface TranscriptionState {
  transcriptionTasks: TranscriptionTask[];
}

type TranscriptionAction =
  | { type: 'ADD_TRANSCRIPTION_TASK'; payload: TranscriptionTask }
  | { type: 'UPDATE_TRANSCRIPTION_TASK'; payload: { id: string; patch: Partial<TranscriptionTask> } }
  | { type: 'REMOVE_TRANSCRIPTION_TASK'; payload: string }
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

/** Deduplica la llista de tasks per ID al carregar des de localStorage */
function deduplicateTasks(tasks: TranscriptionTask[]): TranscriptionTask[] {
  const seen = new Set<string>();
  return tasks.filter(t => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

function transcriptionReducer(state: TranscriptionState, action: TranscriptionAction): TranscriptionState {
  switch (action.type) {
    case 'ADD_TRANSCRIPTION_TASK': {
      // Deduplicació: si ja existeix un task amb el mateix ID, no l'afegim
      const exists = state.transcriptionTasks.some(t => t.id === action.payload.id);
      if (exists) return state;
      return { ...state, transcriptionTasks: [action.payload, ...state.transcriptionTasks] };
    }
    case 'UPDATE_TRANSCRIPTION_TASK':
      return {
        ...state,
        transcriptionTasks: state.transcriptionTasks.map(t =>
          t.id === action.payload.id ? { ...t, ...action.payload.patch } : t
        ),
      };
    case 'REMOVE_TRANSCRIPTION_TASK':
      return {
        ...state,
        transcriptionTasks: state.transcriptionTasks.filter(t => t.id !== action.payload),
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
    // Deduplica al carregar des de localStorage per netejar possibles duplicats antics
    transcriptionTasks: deduplicateTasks(
      loadLocal<TranscriptionTask[]>(LOCAL_STORAGE_KEYS.TASKS_TRANSCRIPTION, [])
    ),
  });

  const useBackend = process.env.VITE_USE_BACKEND === '1';

  // Comptador de fallades 404 per task — per aturar polling sobre jobs fantasma
  const notFoundCountRef = useRef<Map<string, number>>(new Map());

  // Persist to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LOCAL_STORAGE_KEYS.TASKS_TRANSCRIPTION, JSON.stringify(state.transcriptionTasks));
  }, [state.transcriptionTasks]);

  // Ref estable dels tasks actius per evitar que el polling loop es reiniciï a cada dispatch
  const tasksRef = useRef(state.transcriptionTasks);
  tasksRef.current = state.transcriptionTasks;

  // Adaptive polling for active transcription jobs
  useEffect(() => {
    if (!useBackend) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loop = async () => {
      if (cancelled) return;

      const active = tasksRef.current.filter(
        t => t.status === 'queued' || t.status === 'processing'
      );
      if (active.length === 0) {
        // Tornar a comprovar en 5s per si s'afegeix un nou task
        timer = setTimeout(loop, 5000);
        return;
      }

      // Adaptive interval: more jobs → less aggressive
      let nextDelay = Math.min(15000, 2500 + active.length * 1500);

      for (const t of active) {
        if (cancelled) return;

        try {
          const j = await api.getJob(t.id);
          if (cancelled) return;

          // Reset comptador de 404 si el job existeix
          notFoundCountRef.current.delete(t.id);

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
        } catch (e: any) {
          const msg = String(e?.message || '');

          if (msg.includes('404') || msg.includes('not found') || msg.includes('Not Found')) {
            // Job no existeix al backend — incrementar comptador
            const count = (notFoundCountRef.current.get(t.id) || 0) + 1;
            notFoundCountRef.current.set(t.id, count);

            if (count >= 3) {
              // Després de 3 intents amb 404, marcar com a error i aturar polling
              console.warn(`[TranscriptionContext] Job ${t.id} retorna 404 (${count}x). Marcant com a error i aturant polling.`);
              dispatch({
                type: 'UPDATE_TRANSCRIPTION_TASK',
                payload: {
                  id: t.id,
                  patch: {
                    status: 'error',
                    error: 'Job no trobat al servidor (eliminat o expirat)',
                  },
                },
              });
            }
          } else if (msg.includes('429')) {
            nextDelay = 15000;
          }
          // Altres errors: silenci, es torna a intentar al pròxim cicle
        }
      }

      if (!cancelled) {
        timer = setTimeout(loop, nextDelay);
      }
    };

    timer = setTimeout(loop, 2000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  // Depèn NOMÉS de useBackend — usem tasksRef per evitar reinicis del loop
  }, [useBackend]);

  return (
    <TranscriptionContext.Provider value={{ transcriptionTasks: state.transcriptionTasks, transcriptionDispatch: dispatch }}>
      {children}
    </TranscriptionContext.Provider>
  );
};

export const useTranscription = () => useContext(TranscriptionContext);
