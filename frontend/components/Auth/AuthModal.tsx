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
      <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-100">
            {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </h2>
          <button
            className="text-sm text-gray-300 hover:text-white"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Crear cuenta' : 'Tengo cuenta'}
          </button>
        </div>

        {reason === 'expired' && (
          <div className="mb-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 px-3 py-2 text-sm">
            Sesión caducada. Vuelve a iniciar sesión.
          </div>
        )}

        <div className="space-y-3">
          <input
            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100"
            placeholder="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {err && <div className="text-sm text-red-300">{err}</div>}

          <button
            className="w-full px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-60"
            disabled={busy || !email || !password}
            onClick={submit}
          >
            {busy ? '...' : (mode === 'login' ? 'Entrar' : 'Registrar')}
          </button>

          <div className="text-xs text-gray-400">
            App transcripció i subtitulació de vídeos. Fet amb ❤️ per Sonilab.
          </div>
        </div>
      </div>
    </div>
  );
};