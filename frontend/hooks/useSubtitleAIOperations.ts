import { useState, useCallback } from 'react';
import { Segment } from '../types/Subtitles';

interface UseSubtitleAIOperationsOptions {
  videoSrc: string | null;
  segments: Segment[];
  onCommitSegments: (newSegments: Segment[]) => void;
  onCloseModal: () => void;
}

/**
 * Centralitza els handlers d'operacions d'IA per al editor de subtítols.
 * Compartit per VideoSubtitlesEditorView i VideoSrtStandaloneEditorView.
 */
export function useSubtitleAIOperations({
  videoSrc,
  segments,
  onCommitSegments,
  onCloseModal,
}: UseSubtitleAIOperationsOptions) {
  const [isAIProcessing, setIsAIProcessing] = useState(false);

  const handleWhisperTranscription = useCallback(async (_lang: string) => {
    if (!videoSrc) { alert('Vinculeu un vídeo primer.'); return; }
    setIsAIProcessing(true);
    try {
      // TODO: integrar pipeline WhisperX real
      await new Promise(r => setTimeout(r, 2000));
      onCloseModal();
    } finally {
      setIsAIProcessing(false);
    }
  }, [videoSrc, onCloseModal]);

  const handleAITranslation = useCallback(async (_from: string, _to: string) => {
    if (segments.length === 0) return;
    setIsAIProcessing(true);
    try {
      // TODO: integrar Qwen translation
      await new Promise(r => setTimeout(r, 2000));
      onCloseModal();
    } finally {
      setIsAIProcessing(false);
    }
  }, [segments.length, onCloseModal]);

  const handleAIRevision = useCallback(async () => {
    if (segments.length === 0) return;
    setIsAIProcessing(true);
    try {
      // TODO: integrar revisió coherència
      await new Promise(r => setTimeout(r, 1500));
      const newSegments = segments.map((s, idx) => (idx === 2 ? { ...s, hasDiff: true } : s));
      onCommitSegments(newSegments);
      alert('Revisió IA finalitzada.');
      onCloseModal();
    } finally {
      setIsAIProcessing(false);
    }
  }, [segments, onCommitSegments, onCloseModal]);

  return { isAIProcessing, handleWhisperTranscription, handleAITranslation, handleAIRevision };
}
