// frontend/context/UserStyles/UserStylesContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  UserStylesPayload,
  StyleScope,
  StyleSetMap,
  StyleAtom,
  UserStylePreset,
  ScopeState,
} from '../../types/UserStyles/userStylesTypes';
import {
  applyUserStylesToDOM,
  computeSubtitleMetrics,
} from './applyUserStylesToDOM';
import {
  buildInitialPayload,
  loadOrMigrate,
  scopedKey,
} from './userStylesMigration';
import {
  FACTORY_SCRIPT_STYLES,
  FACTORY_SUBTITLE_STYLES,
  FACTORY_HOME_STYLES,
} from './factoryStyles';
import { useAuth } from '../Auth/AuthContext';
import { api } from '../../services/api';
import { LOCAL_STORAGE_KEYS } from '../../constants';
import type { EditorStyles } from '../../appTypes';

// Mateix patró que App.tsx:667 i SettingsModal.tsx:356 — flag ad-hoc.
const USE_BACKEND = process.env.VITE_USE_BACKEND === '1';

const DEBOUNCE_MS = 1500;

interface UserStylesContextValue {
  payload: UserStylesPayload;
  /** Devuelve el preset activo del scope. */
  activePreset<S extends StyleScope>(scope: S): UserStylePreset<S>;
  /** Cambia el preset activo del scope. */
  setActivePreset(scope: StyleScope, presetId: string): void;
  /** Crea un preset nuevo (clona el activo) y lo activa. Devuelve el id nuevo. */
  createPreset(scope: StyleScope, name: string): string;
  /** Duplica un preset por id, lo activa y devuelve el id nuevo. */
  duplicatePreset(scope: StyleScope, presetId: string): string;
  /** Renombra un preset (bloqueado si builtin). */
  renamePreset(scope: StyleScope, presetId: string, name: string): void;
  /** Elimina un preset (bloqueado si builtin). */
  deletePreset(scope: StyleScope, presetId: string): void;
  /** Restablece el preset activo a los valores de fábrica del scope. */
  resetActivePreset(scope: StyleScope): void;
  /** Aplica un patch parcial a un atom del preset activo. */
  updateAtom<S extends StyleScope>(
    scope: S,
    atomKey: keyof StyleSetMap[S],
    patch: Partial<StyleAtom>,
  ): void;
  /** Estimate de fila para virtual scroll del editor de subtítulos (px). */
  subtitleRowEstimate: number;
}

const UserStylesContext = createContext<UserStylesContextValue | null>(null);

function readScopedLocal(userId: string | null): UserStylesPayload | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(scopedKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeScopedLocal(userId: string | null, payload: UserStylesPayload): void {
  if (!userId) return;
  try {
    localStorage.setItem(scopedKey(userId), JSON.stringify(payload));
  } catch { /* quota: ignorable */ }
}

function readLegacyEditorStyles(): EditorStyles | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.EDITOR_STYLES);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function factoryFor<S extends StyleScope>(scope: S): StyleSetMap[S] {
  switch (scope) {
    case 'scriptEditor':   return FACTORY_SCRIPT_STYLES   as StyleSetMap[S];
    case 'subtitleEditor': return FACTORY_SUBTITLE_STYLES as StyleSetMap[S];
    case 'home':           return FACTORY_HOME_STYLES     as StyleSetMap[S];
  }
  // exhaustive — no fallback
  throw new Error(`Unknown scope ${String(scope)}`);
}

