import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Layout, Document, EditorStyles, OverlayConfig, Id } from '../../types';
import Editor from '../EditorDeGuions/Editor';
import { ColumnView } from '../EditorDeGuions/ColumnView';
import { CsvView } from '../EditorDeGuions/CsvView';
import { VideoSubtitlesToolbar } from './VideoSubtitlesToolbar';
import { VideoPlaybackArea } from '../VideoEditor/VideoPlaybackArea';
import WaveformTimeline from '../VideoEditor/WaveformTimeline';
import SubtitlesEditor from './SubtitlesEditor';
import SyncLibraryModal from './SyncLibraryModal';
import SubtitleAIOperationsModal from './SubtitleAIOperationsModal';
import { useLibrary } from '../../context/Library/LibraryContext';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useDocumentHistory } from '../../hooks/useDocumentHistory';
import useLocalStorage from '../../hooks/useLocalStorage';
import { LOCAL_STORAGE_KEYS } from '../../constants';
import { useHorizontalPanelResize } from '../../hooks/usePanelResize';
import { SubtitleEditorProvider, useSubtitleEditor } from '../../contexts/SubtitleEditorContext';
import { useSubtitleAIOperations } from '../../hooks/useSubtitleAIOperations';
import { ScriptViewPanel } from './ScriptViewPanel';
import TranscriptCorrectionModal, { ChangeRecord as CorrectionChangeRecord, CorrectionResult } from './TranscriptCorrectionModal';

import { Segment, GeneralConfig } from '../../types/Subtitles';
import { parseSrt, serializeSrt } from '../../utils/SubtitlesEditor/srtParser';

import { api } from '../../services/api';
import { buildTakeRangesFromScript } from '../../utils/EditorDeGuions/takeRanges';
import { linkSegmentsToTakeRanges } from '../../utils/SubtitlesEditor/segmentTakeLinker';
import { buildTakeDialogMap, applyGuionDiff } from '../../utils/SubtitlesEditor/segmentGuionDiff';

type EditorView = 'script' | 'csv';

interface VideoSubtitlesEditorViewProps {
  currentDoc: Document;
  isEditing: boolean;
  layout: Layout;
  tabSize: number;
  col1Width: number;
  pageWidth: string;
  editorStyles: EditorStyles;
  editorView: EditorView;
  activeLang: string;
  onLayoutChange: (value: Layout) => void;
  onTabSizeChange: (value: number) => void;
  onPageWidthChange: (value: string) => void;
  onEditorViewChange: (value: EditorView) => void;
  onActiveLangChange: (lang: string) => void;
  onSetSourceLang: (lang: string) => void;
  onTranslate: (fromLang: string, toLang: string, taskId: string) => Promise<void>;
  handleTextChange: (newText: string, sourceView: 'script' | 'csv' | 'mono') => void;
  handleEditorBackgroundClick: (e: React.MouseEvent<HTMLElement>) => void;
}

const MIN_SEG_DURATION = 0.1; // seconds

const VideoSubtitlesEditorViewInner: React.FC<VideoSubtitlesEditorViewProps> = (props) => {
  const {
    currentDoc,
    isEditing,
    layout,
    tabSize,
    col1Width,
    pageWidth,
    editorStyles,
    editorView,
    activeLang,
    handleTextChange,
  } = props;

  const { splitPayloadRef } = useSubtitleEditor();
  const { state, getMediaFile, ensureMediaFile, dispatch, useBackend } = useLibrary();
  const { syncRequest } = state;
  const [takeMargin] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.TAKE_MARGIN, 2);
  const [takeStartMargin] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.TAKE_START_MARGIN, 2);
  const [maxLinesSubs] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.MAX_LINES_SUBS, 2);

  const currentContent = currentDoc?.contentByLang?.[activeLang] || '';
  const currentCsvContent = currentDoc?.csvContentByLang?.[activeLang] || '';

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  // ── Performance: throttle currentTime updates ─────────────────────────────
  // currentTime com a state causa rerenders a 60fps. Usem un ref per al valor
  // real i només actualitzem state a ~4fps (cada 250ms) o quan canvia el segment actiu.
  const currentTimeRef = useRef(0);
  const lastTimeUpdateRef = useRef(0);
  const activeSegIdByTimeRef = useRef<number | null>(null);
  const handleTimeUpdateThrottled = useCallback((t: number) => {
    currentTimeRef.current = t;
    const now = performance.now();
    // Comprovar si el segment actiu ha canviat (requer rerender)
    // Usem linkedSegmentsWithDiff via una ref per evitar recrear el callback
    const segsRef = linkedSegmentsWithDiffRef.current;
    const prevActiveId = activeSegIdByTimeRef.current;
    let newActiveId: number | null = null;
    if (segsRef) {
      for (const s of segsRef) {
        if (t >= s.startTime && t < s.endTime) {
          newActiveId = s.id as number;
          break;
        }
      }
    }
    const segChanged = newActiveId !== prevActiveId;
    if (segChanged) {
      activeSegIdByTimeRef.current = newActiveId;
      // Propagar el segment actiu per temps al state NOMÉS si la sincronització
      // subs↔timeline està activada. Quan està desactivada, el cursor del
      // timeline NO ha de seleccionar automàticament subtítols.
      if (newActiveId !== null && syncSubsEnabledRef.current) {
        setActiveSegmentId(newActiveId);
      }
    }

    // Actualitzar state si: canvi de segment, o cada 250ms per al toolbar/timecodes
    if (segChanged || now - lastTimeUpdateRef.current > 250) {
      lastTimeUpdateRef.current = now;
      setCurrentTime(t);
    }
  }, []);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [mediaDocId, setMediaDocId] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
