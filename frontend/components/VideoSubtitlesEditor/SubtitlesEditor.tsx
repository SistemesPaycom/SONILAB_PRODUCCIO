import React, { useState, useEffect } from 'react';
import { Segment, GeneralConfig } from '../../types/Subtitles';
import { OverlayConfig } from '../../types';
import SegmentItem from './SegmentItem';
import { EyeIcon, EyeOffIcon, EarIcon, Languages } from '../icons';
import { LinkIcon, LinkOffIcon } from '../VideoEditor/PlayerIcons';

interface SubtitlesEditorProps {
  title: string;
  segments: Segment[];
  activeId: number | null;
  isEditable: boolean;
  onSegmentChange: (segment: Segment) => void;
  onSegmentBlur: () => void;
  onSegmentClick: (id: number) => void;
  onSegmentFocus: (id: number) => void;
  onSplit?: (id: number) => void;
  onMerge?: (id: number) => void;
  syncEnabled: boolean;
  onSyncChange: (enabled: boolean) => void;
  overlayConfig: OverlayConfig;
  onOverlayConfigChange: (config: OverlayConfig) => void;
  generalConfig: GeneralConfig;
  autoScroll: boolean;
  onOpenAIOperations: (mode: 'whisper' | 'translate' | 'revision') => void;
}

