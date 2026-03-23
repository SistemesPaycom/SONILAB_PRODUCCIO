import React, { useState, useEffect, useRef } from 'react';
import { Layout, Document, TranslationTask } from '../../types';
import { A4_WIDTH_PX, SUPPORTED_LANGUAGES } from '../../constants';
import * as Icons from '../icons';
import { exportToPdf, exportToTxt, exportToXlsx, exportTakesCsv } from '../../utils/EditorDeGuions/exportUtils';
import { useLibrary } from '../../context/Library/LibraryContext';

type EditorView = 'script' | 'csv';

interface ToolbarProps {
  currentDoc: Document | null;
  layout: Layout;
  onLayoutChange: (value: Layout) => void;
  tabSize: number;
  onTabSizeChange: (value: number) => void;
  pageWidth: string;
  onPageWidthChange: (value: string) => void;
  editorView: EditorView;
  onEditorViewChange: (value: EditorView) => void;
  activeLang: string;
  onActiveLangChange: (lang: string) => void;
  onSetSourceLang: (lang: string) => void;
  onTranslate: (fromLang: string, toLang: string, taskId: string) => Promise<void>;
  
  // Historial (opcionals per retrocompatibilitat)
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

const CustomDropdown: React.FC<{ 
  label: React.ReactNode; 
  options: { value: string; label: string; icon?: React.ReactNode }[]; 
  value: string; 
  onSelect: (val: any) => void;
  className?: string;
  disabled?: boolean;
}> = ({ label, options, value, onSelect, className = "", disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel = options.find(o => o.value === value)?.label || label;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-1.5 bg-gray-700/50 hover:bg-gray-700 text-sm font-semibold rounded-md transition-colors border border-gray-600/50 ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      >
        <span className="truncate max-w-[100px]">{selectedLabel}</span>
        {!disabled && <Icons.ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
        {disabled && <Icons.LockIcon size={12} className="text-gray-400" />}
      </button>
      {isOpen && (
        <div className="absolute left-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onSelect(opt.value); setIsOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${value === opt.value ? 'text-white' : 'text-gray-300 hover:bg-gray-700'}`}
              style={value === opt.value ? { backgroundColor: 'var(--th-accent)' } : undefined}
            >
              {opt.icon}
              <span className="truncate">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const PageWidthSlider: React.FC<{ value: number; onChange: (v: number) => void; onClose: () => void }> = ({ value, onChange, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const progress = ((value - A4_WIDTH_PX) / (1600 - A4_WIDTH_PX)) * 100;

  return (
    <div ref={panelRef} className="absolute top-full right-0 mt-2 bg-gray-800 border border-gray-700 p-4 rounded-lg shadow-2xl z-50 flex flex-col items-center gap-3 w-16">
      <div className="h-48 relative w-6 flex flex-col items-center">
        <div className="absolute inset-0 w-1.5 bg-white rounded-full left-1/2 -translate-x-1/2"></div>
        <div 
          className="absolute bottom-0 w-1.5 rounded-full left-1/2 -translate-x-1/2 transition-all duration-75" style={{ backgroundColor: 'var(--th-accent)' }}
          style={{ height: `${progress}%` }}
        ></div>
        <input 
          type="range"
          min={A4_WIDTH_PX}
          max={1600}
          step={4}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ 
            writingMode: 'bt-lr', 
            WebkitAppearance: 'slider-vertical',
            width: '24px'
          } as any}
        />
        <div 
          className="absolute w-4 h-4 border-2 border-white rounded-full left-1/2 -translate-x-1/2 pointer-events-none shadow-md transition-all duration-75" style={{ backgroundColor: 'var(--th-accent)' }}
          style={{ bottom: `calc(${progress}% - 8px)` }}
        ></div>
      </div>
      <span className="text-[10px] font-mono font-bold" style={{ color: 'var(--th-accent-text)' }}>{value}px</span>
    </div>
  );
};

const TranslationModal: React.FC<{ 
  currentDoc: Document; 
  onClose: () => void; 
  onTranslate: (from: string, to: string, taskId: string) => Promise<void>;
  onSetSource: (lang: string) => void;
}> = ({ currentDoc, onClose, onTranslate, onSetSource }) => {
  const { dispatch } = useLibrary();
  const [fromLang, setFromLang] = useState(currentDoc.sourceLang || 'ca');
  const [toLang, setToLang] = useState('');

  const docLangs = Object.keys(currentDoc.contentByLang).filter(c => c !== '_unassigned');
  const toOptions = SUPPORTED_LANGUAGES.filter(l => !docLangs.includes(l.code));

  const handleStart = async () => {
    if (!fromLang || !toLang) return;
    const taskId = `task_${Date.now()}`;
    const newTask: TranslationTask = {
      id: taskId,
      documentId: currentDoc.id,
      documentName: currentDoc.name,
      fromLang,
      toLang,
      status: 'processing',
      timestamp: new Date().toISOString()
    };
    dispatch({ type: 'ADD_TRANSLATION_TASK', payload: newTask });
    onClose();
    if (!currentDoc.sourceLang) onSetSource(fromLang);
    onTranslate(fromLang, toLang, taskId);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--th-accent-muted)' }}>
            <Icons.Languages className="w-8 h-8" style={{ color: 'var(--th-accent-text)' }} />
          </div>
          <h2 className="text-2xl font-bold text-white">Traducció Intel·ligent</h2>
          <p className="text-gray-400 text-sm mt-1">Traducció optimitzada per a sincronia labial</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Idioma Original</label>
            <select value={fromLang} onChange={e => setFromLang(e.target.value)} className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm outline-none transition-colors">
              <option value="">Selecciona origen...</option>
              {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </div>
          <div className="flex justify-center py-1"><div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-gray-400">&darr;</div></div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Idioma a Traduir</label>
            <select value={toLang} onChange={e => setToLang(e.target.value)} className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm outline-none transition-colors">
              <option value="">Selecciona destí...</option>
              {toOptions.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-8 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold transition-colors">Cancel·lar</button>
          <button disabled={!fromLang || !toLang} onClick={handleStart} className="flex-[2] px-4 py-3 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" style={{ backgroundColor: 'var(--th-btn-primary-bg)', color: 'var(--th-btn-primary-text)' }}>Començar Traducció</button>
        </div>
      </div>
    </div>
  );
};

const Toolbar: React.FC<ToolbarProps> = (props) => {
  const { currentDoc, layout, onLayoutChange, pageWidth, onPageWidthChange, editorView, onEditorViewChange, activeLang, onActiveLangChange, onUndo, onRedo, canUndo, canRedo } = props;
  const [isExporting, setIsExporting] = useState(false);
  const [showWidthSlider, setShowWidthSlider] = useState(false);
  const [showTranslateModal, setShowTranslateModal] = useState(false);

  const isLocked = currentDoc?.isLocked;
  const sliderValue = parseInt(pageWidth, 10) || A4_WIDTH_PX;

  const handleFormat = (command: string) => !isLocked && document.execCommand(command, false);

  const handleExport = async () => {
    if (!currentDoc) return;
    setIsExporting(true);
    try {
      if (editorView === 'csv') exportToXlsx(currentDoc, activeLang);
      else if (layout === 'mono') exportToTxt(currentDoc, activeLang);
      else await exportToPdf(currentDoc);
    } catch (error) {
      alert("Error en l'exportació.");
    } finally {
      setIsExporting(false);
    }
  };

  const versionOptions = [];
  if (currentDoc) {
    if (currentDoc.sourceLang) {
      versionOptions.push({ value: currentDoc.sourceLang, label: 'Original' });
      Object.keys(currentDoc.contentByLang).filter(c => c !== '_unassigned' && c !== currentDoc.sourceLang).forEach(code => {
          const name = SUPPORTED_LANGUAGES.find(l => l.code === code)?.name || code.toUpperCase();
          versionOptions.push({ value: code, label: name });
        });
    } else versionOptions.push({ value: activeLang, label: 'Original' });
  }

  return (
    <div className="bg-gray-800 h-16 flex items-center justify-between px-6 border-b border-gray-700 shadow-lg select-none">
      <div className="flex items-center gap-4">
        <CustomDropdown label="Mode" value={editorView} onSelect={onEditorViewChange} disabled={isLocked} options={[{ value: 'script', label: 'Guió', icon: <Icons.ScriptEditorIcon className="w-4 h-4" /> }, { value: 'csv', label: 'Dades', icon: <Icons.Folder className="w-4 h-4" /> }]} />

        {editorView === 'script' && <CustomDropdown label="Vista" value={layout} onSelect={onLayoutChange} options={[{ value: 'mono', label: 'Mono' }, { value: 'cols', label: 'Columnes' }]} />}

        <div className="w-px h-6 bg-gray-700 mx-1 opacity-50" />

        {/* BOTONS UNDO/REDO */}
        <div className="flex items-center gap-0.5">
            <button 
                disabled={!canUndo}
                onClick={onUndo}
                className="p-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-20 transition-all"
                title="Desfer (Ctrl+Z)"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l5-5m-5 5l5 5" />
                </svg>
            </button>
            <button 
                disabled={!canRedo}
                onClick={onRedo}
                className="p-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-20 transition-all"
                title="Refer (Ctrl+Shift+Z)"
            >
                <svg className="w-4 h-4 scale-x-[-1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l5-5m-5 5l5 5" />
                </svg>
            </button>
        </div>

        {layout === 'cols' && editorView === 'script' && (
          <div className={`flex items-center gap-1 bg-gray-700/30 p-1 rounded-md border border-gray-600/30 ${isLocked ? 'opacity-30 pointer-events-none' : ''}`}>
            <button onClick={() => handleFormat('bold')} className="w-8 h-8 rounded hover:bg-gray-600 transition-colors font-bold text-white text-sm" title="Negreta">B</button>
            <button onClick={() => handleFormat('italic')} className="w-8 h-8 rounded hover:bg-gray-600 transition-colors italic text-white text-sm" title="Cursiva">I</button>
            <button onClick={() => handleFormat('underline')} className="w-8 h-8 rounded hover:bg-gray-600 transition-colors underline text-white text-sm" title="Subratllat">U</button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {currentDoc && (
          <>
            <button onClick={() => !isLocked && setShowTranslateModal(true)} disabled={isLocked} className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all shadow-lg active:scale-95 flex-shrink-0 font-bold ${isLocked ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'text-white'}`} style={!isLocked ? { backgroundColor: 'var(--th-btn-primary-bg)' } : undefined}>
              {isLocked ? <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" style={{ borderTopColor: 'var(--th-accent-text)' }}></div> : <Icons.Languages className="w-4 h-4" />}
              <span>{isLocked ? 'Traduint...' : 'Traduir'}</span>
            </button>
            <div className="w-px h-6 bg-gray-700"></div>
            <CustomDropdown label="Versió" value={activeLang} onSelect={onActiveLangChange} options={versionOptions} className="min-w-[140px]" />
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button onClick={handleExport} disabled={isExporting || !currentDoc} className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-40" title="Exportar">
          {isExporting ? <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin"></div> : <Icons.Download className="w-4 h-4" />}
        </button>
        <div className="relative">
          <button onClick={() => setShowWidthSlider(!showWidthSlider)} className={`w-10 h-10 flex items-center justify-center font-bold text-sm rounded-lg border transition-all ${showWidthSlider ? 'text-white' : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'}`} style={showWidthSlider ? { backgroundColor: 'var(--th-accent)', borderColor: 'var(--th-accent)' } : undefined} title="Ajustar amplada de pàgina">&lt;F&gt;</button>
          {showWidthSlider && <PageWidthSlider value={sliderValue} onChange={(v) => onPageWidthChange(`${v}px`)} onClose={() => setShowWidthSlider(false)} />}
        </div>
      </div>

      {showTranslateModal && currentDoc && <TranslationModal currentDoc={currentDoc} onClose={() => setShowTranslateModal(false)} onTranslate={props.onTranslate} onSetSource={props.onSetSourceLang} />}
    </div>
  );
};

export default Toolbar;