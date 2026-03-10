import React, { useRef, useState } from 'react';
import { Layout, EditorStyles } from '../../types';
import Editor from '../EditorDeGuions/Editor';
import { ColumnView } from '../EditorDeGuions/ColumnView';
import { CsvView } from '../EditorDeGuions/CsvView';
import { api } from '../../services/api';

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
  /** Si s'ha carregat des d'un projecte, conté l'ID per permetre pujar guions */
  projectId?: string | null;
  /** Callback cridat quan s'ha pujat/actualitzat el guió correctament */
  onGuionLoaded?: (text: string) => void;
}

/**
 * Panell esquerre del VideoSubtitlesEditorView: mostra el guió original
 * (script, CSV o columnes) en mode no editable per a la sincronització.
 * Si el projecte té ID de projecte i no hi ha contingut, mostra un botó
 * per pujar/associar el guió.
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
  onGuionLoaded,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const hasContent = content?.trim().length > 0;

  const handleUploadGuion = async (file: File) => {
    if (!projectId) return;
    setUploading(true);
    setUploadErr(null);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'txt') {
        const text = await file.text();
        await api.setProjectGuion(projectId, text, file.name);
        onGuionLoaded?.(text);
      } else {
        // DOCX/PDF: el backend extreu el text
        await api.uploadProjectGuionFile(projectId, file);
        // Tornem a obtenir el text per mostrar-lo
        const { text } = await api.getProjectGuion(projectId);
        if (text) onGuionLoaded?.(text);
      }
    } catch (e: any) {
      setUploadErr(e?.message || 'Error pujant el guió');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ width: `${width}%` }} className="flex flex-col min-w-0 h-full border-r border-gray-950">
      <header className="flex-shrink-0 h-11 border-b border-gray-700 bg-gray-800/80 flex items-center px-4 gap-3">
        <h3 className="font-black text-[10px] uppercase tracking-widest text-gray-500 flex-1">Guió Original</h3>

        {/* Botó per pujar/canviar guió (visible quan hi ha projectId) */}
        {projectId && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.pdf,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUploadGuion(f);
                e.currentTarget.value = '';
              }}
            />
            <button
              className="text-[9px] text-gray-500 hover:text-blue-300 bg-gray-700/50 hover:bg-blue-900/30 border border-gray-600/50 px-2 py-0.5 rounded transition-colors disabled:opacity-40"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Pujar o canviar el guió del projecte (DOCX, PDF, TXT)"
            >
              {uploading ? '⏳ Pujant…' : hasContent ? '↑ Canviar guió' : '↑ Pujar guió'}
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
        className="flex-grow overflow-y-auto flex flex-col items-center min-h-0 bg-[#111827] px-4 pb-12 pt-0 custom-scrollbar"
      >
        {!hasContent && projectId ? (
          // Estat buit — mostra instruccions per pujar el guió
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center pb-16">
            <div className="text-4xl opacity-20">📄</div>
            <div className="text-sm font-bold text-gray-500">Cap guió associat</div>
            <div className="text-xs text-gray-600 max-w-[200px]">
              Puja el guió del doblatge (DOCX, PDF o TXT) per comparar-lo
              amb els subtítols i detectar discrepàncies.
            </div>
            <button
              className="px-4 py-2 rounded-lg bg-blue-700/50 hover:bg-blue-600/60 border border-blue-600/50 text-blue-200 text-xs font-bold transition-colors"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? '⏳ Processant…' : '↑ Seleccionar guió'}
            </button>
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
