# Durada Mínima Configurable per Bloc de Subtítol — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user-configurable "minimum subtitle duration" setting (default 1000 ms, equivalent to Subtitle Edit's "Minimum duration") that prevents reducing any subtitle block below the configured threshold via timecode inputs, keyboard shortcuts (Q/W), or waveform timeline drag handles.

**Architecture:** The setting follows the exact same pattern as the existing `editorMinGapMs` / `EDITOR_MIN_GAP_MS`: stored in localStorage, read via `useLocalStorage`, included in `GeneralConfig`, and propagated to all enforcement points. The effective floor at runtime is `Math.max(MIN_SEG_DURATION_MS, userValue) / 1000` to ensure the existing 100 ms hard floor still applies when the user sets 0.

**Tech Stack:** React 19 + TypeScript 5.8, Vite, `useLocalStorage` hook, `useMemo`, `useRef`/`useEffect` for stable drag refs.

## Global Constraints

- Default value: **1000 ms** (matches Subtitle Edit standard default).
- localStorage key name: `'snlbpro_editor_min_duration_ms'`.
- Enforcement formula everywhere: `Math.max(MIN_SEG_DURATION_MS, generalConfig.minDurationMs ?? 1000) / 1000`.
- `MIN_SEG_DURATION_MS` (100) is a **read-only** floor — never change it (used by backend transcription pipeline too).
- No retroactive enforcement: existing SRT blocks below threshold are NOT modified on load.
- No changes to backend or to `SubtitlesEditor.tsx` / `SegmentItem.tsx` / `TimecodeInput.tsx`.
- Build command: `cd frontend && npm run build` — must produce zero TypeScript errors.
- No automated tests exist; verification is manual via the dev server (`cd frontend && npm run dev`).

---

### Task 1: Foundation — localStorage key + GeneralConfig type

**Files:**
- Modify: `frontend/constants.ts` (add key to `LOCAL_STORAGE_KEYS`)
- Modify: `frontend/types/Subtitles.ts` (add `minDurationMs` to `GeneralConfig`)

**Interfaces:**
- Produces: `LOCAL_STORAGE_KEYS.EDITOR_MIN_DURATION_MS` (string key `'snlbpro_editor_min_duration_ms'`) and `GeneralConfig.minDurationMs?: number`; consumed by all subsequent tasks.

- [ ] **Step 1: Add the localStorage key to `frontend/constants.ts`**

  Open `frontend/constants.ts`. Find the `EDITOR_MIN_GAP_MS` entry (line ~27):
  ```typescript
  /** Marge mínim entre subtítols a l'editor (ms). Preferència d'usuari, independent del projecte. */
  EDITOR_MIN_GAP_MS: 'snlbpro_editor_min_gap_ms',
  ```
  Add the new key **immediately after** it:
  ```typescript
  /** Durada mínima d'un bloc de subtítol a l'editor (ms). Preferència d'usuari. Default: 1000. */
  EDITOR_MIN_DURATION_MS: 'snlbpro_editor_min_duration_ms',
  ```

- [ ] **Step 2: Add `minDurationMs` to `GeneralConfig` in `frontend/types/Subtitles.ts`**

  The entire `GeneralConfig` interface currently reads:
  ```typescript
  export interface GeneralConfig {
    maxCharsPerLine: number;
    maxLinesPerSubtitle: number;
    /** Marge mínim entre subtítols consecutius (ms). Default: 160 */
    minGapMs?: number;
  }
  ```
  Replace it with:
  ```typescript
  export interface GeneralConfig {
    maxCharsPerLine: number;
    maxLinesPerSubtitle: number;
    /** Marge mínim entre subtítols consecutius (ms). Default: 160 */
    minGapMs?: number;
    /** Durada mínima de cada bloc (ms). Default: 1000. Equivalent a Subtitle Edit "Minimum duration". */
    minDurationMs?: number;
  }
  ```