const [autosave, setAutosave] = useLocalStorage<boolean>(LOCAL_STORAGE_KEYS.AUTOSAVE_SRT, false);
const autosaveTimer = useRef<any>(null);
const lastSavedRef = useRef<string>(currentDoc.contentByLang['_unassigned'] || '');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiMode, setAiMode] = useState<'whisper' | 'translate' | 'revision'>('whisper');

  const [autoScrollSubs, setAutoScrollSubs] = useState(true);
  const [autoScrollWave, setAutoScrollWave] = useState(true);
  const [scrollModeWave, setScrollModeWave] = useState<'stationary' | 'page'>('stationary');

  const [isScriptLinked, setIsScriptLinked] = useState(true);
  /** Panell del guió: col·lapsat per defecte per comoditat del lector */
  const [scriptPanelCollapsed, setScriptPanelCollapsed] = useState(true);
  const scriptScrollRef = useRef<HTMLElement>(null);
  const takeLayoutRef = useRef<Map<number, number>>(new Map());
  const activeTakeByTimeRef = useRef<number | null>(null);

  // ── Exclusió mútua: guió embebut ↔ finestra externa ──────────────────────
  const externalScriptWinRef = useRef<Window | null>(null);

  /** Obre (o reutilitza) la finestra externa del guió i col·lapsa el panell embebut */
  const handleOpenExternalScript = useCallback(() => {
    const docId = currentDoc?.id;
    if (!docId) return;
    // Reutilitza si ja és oberta
    if (externalScriptWinRef.current && !externalScriptWinRef.current.closed) {
      externalScriptWinRef.current.focus();
      // Assegura que el panell embebut estigui col·lapsat
      setScriptPanelCollapsed(true);
      return;
    }
    const url = `${window.location.origin}${window.location.pathname}#/script-view/${encodeURIComponent(docId)}`;
    externalScriptWinRef.current = window.open(
      url,
      `script-view-${docId}`,
      'width=560,height=820,resizable=yes,scrollbars=yes',
    );
    // Col·lapsar el panell embebut
    setScriptPanelCollapsed(true);
  }, [currentDoc?.id]);

  /** Toggle col·lapsar/expandir amb exclusió mútua */
  const handleToggleScriptCollapse = useCallback(() => {
    setScriptPanelCollapsed(prev => {
      if (prev) {
        // Expandint → tancar finestra externa
        if (externalScriptWinRef.current && !externalScriptWinRef.current.closed) {
          externalScriptWinRef.current.close();
        }
        externalScriptWinRef.current = null;
      }
      return !prev;
    });
  }, []);

  // ── Guió vinculat al projecte ─────────────────────────────────────────────
  const [guionContent, setGuionContent] = useState<string>('');
  const [guionProjectId, setGuionProjectId] = useState<string | null>(null);
  // Ref mirall per accedir a guionProjectId dins callbacks estables (deps=[])
  const guionProjectIdRef = useRef(guionProjectId);
  guionProjectIdRef.current = guionProjectId;

  // ── Correcció de transcripció amb guió — revisió inline ──────────────────
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  /** correctionHighlightIds: segments corregits i acceptats (rose background, 30s) */
  const [correctionHighlightIds, setCorrectionHighlightIds] = useState<Set<number>>(new Set());
  /**
   * pendingCorrections: mapa de correccions pendents de revisió inline.
   * Clau: segment ID (seg_idx del ChangeRecord, que coincideix amb Segment.id)
   * Valor: { proposed: text proposat, original: text original, change: registre de canvi }
   */
  const [pendingCorrections, setPendingCorrections] = useState<Map<number, { proposed: string; original: string; change: CorrectionChangeRecord }> | null>(null);
  /** pendingInsertions: propostes de nous subtítols (propose_new_cue) revisables per separat */
  const [pendingInsertions, setPendingInsertions] = useState<CorrectionChangeRecord[]>([]);

  /** Clau localStorage per al guió d'aquest document (persistència local sense backend) */
  const _localGuionKey = `sonilab_guion_${currentDoc?.id}`;

  /** Desa el guió a localStorage quan no hi ha projecte (per persistir entre sessions) */
  const handleGuionLoaded = useCallback((text: string) => {
    setGuionContent(text);
    // Si no hi ha projecte de backend, persistim localment
    if (!guionProjectId && currentDoc?.id) {
      if (text) {
        localStorage.setItem(_localGuionKey, text);
      } else {
        localStorage.removeItem(_localGuionKey);
      }
    }
    // Notificar la finestra externa perquè refresqui el guió
    scriptSyncChannelRef.current?.postMessage({
      type: 'guion-updated',
      content: text,
      source: 'main',
    });
  }, [guionProjectId, currentDoc?.id, _localGuionKey]);
  // Ref mirall per accedir a handleGuionLoaded dins el handler del BC (deps=[])
  const handleGuionLoadedRef = useRef(handleGuionLoaded);
  handleGuionLoadedRef.current = handleGuionLoaded;

  const [subsOverlayConfig, setSubsOverlayConfig] = useState<OverlayConfig>({
    show: true,
    position: 'bottom',
    offsetPx: 10,
    fontScale: 1,
  });

  const [editorMinGapMs, setEditorMinGapMs] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.EDITOR_MIN_GAP_MS, 160);

  const generalConfig = useMemo<GeneralConfig>(() => ({
    maxCharsPerLine: 40,
    maxLinesPerSubtitle: maxLinesSubs,
    minGapMs: editorMinGapMs,
  }), [maxLinesSubs, editorMinGapMs]);

  const [syncSubsEnabled, setSyncSubsEnabled] = useState(true);
  // Ref mirall per accedir a syncSubsEnabled dins callbacks estables (deps=[])
  const syncSubsEnabledRef = useRef(syncSubsEnabled);
  syncSubsEnabledRef.current = syncSubsEnabled;

  const initialSegments = useMemo(() => {
    const srtText = currentDoc.contentByLang['_unassigned'] || Object.values(currentDoc.contentByLang)[0] || '';
    return parseSrt(srtText);
  }, [currentDoc.id]);

  const subsHistory = useDocumentHistory<Segment[]>(currentDoc.id, initialSegments);
  const segments = subsHistory.present;
  const [activeSegmentId, setActiveSegmentId] = useState<number | null>(null);

  /**
   * Crida quan la correcció s'ha completat.
   * No aplica res directament — omple pendingCorrections per revisió inline per segment.
   * (Definit DESPRÉS de subsHistory per evitar Temporal Dead Zone)
   */
  const handleCorrectionReady = useCallback((result: CorrectionResult) => {
    const map = new Map<number, { proposed: string; original: string; change: CorrectionChangeRecord }>();
    const insertions: CorrectionChangeRecord[] = [];

    for (const change of result.changes) {
      // propose_new_cue (seg_idx === -1 o action === 'propose_new_cue') → llista separada
      if (change.action === 'propose_new_cue' || change.seg_idx === -1) {
        insertions.push(change);
      } else {
        map.set(change.seg_idx, {
          proposed: change.corrected,
          original: change.original,
          change,
        });
      }
    }

    setPendingCorrections(map.size > 0 ? map : null);
    setPendingInsertions(insertions);
  }, []);

  /** Accepta la correcció d'un segment: aplica el text proposat i el marca com a corregit. */
  const handleAcceptCorrection = useCallback((segId: number) => {
    const pending = pendingCorrections?.get(segId);
    if (!pending) return;
    const newSegs = segments.map((s) =>
      s.id === segId ? { ...s, originalText: pending.proposed, richText: pending.proposed } : s
    );
    subsHistory.commit(newSegs);
    // Rose highlight temporal (30s)
    setCorrectionHighlightIds((prev) => new Set([...prev, segId]));
    setTimeout(() => {
      setCorrectionHighlightIds((prev) => { const n = new Set(prev); n.delete(segId); return n; });
    }, 30_000);
    // Eliminar de pendents
    setPendingCorrections((prev) => {
      if (!prev) return null;
      const next = new Map(prev);
      next.delete(segId);
      return next.size > 0 ? next : null;
    });
  }, [pendingCorrections, segments, subsHistory]);

  /** Rebutja la correcció d'un segment: el descarta i segueix amb el text original. */
  const handleRejectCorrection = useCallback((segId: number) => {
    setPendingCorrections((prev) => {
      if (!prev) return null;
      const next = new Map(prev);
      next.delete(segId);
      return next.size > 0 ? next : null;
    });
  }, []);

  /** Accepta totes les correccions pendents en un sol commit. */
  const handleAcceptAllCorrections = useCallback(() => {
    if (!pendingCorrections || pendingCorrections.size === 0) return;
    const newSegs = segments.map((s) => {
      const pending = pendingCorrections.get(s.id as number);
      return pending ? { ...s, originalText: pending.proposed, richText: pending.proposed } : s;
    });
    subsHistory.commit(newSegs);
    const acceptedIds = new Set<number>(pendingCorrections.keys());
    setCorrectionHighlightIds(acceptedIds);
    setTimeout(() => setCorrectionHighlightIds(new Set()), 30_000);
    setPendingCorrections(null);
  }, [pendingCorrections, segments, subsHistory]);

  /** Descarta totes les correccions pendents sense aplicar cap canvi. */
  const handleRejectAllCorrections = useCallback(() => {
    setPendingCorrections(null);
  }, []);

  /**
   * Accepta una proposta d'inserció (propose_new_cue):
   * insereix un nou segment al SRT just després de proposed_after_seg_idx.
   */
  const handleAcceptInsertion = useCallback((change: CorrectionChangeRecord) => {
    const afterIdx = change.proposed_after_seg_idx ?? -1;
    // Crear nou Segment amb timecodes del change
    const newSeg: import('../../types/Subtitles').Segment = {
      id: Date.now(),  // ID temporal únic
      start: change.start,
      end: change.end,
      originalText: change.corrected,
      richText: change.corrected,
    } as any;

    // Inserir al lloc correcte dins la llista de segments
    const insertPos = afterIdx < 0
      ? 0
      : segments.findIndex((s) => s.id === afterIdx);
    const insertAt = insertPos < 0 ? segments.length : insertPos + 1;

    const newSegs = [
      ...segments.slice(0, insertAt),
      newSeg,
      ...segments.slice(insertAt),
    ];
    subsHistory.commit(newSegs);

    // Rose highlight temporal
    setCorrectionHighlightIds((prev) => new Set([...prev, newSeg.id as number]));
    setTimeout(() => {
      setCorrectionHighlightIds((prev) => { const n = new Set(prev); n.delete(newSeg.id as number); return n; });
    }, 30_000);

    // Eliminar de la llista de propostes
    setPendingInsertions((prev) => prev.filter((c) => c !== change));
  }, [segments, subsHistory]);

  /** Rebutja una proposta d'inserció sense aplicar-la. */
  const handleRejectInsertion = useCallback((change: CorrectionChangeRecord) => {
    setPendingInsertions((prev) => prev.filter((c) => c !== change));
  }, []);

  const { isAIProcessing, handleWhisperTranscription, handleAITranslation, handleAIRevision } =
    useSubtitleAIOperations({
      videoSrc,
      segments,
      onCommitSegments: (newSegs) => subsHistory.commit(newSegs),
      onCloseModal: () => setIsAIModalOpen(false),
    });

