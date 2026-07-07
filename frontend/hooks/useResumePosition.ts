// hooks/useResumePosition.ts
import { useEffect, useRef, useState } from 'react';
import type { Segment } from '../types/Subtitles';
import { api } from '../services/api';

interface ResumeState {
  currentTime: number;
  activeSegmentId: number | null;
  updatedAt?: string;
}

interface UseResumePositionParams {
  docId: string; // currentDoc.id — clau de reinici
  useBackend: boolean;
  duration: number; // 0 fins que el vídeo reporta metadata
  currentTime: number;
  activeSegmentId: number | null;
  segments: Segment[]; // per resoldre el temps d'un segment (cas sense vídeo)
  mediaMissing: boolean; // = linkedMediaMissing de la vista (media que falla)
  seekTo: (t: number) => void; // vídeo: video.currentTime=t + setCurrentTime; sense vídeo: setCurrentTime
  setActiveSegmentId: (id: number) => void;
}

const INTERVAL = 5000;
const SETTLE_TIMEOUT_MS = 8000;

export function useResumePosition(p: UseResumePositionParams): { flush: () => void } {
  const {
    docId,
    useBackend,
    duration,
    currentTime,
    activeSegmentId,
    segments,
    mediaMissing,
    seekTo,
    setActiveSegmentId,
  } = p;

  // ── Refs de control ────────────────────────────────────────────────────
  const projectIdRef = useRef<string | null>(null);
  const mediaExpectedRef = useRef<boolean>(false);
  const resumeAppliedRef = useRef<boolean>(false);
  const lastSavedKeyRef = useRef<string>('');
  const lastWriteRef = useRef<number>(0);
  const trailingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<{ t: number; seg: number | null }>({ t: 0, seg: null });
  const flushRef = useRef<() => void>(() => {});
  const useBackendRef = useRef<boolean>(useBackend);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── State (per re-avaluar els efectes) ─────────────────────────────────
  const [pendingResume, setPendingResume] = useState<ResumeState | null>(null);
  const [resumeLoaded, setResumeLoaded] = useState<boolean>(false);
  const [resumeApplied, setResumeApplied] = useState<boolean>(false);
  const [forceSettle, setForceSettle] = useState<boolean>(false);

  // ── Desat (definit abans dels miralls de render) ───────────────────────
  const commit = () => {
    // llegeix latestRef AL DISPAR
    if (!useBackendRef.current || !resumeAppliedRef.current || !projectIdRef.current) return;
    const { t, seg } = latestRef.current;
    const key = `${t}|${seg}`;
    if (key === lastSavedKeyRef.current) return;
    lastWriteRef.current = performance.now();
    lastSavedKeyRef.current = key;
    void api.saveResumeState(projectIdRef.current, { currentTime: t, activeSegmentId: seg }).catch(() => {});
  };

  const flush = () => {
    if (trailingTimerRef.current) {
      clearTimeout(trailingTimerRef.current);
      trailingTimerRef.current = null;
    }
    commit();
  };

  // ── Miralls de render ──────────────────────────────────────────────────
  resumeAppliedRef.current = resumeApplied;
  useBackendRef.current = useBackend;
  flushRef.current = flush;

  // ── 1) Reinici + flush ─────────────────────────────────────────────────
  useEffect(() => {
    // cos: reset inicial d'aquesta instància
    projectIdRef.current = null;
    mediaExpectedRef.current = false;
    setPendingResume(null);
    setResumeLoaded(false);
    setResumeApplied(false);
    setForceSettle(false);
    resumeAppliedRef.current = false;
    lastSavedKeyRef.current = '';
    lastWriteRef.current = 0;
    latestRef.current = { t: 0, seg: null };
    if (trailingTimerRef.current) {
      clearTimeout(trailingTimerRef.current);
      trailingTimerRef.current = null;
    }
    if (settleTimeoutRef.current) {
      clearTimeout(settleTimeoutRef.current);
      settleTimeoutRef.current = null;
    }
    return () => {
      flushRef.current(); // flush del projecte sortint en desmuntar
    };
  }, [docId]);

  // ── 2) Fetch del resum ─────────────────────────────────────────────────
  useEffect(() => {
    if (!useBackend) {
      setResumeLoaded(true);
      return;
    }
    let cancelled = false;
    void api
      .getProjectBySrt(docId)
      .then((proj) => {
        if (cancelled || !proj?.id) return;
        projectIdRef.current = proj.id;
        mediaExpectedRef.current = !!proj.mediaDocumentId; // esperem vídeo?
        const rs = proj.settings?.resumeState;
        if (rs && typeof rs.currentTime === 'number' && rs.currentTime > 0) setPendingResume(rs);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setResumeLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [docId, useBackend]);

  // ── 2b) Xarxa de seguretat (settle timeout) ────────────────────────────
  useEffect(() => {
    if (!resumeLoaded || !projectIdRef.current) return;
    settleTimeoutRef.current = setTimeout(() => setForceSettle(true), SETTLE_TIMEOUT_MS);
    return () => {
      if (settleTimeoutRef.current) {
        clearTimeout(settleTimeoutRef.current);
        settleTimeoutRef.current = null;
      }
    };
  }, [resumeLoaded]);

  // ── 3) Aplicació de la restauració ─────────────────────────────────────
  useEffect(() => {
    if (resumeApplied || !resumeLoaded) return;
    const mediaReady = duration > 0; // derivat, no és paràmetre
    const noVideo = mediaMissing || forceSettle || !mediaExpectedRef.current;
    const markApplied = () => {
      if (settleTimeoutRef.current) {
        clearTimeout(settleTimeoutRef.current);
        settleTimeoutRef.current = null;
      }
      lastWriteRef.current = performance.now();
      resumeAppliedRef.current = true;
      setResumeApplied(true);
    };
    if (pendingResume == null) {
      // Res a restaurar: marca "aplicat" perquè el desat pugui començar,
      // però només quan l'editor s'ha estabilitzat (evita marcar en buit).
      if (mediaReady || (noVideo && segments.length > 0)) markApplied();
      return;
    }
    if (mediaReady) {
      // cas amb vídeo
      const target = Math.min(pendingResume.currentTime, Math.max(0, duration - 0.1));
      seekTo(target);
      // activeSegmentId es deriva de currentTime (efecte de sync de la vista) → no el forcem
      markApplied();
    } else if (noVideo && segments.length > 0) {
      // cas sense vídeo (o fallback)
      const seg =
        pendingResume.activeSegmentId != null
          ? segments.find((s) => s.id === pendingResume.activeSegmentId)
          : null;
      if (seg) {
        seekTo(seg.startTime);
        setActiveSegmentId(seg.id);
      } // temps i segment coherents
      markApplied();
    }
    // altrament: media esperat i encara carregant → esperar (l'efecte es re-executa amb els deps)
  }, [resumeLoaded, pendingResume, duration, mediaMissing, forceSettle, segments]);

  // ── 4) Desat (throttle amb flanc principal + de cua) ───────────────────
  useEffect(() => {
    latestRef.current = { t: Math.round(currentTime * 10) / 10, seg: activeSegmentId };
    if (!useBackend || !resumeApplied || !projectIdRef.current) return;
    const elapsed = performance.now() - lastWriteRef.current;
    if (elapsed >= INTERVAL) {
      commit(); // flanc principal
      return;
    }
    if (!trailingTimerRef.current) {
      // flanc de cua: un sol timer, NO reiniciat
      trailingTimerRef.current = setTimeout(() => {
        trailingTimerRef.current = null;
        commit();
      }, INTERVAL - elapsed);
    }
  }, [currentTime, activeSegmentId, useBackend, resumeApplied]);

  return { flush };
}
