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
