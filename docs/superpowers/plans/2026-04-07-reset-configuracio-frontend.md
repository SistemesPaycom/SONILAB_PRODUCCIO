# Factory Reset (Settings → General) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Restablir configuració de fàbrica" button to Settings → General that resets user settings (shortcuts, UI preferences, custom theme tokens) both client-side and server-side, while preserving creative work (style presets, document version histories, active session), protected by a checkbox-blocker modal with sub-confirmation for unsaved changes.

**Architecture:** Two-phase reset to eliminate a race condition between `localStorage.removeItem` and `window.location.reload()`: **Phase A** (pre-reload, in `factoryReset.ts` + `SettingsModal.tsx`) handles the backend call, notifies other tabs via `BroadcastChannel`, and sets a sessionStorage flag before reloading. **Phase B** (post-reload, in `index.tsx` before React mounts) reads the flag and synchronously cleans `localStorage` BEFORE any provider initializes — eliminating any possibility of `useEffect` persistence hooks rewriting keys during the reload window. A dedicated `BroadcastChannel('snlbpro-factory-reset')` listener in `App.tsx` forces sibling tabs to reload themselves, making the reset coherent across all open tabs.

**Tech Stack:** React 19 + TypeScript + Vite + `localStorage` + `sessionStorage` + native `BroadcastChannel` API. Uses existing `api.ts` helpers and `useLocalStorage` hook. No new dependencies.

**Source spec:** [docs/superpowers/specs/2026-04-07-reset-configuracio-frontend.md](../specs/2026-04-07-reset-configuracio-frontend.md) (654 lines, 13 issues resolved via ralph-loop review).

**Session log for context:** [Skills_Claude/Logs/CLAUDE_LOG_TCIN_TCOUT_PRECISION_SHORTCUTS_QW_Y_SPEC_FACTORY_RESET.txt](../../../Skills_Claude/Logs/CLAUDE_LOG_TCIN_TCOUT_PRECISION_SHORTCUTS_QW_Y_SPEC_FACTORY_RESET.txt)

---

## Testing approach

**No automated tests.** The spec (section 8) explicitly rules out test automation for this feature — the codebase has no React component integration test framework, and the feature is side-effect-heavy over `localStorage`, `sessionStorage`, `BroadcastChannel`, and `window.location.reload()` (all genuinely hard to stub correctly).

**Verification per task uses two methods**:

1. **Compile check**: `cd frontend && npx tsc --noEmit 2>&1 | grep -E "factoryReset|index\.tsx|App\.tsx|SettingsModal" || echo "OK"`. Filters pre-existing errors to surface only new ones in touched files.
2. **Runtime check**: `cd frontend && npm run dev` and follow the specific manual scenario listed at each task's verification step.

The full manual test plan runs at Task 13 against the 11 cases in spec section 9.2.

---

## File structure

| File | Role | Action |
|---|---|---|
| `frontend/utils/factoryReset.ts` | Logic module: `KEYS_TO_REMOVE`, `factoryReset()` (Phase A), `applyPendingFactoryReset()` (Phase B), exported constants | **CREATE** (~110 lines) |
| `frontend/index.tsx` | Entry point: wires Phase B invocation before `ReactDOM.render` | **MODIFY** (+~5 lines) |
| `frontend/App.tsx` | Adds: BroadcastChannel listener, factoryResetWarn state + effect + banner JSX, `window.__sonilabIsDirtyRef` exposure | **MODIFY** (+~55 lines in 3 distinct locations) |
| `frontend/components/SettingsModal.tsx` | Adds: Restablir configuració card in General tab, `FactoryResetConfirmModal` inline component, `UnsavedChangesWarningModal` inline sub-component, handler with isDirty check | **MODIFY** (+~170 lines) |
| `Skills_Claude/domain-localstorage.md` | Documentation: adds step 6 to "What to do if you add/rename a key" | **MODIFY** (+~5 lines) |

**Implementation order**: logic core first (T1-T3 → isolated, no UI), then Phase B integration (T4), then observability layer (T5-T7 — listener + banner + isDirty ref), then UI (T8-T11 — card + modals + handler), then docs (T12), then full manual verification (T13). Each task produces a coherent commit.

---

## Task 1: Create `factoryReset.ts` scaffolding with constants and types

**Files:**
- Create: `frontend/utils/factoryReset.ts`

- [ ] **Step 1.1: Create the new file with module-level constants and exports**

Create `frontend/utils/factoryReset.ts` with this exact content:

```ts
// frontend/utils/factoryReset.ts
//
// Factory Reset logic module — see docs/superpowers/specs/2026-04-07-reset-configuracio-frontend.md
//
// Two-phase architecture:
//   Phase A (factoryReset): pre-reload — backend reset + BroadcastChannel + flag on sessionStorage.
//   Phase B (applyPendingFactoryReset): post-reload, pre-React — reads flag and cleans localStorage
//     BEFORE any provider mounts, to eliminate the race condition with useEffect persistence hooks.
//
// See spec section 5 for full flow justification.

import { api } from '../services/api';
import { LOCAL_STORAGE_KEYS } from '../constants';

// ─── Exported constants (single source of truth, consumed by App.tsx too) ────

/**
 * Authoritative list of localStorage keys that the factory reset erases.
 * When a new key is added to LOCAL_STORAGE_KEYS, decide if it belongs here
 * (see domain-localstorage.md step 6).
 *
 * Explicitly NOT using a prefix scan (Object.keys(localStorage).filter(...))
 * because the codebase has two parallel prefixes (snlbpro_ and sonilab_)
 * and some keys within each prefix must be preserved (versions, user_styles,
 * token, etc.). A blocklist is safer by default.
 */
export const KEYS_TO_REMOVE: readonly string[] = [
  // All LOCAL_STORAGE_KEYS except THEME (preserved: user keeps their theme choice):
  LOCAL_STORAGE_KEYS.SHORTCUTS,
  LOCAL_STORAGE_KEYS.EDITOR_STYLES,
  LOCAL_STORAGE_KEYS.LIBRARY_WIDTH,
  LOCAL_STORAGE_KEYS.LIBRARY_NAME_COL_WIDTH,
  LOCAL_STORAGE_KEYS.LIBRARY_FORMAT_COL_WIDTH,
  LOCAL_STORAGE_KEYS.LIBRARY_DATE_COL_WIDTH,
  LOCAL_STORAGE_KEYS.TAKE_MARGIN,
  LOCAL_STORAGE_KEYS.TAKE_START_MARGIN,
  LOCAL_STORAGE_KEYS.MAX_LINES_SUBS,
  LOCAL_STORAGE_KEYS.SUB_GRID_OPACITY,
  LOCAL_STORAGE_KEYS.WAVEFORM_HOLD_MS,
  LOCAL_STORAGE_KEYS.AUTOSAVE_SRT,
  LOCAL_STORAGE_KEYS.TASKS_TRANSLATION,
  LOCAL_STORAGE_KEYS.TASKS_TRANSCRIPTION,
  LOCAL_STORAGE_KEYS.SRT_EDITOR_MODE,
  LOCAL_STORAGE_KEYS.EDITOR_MIN_GAP_MS,
  LOCAL_STORAGE_KEYS.CUSTOM_THEME_TOKENS,
  // Hardcoded key outside LOCAL_STORAGE_KEYS:
  'snlbpro_library_v3', // LibraryDataContext cache
];

export const PENDING_FLAG = 'snlbpro_factory_reset_pending';
export const WARN_FLAG = 'snlbpro_factory_reset_warn';
export const BC_CHANNEL = 'snlbpro-factory-reset';

// ─── Phase A / Phase B function signatures (stubbed for next tasks) ──────────

/** Phase A — implemented in Task 2. */
export async function factoryReset(userId: string | null): Promise<{
  ok: boolean;
  backendOk: boolean;
}> {
  // TEMPORARY STUB — replaced in Task 2
  void userId;
  return { ok: true, backendOk: true };
}

/** Phase B — implemented in Task 3. */
export function applyPendingFactoryReset(): void {
  // TEMPORARY STUB — replaced in Task 3
}
```