- [ ] **Step 3: TypeScript check**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | head -30
  ```
  Expected: zero errors (new optional field breaks nothing).

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/constants.ts frontend/types/Subtitles.ts
  git commit -m "feat(subtitles): add EDITOR_MIN_DURATION_MS key and minDurationMs to GeneralConfig"
  ```

---

### Task 2: Factory Reset — include new key in cleanup list

**Files:**
- Modify: `frontend/utils/factoryReset.ts`

**Interfaces:**
- Consumes: `LOCAL_STORAGE_KEYS.EDITOR_MIN_DURATION_MS` from Task 1.
- Produces: `KEYS_TO_REMOVE` includes the new key so Factory Reset clears the setting.

- [ ] **Step 1: Add key to `KEYS_TO_REMOVE` in `frontend/utils/factoryReset.ts`**

  Find the existing entry (~line 44):
  ```typescript
  LOCAL_STORAGE_KEYS.EDITOR_MIN_GAP_MS,
  ```
  Add the new key **immediately after**:
  ```typescript
  LOCAL_STORAGE_KEYS.EDITOR_MIN_GAP_MS,
  LOCAL_STORAGE_KEYS.EDITOR_MIN_DURATION_MS,
  ```

- [ ] **Step 2: TypeScript check**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | head -30
  ```
  Expected: zero errors.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/utils/factoryReset.ts
  git commit -m "feat(settings): include EDITOR_MIN_DURATION_MS in factory reset cleanup"
  ```

---

### Task 3: Settings UI — expose the new preference in SettingsModal

**Files:**
- Modify: `frontend/components/SettingsModal.tsx`

**Interfaces:**
- Consumes: `LOCAL_STORAGE_KEYS.EDITOR_MIN_DURATION_MS` from Task 1.
- Produces: `editorMinDurationMs` persisted to localStorage; reactive to UI input immediately.

- [ ] **Step 1: Add `useLocalStorage` state for the new setting**

  In `frontend/components/SettingsModal.tsx`, find the existing `editorMinGapMs` state declaration (~line 565):
  ```typescript
  const [editorMinGapMs, setEditorMinGapMs] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.EDITOR_MIN_GAP_MS, 160);
  ```
  Add the new state **immediately after** it:
  ```typescript
  const [editorMinDurationMs, setEditorMinDurationMs] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.EDITOR_MIN_DURATION_MS, 1000);
  ```

- [ ] **Step 2: Add the UI control below the "Marge mínim entre subtítols" block**

  Find the closing `</div>` that ends the "Marge mínim entre subtítols" section. It looks like this (~line 949):
  ```tsx
                          <span className="text-xs font-mono" style={{ color: 'var(--th-editor-meta)' }}>ms</span>
                      </div>
                  </div>
              </div>
  ```
  The parent `<div className="flex items-center justify-between pt-4 border-t ...">` block ends here. 
  Insert a new block **after** the closing `</div>` of that block and **before** the next sibling block (which is the "Temps de pressió per moure segment" control). The exact insertion point: after:
  ```tsx
                      </div>
                  </div>
              </div>
  ```
  (which is the end of the minGap section) — add:
  ```tsx
                      <div className="flex items-center justify-between pt-4 border-t border-[var(--th-border)]/30">
                          <div>
                              <p className="font-bold text-gray-200">Durada mínima de subtítol</p>
                              <p className="text-xs text-gray-500 italic">Impedeix reduir un bloc per sota d'aquest llindar (ms). Equivalent a "Minimum duration" de Subtitle Edit.</p>
                          </div>
                          <div className="flex items-center gap-2">
                              <input
                                  type="number"
                                  min="0" max="5000" step="50"
                                  value={editorMinDurationMs}
                                  onChange={(e) => setEditorMinDurationMs(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                  className="w-20 rounded-lg px-3 py-2 text-white font-mono text-center outline-none" style={{ backgroundColor: 'var(--th-bg-tertiary)', border: '1px solid var(--th-border)', '--tw-ring-color': 'var(--th-accent)' } as any}
                              />
                              <span className="text-xs font-mono" style={{ color: 'var(--th-editor-meta)' }}>ms</span>
                          </div>
                      </div>
  ```

