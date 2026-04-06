// components/ScriptExternalView.tsx
// Vista externa del guion de doblaje — ventana separada con sincronización temporal.
// Fase 5: sincronització bidireccional.
//   principal → externa: time-sync / snapshot → auto-scroll
//   externa → principal: seek (clic a capçalera de TAKE)
// Fase 7: controls de gestió del guió (vincular/canviar, corregir, estat local)

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLibrary } from '../context/Library/SonilabLibraryContext';
import { api } from '../services/api';
import { ColumnView } from './EditorDeGuions/ColumnView';
import { UserStylesProvider } from '../context/UserStyles/UserStylesContext';
import { buildTakeRangesFromScript, TakeRange } from '../utils/EditorDeGuions/takeRanges';
import { importStructuredScriptFromFile } from '../utils/Import/scriptImportPipeline';

function channelName(docId: string) {
  return `sonilab-script-sync:${docId}`;
}

/** Clau localStorage per guardar el guió d'un document concret (sense projecte de backend) */
function _localGuionKey(docId: string) {
  return `sonilab_guion_${docId}`;
}

/** Finestra de supressió anti-bucle: ignora time-sync rebuts poc després d'enviar un seek */
const SEEK_SUPPRESS_MS = 600;

interface ScriptExternalViewProps {
  docId: string;
}