export const UserStylesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { me } = useAuth();
  const [payload, setPayload] = useState<UserStylesPayload>(() =>
    buildInitialPayload({ legacy: readLegacyEditorStyles() }),
  );
  const debounceRef = useRef<number | null>(null);

  /**
   * Set d'userIds que ja han passat per `loadOrMigrate` en aquesta sessió.
   * Evita re-executar la migració cada cop que l'objecte `me` canvia
   * d'identitat (cosa que passa en qualsevol mutació de AuthContext i
   * pisaria les edicions recents de l'usuari).
   */
  const migratedUserIds = useRef<Set<string>>(new Set());

  // Aplica al DOM només quan el contingut serialitzat canvia.
  // Defensa addicional: si React ens dona un payload nou per referencia pero
  // amb el mateix contingut, no tornem a escriure les CSS vars.
  const lastAppliedPayloadRef = useRef<string>('');
  useEffect(() => {
    const serialized = JSON.stringify(payload);
    if (serialized === lastAppliedPayloadRef.current) return;
    lastAppliedPayloadRef.current = serialized;
    applyUserStylesToDOM(payload);
  }, [payload]);

  // Cache local scoped per userId.
  useEffect(() => {
    if (me?.id) writeScopedLocal(me.id, payload);
  }, [me?.id, payload]);

  // Sync entre finestres: si una altra finestra canvia el cache, re-llegir.
  useEffect(() => {
    if (!me?.id) return;
    const key = scopedKey(me.id);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || !e.newValue) return;
      try {
        const parsed: UserStylesPayload = JSON.parse(e.newValue);
        if (parsed?.version === 1) setPayload(parsed);
      } catch { /* noop */ }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [me?.id]);

  // Càrrega inicial / migració — només una vegada per userId i per sessió.
  // Si `me` canvia d'identitat (qualsevol mutació a AuthContext) però el userId
  // ja ha estat migrat, no fem res: l'estat actual del payload ja és la font
  // de veritat fins que l'usuari faci logout o recarregui la pàgina.
  useEffect(() => {
    if (!me?.id) return;
    if (migratedUserIds.current.has(me.id)) return;
    migratedUserIds.current.add(me.id);

    const remote: UserStylesPayload | null = (me as any)?.preferences?.userStyles ?? null;
    const scopedLocal = readScopedLocal(me.id);
    const legacy = readLegacyEditorStyles();
    const result = loadOrMigrate({ remote, scopedLocal, legacy });
    setPayload(result.payload);
    if (result.needsPush && USE_BACKEND) {
      api.updateMe({ preferences: { userStyles: result.payload } }).catch(() => {});
    }
  }, [me?.id]);

  // Quan l'usuari fa logout, netegem el set de migracions perquè un login
  // posterior amb el mateix userId torni a llegir el backend.
  useEffect(() => {
    if (me === null) migratedUserIds.current.clear();
  }, [me]);

  // Debounced push al backend.
  const schedulePush = useCallback((next: UserStylesPayload) => {
    if (!USE_BACKEND || !me) return;
    if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      api.updateMe({ preferences: { userStyles: next } }).catch(() => {});
      debounceRef.current = null;
    }, DEBOUNCE_MS) as unknown as number;
  }, [me]);

  const mutate = useCallback((updater: (p: UserStylesPayload) => UserStylesPayload) => {
    setPayload(prev => {
      const next = updater(prev);
      schedulePush(next);
      return next;
    });
  }, [schedulePush]);

  // ── Selectors i mutacions ─────────────────────────────────────────────────

  const activePreset = useCallback(<S extends StyleScope>(scope: S): UserStylePreset<S> => {
    const state = payload[scope] as ScopeState<S>;
    return state.presets.find(p => p.id === state.activePresetId) ?? state.presets[0];
  }, [payload]);

  const setActivePreset = useCallback((scope: StyleScope, presetId: string) => {
    mutate(prev => ({ ...prev, [scope]: { ...prev[scope], activePresetId: presetId } } as UserStylesPayload));
  }, [mutate]);

  const createPreset = useCallback((scope: StyleScope, name: string): string => {
    const id = genId();
    mutate(prev => {
      const state = prev[scope];
      const base = state.presets.find(p => p.id === state.activePresetId) ?? state.presets[0];
      const newPreset: UserStylePreset = { id, name, builtin: false, styles: JSON.parse(JSON.stringify(base.styles)) };
      return {
        ...prev,
        [scope]: { activePresetId: id, presets: [...state.presets, newPreset] },
      } as UserStylesPayload;
    });
    return id;
  }, [mutate]);

  const duplicatePreset = useCallback((scope: StyleScope, presetId: string): string => {
    const id = genId();
    mutate(prev => {
      const state = prev[scope];
      const src = state.presets.find(p => p.id === presetId);
      if (!src) return prev;
      const newPreset: UserStylePreset = { id, name: `${src.name} (còpia)`, builtin: false, styles: JSON.parse(JSON.stringify(src.styles)) };
      return {
        ...prev,
        [scope]: { activePresetId: id, presets: [...state.presets, newPreset] },
      } as UserStylesPayload;
    });
    return id;
  }, [mutate]);

  const renamePreset = useCallback((scope: StyleScope, presetId: string, name: string) => {
    mutate(prev => {
      const state = prev[scope];
      return {
        ...prev,
        [scope]: {
          ...state,
          presets: state.presets.map(p => p.id === presetId && !p.builtin ? { ...p, name } : p),
        },
      } as UserStylesPayload;
    });
  }, [mutate]);

  const deletePreset = useCallback((scope: StyleScope, presetId: string) => {
    mutate(prev => {
      const state = prev[scope];
      const target = state.presets.find(p => p.id === presetId);
      if (!target || target.builtin) return prev;
      const remaining = state.presets.filter(p => p.id !== presetId);
      const nextActive = state.activePresetId === presetId ? remaining[0]?.id ?? '' : state.activePresetId;
      return {
        ...prev,
        [scope]: { activePresetId: nextActive, presets: remaining },
      } as UserStylesPayload;
    });
  }, [mutate]);

  const resetActivePreset = useCallback((scope: StyleScope) => {
    mutate(prev => {
      const state = prev[scope];
      const factory = factoryFor(scope);
      return {
        ...prev,
        [scope]: {
          ...state,
          presets: state.presets.map(p =>
            p.id === state.activePresetId
              ? ({ ...p, styles: JSON.parse(JSON.stringify(factory)) })
              : p,
          ),
        },
      } as UserStylesPayload;
    });
  }, [mutate]);

  const updateAtom = useCallback(<S extends StyleScope>(
    scope: S,
    atomKey: keyof StyleSetMap[S],
    patch: Partial<StyleAtom>,
  ) => {
    mutate(prev => {
      const state = prev[scope] as ScopeState<S>;
      return {
        ...prev,
        [scope]: {
          ...state,
          presets: state.presets.map(p => {
            if (p.id !== state.activePresetId) return p;
            const currentAtom = (p.styles as any)[atomKey] as StyleAtom;
            return { ...p, styles: { ...p.styles, [atomKey]: { ...currentAtom, ...patch } } };
          }),
        },
      } as UserStylesPayload;
    });
  }, [mutate]);

  // ── Mètriques derivades per a subtítols ───────────────────────────────────
  const subtitleRowEstimate = useMemo(() => {
    const sb = activePreset('subtitleEditor').styles;
    return computeSubtitleMetrics(sb).rowEstimate(2);
  }, [activePreset]);

  const value: UserStylesContextValue = useMemo(() => ({
    payload,
    activePreset,
    setActivePreset,
    createPreset,
    duplicatePreset,
    renamePreset,
    deletePreset,
    resetActivePreset,
    updateAtom,
    subtitleRowEstimate,
  }), [
    payload,
    activePreset,
    setActivePreset,
    createPreset,
    duplicatePreset,
    renamePreset,
    deletePreset,
    resetActivePreset,
    updateAtom,
    subtitleRowEstimate,
  ]);

  return <UserStylesContext.Provider value={value}>{children}</UserStylesContext.Provider>;
};

export function useUserStyles(): UserStylesContextValue {
  const ctx = useContext(UserStylesContext);
  if (!ctx) throw new Error('useUserStyles must be used inside <UserStylesProvider>');
  return ctx;
}
