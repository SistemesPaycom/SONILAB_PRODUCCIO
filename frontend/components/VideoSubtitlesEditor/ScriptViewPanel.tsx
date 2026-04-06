import React, { useRef, useState } from 'react';
import { Layout, EditorStyles } from '../../appTypes';
import Editor from '../EditorDeGuions/Editor';
import { ColumnView } from '../EditorDeGuions/ColumnView';
import { CsvView } from '../EditorDeGuions/CsvView';
import { api } from '../../services/api';
import { importStructuredScriptFromFile } from '../../utils/Import/scriptImportPipeline';

interface ScriptViewPanelProps {
  width: number; // percentage
  content: string;
  csvContent: string;
  editorView: 'script' | 'csv';
  layout: Layout;
  tabSize: number;
  col1Width: number;
  editorStyles: EditorStyles;
  pageWidth: string;
  onTakeLayout: (num: number, y: number) => void;
  scrollRef: React.RefObject<HTMLElement>;
  /** Si s'ha carregat des d'un projecte, conté l'ID per permetre pujar guions al backend */
  projectId?: string | null;
  /** ID del document SRT actual — per persistir el guió a localStorage quan no hi ha projecte */
  docId?: string | null;
  /** Callback cridat quan s'ha pujat/actualitzat el guió correctament */
  onGuionLoaded?: (text: string) => void;
  /** Callback per obrir el modal de correcció de transcripció (requereix projectId) */
  onOpenCorrection?: () => void;
  /** Mode col·lapsat: mostra només una barra vertical amb els controls essencials */
  collapsed?: boolean;
  /** Callback per canviar l'estat col·lapsat */
  onToggleCollapse?: () => void;
  /** Callback per obrir/reutilitzar la finestra externa del guió (gestionat pel pare) */
  onOpenExternal?: () => void;
}

/** Clau localStorage per guardar el guió d'un document concret (sense projecte de backend) */
function _localGuionKey(docId: string) {
  return `sonilab_guion_${docId}`;
}

/**
 * Panell esquerre del VideoSubtitlesEditorView: mostra el guió original
 * (script, CSV o columnes) en mode no editable per a la sincronització.
 *
 * Permet pujar/associar el guió en dos modes:
 *   ① Amb projecte (projectId):  desa al backend via API.
 *   ② Sense projecte (docId):   desa a localStorage per a persistència local.
 */
