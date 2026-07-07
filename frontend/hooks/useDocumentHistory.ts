// hooks/useDocumentHistory.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  HistoryState, initHistory, commitHistory, undoHistory, redoHistory, markSavedAsHistory, isHistoryDirty
} from '../utils/history/historyManager';
import { createSavePoint } from '../utils/history/versionStore';

export function useDocumentHistory<T>(docId: string, initialValue: T) {
  const [history, setHistory] = useState<HistoryState<T>>(() => initHistory(initialValue));
  const [draft, setDraft] = useState<T>(initialValue);

  // Ref per evitar loops i tenir sempre l'últim ID processat
  const lastDocId = useRef(docId);
  const lastInitialRef = useRef(initialValue);

  // RESET quan canviem de document
  useEffect(() => {
    if (lastDocId.current !== docId) {
      const newHistory = initHistory(initialValue);
      setHistory(newHistory);
      setDraft(initialValue);
      lastDocId.current = docId;
      lastInitialRef.current = initialValue;
    }
  }, [docId, initialValue]);

  // SYNC: quan el contingut extern arriba tard (càrrega asíncrona del backend)
  // i l'historial encara no ha estat editat, acceptem el nou valor.
  // Això passa quan el component monta amb docId correcte però initialValue buit,
  // i després el tree carrega i initialValue canvia a contingut real.
  useEffect(() => {
    if (
      lastDocId.current === docId &&
      initialValue !== lastInitialRef.current
    ) {
      const prevInitial = lastInitialRef.current;
      lastInitialRef.current = initialValue;

      // Només sincronitzem si l'usuari NO ha editat res (historial buit)
      setHistory(prev => {
        if (prev.past.length === 0) {
          return initHistory(initialValue);
        }
        return prev;
      });
      setDraft(prev => {
        // Si el draft encara és el valor inicial anterior (no editat), actualitzem
        if (prev === prevInitial) {
          return initialValue;
        }
        return prev;
      });
    }
  }, [docId, initialValue]);

  // Sincronitzem el draft quan el present canvia (via undo/redo)
  useEffect(() => {
    setDraft(history.present);
  }, [history.present]);

  /**
   * Actualitza el draft. Admet valors directes o funcions d'actualització.
   */
  const updateDraft = useCallback((next: T | ((prev: T) => T)) => {
    setDraft(prev => {
      const nextValue = typeof next === 'function' ? (next as any)(prev) : next;
      return nextValue;
    });
  }, []);

  /**
   * Commiteja l'estat actual (el draft) a la pila de l'historial (UNDO).
   */
  const commit = useCallback((value?: T) => {
    setHistory(prev => {
      // Si ens passen un valor directament (com en un Split), l'utilitzem.
      // Si no, utilitzem el draft actual.
      const valueToCommit = value !== undefined ? value : draft;
      return commitHistory(prev, valueToCommit);
    });
  }, [draft]);

  const undo = useCallback(() => {
    setHistory(prev => undoHistory(prev));
  }, []);

  const redo = useCallback(() => {
    setHistory(prev => redoHistory(prev));
  }, []);

  /**
   * Guarda el document persistentment i reseteja el dirty state.
   */
  const save = useCallback((onSaveAction: (data: T) => void) => {
    setHistory(prev => {
        // Fem un commit de l'estat actual abans de salvar
        const afterCommit = commitHistory(prev, draft);
        const afterSave = markSavedAsHistory(afterCommit);

        // Cridem l'acció de persistència externa
        onSaveAction(draft);
        createSavePoint(docId, draft, "Desat manual (Ctrl+S)");

        return afterSave;
    });
  }, [docId, draft]);

  return {
    present: draft,
    historyState: history,
    updateDraft,
    commit,
    undo,
    redo,
    save,
    isDirty: isHistoryDirty(history) || JSON.stringify(draft) !== JSON.stringify(history.present),
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
