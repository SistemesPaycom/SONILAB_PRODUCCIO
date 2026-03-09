import React, { createContext, useContext, useRef } from 'react';

export interface CaretHint {
  segmentId?: number;
  where: 'start' | 'end';
  target: 'first' | 'lastNonEmpty' | number;
  ts: number;
  retries?: number;
}

export interface SplitPayload {
  id: number;
  leftText: string;
  rightText: string;
  splitRatio: number;
}

interface SubtitleEditorContextValue {
  caretHintRef: React.MutableRefObject<CaretHint | null>;
  splitPayloadRef: React.MutableRefObject<SplitPayload | null>;
}

const SubtitleEditorContext = createContext<SubtitleEditorContextValue | null>(null);

/**
 * Proveïdor que substitueix window.__SEG_CARET_HINT__ i window.__SEG_SPLIT_PAYLOAD__
 * per refs compartits dins l'arbre de components. S'utilitzen refs (no state) per
 * preservar la semàntica síncrona necessària als useLayoutEffect de SegmentItem.
 */
export const SubtitleEditorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const caretHintRef = useRef<CaretHint | null>(null);
  const splitPayloadRef = useRef<SplitPayload | null>(null);

  return (
    <SubtitleEditorContext.Provider value={{ caretHintRef, splitPayloadRef }}>
      {children}
    </SubtitleEditorContext.Provider>
  );
};

export const useSubtitleEditor = (): SubtitleEditorContextValue => {
  const ctx = useContext(SubtitleEditorContext);
  if (!ctx) throw new Error('useSubtitleEditor must be used inside SubtitleEditorProvider');
  return ctx;
};
