// frontend/components/Settings/UserStyles/SavePresetModal.tsx
import React, { useState } from 'react';
import { useUserStyles } from '../../../context/UserStyles/UserStylesContext';
import { useAuth } from '../../../context/Auth/AuthContext';
import type { StyleScope } from '../../../types/UserStyles/userStylesTypes';

interface Props {
  scope: StyleScope;
  /** Nom pre-emplenat. Buit si l'usuari venia del preset builtin o del 'custom'. */
  initialName: string;
  onClose: () => void;
}

type Step = 'input' | 'confirm-overwrite' | 'confirm-global';

export const SavePresetModal: React.FC<Props> = ({ scope, initialName, onClose }) => {
  const { savePreset, saveGlobalPreset } = useUserStyles();
  const { isAdmin } = useAuth();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('input');
  const [saving, setSaving] = useState(false);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('El nom no pot estar buit.'); return; }

    if (trimmed.toLowerCase() === 'per defecte' && isAdmin) {
      setStep('confirm-global');
      return;
    }

    const result = savePreset(scope, trimmed, false);
    if (result === 'ok') { onClose(); return; }
    if (result === 'conflict') { setStep('confirm-overwrite'); return; }
    if (result === 'blocked-custom') {
      setError('El nom "custom" és reservat pel sistema.');
      return;
    }
    if (result === 'blocked-system') {
      setError('El nom "Per defecte" és reservat al sistema. Només els administradors el poden usar.');
      return;
    }
  };

  const handleOverwrite = () => {
    savePreset(scope, name.trim(), true);
    onClose();
  };

  const handleGlobalSave = async () => {
    setSaving(true);
    try {
      await saveGlobalPreset(scope);
      onClose();
    } catch {
      setError("Error en guardar els estils globals. Comprova la connexió i torna-ho a intentar.");
      setStep('input');
    } finally {
      setSaving(false);
    }
  };

  const overlay = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50';
  const modal = 'rounded-2xl p-6 w-80 shadow-2xl';
  const modalStyle: React.CSSProperties = {
    backgroundColor: 'var(--th-bg-secondary)',
    border: '1px solid var(--th-border)',
    color: 'var(--th-text-primary)',
  };
  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--th-bg-tertiary)',
    border: '1px solid var(--th-border)',
    color: 'var(--th-text-primary)',
    width: '100%',
    padding: '0.375rem 0.75rem',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    outline: 'none',
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

  if (step === 'confirm-overwrite') {
    return (
      <div className={overlay} onClick={onClose}>
        <div className={modal} style={modalStyle} onClick={e => e.stopPropagation()}>
          <p className="text-sm mb-4" style={{ color: 'var(--th-text-secondary)' }}>
            Ja existeix un preset amb el nom{' '}
            <strong style={{ color: 'var(--th-text-primary)' }}>"{name.trim()}"</strong>.
            Vols sobreescriure&apos;l?
          </p>
          <div className="flex gap-2 justify-end">
            <button className={btn} style={btnStyle} onClick={() => setStep('input')}>
              Canviar nom
            </button>
            <button className={btn} style={dangerStyle} onClick={handleOverwrite}>
              Sobreescriure
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'confirm-global') {
    return (
      <div className={overlay} onClick={onClose}>
        <div className={modal} style={modalStyle} onClick={e => e.stopPropagation()}>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#f59e0b' }}>
            Admin — Acció global
          </p>
          <p className="text-sm mb-4" style={{ color: 'var(--th-text-secondary)' }}>
            Estàs a punt de modificar els estils globals per a{' '}
            <strong style={{ color: 'var(--th-text-primary)' }}>tots els usuaris</strong>{' '}
            de la plataforma. Aquesta acció és immediata.
          </p>
          {error && <p className="text-xs mb-2" style={{ color: '#f87171' }}>{error}</p>}
          <div className="flex gap-2 justify-end">
            <button className={btn} style={btnStyle} onClick={() => setStep('input')} disabled={saving}>
              Cancel·lar
            </button>
            <button className={btn} style={primaryStyle} onClick={handleGlobalSave} disabled={saving}>
              {saving ? 'Guardant...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={overlay} onClick={onClose}>
      <div className={modal} style={modalStyle} onClick={e => e.stopPropagation()}>
        <p className="text-sm font-bold mb-3">Guardar preset</p>
        <input
          style={inputStyle}
          value={name}
          onChange={e => { setName(e.target.value); setError(null); }}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onClose(); }}
          placeholder="Nom del preset"
          autoFocus
        />
        {error && <p className="text-xs mt-1 mb-1" style={{ color: '#f87171' }}>{error}</p>}
        <div className="flex gap-2 justify-end mt-3">
          <button className={btn} style={btnStyle} onClick={onClose}>
            Cancel·lar
          </button>
          <button className={btn} style={primaryStyle} onClick={handleSubmit}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};
