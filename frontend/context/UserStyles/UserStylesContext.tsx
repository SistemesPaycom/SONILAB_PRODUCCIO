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

const BUILTIN_CLEANUP_DONE_KEY = 'snlbpro_user_styles_builtin_cleanup_v1';

/**
 * Override permanent: en cada mount, substitueix el preset `builtin: true`
 * ('Per defecte') de cada scope amb els valors factory del codi actual.
 *
 * El preset 'Per defecte' és la font de veritat del sistema i només es
 * modifica tocant `factoryStyles.ts` al codi i fent release. Els canvis
 * arriben automàticament a tots els usuaris al proxim mount sense
 * migracions manuals. Si l'usuari té canvis stale persistits al backend
 * o a localStorage, aquest override els pisa silenciosament.
 *
 * Els presets `builtin: false` (creats per l'usuari amb el botó 'Nou')
 * es preserven intactes.
 */
function overrideBuiltinPresets(
  payload: UserStylesPayload,
  globalStyles: { scriptEditor?: any; subtitleEditor?: any; home?: any } | null,
): UserStylesPayload {
  const factoryFor = (scope: StyleScope): any => {
    switch (scope) {
      case 'scriptEditor':   return globalStyles?.scriptEditor   ?? FACTORY_SCRIPT_STYLES;
      case 'subtitleEditor': return globalStyles?.subtitleEditor ?? FACTORY_SUBTITLE_STYLES;
      case 'home':           return globalStyles?.home           ?? FACTORY_HOME_STYLES;
    }
    throw new Error(`Unknown scope ${String(scope)}`);
  };

  const replaceBuiltin = <S extends { presets: any[]; activePresetId: string }>(
    state: S,
    scope: StyleScope,
  ): S => {
    const factory = factoryFor(scope);
    const nextPresets = state.presets.map((p: any) =>
      p.builtin
        ? { id: 'default', name: 'Per defecte', builtin: true, styles: factory }
        : p,
    );
    if (!nextPresets.some((p: any) => p.builtin)) {
      nextPresets.unshift({
        id: 'default',
        name: 'Per defecte',
        builtin: true,
        styles: factory,
      });
    }
    return { ...state, presets: nextPresets };
  };

  return {
    ...payload,
    scriptEditor:   replaceBuiltin(payload.scriptEditor,   'scriptEditor'),
    subtitleEditor: replaceBuiltin(payload.subtitleEditor, 'subtitleEditor'),
    home:           replaceBuiltin(payload.home,           'home'),
  };
}

/**
 * Cleanup one-time: elimina tots els presets `builtin: false` del payload.
 * S'executa UNA sola vegada per instal·lació, detectat via la flag
 * BUILTIN_CLEANUP_DONE_KEY a localStorage. Despres d'aquesta primera
 * execució, els presets custom que l'usuari crei amb el botó 'Nou' es
 * preserven normalment en mount futurs.
 *
 * Motivació: el sistema antic permetia als usuaris editar el preset 'Per
 * defecte' directament, i també crear presets custom. Amb el nou model
 * (preset 'Per defecte' inmutable + botó 'Nou' per crear variants), cal
 * netejar presets custom residuals del sistema antic. Aquest cleanup
 * s'ha confirmat amb l'usuari com a acceptable perquè la feature de
 * presets custom encara no s'havia utilitzat en producció.
 */
