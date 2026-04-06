# User Styles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir la pestaña "Estils Editor" del modal de configuración por una pestaña "Estils" con tres sub-pestañas (Editor de guions, Editor de subtítols, Inici), cada una gestionando presets tipográficos del usuario persistidos en backend, y refactorizar el editor de subtítulos para que cambiar tamaños de fuente no rompa los layouts.

**Architecture:** Un `UserStylesContext` aislado calcula CSS variables `--us-*` aplicadas a `:root`. Los componentes existentes leen esas variables en lugar de hardcodes/props. Los presets se persisten como un único JSON `user.preferences.userStyles` vía `PATCH /auth/me` (mismo endpoint que temas/atajos), con cache local scoped por userId. Migración automática lee `snlbpro_editor_styles` legacy y crea el preset 'Per defecte'.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Tailwind, `@tanstack/react-virtual` (ya en uso), patrón de contexto idéntico al `ThemeContext` existente.

**Spec de referencia:** [docs/superpowers/specs/2026-04-06-user-styles-design.md](../specs/2026-04-06-user-styles-design.md)

**Reglas heredadas (de `frontend/CLAUDE.md`):**
- No romper navegación entre tabs, selección múltiple, modales ni vistas existentes.
- Cada cambio reversible y mínimo.
- No mezclar lógica entre tabs.

**Verificación:** El proyecto no tiene framework de tests. Cada tarea verifica con:
- `cd frontend && npx tsc --noEmit` (type-check completo).
- `cd frontend && npm run build` (build de Vite, falla si hay errores TS o de import).
- Inspección visual en navegador con `cd frontend && npm run dev` cuando hay cambio visible.
- Smoke tests inline en la consola del navegador para lógica pura cuando aplica.

---

## Phase A — Foundation (sin cambios visibles)

### Task 1: Crear tipos `userStylesTypes.ts`

**Files:**
- Create: `frontend/types/UserStyles/userStylesTypes.ts`

- [ ] **Step 1: Crear el archivo de tipos**

```ts
// frontend/types/UserStyles/userStylesTypes.ts

export interface StyleAtom {
  fontFamily: string;
  fontSize: number;       // px
  color: string;          // #rrggbb
  bold: boolean;
  italic: boolean;
}

export interface ScriptEditorStyleSet {
  take: StyleAtom;
  speaker: StyleAtom;
  timecode: StyleAtom;
  dialogue: StyleAtom;
  dialogueParentheses: StyleAtom;
  dialogueTimecodeParentheses: StyleAtom;
}

export interface SubtitleEditorStyleSet {
  content: StyleAtom;        // texto editable del subtítulo
  timecode: StyleAtom;       // IN/OUT en TimecodeInput
  idCps: StyleAtom;          // ID y CPS
  takeLabel: StyleAtom;      // etiqueta TAKE
  charCounter: StyleAtom;    // contador de caracteres
  actionButtons: StyleAtom;  // barra de acciones de la fila
}

export interface HomeStyleSet {
  fileName: StyleAtom;
  formatLabel: StyleAtom;
  dateTime: StyleAtom;
  tableHeader: StyleAtom;
  navTabs: StyleAtom;
  breadcrumb: StyleAtom;
}

export type StyleScope = 'scriptEditor' | 'subtitleEditor' | 'home';

export interface StyleSetMap {
  scriptEditor: ScriptEditorStyleSet;
  subtitleEditor: SubtitleEditorStyleSet;
  home: HomeStyleSet;
}

export interface UserStylePreset<S extends StyleScope = StyleScope> {
  id: string;
  name: string;
  builtin?: boolean;
  styles: StyleSetMap[S];
}

export interface ScopeState<S extends StyleScope> {
  activePresetId: string;
  presets: UserStylePreset<S>[];
}

export interface UserStylesPayload {
  version: 1;
  scriptEditor:    ScopeState<'scriptEditor'>;
  subtitleEditor:  ScopeState<'subtitleEditor'>;
  home:            ScopeState<'home'>;
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/types/UserStyles/userStylesTypes.ts
git commit -m "feat(user-styles): tipos del shape de presets de usuario"
```

---

### Task 2: Crear `factoryStyles.ts`

**Files:**
- Create: `frontend/context/UserStyles/factoryStyles.ts`

- [ ] **Step 1: Escribir los valores de fábrica**

```ts
// frontend/context/UserStyles/factoryStyles.ts
import type {
  ScriptEditorStyleSet,
  SubtitleEditorStyleSet,
  HomeStyleSet,
  StyleAtom,
} from '../../types/UserStyles/userStylesTypes';

const courier = (size: number, color: string, bold = false, italic = false): StyleAtom => ({
  fontFamily: 'Courier Prime, monospace',
  fontSize: size,
  color,
  bold,
  italic,
});

const sans = (size: number, color: string, bold = false, italic = false): StyleAtom => ({
  fontFamily: 'sans-serif',
  fontSize: size,
  color,
  bold,
  italic,
});

const mono = (size: number, color: string, bold = false, italic = false): StyleAtom => ({
  fontFamily: 'monospace',
  fontSize: size,
  color,
  bold,
  italic,
});

/**
 * Reproduce exactamente DEFAULT_STYLES de App.tsx:35-42 — cualquier usuario que migre
 * desde el sistema legacy debe ver el editor de guiones idéntico a antes.
 */
export const FACTORY_SCRIPT_STYLES: ScriptEditorStyleSet = {
  take:                         courier(16, '#000000', true,  false),
  speaker:                      courier(14, '#000000', true,  false),
  timecode:                     courier(13, '#666666', false, false),
  dialogue:                     courier(14, '#000000', false, false),
  dialogueParentheses:          courier(14, '#555555', false, true),
  dialogueTimecodeParentheses:  courier(13, '#0055aa', true,  false),
};

/**
 * Reproduce el aspecto actual hardcoded del editor de subtítulos
 * (SegmentItem.tsx, TimecodeInput.tsx). Los colores que originalmente leían
 * var(--th-*) se resuelven a hex en el momento de la migración (ver
 * resolveSubtitleFactoryColors en userStylesMigration.ts).
 */
export const FACTORY_SUBTITLE_STYLES: SubtitleEditorStyleSet = {
  content:        courier(14, '#e5e7eb'),
  timecode:       courier(10, '#9ca3af'),
  idCps:          mono(11,    '#9ca3af'),
  takeLabel:      sans(10,    '#ef4444', true),
  charCounter:    mono(11,    '#9ca3af'),
  actionButtons:  sans(9,     '#9ca3af'),
};

/**
 * Reproduce el aspecto actual del home/llibreria (SonilabLibraryView.tsx,
 * LibraryFileItem.tsx).
 */
export const FACTORY_HOME_STYLES: HomeStyleSet = {
  fileName:     sans(14, '#f3f4f6'),
  formatLabel:  sans(10, '#6b7280', true),
  dateTime:     mono(10, '#9ca3af'),
  tableHeader:  sans(10, '#6b7280', true),
  navTabs:      sans(14, '#ffffff', true),
  breadcrumb:   sans(14, '#b8b8b8'),
};
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/context/UserStyles/factoryStyles.ts
git commit -m "feat(user-styles): valores de fabrica que reproducen el aspecto actual"
```

---

### Task 3: Crear `applyUserStylesToDOM.ts`

**Files:**
- Create: `frontend/context/UserStyles/applyUserStylesToDOM.ts`

- [ ] **Step 1: Escribir helpers internos**

```ts
// frontend/context/UserStyles/applyUserStylesToDOM.ts
import type {
  StyleAtom,
  UserStylesPayload,
  SubtitleEditorStyleSet,
  ScriptEditorStyleSet,
  HomeStyleSet,
  ScopeState,
  StyleScope,
} from '../../types/UserStyles/userStylesTypes';

/** Devuelve el preset activo del scope, o el primero si el activo no existe. */
function activePreset<S extends StyleScope>(state: ScopeState<S>) {
  return state.presets.find(p => p.id === state.activePresetId) ?? state.presets[0];
}

/** Aproximación 1ch → px en función de si la familia es monospace o sans. */
function isMono(family: string): boolean {
  const f = family.toLowerCase();
  return /courier|consolas|monaco|menlo|monospace|fira ?code|cascadia/.test(f);
}

function chOf(atom: StyleAtom): number {
  return atom.fontSize * (isMono(atom.fontFamily) ? 0.6 : 0.55);
}

function emitAtomVars(prefix: string, atom: StyleAtom): Record<string, string> {
  return {
    [`${prefix}-family`]: atom.fontFamily,
    [`${prefix}-size`]:   `${atom.fontSize}px`,
    [`${prefix}-color`]:  atom.color,
    [`${prefix}-weight`]: atom.bold ? '700' : '400',
    [`${prefix}-style`]:  atom.italic ? 'italic' : 'normal',
  };
}

function computeSubGridCols(sb: SubtitleEditorStyleSet): string {
  const takeCol     = `${Math.ceil(chOf(sb.takeLabel)   * 10)}px`;
  const idCpsCol    = `${Math.ceil(chOf(sb.idCps)       * 12)}px`;
  const timecodeCol = `${Math.ceil(chOf(sb.timecode)    * 21)}px`;
  const charCntCol  = `${Math.ceil(chOf(sb.charCounter) *  5)}px`;
  return `${takeCol} ${idCpsCol} ${timecodeCol} ${charCntCol} max-content`;
}

function computeSubRowHeight(sb: SubtitleEditorStyleSet): number {
  const maxAtomSize = Math.max(
    sb.content.fontSize,
    sb.timecode.fontSize,
    sb.idCps.fontSize,
    sb.takeLabel.fontSize,
    sb.charCounter.fontSize,
  );
  return Math.max(24, Math.ceil(maxAtomSize * 1.55));
}
```

- [ ] **Step 2: Escribir la función exportada principal**

