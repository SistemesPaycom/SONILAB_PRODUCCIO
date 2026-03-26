import React, { useState, useCallback, useMemo } from 'react';
import { EditorStyles, EditorStyle, AppShortcuts, Shortcut } from '../types';
import { DEFAULT_SHORTCUTS, LOCAL_STORAGE_KEYS, mergeShortcuts } from '../constants';
import { api } from '../services/api';
import useLocalStorage from '../hooks/useLocalStorage';
import { useAuth } from '../context/Auth/AuthContext';
import { useTheme } from '../context/Theme/ThemeContext';
import { CUSTOM_THEME_ID, PRESET_THEMES, TOKEN_GROUPS, buildCustomTheme } from '../context/Theme/themes';

interface SettingsModalProps {
  onClose: () => void;
  editorStyles: EditorStyles;
  onStylesChange: (styles: EditorStyles) => void;
}

type ActiveTab = 'general' | 'editor' | 'shortcuts' | 'reader' | 'theme';
type ShortcutApp = keyof AppShortcuts;

const FONT_FACES = ['sans-serif', 'serif', 'monospace', 'Arial', 'Verdana', 'Times New Roman'];

// ── Token editor row amb estat local per a escriptura fluida ──
// L'input de text manté estat local per permetre escriptura lliure.
// Només es commiteja al tema quan el valor és un color CSS vàlid (onBlur o onKeyDown Enter).
const TokenRow: React.FC<{
  tokenKey: string;
  label: string;
  value: string;
  onChange: (key: string, value: string) => void;
}> = ({ tokenKey, label, value, onChange }) => {
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  const prevValueRef = React.useRef(value);

  // Sync draft when external value changes (e.g. preset copy)
  if (value !== prevValueRef.current) {
    prevValueRef.current = value;
    if (draft !== value) {
      setDraft(value);
      setInvalid(false);
    }
  }

  const isHex = /^#[0-9a-fA-F]{3,8}$/.test(value);

  const commit = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    // Validar amb un element temporal
    const el = document.createElement('div');
    el.style.color = '';
    el.style.color = trimmed;
    if (el.style.color !== '' || trimmed === 'transparent' || trimmed === 'inherit') {
      onChange(tokenKey, trimmed);
      setInvalid(false);
    } else {
      setInvalid(true);
    }
  };

  return (
    <div className="flex items-center gap-2 py-1 group">
      <div className="relative flex-shrink-0">
        <div
          className="w-5 h-5 rounded border cursor-pointer"
          style={{ backgroundColor: value, borderColor: 'var(--th-border)' }}
        />
        <input
          type="color"
          value={isHex ? value : '#888888'}
          onChange={(e) => { onChange(tokenKey, e.target.value); setDraft(e.target.value); setInvalid(false); }}
          className="absolute inset-0 w-5 h-5 opacity-0 cursor-pointer"
          title={tokenKey}
        />
      </div>
      <span className="text-[10px] flex-shrink-0 w-[120px] truncate" style={{ color: 'var(--th-text-muted)' }} title={tokenKey}>
        {label}
      </span>
      <input
        type="text"
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setInvalid(false); }}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(draft); }}
        className="flex-1 min-w-0 px-1.5 py-0.5 text-[10px] font-mono rounded"
        style={{
          backgroundColor: 'var(--th-bg-tertiary)',
          border: `1px solid ${invalid ? 'var(--th-error)' : 'var(--th-border)'}`,
          color: 'var(--th-text-secondary)',
        }}
        spellCheck={false}
      />
    </div>
  );
};

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

/** Build the combo string from a KeyboardEvent */
function comboFromEvent(e: KeyboardEvent | React.KeyboardEvent): string | null {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null;
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');
  let keyName = e.key;
  if (keyName === ' ') keyName = 'Space';
  if (keyName === '+') keyName = 'Plus';
  if (keyName === '-') keyName = 'Minus';
  if (keyName === ',') keyName = 'Comma';
  if (keyName === 'Escape') return null; // Escape cancels recording
  if (keyName.length === 1) keyName = keyName.toUpperCase();
  parts.push(keyName);
  return parts.join('+');
}