Note: the stubs exist so `tsc` passes between incremental commits. They are replaced in Tasks 2 and 3.

- [ ] **Step 1.2: Run TypeScript compile check**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend" && npx tsc --noEmit 2>&1 | grep "factoryReset" || echo "OK: no errors in factoryReset.ts"
```

Expected: `OK: no errors in factoryReset.ts`

- [ ] **Step 1.3: Commit**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && git add frontend/utils/factoryReset.ts && git commit -m "feat(factory-reset): scaffolding of factoryReset.ts with constants and types

Create the new module with KEYS_TO_REMOVE (authoritative blocklist),
PENDING_FLAG, WARN_FLAG, BC_CHANNEL exports, and stub signatures for
factoryReset() (Phase A) and applyPendingFactoryReset() (Phase B)
to be implemented in next tasks. Stubs keep tsc passing."
```

---

## Task 2: Implement `factoryReset()` (Phase A)

**Files:**
- Modify: `frontend/utils/factoryReset.ts`

- [ ] **Step 2.1: Replace the `factoryReset` stub with the real implementation**

Find the `factoryReset` stub at the bottom of `frontend/utils/factoryReset.ts` and replace it with:

```ts
/**
 * Phase A — Initiates the factory reset for the current user.
 *
 * Steps:
 *   1. Clears backend preferences (shortcuts, customThemeTokens) via api.updateMe.
 *   2. Notifies sibling tabs via BroadcastChannel.
 *   3. Marks PENDING_FLAG on sessionStorage with userId (or '' if null).
 *   4. If backend call failed, also marks WARN_FLAG.
 *
 * Does NOT:
 *   - Touch localStorage directly (that's Phase B's job, to eliminate the race).
 *   - Call window.location.reload() (the caller — SettingsModal handler — does it).
 */
export async function factoryReset(userId: string | null): Promise<{
  ok: boolean;
  backendOk: boolean;
}> {
  // Step 1: backend
  let backendOk = true;
  try {
    await api.updateMe({
      preferences: {
        shortcuts: null,
        customThemeTokens: null,
      },
    });
  } catch {
    backendOk = false;
  }

  // Step 2: notify sibling tabs
  try {
    const bc = new BroadcastChannel(BC_CHANNEL);
    bc.postMessage({ type: 'reset' });
    bc.close();
  } catch {
    // BroadcastChannel not available on very old browsers; ignore.
  }

  // Step 3 + 4: mark flags on sessionStorage
  try {
    sessionStorage.setItem(PENDING_FLAG, userId ?? '');
    if (!backendOk) {
      sessionStorage.setItem(WARN_FLAG, '1');
    }
  } catch {
    // sessionStorage disabled (some private-mode browsers); reset will degrade to no-op at Phase B.
  }

  return { ok: true, backendOk };
}
```

- [ ] **Step 2.2: Run TypeScript compile check**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend" && npx tsc --noEmit 2>&1 | grep "factoryReset" || echo "OK"
```

Expected: `OK`

- [ ] **Step 2.3: Commit**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && git add frontend/utils/factoryReset.ts && git commit -m "feat(factory-reset): implement factoryReset() Phase A (pre-reload)

Backend call (updateMe with null shortcuts + null customThemeTokens),
BroadcastChannel notification to sibling tabs, and sessionStorage flags
(PENDING for the cleanup at Phase B, WARN for the post-reload banner
if backend failed). All wrapped in defensive try/catch — no operation
blocks the overall flow. Caller (SettingsModal) is responsible for
window.location.reload() after this function returns."
```

---

## Task 3: Implement `applyPendingFactoryReset()` (Phase B)

**Files:**
- Modify: `frontend/utils/factoryReset.ts`

- [ ] **Step 3.1: Replace the `applyPendingFactoryReset` stub**

Find the `applyPendingFactoryReset` stub and replace it with:

```ts
/**
 * Phase B — Applies pending localStorage cleanup. MUST be invoked at
 * frontend/index.tsx BEFORE ReactDOM.createRoot(...).render(<App />).
 *
 * Synchronous and safe to call before React mounts. Does not touch React or api.
 *
 * If no PENDING_FLAG on sessionStorage, does nothing (common case: normal load).
 *
 * If flag present:
 *   1. Reads userId from the flag payload (empty string if user wasn't logged in).
 *   2. Removes PENDING_FLAG (but NOT WARN_FLAG — banner post-reload reads it).
 *   3. Iterates KEYS_TO_REMOVE and removes each from localStorage.
 *   4. If userId present, also removes the scoped variant of CUSTOM_THEME_TOKENS.
 */
export function applyPendingFactoryReset(): void {
  let userId: string | null = null;
  try {
    const pending = sessionStorage.getItem(PENDING_FLAG);
    if (pending === null) return; // common path: no pending reset
    userId = pending || null;     // '' → null; 'abc123' → 'abc123'
    sessionStorage.removeItem(PENDING_FLAG);
  } catch {
    return; // sessionStorage disabled → can't tell if pending, bail out
  }

  // Clean all keys from the authoritative blocklist
  for (const key of KEYS_TO_REMOVE) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Unlikely but defensive — continue with remaining keys
    }
  }

  // Scoped variant of CUSTOM_THEME_TOKENS (only if we have a userId)
  if (userId) {
    try {
      localStorage.removeItem(`${LOCAL_STORAGE_KEYS.CUSTOM_THEME_TOKENS}_${userId}`);
    } catch {
      // Ignore
    }
  }

  // NOTE: do NOT remove LOCAL_STORAGE_KEYS.THEME (user keeps their theme choice).
  // NOTE: do NOT remove WARN_FLAG from sessionStorage — App.tsx banner effect reads it.
}
```

- [ ] **Step 3.2: Run TypeScript compile check**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend" && npx tsc --noEmit 2>&1 | grep "factoryReset" || echo "OK"
```

Expected: `OK`

- [ ] **Step 3.3: Commit**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && git add frontend/utils/factoryReset.ts && git commit -m "feat(factory-reset): implement applyPendingFactoryReset() Phase B

Reads PENDING_FLAG from sessionStorage and, if present, synchronously
cleans localStorage using KEYS_TO_REMOVE + the scoped CUSTOM_THEME_TOKENS
variant. Designed to run at frontend/index.tsx BEFORE React mounts, so
no provider useEffect is active and no polling loop can re-write keys
— eliminates the race condition that would exist if cleanup ran
pre-reload. WARN_FLAG is preserved for the banner post-reload."
```