- [ ] **Step 3: TypeScript check**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | head -30
  ```
  Expected: zero errors.

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/components/SettingsModal.tsx
  git commit -m "feat(settings): add 'Durada mínima de subtítol' control to SettingsModal"
  ```

---

### Task 4: WaveformTimeline — add `minDurationMs` prop and enforce during drag

**Files:**
- Modify: `frontend/components/VideoEditor/WaveformTimeline.tsx`

**Interfaces:**
- Consumes: `MIN_SEG_DURATION_MS` (already imported from `../../constants`), new optional prop `minDurationMs?: number`.
- Produces: `minDurMsRef` (stable ref used inside `handleMouseMove` callbacks), enforced in drag `resize-start` and `resize-end`.

- [ ] **Step 1: Add `minDurationMs` to the props interface**

  Find the interface near the top of the file that contains `minGapMs` (~line 51):
  ```typescript
  /** Marge mínim entre subtítols consecutius (ms). Default: 160 */
  minGapMs?: number;
  ```
  Add **after** it:
  ```typescript
  /** Durada mínima d'un subtítol (ms). Default: 1000 */
  minDurationMs?: number;
  ```

- [ ] **Step 2: Destructure `minDurationMs` with a default**

  Find the destructuring of `minGapMs` in the component definition (~line 105):
  ```typescript
  minGapMs = 160,
  ```
  Add `minDurationMs` **after** it:
  ```typescript
  minGapMs = 160,
  minDurationMs = 1000,
  ```

- [ ] **Step 3: Add a stable ref for `minDurationMs`**

  After the existing drag-state refs block (around line 128, after `const pendingSeekRef = useRef<number | null>(null);`), add:
  ```typescript
  const minDurMsRef = useRef(minDurationMs);
  useEffect(() => { minDurMsRef.current = minDurationMs; }, [minDurationMs]);
  ```

- [ ] **Step 4: Replace the two hardcoded `MIN_SEG_DURATION` usages in `handleMouseMove`**

  Find line ~642 (`resize-start` block):
  ```typescript
  if (ne - ns < MIN_SEG_DURATION) ns = ne - MIN_SEG_DURATION;
  ```
  Replace with:
  ```typescript
  const minDurSec = Math.max(MIN_SEG_DURATION_MS, minDurMsRef.current) / 1000;
  if (ne - ns < minDurSec) ns = ne - minDurSec;
  ```

  Find line ~649 (`resize-end` block):
  ```typescript
  if (ne - ns < MIN_SEG_DURATION) ne = ns + MIN_SEG_DURATION;
  ```
  Replace with:
  ```typescript
  const minDurSec2 = Math.max(MIN_SEG_DURATION_MS, minDurMsRef.current) / 1000;
  if (ne - ns < minDurSec2) ne = ns + minDurSec2;
  ```

  > **Note:** Two separate `const` declarations are needed because both are in adjacent `else if`/`else` branches of the same conditional; they do not share scope. Alternatively, hoist a single `const minDurSec` above the entire `if (dragTypeRef.current === 'resize-start')` block if both branches are at the same level — check the exact structure.

