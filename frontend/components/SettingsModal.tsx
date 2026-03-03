import React, { useState } from 'react';
import { EditorStyles, EditorStyle, AppShortcuts, Shortcut } from '../types';
import { DEFAULT_SHORTCUTS, LOCAL_STORAGE_KEYS } from '../constants';
import useLocalStorage from '../hooks/useLocalStorage';
import { useAuth } from '../context/Auth/AuthContext';

interface SettingsModalProps {
  onClose: () => void;
  editorStyles: EditorStyles;
  onStylesChange: (styles: EditorStyles) => void;
}

type ActiveTab = 'general' | 'editor' | 'shortcuts' | 'reader';
type ShortcutApp = keyof AppShortcuts;

const FONT_FACES = ['sans-serif', 'serif', 'monospace', 'Arial', 'Verdana', 'Times New Roman'];

const StyleControlGroup: React.FC<{ label: string; styleKey: keyof EditorStyles; styles: EditorStyles; onChange: (styles: EditorStyles) => void }> = ({ label, styleKey, styles, onChange }) => {
    const currentStyle = styles[styleKey];
    const handleStyleChange = (field: keyof EditorStyle, value: any) => {
        onChange({ ...styles, [styleKey]: { ...styles[styleKey], [field]: value } });
    };
    return (
        <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] items-center gap-4 py-4 border-b border-gray-700 last:border-b-0">
            <h4 className="font-semibold text-gray-200 md:text-right">{label}</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Tipografia</label>
                    <select value={currentStyle.fontFamily} onChange={(e) => handleStyleChange('fontFamily', e.target.value)} className="w-full bg-gray-600 border border-gray-500 rounded-md px-2 py-1 text-sm">
                        {FONT_FACES.map(font => <option key={font} value={font}>{font}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Mida (px)</label>
                    <input type="number" min="8" max="32" value={currentStyle.fontSize} onChange={(e) => handleStyleChange('fontSize', parseInt(e.target.value, 10))} className="w-full bg-gray-600 border border-gray-500 rounded-md px-2 py-1 text-sm" />
                </div>
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Color</label>
                    <input type="color" value={currentStyle.color} onChange={(e) => handleStyleChange('color', e.target.value)} className="w-full h-8 p-0 bg-transparent border-none rounded-md cursor-pointer" />
                </div>
                <div className="flex items-center gap-4 pt-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={currentStyle.bold} onChange={(e) => handleStyleChange('bold', e.target.checked)} className="w-4 h-4 rounded" /> Negreta</label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={currentStyle.italic} onChange={(e) => handleStyleChange('italic', e.target.checked)} className="w-4 h-4 rounded" /> Cursiva</label>
                </div>
            </div>
        </div>
    );
};

const ShortcutsTab: React.FC = () => {
    const [shortcuts] = useLocalStorage<AppShortcuts>(LOCAL_STORAGE_KEYS.SHORTCUTS, DEFAULT_SHORTCUTS);
    const [activeApp, setActiveApp] = useState<ShortcutApp>('general');

    const appLabels: Record<ShortcutApp, string> = {
        general: 'General',
        scriptEditor: 'Editor Guions',
        lector: 'Lector',
        videoEditor: 'Reproductor Vídeo',
        subtitlesEditor: 'Subtítols SRT'
    };

    // Ordenem les pestanyes per posar General al principi
    const sortedApps: ShortcutApp[] = ['general', 'scriptEditor', 'lector', 'videoEditor', 'subtitlesEditor'];

    return (
        <div className="flex flex-col h-full">
            <div className="flex gap-2 mb-6 bg-gray-900/50 p-1 rounded-xl border border-gray-700">
                {sortedApps.map(appId => (
                    <button
                        key={String(appId)}
                        onClick={() => setActiveApp(appId)}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeApp === appId ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        {appLabels[appId]}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {shortcuts[activeApp]?.length > 0 ? (
                    <table className="w-full text-sm text-left">
                        <thead className="text-gray-500 uppercase text-[10px] font-bold border-b border-gray-700">
                            <tr>
                                <th className="pb-2 pl-2">Acció</th>
                                <th className="pb-2 text-right pr-2">Drecera</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                            {shortcuts[activeApp].map((s: Shortcut) => (
                                <tr key={s.id} className="group hover:bg-gray-700/30">
                                    <td className="py-3 pl-2 text-gray-300">{s.label}</td>
                                    <td className="py-3 text-right pr-2">
                                        <span className="px-2 py-1 bg-gray-900 border border-gray-600 rounded text-[11px] font-mono text-blue-400 group-hover:border-blue-500 transition-colors">
                                            {s.combo}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="py-20 text-center text-gray-500 italic text-sm">
                        No hi ha dreceres específiques per a aquest mòdul.
                    </div>
                )}
            </div>
        </div>
    );
};
const USE_BACKEND = process.env.VITE_USE_BACKEND === '1';
const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, editorStyles, onStylesChange }) => {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('general');
  const [libraryWidth, setLibraryWidth] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.LIBRARY_WIDTH, 420);
  const [takeMargin, setTakeMargin] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.TAKE_MARGIN, 2);
  const [takeStartMargin, setTakeStartMargin] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.TAKE_START_MARGIN, 2);
  const [maxLinesSubs, setMaxLinesSubs] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.MAX_LINES_SUBS, 2);
  const [gridOpacity, setGridOpacity] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.SUB_GRID_OPACITY, 0);
  const [waveformHoldMs, setWaveformHoldMs] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.WAVEFORM_HOLD_MS, 1000);

  const TabButton: React.FC<{ tabId: ActiveTab; label: string; disabled?: boolean }> = ({ tabId, label, disabled }) => (
    <button
      onClick={() => !disabled && setActiveTab(tabId)}
      disabled={disabled}
      className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
        activeTab === tabId ? 'border-blue-500 text-white bg-gray-700/50' : 'border-transparent text-gray-500 hover:text-gray-300'
      } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[500] p-4" onClick={onClose}>
      <div className="bg-[#111827] rounded-3xl shadow-2xl w-full max-w-4xl text-gray-200 flex flex-col h-[600px] border border-gray-700 overflow-hidden" onClick={e => e.stopPropagation()}>
        
        <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
             </div>
             <div>
                <h2 className="text-xl font-black text-white uppercase tracking-tighter">Configuració</h2>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Script Editor Pro v10.0</p>
             </div>
          </div>
         <div className="flex items-center gap-2">
  {USE_BACKEND && (
    <button
      onClick={() => { logout(); onClose(); }}
      className="px-3 py-2 bg-red-600/80 hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg border border-red-500/50 transition-all active:scale-95"
      title="Cerrar sesión"
    >
      Logout
    </button>
  )}
  <button
    onClick={onClose}
    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-all text-2xl"
  >
    &times;
  </button>