---

## Task 4: Wire `applyPendingFactoryReset()` into `index.tsx`

**Files:**
- Modify: `frontend/index.tsx`

- [ ] **Step 4.1: Add the import and the call before `ReactDOM.createRoot`**

Current `frontend/index.tsx` is 16 lines. Replace its entire content with:

```tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { applyPendingFactoryReset } from './utils/factoryReset';

// BEFORE mounting the React tree: if a factory reset is pending from a previous
// reload, apply the localStorage cleanup synchronously now — BEFORE any provider
// (Theme, Auth, Transcription, Translation, UserStyles, LibraryData) mounts.
// This eliminates the race condition where useEffect persistence hooks could
// re-write keys during the reload window. See spec section 5 "Fase B".
applyPendingFactoryReset();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 4.2: Run TypeScript compile check**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend" && npx tsc --noEmit 2>&1 | grep -E "index\.tsx|factoryReset" || echo "OK"
```

Expected: `OK`

- [ ] **Step 4.3: Manual runtime check — normal load (no pending flag)**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend" && npm run dev
```

1. Open the app URL (usually `http://localhost:5173` or similar).
2. Open DevTools → Console.
3. Confirm there are NO errors related to factoryReset or applyPendingFactoryReset.
4. Open DevTools → Application → Storage → Session Storage. Confirm no unexpected keys.
5. Open DevTools → Application → Storage → Local Storage. Confirm localStorage keys are intact (the user's shortcuts, etc. should still be there).
6. Interact with the app normally (navigate Library, open a document, etc.) to verify nothing is broken.

Expected: app loads normally, behaves identically to before the change. `applyPendingFactoryReset` silently returns when no flag is present.

Stop the dev server when done (`Ctrl+C`).

- [ ] **Step 4.4: Commit**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && git add frontend/index.tsx && git commit -m "feat(factory-reset): wire applyPendingFactoryReset at index.tsx pre-render

Invoke Phase B of the factory reset at the entrypoint, BEFORE
ReactDOM.createRoot().render(). When no reset is pending (the normal
case), it silently returns. When a reset was initiated in the previous
page lifetime, it cleans localStorage synchronously here, so all React
providers mount with a clean slate."
```

---

## Task 5: Add BroadcastChannel listener to `App.tsx` (multi-tab support)

**Files:**
- Modify: `frontend/App.tsx`

- [ ] **Step 5.1: Locate where to add the useEffect**

Open `frontend/App.tsx`. Find the main `App` component function (should be near the top of the file, just before the `return (` statement of that main App). The existing `beforeunload` useEffect at line 239-247 is a good anchor point — the new one goes right after it.

- [ ] **Step 5.2: Add import for BroadcastChannel constants from factoryReset.ts**

At the top of `frontend/App.tsx`, after existing imports, add (if not already present):

```tsx
import { BC_CHANNEL, PENDING_FLAG } from './utils/factoryReset';
```

- [ ] **Step 5.3: Add the BroadcastChannel listener useEffect**

Just after the existing `beforeunload` useEffect (around line 247 in the current file), insert:

```tsx
  // Factory Reset — sibling tab listener. If another tab triggers a factory
  // reset, it broadcasts on BC_CHANNEL; we mark our own PENDING_FLAG and
  // reload to pick up the clean state via applyPendingFactoryReset (Phase B).
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(BC_CHANNEL);
      bc.onmessage = (ev) => {
        if (ev.data?.type === 'reset') {
          try {
            sessionStorage.setItem(PENDING_FLAG, '');
          } catch { /* sessionStorage disabled — we'll reload anyway */ }
          window.location.reload();
        }
      };
    } catch {
      // BroadcastChannel not available on very old browsers — ignore.
    }
    return () => { if (bc) bc.close(); };
  }, []);
```

- [ ] **Step 5.4: Run TypeScript compile check**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend" && npx tsc --noEmit 2>&1 | grep -E "App\.tsx|factoryReset" || echo "OK"
```

Expected: `OK`

- [ ] **Step 5.5: Manual runtime check — listener doesn't fire spuriously**

Run `npm run dev`, open the app in one tab, open DevTools → Console.

1. Confirm no errors on load.
2. In the console, manually trigger a fake message:
   ```js
   const bc = new BroadcastChannel('snlbpro-factory-reset');
   bc.postMessage({ type: 'reset' });
   bc.close();
   ```
3. The tab should immediately reload. This confirms the listener is wired correctly.
4. After reload, confirm the app still works (normal state, nothing broken).

Note: `applyPendingFactoryReset` will now see the `PENDING_FLAG = ''` set by the listener and will actually run its cleanup on the post-reload. Check Application → Local Storage: keys from `KEYS_TO_REMOVE` should have been cleaned. This is expected behavior.

Stop the dev server.

- [ ] **Step 5.6: Commit**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && git add frontend/App.tsx && git commit -m "feat(factory-reset): add BroadcastChannel listener in App.tsx for multi-tab

Adds a listener on BC_CHANNEL ('snlbpro-factory-reset') so that when
any tab initiates a factory reset, all other open tabs of the same
origin receive the message and reload themselves. They set PENDING_FLAG
first, so applyPendingFactoryReset can run its cleanup on their own
reload too — ensuring coherent state across all tabs.

Reuses the BroadcastChannel pattern already present in
VideoSubtitlesEditorView.tsx and ScriptExternalView.tsx."
```

---

## Task 6: Add factoryResetWarn state, post-reload effect, and banner JSX to `App.tsx`

**Files:**
- Modify: `frontend/App.tsx`

- [ ] **Step 6.1: Extend the factoryReset import and ensure api is imported**

In `frontend/App.tsx`, find the existing import line from Task 5:

```tsx
import { BC_CHANNEL, PENDING_FLAG } from './utils/factoryReset';
```

Replace it with:

```tsx
import { BC_CHANNEL, PENDING_FLAG, WARN_FLAG } from './utils/factoryReset';
```

(Just adds `WARN_FLAG` to the existing import.)

Also ensure `api` is imported. Check if there's already a line like `import { api } from './services/api';`. If yes, skip. If no, add it:

```tsx
import { api } from './services/api';
```

- [ ] **Step 6.2: Add the `factoryResetWarn` state in the main App component**

Find the section in the main App component where other `useState` hooks are declared (near the top of the component, look for `setIsSettingsOpen` as an anchor around line 257). Just after the existing state declarations, add:

```tsx
  // Factory Reset — post-reload warning banner state
  const [factoryResetWarn, setFactoryResetWarn] = useState(false);
