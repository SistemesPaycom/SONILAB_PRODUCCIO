import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from '../../services/api';

export type AuthReason = 'login' | 'expired';

type AuthContextValue = {
  authed: boolean;
  reason: AuthReason;
  me: any | null;
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
      // Si todavía no has añadido /auth/me en frontend, esto no rompe:
      // simplemente fallará y lo ignoramos.
      const fn = (api as any).me as undefined | (() => Promise<any>);
      if (!fn) return;
      const profile = await fn();
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

  const value = useMemo<AuthContextValue>(
    () => ({ authed, reason, me, refreshMe, markAuthed, logout }),
    [authed, reason, me, refreshMe, markAuthed, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
};