- [ ] **Step 5: TypeScript check**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | head -30
  ```
  Expected: zero errors.

- [ ] **Step 6: Commit**

  ```bash
  git add frontend/components/VideoEditor/WaveformTimeline.tsx
  git commit -m "feat(timeline): enforce configurable min duration during drag resize"
  ```

---

### Task 5: VideoSubtitlesEditorView — read setting, propagate, enforce in 3 callbacks

**Files:**
- Modify: `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx`

**Interfaces:**
- Consumes: `LOCAL_STORAGE_KEYS.EDITOR_MIN_DURATION_MS` from Task 1, `GeneralConfig.minDurationMs` from Task 1, `WaveformTimeline.minDurationMs` prop from Task 4.
- Produces: `editorMinDurationMs` in state, `generalConfig.minDurationMs` in the memo, enforcement in `handleSetTcIn`, `handleSetTcOut`, `handleSegmentChange`.

- [ ] **Step 1: Add `useLocalStorage` state**

  Find (~line 237):
  ```typescript
  const [editorMinGapMs, setEditorMinGapMs] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.EDITOR_MIN_GAP_MS, 160);
  ```
  Add **after**:
  ```typescript
  const [editorMinDurationMs] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.EDITOR_MIN_DURATION_MS, 1000);
  ```
  > Note: `setEditorMinDurationMs` is not needed here because this view does not expose the setting control — only SettingsModal does. The value is read-only from this view's perspective.

- [ ] **Step 2: Add `minDurationMs` to `generalConfig`**

  Find the `generalConfig` useMemo (~line 239):
  ```typescript
  const generalConfig = useMemo<GeneralConfig>(() => ({
    maxCharsPerLine: 40,
    maxLinesPerSubtitle: maxLinesSubs,
    minGapMs: editorMinGapMs,
  }), [maxLinesSubs, editorMinGapMs]);
  ```
  Replace with:
  ```typescript
  const generalConfig = useMemo<GeneralConfig>(() => ({
    maxCharsPerLine: 40,
    maxLinesPerSubtitle: maxLinesSubs,
    minGapMs: editorMinGapMs,
    minDurationMs: editorMinDurationMs,
  }), [maxLinesSubs, editorMinGapMs, editorMinDurationMs]);
  ```

- [ ] **Step 3: Enforce in `handleSetTcIn`**

  Find `handleSetTcIn` (~line 824). The current body ends with:
  ```typescript
  if (startTime >= seg.endTime - MIN_SEG_DURATION) startTime = seg.endTime - MIN_SEG_DURATION;
  subsHistory.commit(segments.map(s => s.id === activeSegmentId ? { ...s, startTime } : s));
  ```
  Replace those two lines with:
  ```typescript
  const minDurSec = Math.max(MIN_SEG_DURATION_MS, generalConfig.minDurationMs ?? 1000) / 1000;
  if (startTime >= seg.endTime - minDurSec) startTime = seg.endTime - minDurSec;
  subsHistory.commit(segments.map(s => s.id === activeSegmentId ? { ...s, startTime } : s));
  ```
  Also update the `useCallback` deps array at the end of `handleSetTcIn`. Current deps:
  ```typescript
  }, [isEditing, activeSegmentId, segments, generalConfig.minGapMs, subsHistory]);
  ```
  Change to:
  ```typescript
  }, [isEditing, activeSegmentId, segments, generalConfig.minGapMs, generalConfig.minDurationMs, subsHistory]);
  ```

- [ ] **Step 4: Enforce in `handleSetTcOut`**

  Find `handleSetTcOut` (~line 844). The current enforcement line:
  ```typescript
  if (endTime - seg.startTime < MIN_SEG_DURATION) endTime = seg.startTime + MIN_SEG_DURATION;
  ```
  Replace with:
  ```typescript
  const minDurSec = Math.max(MIN_SEG_DURATION_MS, generalConfig.minDurationMs ?? 1000) / 1000;
  if (endTime - seg.startTime < minDurSec) endTime = seg.startTime + minDurSec;
  ```
  Update `useCallback` deps. Current:
  ```typescript
  }, [isEditing, activeSegmentId, segments, generalConfig.minGapMs, subsHistory]);
  ```
  Change to:
  ```typescript
  }, [isEditing, activeSegmentId, segments, generalConfig.minGapMs, generalConfig.minDurationMs, subsHistory]);
  ```

- [ ] **Step 5: Enforce in `handleSegmentChange`**

  Find `handleSegmentChange` (~line 891). The current enforcement line:
  ```typescript
  if (endTime - startTime < MIN_SEG_DURATION) endTime = startTime + MIN_SEG_DURATION;
  ```
  Replace with:
  ```typescript
  const minDurSec = Math.max(MIN_SEG_DURATION_MS, generalConfig.minDurationMs ?? 1000) / 1000;
  if (endTime - startTime < minDurSec) endTime = startTime + minDurSec;
  ```
  Update `useCallback` deps. Current:
  ```typescript
  }, [isEditing, subsHistory, generalConfig.minGapMs]);
  ```
  Change to:
  ```typescript
  }, [isEditing, subsHistory, generalConfig.minGapMs, generalConfig.minDurationMs]);
  ```

- [ ] **Step 6: Pass `minDurationMs` prop to `WaveformTimeline`**

  Find the `<WaveformTimeline` JSX block (~line 1110). Current last timing prop:
  ```tsx
  minGapMs={generalConfig.minGapMs}
  ```
  Add immediately after:
  ```tsx
  minGapMs={generalConfig.minGapMs}
  minDurationMs={generalConfig.minDurationMs}
  ```

- [ ] **Step 7: TypeScript check**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | head -30
  ```
  Expected: zero errors.