```ts
// (continuación del mismo archivo applyUserStylesToDOM.ts)

export interface DerivedSubtitleMetrics {
  rowHeight: number;        // px
  rowPaddingY: number;      // px
  /** Estimate por fila para virtual scroll = rowHeight * maxLines + acción + padding */
  rowEstimate(maxLines: number): number;
}

export function computeSubtitleMetrics(sb: SubtitleEditorStyleSet): DerivedSubtitleMetrics {
  const rowHeight = computeSubRowHeight(sb);
  const rowPaddingY = Math.ceil(rowHeight * 0.16);
  return {
    rowHeight,
    rowPaddingY,
    rowEstimate: (maxLines: number) => rowHeight * Math.max(1, maxLines) + 32,
  };
}

export function applyUserStylesToDOM(payload: UserStylesPayload): void {
  const root = document.documentElement;
  const all: Record<string, string> = {};

  // ── Script editor ────────────────────────────────────────────────────────
  const se: ScriptEditorStyleSet = activePreset(payload.scriptEditor).styles;
  Object.assign(all, emitAtomVars('--us-script-take',                          se.take));
  Object.assign(all, emitAtomVars('--us-script-speaker',                       se.speaker));
  Object.assign(all, emitAtomVars('--us-script-timecode',                      se.timecode));
  Object.assign(all, emitAtomVars('--us-script-dialogue',                      se.dialogue));
  Object.assign(all, emitAtomVars('--us-script-dialogueparen',                 se.dialogueParentheses));
  Object.assign(all, emitAtomVars('--us-script-dialoguetcparen',               se.dialogueTimecodeParentheses));

  // ── Subtitle editor ──────────────────────────────────────────────────────
  const sb: SubtitleEditorStyleSet = activePreset(payload.subtitleEditor).styles;
  Object.assign(all, emitAtomVars('--us-sub-content',       sb.content));
  Object.assign(all, emitAtomVars('--us-sub-timecode',      sb.timecode));
  Object.assign(all, emitAtomVars('--us-sub-idcps',         sb.idCps));
  Object.assign(all, emitAtomVars('--us-sub-takelabel',     sb.takeLabel));
  Object.assign(all, emitAtomVars('--us-sub-charcounter',   sb.charCounter));
  Object.assign(all, emitAtomVars('--us-sub-actionbuttons', sb.actionButtons));

  const metrics = computeSubtitleMetrics(sb);
  all['--us-sub-row-height']    = `${metrics.rowHeight}px`;
  all['--us-sub-row-padding-y'] = `${metrics.rowPaddingY}px`;
  all['--us-sub-grid-columns']  = computeSubGridCols(sb);

  // ── Home ─────────────────────────────────────────────────────────────────
  const hm: HomeStyleSet = activePreset(payload.home).styles;
  Object.assign(all, emitAtomVars('--us-home-filename',    hm.fileName));
  Object.assign(all, emitAtomVars('--us-home-format',      hm.formatLabel));
  Object.assign(all, emitAtomVars('--us-home-datetime',    hm.dateTime));
  Object.assign(all, emitAtomVars('--us-home-tableheader', hm.tableHeader));
  Object.assign(all, emitAtomVars('--us-home-navtabs',     hm.navTabs));
  Object.assign(all, emitAtomVars('--us-home-breadcrumb',  hm.breadcrumb));

  for (const [k, v] of Object.entries(all)) {
    root.style.setProperty(k, v);
  }
}
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/context/UserStyles/applyUserStylesToDOM.ts
git commit -m "feat(user-styles): emisor de CSS variables --us-* y metricas derivadas de subtitulos"
```

---

### Task 4: Crear `userStylesMigration.ts`

**Files:**
- Create: `frontend/context/UserStyles/userStylesMigration.ts`

- [ ] **Step 1: Escribir el módulo de migración**

```ts
// frontend/context/UserStyles/userStylesMigration.ts
import type {
  UserStylesPayload,
  ScriptEditorStyleSet,
  SubtitleEditorStyleSet,
  HomeStyleSet,
  UserStylePreset,
  StyleScope,
} from '../../types/UserStyles/userStylesTypes';
import {
  FACTORY_SCRIPT_STYLES,
  FACTORY_SUBTITLE_STYLES,
  FACTORY_HOME_STYLES,
} from './factoryStyles';
import type { EditorStyles } from '../../appTypes';

const DEFAULT_PRESET_ID = 'default';
const DEFAULT_PRESET_NAME = 'Per defecte';

function defaultPresetFor<S extends StyleScope>(
  styles: UserStylePreset<S>['styles'],
): UserStylePreset<S> {
  return {
    id: DEFAULT_PRESET_ID,
    name: DEFAULT_PRESET_NAME,
    builtin: true,
    styles,
  };
}

/**
 * Construye un payload inicial. Si se pasa `legacy` (el viejo EditorStyles
 * de localStorage `snlbpro_editor_styles`), se usa como contenido del preset
 * 'Per defecte' del editor de guiones — los usuarios que ya habían personalizado
 * mantienen su configuración sin acción manual.
 */
export function buildInitialPayload(opts: { legacy?: EditorStyles | null }): UserStylesPayload {
  const scriptStyles: ScriptEditorStyleSet = opts.legacy ?? FACTORY_SCRIPT_STYLES;

  return {
    version: 1,
    scriptEditor: {
      activePresetId: DEFAULT_PRESET_ID,
      presets: [defaultPresetFor<'scriptEditor'>(scriptStyles)],
    },
    subtitleEditor: {
      activePresetId: DEFAULT_PRESET_ID,
      presets: [defaultPresetFor<'subtitleEditor'>(FACTORY_SUBTITLE_STYLES)],
    },
    home: {
      activePresetId: DEFAULT_PRESET_ID,
      presets: [defaultPresetFor<'home'>(FACTORY_HOME_STYLES)],
    },
  };
}

/**
 * Resuelve la presencia de userStyles en el orden:
 *   1. backend (`me.preferences.userStyles`)
 *   2. cache local scoped: `snlbpro_user_styles_<userId>`
 *   3. migración desde legacy `snlbpro_editor_styles`
 *
 * Devuelve también una bandera `needsPush` para que el caller decida si subir al backend.
 */
export interface LoadOrMigrateResult {
  payload: UserStylesPayload;
  needsPush: boolean;
}

export function loadOrMigrate(args: {
  remote: UserStylesPayload | null | undefined;
  scopedLocal: UserStylesPayload | null;
  legacy: EditorStyles | null;
}): LoadOrMigrateResult {
  if (args.remote && args.remote.version === 1) {
    return { payload: args.remote, needsPush: false };
  }
  if (args.scopedLocal && args.scopedLocal.version === 1) {
    return { payload: args.scopedLocal, needsPush: true };
  }
  return { payload: buildInitialPayload({ legacy: args.legacy }), needsPush: true };
}

export const USER_STYLES_LOCAL_STORAGE_PREFIX = 'snlbpro_user_styles_';

export function scopedKey(userId: string): string {
  return `${USER_STYLES_LOCAL_STORAGE_PREFIX}${userId}`;
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Smoke test inline en consola del navegador**

Run: `cd frontend && npm run dev` y abrir cualquier página. En consola del navegador:

```js
const m = await import('/context/UserStyles/userStylesMigration.ts');
console.log(m.buildInitialPayload({ legacy: null }));
console.log(m.scopedKey('user-abc'));
console.log(m.loadOrMigrate({ remote: null, scopedLocal: null, legacy: null }));
```

Expected: muestra un `UserStylesPayload` con `version: 1` y los 3 scopes con un único preset 'Per defecte' cada uno. `scopedKey('user-abc')` devuelve `"snlbpro_user_styles_user-abc"`. `loadOrMigrate` devuelve `{ payload, needsPush: true }`.

- [ ] **Step 4: Commit**

```bash
git add frontend/context/UserStyles/userStylesMigration.ts
git commit -m "feat(user-styles): logica de carga y migracion desde snlbpro_editor_styles"
```

---

### Task 5: Crear `UserStylesContext.tsx`

**Files:**
- Create: `frontend/context/UserStyles/UserStylesContext.tsx`

- [ ] **Step 1: Esqueleto del contexto**

```tsx
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

// Mismo patrón que App.tsx:667 y SettingsModal.tsx:356 — flag ad-hoc.
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
```

- [ ] **Step 2: Componente Provider con state, debounce y mutaciones**

```tsx
// (continuación del mismo archivo)