```

- [ ] **Step 6.3: Add the post-reload useEffect with `api.me()` verification**

After the `useState` for `factoryResetWarn`, add:

```tsx
  // Factory Reset — on mount, check if the last reset had a WARN_FLAG.
  // If so, verify via api.me() whether the backend actually has shortcuts
  // nullified — if it does, the flag was a false negative (response lost
  // after backend already processed the request) and we suppress the banner.
  useEffect(() => {
    let cancelled = false;
    let flag: string | null = null;
    try {
      flag = sessionStorage.getItem(WARN_FLAG);
      if (!flag) return;
      sessionStorage.removeItem(WARN_FLAG);
    } catch {
      return; // sessionStorage disabled
    }

    api.me()
      .then((profile: any) => {
        if (cancelled) return;
        const backendActuallyReset = !profile?.preferences?.shortcuts;
        if (!backendActuallyReset) {
          setFactoryResetWarn(true);
        }
      })
      .catch(() => {
        // /me failed → assume partial reset and warn the user
        if (!cancelled) setFactoryResetWarn(true);
      });

    return () => { cancelled = true; };
  }, []);
```

- [ ] **Step 6.4: Add the banner JSX**

Find the existing `history.isDirty` banner at approximately line 621-625 of `App.tsx`:

```tsx
      {history.isDirty && (
        <div className="fixed bottom-4 right-4 px-3 py-1 bg-amber-500 text-black text-[10px] font-black uppercase rounded-full shadow-lg animate-pulse z-[100]">
          Canvis sense desar
        </div>
      )}
```

**Immediately after** this block (before the `completedToasts` block around line 627), add:

```tsx
      {/* Factory Reset — partial reset warning banner (post-reload) */}
      {factoryResetWarn && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[700] max-w-xl px-4 py-3 bg-amber-900/95 border border-amber-500/50 rounded-xl shadow-2xl backdrop-blur-md flex items-start gap-3">
          <span className="text-amber-400 text-lg">⚠</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-100">Reset parcial</p>
            <p className="text-xs text-amber-200/80 mt-1">
              S'han restablert els ajustos locals però no s'ha pogut sincronitzar amb el servidor. Algunes preferències poden tornar a aparèixer fins que tornis a provar el reset més tard.
            </p>
          </div>
          <button
            onClick={() => setFactoryResetWarn(false)}
            className="text-amber-400 hover:text-white text-lg transition-colors"
            aria-label="Tancar avís"
          >
            &times;
          </button>
        </div>
      )}
```

- [ ] **Step 6.5: Run TypeScript compile check**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend" && npx tsc --noEmit 2>&1 | grep -E "App\.tsx|factoryReset" || echo "OK"
```

Expected: `OK`

- [ ] **Step 6.6: Manual runtime check — banner doesn't appear on normal load**

Run `npm run dev`. Open the app. Confirm no banner appears on a normal load (no pending reset, no warn flag). Then test manually:

1. In DevTools console, run:
   ```js
   sessionStorage.setItem('snlbpro_factory_reset_warn', '1');
   location.reload();
   ```
2. After reload, the banner should appear at the top center (amber-colored, with ⚠ icon, "Reset parcial" title).
3. Click the × close button. Banner disappears.
4. Reload the page manually. Banner should NOT reappear (sessionStorage flag was cleared).

Stop the dev server.

- [ ] **Step 6.7: Commit**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && git add frontend/App.tsx && git commit -m "feat(factory-reset): post-reload banner state + effect + JSX in App.tsx

Adds factoryResetWarn state, a mount-time useEffect that reads
WARN_FLAG from sessionStorage and verifies via api.me() whether
the backend actually has shortcuts nullified (suppresses the banner
if it does — false negative case), and the inline banner JSX matching
the ad-hoc banner patterns already in App.tsx (Canvis sense desar,
completedToasts)."
```

---

## Task 7: Expose `history.isDirty` as `window.__sonilabIsDirtyRef` from `App.tsx`

**Files:**
- Modify: `frontend/App.tsx`

- [ ] **Step 7.1: Add the window type augmentation near the top of App.tsx**

Near the top of `frontend/App.tsx` (after existing imports, before the first component declaration), add:

```tsx
// Global ref for SettingsModal to check isDirty before the factory reset.
// See spec section 6.2 "Cas especial: canvis sense desar". Using a global
// ref avoids the need for a shared context or prop-drilling from the deeply
// nested editor components.
declare global {
  interface Window {
    __sonilabIsDirtyRef?: { current: boolean };
  }
}
```

- [ ] **Step 7.2: Initialize the ref and sync it with `history.isDirty`**

In the main `App` component, locate the line `const history = useDocumentHistory(openDocId || 'temp', docContent);` (around line 391 in the current file). Immediately after it, add:

```tsx
  // Expose history.isDirty globally so SettingsModal's factory reset handler
  // can check it before wiping state. Initialized once, updated via effect.
  if (typeof window !== 'undefined' && !window.__sonilabIsDirtyRef) {
    window.__sonilabIsDirtyRef = { current: false };
  }
  useEffect(() => {
    if (typeof window !== 'undefined' && window.__sonilabIsDirtyRef) {
      window.__sonilabIsDirtyRef.current = history.isDirty;
    }
  }, [history.isDirty]);
```

- [ ] **Step 7.3: Run TypeScript compile check**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend" && npx tsc --noEmit 2>&1 | grep -E "App\.tsx" || echo "OK"
```

Expected: `OK`

- [ ] **Step 7.4: Manual runtime check — ref reflects isDirty state**

Run `npm run dev`. Open the app. Open a document and make an edit to trigger `isDirty`.

In DevTools console:
```js
window.__sonilabIsDirtyRef.current
```

Expected: `true` (while the edit is unsaved). After saving (`Ctrl+S`), it should be `false`.

Stop the dev server.

- [ ] **Step 7.5: Commit**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && git add frontend/App.tsx && git commit -m "feat(factory-reset): expose history.isDirty via window.__sonilabIsDirtyRef

Adds a global ref on window (declared with TypeScript interface augmentation)
that mirrors the main App component's history.isDirty state. The factory
reset handler in SettingsModal uses this to check for unsaved changes
before executing the reset, and if found, shows an additional confirmation
modal (see Task 10).

Global ref chosen over React Context/prop-drilling because history.isDirty
lives deep in editor components not easily accessible from the settings
modal layer. See spec section 6.2."
```

---

## Task 8: Add "Restablir configuració" card to General tab in `SettingsModal.tsx`

**Files:**
- Modify: `frontend/components/SettingsModal.tsx`

- [ ] **Step 8.1: Add state for the confirmation modal at the top of `SettingsModal` component**

Open `frontend/components/SettingsModal.tsx`. Find the main `SettingsModal: React.FC` component declaration (around line 322). Inside its body, near the other `useState` calls (around line 339-346), add:

```tsx
  // Factory Reset modal state
  const [isFactoryResetModalOpen, setIsFactoryResetModalOpen] = useState(false);
