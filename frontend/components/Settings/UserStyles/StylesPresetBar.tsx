// frontend/components/Settings/UserStyles/StylesPresetBar.tsx
import React from 'react';
import { useUserStyles } from '../../../context/UserStyles/UserStylesContext';
import type { StyleScope } from '../../../types/UserStyles/userStylesTypes';

interface Props {
  scope: StyleScope;
}

export const StylesPresetBar: React.FC<Props> = ({ scope }) => {
  const {
    payload,
    setActivePreset,
    createPreset,
    deletePreset,
    savePayloadNow,
  } = useUserStyles();
  const state = payload[scope];
  const active = state.presets.find(p => p.id === state.activePresetId) ?? state.presets[0];
  const isBuiltin = active.builtin;

  const handleNew = () => {
    const rawName = window.prompt(
      'Nom del preset nou:\n\n' +
      'Es crearà una còpia del preset actual (' + active.name + ') amb el nom que indiquis.',
      active.name + ' (còpia)',
    );
    if (rawName === null) return;
    const name = rawName.trim();
    if (!name) {
      window.alert('El nom no pot estar buit.');
      return;
    }
    if (name.toLowerCase() === 'per defecte') {
      window.alert('No pots usar el nom "Per defecte" perquè està reservat al preset del sistema.');
      return;
    }
    const existing = state.presets.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      window.alert('Ja existeix un preset amb aquest nom. Escull-ne un altre.');
      return;
    }
    createPreset(scope, name);
  };

  const handleSave = () => {
    if (isBuiltin) return;
    savePayloadNow();
  };

  const handleDelete = () => {
    if (isBuiltin) return;
    if (state.presets.length <= 1) return;
    if (!window.confirm('Vols eliminar el preset "' + active.name + '"? Aquesta acció no es pot desfer.')) return;
    deletePreset(scope, active.id);
  };

  const btn = "px-3 py-1.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed";
  const btnStyle: React.CSSProperties = {
    backgroundColor: 'var(--th-bg-tertiary)',
    color: 'var(--th-text-primary)',
    border: '1px solid var(--th-border)',
  };
  const primaryStyle: React.CSSProperties = {
    backgroundColor: 'var(--th-btn-primary-bg)',
    color: 'var(--th-btn-primary-text)',
    border: '1px solid var(--th-border)',
  };
  const dangerStyle: React.CSSProperties = {
    backgroundColor: 'var(--th-bg-tertiary)',
    color: '#f87171',
    border: '1px solid var(--th-border)',
  };

  return (
    <div
      className="flex items-center gap-2 p-3 rounded-xl mb-4"
      style={{ backgroundColor: 'var(--th-bg-secondary)', border: '1px solid var(--th-border)' }}
    >
      <span className="text-xs font-bold uppercase tracking-widest mr-1" style={{ color: 'var(--th-text-muted)' }}>
        Preset
      </span>
      <select
        value={active.id}
        onChange={e => setActivePreset(scope, e.target.value)}
        className="px-2 py-1 text-sm rounded-md flex-1 max-w-xs"
        style={{ backgroundColor: 'var(--th-bg-tertiary)', border: '1px solid var(--th-border)', color: 'var(--th-text-primary)' }}
      >
        {state.presets.map(p => (
          <option key={p.id} value={p.id}>
            {p.name}{p.builtin ? ' (sistema)' : ''}
          </option>
        ))}
      </select>

      <button
        className={btn}
        style={btnStyle}
        onClick={handleNew}
        title="Crear un preset nou a partir del preset actual"
      >
        Nou
      </button>
      <button
        className={btn}
        style={primaryStyle}
        onClick={handleSave}
        disabled={isBuiltin}
        title={isBuiltin ? 'No es pot guardar sobre el preset del sistema' : 'Guardar els canvis al preset actual'}
      >
        Guardar
      </button>
      <button
        className={btn}
        style={dangerStyle}
        onClick={handleDelete}
        disabled={isBuiltin || state.presets.length <= 1}
        title={isBuiltin ? 'No es pot eliminar el preset del sistema' : 'Eliminar aquest preset'}
      >
        Eliminar
      </button>
    </div>
  );
};