const handleSyncMedia = useCallback((doc: Document) => {
  // Usar stream URL directamente — sin descargar el archivo completo
  setVideoFile(null);
  setMediaDocId(doc.id);
  setVideoSrc(api.streamUrlWithToken(doc.id));
  setIsPlaying(false);
  setCurrentTime(0);
  setDuration(0);
}, []);

  const handleSyncSubtitles = useCallback((doc: Document) => {
    const srtText = doc.contentByLang['_unassigned'] || Object.values(doc.contentByLang)[0] || '';
    if (srtText) {
      const parsed = parseSrt(srtText);
      subsHistory.commit(parsed);
      setActiveSegmentId(parsed.length > 0 ? (parsed[0].id as number) : null);
    }
  }, [subsHistory]);

  useEffect(() => {
      if (!syncRequest) return;
      const doc = state.documents.find(d => d.id === syncRequest.docId);
      if (!doc) return;

      if (syncRequest.type === 'media') {
          handleSyncMedia(doc);
      } else if (syncRequest.type === 'subtitles') {
          handleSyncSubtitles(doc);
      }
      dispatch({ type: 'CLEAR_SYNC_REQUEST' });
  }, [syncRequest, dispatch, state.documents, handleSyncMedia, handleSyncSubtitles]);

  // ── Carrega el guió vinculat al projecte (si n'hi ha) ─────────────────────
  useEffect(() => {
    if (!currentDoc?.id) return;
    let cancelled = false;

    void (async () => {
      try {
        if (useBackend) {
          // 1. Obtenim el projecte a partir del document SRT
          const project = await api.getProjectBySrt(currentDoc.id).catch(() => null);
          if (cancelled) return;

          if (project?.id) {
            setGuionProjectId(project.id);

            // 2. Si el projecte té guió, el carregem des del backend
            if (project.guionDocumentId) {
              const { text } = await api.getProjectGuion(project.id).catch(() => ({ text: null, guionDocumentId: null }));
              if (!cancelled && text) {
                setGuionContent(text);
                return; // ← backend ha carregat el guió, no cal localStorage
              }
            }
          }
        }

        // 3. Fallback: guió desat localment al navegador
        if (!cancelled) {
          const localGuion = localStorage.getItem(`sonilab_guion_${currentDoc.id}`);
          if (localGuion) {
            setGuionContent(localGuion);
          }
        }
      } catch {
        // Silenciar errors (doc no és SRT d'un projecte)
        // Intentar localStorage com a fallback final
        if (!cancelled) {
          const localGuion = localStorage.getItem(`sonilab_guion_${currentDoc.id}`);
          if (localGuion) setGuionContent(localGuion);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [currentDoc?.id, useBackend]);
useEffect(() => {
  if (!autosave || !useBackend || !isEditing) return;

  // Use historyState.present (committed state) so autosave only fires on confirmed
  // actions (drag-end commit, text blur, split, merge, insert, delete, undo, redo)
  // — not on every intermediate updateDraft call during drag or typing.
  const srt = serializeSrt(subsHistory.historyState.present);
  if (srt === lastSavedRef.current) return;

  if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
  autosaveTimer.current = setTimeout(() => {
    // Only update lastSavedRef — do NOT dispatch UPDATE_DOCUMENT_CONTENTS here.
    // Dispatching changes state.documents, which re-triggers the video auto-load
    // effect (dep: state.documents) → handleSyncMedia → setCurrentTime(0) → playhead reset.
    void api.updateSrt(currentDoc.id, srt).then(() => {
      lastSavedRef.current = srt;
    }).catch(()=>{});
  }, 300);

  return () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
  };
}, [autosave, useBackend, isEditing, subsHistory.historyState.present, currentDoc.id]);
  // ── Guió efectiu: el guió vinculat al projecte té prioritat sobre el contingut del doc SRT ──
  const effectiveGuionContent = guionContent || currentContent;

  const takeRanges = useMemo(() => {
    // IMPORTANT: usar el guió (effectiveGuionContent) i NO el SRT (currentContent),
    // ja que els marcadors TAKE i timecodes estan al guió, no al SRT.
    return buildTakeRangesFromScript({
      content: effectiveGuionContent || '',
      takeStartMarginSeconds: takeStartMargin,
      takeEndMarginSeconds: takeMargin,
      durationSeconds: duration,
    });
  }, [effectiveGuionContent, duration, takeMargin, takeStartMargin]);

  const linkedSegments = useMemo(() => {
    return linkSegmentsToTakeRanges(segments, takeRanges);
  }, [segments, takeRanges]);

  const takeDialogMap = useMemo(
    () => buildTakeDialogMap(effectiveGuionContent),
    [effectiveGuionContent],
  );

  const linkedSegmentsWithDiff = useMemo(
    () => applyGuionDiff(linkedSegments, takeDialogMap),
    [linkedSegments, takeDialogMap],
  );

  // Ref estable per al throttle de currentTime (evita recrear handleTimeUpdateThrottled)
  const linkedSegmentsWithDiffRef = useRef(linkedSegmentsWithDiff);
  linkedSegmentsWithDiffRef.current = linkedSegmentsWithDiff;

  const handleTakeLayout = useCallback((num: number, y: number) => {
    takeLayoutRef.current.set(num, y);
  }, []);

  // Script auto-scroll: only scroll when the active TAKE changes (not every 250ms)
  const lastScrolledTakeRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isScriptLinked || takeRanges.length === 0) {
      activeTakeByTimeRef.current = null;
      return;
    }
    if (activeTakeByTimeRef.current !== null) {
      const current = takeRanges.find(r => r.takeNum === activeTakeByTimeRef.current);
      if (current && currentTime >= current.start && currentTime < current.end) return;
    }
    const containing = takeRanges.filter(r => currentTime >= r.start && currentTime < r.end);
    if (containing.length === 0) {
      activeTakeByTimeRef.current = null;
      return;
    }
    const nextActive = [...containing].sort((a, b) => a.takeNum - b.takeNum)[0];
    if (nextActive.takeNum !== activeTakeByTimeRef.current) {
      activeTakeByTimeRef.current = nextActive.takeNum;
      // Only scroll DOM if the take actually changed (avoid repeated scrollTo calls)
      if (nextActive.takeNum !== lastScrolledTakeRef.current) {
        lastScrolledTakeRef.current = nextActive.takeNum;
        const yPos = takeLayoutRef.current.get(nextActive.takeNum);
        if (yPos !== undefined && scriptScrollRef.current) {
          scriptScrollRef.current.scrollTo({ top: yPos, behavior: 'smooth' });
        }
      }
    }
  }, [currentTime, isScriptLinked, takeRanges]);

  // ── BroadcastChannel: emissor/receptor cap a la finestra externa del guió ───
  const scriptSyncChannelRef = useRef<BroadcastChannel | null>(null);
  const lastBroadcastRef = useRef(0);
  /** Timestamp de l'últim seek rebut de la finestra externa — per suprimir eco */
  const lastExternalSeekRef = useRef(0);
  const EXTERNAL_SEEK_SUPPRESS_MS = 600;

  // Obre el canal, escolta 'ready' i 'seek' de la finestra externa
  useEffect(() => {
    const docId = currentDoc?.id;
    if (!docId) return;

    const bc = new BroadcastChannel(`sonilab-script-sync:${docId}`);
    scriptSyncChannelRef.current = bc;

    bc.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg || typeof msg !== 'object') return;

      // Handshake: la finestra externa diu que està llesta → enviem snapshot
      if (msg.type === 'ready') {
        bc.postMessage({
          type: 'snapshot',
          currentTime: currentTimeRef.current,
          isPlaying,
          docId,
        });
      }

      // Seek des de la finestra externa → naveguem al temps sol·licitat
      if (msg.type === 'seek' && msg.source === 'script-external' && typeof msg.currentTime === 'number') {
        lastExternalSeekRef.current = performance.now();
        if (videoRef.current) videoRef.current.currentTime = msg.currentTime;
        currentTimeRef.current = msg.currentTime;
        setCurrentTime(msg.currentTime);
      }

      // Toggle play/pause des de la finestra externa (Ctrl+Espai)
      if (msg.type === 'toggle-play' && msg.source === 'script-external') {
        setIsPlaying((p) => !p);
      }

      // El guió s'ha actualitzat des de la finestra externa (upload/canvi/esborrat)
      if (msg.type === 'guion-updated' && msg.source === 'script-external' && typeof msg.content === 'string') {
        handleGuionLoadedRef.current(msg.content);
      }

      // Sol·licitud d'obrir el modal de correcció des de la finestra externa
      if (msg.type === 'open-correction' && msg.source === 'script-external') {
        if (guionProjectIdRef.current) {
          setIsCorrectionModalOpen(true);
        }
      }
    };

    return () => {
      bc.close();
      scriptSyncChannelRef.current = null;
    };
  }, [currentDoc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Envia time-sync throttlejat (~5fps) quan canvia currentTime
  useEffect(() => {
    const bc = scriptSyncChannelRef.current;
    if (!bc) return;

    // Anti-bucle: no reenviar si el canvi de temps ve d'un seek extern recent
    const now = performance.now();
    if (now - lastExternalSeekRef.current < EXTERNAL_SEEK_SUPPRESS_MS) return;

    // Throttle: màxim cada 200ms (5fps) per no saturar el canal
    if (now - lastBroadcastRef.current < 200) return;
    lastBroadcastRef.current = now;

    bc.postMessage({
      type: 'time-sync',
      currentTime,
      isPlaying,
    });
  }, [currentTime, isPlaying]);

  const onTogglePlay = useCallback(() => setIsPlaying((p) => !p), []);
  const onPlay = useCallback(() => setIsPlaying(true), []);
  const onPause = useCallback(() => setIsPlaying(false), []);
  const onSeek = useCallback((time: number) => {
    if (videoRef.current) videoRef.current.currentTime = time;
    currentTimeRef.current = time;
    setCurrentTime(time);
    // Seek és immediat — envia al canal sense throttle
    scriptSyncChannelRef.current?.postMessage({ type: 'time-sync', currentTime: time, isPlaying: true });
    lastBroadcastRef.current = performance.now();
  }, []);
  const onJumpTime = useCallback((seconds: number) => onSeek(Math.max(0, Math.min(duration, currentTimeRef.current + seconds))), [duration, onSeek]);
  const onChangeRate = useCallback((delta: number) => setPlaybackRate((rate) => {
    const newRate = Math.max(0.5, Math.min(2.0, parseFloat((rate + delta).toFixed(2))));
    if (videoRef.current) videoRef.current.playbackRate = newRate;
    return newRate;
  }), []);

  const handleSegmentFocus = useCallback((id: Id) => {
    if (isEditing) {
      const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
      setActiveSegmentId(numericId);
    }
  }, [isEditing]);

  const handleSegmentClick = useCallback((id: Id) => {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    setActiveSegmentId(numericId);
    const segment = linkedSegmentsWithDiff.find((s) => s.id === numericId);
    // Sync vídeo
    if (syncSubsEnabled && videoRef.current && segment) {
      onSeek(Math.max(0, segment.startTime - 0.05));
    }
    // Sync guió: scroll immediat al TAKE vinculat (independentment del vídeo)
    if (isScriptLinked && segment?.primaryTakeNum !== undefined) {
      const yPos = takeLayoutRef.current.get(segment.primaryTakeNum);
      if (yPos !== undefined && scriptScrollRef.current) {
        scriptScrollRef.current.scrollTo({ top: yPos, behavior: 'smooth' });
        activeTakeByTimeRef.current = segment.primaryTakeNum;
      }
    }
  }, [linkedSegmentsWithDiff, syncSubsEnabled, onSeek, isScriptLinked]);

  const onJumpSegment = useCallback((direction: 'prev' | 'next') => {
    if (takeRanges.length === 0) return;
    const t = currentTimeRef.current;
    const starts: number[] = Array.from<number>(new Set(takeRanges.map((r) => r.start))).sort((a, b) => a - b);
    if (direction === 'next') {
      const next = starts.find((s) => s > t + 0.1);
      if (next !== undefined) onSeek(next);
    } else {
      const prevs = starts.filter((s) => s < t - 0.5);
      if (prevs.length > 0) onSeek(prevs[prevs.length - 1]);
      else onSeek(starts[0]);
    }
  }, [takeRanges, onSeek]);

const handleSave = useCallback(() => {
  // En mode lectura (document bloquejat per un altre usuari), no guardem
  if (!isEditing) return;

  subsHistory.save((data) => {
    const srtContent = serializeSrt(data);

    // 1) estado local (para UI)
    dispatch({
      type: 'UPDATE_DOCUMENT_CONTENTS',
      payload: { documentId: currentDoc.id, lang: '_unassigned', content: srtContent, csvContent: '' },
    });

    // 2) ✅ persistencia backend
    if (useBackend) {
      void api.updateSrt(currentDoc.id, srtContent).catch((e) => {
        console.error('updateSrt failed', e);
      });
    }
  });
}, [isEditing, subsHistory, currentDoc.id, dispatch, useBackend]);

  const handleSplitSegmentAtCursor = useCallback((idParam?: number) => {
    const payload = splitPayloadRef.current;
    if (payload) {
        const idx = segments.findIndex(s => s.id === payload.id);
        if (idx === -1) return;

        const target = segments[idx];
        const totalDuration = target.endTime - target.startTime;
        const splitPoint = target.startTime + (totalDuration * payload.splitRatio);

        const newSeg1 = { ...target, endTime: splitPoint, originalText: payload.leftText, richText: payload.leftText };
        const newSeg2 = { id: Date.now(), startTime: splitPoint + 0.001, endTime: target.endTime, originalText: payload.rightText, richText: payload.rightText };

        const newSegments = [...segments];
        newSegments.splice(idx, 1, newSeg1, newSeg2);

        splitPayloadRef.current = null;
        subsHistory.commit(newSegments.map((s, i) => ({ ...s, id: i + 1 })));
        return;
    }

    const targetId = idParam || activeSegmentId;
    if (!targetId || !isEditing) return;

    const idx = segments.findIndex(s => s.id === targetId);
    if (idx === -1) return;

    const target = segments[idx];
    const half = target.startTime + (target.endTime - target.startTime) / 2;
    const txt = target.originalText;
    const mid = Math.floor(txt.length / 2);

    const newSeg1 = { ...target, endTime: half, originalText: txt.substring(0, mid).trim() };
    const newSeg2 = { id: Date.now(), startTime: half + 0.001, endTime: target.endTime, originalText: txt.substring(mid).trim() };

    const newSegments = [...segments];
    newSegments.splice(idx, 1, newSeg1, newSeg2);
    subsHistory.commit(newSegments.map((s, i) => ({ ...s, id: i + 1 })));
  }, [activeSegmentId, segments, isEditing, subsHistory]);

  const handleInsertSegment = useCallback((id: number, position: 'before' | 'after') => {
    if (!isEditing) return;
    const idx = segments.findIndex(s => s.id === id);
    if (idx === -1) return;

    const target = segments[idx];
    let newSeg: Segment;

    if (position === 'after') {
      const next = segments[idx + 1];
      const start = target.endTime + 0.1;
      const end = next ? Math.min(next.startTime - 0.1, start + 2) : start + 2;
      newSeg = { id: Date.now(), startTime: start, endTime: Math.max(end, start + 0.5), originalText: '' };
    } else {
      const prev = idx > 0 ? segments[idx - 1] : null;
      const end = target.startTime - 0.1;
      const start = prev ? Math.max(prev.endTime + 0.1, end - 2) : Math.max(0, end - 2);
      newSeg = { id: Date.now(), startTime: Math.max(0, start), endTime: Math.max(end, 0.5), originalText: '' };
    }

    const insertAt = position === 'after' ? idx + 1 : idx;
    const newSegments = [...segments];
    newSegments.splice(insertAt, 0, newSeg);
    subsHistory.commit(newSegments.map((s, i) => ({ ...s, id: i + 1 })));
  }, [isEditing, segments, subsHistory]);

  const handleDeleteSegment = useCallback((id: number) => {
    if (!isEditing || segments.length <= 1) return;
    const newSegments = segments.filter(s => s.id !== id);
    subsHistory.commit(newSegments.map((s, i) => ({ ...s, id: i + 1 })));
  }, [isEditing, segments, subsHistory]);

  const handleMergeSegmentWithNext = useCallback(() => {
    if (!activeSegmentId || !isEditing) return;
    const idx = segments.findIndex(s => s.id === activeSegmentId);
    if (idx === -1 || idx === segments.length - 1) return;

    const current = segments[idx];
    const next = segments[idx + 1];
    
    const mergedText = (current.originalText + '\n' + next.originalText).trim();
    const merged = { 
        ...current, 
        endTime: next.endTime, 
        originalText: mergedText,
        richText: mergedText
    };

    const newSegments = [...segments];
    newSegments.splice(idx, 2, merged);
    subsHistory.commit(newSegments.map((s, i) => ({ ...s, id: i + 1 })));
  }, [activeSegmentId, segments, isEditing, subsHistory]);

  useKeyboardShortcuts('subtitlesEditor', (action) => {
    switch (action) {
      case 'TOGGLE_PLAY_PAUSE': onTogglePlay(); break;
      case 'REWIND_5S': onJumpTime(-5); break;
      case 'FORWARD_5S': onJumpTime(5); break;
      case 'DECREASE_PLAYBACK_RATE': onChangeRate(-0.1); break;
      case 'INCREASE_PLAYBACK_RATE': onChangeRate(0.1); break;
      case 'JUMP_NEXT_SEGMENT': case 'NAVIGATE_SEGMENT_DOWN': onJumpSegment('next'); break;
      case 'JUMP_PREV_SEGMENT': case 'NAVIGATE_SEGMENT_UP': onJumpSegment('prev'); break;
      case 'UNDO': subsHistory.undo(); break;
      case 'REDO': subsHistory.redo(); break;
      case 'SAVE': handleSave(); break;
      case 'SPLIT_SEGMENT': handleSplitSegmentAtCursor(); break;
      case 'MERGE_SEGMENT': handleMergeSegmentWithNext(); break;
      case 'DELETE_ACTIVE_SEGMENT': {
        // Only fires if there is an active segment and focus is NOT inside an editable text field
        const active = document.activeElement as HTMLElement | null;
        if (activeSegmentId && !active?.isContentEditable) {
          handleDeleteSegment(activeSegmentId);
        }
        break;
      }
    }
  });

  const handleSegmentChange = useCallback((updated: Segment) => {
    if (!isEditing) return;
    const gap = (generalConfig.minGapMs ?? 160) / 1000;
    subsHistory.updateDraft(prev => {
      const idx = prev.findIndex(s => s.id === updated.id);
      if (idx === -1) return prev.map(s => s.id === updated.id ? updated : s);
      const prevSeg = idx > 0 ? prev[idx - 1] : null;
      const nextSeg = idx < prev.length - 1 ? prev[idx + 1] : null;
      let { startTime, endTime } = updated;
      if (prevSeg && startTime < prevSeg.endTime + gap) startTime = prevSeg.endTime + gap;
      if (nextSeg && endTime > nextSeg.startTime - gap) endTime = nextSeg.startTime - gap;
      if (endTime - startTime < MIN_SEG_DURATION) endTime = startTime + MIN_SEG_DURATION;
      return prev.map(s => s.id === updated.id ? { ...updated, startTime, endTime } : s);
    });
  }, [isEditing, subsHistory, generalConfig.minGapMs]);

  const handleSegmentBlur = useCallback(() => {
    if (!isEditing) return;
    subsHistory.commit();
  }, [isEditing, subsHistory]);

  const handleSegmentUpdate = useCallback((id: Id, newStart: number, newEnd: number) => {
    if (!isEditing) return;
    subsHistory.updateDraft(prev => prev.map((seg) => (seg.id === id ? { ...seg, startTime: newStart, endTime: newEnd } : seg)));
  }, [isEditing, subsHistory]);

  const handleSegmentUpdateEnd = useCallback(() => {
    if (!isEditing) return;
    subsHistory.commit();
  }, [isEditing, subsHistory]);

  const handleOpenAIOperations = useCallback((m: 'whisper' | 'translate' | 'revision') => {
    setAiMode(m);
    setIsAIModalOpen(true);
  }, []);

  const handleExportSrt = useCallback(() => {
    if (segments.length === 0) return;
    const srtContent = serializeSrt(segments);
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${currentDoc.name.replace(/\.slsf$/, '')}.srt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }, [segments, currentDoc.name]);

  // ── Panell principal: esquerra (guió+subs) | dreta (vídeo+toolbar) ──────────
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);

  const { widthPercent: mainSplitPercent, handleMouseDown: handleMainSplitMouseDown } =
    useHorizontalPanelResize(mainContainerRef as React.RefObject<HTMLElement>, 60, 25, 80);

  // ── Split intern del panell esquerre: guió | subtítols ───────────────────
  const scriptPanelDomRef = useRef<HTMLDivElement>(null);
  const { widthPercent: scriptSplitPercent, handleMouseDown: handleScriptSplitMouseDown } =
    useHorizontalPanelResize(leftPanelRef as React.RefObject<HTMLElement>, 35, 10, 65, scriptPanelDomRef as React.RefObject<HTMLElement>);

  // Primer: trobar quin segment és actiu (canvia poques vegades)
  const activeSegIdForPlayer = useMemo(() => {
    const seg = linkedSegmentsWithDiff.find((s: Segment) => currentTime >= s.startTime && currentTime < s.endTime);
    return seg?.id ?? null;
  }, [linkedSegmentsWithDiff, currentTime]);

  // Segon: construir l'objecte NOMÉS quan canvia el segment actiu (no cada 250ms)
  const activeSegmentForPlayer = useMemo(() => {
    if (activeSegIdForPlayer === null) return null;
    const seg = linkedSegmentsWithDiff.find((s: Segment) => s.id === activeSegIdForPlayer);
    return seg ? { id: seg.id, startTime: seg.startTime, endTime: seg.endTime, originalText: seg.originalText, translatedText: '' } : null;
  }, [activeSegIdForPlayer, linkedSegmentsWithDiff]);

  const playerProps = {
    isPlaying, currentTime, duration, onSeek, videoRef, src: videoSrc, segments: linkedSegmentsWithDiff, activeId: activeSegmentId,
    activeSegment: subsOverlayConfig.show ? activeSegmentForPlayer : null,
    overlayConfig: { original: subsOverlayConfig, translated: { show: false, position: 'bottom' as const, offsetPx: 10, fontScale: 1 } },
    onTimeUpdate: handleTimeUpdateThrottled, onDurationChange: setDuration, onPlay, onPause, onTogglePlay, onJumpSegment,
    videoFile, mediaDocId, onSegmentUpdate: handleSegmentUpdate, onSegmentUpdateEnd: handleSegmentUpdateEnd, onSegmentClick: handleSegmentClick, autoScroll: autoScrollWave, scrollMode: scrollModeWave,
  };

  return (
    <div className="flex flex-col h-full w-full text-gray-200" style={{ backgroundColor: 'var(--th-bg-primary)' }}>

      {/* ── Cos principal: panell esquerre + panell dret ───────────────────── */}
      <div ref={mainContainerRef} className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── PANELL ESQUERRE: Guió (esquerra) + Subtítols (dreta) ──────────── */}
        <div
          ref={leftPanelRef}
          className="flex min-h-0 overflow-hidden flex-shrink-0"
          style={{ width: `${mainSplitPercent}%` }}
        >
          {/* Guió — wrapper amb ref per al resize hook */}
          <div
            ref={scriptPanelDomRef}
            className={`h-full ${scriptPanelCollapsed ? 'flex-shrink-0' : 'min-w-0 flex-shrink-0'}`}
            style={{ width: scriptPanelCollapsed ? '42px' : `${scriptSplitPercent}%` }}
          >
            <ScriptViewPanel
              width={100}
              content={effectiveGuionContent}
              csvContent={currentCsvContent}
              editorView={editorView}
              layout={layout}
              tabSize={tabSize}
              col1Width={col1Width}
              editorStyles={editorStyles}
              pageWidth={pageWidth}
              onTakeLayout={handleTakeLayout}
              scrollRef={scriptScrollRef}
              projectId={guionProjectId}
              docId={currentDoc?.id}
              onGuionLoaded={handleGuionLoaded}
              onOpenCorrection={guionProjectId ? () => setIsCorrectionModalOpen(true) : undefined}
              collapsed={scriptPanelCollapsed}
              onToggleCollapse={handleToggleScriptCollapse}
              onOpenExternal={currentDoc?.id ? handleOpenExternalScript : undefined}
            />
          </div>
          {/* Divisor guió | subtítols */}
          {!scriptPanelCollapsed && (
            <div
              className="w-1.5 hover:bg-gray-500/50 cursor-col-resize flex-shrink-0 transition-colors" style={{ backgroundColor: 'var(--th-divider)' }}
              onMouseDown={handleScriptSplitMouseDown}
            />
          )}
          {/* Subtítols */}
          <div className="flex-grow h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--th-editor-bg)' }}>
            <SubtitlesEditor
              title="Subtítols SRT"
              segments={linkedSegmentsWithDiff}
              activeId={activeSegmentId}
              isEditable={isEditing}
              onSegmentChange={handleSegmentChange}
              onSegmentBlur={handleSegmentBlur}
              onSegmentClick={handleSegmentClick}
              onSegmentFocus={handleSegmentFocus}
              syncEnabled={syncSubsEnabled}
              onSyncChange={setSyncSubsEnabled}
              overlayConfig={subsOverlayConfig}
              onOverlayConfigChange={setSubsOverlayConfig}
              generalConfig={generalConfig}
              editorMinGapMs={editorMinGapMs}
              onEditorMinGapMsChange={setEditorMinGapMs}
              autoScroll={autoScrollSubs}
              onOpenAIOperations={handleOpenAIOperations}
              onSplit={handleSplitSegmentAtCursor}
              onMerge={handleMergeSegmentWithNext}
              onInsert={handleInsertSegment}
              onDelete={handleDeleteSegment}
              correctionHighlightIds={correctionHighlightIds.size > 0 ? correctionHighlightIds : undefined}
              pendingCorrections={pendingCorrections ?? undefined}
              onAcceptCorrection={handleAcceptCorrection}
              onRejectCorrection={handleRejectCorrection}
              onAcceptAllCorrections={handleAcceptAllCorrections}
              onRejectAllCorrections={handleRejectAllCorrections}
              pendingInsertions={pendingInsertions.length > 0 ? pendingInsertions : undefined}
              onAcceptInsertion={handleAcceptInsertion}
              onRejectInsertion={handleRejectInsertion}
            />
          </div>
        </div>

        {/* Divisor esquerra | dreta */}
        <div
          className="w-1.5 hover:bg-gray-500/50 cursor-col-resize flex-shrink-0 transition-colors" style={{ backgroundColor: 'var(--th-divider)' }}
          onMouseDown={handleMainSplitMouseDown}
        />

        {/* ── PANELL DRET: Vídeo (flex-grow) + Toolbar (fix) ───────────────── */}
        <div className="flex flex-col flex-grow min-h-0 overflow-hidden">
          <div className="flex-grow min-h-0 bg-black overflow-hidden">
            <VideoPlaybackArea {...playerProps} />
          </div>
          <div className="flex-shrink-0 border-t border-gray-700/50" style={{ backgroundColor: 'var(--th-bg-secondary)' }}>
            <VideoSubtitlesToolbar
              onOpenSync={() => setIsSyncModalOpen(true)} onExportSrt={handleExportSrt} isPlaying={isPlaying} onTogglePlay={onTogglePlay} onJumpSegment={onJumpSegment} onJumpTime={onJumpTime} currentTime={currentTime} duration={duration} onSeek={onSeek} playbackRate={playbackRate} onChangeRate={onChangeRate} isScriptLinked={isScriptLinked} onToggleScriptLink={() => setIsScriptLinked((p) => !p)} isEditable={isEditing} autoScrollWave={autoScrollWave} onToggleAutoScrollWave={() => setAutoScrollWave(!autoScrollWave)} scrollModeWave={scrollModeWave} onScrollModeChangeWave={setScrollModeWave} autoScrollSubs={autoScrollSubs} onToggleAutoScrollSubs={() => setAutoScrollSubs(!autoScrollSubs)}
              subtitleOverlayShow={subsOverlayConfig.show}
              onToggleSubtitleOverlay={() => setSubsOverlayConfig(c => ({ ...c, show: !c.show }))}
            />
          </div>
        </div>

      </div>

      {/* ── WAVEFORM inferior: alçada fixa 150px, amplada completa ───────────── */}
      <div className="flex-shrink-0 w-full" style={{ height: '150px' }}>
        <WaveformTimeline
          videoFile={videoFile}
          mediaDocId={mediaDocId}
          segments={linkedSegmentsWithDiff}
          currentTime={currentTime}
          duration={duration}
          onSeek={onSeek}
          isPlaying={isPlaying}
          videoRef={videoRef}
          activeId={activeSegmentId}
          onSegmentUpdate={handleSegmentUpdate}
          onSegmentUpdateEnd={handleSegmentUpdateEnd}
          onSegmentClick={handleSegmentClick}
          autoScroll={autoScrollWave}
          scrollMode={scrollModeWave}
          onUndo={() => subsHistory.undo()}
          onRedo={() => subsHistory.redo()}
          canUndo={subsHistory.canUndo}
          canRedo={subsHistory.canRedo}
          autoScrollWave={autoScrollWave}
          onToggleAutoScrollWave={() => setAutoScrollWave(!autoScrollWave)}
          scrollModeWave={scrollModeWave}
          onScrollModeChangeWave={setScrollModeWave}
          autosaveEnabled={autosave}
          onToggleAutosave={() => setAutosave(!autosave)}
          onSave={handleSave}
          onExportSrt={handleExportSrt}
          minGapMs={generalConfig.minGapMs}
        />
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {isSyncModalOpen && <SyncLibraryModal isOpen={isSyncModalOpen} onClose={() => setIsSyncModalOpen(false)} onSyncMedia={handleSyncMedia} onSyncSubtitles={handleSyncSubtitles} />}
      {isAIModalOpen && <SubtitleAIOperationsModal isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} mode={aiMode} isProcessing={isAIProcessing} onWhisper={handleWhisperTranscription} onTranslate={handleAITranslation} onRevision={handleAIRevision} />}
      {isCorrectionModalOpen && guionProjectId && (
        <TranscriptCorrectionModal
          isOpen={isCorrectionModalOpen}
          onClose={() => setIsCorrectionModalOpen(false)}
          projectId={guionProjectId}
          onCorrectionReady={handleCorrectionReady}
          hasGuion={Boolean(guionContent?.trim())}
        />
      )}
    </div>
  );
};

export const VideoSubtitlesEditorView: React.FC<VideoSubtitlesEditorViewProps> = (props) => (
  <SubtitleEditorProvider>
    <VideoSubtitlesEditorViewInner {...props} />
  </SubtitleEditorProvider>
);