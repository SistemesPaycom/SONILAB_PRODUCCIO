import React, { useState } from 'react';
import { api, setToken } from '../../services/api';

export const AuthModal: React.FC<{
  open: boolean;
  onDone: () => void;
  reason?: 'login' | 'expired';
}> = ({ open, onDone, reason = 'login' }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      const r = mode === 'login'
        ? await api.login(email, password)
        : await api.register(email, password);

      setToken(r.accessToken);
      onDone();
    } catch (e: any) {
      setErr(e?.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/70 flex items-center justify-center p-4" onClick={() => {}}>
      <div
        className="w-full max-w-md rounded-2xl p-5"
        style={{ backgroundColor: 'var(--th-bg-surface)', border: '1px solid var(--th-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--th-text-primary)' }}>
            {mode === 'login' ? 'Iniciar sessió' : 'Crear compte'}
          </h2>
          <button
            className="text-sm transition-colors"
            style={{ color: 'var(--th-accent-text)' }}
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Crear compte' : 'Ja tinc compte'}
          </button>
        </div>

        {reason === 'expired' && (
          <div
            className="mb-3 rounded-lg px-3 py-2 text-sm"
            style={{
              backgroundColor: 'var(--th-alert-warning-bg)',
              border: '1px solid var(--th-alert-warning-border)',
              color: 'var(--th-alert-warning-text)',
            }}
          >
            Sessió caducada. Torna a iniciar sessió.
          </div>
        )}

        <div className="space-y-3">
          <input
            className="w-full px-3 py-2 rounded-lg"
            style={{
              backgroundColor: 'var(--th-bg-tertiary)',
              border: '1px solid var(--th-border)',
              color: 'var(--th-text-primary)',
            }}
            placeholder="Correu electrònic"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && email && password && submit()}
          />
          <input
            className="w-full px-3 py-2 rounded-lg"
            style={{
              backgroundColor: 'var(--th-bg-tertiary)',
              border: '1px solid var(--th-border)',
              color: 'var(--th-text-primary)',
            }}
            placeholder="Contrasenya"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && email && password && submit()}
          />

          {err && (
            <div
              className="text-sm rounded-lg px-3 py-2"
              style={{
                backgroundColor: 'var(--th-alert-error-bg)',
                border: '1px solid var(--th-alert-error-border)',
                color: 'var(--th-alert-error-text)',
              }}
            >
              {err}
            </div>
          )}

          <button
            className="w-full px-3 py-2 rounded-lg font-semibold disabled:opacity-60 transition-colors"
            style={{ backgroundColor: 'var(--th-btn-primary-bg)', color: 'var(--th-btn-primary-text)' }}
            disabled={busy || !email || !password}
            onClick={submit}
          >
            {busy ? '...' : (mode === 'login' ? 'Entrar' : 'Registrar')}
          </button>

        </div>
      </div>
    </div>
  );
};
