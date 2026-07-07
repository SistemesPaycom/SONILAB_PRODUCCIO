// frontend/components/Settings/UserStyles/StylesPresetBar.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useUserStyles } from '../../../context/UserStyles/UserStylesContext';
import { SavePresetModal } from './SavePresetModal';
import type { StyleScope } from '../../../types/UserStyles/userStylesTypes';

interface Props {
  scope: StyleScope;
}

export const StylesPresetBar: React.FC<Props> = ({ scope }) => {
  const { payload, setActivePreset, deletePreset, hasUnsavedChanges } = useUserStyles();
  const [showModal, setShowModal] = useState(false);
  const state = payload[scope];
  const active = state.presets.find(p => p.id === state.activePresetId) ?? state.presets[0];
  const hasCustom = hasUnsavedChanges(scope);
  const isBuiltin = active.builtin;
  const isCustom = active.id === 'custom';

  // Recordar el nom del preset origen (el que l'usuari tenia seleccionat antes d'editar)
  // S'usa com a nom pre-emplenat del modal. Quan el preset actiu és 'custom', el ref
  // manté el nom de l'últim preset nomenat. Quan és builtin, buit ('').
  const originNameRef = useRef('');
  useEffect(() => {
    if (active.id !== 'custom') {
      originNameRef.current = active.builtin ? '' : active.name;
    }
  }, [active.id, active.name, active.builtin]);

  const handleDelete = () => {
    if (isBuiltin || isCustom) return;
    if (!window.confirm('Vols eliminar el preset "' + active.name + '"? Aquesta acció no es pot desfer.')) return;
    deletePreset(scope, active.id);
  };

  const btn = 'px-3 py-1.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed';
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
    <>
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
              {p.name}{p.builtin ? ' (sistema)' : ''}{p.id === 'custom' ? ' ●' : ''}
            </option>
          ))}
        </select>

        {hasCustom && (
          <span className="text-xs whitespace-nowrap" style={{ color: '#f59e0b' }}>
            · Canvis no guardats
          </span>
        )}

        <button
          className={btn}
          style={primaryStyle}
          onClick={() => setShowModal(true)}
          title="Guardar els canvis com a preset"
        >
          Guardar
        </button>
        <button
          className={btn}
          style={dangerStyle}
          onClick={handleDelete}
          disabled={isBuiltin || isCustom}
          title={
            isBuiltin
              ? 'No es pot eliminar el preset del sistema'
              : isCustom
              ? 'Guarda els canvis primer per poder eliminar'
              : 'Eliminar aquest preset'
          }
        >
          Eliminar
        </button>
      </div>

      {showModal && (
        <SavePresetModal
          scope={scope}
          initialName={originNameRef.current}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
};
