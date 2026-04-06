// context/Library/TranslationContext.tsx
import { LOCAL_STORAGE_KEYS } from '@/constants';
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { TranslationTask } from '../../appTypes';

interface TranslationState {
  translationTasks: TranslationTask[];
}

type TranslationAction =
  | { type: 'ADD_TRANSLATION_TASK'; payload: TranslationTask }
  | { type: 'UPDATE_TRANSLATION_TASK_STATUS'; payload: { id: string; status: 'completed' | 'error' } }
  | { type: 'CLEAR_COMPLETED_TASKS' };

function loadLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function translationReducer(state: TranslationState, action: TranslationAction): TranslationState {
  switch (action.type) {
    case 'ADD_TRANSLATION_TASK':
      return { ...state, translationTasks: [action.payload, ...state.translationTasks] };
    case 'UPDATE_TRANSLATION_TASK_STATUS':
      return {
        ...state,
        translationTasks: state.translationTasks.map(t =>
          t.id === action.payload.id ? { ...t, status: action.payload.status } : t
        ),
      };
    case 'CLEAR_COMPLETED_TASKS':
      return { ...state, translationTasks: state.translationTasks.filter(t => t.status === 'processing') };
    default:
      return state;
  }
}

interface TranslationContextValue {
  translationTasks: TranslationTask[];
  translationDispatch: React.Dispatch<TranslationAction>;
}

const TranslationContext = createContext<TranslationContextValue>({
  translationTasks: [],
  translationDispatch: () => null,
});

export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(translationReducer, {
    translationTasks: loadLocal<TranslationTask[]>(LOCAL_STORAGE_KEYS.TASKS_TRANSLATION, []),
  });

  // Persist to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LOCAL_STORAGE_KEYS.TASKS_TRANSLATION, JSON.stringify(state.translationTasks));
  }, [state.translationTasks]);

  return (
    <TranslationContext.Provider value={{ translationTasks: state.translationTasks, translationDispatch: dispatch }}>
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslation = () => useContext(TranslationContext);
