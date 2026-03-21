import React, { useState } from 'react';
import { EditorStyles, EditorStyle, AppShortcuts, Shortcut } from '../types';
import { DEFAULT_SHORTCUTS, LOCAL_STORAGE_KEYS } from '../constants';
import useLocalStorage from '../hooks/useLocalStorage';
import { useAuth } from '../context/Auth/AuthContext';
import { useTheme } from '../context/Theme/ThemeContext';

interface SettingsModalProps {
  onClose: () => void;
  editorStyles: EditorStyles;
  onStylesChange: (styles: EditorStyles) => void;
}

type ActiveTab = 'general' | 'editor' | 'shortcuts' | 'reader' | 'theme';
type ShortcutApp = keyof AppShortcuts;

const FONT_FACES = ['sans-serif', 'serif', 'monospace', 'Arial', 'Verdana', 'Times New Roman'];

const StyleControlGroup: React.FC<{ label: string; styleKey: keyof EditorStyles; styles: EditorStyles; onChange: (styles: EditorStyles) => void }> = ({ label, styleKey, styles, onChange }) => {
    const currentStyle = styles[styleKey];
    const handleStyleChange = (field: keyof EditorStyle, value: any) => {
        onChange({ ...styles, [styleKey]: { ...styles[styleKey], [field]: value } });
    };
    return (
        <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] items-center gap-4 py-4 border-b border-[var(--th-border)] last:border-b-0">
            <h4 className="font-semibold text-gray-200 md:text-right">{label}</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Tipografia</label>
                    <select value={currentStyle.fontFamily} onChange={(e) => handleStyleChange('fontFamily', e.target.value)} className="w-full rounded-md px-2 py-1 text-sm" style={{ backgroundColor: 'var(--th-bg-tertiary)', border: '1px solid var(--th-border)' }}>
                        {FONT_FACES.map(font => <option key={font} value={font}>{font}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Mida (px)</label>
                    <input type="number" min="8" max="32" value={currentStyle.fontSize} onChange={(e) => handleStyleChange('fontSize', parseInt(e.target.value, 10))} className="w-full rounded-md px-2 py-1 text-sm" style={{ backgroundColor: 'var(--th-bg-tertiary)', border: '1px solid var(--th-border)' }} />
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
            <div className="flex gap-2 mb-6 p-1 rounded-xl" style={{ backgroundColor: 'var(--th-bg-secondary)', border: '1px solid var(--th-border)' }}>
                {sortedApps.map(appId => (
                    <button
                        key={String(appId)}
                        onClick={() => setActiveApp(appId)}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeApp === appId ? 'text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                        style={activeApp === appId ? { backgroundColor: 'var(--th-accent)' } : undefined}
                    >
                        {appLabels[appId]}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {shortcuts[activeApp]?.length > 0 ? (
                    <table className="w-full text-sm text-left">
                        <thead className="text-gray-500 uppercase text-[10px] font-bold border-b border-[var(--th-border)]">
                            <tr>
                                <th className="pb-2 pl-2">Acció</th>
                                <th className="pb-2 text-right pr-2">Drecera</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                            {shortcuts[activeApp].map((s: Shortcut) => (
                                <tr key={s.id} className="group hover:bg-white/5">
                                    <td className="py-3 pl-2 text-gray-300">{s.label}</td>
                                    <td className="py-3 text-right pr-2">
                                        <span className="px-2 py-1 rounded text-[11px] font-mono transition-colors" style={{ color: 'var(--th-accent-text)', backgroundColor: 'var(--th-bg-primary)', border: '1px solid var(--th-border)' }}>
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
  const { theme, themeId, setThemeId, themes } = useTheme();
  const [activeTab, setActiveTab] = useState<ActiveTab>('general');
  const [libraryWidth, setLibraryWidth] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.LIBRARY_WIDTH, 420);
  const [takeMargin, setTakeMargin] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.TAKE_MARGIN, 2);
  const [takeStartMargin, setTakeStartMargin] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.TAKE_START_MARGIN, 2);
  const [maxLinesSubs, setMaxLinesSubs] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.MAX_LINES_SUBS, 2);
  const [gridOpacity, setGridOpacity] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.SUB_GRID_OPACITY, 0);
  const [waveformHoldMs, setWaveformHoldMs] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.WAVEFORM_HOLD_MS, 1000);

  const TabButton: React.FC<{ tabId: ActiveTab; label: string; disabled?: boolean }> = ({ tabId, label, disabled }) => {
    const isActive = activeTab === tabId;
    return (
    <button
      onClick={() => !disabled && setActiveTab(tabId)}
      disabled={disabled}
      className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
        disabled ? 'opacity-30 cursor-not-allowed' : ''
      }`}
      style={isActive
        ? { borderColor: 'var(--th-accent)', color: 'var(--th-text-primary)' }
        : { borderColor: 'transparent', color: 'var(--th-text-muted)' }
      }
    >
      {label}
    </button>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[500] p-4" onClick={onClose}>
      <div className="rounded-3xl shadow-2xl w-full max-w-4xl flex flex-col h-[600px] border border-[var(--th-border)] overflow-hidden" style={{ backgroundColor: 'var(--th-bg-surface)', color: 'var(--th-text-secondary)' }} onClick={e => e.stopPropagation()}>
        
        <div className="flex items-center justify-between p-6" style={{ borderBottom: '1px solid var(--th-border)', backgroundColor: 'var(--th-bg-secondary)' }}>
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: 'var(--th-accent)' }}>
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
             </div>
             <div>
                <h2 className="text-xl font-black uppercase tracking-tighter" style={{ color: 'var(--th-text-primary)' }}>Configuració</h2>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--th-text-muted)' }}>Script Editor Pro v10.0</p>
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
    className="w-10 h-10 flex items-center justify-center rounded-full transition-all text-2xl"
    style={{ color: 'var(--th-text-muted)' }}
  >
    &times;
  </button>
</div>
        </div>

        <div className="flex" style={{ backgroundColor: 'var(--th-bg-primary)', borderBottom: '1px solid var(--th-border)' }}>
           <TabButton tabId="general" label="General" />
           <TabButton tabId="theme" label="Tema" />
           <TabButton tabId="editor" label="Estils Editor" />
           <TabButton tabId="shortcuts" label="Dreceres" />
           <TabButton tabId="reader" label="Lector" />
        </div>

        <div className="p-8 overflow-y-auto flex-grow" style={{ backgroundColor: 'var(--th-bg-primary)' }}>
          {activeTab === 'shortcuts' ? <ShortcutsTab /> :
           activeTab === 'theme' ? (
             <div className="space-y-6">
                <div className="p-6 rounded-2xl" style={{ backgroundColor: 'var(--th-bg-secondary)', border: '1px solid var(--th-border)' }}>
                    <h3 className="text-lg font-black uppercase tracking-tight mb-2 flex items-center gap-2" style={{ color: 'var(--th-text-primary)' }}>
                        <svg className="w-5 h-5" style={{ color: 'var(--th-accent-text)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                        Tema de Color
                    </h3>
                    <p className="text-xs mb-6" style={{ color: 'var(--th-text-muted)' }}>Tria l'aparença visual de l'aplicació. El canvi s'aplica immediatament.</p>
                    <div className="grid grid-cols-1 gap-4">
                        {themes.map(t => {
                          const isActive = themeId === t.id;
                          return (
                          <button
                            key={t.id}
                            onClick={() => setThemeId(t.id)}
                            className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                              isActive ? 'shadow-lg' : ''
                            }`}
                            style={isActive
                              ? { borderColor: 'var(--th-accent)', backgroundColor: 'var(--th-accent-muted)' }
                              : { borderColor: 'var(--th-border-subtle)', backgroundColor: 'var(--th-bg-hover)' }
                            }
                          >
                            {/* Previsualització de colors */}
                            <div className="flex-shrink-0 flex gap-1">
                              {t.preview.map((color, i) => (
                                <div
                                  key={i}
                                  className="w-8 h-8 rounded-lg shadow-inner"
                                  style={{ backgroundColor: color, border: '1px solid var(--th-border-subtle)' }}
                                />
                              ))}
                            </div>
                            <div className="flex-grow min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm" style={{ color: 'var(--th-text-primary)' }}>{t.name}</span>
                                {isActive && (
                                  <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ color: 'var(--th-accent-text)', backgroundColor: 'var(--th-accent-muted)' }}>Actiu</span>
                                )}
                              </div>
                              <p className="text-xs mt-0.5" style={{ color: 'var(--th-text-muted)' }}>{t.description}</p>
                            </div>
                            {/* Indicador de selecció */}
                            <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                              style={isActive
                                ? { borderColor: 'var(--th-accent)', backgroundColor: 'var(--th-accent)' }
                                : { borderColor: 'var(--th-text-disabled)' }
                              }
                            >
                              {isActive && (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="white"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                              )}
                            </div>
                          </button>
                          );
                        })}
                    </div>
                </div>
             </div>
           ) :
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
                <div className="p-6 rounded-2xl" style={{ backgroundColor: 'var(--th-bg-secondary)', border: '1px solid var(--th-border)' }}>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 accent-icon-color" style={{ color: 'var(--th-accent-text)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
                        Interfície d'usuari
                    </h3>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-bold text-gray-200">Amplada de la Llibreria</p>
                            <p className="text-xs text-gray-500 italic">Actualment: {Math.round(libraryWidth)}px</p>
                        </div>
                        <button 
                            onClick={() => setLibraryWidth(420)}
                            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all active:scale-95 hover:brightness-125"
                            style={{ backgroundColor: 'var(--th-bg-tertiary)', color: 'var(--th-text-secondary)', border: '1px solid var(--th-border)' }}
                        >
                            Restablir mida (420px)
                        </button>
                    </div>
                </div>

                <div className="p-6 rounded-2xl" style={{ backgroundColor: 'var(--th-bg-secondary)', border: '1px solid var(--th-border)' }}>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 accent-icon-color" style={{ color: 'var(--th-accent-text)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15.75H4.5a2.25 2.25 0 01-2.25-2.25V6.75A2.25 2.25 0 014.5h10.5a2.25 2.25 0 012.25 2.25v6.75a2.25 2.25 0 01-2.25 2.25z" /></svg>
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
                                className="w-20 rounded-lg px-3 py-2 text-white font-mono text-center outline-none" style={{ backgroundColor: 'var(--th-bg-tertiary)', border: '1px solid var(--th-border)', '--tw-ring-color': 'var(--th-accent)' } as any}
                            />
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-[var(--th-border)]/30">
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
                                    className="w-32 cursor-pointer" style={{ accentColor: 'var(--th-accent)' }}
                                />
                                <span className="text-xs font-mono font-bold w-10 text-right" style={{ color: 'var(--th-accent-text)' }}>{(gridOpacity * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 rounded-2xl" style={{ backgroundColor: 'var(--th-bg-secondary)', border: '1px solid var(--th-border)' }}>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 accent-icon-color" style={{ color: 'var(--th-accent-text)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
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
                                className="w-20 rounded-lg px-3 py-2 text-white font-mono text-center outline-none" style={{ backgroundColor: 'var(--th-bg-tertiary)', border: '1px solid var(--th-border)', '--tw-ring-color': 'var(--th-accent)' } as any}
                            />
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-[var(--th-border)]/30">
                            <div>
                                <p className="font-bold text-gray-200">Marge final de TAKE (Post-roll)</p>
                                <p className="text-xs text-gray-500 italic">Temps afegit després de l'últim TC intern per tancar el TAKE.</p>
                            </div>
                            <input 
                                type="number" 
                                min="0" max="30"
                                value={takeMargin} 
                                onChange={(e) => setTakeMargin(parseInt(e.target.value, 10) || 0)}
                                className="w-20 rounded-lg px-3 py-2 text-white font-mono text-center outline-none" style={{ backgroundColor: 'var(--th-bg-tertiary)', border: '1px solid var(--th-border)', '--tw-ring-color': 'var(--th-accent)' } as any}
                            />
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-[var(--th-border)]/30">
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
                                    className="w-32 cursor-pointer" style={{ accentColor: 'var(--th-accent)' }}
                                />
                                <span className="text-xs font-mono font-bold w-16 text-right" style={{ color: 'var(--th-accent-text)' }}>{waveformHoldMs} ms</span>
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

        <div className="p-6 flex justify-end" style={{ borderTop: '1px solid var(--th-border)', backgroundColor: 'var(--th-bg-secondary)' }}>
          <button onClick={onClose} className="px-8 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95" style={{ backgroundColor: 'var(--th-btn-primary-bg)', color: 'var(--th-btn-primary-text)' }}>Fet</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;