```

- [ ] **Step 8.2: Add the new card at the end of the General tab block**

In the General tab block (between lines 735 and 736 — right before the closing `</div>` of the `<div className="space-y-6">` wrapper of the General tab), insert the new card:

```tsx
                <div className="p-6 rounded-2xl" style={{ backgroundColor: 'var(--th-bg-secondary)', border: '1px solid var(--th-border)' }}>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 accent-icon-color" style={{ color: 'var(--th-accent-text)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Restablir configuració
                    </h3>
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                            <p className="font-bold text-gray-200">Restablir configuració de fàbrica</p>
                            <p className="text-xs text-gray-500 italic mt-1">
                                Tornar la configuració d'aquesta aplicació al seu estat per defecte. No afecta els teus presets d'estils ni els historials dels teus documents.
                            </p>
                        </div>
                        <button
                            onClick={() => setIsFactoryResetModalOpen(true)}
                            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all active:scale-95 hover:brightness-125 whitespace-nowrap"
                            style={{ backgroundColor: 'transparent', color: 'rgb(248 113 113)', border: '1px solid rgba(239, 68, 68, 0.4)' }}
                        >
                            Restablir configuració de fàbrica…
                        </button>
                    </div>
                </div>
```

- [ ] **Step 8.3: Run TypeScript compile check**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend" && npx tsc --noEmit 2>&1 | grep -E "SettingsModal" || echo "OK"
```

Expected: `OK`

- [ ] **Step 8.4: Manual runtime check — card renders correctly**