const SubtitlesEditor: React.FC<SubtitlesEditorProps> = ({
  title,
  segments,
  activeId,
  isEditable,
  onSegmentChange,
  onSegmentBlur,
  onSegmentClick,
  onSegmentFocus,
  onSplit,
  onMerge,
  syncEnabled,
  onSyncChange,
  overlayConfig,
  onOverlayConfigChange,
  generalConfig,
  autoScroll,
  onOpenAIOperations
}) => {
  const [formatState, setFormatState] = useState({ bold: false, italic: false, underline: false });

  useEffect(() => {
    const updateFormatButtons = () => {
      setFormatState({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline')
      });
    };

    document.addEventListener('selectionchange', updateFormatButtons);
    return () => document.removeEventListener('selectionchange', updateFormatButtons);
  }, []);

  const handleFormatAction = (command: string) => {
    if (!isEditable) return;
    document.execCommand(command, false);
  };

  const handleNavigate = (direction: 'next' | 'prev', currentId: number) => {
    const idx = segments.findIndex(s => s.id === currentId);
    if (direction === 'next' && idx < segments.length - 1) {
        const nextId = segments[idx + 1].id as number;
        // Utilitzem el sistema de hints global per garantir consistència
        window.__SEG_CARET_HINT__ = {
            segmentId: nextId,
            target: 'first',
            where: 'end',
            ts: Date.now(),
            retries: 3
        };
        onSegmentClick(nextId);
    } else if (direction === 'prev' && idx > 0) {
        const prevId = segments[idx - 1].id as number;
        window.__SEG_CARET_HINT__ = {
            segmentId: prevId,
            target: 'lastNonEmpty',
            where: 'end',
            ts: Date.now(),
            retries: 3
        };
        onSegmentClick(prevId);
    }
  };

  return (
    <div 
        className="h-full flex flex-col bg-gray-900 text-gray-300 relative group/droparea"
        data-droptarget="true"
        data-drop-action="link-subs"
    >
      <div className="absolute inset-0 z-50 pointer-events-none border-4 border-dashed border-cyan-500/50 bg-cyan-600/10 flex items-center justify-center opacity-0 group-[.drop-hover]/droparea:opacity-100 transition-opacity duration-200">
        <div className="bg-cyan-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex flex-col items-center gap-2 scale-110">
            <span className="text-3xl">🗒️</span>
            <span className="text-sm font-black uppercase tracking-widest">Vincular Subtítols (SRT)</span>
        </div>
      </div>

      <header className="flex-shrink-0 flex flex-col border-b border-gray-700 bg-gray-800/80 backdrop-blur-md">
        <div className="flex items-center justify-between p-2">
            <h3 className="font-black text-[10px] uppercase tracking-widest text-gray-500 ml-2">{title}</h3>
            
            <div className="flex items-center gap-1.5 px-2">
                <button 
                    onClick={() => onOpenAIOperations('whisper')}
                    className="p-1.5 rounded-lg bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all"
                    title="Whisper (Àudio local)"
                >
                    <EarIcon size={16} />
                </button>

                <button 
                    onClick={() => onOpenAIOperations('translate')}
                    className="p-1.5 rounded-lg bg-violet-600/10 text-violet-400 hover:bg-violet-600 hover:text-white transition-all"
                    title="Traduir amb IA (Qwen)"
                >
                    <Languages size={16} />
                </button>

                <button 
                    onClick={() => onOpenAIOperations('revision')}
                    className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all font-black text-sm"
                    title="Revisar coherència (R)"
                >
                    R
                </button>

                <div className="w-px h-5 bg-gray-700 mx-1" />

                <button 
                    title="Mostrar subtítols sobre el vídeo"
                    onClick={() => onOverlayConfigChange({ ...overlayConfig, show: !overlayConfig.show })}
                    className={`p-1.5 rounded transition-colors ${overlayConfig.show ? 'text-blue-400 bg-blue-600/10' : 'text-gray-500 hover:bg-gray-700'}`}
                >
                    {overlayConfig.show ? <EyeIcon className="w-4 h-4" /> : <EyeOffIcon className="w-4 h-4" />}
                </button>
              
                <button 
                    title={syncEnabled ? "Desactivar sincronització" : "Activar sincronització"}
                    onClick={() => onSyncChange(!syncEnabled)}
                    className={`p-1.5 rounded transition-colors ${syncEnabled ? 'text-blue-400 bg-blue-600/10' : 'text-gray-500 hover:bg-gray-700'}`}
                >
                    {syncEnabled ? <LinkIcon className="w-4 h-4" /> : <LinkOffIcon className="w-4 h-4" />}
                </button>

                <div className="w-px h-5 bg-gray-700 mx-1" />

                <div className="flex items-center gap-1">
                    <button 
                        onMouseDown={(e) => { e.preventDefault(); handleFormatAction('bold'); }}
                        className={`w-7 h-7 rounded flex items-center justify-center text-xs font-black transition-colors ${formatState.bold ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-gray-700 text-gray-400'}`}
                        title="Negreta (Ctrl+B)"
                    >B</button>
                    <button 
                        onMouseDown={(e) => { e.preventDefault(); handleFormatAction('italic'); }}
                        className={`w-7 h-7 rounded flex items-center justify-center text-xs italic font-serif transition-colors ${formatState.italic ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-gray-700 text-gray-400'}`}
                        title="Cursiva (Ctrl+I)"
                    >I</button>
                    <button 
                        onMouseDown={(e) => { e.preventDefault(); handleFormatAction('underline'); }}
                        className={`w-7 h-7 rounded flex items-center justify-center text-xs underline transition-colors ${formatState.underline ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-gray-700 text-gray-400'}`}
                        title="Subratllat (Ctrl+U)"
                    >U</button>
                </div>
            </div>
        </div>
      </header>

      <div className="flex-grow overflow-y-auto custom-scrollbar">
        {segments.length > 0 ? (
            segments.map((segment, idx) => (
            <SegmentItem
                key={segment.id}
                segment={segment}
                isActive={activeId === segment.id}
                // FIX: Used 'isEditable' prop instead of undefined 'isEditing'
                isEditable={isEditable}
                onChange={onSegmentChange}
                onBlur={onSegmentBlur}
                onClick={onSegmentClick}
                onFocus={onSegmentFocus}
                onSplit={onSplit}
                onModifyMerge={idx < segments.length - 1 ? onMerge : undefined}
                generalConfig={generalConfig}
                autoScroll={autoScroll}
                onNavigate={(dir) => handleNavigate(dir, segment.id)}
            />
            ))
        ) : (
            <div className="flex items-center justify-center h-full text-gray-500 italic text-sm p-10 text-center">
                Prems el botó "Vincular" o les eines d'IA per començar.
            </div>
        )}
      </div>
    </div>
  );
};

export default SubtitlesEditor;