/** Find duplicate combo within the same scope as currentId, return the conflicting shortcut or null */
function findDuplicate(
  shortcuts: AppShortcuts,
  currentId: string,
  combo: string,
): Shortcut | null {
  const norm = combo.replace(/\s+/g, '').toLowerCase();
  // Find which scope the current shortcut belongs to
  for (const key of Object.keys(shortcuts) as (keyof AppShortcuts)[]) {
    const group = shortcuts[key];
    if (!group.some((s) => s.id === currentId)) continue;
    // Only check for duplicates within this same scope
    for (const s of group) {
      if (s.id !== currentId && s.combo.replace(/\s+/g, '').toLowerCase() === norm) {
        return s;
      }
    }
    break;
  }
  return null;
}

const ShortcutsTab: React.FC = () => {
    const [shortcuts, setShortcuts] = useLocalStorage<AppShortcuts>(LOCAL_STORAGE_KEYS.SHORTCUTS, DEFAULT_SHORTCUTS);
    const [activeApp, setActiveApp] = useState<ShortcutApp>('general');
    const [recordingId, setRecordingId] = useState<string | null>(null);
    const [conflict, setConflict] = useState<{ id: string; with: Shortcut } | null>(null);
    const { me } = useAuth();

    const appLabels: Record<ShortcutApp, string> = {
        general: 'General',
        scriptEditor: 'Editor Guions',
        lector: 'Lector',
        videoEditor: 'Reproductor Vídeo',
        subtitlesEditor: 'Subtítols SRT'
    };

    const sortedApps: ShortcutApp[] = ['general', 'scriptEditor', 'lector', 'videoEditor', 'subtitlesEditor'];

    // Ensure all default shortcuts exist (merge with defaults for missing ids)
    const merged = useMemo(() => mergeShortcuts(DEFAULT_SHORTCUTS, shortcuts), [shortcuts]);

    const persistToBackend = useCallback((updated: AppShortcuts) => {
      if (USE_BACKEND && me) {
        api.updateMe({ preferences: { shortcuts: updated } }).catch(() => {});
      }
    }, [me]);

    const updateCombo = useCallback((shortcutId: string, newCombo: string) => {
      const dup = findDuplicate(merged, shortcutId, newCombo);
      if (dup) {
        setConflict({ id: shortcutId, with: dup });
        return;
      }
      setConflict(null);
      const updated: AppShortcuts = { ...merged };
      for (const key of Object.keys(updated) as (keyof AppShortcuts)[]) {
        updated[key] = updated[key].map((s) =>
          s.id === shortcutId ? { ...s, combo: newCombo } : s,
        );
      }
      setShortcuts(updated);
      persistToBackend(updated);
    }, [merged, setShortcuts, persistToBackend]);

    const resetOne = useCallback((shortcutId: string) => {
      const updated: AppShortcuts = { ...merged };
      for (const key of Object.keys(DEFAULT_SHORTCUTS) as (keyof AppShortcuts)[]) {
        const def = DEFAULT_SHORTCUTS[key].find((s) => s.id === shortcutId);
        if (def) {
          updated[key] = updated[key].map((s) =>
            s.id === shortcutId ? { ...s, combo: def.combo } : s,
          );
        }
      }
      setConflict(null);
      setShortcuts(updated);
      persistToBackend(updated);
    }, [merged, setShortcuts, persistToBackend]);

    const resetAll = useCallback(() => {
      setConflict(null);
      setRecordingId(null);
      setShortcuts(DEFAULT_SHORTCUTS);
      persistToBackend(DEFAULT_SHORTCUTS);
    }, [setShortcuts, persistToBackend]);

    const handleKeyCapture = useCallback((e: React.KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Lone modifier → ignore, stay in recording mode
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
      // Escape → cancel recording
      if (e.key === 'Escape') {
        setRecordingId(null);
        setConflict(null);
        return;
      }
      const combo = comboFromEvent(e);
      if (combo && recordingId) {
        updateCombo(recordingId, combo);
        setRecordingId(null);
      }
    }, [recordingId, updateCombo]);

    /** Check if a shortcut has been modified from its default */
    const isModified = (s: Shortcut): boolean => {
      for (const key of Object.keys(DEFAULT_SHORTCUTS) as (keyof AppShortcuts)[]) {
        const def = DEFAULT_SHORTCUTS[key].find((d) => d.id === s.id);
        if (def) return def.combo !== s.combo;
      }
      return false;
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex gap-2 flex-1 p-1 rounded-xl" style={{ backgroundColor: 'var(--th-bg-secondary)', border: '1px solid var(--th-border)' }}>
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
              <button
                onClick={resetAll}
                className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all hover:opacity-80"
                style={{ backgroundColor: 'var(--th-bg-tertiary)', color: 'var(--th-text-muted)', border: '1px solid var(--th-border)' }}
                title="Restablir totes les dreceres als valors per defecte"
              >
                Restablir tot
              </button>
            </div>

            {conflict && (
              <div className="mb-3 px-3 py-2 rounded-lg text-xs font-medium" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: 'var(--th-error, #ef4444)', border: '1px solid rgba(239,68,68,0.3)' }}>
                Conflicte: aquesta combinació ja està assignada a «{conflict.with.label}».
              </div>
            )}

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {merged[activeApp]?.length > 0 ? (
                    <table className="w-full text-sm text-left">
                        <thead className="text-gray-500 uppercase text-[10px] font-bold border-b border-[var(--th-border)]">
                            <tr>
                                <th className="pb-2 pl-2">Acció</th>
                                <th className="pb-2 text-right pr-2">Drecera</th>
                                <th className="pb-2 w-8"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                            {merged[activeApp].map((s: Shortcut) => {
                                const recording = recordingId === s.id;
                                const modified = isModified(s);
                                return (
                                <tr key={s.id} className="group hover:bg-white/5">
                                    <td className="py-3 pl-2 text-gray-300">{s.label}</td>
                                    <td className="py-3 text-right pr-2">
                                      {recording ? (
                                        <input
                                          autoFocus
                                          readOnly
                                          onKeyDown={handleKeyCapture}
                                          onBlur={() => { setRecordingId(null); setConflict(null); }}
                                          className="px-2 py-1 rounded text-[11px] font-mono text-center w-40 outline-none animate-pulse"
                                          style={{ color: 'var(--th-accent-text)', backgroundColor: 'var(--th-bg-tertiary)', border: '2px solid var(--th-accent)' }}
                                          value="Prem una combinació..."
                                        />
                                      ) : (
                                        <button
                                          onClick={() => { setRecordingId(s.id); setConflict(null); }}
                                          className="px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer hover:opacity-80"
                                          style={{ color: 'var(--th-accent-text)', backgroundColor: 'var(--th-bg-primary)', border: `1px solid ${modified ? 'var(--th-accent)' : 'var(--th-border)'}` }}
                                          title="Clic per canviar la drecera"
                                        >
                                            {s.combo}
                                        </button>
                                      )}
                                    </td>
                                    <td className="py-3 w-8 text-center">
                                      {modified && (
                                        <button
                                          onClick={() => resetOne(s.id)}
                                          className="text-gray-500 hover:text-gray-300 transition-colors"
                                          title="Restablir al valor per defecte"
                                        >
                                          <svg className="w-3.5 h-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0115.36-5.36M20 15a9 9 0 01-15.36 5.36" />
                                          </svg>
                                        </button>
                                      )}
                                    </td>
                                </tr>
                                );
                            })}
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
  const { theme, themeId, setThemeId, themes, customTokens, setCustomTokens, resetCustomTokensFromPreset } = useTheme();
  const [customEditorOpen, setCustomEditorOpen] = useState(false);
  const [copyFromPreset, setCopyFromPreset] = useState<string | null>(null);

  // Resolver els tokens actuals del tema personalitzat (merged amb base)
  const resolvedCustomTheme = buildCustomTheme(customTokens);

  const handleCustomTokenChange = useCallback((key: string, value: string) => {
    setCustomTokens({ [key]: value });
  }, [setCustomTokens]);

  const handleCopyFromPreset = useCallback((presetId: string) => {
    resetCustomTokensFromPreset(presetId);
    setCopyFromPreset(null);
  }, [resetCustomTokensFromPreset]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('general');
  const [libraryWidth, setLibraryWidth] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.LIBRARY_WIDTH, 420);
  const [takeMargin, setTakeMargin] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.TAKE_MARGIN, 2);
  const [takeStartMargin, setTakeStartMargin] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.TAKE_START_MARGIN, 2);
  const [maxLinesSubs, setMaxLinesSubs] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.MAX_LINES_SUBS, 2);
  const [gridOpacity, setGridOpacity] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.SUB_GRID_OPACITY, 0);
  const [editorMinGapMs, setEditorMinGapMs] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.EDITOR_MIN_GAP_MS, 160);
  const [waveformHoldMs, setWaveformHoldMs] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.WAVEFORM_HOLD_MS, 500);

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
                        {/* ── Tarjeta del tema personalitzat ── */}
                        {(() => {
                          const isCustomActive = themeId === CUSTOM_THEME_ID;
                          return (
                          <button
                            key="custom"
                            onClick={() => {
                              // Si és el primer cop, inicialitzar des del tema actual
                              if (Object.keys(customTokens).length === 0) {
                                resetCustomTokensFromPreset(themeId !== CUSTOM_THEME_ID ? themeId : 'sonilab');
                              }
                              setThemeId(CUSTOM_THEME_ID);
                              setCustomEditorOpen(true);
                            }}
                            className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                              isCustomActive ? 'shadow-lg' : ''
                            }`}
                            style={isCustomActive
                              ? { borderColor: 'var(--th-accent)', backgroundColor: 'var(--th-accent-muted)' }
                              : { borderColor: 'var(--th-border-subtle)', backgroundColor: 'var(--th-bg-hover)' }
                            }
                          >
                            {/* Preview: mostra els colors actuals del custom theme */}
                            <div className="flex-shrink-0 flex gap-1">
                              {resolvedCustomTheme.preview.map((color, i) => (
                                <div
                                  key={i}
                                  className="w-8 h-8 rounded-lg shadow-inner"
                                  style={{ backgroundColor: color, border: '1px solid var(--th-border-subtle)' }}
                                />
                              ))}
                            </div>
                            <div className="flex-grow min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm" style={{ color: 'var(--th-text-primary)' }}>
                                  <svg className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                  Personalitzat
                                </span>
                                {isCustomActive && (
                                  <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ color: 'var(--th-accent-text)', backgroundColor: 'var(--th-accent-muted)' }}>Actiu</span>
                                )}
                              </div>
                              <p className="text-xs mt-0.5" style={{ color: 'var(--th-text-muted)' }}>Tema personalitzat amb colors definits per l'usuari</p>
                            </div>
                            {/* Radio */}
                            <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                              style={isCustomActive
                                ? { borderColor: 'var(--th-accent)', backgroundColor: 'var(--th-accent)' }
                                : { borderColor: 'var(--th-text-disabled)' }
                              }
                            >
                              {isCustomActive && (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="white"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                              )}
                            </div>
                          </button>
                          );
                        })()}
                    </div>
                </div>

                {/* ── Editor de tema personalitzat ── */}
                {themeId === CUSTOM_THEME_ID && customEditorOpen && (
                  <div className="p-6 rounded-2xl" style={{ backgroundColor: 'var(--th-bg-secondary)', border: '1px solid var(--th-border)' }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2" style={{ color: 'var(--th-text-primary)' }}>
                        <svg className="w-4 h-4" style={{ color: 'var(--th-accent-text)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        Editor de Colors
                      </h3>
                      <div className="flex items-center gap-2">
                        {/* Copiar des d'un preset */}
                        <div className="relative">
                          <button
                            onClick={() => setCopyFromPreset(prev => prev ? null : 'open')}
                            className="px-2.5 py-1 text-[10px] font-bold rounded-lg transition-colors"
                            style={{ color: 'var(--th-text-muted)', backgroundColor: 'var(--th-bg-hover)', border: '1px solid var(--th-border)' }}
                          >
                            Copiar des de…
                          </button>
                          {copyFromPreset && (
                            <div className="absolute right-0 top-full mt-1 rounded-lg shadow-xl z-50 py-1 min-w-[140px]"
                              style={{ backgroundColor: 'var(--th-bg-surface)', border: '1px solid var(--th-border)' }}>
                              {PRESET_THEMES.map(p => (
                                <button
                                  key={p.id}
                                  onClick={() => handleCopyFromPreset(p.id)}
                                  className="w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2"
                                  style={{ color: 'var(--th-text-secondary)' }}
                                >
                                  <div className="flex gap-0.5">
                                    {p.preview.slice(0, 2).map((c, i) => (
                                      <div key={i} className="w-3 h-3 rounded" style={{ backgroundColor: c, border: '1px solid var(--th-border-subtle)' }} />
                                    ))}
                                  </div>
                                  {p.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => setCustomEditorOpen(false)}
                          className="px-2.5 py-1 text-[10px] font-bold rounded-lg transition-colors"
                          style={{ color: 'var(--th-text-muted)', backgroundColor: 'var(--th-bg-hover)', border: '1px solid var(--th-border)' }}
                        >
                          Tancar editor
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                      {TOKEN_GROUPS.map(group => (
                        <div key={group.id}>
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--th-text-primary)' }}>{group.label}</h4>
                            {group.description && (
                              <span className="text-[9px]" style={{ color: 'var(--th-text-disabled)' }}>{group.description}</span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                            {group.tokens.map(({ key, label }) => (
                              <TokenRow
                                key={key}
                                tokenKey={key}
                                label={label}
                                value={resolvedCustomTheme.tokens[key] || ''}
                                onChange={handleCustomTokenChange}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 pt-3 flex items-center justify-between text-[9px]" style={{ borderTop: '1px solid var(--th-border)', color: 'var(--th-text-disabled)' }}>
                      <span>Els canvis s'apliquen en viu i es guarden automàticament al teu compte.</span>
                    </div>
                  </div>
                )}
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
                        <div className="flex items-center justify-between pt-4 border-t border-[var(--th-border)]/30">
                            <div>
                                <p className="font-bold text-gray-200">Marge mínim entre subtítols</p>
                                <p className="text-xs text-gray-500 italic">Separació mínima (ms) entre cues consecutius a l'editor. No afecta la transcripció.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min="0" max="2000" step="10"
                                    value={editorMinGapMs}
                                    onChange={(e) => setEditorMinGapMs(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                    className="w-20 rounded-lg px-3 py-2 text-white font-mono text-center outline-none" style={{ backgroundColor: 'var(--th-bg-tertiary)', border: '1px solid var(--th-border)', '--tw-ring-color': 'var(--th-accent)' } as any}
                                />
                                <span className="text-xs font-mono" style={{ color: 'var(--th-editor-meta)' }}>ms</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-[var(--th-border)]/30">
                            <div>
                                <p className="font-bold text-gray-200">Temps de pressió per moure segment</p>
                                <p className="text-xs text-gray-500 italic">Temps mínim (ms) de pulsació mantinguda per activar el drag d'un segment al timeline.</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    min="0" max="2000" step="50"
                                    value={waveformHoldMs}
                                    onChange={(e) => setWaveformHoldMs(Math.max(0, Math.min(2000, parseInt(e.target.value, 10) || 500)))}
                                    className="w-32 cursor-pointer" style={{ accentColor: 'var(--th-accent)' }}
                                />
                                <span className="text-xs font-mono font-bold w-16 text-right" style={{ color: 'var(--th-accent-text)' }}>{waveformHoldMs} ms</span>
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