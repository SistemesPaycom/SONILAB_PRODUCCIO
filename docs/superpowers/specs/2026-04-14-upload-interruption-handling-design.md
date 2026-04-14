# Upload Interruption Handling — Design Spec
**Date:** 2026-04-14
**Status:** Approved

---

## Problem

When a user uploads a video/audio file and reloads the page (or closes the tab), the upload is silently interrupted. This causes two problems:

1. **User experience:** No warning before losing an in-progress upload.
2. **Backend hygiene:** Multer writes files directly to `STORAGE_ROOT/`. If the connection drops mid-stream, a partial file is left on disk with no DB record — a persistent orphan consuming disk space.

---

## Goals

1. Warn the user before accidentally leaving the page while uploads are active (`beforeunload`).
2. Allow the user to explicitly cancel an active upload from the UI (cancel button per job).
3. Guarantee that `STORAGE_ROOT/` only ever contains files with a corresponding DB record (temp folder pattern).
4. Clean up any residual tmp files left by server crashes (startup cleanup).

---

## Architecture

### Frontend — 4 changes

#### 1. `api.uploadMedia` — expose abort handle

**File:** `frontend/services/api.ts`

Change the return type from `Promise<result>` to `{ promise, abort }`:

```ts
uploadMedia(file, onProgress, parentId): { promise: Promise<{ document: any; duplicated?: boolean }>, abort: () => void }
```

Internally, `xhr.abort()` already exists — we just expose it. Two implementation details:

1. **Remove `async` keyword** from `uploadMedia`. The function now returns `{ promise, abort }` synchronously — if it stayed `async`, TypeScript would wrap the whole object in another Promise.
2. **Add `xhr.onabort` handler** that rejects the Promise with `new Error('Cancel·lat')`. Without it, calling `abort()` would leave the Promise hanging (XHR fires `abort` event, not `error` event).

**Call pattern change:**
```ts
// Before
const result = await api.uploadMedia(file, onProgress, parentId)

// After
const { promise, abort } = api.uploadMedia(file, onProgress, parentId)
registerAbort(jobId, abort)
const result = await promise
```

---

#### 2. `UploadContext` — abort registry + `beforeunload`

**File:** `frontend/context/Upload/UploadContext.tsx`

**New interface members:**
```ts
registerAbort: (id: string, abortFn: () => void) => void
cancelJob: (id: string) => void
```

**Internal abort registry** (in-memory only, not persisted):
```ts
const abortHandles = useRef<Map<string, () => void>>(new Map())
```

- `registerAbort(id, fn)` — stores the abort function for a job.
- `cancelJob(id)` — calls the stored abort function and removes the handle from the map. Does NOT call `completeJob` directly — the XHR abort causes the Promise to reject, which flows to the call-site's `catch` block, which calls `completeJob(id, false, ...)`. This ensures `completeJob` is called exactly once per job. **If no handle is found for `id` (job already completed), `cancelJob` is a no-op** — no crash, no double state update.

**Abort handle cleanup:** `completeJob` must also delete the abort handle from the map (`abortHandles.current.delete(id)`). This prevents memory leaks when jobs finish normally (not via cancel).

**`beforeunload` listener** added via `useEffect`. Only registers the listener when there are active uploads — deregisters automatically when all uploads finish:
```ts
useEffect(() => {
  const hasActive = jobs.some(j => j.status === 'uploading')
  if (!hasActive) return

  const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
  window.addEventListener('beforeunload', handler)
  return () => window.removeEventListener('beforeunload', handler)
}, [jobs])
```

---

#### 3. `PujadesPanel` — cancel button per active job

**File:** `frontend/components/Pujades/PujadesPanel.tsx`

Add `cancelJob` to the `useUploadContext()` destructuring.

In the `job.status === 'uploading'` block, add a cancel button (`✕`) next to the progress bar. Clicking it calls `cancelJob(job.id)`.

Button only visible for active jobs — not in history tab.

---

#### 4. Call-sites — adopt new `uploadMedia` API

**Files:**
- `frontend/components/Library/SonilabLibraryView.tsx` — **has two internal upload call-sites** (main upload flow ~line 327, and the post-tentative-duplicate confirmation flow ~line 391). Both must be updated.
- `frontend/components/Projects/CreateProjectModal.tsx`

All call-sites follow the same updated pattern:
```ts
addJob(jobId, file.name)
const { promise, abort } = api.uploadMedia(file, (pct) => updateJob(jobId, pct), parentId)
registerAbort(jobId, abort)
try {
  const result = await promise
  completeJob(jobId, true)
  // ... handle result
} catch (err) {
  // err is `unknown` in strict TypeScript — cast safely
  const msg = err instanceof Error ? err.message : String(err)
  completeJob(jobId, false, msg) // covers both cancel and network error
}
```

Add `registerAbort` to `useUploadContext()` destructuring in both files.