- [ ] **Step 8: Commit**

  ```bash
  git add frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx
  git commit -m "feat(editor): enforce configurable min duration in main VideoSubtitlesEditorView"
  ```

---

### Task 6: VideoSrtStandaloneEditorView — read setting, enforce, fix hardcoded bug

**Files:**
- Modify: `frontend/components/VideoSubtitlesEditor/VideoSrtStandaloneEditorView.tsx`

**Interfaces:**
- Consumes: `LOCAL_STORAGE_KEYS.EDITOR_MIN_DURATION_MS` from Task 1, `GeneralConfig.minDurationMs` from Task 1, `WaveformTimeline.minDurationMs` from Task 4, `MIN_SEG_DURATION_MS` (needs to be added to the import from `../../constants`).
- Produces: Standalone editor now enforces the same minimum duration as the main editor. Fixes existing bug where the hardcoded `0.1` was used instead of the constant.

- [ ] **Step 1: Add `MIN_SEG_DURATION_MS` to the import from constants**

  Find line ~16:
  ```typescript
  import { LOCAL_STORAGE_KEYS, isAudioOnly } from '../../constants';
  ```
  Replace with:
  ```typescript
  import { LOCAL_STORAGE_KEYS, isAudioOnly, MIN_SEG_DURATION_MS } from '../../constants';
  ```

- [ ] **Step 2: Add `useLocalStorage` state for the new setting**

  Find (~line 73):
  ```typescript
  const [editorMinGapMs, setEditorMinGapMs] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.EDITOR_MIN_GAP_MS, 160);
  ```
  Add **after**:
  ```typescript
  const [editorMinDurationMs] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.EDITOR_MIN_DURATION_MS, 1000);
  ```

- [ ] **Step 3: Add `minDurationMs` to `generalConfig`**

  Find (~line 75):
  ```typescript
  const generalConfig = useMemo<GeneralConfig>(() => ({
    maxCharsPerLine: 40,
    maxLinesPerSubtitle: maxLinesSubs,
    minGapMs: editorMinGapMs,
  }), [maxLinesSubs, editorMinGapMs]);
  ```
  Replace with:
  ```typescript
  const generalConfig = useMemo<GeneralConfig>(() => ({
    maxCharsPerLine: 40,
    maxLinesPerSubtitle: maxLinesSubs,
    minGapMs: editorMinGapMs,
    minDurationMs: editorMinDurationMs,
  }), [maxLinesSubs, editorMinGapMs, editorMinDurationMs]);
  ```

- [ ] **Step 4: Fix bug and enforce in `handleSegmentChange`**

  Find `handleSegmentChange` (~line 336). The current buggy line:
  ```typescript
  if (endTime - startTime < 0.1) endTime = startTime + 0.1;
  ```
  Replace with:
  ```typescript
  const minDurSec = Math.max(MIN_SEG_DURATION_MS, generalConfig.minDurationMs ?? 1000) / 1000;
  if (endTime - startTime < minDurSec) endTime = startTime + minDurSec;
  ```
  > This is a regular function (not `useCallback`), so no deps array to update. The `generalConfig` variable is captured from the enclosing scope — since `generalConfig` is rebuilt by `useMemo` when `editorMinDurationMs` changes, the function always sees the latest value when it is called (it re-reads `generalConfig` on each invocation, not via closure capture of a primitive).