const ScriptExternalView: React.FC<ScriptExternalViewProps> = ({ docId }) => {
  const { state, useBackend } = useLibrary();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [guionContent, setGuionContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  // ── Controls de gestió del guió ────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const currentDoc = state.documents.find((d) => d.id === docId);

  // ── Refs per sincronització ────────────────────────────────────────────────
  const scrollRef = useRef<HTMLElement>(null);
  const takeLayoutRef = useRef<Map<number, number>>(new Map());
  const activeTakeRef = useRef<number | null>(null);
  const lastScrolledTakeRef = useRef<number | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  /** Timestamp de l'últim seek enviat — per suprimir eco */
  const lastSeekSentRef = useRef(0);

  const handleTakeLayout = useCallback((takeNum: number, y: number) => {
    takeLayoutRef.current.set(takeNum, y);
  }, []);

  // ── Carrega projectId + guió ───────────────────────────────────────────────
  const loadGuion = useCallback(async () => {
    setLoading(true);
    try {
      if (useBackend) {
        const project = await api.getProjectBySrt(docId).catch(() => null);

        if (project?.id) {
          setProjectId(project.id);
          setProjectName(project.name || null);

          if (project.guionDocumentId) {
            const { text } = await api.getProjectGuion(project.id).catch(() => ({ text: null as string | null, guionDocumentId: null }));
            if (text) {
              setGuionContent(text);
              setLoading(false);
              return;
            }
          }
        }
      }

      const localGuion = localStorage.getItem(_localGuionKey(docId));
      if (localGuion) setGuionContent(localGuion);
    } catch {
      const localGuion = localStorage.getItem(_localGuionKey(docId));
      if (localGuion) setGuionContent(localGuion);
    } finally {
      setLoading(false);
    }
  }, [docId, useBackend]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadGuion();
    })();
    return () => { cancelled = true; };
  }, [loadGuion]);

  // ── Upload / canvi de guió ─────────────────────────────────────────────────
  const handleUploadGuion = useCallback(async (file: File) => {
    setUploading(true);
    setUploadErr(null);
    try {
      const result = await importStructuredScriptFromFile(file);

      if (projectId) {
        await api.setProjectGuion(projectId, result.content, result.fileName);
      } else if (docId) {
        localStorage.setItem(_localGuionKey(docId), result.content);
      }

      // Actualitza el contingut local
      setGuionContent(result.content);

      // Notifica la finestra principal perquè refresqui el seu estat
      bcRef.current?.postMessage({
        type: 'guion-updated',
        content: result.content,
        source: 'script-external',
      });
    } catch (e: any) {
      setUploadErr(e?.message || 'Error important el guió');
    } finally {
      setUploading(false);
    }
  }, [projectId, docId]);

  // ── Sol·licitar correcció a la finestra principal ──────────────────────────
  const handleRequestCorrection = useCallback(() => {
    bcRef.current?.postMessage({
      type: 'open-correction',
      source: 'script-external',
    });
  }, []);

  // ── Esborrar guió local ────────────────────────────────────────────────────
  const handleClearLocalGuion = useCallback(() => {
    localStorage.removeItem(_localGuionKey(docId));
    setGuionContent('');
    bcRef.current?.postMessage({
      type: 'guion-updated',
      content: '',
      source: 'script-external',
    });
  }, [docId]);

  // ── TakeRanges ─────────────────────────────────────────────────────────────
  const takeRanges = useMemo<TakeRange[]>(() => {
    if (!guionContent) return [];
    return buildTakeRangesFromScript({
      content: guionContent,
      takeStartMarginSeconds: 2,
      takeEndMarginSeconds: 2,
    });
  }, [guionContent]);

  // ── Scroll al TAKE actiu ───────────────────────────────────────────────────
  const scrollToTakeForTime = useCallback((time: number) => {
    if (takeRanges.length === 0) return;

    if (activeTakeRef.current !== null) {
      const current = takeRanges.find(r => r.takeNum === activeTakeRef.current);
      if (current && time >= current.start && time < current.end) return;
    }

    const containing = takeRanges.filter(r => time >= r.start && time < r.end);
    if (containing.length === 0) {
      activeTakeRef.current = null;
      return;
    }

    const nextActive = [...containing].sort((a, b) => a.takeNum - b.takeNum)[0];
    if (nextActive.takeNum !== activeTakeRef.current) {
      activeTakeRef.current = nextActive.takeNum;

      if (nextActive.takeNum !== lastScrolledTakeRef.current) {
        lastScrolledTakeRef.current = nextActive.takeNum;
        const yPos = takeLayoutRef.current.get(nextActive.takeNum);
        if (yPos !== undefined && scrollRef.current) {
          scrollRef.current.scrollTo({ top: yPos, behavior: 'smooth' });
        }
      }
    }
  }, [takeRanges]);

  // ── Clic a TAKE → seek a la principal ──────────────────────────────────────
  const handleTakeClick = useCallback((takeNum: number) => {
    const range = takeRanges.find(r => r.takeNum === takeNum);
    if (!range) return;

    // Registra el moment del seek per suprimir l'eco del time-sync que tornarà
    lastSeekSentRef.current = performance.now();

    // Scroll local immediat al take clicat
    activeTakeRef.current = takeNum;
    lastScrolledTakeRef.current = takeNum;
    const yPos = takeLayoutRef.current.get(takeNum);
    if (yPos !== undefined && scrollRef.current) {
      scrollRef.current.scrollTo({ top: yPos, behavior: 'smooth' });
    }

    // Envia seek a la principal
    bcRef.current?.postMessage({
      type: 'seek',
      currentTime: range.start,
      source: 'script-external',
    });
  }, [takeRanges]);

  // ── BroadcastChannel: receptor + emissor ───────────────────────────────────
  useEffect(() => {
    const bc = new BroadcastChannel(channelName(docId));
    bcRef.current = bc;

    bc.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'time-sync' || msg.type === 'snapshot') {
        // Anti-bucle: ignora time-sync que arriba poc després d'un seek nostre
        if (msg.type === 'time-sync' && performance.now() - lastSeekSentRef.current < SEEK_SUPPRESS_MS) {
          return;
        }
        if (typeof msg.currentTime === 'number') {
          scrollToTakeForTime(msg.currentTime);
        }
        if (msg.type === 'snapshot') {
          setConnected(true);
        }
      }

      // La principal notifica que el guió ha canviat (p.ex. des del panel embebut)
      if (msg.type === 'guion-updated' && msg.source !== 'script-external' && typeof msg.content === 'string') {
        setGuionContent(msg.content);
      }
    };

    bc.postMessage({ type: 'ready', source: 'script-external' });

    return () => {
      bc.close();
      bcRef.current = null;
    };
  }, [docId, scrollToTakeForTime]);

  // ── Drecera Ctrl+Espai → toggle play/pause a la principal ────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si el focus és en un camp editable
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;

      if ((e.ctrlKey || e.metaKey) && e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        bcRef.current?.postMessage({ type: 'toggle-play', source: 'script-external' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const hasContent = guionContent.trim().length > 0;
  const isLocalOnly = !projectId && hasContent;
  const canLink = Boolean(projectId || docId);

  return (
    <UserStylesProvider>
    <div className="h-screen w-screen text-gray-200 flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--th-bg-primary)' }}>
      {/* Header */}
      <header className="flex-shrink-0 border-b border-gray-700/50 px-4 py-3 flex items-center gap-3" style={{ backgroundColor: 'var(--th-bg-secondary)' }}>
        <span className="text-lg font-bold text-gray-100">
          Guió de Doblatge
        </span>
        {currentDoc && (
          <span className="text-sm text-gray-400 truncate">
            — {currentDoc.name}
          </span>
        )}

        {/* ── Controls de gestió del guió ──────────────────────────────────── */}
        <div className="flex items-center gap-2 ml-4">
          {/* Input ocult per a upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUploadGuion(f);
              e.currentTarget.value = '';
            }}
          />

          {/* Vincular / Canviar guió */}
          {canLink && (
            <button
              className="text-[9px] text-gray-400 hover:text-gray-200 bg-gray-700/50 hover:bg-white/5 border border-gray-600/50 px-2 py-1 rounded transition-colors disabled:opacity-40"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title={hasContent ? 'Canviar guió (DOCX o PDF)' : 'Vincular guió (DOCX o PDF)'}
            >
              {uploading ? '⏳ Pujant…' : hasContent ? '↑ Canviar guió' : '↑ Vincular guió'}
            </button>
          )}

          {/* Corregir */}
          {projectId && hasContent && (
            <button
              className="text-[9px] text-gray-400 hover:text-rose-300 bg-gray-700/50 hover:bg-rose-900/30 border border-gray-600/50 px-2 py-1 rounded transition-colors"
              onClick={handleRequestCorrection}
              title="Corregir text de la transcripció usant el guió (s'obre a la finestra principal)"
            >
              ✦ Corregir
            </button>
          )}

          {/* Indicador local */}
          {isLocalOnly && (
            <span
              className="text-[9px] text-amber-400/70 bg-amber-900/20 border border-amber-700/30 px-1.5 py-0.5 rounded"
              title="El guió s'ha desat localment al navegador. No es sincronitza amb el servidor."
            >
              local
            </span>
          )}

          {/* Esborrar guió local */}
          {isLocalOnly && (
            <button
              className="text-[9px] text-gray-600 hover:text-red-400 transition-colors"
              onClick={handleClearLocalGuion}
              title="Eliminar guió local"
            >
              ✕
            </button>
          )}
        </div>

        {/* Error d'upload */}
        {uploadErr && (
          <span className="text-[9px] text-red-400 bg-red-900/20 border border-red-700/30 px-2 py-0.5 rounded max-w-[200px] truncate" title={uploadErr}>
            {uploadErr}
          </span>
        )}

        {/* Estat de connexió */}
        <span
          className={`ml-auto text-[9px] px-2 py-0.5 rounded border ${
            connected
              ? 'text-green-400/80 bg-green-900/20 border-green-700/30'
              : 'text-gray-500 bg-gray-800/50 border-gray-700/30'
          }`}
          title={connected ? 'Connectat amb la finestra principal' : 'Esperant connexió…'}
        >
          {connected ? '● Sincronitzat' : '○ Desconnectat'}
        </span>
      </header>

      {/* Content */}
      <main
        ref={scrollRef as React.RefObject<HTMLElement>}
        data-script-scroll-container="true"
        className="flex-grow overflow-y-auto flex flex-col items-center min-h-0 px-4 pb-12 pt-6 custom-scrollbar"
        style={{ backgroundColor: 'var(--th-bg-primary)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-gray-500 text-sm">Carregant guió…</span>
          </div>
        ) : !hasContent ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center pb-16">
            <div className="text-4xl opacity-20">📄</div>
            <div className="text-sm font-bold text-gray-500">Cap guió associat</div>
            <div className="text-xs text-gray-600 max-w-[240px]">
              Puja un guió amb el botó «Vincular guió» de la barra superior.
            </div>
          </div>
        ) : (
          <div
            className="relative page-a4 bg-white text-gray-900 shadow-2xl rounded-sm p-10 transition-all duration-300 select-text"
            style={{ width: '210mm', maxWidth: '100%' }}
          >
            <ColumnView
              content={guionContent}
              setContent={() => {}}
              isEditable={false}
              col1Width={200}
              onTakeLayout={handleTakeLayout}
              onTakeClick={handleTakeClick}
            />
          </div>
        )}
      </main>
    </div>
    </UserStylesProvider>
  );
};

export default ScriptExternalView;