function cleanupCustomPresetsIfPending(payload: UserStylesPayload): {
  cleaned: UserStylesPayload;
  didCleanup: boolean;
} {
  let alreadyDone = false;
  try {
    alreadyDone = localStorage.getItem(BUILTIN_CLEANUP_DONE_KEY) === '1';
  } catch {
    // localStorage deshabilitat: no podem garantir idempotencia,
    // millor no fer cleanup per no repetir-lo en cada mount.
    alreadyDone = true;
  }
  if (alreadyDone) return { cleaned: payload, didCleanup: false };

  const stripNonBuiltin = <S extends { presets: any[]; activePresetId: string }>(state: S): S => {
    const builtinOnly = state.presets.filter(p => p.builtin);
    const nextActive = builtinOnly.find(p => p.id === state.activePresetId)?.id
      ?? builtinOnly[0]?.id
      ?? state.activePresetId;
    return { ...state, presets: builtinOnly, activePresetId: nextActive };
  };

  const cleaned: UserStylesPayload = {
    ...payload,
    scriptEditor:   stripNonBuiltin(payload.scriptEditor),
    subtitleEditor: stripNonBuiltin(payload.subtitleEditor),
    home:           stripNonBuiltin(payload.home),
  };

  try {
    localStorage.setItem(BUILTIN_CLEANUP_DONE_KEY, '1');
  } catch { /* noop */ }

  return { cleaned, didCleanup: true };
}
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
  /** Fuerza un push inmediato del payload actual al backend, cancelando
   *  cualquier debounce pendiente. Lo usa el botón "Guardar" del panel
   *  de estils para dar feedback inmediato al usuario. */
  savePayloadNow(): void;
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

  // ⚠ Sync cross-tab via storage events: DESACTIVAT deliberadament.
  //
  // Anteriorment aquest Provider escoltava `window.addEventListener('storage')`
  // per la clau `snlbpro_user_styles_<userId>` i quan rebia un canvi d'una altra
  // pestanya feia `setPayload(parsed)`. Això causava un bucle ping-pong
  // catastròfic en presencia de múltiples pestanyes:
  //
  //   P1 persist X0 → storage event → P2 setPayload(X0) → P2 persist X0 →
  //   storage event → P1 setPayload(X0) → ... 790 apply/seg, flicker massiu
  //   visible al DOM (verificat amb MutationObserver: ~49000 mutacions a
  //   document.documentElement.style en 3s).
  //
  // El loop era impossible de trencar només amb guards per contingut
  // serialitzat perquè els payloads de les dues pestanyes eren genuïnament
  // diferents (p. ex. 2474 bytes ↔ 2441 bytes) — el mismatch persistía i el
  // ping-pong continuava indefinidament.
  //
  // Known limitation acceptada: si l'usuari té dues pestanyes obertes i edita
  // un preset d'estils en una, l'altra pestanya no ho veurà fins que la
  // recarregui manualment. El backend segueix sent la font de veritat i
  // `loadOrMigrate` resol la consistència al pròxim reload.
  //
  // Si en el futur es vol recuperar la sincronització cross-tab, cal refactor
  // profund: probablement usant BroadcastChannel amb un origen explícit per
  // missatge (sender tab id) i bailout per "aquest missatge l'he emès jo mateix".
  // Un simple `addEventListener('storage')` NO és suficient perquè no distingeix
  // entre "un canvi de l'usuari en una altra pestanya" i "l'eco del meu propi
  // write a localStorage".

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

    // Cleanup one-time dels presets custom residuals (sistema antic).
    // Només s'executa a la primera càrrega per usuari després del deploy
    // d'aquest canvi, marcat per la flag BUILTIN_CLEANUP_DONE_KEY.
    const { cleaned, didCleanup } = cleanupCustomPresetsIfPending(result.payload);

    // Override permanent del preset 'Per defecte' amb els factory del codi.
    // S'executa en TOTS els mounts, no només al primer. Els canvis al codi
    // de factoryStyles.ts es propaguen automàticament a tots els usuaris.
    const globalStyles: { scriptEditor?: any; subtitleEditor?: any; home?: any } | null =
      (me as any)?.globalStyles ?? null;
    const normalized = overrideBuiltinPresets(cleaned, globalStyles);

    setPayload(normalized);

    // Push al backend si cal (needsPush original, o si hem fet cleanup,
    // o si l'override del builtin ha canviat el contingut vs el que hi
    // havia al remote).
    const contentChanged =
      result.needsPush ||
      didCleanup ||
      JSON.stringify(normalized) !== JSON.stringify(remote);
    if (contentChanged && USE_BACKEND) {
      api.updateMe({ preferences: { userStyles: normalized } }).catch(() => {});
    }
  }, [me?.id]);

  // Quan l'usuari fa logout, netegem el set de migracions perquè un login
  // posterior amb el mateix userId torni a llegir el backend.
  useEffect(() => {
    if (me === null) migratedUserIds.current.clear();
  }, [me]);

  // Debounced push al backend. Llegim `me` via ref per evitar que aquesta
  // funció es recreï en cada canvi d'identitat de me — era una cadena que
  // invalidava `mutate` → `value` → tots els consumers re-renderitzaven
  // innecessàriament en cada mutació de l'AuthContext.
  const meRef = useRef(me);
  useEffect(() => { meRef.current = me; }, [me]);

  const schedulePush = useCallback((next: UserStylesPayload) => {
    if (!USE_BACKEND || !meRef.current) return;
    if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      api.updateMe({ preferences: { userStyles: next } }).catch(() => {});
      debounceRef.current = null;
    }, DEBOUNCE_MS) as unknown as number;
  }, []);

  const mutate = useCallback((updater: (p: UserStylesPayload) => UserStylesPayload) => {
    setPayload(prev => {
      const next = updater(prev);
      // Skip si el contingut serialitzat es identic — evita re-renders innecesaris
      // i pushes redundants al backend.
      if (JSON.stringify(next) === JSON.stringify(prev)) return prev;
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
      const activeId = state.activePresetId;

      if (activeId !== 'custom') {
        // Clonar el preset actiu cap a un nou 'custom' (reemplaça el 'custom' existent si n'hi havia)
        const sourcePreset =
          state.presets.find(p => p.id === activeId) ?? state.presets[0];
        const clonedStyles = JSON.parse(JSON.stringify(sourcePreset.styles));
        const patchedStyles = {
          ...clonedStyles,
          [atomKey]: { ...(clonedStyles[atomKey] as StyleAtom), ...patch },
        };
        const customPreset: UserStylePreset = {
          id: 'custom',
          name: 'custom',
          builtin: false,
          styles: patchedStyles,
        };
        const presetsWithoutCustom = state.presets.filter((p: any) => p.id !== 'custom');
        return {
          ...prev,
          [scope]: {
            activePresetId: 'custom',
            presets: [...presetsWithoutCustom, customPreset],
          },
        } as UserStylesPayload;
      }

      // Ja en 'custom': aplica el patch directament
      return {
        ...prev,
        [scope]: {
          ...state,
          presets: state.presets.map(p => {
            if (p.id !== 'custom') return p;
            const currentAtom = (p.styles as any)[atomKey] as StyleAtom;
            return { ...p, styles: { ...p.styles, [atomKey]: { ...currentAtom, ...patch } } };
          }),
        },
      } as UserStylesPayload;
    });
  }, [mutate]);

  // Push inmediato del payload actual al backend. Usa payloadRef per evitar
  // tancar sobre el valor stale. Cancel·la el debounce pendent (si n'hi ha)
  // per no duplicar l'enviament.
  const payloadRef = useRef(payload);
  useEffect(() => { payloadRef.current = payload; }, [payload]);
  const savePayloadNow = useCallback(() => {
    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (USE_BACKEND && meRef.current) {
      api.updateMe({ preferences: { userStyles: payloadRef.current } }).catch(() => {});
    }
  }, []);

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
    savePayloadNow,
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
    savePayloadNow,
    subtitleRowEstimate,
  ]);

  return <UserStylesContext.Provider value={value}>{children}</UserStylesContext.Provider>;
};

export function useUserStyles(): UserStylesContextValue {
  const ctx = useContext(UserStylesContext);
  if (!ctx) throw new Error('useUserStyles must be used inside <UserStylesProvider>');
  return ctx;
}