- [ ] **Step 5: Pass `minDurationMs` to `WaveformTimeline`**

  Find the `<WaveformTimeline` JSX block (~line 524). Current:
  ```tsx
  minGapMs={generalConfig.minGapMs}
  ```
  Add immediately after:
  ```tsx
  minGapMs={generalConfig.minGapMs}
  minDurationMs={generalConfig.minDurationMs}
  ```

- [ ] **Step 6: TypeScript check**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | head -30
  ```
  Expected: zero errors.

- [ ] **Step 7: Commit**

  ```bash
  git add frontend/components/VideoSubtitlesEditor/VideoSrtStandaloneEditorView.tsx
  git commit -m "feat(editor): enforce configurable min duration in standalone SRT editor; fix hardcoded 0.1 bug"
  ```

---

### Task 7: Full build check + manual verification

**Files:** None modified — verification only.

- [ ] **Step 1: Full TypeScript + Vite build**

  ```bash
  cd frontend && npm run build 2>&1 | tail -20
  ```
  Expected: build completes with `✓ built in X.XXs`, zero type errors.

- [ ] **Step 2: Start dev server**

  ```bash
  cd frontend && npm run dev
  ```
  Open the app in the browser.

- [ ] **Step 3: Verify SettingsModal control**

  - Open Settings (gear icon).
  - Navigate to the General tab → "Editor de Subtítols" section.
  - Confirm a new "Durada mínima de subtítol" numeric input is visible, showing `1000`, with an `ms` label.
  - Change the value to `500`. Close settings.
  - Reload the page. Open Settings again — value should still be `500` (persisted in localStorage).

- [ ] **Step 4: Verify timecode enforcement (TC IN / TC OUT shortcuts)**

  - Open an SRT document in the VideoSubtitlesEditorView.
  - Sync a video.
  - Select a subtitle block that is 2 seconds long (e.g. 00:00:01,000 → 00:00:03,000).
  - Set minimum duration to `1500` ms in Settings.
  - Position the playhead at 00:00:02,900 (0.1s before OUT).
  - Press **Q** (Set TC IN): the start time should snap to `00:00:01,500` (3.0 - 1.5 = 1.5), NOT go to 2.9 which would make it 0.1s duration.
  - Position playhead at 00:00:01,100 (0.1s after IN).
  - Press **W** (Set TC OUT): the end time should snap to `00:00:02,600` (1.1 + 1.5 = 2.6), NOT go to 1.1 which would make it 0.1s duration.

- [ ] **Step 5: Verify timecode input enforcement**

  - Click on the OUT timecode of a 2-second block and manually enter a value that would make the duration 200 ms (below the 1500 ms minimum).
  - Press Enter or Tab to commit.
  - Verify the OUT time is adjusted up to keep the block at least 1500 ms long.

- [ ] **Step 6: Verify waveform drag enforcement**

  - In the waveform timeline, hold and drag the left edge (resize-start) of a segment to the right, trying to make it shorter than 1500 ms.
  - Verify the segment stops resizing at 1500 ms minimum duration.
  - Hold and drag the right edge (resize-end) to the left similarly.
  - Verify same constraint.

- [ ] **Step 7: Verify standalone editor**

  - Open an SRT file in Standalone SRT Editor mode.
  - Repeat Steps 4–6 in this mode. Behavior should be identical.

- [ ] **Step 8: Verify Factory Reset**

  - Set minimum duration to `2000` ms.
  - Go to Settings → bottom → Factory Reset.
  - After reload, open Settings and confirm the value has reverted to `1000` (the default).

- [ ] **Step 9: Verify edge case — setting to 0**

  - Set minimum duration to `0` ms.
  - Try to shrink a segment to 50 ms (below the 100 ms hard floor).
  - Verify the segment stays at 100 ms minimum (hard floor `MIN_SEG_DURATION_MS` still applies).