Run `npm run dev`. Open the app, open Settings (gear icon) → General tab. Scroll to the bottom. Confirm:
1. A new card titled "RESTABLIR CONFIGURACIÓ" is present, after the "Sincronització de Vídeo" card.
2. Visual style matches the other cards (same background, border, padding).
3. There's a warning triangle icon before the title.
4. The subtext is italic gray and reads the expected text.
5. There's a red-bordered button "Restablir configuració de fàbrica…" (with ellipsis) aligned to the right.
6. Clicking the button does nothing yet (we haven't wired the modal — expected for now, since `isFactoryResetModalOpen` state has no renderer yet).

Stop the dev server.

- [ ] **Step 8.5: Commit**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && git add frontend/components/SettingsModal.tsx && git commit -m "feat(factory-reset): add Restablir configuració card to General tab

New card inserted at the end of the General tab (after Sincronització de
Vídeo), with destructive-styled button that will open the confirmation
modal in Task 9. State hook added but modal component is a stub for now."
```

---

## Task 9: Add `FactoryResetConfirmModal` inline component to `SettingsModal.tsx`

**Files:**
- Modify: `frontend/components/SettingsModal.tsx`

- [ ] **Step 9.1: Add imports at the top of SettingsModal.tsx**

At the top of `frontend/components/SettingsModal.tsx`, add:

```tsx
import { factoryReset } from '../utils/factoryReset';
```

Note: `useAuth` is already imported in SettingsModal.tsx at line 138 (used by `ShortcutsTab`). The factory reset handler in Task 11 will use the same hook from the main `SettingsModal` component scope.

- [ ] **Step 9.2: Define the `FactoryResetConfirmModal` component inline**

In `frontend/components/SettingsModal.tsx`, locate the `ShortcutsTab` component definition (around lines 133-320). After `ShortcutsTab` closes (line 320) and before the `const USE_BACKEND = ...` line (321), add a new inline component:

```tsx
// ─── Factory Reset Confirmation Modal ────────────────────────────────────────

interface FactoryResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const FactoryResetConfirmModal: React.FC<FactoryResetConfirmModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [confirmed, setConfirmed] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setConfirmed(false);
      setIsResetting(false);
    }
  }, [isOpen]);

  // Block Escape during in-flight; allow normal close otherwise.
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isResetting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, isResetting, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    if (!isResetting) onClose();
  };

  const handleConfirmClick = async () => {
    setIsResetting(true);
    try {
      await onConfirm();
    } finally {
      // onConfirm is responsible for calling window.location.reload();
      // if it returns without reloading (shouldn't happen normally),
      // reset the in-flight state so the user isn't stuck.
      setIsResetting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[800] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="max-w-2xl w-full rounded-2xl shadow-2xl flex flex-col"
        style={{ backgroundColor: 'var(--th-bg-primary)', border: '1px solid var(--th-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-[var(--th-border)] flex items-center gap-3">
          <span className="text-amber-400 text-2xl">⚠</span>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">
            Restablir configuració de fàbrica
          </h2>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-300">
            Aquesta acció restablirà la configuració d'aquesta aplicació al seu estat per defecte. Algunes coses es mantindran intactes.
          </p>

          {/* Two-column list: restablirà vs preservarà */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <p className="text-xs font-black uppercase tracking-widest text-red-400 mb-3">❌ Es restablirà</p>
              <ul className="text-xs text-gray-300 space-y-1.5">
                <li>• Dreceres de teclat</li>
                <li>• Ajustos de la interfície</li>
                <li>• Personalització del tema</li>
                <li>• Mides i columnes de la Llibreria</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
              <p className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-3">✓ Es preservarà</p>
              <ul className="text-xs text-gray-300 space-y-1.5">
                <li>• Presets d'estils tipogràfics</li>
                <li>• Tema seleccionat</li>
                <li>• Historials de versions dels documents</li>
                <li>• Sessió oberta (no es tanca sessió)</li>
              </ul>
            </div>
          </div>

          {/* Multi-tab info box */}
          <div className="p-3 rounded-lg flex items-start gap-2 text-xs" style={{ backgroundColor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)' }}>
            <span className="text-blue-400">ℹ</span>
            <p className="text-gray-300 flex-1">
              <span className="font-bold text-blue-300">Consell: </span>
              es recomana tenir només aquesta pestanya de Sonilab oberta durant el procés. Les altres pestanyes es recarregaran automàticament, però per seguretat és millor tancar-les abans.
            </p>
          </div>

          {/* Checkbox blocker */}
          <label className="flex items-start gap-3 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={isResetting}
              className="mt-0.5 w-4 h-4 accent-red-500 cursor-pointer disabled:cursor-not-allowed"
            />
            <span className="text-sm text-gray-200">
              Entenc que es perdran aquests ajustos i que aquesta acció no es pot desfer.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[var(--th-border)] flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isResetting}
            className="px-6 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--th-bg-tertiary)', color: 'var(--th-text-secondary)', border: '1px solid var(--th-border)' }}
          >
            Cancel·lar
          </button>
          <button
            onClick={handleConfirmClick}
            disabled={!confirmed || isResetting}
            className="px-6 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            style={{ backgroundColor: 'rgb(220, 38, 38)', color: 'white' }}
          >
            {isResetting && (
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
            )}
            {isResetting ? 'Restablint…' : 'Restablir configuració'}
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 9.3: Render the modal in the main `SettingsModal` component**

Locate the `SettingsModal` main component's return statement (around line 401). Find the closing `</div>` of the outermost wrapper of the modal (the one right before the component closes). Just before that closing `</div>` of the root, add:

```tsx
      {/* Factory Reset Confirmation Modal */}
      <FactoryResetConfirmModal
        isOpen={isFactoryResetModalOpen}
        onClose={() => setIsFactoryResetModalOpen(false)}
        onConfirm={async () => {
          // Stub for now — real handler wired in Task 11
          console.log('Factory reset confirmed (stub)');
        }}
      />
```

- [ ] **Step 9.4: Run TypeScript compile check**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend" && npx tsc --noEmit 2>&1 | grep -E "SettingsModal" || echo "OK"
```

Expected: `OK`

- [ ] **Step 9.5: Manual runtime check — modal opens and closes correctly**

Run `npm run dev`. Open the app → Settings → General → click "Restablir configuració de fàbrica…" button.

Verify:
1. Modal appears with backdrop blur.
2. Title "Restablir configuració de fàbrica" with warning icon.
3. Two-column list ("Es restablirà" / "Es preservarà") shows correct bullets.
4. Blue info box about multi-tab is visible.
5. Checkbox "Entenc que es perdran…" is unchecked.
6. "Restablir configuració" button is **disabled** (grayed out).
7. "Cancel·lar" button is enabled.

Test interactions:
- Click "Cancel·lar" → modal closes.
- Reopen modal → check the checkbox → the "Restablir" button becomes enabled.
- Click the backdrop → modal closes.
- Reopen → press Escape → modal closes.
- Reopen → check the checkbox → click "Restablir configuració" → console logs "Factory reset confirmed (stub)" → button shows spinner briefly → modal stays open (no reload, since it's a stub).

Stop the dev server.

- [ ] **Step 9.6: Commit**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && git add frontend/components/SettingsModal.tsx && git commit -m "feat(factory-reset): add FactoryResetConfirmModal inline component

New inline component in SettingsModal.tsx with the β confirmation pattern
(checkbox blocker), destructive styling (red Restablir button), and the
multi-tab informational notice. In-flight state blocks Cancel, Escape,
and backdrop click (Issue 8 of the ralph review: no partial cancellation
allowed). onConfirm handler is a stub for now — wired in Task 11."
```

---

## Task 10: Add `UnsavedChangesWarningModal` inline sub-component to `SettingsModal.tsx`

**Files:**
- Modify: `frontend/components/SettingsModal.tsx`

- [ ] **Step 10.1: Define the sub-modal component inline**

In `frontend/components/SettingsModal.tsx`, right after the `FactoryResetConfirmModal` component closes (from Task 9), add:

```tsx
// ─── Unsaved Changes Warning Modal (sub-modal of Factory Reset) ──────────────

interface UnsavedChangesWarningModalProps {
  isOpen: boolean;
  onSaveAndContinue: () => void;
  onDiscardAndContinue: () => void;
  onCancel: () => void;
}

const UnsavedChangesWarningModal: React.FC<UnsavedChangesWarningModalProps> = ({
  isOpen,
  onSaveAndContinue,
  onDiscardAndContinue,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="max-w-md w-full rounded-2xl shadow-2xl flex flex-col"
        style={{ backgroundColor: 'var(--th-bg-primary)', border: '1px solid var(--th-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-[var(--th-border)] flex items-center gap-3">
          <span className="text-amber-400 text-2xl">⚠</span>
          <h2 className="text-lg font-black text-white uppercase tracking-tight">
            Tens canvis sense desar
          </h2>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-300">
            Tens canvis sense desar en un document. Si continues amb el reset, aquests canvis es perdran definitivament.
          </p>
          <p className="text-sm text-gray-300 mt-3 font-bold">Què vols fer?</p>
        </div>

        <div className="p-6 border-t border-[var(--th-border)] flex flex-col gap-2">
          <button
            onClick={onSaveAndContinue}
            className="px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all active:scale-95"
            style={{ backgroundColor: 'var(--th-btn-primary-bg)', color: 'var(--th-btn-primary-text)' }}
          >
            Desar i continuar
          </button>
          <button
            onClick={onDiscardAndContinue}
            className="px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all active:scale-95"
            style={{ backgroundColor: 'rgb(220, 38, 38)', color: 'white' }}
          >
            Continuar sense desar
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all"
            style={{ backgroundColor: 'var(--th-bg-tertiary)', color: 'var(--th-text-secondary)', border: '1px solid var(--th-border)' }}
          >
            Cancel·lar
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 10.2: Run TypeScript compile check**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend" && npx tsc --noEmit 2>&1 | grep -E "SettingsModal" || echo "OK"
```

Expected: `OK`

- [ ] **Step 10.3: Commit**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && git add frontend/components/SettingsModal.tsx && git commit -m "feat(factory-reset): add UnsavedChangesWarningModal sub-modal

Inline component shown before the factory reset if history.isDirty === true
(checked via window.__sonilabIsDirtyRef in Task 11). Offers three options:
Desar i continuar, Continuar sense desar (destructive), Cancel·lar. Wired
into the main handler in the next task."
```

---

## Task 11: Wire the complete handler flow in `SettingsModal.tsx`

**Files:**
- Modify: `frontend/components/SettingsModal.tsx`

- [ ] **Step 11.1: Add state and the handler function**

In the main `SettingsModal` component, near the existing state declarations (after `isFactoryResetModalOpen` from Task 8), add:

```tsx
  // Factory Reset — unsaved changes sub-modal state
  const [isUnsavedChangesModalOpen, setIsUnsavedChangesModalOpen] = useState(false);
  const { me } = useAuth();
```

Note: `useAuth` hook should already be imported from Task 9. If `me` is already destructured from an existing `useAuth()` call in the component, skip re-declaring it.

Then add the handler function just before the component's `return` statement:

```tsx
  // Factory Reset handler — orchestrates isDirty check, sub-modal, factoryReset call, reload.
  // Note: factoryReset() (Phase A) already sets PENDING_FLAG and WARN_FLAG internally.
  // This function just triggers the call and the subsequent reload.
  const performFactoryReset = async () => {
    const userId = me?.id ?? null;
    await factoryReset(userId);
    window.location.reload();
  };

  const handleFactoryResetConfirm = async () => {
    // Check for unsaved changes in any editor
    const isDirty = typeof window !== 'undefined' && window.__sonilabIsDirtyRef?.current === true;

    if (isDirty) {
      // Divert to unsaved changes sub-modal
      setIsFactoryResetModalOpen(false);
      setIsUnsavedChangesModalOpen(true);
      return;
    }

    await performFactoryReset();
  };

  const handleSaveAndContinue = () => {
    setIsUnsavedChangesModalOpen(false);
    // Trigger save via keyboard event (most editors listen for Ctrl+S)
    // A cleaner solution would expose a save function via window too, but
    // this is simpler and uses existing keyboard handlers.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
    // Wait briefly for save to complete, then reset.
    setTimeout(() => {
      void performFactoryReset();
    }, 300);
  };

  const handleDiscardAndContinue = () => {
    setIsUnsavedChangesModalOpen(false);
    void performFactoryReset();
  };

  const handleUnsavedCancel = () => {
    setIsUnsavedChangesModalOpen(false);
  };
```

- [ ] **Step 11.2: Wire the stub `onConfirm` of `FactoryResetConfirmModal` to the real handler**

Find the `<FactoryResetConfirmModal ... />` render you added in Task 9, and replace its `onConfirm` prop:

**Before (stub):**
```tsx
        onConfirm={async () => {
          console.log('Factory reset confirmed (stub)');
        }}
```

**After:**
```tsx
        onConfirm={handleFactoryResetConfirm}
```

- [ ] **Step 11.3: Render the `UnsavedChangesWarningModal` in the main component**

Just after the `<FactoryResetConfirmModal ... />` render, add:

```tsx
      {/* Unsaved Changes Sub-Modal (only shown if isDirty at reset time) */}
      <UnsavedChangesWarningModal
        isOpen={isUnsavedChangesModalOpen}
        onSaveAndContinue={handleSaveAndContinue}
        onDiscardAndContinue={handleDiscardAndContinue}
        onCancel={handleUnsavedCancel}
      />
```

- [ ] **Step 11.4: Run TypeScript compile check**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend" && npx tsc --noEmit 2>&1 | grep -E "SettingsModal" || echo "OK"
```

Expected: `OK`

- [ ] **Step 11.5: Manual runtime check — happy path (no unsaved changes)**

Run `npm run dev`. Log in with a test user. Open Settings → General → click "Restablir configuració de fàbrica…".

1. Check the checkbox.
2. Click "Restablir configuració".
3. Button shows spinner briefly.
4. Page reloads.
5. After reload, verify in DevTools → Application → Local Storage: the keys in `KEYS_TO_REMOVE` are gone. `snlbpro_theme` and `snlbpro_user_styles_<userId>` should STILL be present.
6. Verify in DevTools → Application → Session Storage: `snlbpro_factory_reset_pending` is gone. `snlbpro_factory_reset_warn` is gone (unless backend failed).
7. Navigate to Settings → Dreceres → confirm TC IN/OUT shortcuts are now `Q`/`W` (defaults).

- [ ] **Step 11.6: Manual runtime check — unsaved changes path**

Still in `npm run dev`: open a document, make an edit without saving. Confirm the "Canvis sense desar" banner appears bottom-right.

Open Settings → General → Restablir → check checkbox → click "Restablir configuració".

Verify:
1. The main modal closes.
2. The unsaved changes sub-modal appears with 3 buttons.
3. Click "Cancel·lar" → sub-modal closes, main modal does NOT re-open (the user is returned to settings).

Reopen the main modal → trigger the sub-modal again → click "Continuar sense desar":
1. Sub-modal closes.
2. Reset executes.
3. Page reloads.
4. The edit is lost (expected — the user chose to discard).

Reopen → edit → trigger the sub-modal → click "Desar i continuar":
1. The save keyboard event fires, the document saves (verify the "Canvis sense desar" banner disappears).
2. After 300ms, reset executes.
3. Page reloads.

Stop the dev server.

- [ ] **Step 11.7: Commit**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && git add frontend/components/SettingsModal.tsx && git commit -m "feat(factory-reset): wire the complete handler flow in SettingsModal

Adds performFactoryReset (calls factoryReset + reload),
handleFactoryResetConfirm (isDirty check → divert to sub-modal or
proceed), and the three handlers for the unsaved changes sub-modal
(save/discard/cancel). Renders the UnsavedChangesWarningModal and
connects its props. The stub onConfirm in FactoryResetConfirmModal
is replaced with the real handler.

At this point the full feature is functionally complete — card opens
modal, modal offers confirmation with checkbox blocker, optional
unsaved changes sub-modal, factoryReset runs both phases (backend +
broadcast + sessionStorage flag), and reload triggers Phase B cleanup
at index.tsx."
```

---

## Task 12: Update `domain-localstorage.md` with step 6

**Files:**
- Modify: `Skills_Claude/domain-localstorage.md`

- [ ] **Step 12.1: Add step 6 to the "Qué hacer si se añade o renombra una clave" section**

Open `Skills_Claude/domain-localstorage.md`. Find the numbered list in the section "Qué hacer si se añade o renombra una clave" (around lines 52-58). Currently it ends at step 5. Add a step 6:

```markdown
6. **Factory Reset**: decidir si la nueva clave debe restablecerse al "factory reset" (Settings → General). Si sí, añadirla a la lista `KEYS_TO_REMOVE` de `frontend/utils/factoryReset.ts`. Si no (porque es trabajo del usuario, datos del documento, o la sesión), dejarla fuera de esa lista y añadir un comentario aquí explicando por qué. Ver `docs/superpowers/specs/2026-04-07-reset-configuracio-frontend.md` para el criterio completo.
```

- [ ] **Step 12.2: Commit**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && git add Skills_Claude/domain-localstorage.md && git commit -m "docs(domain): afegir pas 6 a la guia de keys de localStorage (factory reset)

Quan s'afegeix una key nova a LOCAL_STORAGE_KEYS, decidir si ha de
ser esborrada pel Factory Reset (afegir a KEYS_TO_REMOVE) o
preservada (deixar fora i documentar per què). Referència al spec
del feature."
```

---

## Task 13: Full manual test plan execution

**Files:**
- No files modified in this task — verification only.

- [ ] **Step 13.1: Prepare a user with personalized state**

Start the dev server: `cd frontend && npm run dev`. Log in with a test user and set up state per spec section 9.1:

1. **Settings → Dreceres**: manually reassign `sub_set_tc_in` back to `I` and `sub_set_tc_out` back to `O` (simulating a user who had customized these before the Q/W defaults).
2. **Settings → General**: set `max_lines_subs = 4`.
3. **Library**: drag the library sidebar to width ≈ 600px (or edit `localStorage.snlbpro_library_width` in DevTools).
4. **Settings → Tema**: modify at least one color in the custom theme tokens.
5. **Settings → Estils**: create at least one new typography preset.
6. **Open a document**: make 2-3 edits and save a few versions to populate `snlbpro_versions_<docId>`.

Note the current state of all the above in DevTools Local Storage for post-reset comparison.

- [ ] **Step 13.2: Run test case 1 — Happy path**

Execute Settings → General → Reset → check checkbox → Restablir configuració. Page reloads. Verify:
- Atajos = `Q`/`W` for TC IN/OUT ✓
- `max_lines_subs` = default (2)
- `library_width` = 420px (default)
- `customThemeTokens` cleared (base palette restored)
- **`themeId` preserved** (same theme base still active)
- **User style presets preserved** (created preset still in list)
- Still logged in

- [ ] **Step 13.3: Run test case 2 — Cancel·lar from modal**

Reopen the modal. Check the checkbox. Click Cancel·lar. Reload the page manually (F5). Confirm nothing has changed.

- [ ] **Step 13.4: Run test case 3 — Botó disabled sense checkbox**

Reopen the modal. Without checking the checkbox, try clicking "Restablir configuració". Confirm button is visually disabled and doesn't respond.

- [ ] **Step 13.5: Run test case 4 — Backend down (partial reset with banner)**

Stop the backend (kill the Nest server). Trigger a full reset flow. Verify:
- Reset runs.
- Page reloads.
- The amber "Reset parcial" banner appears at top-center of the screen.
- Click the × on the banner. It closes.
- Manually reload the page. Banner does NOT reappear (sessionStorage `WARN_FLAG` was cleared).

Restart the backend when done.

- [ ] **Step 13.6: Run test case 5 — Reset doble (no residual state)**

Do a reset. After the reload, manually change a shortcut. Trigger another reset. Verify all defaults are correct again.

- [ ] **Step 13.7: Run test case 6 — No regression on Library**

After a reset, open Library. Confirm it loads correctly from backend (the `snlbpro_library_v3` cache is empty but the fetch works).

- [ ] **Step 13.8: Run test case 7 — Version history preserved**

Before the reset: note the number of versions of a document. Reset → reload → reopen the same document. Verify the version count is unchanged.

- [ ] **Step 13.9: Run test case 8 — Multi-pestanya**

Open two browser tabs with the app, same user. In tab A, go to Settings → Dreceres and modify a shortcut. Verify in tab B that the shortcut auto-syncs (via `useLocalStorage` storage event listener — this is existing behavior, not new).

Now in tab A, trigger the full factory reset flow. Verify:
- Tab A reloads and shows defaults.
- Tab B ALSO reloads automatically (via BroadcastChannel).
- After tab B's reload, it shows defaults too.
- Any transcription/translation tasks that were in-progress in tab B **do NOT reappear** in tab B post-reload (Phase B cleaned `TASKS_TRANSCRIPTION` / `TASKS_TRANSLATION` before tab B's providers mounted).

- [ ] **Step 13.10: Run test case 9 — Unsaved changes sub-modal**

Open a document, make an edit, do NOT save. See the "Canvis sense desar" banner at bottom-right.

Go to Settings → Reset → check checkbox → Restablir configuració. Verify the sub-modal appears with the 3 buttons.

Test each branch:
- "Desar i continuar": the save triggers (banner disappears), then reset executes.
- "Continuar sense desar": reset executes immediately, the edit is lost.
- "Cancel·lar": sub-modal closes, nothing else happens.

- [ ] **Step 13.11: Run test case 10 — Cancel·lació bloquejada durant in-flight**

Trigger the reset. During the brief in-flight state (before the reload), try:
- Pressing Escape → does nothing.
- Clicking the backdrop → does nothing.
- Clicking the "Cancel·lar" button → does nothing.

The reload should proceed normally regardless of these attempts.

- [ ] **Step 13.12: Run test case 11 — sessionStorage disabled**

In DevTools → Application → Storage → Session Storage: right-click the domain → Clear. Then, to simulate disabled sessionStorage, open DevTools console and run:
```js
Object.defineProperty(window, 'sessionStorage', {
  get() { throw new Error('sessionStorage disabled'); }
});
```

Now trigger a reset. Expected: the app doesn't crash. The reset silently degrades — `factoryReset` catches the sessionStorage error, proceeds with the backend call and BroadcastChannel, then reloads. After the reload, `applyPendingFactoryReset` fails to read the flag and silently returns (no local cleanup). The reset is partial: backend is reset but localStorage isn't.

This is an **accepted known limitation** documented in spec section 7.

- [ ] **Step 13.13: Record results and open bugs if any**

If any of the 11 test cases failed, open a GitHub issue / create a follow-up plan to fix the regression. If all passed, this task is complete.

- [ ] **Step 13.14: Commit the test results as a final verification note**

No code changes from this task. Skip the commit or, if you want a marker in history:

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && git commit --allow-empty -m "test(factory-reset): manual verification of all 11 test cases passed

All 11 cases from spec section 9.2 executed manually and verified:
1. Happy path ✓
2. Cancel·lar ✓
3. Button disabled without checkbox ✓
4. Backend down → banner shown ✓
5. Double reset → no residual state ✓
6. Library regression-free ✓
7. Version history preserved ✓
8. Multi-tab with BroadcastChannel ✓
9. Unsaved changes sub-modal ✓
10. Cancel blocked during in-flight ✓
11. sessionStorage disabled → graceful degradation ✓

Feature ready for merge."
```

---

## Spec coverage self-check

Each requirement from the spec is covered by a task:

| Spec section | Requirement | Task |
|---|---|---|
| 3.1 | Clear backend `preferences.shortcuts` and `customThemeTokens` | Task 2 |
| 3.1 | Preserve backend `themeId` and `userStyles` | Task 2 (implicit: omitted from updateMe payload) |
| 3.2 | Wipe `KEYS_TO_REMOVE` from localStorage | Tasks 1, 3 |
| 3.2 | Preserve `THEME`, `snlbpro_versions_*`, `snlbpro_user_styles_*`, `sonilab_guion_*`, `sonilab_token` | Task 1 (by not including in KEYS_TO_REMOVE) |
| 3.2 | Handle scoped `CUSTOM_THEME_TOKENS_<userId>` variant | Task 3 |
| 4.1 | Files: factoryReset.ts (NEW) | Tasks 1-3 |
| 4.1 | Files: index.tsx (MODIFIED) | Task 4 |
| 4.1 | Files: App.tsx (MODIFIED) | Tasks 5, 6, 7 |
| 4.1 | Files: SettingsModal.tsx (MODIFIED) | Tasks 8-11 |
| 4.1 | Files: domain-localstorage.md (MODIFIED) | Task 12 |
| 4.2 | API: `factoryReset(userId)` + `applyPendingFactoryReset()` + exported constants | Tasks 1-3 |
| 5 Fase A (A1-A4) | Backend → BroadcastChannel → sessionStorage flags → reload | Task 2 (A1-A3) + Task 11 (A4 reload) |
| 5 Fase B | `applyPendingFactoryReset` at index.tsx before render | Tasks 3, 4 |
| 5 Multi-tab listener | `BroadcastChannel` listener in App.tsx | Task 5 |
| 5 Post-reload banner | `factoryResetWarn` state + effect + api.me() verification + JSX | Task 6 |
| 6.1 | Card in General tab at end | Task 8 |
| 6.2 | Main modal with checkbox blocker | Task 9 |
| 6.2 | Blocked cancel mechanisms during in-flight | Task 9 |
| 6.2 | Multi-tab informational notice in modal | Task 9 |
| 6.2 | Unsaved changes sub-modal | Task 10 |
| 6.2 | `window.__sonilabIsDirtyRef` for the isDirty check | Task 7 |
| 7 | Edge cases — all have defensive try/catch | Tasks 2, 3, 6, 11 |
| 9.2 | All 11 test cases executed | Task 13 |
| 10 | `domain-localstorage.md` step 6 | Task 12 |

No gaps identified.

---

## Known limitations (deferred, explicitly out of scope)

- **Transversal `beforeunload` handler**: protects only within the factory reset flow (via isDirty check). Cases like closing the tab with unsaved changes are still unprotected. Spec section 8.
- **Cross-tab sync via `storage` events in `TranscriptionContext`, `TranslationContext`, `LibraryDataContext`**: these contexts don't listen to storage events; multi-tab reset handled via BroadcastChannel forced reload instead of in-place state refresh. Spec section 8.
- **Save trigger via synthetic keyboard event** (Task 11, Step 11.1, `handleSaveAndContinue`): relies on editors listening to `Ctrl+S`. More robust approach would be to expose an `onSaveRequest` callback globally, similar to `window.__sonilabIsDirtyRef`. Accepted as acceptable MVP because existing editors all respond to `Ctrl+S`.

---

## Execution

**Plan complete and saved to `docs/superpowers/plans/2026-04-07-reset-configuracio-frontend.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
