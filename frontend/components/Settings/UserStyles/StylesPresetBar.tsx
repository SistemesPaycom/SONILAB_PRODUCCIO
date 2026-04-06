// frontend/components/Settings/UserStyles/StylesPresetBar.tsx
import React, { useState } from 'react';
import { useUserStyles } from '../../../context/UserStyles/UserStylesContext';
import type { StyleScope } from '../../../types/UserStyles/userStylesTypes';

interface Props {
  scope: StyleScope;
}

export const StylesPresetBar: React.FC<Props> = ({ scope }) => {
  const { payload, setActivePreset, createPreset, duplicatePreset, renamePreset, deletePreset, resetActivePreset } = useUserStyles();
  const state = payload[scope];
  const active = state.presets.find(p => p.id === state.activePresetId) ?? state.presets[0];
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(active.name);

  const startRename = () => {
    if (active.builtin) return;
    setDraftName(active.name);
    setRenaming(true);
  };

  const commitRename = () => {
    const name = draftName.trim();
    if (name) renamePreset(scope, active.id, name);
    setRenaming(false);
  };

  const handleNew = () => {
    createPreset(scope, 'Nou preset');
  };

  const handleDuplicate = () => {
    duplicatePreset(scope, active.id);
  };

  const handleDelete = () => {
    if (active.builtin) return;
    if (state.presets.length <= 1) return;
    deletePreset(scope, active.id);
  };

  const handleReset = () => {
    if (!confirm('Restablir aquest preset als valors de fàbrica?')) return;
    resetActivePreset(scope);
  };

  const btn = "px-2.5 py-1 text-xs font-semibold rounded-md transition-all";
  const btnStyle: React.CSSProperties = { backgroundColor: 'var(--th-bg-tertiary)', color: 'var(--th-text-primary)', border: '1px solid var(--th-border)' };
  const dangerStyle: React.CSSProperties = { backgroundColor: 'var(--th-bg-tertiary)', color: '#f87171', border: '1px solid var(--th-border)' };

  return (
    <div className="flex items-center gap-2 p-3 rounded-xl mb-4" style={{ backgroundColor: 'var(--th-bg-secondary)', border: '1px solid var(--th-border)' }}>
      <span className="text-xs font-bold uppercase tracking-widest mr-1" style={{ color: 'var(--th-text-muted)' }}>Preset</span>
      {renaming ? (
        <input
          autoFocus
          value={draftName}
          onChange={e => setDraftName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false); }}
          className="px-2 py-1 text-sm rounded-md flex-1 max-w-xs"
          style={{ backgroundColor: 'var(--th-bg-tertiary)', border: '1px solid var(--th-border)', color: 'var(--th-text-primary)' }}
        />
      ) : (
        <select
          value={active.id}
          onChange={e => setActivePreset(scope, e.target.value)}
          className="px-2 py-1 text-sm rounded-md flex-1 max-w-xs"
          style={{ backgroundColor: 'var(--th-bg-tertiary)', border: '1px solid var(--th-border)', color: 'var(--th-text-primary)' }}
        >
          {state.presets.map(p => (
            <option key={p.id} value={p.id}>{p.name}{p.builtin ? ' (per defecte)' : ''}</option>
          ))}
        </select>
      )}
      <button className={btn} style={btnStyle} onClick={handleNew}>Nou</button>
      <button className={btn} style={btnStyle} onClick={handleDuplicate}>Duplica</button>
      <button className={btn} style={btnStyle} onClick={startRename} disabled={active.builtin} title={active.builtin ? 'No es pot reanomenar el preset per defecte' : ''}>Reanomena</button>
      <button className={btn} style={dangerStyle} onClick={handleDelete} disabled={active.builtin || state.presets.length <= 1} title={active.builtin ? 'No es pot eliminar el preset per defecte' : ''}>✕</button>
      <button className={btn + ' ml-auto'} style={btnStyle} onClick={handleReset}>Restablir</button>
    </div>
  );
};