---

### Backend — 2 changes

#### 5. Temp folder in `media.controller.ts`

**File:** `backend_nest_mvp/src/modules/media/media.controller.ts`

**Multer destination changes from `STORAGE_ROOT/` to `STORAGE_ROOT/tmp/`:**
```ts
destination: (_req, _file, cb) => {
  // Must compute mediaRootAbs here — Multer runs this callback before
  // the upload() method body executes, so method-scope variables are unavailable.
  const mediaRoot = process.env.STORAGE_ROOT || process.env.MEDIA_ROOT || './media'
  const mediaRootAbs = path.isAbsolute(mediaRoot) ? mediaRoot : path.join(process.cwd(), mediaRoot)
  const tmpDir = path.join(mediaRootAbs, 'tmp')
  ensureDirSync(tmpDir)
  cb(null, tmpDir)
}
```

**After validation, before DB creation**, compute the final path and `relPathPosix`:
```ts
const finalFilename = path.basename(file.path) // nanoid name already assigned by Multer
const finalPath = path.join(mediaRootAbs, finalFilename)
const relPathPosix = finalFilename // flat storage, no subdirs → filename IS the relative path
```

**Order of operations (critical):**
1. Validate extension + mime (on failure: `unlinkSync(file.path)` from `tmp/`)
2. Calculate SHA-256 + check duplicate (on duplicate: `unlinkSync(file.path)` from `tmp/`)
3. Compute `finalPath` and `relPathPosix` from the intended final location (not from `tmp/`)
4. Create document in DB with `relPathPosix`
5. `fs.renameSync(file.path, finalPath)` — atomic on same filesystem (guaranteed: `tmp/` is a subdirectory of `STORAGE_ROOT/`)
6. If rename fails (edge case): delete the DB record + delete tmp file, throw error
7. Call `ensureWaveformCache(sha256, relPathPosix, mediaRootAbs)` — **must be after the rename**, since `ensureWaveformCache` resolves the file path using `relPathPosix` pointing to `STORAGE_ROOT/`, not `tmp/`

**Failure paths** (invalid extension, invalid mime, duplicate SHA-256) already call `fs.unlinkSync(file.path)` — they continue to do so, deleting from `tmp/` instead of `STORAGE_ROOT/`.

**Invariant after this change:** `STORAGE_ROOT/` contains only files with a corresponding document in the DB. Orphans are structurally impossible during normal operation.

---

#### 6. Startup cleanup of `tmp/`

**File:** `backend_nest_mvp/src/modules/media/media.controller.ts`

Added to the constructor, runs 3 seconds after startup (after waveform cleanup):
```ts
setTimeout(() => this.cleanOrphanTmpFiles(), 3000)
```

```ts
private cleanOrphanTmpFiles() {
  const mediaRoot = process.env.STORAGE_ROOT || process.env.MEDIA_ROOT || './media'
  const mediaRootAbs = path.isAbsolute(mediaRoot) ? mediaRoot : path.join(process.cwd(), mediaRoot)
  const tmpDir = path.join(mediaRootAbs, 'tmp')
  if (!fs.existsSync(tmpDir)) return

  const oneHourAgo = Date.now() - 60 * 60 * 1000
  for (const file of fs.readdirSync(tmpDir)) {
    const filePath = path.join(tmpDir, file)
    try {
      const stat = fs.statSync(filePath)
      if (stat.mtimeMs < oneHourAgo) {
        fs.unlinkSync(filePath)
        this.logger.log(`Cleaned orphan tmp file: ${file}`)
      }
    } catch { /* silently skip */ }
  }
}
```

Scope: **only `tmp/` directory**. Never touches `STORAGE_ROOT/` directly.
Threshold: 1 hour — safely above any realistic upload duration, safely below any "user notices the server was down" threshold.

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/services/api.ts` | `uploadMedia` returns `{ promise, abort }` |
| `frontend/context/Upload/UploadContext.tsx` | Add `registerAbort`, `cancelJob`, `beforeunload` listener |
| `frontend/components/Pujades/PujadesPanel.tsx` | Add cancel button per active job |
| `frontend/components/Library/SonilabLibraryView.tsx` | Adopt new `uploadMedia` API, add `registerAbort` |
| `frontend/components/Projects/CreateProjectModal.tsx` | Adopt new `uploadMedia` API, add `registerAbort` |
| `backend_nest_mvp/src/modules/media/media.controller.ts` | Temp folder for Multer, `fs.renameSync` after success, startup `tmp/` cleanup |

---

## Non-Goals

- No orphan scanner on `STORAGE_ROOT/` (not needed with temp folder).
- No `@nestjs/schedule` dependency (existing `setTimeout`/`setInterval` pattern is sufficient).
- No per-job retry mechanism.
- No UI changes beyond the cancel button (no progress speed, no ETA, no pause).
