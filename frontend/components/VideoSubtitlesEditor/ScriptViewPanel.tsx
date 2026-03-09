import React, { useRef } from 'react';
import { Layout, EditorStyles } from '../../types';
import Editor from '../EditorDeGuions/Editor';
import { ColumnView } from '../EditorDeGuions/ColumnView';
import { CsvView } from '../EditorDeGuions/CsvView';

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
}

/**
 * Panell esquerre del VideoSubtitlesEditorView: mostra el guió original
 * (script, CSV o columnes) en mode no editable per a la sincronització.
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
}) => {
  return (
    <div style={{ width: `${width}%` }} className="flex flex-col min-w-0 h-full border-r border-gray-950">
      <header className="flex-shrink-0 h-11 border-b border-gray-700 bg-gray-800/80 flex items-center px-4">
        <h3 className="font-black text-[10px] uppercase tracking-widest text-gray-500">Guió Original</h3>
      </header>
      <main
        ref={scrollRef as React.RefObject<HTMLElement>}
        data-script-scroll-container="true"
        className="flex-grow overflow-y-auto flex flex-col items-center min-h-0 bg-[#111827] px-4 pb-12 pt-0 custom-scrollbar"
      >
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
      </main>
    </div>
  );
};
