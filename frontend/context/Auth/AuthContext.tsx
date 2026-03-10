import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from '../../services/api';

export type AuthReason = 'login' | 'expired';

type AuthContextValue = {
  authed: boolean;
  reason: AuthReason;
  me: any | null;
  role: string;
  isAdmin: boolean;
  refreshMe: () => Promise<void>;
  markAuthed: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authed, setAuthed] = useState(() => !!getToken());
  const [reason, setReason] = useState<AuthReason>('login');
  const [me, setMe] = useState<any | null>(null);

  const refreshMe = useCallback(async () => {
    if (!getToken()) {
      setMe(null);
      return;
    }
    try {
      const profile = await api.me();
      setMe(profile);
    } catch {
      // no bloquear UX por un /me temporalmente roto
    }
  }, []);

  const markAuthed = useCallback(() => {
    setAuthed(true);
    setReason('login');
    void refreshMe();
  }, [refreshMe]);

  const logout = useCallback(() => {
    setToken(null);
    setMe(null);
    setAuthed(false);
    setReason('login');
  }, []);

  useEffect(() => {
    const onAuthRequired = () => {
      setAuthed(false);
      setMe(null);
      setReason('expired');
    };
    window.addEventListener('AUTH_REQUIRED', onAuthRequired);
    return () => window.removeEventListener('AUTH_REQUIRED', onAuthRequired);
  }, []);

  useEffect(() => {
    if (authed) void refreshMe();
  }, [authed, refreshMe]);

  const role = me?.role ?? 'user';
  const isAdmin = role === 'admin';

  const value = useMemo<AuthContextValue>(
    () => ({ authed, reason, me, role, isAdmin, refreshMe, markAuthed, logout }),
    [authed, reason, me, role, isAdmin, refreshMe, markAuthed, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
};
