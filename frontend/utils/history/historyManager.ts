// utils/history/historyManager.ts

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
  saved: T;
  limit: number;
}

/**
 * Inicialitza l'objecte d'historial.
 */
export function initHistory<T>(initial: T, limit = 200): HistoryState<T> {
  return {
    past: [],
    present: initial,
    future: [],
    saved: initial,
    limit,
  };
}

/**
 * Registra un nou canvi a l'historial.
 */
export function commitHistory<T>(state: HistoryState<T>, next: T): HistoryState<T> {
  // Si el nou estat és idèntic al present, no fem res
  if (JSON.stringify(state.present) === JSON.stringify(next)) return state;

  const newPast = [...state.past, state.present];
  if (newPast.length > state.limit) newPast.shift();

  return {
    ...state,
    past: newPast,
    present: next,
    future: [],
  };
}

/**
 * Desfà l'última acció.
 */
export function undoHistory<T>(state: HistoryState<T>): HistoryState<T> {
  if (state.past.length === 0) return state;

  const previous = state.past[state.past.length - 1];
  const newPast = state.past.slice(0, state.past.length - 1);

  return {
    ...state,
    past: newPast,
    present: previous,
    future: [state.present, ...state.future],
  };
}

/**
 * Refà una acció desfeta.
 */
export function redoHistory<T>(state: HistoryState<T>): HistoryState<T> {
  if (state.future.length === 0) return state;

  const next = state.future[0];
  const newFuture = state.future.slice(1);

  return {
    ...state,
    past: [...state.past, state.present],
    present: next,
    future: newFuture,
  };
}

/**
 * Marca l'estat actual com a guardat (baseline per al dirty check).
 */
export function markSavedAsHistory<T>(state: HistoryState<T>): HistoryState<T> {
  return {
    ...state,
    saved: state.present,
  };
}

/**
 * Comprova si hi ha canvis respecte a l'últim guardat.
 */
export function isHistoryDirty<T>(state: HistoryState<T>): boolean {
  return JSON.stringify(state.present) !== JSON.stringify(state.saved);
}
