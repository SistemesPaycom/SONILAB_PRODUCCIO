// components/Admin/AdminPanel.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';

interface AdminPanelProps {
  onClose: () => void;
}

interface UserRow {
  id: string;
  email: string;
  name?: string;
  role: string;
  createdAt?: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create user form state
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'user' as 'admin' | 'user' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.adminListUsers();
      setUsers(data);
    } catch (e: any) {
      setError(e?.message || 'Error carregant usuaris');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() || !form.password.trim()) return;
    setCreating(true);
    setCreateError(null);
    setCreateSuccess(false);
    try {
      await api.adminCreateUser({
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim() || undefined,
        role: form.role,
      });
      setCreateSuccess(true);
      setForm({ email: '', password: '', name: '', role: 'user' });
      void loadUsers();
    } catch (e: any) {
      setCreateError(e?.message || 'Error creant usuari');
    } finally {
      setCreating(false);
    }
  };

  const roleLabel = (role: string) =>
    role === 'admin' ? (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 border border-amber-500/30" style={{ color: 'var(--th-text-secondary)' }}>Admin</span>
    ) : (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border" style={{ backgroundColor: 'var(--th-accent-muted)', color: 'var(--th-accent-text)', borderColor: 'var(--th-accent)' }}>Usuari</span>
    );

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[500] p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-700 flex justify-between items-center bg-gray-900/50 flex-shrink-0">
          <h4 className="font-bold text-xl text-white flex items-center gap-3">
            <span className="text-2xl">👥</span> Gestió d'Usuaris
          </h4>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-3xl leading-none transition-colors"
          >
            &times;
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-6">
          {/* Create user form */}
          <section>
            <h5 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-3">Crear Nou Usuari</h5>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-gray-900 text-gray-100 text-sm border border-gray-700 focus:border-gray-500 outline-none"
                    placeholder="usuari@sonilab.cat"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Nom (opcional)</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-gray-900 text-gray-100 text-sm border border-gray-700 focus:border-gray-500 outline-none"
                    placeholder="Nom complet"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Contrasenya *</label>
                  <input
                    type="password"
                    required
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-gray-900 text-gray-100 text-sm border border-gray-700 focus:border-gray-500 outline-none"
                    placeholder="Mínim 8 caràcters"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Rol</label>
                  <select
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value as 'admin' | 'user' }))}
                    className="w-full px-3 py-2 rounded-lg bg-gray-900 text-gray-100 text-sm border border-gray-700 focus:border-gray-500 outline-none"
                  >
                    <option value="user">Usuari</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>
              {createError && (
                <p className="text-red-400 text-xs">{createError}</p>
              )}
              {createSuccess && (
                <p className="text-emerald-400 text-xs">Usuari creat correctament!</p>
              )}
              <button
                type="submit"
                disabled={creating || !form.email.trim() || !form.password.trim()}
                className="px-5 py-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--th-btn-primary-bg)', color: 'var(--th-btn-primary-text)' }}
              >
                {creating ? 'Creant...' : 'Crear Usuari'}
              </button>
            </form>
          </section>

          {/* Users list */}
          <section>
            <div className="flex justify-between items-center mb-3">
              <h5 className="text-sm font-black text-gray-400 uppercase tracking-widest">Usuaris Registrats</h5>
              <button
                onClick={loadUsers}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                ↺ Actualitzar
              </button>
            </div>

            {loading ? (
              <div className="text-center text-gray-500 py-8 text-sm">Carregant...</div>
            ) : error ? (
              <div className="text-center text-red-400 py-4 text-sm">{error}</div>
            ) : users.length === 0 ? (
              <div className="text-center text-gray-500 py-8 text-sm">No hi ha usuaris registrats.</div>
            ) : (
              <div className="space-y-2">
                {users.map(user => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-3 bg-gray-900/60 rounded-xl border border-gray-700/50"
                  >
                    <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 font-bold text-sm flex-shrink-0">
                      {(user.name || user.email)[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white truncate">
                          {user.name || user.email}
                        </span>
                        {roleLabel(user.role)}
                      </div>
                      {user.name && (
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      )}
                    </div>
                    {user.createdAt && (
                      <span className="text-[10px] text-gray-600 flex-shrink-0">
                        {new Date(user.createdAt).toLocaleDateString('ca-ES')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