export const ScriptViewPanel: React.FC<ScriptViewPanelProps> = ({
  width,
  content,
  csvContent,
  editorView,
  layout,
  tabSize,
  col1Width,
  editorStyles,
  pageWidth,
  onTakeLayout,
  scrollRef,
  projectId,
  docId,
  onGuionLoaded,
  onOpenCorrection,
  collapsed,
  onToggleCollapse,
  onOpenExternal,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const hasContent = content?.trim().length > 0;
  // Mostra el botó si hi ha un projecte de backend O un docId local
  const canLink = Boolean(projectId || docId);
  // Indica que el guió s'ha desat localment (sense projecte de backend)
  const isLocalOnly = !projectId && hasContent && Boolean(docId);

  const handleUploadGuion = async (file: File) => {
    setUploading(true);
    setUploadErr(null);
    try {
      // ── Pipeline compartit: DOCX/PDF → TXT canònic estructurat ─────────
      // Usem exactament la mateixa lògica que la importació convencional
      // (LibraryView.tsx). No hi ha branques paral·leles.
      const result = await importStructuredScriptFromFile(file);

      if (projectId) {
        // ── Mode backend: desa al projecte via api.setProjectGuion ─────────
        // El TXT canònic resultant es desa com a Document al backend
        // i es vincula al projecte. Ni el DOCX ni el PDF original s'envien.
        await api.setProjectGuion(projectId, result.content, result.fileName);
        onGuionLoaded?.(result.content);
      } else if (docId) {
        // ── Mode local: desa a localStorage amb el TXT canònic ────────────
        localStorage.setItem(_localGuionKey(docId), result.content);
        onGuionLoaded?.(result.content);
      }
    } catch (e: any) {
      setUploadErr(e?.message || 'Error important el guió');
    } finally {
      setUploading(false);
    }
  };

  const handleClearLocalGuion = () => {
    if (!docId) return;
    localStorage.removeItem(_localGuionKey(docId));
    onGuionLoaded?.('');
  };

  // ── Mode col·lapsat: barra vertical estreta amb controls essencials ────────
  if (collapsed) {
    return (
      <div className="flex flex-col h-full border-r border-gray-950 flex-shrink-0" style={{ width: '42px', backgroundColor: 'var(--th-header-bg)' }}>
        {/* Input ocult per a upload (necessari encara que estigui col·lapsat) */}
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

        {/* Botó per expandir */}
        {onToggleCollapse && (
          <button
            className="w-full h-9 flex items-center justify-center text-gray-500 hover:text-gray-200 hover:bg-gray-700/50 transition-colors border-b border-gray-700/50"
            onClick={onToggleCollapse}
            title="Expandir panell del guió"
          >
            <span className="text-sm">▶</span>
          </button>
        )}

        {/* Títol vertical */}
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          <span
            className="font-black text-[9px] uppercase tracking-[0.2em] text-gray-600 whitespace-nowrap"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Guió
          </span>
        </div>

        {/* Botons d'acció apilats verticalment */}
        <div className="flex flex-col items-center gap-1 pb-2">
          {/* Finestra externa */}
          {onOpenExternal && (
            <button
              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-200 hover:bg-white/5 rounded transition-colors"
              onClick={onOpenExternal}
              title="Obrir guió en finestra separada"
            >
              <span className="text-sm">⧉</span>
            </button>
          )}

          {/* Vincular/canviar guió */}
          {canLink && (
            <button
              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-200 hover:bg-white/5 rounded transition-colors disabled:opacity-40"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title={hasContent ? 'Canviar guió (DOCX o PDF)' : 'Vincular guió (DOCX o PDF)'}
            >
              <span className="text-sm">{uploading ? '⏳' : '↑'}</span>
            </button>
          )}

          {/* Corregir */}
          {projectId && hasContent && onOpenCorrection && (
            <button
              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-rose-300 hover:bg-rose-900/30 rounded transition-colors"
              onClick={onOpenCorrection}
              title="Corregir transcripció amb el guió"
            >
              <span className="text-sm">✦</span>
            </button>
          )}

          {/* Indicador local */}
          {isLocalOnly && (
            <span
              className="text-[8px] text-amber-400/70 px-1"
              title="Guió local (no sincronitzat amb el servidor)"
            >
              loc
            </span>
          )}
        </div>

        {uploadErr && (
          <div className="px-1 py-1 text-[8px] text-red-400 text-center border-t border-red-800/30">
            Error
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ width: `${width}%` }} className="flex flex-col min-w-0 h-full border-r border-gray-950">
      <header className="flex-shrink-0 h-11 border-b border-gray-700 flex items-center px-4 gap-3" style={{ backgroundColor: 'var(--th-header-bg)' }}>
        {/* Botó per col·lapsar */}
        {onToggleCollapse && (
          <button
            className="text-gray-500 hover:text-gray-200 transition-colors mr-1"
            onClick={onToggleCollapse}
            title="Minimitzar panell del guió"
          >
            <span className="text-xs">◀</span>
          </button>
        )}

        <h3 className="font-black text-[10px] uppercase tracking-widest text-gray-500 flex-1">
          Guió Original
        </h3>

        {/* Botó per obrir el guió en una finestra externa */}
        {onOpenExternal && (
          <button
            className="text-[9px] text-gray-500 hover:text-gray-200 bg-gray-700/50 hover:bg-white/5 border border-gray-600/50 px-2 py-0.5 rounded transition-colors"
            onClick={onOpenExternal}
            title="Obrir guió en finestra separada"
          >
            ⧉ Finestra
          </button>
        )}

        {/* Indicador de guió local (sense sincronització al backend) */}
        {isLocalOnly && (
          <span
            className="text-[9px] text-amber-400/70 bg-amber-900/20 border border-amber-700/30 px-1.5 py-0.5 rounded"
            title="El guió s'ha desat localment al navegador. No es sincronitza amb el servidor."
          >
            local
          </span>
        )}

        {/* Botó per esborrar el guió local */}
        {isLocalOnly && (
          <button
            className="text-[9px] text-gray-600 hover:text-red-400 transition-colors"
            onClick={handleClearLocalGuion}
            title="Eliminar guió local"
          >
            ✕
          </button>
        )}

        {/* Botó per corregir la transcripció amb el guió (només si hi ha projecte i guió carregat) */}
        {projectId && hasContent && onOpenCorrection && (
          <button
            className="text-[9px] text-gray-500 hover:text-rose-300 bg-gray-700/50 hover:bg-rose-900/30 border border-gray-600/50 px-2 py-0.5 rounded transition-colors"
            onClick={onOpenCorrection}
            title="Corregir text de la transcripció usant el guió (preserva timecodes)"
          >
            ✦ Corregir
          </button>
        )}

        {/* Botó per pujar/canviar guió */}
        {canLink && (
          <>
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
            <button
              className="text-[9px] text-gray-500 hover:text-gray-200 bg-gray-700/50 hover:bg-white/5 border border-gray-600/50 px-2 py-0.5 rounded transition-colors disabled:opacity-40"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Pujar o canviar el guió (DOCX o PDF)"
            >
              {uploading ? '⏳ Processant…' : hasContent ? '↑ Canviar guió' : '↑ Vincular guió'}
            </button>
          </>
        )}
      </header>

      {uploadErr && (
        <div className="flex-shrink-0 bg-red-900/30 border-b border-red-800/50 px-4 py-1.5 text-xs text-red-300">
          {uploadErr}
        </div>
      )}

      <main
        ref={scrollRef as React.RefObject<HTMLElement>}
        data-script-scroll-container="true"
        className="flex-grow overflow-y-auto flex flex-col items-center min-h-0 px-4 pb-12 pt-0 custom-scrollbar"
        style={{ backgroundColor: 'var(--th-bg-primary)' }}
      >
        {!hasContent ? (
          // Estat buit — mostra instruccions per vincular el guió
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center pb-16">
            <div className="text-4xl opacity-20">📄</div>
            <div className="text-sm font-bold text-gray-500">Cap guió associat</div>
            <div className="text-xs text-gray-600 max-w-[200px]">
              {'Puja el guió del doblatge (DOCX o PDF) per comparar-lo amb els subtítols i detectar discrepàncies.'}
            </div>
            {canLink && (
              <button
                className="px-4 py-2 rounded-lg text-xs font-bold transition-colors" style={{ backgroundColor: 'var(--th-accent-muted)', color: 'var(--th-accent-text)', border: '1px solid var(--th-focus-ring)' }}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? '⏳ Processant…' : '↑ Seleccionar guió'}
              </button>
            )}
          </div>
        ) : (
          <div
            id="page-content-area-subs"
            className="relative page-a4 bg-white text-gray-900 shadow-2xl rounded-sm p-10 transition-all duration-300 pointer-events-none select-none"
            style={{ width: pageWidth, maxWidth: '100%' }}
          >
            {editorView === 'csv' ? (
              <CsvView content={csvContent} setContent={() => {}} isEditable={false} pageWidth={pageWidth} />
            ) : layout === 'mono' ? (
              <Editor content={content} setContent={() => {}} isEditable={false} tabSize={tabSize} />
            ) : (
              <ColumnView
                content={content}
                setContent={() => {}}
                isEditable={false}
                col1Width={col1Width}
                editorStyles={editorStyles}
                onTakeLayout={onTakeLayout}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
};