</div>
        </div>

        <div className="flex bg-gray-900/30 border-b border-gray-800">
           <TabButton tabId="general" label="General" />
           <TabButton tabId="editor" label="Estils Editor" />
           <TabButton tabId="shortcuts" label="Dreceres" />
           <TabButton tabId="reader" label="Lector" />
        </div>

        <div className="p-8 overflow-y-auto flex-grow bg-gray-900/10">
          {activeTab === 'shortcuts' ? <ShortcutsTab /> : 
           activeTab === 'editor' ? (
             <div className="space-y-2">
                <StyleControlGroup label="Takes" styleKey="take" styles={editorStyles} onChange={onStylesChange} />
                <StyleControlGroup label="Noms" styleKey="speaker" styles={editorStyles} onChange={onStylesChange} />
                <StyleControlGroup label="Codi de temps" styleKey="timecode" styles={editorStyles} onChange={onStylesChange} />
                <StyleControlGroup label="Text" styleKey="dialogue" styles={editorStyles} onChange={onStylesChange} />
                <StyleControlGroup label="Text (parèntesis)" styleKey="dialogueParentheses" styles={editorStyles} onChange={onStylesChange} />
                <StyleControlGroup label="TC/Núm. (parèntesis)" styleKey="dialogueTimecodeParentheses" styles={editorStyles} onChange={onStylesChange} />
             </div>
           ) : activeTab === 'general' ? (
             <div className="space-y-6">
                <div className="p-6 bg-gray-800/40 rounded-2xl border border-gray-700/50">
                    <h3 className="text-lg font-black text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
                        Interfície d'usuari
                    </h3>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-bold text-gray-200">Amplada de la Llibreria</p>
                            <p className="text-xs text-gray-500 italic">Actualment: {Math.round(libraryWidth)}px</p>
                        </div>
                        <button 
                            onClick={() => setLibraryWidth(420)}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-[10px] font-black uppercase tracking-widest rounded-lg border border-gray-600 transition-all active:scale-95"
                        >
                            Restablir mida (420px)
                        </button>
                    </div>
                </div>

                <div className="p-6 bg-gray-800/40 rounded-2xl border border-gray-700/50">
                    <h3 className="text-lg font-black text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15.75H4.5a2.25 2.25 0 01-2.25-2.25V6.75A2.25 2.25 0 014.5h10.5a2.25 2.25 0 012.25 2.25v6.75a2.25 2.25 0 01-2.25 2.25z" /></svg>
                        Editor de Subtítols
                    </h3>
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-gray-200">Màxim de línies per subtítol</p>
                                <p className="text-xs text-gray-500 italic">Controla el nombre de salts de línia permesos en cada bloc.</p>
                            </div>
                            <input 
                                type="number" 
                                min="1" max="8"
                                value={maxLinesSubs} 
                                onChange={(e) => setMaxLinesSubs(parseInt(e.target.value, 10) || 1)}
                                className="w-20 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white font-mono text-center focus:border-blue-500 outline-none"
                            />
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-gray-700/30">
                            <div>
                                <p className="font-bold text-gray-200">Intensitat de la quadrícula (Grid)</p>
                                <p className="text-xs text-gray-500 italic">Defineix l'opacitat de les línies divisòries. 0 = Desactivat.</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <input 
                                    type="range" 
                                    min="0" max="1" step="0.05"
                                    value={gridOpacity} 
                                    onChange={(e) => setGridOpacity(parseFloat(e.target.value))}
                                    className="w-32 accent-blue-500 cursor-pointer"
                                />
                                <span className="text-xs font-mono font-bold text-blue-400 w-10 text-right">{(gridOpacity * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-gray-800/40 rounded-2xl border border-gray-700/50">
                    <h3 className="text-lg font-black text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Sincronització de Vídeo
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-gray-200">Marge d'inici de TAKE (Pre-roll)</p>
                                <p className="text-xs text-gray-500 italic">Segons que s'avancen a l'inici teòric per facilitar la vinculació.</p>
                            </div>
                            <input 
                                type="number" 
                                min="0" max="30"
                                value={takeStartMargin} 
                                onChange={(e) => setTakeStartMargin(parseInt(e.target.value, 10) || 0)}
                                className="w-20 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white font-mono text-center focus:border-blue-500 outline-none"
                            />
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-gray-700/30">
                            <div>
                                <p className="font-bold text-gray-200">Marge final de TAKE (Post-roll)</p>
                                <p className="text-xs text-gray-500 italic">Temps afegit després de l'últim TC intern per tancar el TAKE.</p>
                            </div>
                            <input 
                                type="number" 
                                min="0" max="30"
                                value={takeMargin} 
                                onChange={(e) => setTakeMargin(parseInt(e.target.value, 10) || 0)}
                                className="w-20 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white font-mono text-center focus:border-blue-500 outline-none"
                            />
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-gray-700/30">
                            <div>
                                <p className="font-bold text-gray-200">Temps de pressió per editar ona</p>
                                <p className="text-xs text-gray-500 italic">Quant de temps s'ha de mantenir premut un segment per poder-lo moure (ms).</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <input 
                                    type="range" 
                                    min="0" max="2000" step="50"
                                    value={waveformHoldMs} 
                                    onChange={(e) => setWaveformHoldMs(parseInt(e.target.value, 10))}
                                    className="w-32 accent-blue-500 cursor-pointer"
                                />
                                <span className="text-xs font-mono font-bold text-blue-400 w-16 text-right">{waveformHoldMs} ms</span>
                            </div>
                        </div>
                    </div>
                </div>
             </div>
           ) : (
             <div className="flex items-center justify-center h-full text-gray-500 italic">
                Aquest apartat estarà disponible properament.
             </div>
           )}
        </div>

        <div className="p-6 border-t border-gray-800 bg-gray-900/50 flex justify-end">
          <button onClick={onClose} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95">Fet</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;