export const UserStylesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { me } = useAuth();
  const [payload, setPayload] = useState<UserStylesPayload>(() =>
    buildInitialPayload({ legacy: readLegacyEditorStyles() }),
  );
  const debounceRef = useRef<number | null>(null);

  // Aplica al DOM en cada cambio.
  useEffect(() => {
    applyUserStylesToDOM(payload);
  }, [payload]);

  // Cache local scoped por userId.
  useEffect(() => {
    if (me?.id) writeScopedLocal(me.id, payload);
  }, [me?.id, payload]);

  // Sync entre ventanas: si otra ventana cambia el cache, re-leer.
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

  // Carga inicial / migración cuando entra el perfil.
  useEffect(() => {
    if (!me) return;
    const remote: UserStylesPayload | null = (me as any)?.preferences?.userStyles ?? null;
    const scopedLocal = readScopedLocal(me.id);
    const legacy = readLegacyEditorStyles();
    const result = loadOrMigrate({ remote, scopedLocal, legacy });
    setPayload(result.payload);
    if (result.needsPush && USE_BACKEND) {
      api.updateMe({ preferences: { userStyles: result.payload } }).catch(() => {});
    }
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

  // ── Selectores y mutaciones ────────────────────────────────────────────────

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

  // ── Métricas derivadas para subtítulos ────────────────────────────────────
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
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/context/UserStyles/UserStylesContext.tsx
git commit -m "feat(user-styles): UserStylesContext con presets, debounce y aplicacion al DOM"
```

---

### Task 6: Montar `UserStylesProvider` en `App.tsx` (sin retirar nada legacy)

**Files:**
- Modify: `frontend/App.tsx`

- [ ] **Step 1: Importar el provider**

Buscar en `App.tsx` la línea:
```ts
import { ThemeProvider } from './context/Theme/ThemeContext';
```

Añadir justo debajo:
```ts
import { UserStylesProvider } from './context/UserStyles/UserStylesContext';
```

- [ ] **Step 2: Envolver el árbol dentro de `<ThemeProvider>` con `<UserStylesProvider>`**

Buscar en `App.tsx` el lugar donde se renderiza `<ThemeProvider>` (cerca del export root, probablemente al final del archivo). El árbol actual es algo del estilo:

```tsx
<AuthProvider>
  <ThemeProvider>
    <LibraryProvider>
      <AppContent />
    </LibraryProvider>
  </ThemeProvider>
</AuthProvider>
```

Sustituirlo por:
```tsx
<AuthProvider>
  <ThemeProvider>
    <UserStylesProvider>
      <LibraryProvider>
        <AppContent />
      </LibraryProvider>
    </UserStylesProvider>
  </ThemeProvider>
</AuthProvider>
```

(Si la jerarquía exacta es distinta, mantener el orden: `UserStylesProvider` siempre dentro de `ThemeProvider` y por encima del resto.)

- [ ] **Step 3: Type-check + build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: PASS sin errores.

- [ ] **Step 4: Verificar en navegador que la app sigue arrancando**

Run: `cd frontend && npm run dev`
Open: la app, login.
Verify: la app carga normal, sin parpadeos ni errores de consola. Inspeccionar `:root` y confirmar que ahora hay variables `--us-*` definidas (DevTools → Elements → seleccionar `<html>` → Computed styles).

- [ ] **Step 5: Commit**

```bash
git add frontend/App.tsx
git commit -m "feat(user-styles): montar UserStylesProvider en el arbol global"
```

---

## Phase B — Migrar consumidores a CSS variables (sin cambios visibles)

### Task 7: `ColumnView.tsx` lee `--us-script-*` (en paralelo a la prop existente)

**Files:**
- Modify: `frontend/components/EditorDeGuions/ColumnView.tsx:41-53`

- [ ] **Step 1: Sustituir `getInlineStyle`**

Reemplazar la función:

```ts
const getInlineStyle = (
  style: EditorStyle,
  highlightStyle?: React.CSSProperties
): React.CSSProperties => ({
  fontFamily: style.fontFamily,
  fontSize: `${style.fontSize}px`,
  color: style.color,
  fontWeight: style.bold ? 'bold' : 'normal',
  fontStyle: style.italic ? 'italic' : 'normal',
  lineHeight: '1.4',
  backgroundColor: highlightStyle?.backgroundColor,
  borderRadius: highlightStyle ? '2px' : undefined,
});
```

por una versión que delega a CSS vars según un identificador de elemento:

```ts
type ScriptElementKey = 'take' | 'speaker' | 'timecode' | 'dialogue' | 'dialogueparen' | 'dialoguetcparen';

const cssVarStyle = (
  element: ScriptElementKey,
  highlightStyle?: React.CSSProperties,
): React.CSSProperties => ({
  fontFamily: `var(--us-script-${element}-family)`,
  fontSize:   `var(--us-script-${element}-size)`,
  color:      `var(--us-script-${element}-color)`,
  fontWeight: `var(--us-script-${element}-weight)` as any,
  fontStyle:  `var(--us-script-${element}-style)`,
  lineHeight: '1.4',
  backgroundColor: highlightStyle?.backgroundColor,
  borderRadius: highlightStyle ? '2px' : undefined,
});

/** Mapea una clave de EditorStyles a la clave usada en las CSS vars --us-script-*. */
const scriptKeyOf = (k: keyof EditorStyles): ScriptElementKey => {
  switch (k) {
    case 'dialogueParentheses':         return 'dialogueparen';
    case 'dialogueTimecodeParentheses': return 'dialoguetcparen';
    default:                            return k;
  }
};

/** Backward-compat: mantiene la firma anterior pero ahora ignora `style` y usa CSS vars. */
const getInlineStyle = (
  _style: EditorStyle,
  highlightStyle?: React.CSSProperties,
  /** Para que los call sites puedan indicar de qué elemento se trata. Opcional para no romper. */
  element?: ScriptElementKey,
): React.CSSProperties =>
  cssVarStyle(element ?? 'dialogue', highlightStyle);
```

- [ ] **Step 2: Actualizar los call sites internos para pasar el `element`**

Buscar todos los `getInlineStyle(...)` dentro del archivo (líneas aprox. 78-91 de `renderDialogueText`, 531, 553, 650, 704, etc.). Cada call site ya pasa `styles.<key>` — sustituir cada llamada para añadir el tercer argumento.

Patrón a aplicar:

| Call site | Tenía | Pasa a |
|---|---|---|
| `renderDialogueText` paréntesis normal | `getInlineStyle(styleToApply, highlightStyle)` (línea 81) | `getInlineStyle(styleToApply, highlightStyle, scriptKeyOf('dialogueParentheses'))` o más exacto: detectar si es timecode y usar `'dialoguetcparen'`/`'dialogueparen'`. |
| `renderDialogueText` texto normal | `getInlineStyle(styles.dialogue, highlightStyle)` (línea 91) | `getInlineStyle(styles.dialogue, highlightStyle, 'dialogue')` |
| Render del TAKE | `getInlineStyle(styles.take)` o similar | `getInlineStyle(styles.take, undefined, 'take')` |
| Render del speaker | `getInlineStyle(styles.speaker)` | `getInlineStyle(styles.speaker, undefined, 'speaker')` |
| Render del timecode | `getInlineStyle(styles.timecode)` | `getInlineStyle(styles.timecode, undefined, 'timecode')` |

Hacerlo para los ~6 call sites del archivo. La prop `editorStyles` se queda donde está (de momento).

- [ ] **Step 3: Type-check + build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 4: Verificar en navegador**

Run: `cd frontend && npm run dev`
Open: cualquier documento `.snlbpro` en el editor de guiones.
Verify: el editor renderiza idéntico a antes (mismas fuentes, tamaños y colores). Si hay diferencia, las vars no están aplicadas — comprobar `:root` en DevTools.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/EditorDeGuions/ColumnView.tsx
git commit -m "refactor(user-styles): ColumnView lee CSS vars --us-script-*"
```

---

### Task 8: `SegmentItem.tsx` lee `--us-sub-*` para texto y metadatos (sin tocar grid/row-height aún)

**Files:**
- Modify: `frontend/components/VideoSubtitlesEditor/SegmentItem.tsx`

- [ ] **Step 1: Sustituir el estilo del texto editable (columna 5)**

Buscar el bloque del contenido editable (alrededor de las líneas 539-569) que usa `text-[14.5px]` y `fontFamily: "'Courier Prime', monospace"`.

Localizar la línea donde está el `style={{...}}` del elemento `contentEditable` (o similar). Sustituir el `fontFamily`/`fontSize`/`color` hardcoded por:

```tsx
style={{
  fontFamily: 'var(--us-sub-content-family)',
  fontSize:   'var(--us-sub-content-size)',
  color:      isActive ? 'var(--th-editor-text-active)' : 'var(--us-sub-content-color)',
  fontWeight: 'var(--us-sub-content-weight)' as any,
  fontStyle:  'var(--us-sub-content-style)',
  lineHeight: ROW_HEIGHT,            // SE QUEDA — se cambia en Task 10
  minHeight: ROW_HEIGHT,             // SE QUEDA — se cambia en Task 10
  caretColor: 'var(--th-editor-caret)',
}}
```

Quitar también la clase Tailwind `text-[14.5px]` del `className` del mismo elemento (dejar el resto de clases intactas).

- [ ] **Step 2: Sustituir el estilo del label TAKE (columna 1)**

Buscar el `<span>` del TAKE label (línea ~478) que tiene `text-[10px] font-black` y `color: 'var(--th-accent-text)'`.

Cambiar a:
```tsx
style={{
  fontFamily: 'var(--us-sub-takelabel-family)',
  fontSize:   'var(--us-sub-takelabel-size)',
  color:      'var(--us-sub-takelabel-color)',
  fontWeight: 'var(--us-sub-takelabel-weight)' as any,
  fontStyle:  'var(--us-sub-takelabel-style)',
}}
```

Quitar `text-[10px] font-black` del className.

- [ ] **Step 3: Sustituir el estilo del ID + CPS (columna 2)**

Buscar los spans de ID y CPS (líneas ~492-500). Aplicar:

```tsx
// ID
style={{
  fontFamily: 'var(--us-sub-idcps-family)',
  fontSize:   'var(--us-sub-idcps-size)',
  color:      'var(--us-sub-idcps-color)',
  fontWeight: 'var(--us-sub-idcps-weight)' as any,
  fontStyle:  'var(--us-sub-idcps-style)',
}}
```

Misma idea para el span del CPS. Mantener el override de `text-red-500` cuando `cps > 20` (sustituir `color` inline a `'#ef4444'` en ese caso).

Quitar `text-[11px] font-black` y `text-[8px] font-normal opacity-60` del className y reemplazarlos por estilos inline equivalentes desde la var (o mantener `opacity` puro de Tailwind si solo es opacity).

- [ ] **Step 4: Sustituir el estilo del char counter (columna 4)**

Buscar el span del contador de caracteres (líneas ~528-536) con `text-[11px] font-black`.

Cambiar a:
```tsx
style={{
  fontFamily: 'var(--us-sub-charcounter-family)',
  fontSize:   'var(--us-sub-charcounter-size)',
  color:      isOverflow ? '#ef4444' : 'var(--us-sub-charcounter-color)',
  fontWeight: 'var(--us-sub-charcounter-weight)' as any,
  fontStyle:  'var(--us-sub-charcounter-style)',
}}
```

(Sustituir `isOverflow` por la condición real que use el archivo, p.e. `chars > maxCharsPerLine`.)

Quitar `text-[11px] font-black` del className.

- [ ] **Step 5: Sustituir el estilo de los action buttons (barra de hover)**

Buscar el bloque de la barra de acciones (líneas ~612-675) — los botones internos que tienen `text-[9px]`.

Aplicar a cada botón el `style={{ fontFamily: 'var(--us-sub-actionbuttons-family)', fontSize: 'var(--us-sub-actionbuttons-size)', color: 'var(--us-sub-actionbuttons-color)', fontWeight: 'var(--us-sub-actionbuttons-weight)' as any, fontStyle: 'var(--us-sub-actionbuttons-style)' }}`. Quitar `text-[9px]` del className.

Mantener los colores hardcoded por estado (hover amber/emerald/red), solo el "default" baja a la var.

- [ ] **Step 6: Type-check + build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 7: Verificar en navegador**

Run: `cd frontend && npm run dev`
Open: una vista con el editor de subtítulos (un .srt o un proyecto).
Verify: cada fila de subtítulo se ve **idéntica a antes** (texto, tamaños, colores). El layout NO cambia porque las CSS vars actuales del preset 'Per defecte' reproducen el aspecto anterior.

- [ ] **Step 8: Commit**

```bash
git add frontend/components/VideoSubtitlesEditor/SegmentItem.tsx
git commit -m "refactor(user-styles): SegmentItem lee CSS vars --us-sub-* (texto, metadatos, acciones)"
```

---

### Task 9: `TimecodeInput.tsx` lee `--us-sub-timecode-*`

**Files:**
- Modify: `frontend/components/VideoSubtitlesEditor/TimecodeInput.tsx`

- [ ] **Step 1: Sustituir hardcodes**

Buscar todos los lugares con `text-[10px]`, `text-[9px]`, `text-[8px]` y `fontFamily: "'Courier Prime', monospace"` o similares en este archivo.

Sustituir el estilo del display del timecode y del input (líneas ~70-80) por:

```tsx
style={{
  fontFamily: 'var(--us-sub-timecode-family)',
  fontSize:   'var(--us-sub-timecode-size)',
  color:      'var(--us-sub-timecode-color)',
  fontWeight: 'var(--us-sub-timecode-weight)' as any,
  fontStyle:  'var(--us-sub-timecode-style)',
  width: '7.5ch',  // se queda — se reevalúa contra la nueva fuente automáticamente
}}
```

Quitar las clases Tailwind `text-[10px]` y `font-mono` del display del timecode.

Para los **labels** "IN/OUT" y los **adjust buttons** — son metadatos visuales que no están cubiertos por un atom propio. Aplicarles también `--us-sub-timecode-*` (mismos valores que el display) para mantener coherencia visual.

- [ ] **Step 2: Type-check + build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 3: Verificar en navegador**

Run: `cd frontend && npm run dev`
Open: editor de subtítulos.
Verify: los timecodes IN/OUT se ven idénticos a antes. Probar el modo edit (clic en un timecode) y confirmar que el input mantiene las mismas dimensiones.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/VideoSubtitlesEditor/TimecodeInput.tsx
git commit -m "refactor(user-styles): TimecodeInput lee CSS vars --us-sub-timecode-*"
```

---

### Task 10: ROW_HEIGHT dinámico via `--us-sub-row-height`

**Files:**
- Modify: `frontend/components/VideoSubtitlesEditor/SegmentItem.tsx:87`

- [ ] **Step 1: Eliminar la const ROW_HEIGHT**

Borrar la línea:
```ts
const ROW_HEIGHT = '24px';
```

- [ ] **Step 2: Sustituir todos los usos de `ROW_HEIGHT` por la CSS var**

Buscar todos los `ROW_HEIGHT` dentro del archivo (probablemente 2-4 ocurrencias):
- En `gridTemplateRows: \`repeat(${maxLines}, ${ROW_HEIGHT})\`` → `gridTemplateRows: \`repeat(${maxLines}, var(--us-sub-row-height))\``.
- En `lineHeight: ROW_HEIGHT,` (del style del contenido editable de Task 8) → `lineHeight: 'var(--us-sub-row-height)',`.
- En `minHeight: ROW_HEIGHT,` → `minHeight: 'var(--us-sub-row-height)',`.

- [ ] **Step 3: Type-check + build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 4: Verificar en navegador con prueba de aumento de tamaño**

Run: `cd frontend && npm run dev`
Open: editor de subtítulos.
Verify base: las filas se ven idénticas (la var actual emite 24px porque content=14, max(14)*1.55=22, max con 24=24).

Verify dinámico: en DevTools, en el `<html>`, cambiar manualmente `--us-sub-content-size: 22px;` y `--us-sub-row-height: 34px;`. Confirmar que las filas crecen y el texto editable encaja sin cortes y sin solaparse con la fila siguiente.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/VideoSubtitlesEditor/SegmentItem.tsx
git commit -m "refactor(user-styles): ROW_HEIGHT del editor de subtitulos dinamico via --us-sub-row-height"
```

---

### Task 11: Grid columns dinámicas via `--us-sub-grid-columns`

**Files:**
- Modify: `frontend/components/VideoSubtitlesEditor/SegmentItem.tsx:466` (gridTemplateColumns)

- [ ] **Step 1: Sustituir el `gridTemplateColumns`**

Buscar:
```ts
gridTemplateColumns: '10ch 12ch 21ch 5ch max-content'
```

Reemplazar por:
```ts
gridTemplateColumns: 'var(--us-sub-grid-columns)'
```

- [ ] **Step 2: Type-check + build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 3: Verificar en navegador**

Run: `cd frontend && npm run dev`
Open: editor de subtítulos.
Verify base: las columnas se ven con anchos similares al estado anterior (los px calculados por `computeSubGridCols` para los valores de fábrica deben quedar muy cerca de `10ch 12ch 21ch 5ch` con Courier).

Verify dinámico: en DevTools cambiar manualmente `--us-sub-grid-columns` a `'200px 200px 300px 80px max-content'`. Confirmar que las columnas se reorganizan sin solapamientos.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/VideoSubtitlesEditor/SegmentItem.tsx
git commit -m "refactor(user-styles): grid del editor de subtitulos dinamico via --us-sub-grid-columns"
```

---

### Task 12: Virtual scroll `estimateSize` dinámico

**Files:**
- Modify: `frontend/components/VideoSubtitlesEditor/SubtitlesEditor.tsx:156`

- [ ] **Step 1: Importar `useUserStyles`**

Añadir al bloque de imports:
```ts
import { useUserStyles } from '../../context/UserStyles/UserStylesContext';
```

- [ ] **Step 2: Leer `subtitleRowEstimate` y usarlo en `useVirtualizer`**

Dentro del componente, justo antes de `useVirtualizer`, añadir:
```ts
const { subtitleRowEstimate } = useUserStyles();
```

Sustituir:
```ts
estimateSize: () => 90,
```
por:
```ts
estimateSize: () => subtitleRowEstimate,
```

- [ ] **Step 3: Re-medir cuando cambie el estimate**

Justo después del `const rowVirtualizer = useVirtualizer({ ... })`, añadir:
```ts
useEffect(() => {
  rowVirtualizer.measure();
}, [subtitleRowEstimate]);
```

(Si `useEffect` no está importado, añadirlo al import de React: `import React, { useEffect, ... } from 'react';`.)

- [ ] **Step 4: Type-check + build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 5: Verificar en navegador**

Run: `cd frontend && npm run dev`
Open: editor de subtítulos con muchas filas.
Verify: el scroll funciona normal. Sin saltos. En DevTools cambiar `--us-sub-content-size` a `22px` y observar que las filas crecen y el scroll se reposiciona.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/VideoSubtitlesEditor/SubtitlesEditor.tsx
git commit -m "refactor(user-styles): virtual scroll del editor de subtitulos con estimate dinamico"
```

---

### Task 13: `LibraryFileItem.tsx` lee `--us-home-*`

**Files:**
- Modify: `frontend/components/Library/LibraryFileItem.tsx`

- [ ] **Step 1: Nombre de archivo (línea ~334)**

Buscar el `<span>` o `<div>` del nombre de archivo con clases `text-sm` (y `text-gray-100` o `text-gray-400` según locked).

Añadir/sustituir:
```tsx
style={{
  fontFamily: 'var(--us-home-filename-family)',
  fontSize:   'var(--us-home-filename-size)',
  color:      isLocked ? 'var(--us-home-filename-color)' : 'var(--us-home-filename-color)',
  fontWeight: 'var(--us-home-filename-weight)' as any,
  fontStyle:  'var(--us-home-filename-style)',
}}
```

(Mantener los overrides condicionales `line-through` y `text-gray-500` para LNK huérfanos como sobreescritos.)

Quitar `text-sm` del className.

- [ ] **Step 2: Etiqueta de formato (líneas ~338-340)**

Sustituir el `text-[10px] font-black uppercase text-gray-500` por:
```tsx
className="uppercase"  // mantener uppercase
style={{
  fontFamily: 'var(--us-home-format-family)',
  fontSize:   'var(--us-home-format-size)',
  color:      'var(--us-home-format-color)',
  fontWeight: 'var(--us-home-format-weight)' as any,
  fontStyle:  'var(--us-home-format-style)',
}}
```

- [ ] **Step 3: Fecha y hora (líneas ~342-344)**

Sustituir las clases `text-[10px] font-mono text-gray-400` por:
```tsx
style={{
  fontFamily: 'var(--us-home-datetime-family)',
  fontSize:   'var(--us-home-datetime-size)',
  color:      'var(--us-home-datetime-color)',
  fontWeight: 'var(--us-home-datetime-weight)' as any,
  fontStyle:  'var(--us-home-datetime-style)',
}}
```

(La hora con `opacity-40` mantiene la opacidad como className.)

- [ ] **Step 4: Type-check + build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 5: Verificar en navegador**

Run: `cd frontend && npm run dev`
Open: pestaña Files de la librería.
Verify: cada fila de archivo se ve idéntica a antes — nombre, formato y fecha. Cambiar manualmente `--us-home-filename-size: 18px;` en DevTools y confirmar que los nombres se ven más grandes sin destruir el grid (las columnas son flexibles).

- [ ] **Step 6: Commit**

```bash
git add frontend/components/Library/LibraryFileItem.tsx
git commit -m "refactor(user-styles): LibraryFileItem lee CSS vars --us-home-*"
```

---

### Task 14: `SonilabLibraryView.tsx` (tabs, breadcrumb, header) lee `--us-home-*`

**Files:**
- Modify: `frontend/components/Library/SonilabLibraryView.tsx`

- [ ] **Step 1: Tabs Files/Projectes/Media/Paperera (líneas ~743-785)**

Cada `<button>` tiene `text-sm font-semibold`. Sustituir por inline style + clase mínima:

```tsx
className="..."  // resto sin text-sm font-semibold
style={{
  fontFamily: 'var(--us-home-navtabs-family)',
  fontSize:   'var(--us-home-navtabs-size)',
  color:      'var(--us-home-navtabs-color)',
  fontWeight: 'var(--us-home-navtabs-weight)' as any,
  fontStyle:  'var(--us-home-navtabs-style)',
}}
```

Hacerlo para los 4 botones de tab.

- [ ] **Step 2: Breadcrumb (líneas ~885-905)**

El contenedor breadcrumb usa `text-sm`. Sustituir por:
```tsx
style={{
  fontFamily: 'var(--us-home-breadcrumb-family)',
  fontSize:   'var(--us-home-breadcrumb-size)',
  color:      'var(--us-home-breadcrumb-color)',
  fontWeight: 'var(--us-home-breadcrumb-weight)' as any,
  fontStyle:  'var(--us-home-breadcrumb-style)',
}}
```

Quitar `text-sm` del className del contenedor.

**IMPORTANTE:** el breadcrumb tiene `h-10` fijo. Si el font-size sube, puede no caber. Cambiar `h-10` por `min-h-10` para permitir crecer (`min-h-[2.5rem]`).

- [ ] **Step 3: Header de tabla (líneas ~911-940)**

El header `text-[10px] font-black uppercase tracking-widest`. Sustituir el className por:
```tsx
className="uppercase tracking-widest"
style={{
  fontFamily: 'var(--us-home-tableheader-family)',
  fontSize:   'var(--us-home-tableheader-size)',
  color:      'var(--us-home-tableheader-color)',
  fontWeight: 'var(--us-home-tableheader-weight)' as any,
  fontStyle:  'var(--us-home-tableheader-style)',
}}
```

Hacerlo para los `<button>` "Nom", "Format", "Data i hora" del header.

- [ ] **Step 4: Type-check + build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 5: Verificar en navegador**

Run: `cd frontend && npm run dev`
Open: pestaña Files (y cambiar a Projectes, Media, Paperera).
Verify: los tabs, breadcrumb y header se ven idénticos. Probar cambiar `--us-home-navtabs-size: 18px;` en DevTools — los botones crecen sin romper el contenedor.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/Library/SonilabLibraryView.tsx
git commit -m "refactor(user-styles): tabs, breadcrumb y table header de la libreria leen --us-home-*"
```

---

## Phase C — Nueva UI de configuración

### Task 15: `StyleAtomEditor.tsx` (componente reutilizable)

**Files:**
- Create: `frontend/components/Settings/UserStyles/StyleAtomEditor.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// frontend/components/Settings/UserStyles/StyleAtomEditor.tsx
import React from 'react';
import type { StyleAtom } from '../../../types/UserStyles/userStylesTypes';

const FONT_FACES = ['sans-serif', 'serif', 'monospace', 'Arial', 'Verdana', 'Times New Roman', 'Courier Prime, monospace'];

interface Props {
  label: string;
  atom: StyleAtom;
  onChange: (patch: Partial<StyleAtom>) => void;
  /** Tamaño mínimo permitido (px). Por defecto 8. */
  minSize?: number;
  /** Tamaño máximo permitido (px). Por defecto 32. */
  maxSize?: number;
}

export const StyleAtomEditor: React.FC<Props> = ({ label, atom, onChange, minSize = 8, maxSize = 32 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] items-center gap-4 py-3 border-b last:border-b-0" style={{ borderColor: 'var(--th-border)' }}>
      <h4 className="font-semibold md:text-right" style={{ color: 'var(--th-text-primary)' }}>{label}</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--th-text-muted)' }}>Tipografia</label>
          <select
            value={atom.fontFamily}
            onChange={e => onChange({ fontFamily: e.target.value })}
            className="w-full rounded-md px-2 py-1 text-sm"
            style={{ backgroundColor: 'var(--th-bg-tertiary)', border: '1px solid var(--th-border)', color: 'var(--th-text-primary)' }}
          >
            {FONT_FACES.map(f => <option key={f} value={f}>{f}</option>)}
            {/* Si la familia actual no está en la lista, añadirla para no perderla */}
            {!FONT_FACES.includes(atom.fontFamily) && (
              <option value={atom.fontFamily}>{atom.fontFamily}</option>
            )}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--th-text-muted)' }}>Mida (px)</label>
          <input
            type="number"
            min={minSize}
            max={maxSize}
            value={atom.fontSize}
            onChange={e => {
              const n = parseInt(e.target.value, 10);
              if (!Number.isNaN(n)) onChange({ fontSize: Math.max(minSize, Math.min(maxSize, n)) });
            }}
            className="w-full rounded-md px-2 py-1 text-sm"
            style={{ backgroundColor: 'var(--th-bg-tertiary)', border: '1px solid var(--th-border)', color: 'var(--th-text-primary)' }}
          />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--th-text-muted)' }}>Color</label>
          <input
            type="color"
            value={atom.color}
            onChange={e => onChange({ color: e.target.value })}
            className="w-full h-8 p-0 bg-transparent border-none rounded-md cursor-pointer"
          />
        </div>
        <div className="flex items-center gap-3 pb-1">
          <label className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: 'var(--th-text-secondary)' }}>
            <input type="checkbox" checked={atom.bold}   onChange={e => onChange({ bold:   e.target.checked })} className="w-4 h-4 rounded" />
            Negreta
          </label>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: 'var(--th-text-secondary)' }}>
            <input type="checkbox" checked={atom.italic} onChange={e => onChange({ italic: e.target.checked })} className="w-4 h-4 rounded" />
            Cursiva
          </label>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/Settings/UserStyles/StyleAtomEditor.tsx
git commit -m "feat(user-styles): StyleAtomEditor reutilizable para los 3 scopes"
```

---

### Task 16: `StylesPresetBar.tsx`

**Files:**
- Create: `frontend/components/Settings/UserStyles/StylesPresetBar.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// frontend/components/Settings/UserStyles/StylesPresetBar.tsx
import React, { useState } from 'react';
import { useUserStyles } from '../../../context/UserStyles/UserStylesContext';
import type { StyleScope } from '../../../types/UserStyles/userStylesTypes';

interface Props {
  scope: StyleScope;
}

export const StylesPresetBar: React.FC<Props> = ({ scope }) => {
  const { payload, setActivePreset, createPreset, duplicatePreset, renamePreset, deletePreset, resetActivePreset } = useUserStyles();
  const state = payload[scope];
  const active = state.presets.find(p => p.id === state.activePresetId) ?? state.presets[0];
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(active.name);

  const startRename = () => {
    if (active.builtin) return;
    setDraftName(active.name);
    setRenaming(true);
  };

  const commitRename = () => {
    const name = draftName.trim();
    if (name) renamePreset(scope, active.id, name);
    setRenaming(false);
  };

  const handleNew = () => {
    createPreset(scope, 'Nou preset');
  };

  const handleDuplicate = () => {
    duplicatePreset(scope, active.id);
  };

  const handleDelete = () => {
    if (active.builtin) return;
    if (state.presets.length <= 1) return;
    deletePreset(scope, active.id);
  };

  const handleReset = () => {
    if (!confirm('Restablir aquest preset als valors de fàbrica?')) return;
    resetActivePreset(scope);
  };

  const btn = "px-2.5 py-1 text-xs font-semibold rounded-md transition-all";
  const btnStyle: React.CSSProperties = { backgroundColor: 'var(--th-bg-tertiary)', color: 'var(--th-text-primary)', border: '1px solid var(--th-border)' };
  const dangerStyle: React.CSSProperties = { backgroundColor: 'var(--th-bg-tertiary)', color: '#f87171', border: '1px solid var(--th-border)' };

  return (
    <div className="flex items-center gap-2 p-3 rounded-xl mb-4" style={{ backgroundColor: 'var(--th-bg-secondary)', border: '1px solid var(--th-border)' }}>
      <span className="text-xs font-bold uppercase tracking-widest mr-1" style={{ color: 'var(--th-text-muted)' }}>Preset</span>
      {renaming ? (
        <input
          autoFocus
          value={draftName}
          onChange={e => setDraftName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false); }}
          className="px-2 py-1 text-sm rounded-md flex-1 max-w-xs"
          style={{ backgroundColor: 'var(--th-bg-tertiary)', border: '1px solid var(--th-border)', color: 'var(--th-text-primary)' }}
        />
      ) : (
        <select
          value={active.id}
          onChange={e => setActivePreset(scope, e.target.value)}
          className="px-2 py-1 text-sm rounded-md flex-1 max-w-xs"
          style={{ backgroundColor: 'var(--th-bg-tertiary)', border: '1px solid var(--th-border)', color: 'var(--th-text-primary)' }}
        >
          {state.presets.map(p => (
            <option key={p.id} value={p.id}>{p.name}{p.builtin ? ' (per defecte)' : ''}</option>
          ))}
        </select>
      )}
      <button className={btn} style={btnStyle} onClick={handleNew}>Nou</button>
      <button className={btn} style={btnStyle} onClick={handleDuplicate}>Duplica</button>
      <button className={btn} style={btnStyle} onClick={startRename} disabled={active.builtin} title={active.builtin ? 'No es pot reanomenar el preset per defecte' : ''}>Reanomena</button>
      <button className={btn} style={dangerStyle} onClick={handleDelete} disabled={active.builtin || state.presets.length <= 1} title={active.builtin ? 'No es pot eliminar el preset per defecte' : ''}>✕</button>
      <button className={btn + ' ml-auto'} style={btnStyle} onClick={handleReset}>Restablir</button>
    </div>
  );
};
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/Settings/UserStyles/StylesPresetBar.tsx
git commit -m "feat(user-styles): StylesPresetBar con acciones de gestion de presets"
```

---

### Task 17: `ScriptStylePreview.tsx`

**Files:**
- Create: `frontend/components/Settings/UserStyles/ScriptStylePreview.tsx`

- [ ] **Step 1: Crear el preview de guion**

```tsx
// frontend/components/Settings/UserStyles/ScriptStylePreview.tsx
import React from 'react';

const cellStyle = (el: string): React.CSSProperties => ({
  fontFamily: `var(--us-script-${el}-family)`,
  fontSize:   `var(--us-script-${el}-size)`,
  color:      `var(--us-script-${el}-color)`,
  fontWeight: `var(--us-script-${el}-weight)` as any,
  fontStyle:  `var(--us-script-${el}-style)`,
});

export const ScriptStylePreview: React.FC = () => {
  return (
    <div className="p-4 rounded-xl mt-4" style={{ backgroundColor: '#fafafa', border: '1px solid var(--th-border)' }}>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--th-text-muted)' }}>Visualització</div>
      <div className="space-y-1">
        <div style={cellStyle('take')}>TAKE 1</div>
        <div className="flex gap-3">
          <div style={cellStyle('speaker')}>PERSONATGE</div>
          <div style={cellStyle('timecode')}>00:00:01,200</div>
        </div>
        <div style={cellStyle('dialogue')}>
          Aquest és un text d'exemple del diàleg{' '}
          <span style={cellStyle('dialogueparen')}>(amb una nota entre parèntesis)</span>{' '}
          i també{' '}
          <span style={cellStyle('dialoguetcparen')}>(00:01)</span>{' '}
          un codi de temps.
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Type-check + commit**

Run: `cd frontend && npx tsc --noEmit`
```bash
git add frontend/components/Settings/UserStyles/ScriptStylePreview.tsx
git commit -m "feat(user-styles): preview en viu del editor de guions"
```

---

### Task 18: `SubtitleStylePreview.tsx`

**Files:**
- Create: `frontend/components/Settings/UserStyles/SubtitleStylePreview.tsx`

- [ ] **Step 1: Crear el preview de subtítulos**

```tsx
// frontend/components/Settings/UserStyles/SubtitleStylePreview.tsx
import React from 'react';

const cellStyle = (el: string): React.CSSProperties => ({
  fontFamily: `var(--us-sub-${el}-family)`,
  fontSize:   `var(--us-sub-${el}-size)`,
  color:      `var(--us-sub-${el}-color)`,
  fontWeight: `var(--us-sub-${el}-weight)` as any,
  fontStyle:  `var(--us-sub-${el}-style)`,
});

export const SubtitleStylePreview: React.FC = () => {
  return (
    <div className="p-4 rounded-xl mt-4" style={{ backgroundColor: 'var(--th-editor-bg, #1a1a1a)', border: '1px solid var(--th-border)' }}>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--th-text-muted)' }}>Visualització</div>
      <div
        className="grid items-center"
        style={{
          gridTemplateColumns: 'var(--us-sub-grid-columns)',
          gridTemplateRows: 'var(--us-sub-row-height)',
        }}
      >
        <div style={cellStyle('takelabel')}>TAKE 1</div>
        <div style={cellStyle('idcps')}>#001 · 12cps</div>
        <div style={cellStyle('timecode')}>00:00:01,200 → 00:00:03,600</div>
        <div style={cellStyle('charcounter')}>32</div>
        <div style={cellStyle('content')}>Aquest és un text d'exemple del subtítol.</div>
      </div>
      <div className="flex gap-2 mt-2">
        <span style={cellStyle('actionbuttons')}>+ Sobre</span>
        <span style={cellStyle('actionbuttons')}>+ Sota</span>
        <span style={cellStyle('actionbuttons')}>Dividir</span>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Type-check + commit**

Run: `cd frontend && npx tsc --noEmit`
```bash
git add frontend/components/Settings/UserStyles/SubtitleStylePreview.tsx
git commit -m "feat(user-styles): preview en viu del editor de subtitols"
```

---

### Task 19: `HomeStylePreview.tsx`

**Files:**
- Create: `frontend/components/Settings/UserStyles/HomeStylePreview.tsx`

- [ ] **Step 1: Crear el preview del home**

```tsx
// frontend/components/Settings/UserStyles/HomeStylePreview.tsx
import React from 'react';

const cellStyle = (el: string): React.CSSProperties => ({
  fontFamily: `var(--us-home-${el}-family)`,
  fontSize:   `var(--us-home-${el}-size)`,
  color:      `var(--us-home-${el}-color)`,
  fontWeight: `var(--us-home-${el}-weight)` as any,
  fontStyle:  `var(--us-home-${el}-style)`,
});

export const HomeStylePreview: React.FC = () => {
  return (
    <div className="p-4 rounded-xl mt-4" style={{ backgroundColor: 'var(--th-bg-secondary)', border: '1px solid var(--th-border)' }}>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--th-text-muted)' }}>Visualització</div>
      <div className="flex gap-3 mb-2">
        <span style={cellStyle('navtabs')}>Files</span>
        <span style={cellStyle('navtabs')}>Projectes</span>
        <span style={cellStyle('navtabs')}>Media</span>
      </div>
      <div className="mb-2" style={cellStyle('breadcrumb')}>Files / Projecte demo / Capítol 1</div>
      <div className="grid grid-cols-[1fr_120px_140px] gap-3 mb-2 uppercase tracking-widest" style={cellStyle('tableheader')}>
        <span>Nom</span><span>Format</span><span>Data i hora</span>
      </div>
      <div className="grid grid-cols-[1fr_120px_140px] gap-3 py-1">
        <span style={cellStyle('filename')}>capitol_01.snlbpro</span>
        <span style={cellStyle('format')}>SNLBPRO</span>
        <span style={cellStyle('datetime')}>06/04/2026 14:23</span>
      </div>
      <div className="grid grid-cols-[1fr_120px_140px] gap-3 py-1">
        <span style={cellStyle('filename')}>capitol_01.srt</span>
        <span style={cellStyle('format')}>SRT</span>
        <span style={cellStyle('datetime')}>06/04/2026 14:25</span>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Type-check + commit**

Run: `cd frontend && npx tsc --noEmit`
```bash
git add frontend/components/Settings/UserStyles/HomeStylePreview.tsx
git commit -m "feat(user-styles): preview en viu del home/llibreria"
```

---

### Task 20: `ScriptStylesPanel.tsx`

**Files:**
- Create: `frontend/components/Settings/UserStyles/ScriptStylesPanel.tsx`

- [ ] **Step 1: Crear el panel del editor de guion**

```tsx
// frontend/components/Settings/UserStyles/ScriptStylesPanel.tsx
import React from 'react';
import { useUserStyles } from '../../../context/UserStyles/UserStylesContext';
import { StyleAtomEditor } from './StyleAtomEditor';
import { StylesPresetBar } from './StylesPresetBar';
import { ScriptStylePreview } from './ScriptStylePreview';
import type { ScriptEditorStyleSet } from '../../../types/UserStyles/userStylesTypes';

const ROWS: { key: keyof ScriptEditorStyleSet; label: string }[] = [
  { key: 'take',                        label: 'Takes' },
  { key: 'speaker',                     label: 'Noms' },
  { key: 'timecode',                    label: 'Codi de temps' },
  { key: 'dialogue',                    label: 'Text' },
  { key: 'dialogueParentheses',         label: 'Text (parèntesi)' },
  { key: 'dialogueTimecodeParentheses', label: 'TC/Núm. (parèntesi)' },
];

export const ScriptStylesPanel: React.FC = () => {
  const { activePreset, updateAtom } = useUserStyles();
  const preset = activePreset('scriptEditor');

  return (
    <div>
      <StylesPresetBar scope="scriptEditor" />
      {ROWS.map(row => (
        <StyleAtomEditor
          key={row.key}
          label={row.label}
          atom={preset.styles[row.key]}
          onChange={patch => updateAtom('scriptEditor', row.key, patch)}
        />
      ))}
      <ScriptStylePreview />
    </div>
  );
};
```

- [ ] **Step 2: Type-check + commit**

Run: `cd frontend && npx tsc --noEmit`
```bash
git add frontend/components/Settings/UserStyles/ScriptStylesPanel.tsx
git commit -m "feat(user-styles): ScriptStylesPanel sub-pestaña editor de guions"
```

---

### Task 21: `SubtitleStylesPanel.tsx`

**Files:**
- Create: `frontend/components/Settings/UserStyles/SubtitleStylesPanel.tsx`

- [ ] **Step 1: Crear el panel del editor de subtítulos**

```tsx
// frontend/components/Settings/UserStyles/SubtitleStylesPanel.tsx
import React from 'react';
import { useUserStyles } from '../../../context/UserStyles/UserStylesContext';
import { StyleAtomEditor } from './StyleAtomEditor';
import { StylesPresetBar } from './StylesPresetBar';
import { SubtitleStylePreview } from './SubtitleStylePreview';
import type { SubtitleEditorStyleSet } from '../../../types/UserStyles/userStylesTypes';

const ROWS: { key: keyof SubtitleEditorStyleSet; label: string }[] = [
  { key: 'content',       label: 'Text del subtítol' },
  { key: 'timecode',      label: 'Codi de temps (IN/OUT)' },
  { key: 'idCps',         label: 'ID i CPS' },
  { key: 'takeLabel',     label: 'Etiqueta TAKE' },
  { key: 'charCounter',   label: 'Comptador caràcters' },
  { key: 'actionButtons', label: 'Botons d\'acció' },
];

export const SubtitleStylesPanel: React.FC = () => {
  const { activePreset, updateAtom } = useUserStyles();
  const preset = activePreset('subtitleEditor');

  return (
    <div>
      <StylesPresetBar scope="subtitleEditor" />
      {ROWS.map(row => (
        <StyleAtomEditor
          key={row.key}
          label={row.label}
          atom={preset.styles[row.key]}
          onChange={patch => updateAtom('subtitleEditor', row.key, patch)}
        />
      ))}
      <SubtitleStylePreview />
    </div>
  );
};
```

- [ ] **Step 2: Type-check + commit**

Run: `cd frontend && npx tsc --noEmit`
```bash
git add frontend/components/Settings/UserStyles/SubtitleStylesPanel.tsx
git commit -m "feat(user-styles): SubtitleStylesPanel sub-pestaña editor de subtitols"
```

---

### Task 22: `HomeStylesPanel.tsx`

**Files:**
- Create: `frontend/components/Settings/UserStyles/HomeStylesPanel.tsx`

- [ ] **Step 1: Crear el panel del home**

```tsx
// frontend/components/Settings/UserStyles/HomeStylesPanel.tsx
import React from 'react';
import { useUserStyles } from '../../../context/UserStyles/UserStylesContext';
import { StyleAtomEditor } from './StyleAtomEditor';
import { StylesPresetBar } from './StylesPresetBar';
import { HomeStylePreview } from './HomeStylePreview';
import type { HomeStyleSet } from '../../../types/UserStyles/userStylesTypes';

const ROWS: { key: keyof HomeStyleSet; label: string }[] = [
  { key: 'fileName',    label: "Nom d'arxiu" },
  { key: 'formatLabel', label: 'Format' },
  { key: 'dateTime',    label: 'Data i hora' },
  { key: 'tableHeader', label: 'Capçalera taula' },
  { key: 'navTabs',     label: 'Pestanyes navegació' },
  { key: 'breadcrumb',  label: 'Breadcrumb' },
];

export const HomeStylesPanel: React.FC = () => {
  const { activePreset, updateAtom } = useUserStyles();
  const preset = activePreset('home');

  return (
    <div>
      <StylesPresetBar scope="home" />
      {ROWS.map(row => (
        <StyleAtomEditor
          key={row.key}
          label={row.label}
          atom={preset.styles[row.key]}
          onChange={patch => updateAtom('home', row.key, patch)}
        />
      ))}
      <HomeStylePreview />
    </div>
  );
};
```

- [ ] **Step 2: Type-check + commit**

Run: `cd frontend && npx tsc --noEmit`
```bash
git add frontend/components/Settings/UserStyles/HomeStylesPanel.tsx
git commit -m "feat(user-styles): HomeStylesPanel sub-pestaña inici"
```

---

### Task 23: `StylesTab.tsx` (container con sub-pestañas)

**Files:**
- Create: `frontend/components/Settings/UserStyles/StylesTab.tsx`

- [ ] **Step 1: Crear el container con switching de sub-pestañas**

```tsx
// frontend/components/Settings/UserStyles/StylesTab.tsx
import React, { useState } from 'react';
import { ScriptStylesPanel } from './ScriptStylesPanel';
import { SubtitleStylesPanel } from './SubtitleStylesPanel';
import { HomeStylesPanel } from './HomeStylesPanel';

type SubTab = 'script' | 'subtitle' | 'home';

export const StylesTab: React.FC = () => {
  const [active, setActive] = useState<SubTab>('script');

  const TabButton: React.FC<{ id: SubTab; label: string }> = ({ id, label }) => {
    const isActive = active === id;
    return (
      <button
        onClick={() => setActive(id)}
        className="px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all rounded-md"
        style={isActive
          ? { backgroundColor: 'var(--th-accent)', color: 'var(--th-text-inverse)' }
          : { backgroundColor: 'var(--th-bg-tertiary)', color: 'var(--th-text-muted)' }
        }
      >
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <TabButton id="script"   label="Editor de guions" />
        <TabButton id="subtitle" label="Editor de subtítols" />
        <TabButton id="home"     label="Inici" />
      </div>
      {active === 'script'   && <ScriptStylesPanel />}
      {active === 'subtitle' && <SubtitleStylesPanel />}
      {active === 'home'     && <HomeStylesPanel />}
    </div>
  );
};
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/Settings/UserStyles/StylesTab.tsx
git commit -m "feat(user-styles): StylesTab container con switching script/subtitle/home"
```

---

### Task 24: Integrar `StylesTab` en `SettingsModal.tsx` y sustituir tab `editor` por `estils`

**Files:**
- Modify: `frontend/components/SettingsModal.tsx:16` (tipo ActiveTab)
- Modify: `frontend/components/SettingsModal.tsx:439` (botón de tab)
- Modify: `frontend/components/SettingsModal.tsx:643-651` (contenido)

- [ ] **Step 1: Importar `StylesTab`**

Añadir al bloque de imports de `SettingsModal.tsx`:
```ts
import { StylesTab } from './Settings/UserStyles/StylesTab';
```

- [ ] **Step 2: Cambiar el tipo `ActiveTab`**

Sustituir:
```ts
type ActiveTab = 'general' | 'editor' | 'shortcuts' | 'reader' | 'theme';
```
por:
```ts
type ActiveTab = 'general' | 'estils' | 'shortcuts' | 'reader' | 'theme';
```

- [ ] **Step 3: Cambiar el botón de tab**

Sustituir:
```tsx
<TabButton tabId="editor" label="Estils Editor" />
```
por:
```tsx
<TabButton tabId="estils" label="Estils" />
```

- [ ] **Step 4: Cambiar el contenido renderizado**

Buscar la rama `activeTab === 'editor'` (línea ~643) y todo su contenido (los 6 `<StyleControlGroup ...>`).

Sustituirla por:
```tsx
activeTab === 'estils' ? <StylesTab /> :
```

- [ ] **Step 5: Type-check + build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: PASS. **Si falla** porque alguna referencia a `'editor'` queda colgada (por ejemplo en otra rama del ternario), buscarla con Grep `'editor'` en el archivo y completar el reemplazo.

- [ ] **Step 6: Verificar en navegador**

Run: `cd frontend && npm run dev`
Open: configuración → tab "Estils".
Verify:
1. La pestaña "Estils" aparece donde antes estaba "Estils Editor".
2. Las 3 sub-pestañas (Editor de guions / Editor de subtítols / Inici) funcionan al hacer clic.
3. Cada sub-pestaña muestra los 6 controles editables + preset bar + preview.
4. Editar la fontSize del "Text" en la sub-pestaña Editor de guions se refleja **en vivo** en el editor real (abrir un .snlbpro en otra ventana del modal).
5. Cambiar entre presets cambia los valores de los controles.
6. Crear un preset nuevo, renombrarlo, duplicarlo y eliminarlo funcionan. El builtin no se puede eliminar ni renombrar.
7. Cambiar el tamaño del "Text del subtítol" en la sub-pestaña de subtítulos a 22px hace que las filas del editor real crezcan sin solapamientos.
8. Las pestañas General, Tema, Dreceres, Lector siguen funcionando igual.

- [ ] **Step 7: Commit**

```bash
git add frontend/components/SettingsModal.tsx
git commit -m "feat(user-styles): pestaña Estils con sub-pestañas en SettingsModal"
```

---

## Phase D — Cleanup

### Task 25: Retirar `editorStyles` de `App.tsx` y `SettingsModal.tsx`

**Files:**
- Modify: `frontend/App.tsx:264` (state)
- Modify: `frontend/App.tsx` (props pasadas a `<ColumnView>` y `<SettingsModal>`)
- Modify: `frontend/components/SettingsModal.tsx:10-14` (props interface)
- Modify: `frontend/components/SettingsModal.tsx:357` (destructuring)
- Modify: `frontend/components/SettingsModal.tsx:96-126` (eliminar `StyleControlGroup`)
- Modify: `frontend/components/EditorDeGuions/ColumnView.tsx:17-30` (props interface, quitar `editorStyles`)

- [ ] **Step 1: Quitar el state de App.tsx**

Borrar la línea (App.tsx ~264):
```ts
const [editorStyles, setEditorStyles] = useLocalStorage<EditorStyles>(LOCAL_STORAGE_KEYS.EDITOR_STYLES, DEFAULT_STYLES);
```

Y borrar también la const `DEFAULT_STYLES` de App.tsx:35-42 (ya solo se usa para esto).

Y borrar el import `EditorStyles` del primer import de App.tsx si ya no se usa en ningún sitio.

- [ ] **Step 2: Quitar las props pasadas a `<ColumnView>` y `<SettingsModal>`**

Buscar en App.tsx todos los `editorStyles={editorStyles}` (probablemente 2 ocurrencias en las llamadas a `<ColumnView>`, líneas ~548 y ~888) y `<SettingsModal>` (probablemente 1 ocurrencia, línea ~947).

Borrarlos. También borrar `onStylesChange={setEditorStyles}` del `<SettingsModal>`.

- [ ] **Step 3: Quitar las props del `SettingsModalProps` y del destructuring**

En `SettingsModal.tsx`:
```ts
interface SettingsModalProps {
  onClose: () => void;
  // editorStyles: EditorStyles;       ← BORRAR
  // onStylesChange: (styles: EditorStyles) => void;  ← BORRAR
}
```

```ts
const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => { ... }
//                                                   ↑ borrar editorStyles, onStylesChange
```

- [ ] **Step 4: Eliminar el componente legacy `StyleControlGroup`**

En `SettingsModal.tsx`, borrar el bloque `const StyleControlGroup: React.FC<...> = ...` (líneas ~96-126). Ya no se usa.

- [ ] **Step 5: Eliminar imports muertos en `SettingsModal.tsx`**

Si quedan imports de `EditorStyles`, `EditorStyle` que ya no se usan, borrarlos.

- [ ] **Step 6: Quitar la prop `editorStyles` del `ColumnViewProps`**

En `ColumnView.tsx`:
```ts
interface ColumnViewProps {
  content: string | undefined;
  setContent: (value: string) => void;
  isEditable: boolean;
  col1Width: number;
  // editorStyles: EditorStyles;      ← BORRAR
  matches?: Match[];
  // ... resto
}
```

Y todos los usos internos de `editorStyles` ya están migrados a CSS vars en Task 7. Cualquier referencia residual debe sustituirse o eliminarse. Buscar `editorStyles` con Grep dentro del archivo y limpiar.

Si la firma de `getInlineStyle` o `renderDialogueText` aún recibe `styles: EditorStyles`, simplificarla — ya no la necesita, todo viene de CSS vars. Por ejemplo `renderDialogueText(text, styles, highlightStyle)` pasa a `renderDialogueText(text, highlightStyle)` y los call sites se actualizan.

- [ ] **Step 7: Type-check + build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: PASS. **Si falla** por referencias colgantes, buscar `editorStyles` con Grep en `frontend/` y limpiar las que queden (excepto `ScriptExternalView.tsx` que se trata en Task 26).

- [ ] **Step 8: Verificar en navegador**

Run: `cd frontend && npm run dev`
Open: la app completa.
Verify:
1. El editor de guiones renderiza igual que antes.
2. La pestaña Estils del modal funciona y aplica cambios en vivo.
3. La librería se ve igual.
4. El editor de subtítulos se ve igual.
5. Sin errores de consola.

- [ ] **Step 9: Commit**

```bash
git add frontend/App.tsx frontend/components/SettingsModal.tsx frontend/components/EditorDeGuions/ColumnView.tsx
git commit -m "refactor(user-styles): retirar editorStyles state y props (sustituido por contexto)"
```

---

### Task 26: `ScriptExternalView.tsx` monta su propio `UserStylesProvider`

**Files:**
- Modify: `frontend/components/ScriptExternalView.tsx:18-26` (DEFAULT_STYLES, eliminar)
- Modify: `frontend/components/ScriptExternalView.tsx:59` (useLocalStorage, eliminar)
- Modify: `frontend/components/ScriptExternalView.tsx:404` (paso de prop a ColumnView)
- Modify: `frontend/components/ScriptExternalView.tsx` (envolver el render en `<UserStylesProvider>`)

- [ ] **Step 1: Eliminar la const `DEFAULT_STYLES` local**

Borrar las líneas 18-26 (`const DEFAULT_STYLES: EditorStyles = { ... };`).

- [ ] **Step 2: Eliminar la lectura de localStorage**

Borrar la línea 59:
```ts
const [editorStyles] = useLocalStorage<EditorStyles>(LOCAL_STORAGE_KEYS.EDITOR_STYLES, DEFAULT_STYLES);
```

- [ ] **Step 3: Eliminar el paso de prop a `<ColumnView>`**

Buscar `editorStyles={editorStyles}` (línea ~404) y borrarlo. `<ColumnView>` ya no acepta esa prop tras Task 25.

- [ ] **Step 4: Importar y montar `UserStylesProvider`**

Añadir al bloque de imports:
```ts
import { UserStylesProvider } from '../context/UserStyles/UserStylesContext';
```

Localizar el JSX root retornado por `ScriptExternalView` (probablemente algo como `return <div className="...">...</div>`). Envolverlo en `<UserStylesProvider>`:

```tsx
return (
  <UserStylesProvider>
    <div className="...">
      ...
    </div>
  </UserStylesProvider>
);
```

**Justificación:** la vista externa vive en otra ventana de navegador (abierta vía `window.open` o ruta hash). El `ThemeProvider` ya se monta en App.tsx y aplica al `<html>` raíz, así que `--th-*` están disponibles. `UserStylesProvider` necesita su propia instancia aquí porque la otra ventana no comparte React tree con la principal. La sincronización entre ventanas la consigue el `addEventListener('storage', ...)` que se añadió en Task 5: cuando la principal cambia el preset, escribe en `snlbpro_user_styles_<userId>`, y la externa lee ese cambio automáticamente vía evento `storage`.

- [ ] **Step 5: Limpiar imports muertos**

Si quedan imports de `EditorStyles`, `LOCAL_STORAGE_KEYS`, `useLocalStorage` que ya no se usan, borrarlos.

- [ ] **Step 6: Type-check + build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 7: Verificar en navegador**

Run: `cd frontend && npm run dev`
Open: abrir la vista externa de un guion (botón de ventana externa en el editor de guion).
Verify:
1. La vista externa se ve igual que antes.
2. Cambiar un estilo de guion en el modal de configuración de la ventana principal se refleja en la ventana externa **automáticamente** (vía evento storage). Puede haber un pequeño delay (depende del debounce de localStorage write).

- [ ] **Step 8: Commit**

```bash
git add frontend/components/ScriptExternalView.tsx
git commit -m "refactor(user-styles): ScriptExternalView monta UserStylesProvider y sincroniza via storage"
```

---

### Task 27: Marcar `EDITOR_STYLES` como deprecated en `constants.ts`

**Files:**
- Modify: `frontend/constants.ts:5`

- [ ] **Step 1: Añadir comentario deprecated**

Buscar:
```ts
EDITOR_STYLES: 'snlbpro_editor_styles',
```

Sustituir por:
```ts
/**
 * @deprecated Sustituido por `snlbpro_user_styles_<userId>` (UserStylesContext).
 * Se mantiene para que la migración legacy pueda leerlo en el primer arranque
 * con la versión nueva. No escribir nunca más en esta clave.
 */
EDITOR_STYLES: 'snlbpro_editor_styles',
```

- [ ] **Step 2: Type-check + commit**

Run: `cd frontend && npx tsc --noEmit`

```bash
git add frontend/constants.ts
git commit -m "chore(user-styles): marcar EDITOR_STYLES como deprecated"
```

---

### Task 28: Documentación de dominio + actualizar `domain-localstorage.md`

**Files:**
- Create: `Skills_Claude/domain-user-styles.md`
- Modify: `Skills_Claude/domain-localstorage.md`
- Modify: `CLAUDE.md` (tabla §10 — añadir entrada)

- [ ] **Step 1: Crear `Skills_Claude/domain-user-styles.md`**

```markdown
# Dominio: User Styles (estilos del usuario)

## Qué es

Capa de personalización tipográfica por usuario para tres zonas de la app:
- Editor de guiones (`ColumnView`)
- Editor de subtítulos (`SegmentItem`, `TimecodeInput`, `SubtitlesEditor`)
- Inici/llibreria (`SonilabLibraryView`, `LibraryFileItem`)

Es **independiente** del sistema de temas (admin). Los temas controlan colores globales, los user styles controlan tipografía/tamaño/color **del texto** de cada elemento concreto, y cada usuario tiene los suyos.

## Archivos clave

- `frontend/types/UserStyles/userStylesTypes.ts` — shape `UserStylesPayload`
- `frontend/context/UserStyles/UserStylesContext.tsx` — provider, presets, debounce backend
- `frontend/context/UserStyles/applyUserStylesToDOM.ts` — emisor de CSS vars `--us-*`
- `frontend/context/UserStyles/factoryStyles.ts` — valores de fábrica
- `frontend/context/UserStyles/userStylesMigration.ts` — `loadOrMigrate` desde legacy
- `frontend/components/Settings/UserStyles/` — UI del panel
- Backend: `user.preferences.userStyles` (PATCH /auth/me, sin endpoint nuevo)

## CSS variables emitidas

- `--us-script-{take,speaker,timecode,dialogue,dialogueparen,dialoguetcparen}-{family,size,color,weight,style}`
- `--us-sub-{content,timecode,idcps,takelabel,charcounter,actionbuttons}-{family,size,color,weight,style}`
- `--us-home-{filename,format,datetime,tableheader,navtabs,breadcrumb}-{family,size,color,weight,style}`
- Derivadas (no editables): `--us-sub-row-height`, `--us-sub-row-padding-y`, `--us-sub-grid-columns`

## Qué hacer cuando…

### …se añade un elemento nuevo a un editor que debe ser personalizable

1. Añadir el atom al `StyleSetMap` correspondiente en `userStylesTypes.ts`.
2. Añadir su valor de fábrica en `factoryStyles.ts` (debe reproducir el aspecto actual).
3. Añadir el `emitAtomVars` correspondiente en `applyUserStylesToDOM.ts`.
4. Sustituir los hardcodes en el componente que lo renderiza por `var(--us-...)`.
5. Añadir el `StyleAtomEditor` en el panel correspondiente (`ScriptStylesPanel.tsx`, `SubtitleStylesPanel.tsx`, `HomeStylesPanel.tsx`).
6. Actualizar el preview correspondiente (`*StylePreview.tsx`).
7. **Bumpear `version` del payload** y añadir migración si el cambio es incompatible con shape v1.

### …cambia el shape de un atom (ej. añadir `lineHeight`)

1. Bumpear `version: 1 → 2` en el payload.
2. En `userStylesMigration.ts`, añadir una rama que detecta `version: 1` y la transforma a `version: 2`.
3. Verificar que `loadOrMigrate` aplica la migración antes de devolver.

### …se añade un scope nuevo (ej. `videoEditor`)

1. Añadir el tipo `XxxStyleSet` en `userStylesTypes.ts`.
2. Añadirlo al `StyleSetMap` y al `UserStylesPayload`.
3. Añadir factory en `factoryStyles.ts`.
4. Añadir las variables en `applyUserStylesToDOM.ts`.
5. Crear `XxxStylesPanel.tsx` y `XxxStylePreview.tsx`.
6. Añadir sub-pestaña en `StylesTab.tsx`.
7. Bumpear `version`.

## Reglas no negociables

- **No leer estilos del usuario directamente desde localStorage** desde un componente — usar siempre el contexto vía `useUserStyles()` o las CSS vars `--us-*`.
- **No mezclar tema admin con user styles**: el tema controla `--th-*` (colores globales de UI), los user styles controlan `--us-*` (tipografía concreta del usuario).
- **El preset 'Per defecte' (`builtin: true`) no se borra ni se renombra**, solo se restablece a fábrica.
- **`snlbpro_editor_styles` no se borra del localStorage** — está marcada como deprecated y solo se lee como fuente para la migración inicial.
- **Cualquier cambio del shape requiere bumpear la `version`** del payload y añadir lógica de migración.

## Relación con otros dominios

- `domain-localstorage.md`: registra la clave `snlbpro_user_styles_<userId>`.
- `domain-subtitles.md`: el refactor de `SegmentItem` y `SubtitlesEditor` para usar `--us-sub-*` afecta el modelo del editor de subtítulos. Cualquier cambio de estructura del grid debe coordinarse con `applyUserStylesToDOM.ts:computeSubGridCols`.
- `domain-script-pdf-export.md`: el export de PDF clona el DOM con estilos inline aplicados, así que los cambios de estilos del editor de guiones se reflejan automáticamente en el PDF — no hay que hacer nada extra.
```

- [ ] **Step 2: Actualizar `Skills_Claude/domain-localstorage.md`**

Buscar la lista de claves en ese archivo y añadir (en el orden alfabético adecuado):

```
USER_STYLES_PREFIX: 'snlbpro_user_styles_<userId>' — JSON con presets de usuario, gestionado por UserStylesContext
EDITOR_STYLES:      'snlbpro_editor_styles'         — DEPRECATED, solo lectura para migración legacy
```

- [ ] **Step 3: Actualizar la tabla §10 de `CLAUDE.md` raíz**

Buscar la tabla de "Dominios registrados" en `CLAUDE.md` (sección 10). Añadir una fila nueva al final:

```
| Se modifica el sistema de presets de estilos del usuario, las CSS vars `--us-*` o cualquier componente de `frontend/components/Settings/UserStyles/` | User styles | `Skills_Claude/domain-user-styles.md` |
```

- [ ] **Step 4: Type-check (sanity)**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS (no debería cambiar nada porque solo son docs, pero confirmamos).

- [ ] **Step 5: Commit**

```bash
git add Skills_Claude/domain-user-styles.md Skills_Claude/domain-localstorage.md CLAUDE.md
git commit -m "docs(user-styles): dominio nuevo y actualizacion de localstorage + tabla CLAUDE.md"
```

---

## Verificación final integrada

### Task 29: Smoke test completo

- [ ] **Step 1: Build limpio**

Run: `cd frontend && npm run build`
Expected: PASS sin warnings nuevos.

- [ ] **Step 2: Verificar criterios de aceptación del spec uno por uno**

Run: `cd frontend && npm run dev`. Login con un usuario.

1. **Pestaña "Estils" sustituye a "Estils Editor"**: abrir configuración → la pestaña se llama "Estils".
2. **Tres sub-pestañas funcionales**: clic en "Editor de guions", "Editor de subtítols", "Inici" — cada una muestra 6 controles + preset bar + preview.
3. **Edición vivo**: con el modal de configuración abierto, mover el preset de subtítulos y el "Text del subtítol" subir a 22px. Cerrar modal y abrir editor de subtítulos. Las filas son más altas y el texto se ve más grande sin solapamientos.
4. **Persistencia backend**: en DevTools → Network → buscar el PATCH `/auth/me` que ocurre ~1.5s después de un cambio. Verificar que el body contiene `preferences.userStyles` con el shape esperado.
5. **Persistencia local**: en DevTools → Application → Local Storage → buscar `snlbpro_user_styles_<userId>` y confirmar que su contenido es el JSON actualizado.
6. **Migración**: en una sesión nueva con un usuario nuevo, abrir la app → en el localStorage debe aparecer `snlbpro_user_styles_<userId>` con un preset 'Per defecte' clonado de los valores de fábrica (o de `snlbpro_editor_styles` si existía).
7. **Tema admin intacto**: cambiar el tema admin (oscuro/claro) y verificar que sigue funcionando, sin interferir con los presets de estilos del usuario.
8. **Vista externa sincronizada**: abrir la vista externa de un guion. Cambiar el tamaño del "Text" en el preset de scriptEditor desde la ventana principal. La ventana externa actualiza automáticamente.

- [ ] **Step 3: Si todo pasa, commit final del checklist**

(No requiere cambio de archivos. Marca el final del plan.)

```bash
echo "✅ Plan complete"
```

---

## Resumen de archivos

**Nuevos:**
- `frontend/types/UserStyles/userStylesTypes.ts`
- `frontend/context/UserStyles/UserStylesContext.tsx`
- `frontend/context/UserStyles/applyUserStylesToDOM.ts`
- `frontend/context/UserStyles/factoryStyles.ts`
- `frontend/context/UserStyles/userStylesMigration.ts`
- `frontend/components/Settings/UserStyles/StylesTab.tsx`
- `frontend/components/Settings/UserStyles/StylesPresetBar.tsx`
- `frontend/components/Settings/UserStyles/StyleAtomEditor.tsx`
- `frontend/components/Settings/UserStyles/ScriptStylesPanel.tsx`
- `frontend/components/Settings/UserStyles/SubtitleStylesPanel.tsx`
- `frontend/components/Settings/UserStyles/HomeStylesPanel.tsx`
- `frontend/components/Settings/UserStyles/ScriptStylePreview.tsx`
- `frontend/components/Settings/UserStyles/SubtitleStylePreview.tsx`
- `frontend/components/Settings/UserStyles/HomeStylePreview.tsx`
- `Skills_Claude/domain-user-styles.md`

**Modificados:**
- `frontend/App.tsx`
- `frontend/components/SettingsModal.tsx`
- `frontend/components/EditorDeGuions/ColumnView.tsx`
- `frontend/components/VideoSubtitlesEditor/SegmentItem.tsx`
- `frontend/components/VideoSubtitlesEditor/SubtitlesEditor.tsx`
- `frontend/components/VideoSubtitlesEditor/TimecodeInput.tsx`
- `frontend/components/Library/LibraryFileItem.tsx`
- `frontend/components/Library/SonilabLibraryView.tsx`
- `frontend/components/ScriptExternalView.tsx`
- `frontend/constants.ts`
- `Skills_Claude/domain-localstorage.md`
- `CLAUDE.md`

**Sin cambios:** backend NestJS, ThemeContext, Editor.tsx (mono), SrtPreviewView.tsx.
