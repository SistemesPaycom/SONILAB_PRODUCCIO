# Upload Interruption Handling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `beforeunload` warning + per-job cancel button on frontend, and make the backend robust against orphan files by routing uploads through a temp folder.

**Architecture:** Frontend exposes an `abort()` handle from `uploadMedia`, stores it in `UploadContext`, and lets `PujadesPanel` trigger cancellation per job. Backend writes uploads to `STORAGE_ROOT/tmp/` via Multer and `fs.renameSync`s to the final location only after DB creation succeeds; a startup routine cleans any stale tmp files left by server crashes.

**Tech Stack:** React + TypeScript (frontend), NestJS + Express + Multer (backend). No new dependencies required.

**Spec:** `docs/superpowers/specs/2026-04-14-upload-interruption-handling-design.md`

---

## File Structure

| File | Change |
|------|--------|
| `frontend/services/api.ts` | `uploadMedia` returns `{ promise, abort }`, drop `async`, add `xhr.onabort` |
| `frontend/context/Upload/UploadContext.tsx` | Add `abortHandles` ref, `registerAbort`, `cancelJob`, `beforeunload` effect, update `completeJob` |
| `frontend/components/Pujades/PujadesPanel.tsx` | Add cancel button (✕) per active job row |
| `frontend/components/Library/SonilabLibraryView.tsx` | Update 2 internal upload call-sites |
| `frontend/components/Projects/CreateProjectModal.tsx` | Update 1 upload call-site |
| `backend_nest_mvp/src/modules/media/media.controller.ts` | Multer dest → `tmp/`, rename after DB creation, startup cleanup |

---

## Task 1: `api.uploadMedia` — expose `{ promise, abort }`

**Files:**
- Modify: `frontend/services/api.ts:190-240`

- [ ] **Step 1: Replace `uploadMedia` implementation**

Replace the entire `uploadMedia` function (currently `async`, returns `Promise`). The new version is synchronous, returns `{ promise, abort }`, and adds `xhr.onabort`:

```ts
 uploadMedia(file: File, onProgress?: (pct: number) => void, parentId?: string | null): { promise: Promise<{ document: any; duplicated?: boolean }>, abort: () => void } {
  const token = getToken();

  const fd = new FormData();
  fd.append('file', file);
  if (parentId) fd.append('parentId', parentId);

  const xhr = new XMLHttpRequest();

  const promise = new Promise<{ document: any; duplicated?: boolean }>((resolve, reject) => {
    xhr.open('POST', `${API_URL}/media/upload`, true);

    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 100);
      onProgress?.(pct);
    };

    xhr.onerror = () => reject(new Error('Upload failed (network error)'));
    xhr.onabort = () => reject(new Error('Cancel·lat'));

    xhr.onload = () => {
      const ok = xhr.status >= 200 && xhr.status < 300;
      if (!ok) {
        try {
          const data = JSON.parse(xhr.responseText || '{}');
          const msg = data?.message
            ? (Array.isArray(data.message) ? data.message.join(', ') : data.message)
            : `HTTP ${xhr.status}`;
          if (xhr.status === 401) {
            setToken(null);
            window.dispatchEvent(new Event('AUTH_REQUIRED'));
          }
          reject(new Error(msg));
        } catch {
          reject(new Error(`HTTP ${xhr.status}`));
        }
        return;
      }

      try {
        const data = JSON.parse(xhr.responseText);
        resolve(data);
      } catch {
        reject(new Error('Invalid JSON response from upload'));
      }
    };

    xhr.send(fd);
  });

  return { promise, abort: () => xhr.abort() };
},
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors related to `uploadMedia`.

---

## Task 2: `UploadContext` — abort registry + `cancelJob` + `beforeunload`

**Files:**
- Modify: `frontend/context/Upload/UploadContext.tsx`

- [ ] **Step 1: Add `registerAbort` and `cancelJob` to the interface**

Replace the `UploadContextValue` interface:

```ts
interface UploadContextValue {
  jobs: UploadJob[];
  addJob: (id: string, name: string) => void;
  updateJob: (id: string, pct: number) => void;
  completeJob: (id: string, success: boolean, error?: string) => void;
  clearHistory: () => void;
  registerAbort: (id: string, abortFn: () => void) => void;
  cancelJob: (id: string) => void;
}
```

- [ ] **Step 2: Add `abortHandles` ref inside `UploadProvider`**

Add after the `useState` call (line ~27), before the first `useEffect`:

```ts
const abortHandles = useRef<Map<string, () => void>>(new Map());
```

The import of `useRef` must be added to the React import at the top of the file:

```ts
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
```

- [ ] **Step 3: Add `beforeunload` effect**

Add a new `useEffect` after the existing localStorage sync effect (after line ~49):

```ts
useEffect(() => {
  const hasActive = jobs.some(j => j.status === 'uploading');
  if (!hasActive) return;

  const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}, [jobs]);
```

- [ ] **Step 4: Update `completeJob` to clean up the abort handle**

Replace the existing `completeJob` function:

```ts
const completeJob = (id: string, success: boolean, error?: string) => {
  abortHandles.current.delete(id);
  setJobs(prev => prev.map(j =>
    j.id === id
      ? { ...j, status: success ? 'done' : 'error', pct: success ? 100 : j.pct, finishedAt: new Date().toISOString(), ...(error ? { error } : {}) }
      : j
  ));
};
```

- [ ] **Step 5: Add `registerAbort` and `cancelJob` functions**

Add after `clearHistory`:

```ts
const registerAbort = (id: string, abortFn: () => void) => {
  abortHandles.current.set(id, abortFn);
};

const cancelJob = (id: string) => {
  const abortFn = abortHandles.current.get(id);
  if (!abortFn) return; // no-op: job already completed
  abortHandles.current.delete(id);
  abortFn();
};
```

- [ ] **Step 6: Add new functions to the Provider value**

Replace the `<UploadContext.Provider value={...}>` line:

```tsx
return (
  <UploadContext.Provider value={{ jobs, addJob, updateJob, completeJob, clearHistory, registerAbort, cancelJob }}>
    {children}
  </UploadContext.Provider>
);
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors related to `UploadContext`.

---

## Task 3: `PujadesPanel` — cancel button per active job

**Files:**
- Modify: `frontend/components/Pujades/PujadesPanel.tsx`

- [ ] **Step 1: Add `cancelJob` to the destructuring**

Replace line 12:

```ts
const { jobs, clearHistory } = useUploadContext();
```

With:

```ts
const { jobs, clearHistory, cancelJob } = useUploadContext();
```

- [ ] **Step 2: Add cancel button inside the uploading block**

Find the block starting at line ~156 (`{job.status === 'uploading' && (`). Replace the entire uploading status block with:

```tsx
{job.status === 'uploading' && (
  <div className="mt-2">
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.max(job.pct, 2)}%`, backgroundColor: 'var(--th-accent)' }}
        />
      </div>
      <button
        onClick={() => cancelJob(job.id)}
        className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-colors text-xs font-bold"
        title="Cancel·lar pujada"
      >
        ✕
      </button>
    </div>
    <div className="flex justify-between mt-1">
      <span className="text-[10px] text-gray-500">Pujant...</span>
      <span className="text-[10px] font-mono text-gray-400">{job.pct}%</span>
    </div>
  </div>
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual verification — cancel button visible**

Start the frontend dev server and open the Media tab. Upload a large file. Open the Pujades panel. Confirm a small `✕` button appears next to the progress bar for the active job. Clicking it should stop the upload and show the job as error with message "Cancel·lat".

---

## Task 4: `SonilabLibraryView` — update 2 upload call-sites

**Files:**
- Modify: `frontend/components/Library/SonilabLibraryView.tsx`

- [ ] **Step 1: Add `registerAbort` to `useUploadContext()` destructuring**

Find line ~121:
```ts
const { addJob, updateJob, completeJob } = useUploadContext();
```

Replace with:
```ts
const { addJob, updateJob, completeJob, registerAbort } = useUploadContext();
```

- [ ] **Step 2: Update call-site 1 (main upload flow, ~line 327)**

Find this block:
```ts
_uploadJobId = crypto.randomUUID();
addJob(_uploadJobId, file.name);

const uploadResult = await api.uploadMedia(file, (pct) => {
  updateJob(_uploadJobId!, pct);
}, null);

completeJob(_uploadJobId, true);
_uploadJobId = undefined;
```

Replace with:
```ts
_uploadJobId = crypto.randomUUID();
addJob(_uploadJobId, file.name);

const { promise: uploadPromise, abort: uploadAbort } = api.uploadMedia(file, (pct) => {
  updateJob(_uploadJobId!, pct);
}, null);
registerAbort(_uploadJobId, uploadAbort);

const uploadResult = await uploadPromise;

completeJob(_uploadJobId, true);
_uploadJobId = undefined;
```

- [ ] **Step 3: Update call-site 2 (`handleContinueUpload`, ~line 391)**

Find this block:
```ts
const jobId = crypto.randomUUID();
addJob(jobId, file.name);
try {
  const uploadResult = await api.uploadMedia(file, (pct) => updateJob(jobId, pct), targetParentId);
  completeJob(jobId, true);
```

Replace with:
```ts
const jobId = crypto.randomUUID();
addJob(jobId, file.name);
try {
  const { promise: uploadPromise, abort: uploadAbort } = api.uploadMedia(file, (pct) => updateJob(jobId, pct), targetParentId);
  registerAbort(jobId, uploadAbort);
  const uploadResult = await uploadPromise;
  completeJob(jobId, true);
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

---

## Task 5: `CreateProjectModal` — update upload call-site

**Files:**
- Modify: `frontend/components/Projects/CreateProjectModal.tsx:42,301-314`

- [ ] **Step 1: Add `registerAbort` to `useUploadContext()` destructuring**

Find line ~42:
```ts
const { addJob, updateJob, completeJob } = useUploadContext();
```

Replace with:
```ts
const { addJob, updateJob, completeJob, registerAbort } = useUploadContext();
```

- [ ] **Step 2: Update the upload call-site (~line 301)**

Find this block:
```ts
const jobId = crypto.randomUUID();
addJob(jobId, file.name);
try {
  const r = await api.uploadMedia(file, (pct) => updateJob(jobId, pct));
  completeJob(jobId, true);
  const newId = r?.document?.id;
  await reloadTree();
  if (newId) setMediaId(newId);
} catch (e: any) {
  completeJob(jobId, false, e?.message || 'Error subiendo vídeo');
  setErr(e?.message || 'Error subiendo vídeo');
} finally {
  setBusy(false);
}
```

Replace with:
```ts
const jobId = crypto.randomUUID();
addJob(jobId, file.name);
try {
  const { promise: uploadPromise, abort: uploadAbort } = api.uploadMedia(file, (pct) => updateJob(jobId, pct));
  registerAbort(jobId, uploadAbort);
  const r = await uploadPromise;
  completeJob(jobId, true);
  const newId = r?.document?.id;
  await reloadTree();
  if (newId) setMediaId(newId);
} catch (e: any) {
  completeJob(jobId, false, e?.message || 'Error subiendo vídeo');
  setErr(e?.message || 'Error subiendo vídeo');
} finally {
  setBusy(false);
}
```

- [ ] **Step 3: Final frontend TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: zero errors. This is the full frontend integration checkpoint.

- [ ] **Step 4: Manual verification — `beforeunload`**

Start dev server. Begin uploading a large file. While the upload is active (progress bar visible), press F5. The browser must show a native "Are you sure you want to leave?" dialog. Click "Cancel" — the upload continues. Click "Leave" — the page reloads and the job appears as "Subida interrompuda" in the history.

---

## Task 6: Backend — temp folder, rename after success, startup cleanup

**Files:**
- Modify: `backend_nest_mvp/src/modules/media/media.controller.ts`

- [ ] **Step 1: Change Multer `destination` to write to `STORAGE_ROOT/tmp/`**

Find the `destination` callback inside `FileInterceptor` (~line 109):

```ts
destination: (_req, _file, cb) => {
  const mediaRoot = process.env.STORAGE_ROOT || process.env.MEDIA_ROOT || './media';
  const dest = path.isAbsolute(mediaRoot) ? mediaRoot : path.join(process.cwd(), mediaRoot);
  ensureDirSync(dest);
  cb(null, dest);
},
```

Replace with:

```ts
destination: (_req, _file, cb) => {
  // Must compute mediaRootAbs here — Multer runs this callback before
  // the upload() method body executes, so method-scope variables are unavailable.
  const mediaRoot = process.env.STORAGE_ROOT || process.env.MEDIA_ROOT || './media';
  const mediaRootAbs = path.isAbsolute(mediaRoot) ? mediaRoot : path.join(process.cwd(), mediaRoot);
  const tmpDir = path.join(mediaRootAbs, 'tmp');
  ensureDirSync(tmpDir);
  cb(null, tmpDir);
},
```

- [ ] **Step 2: Rewrite the `upload()` method body**

Replace everything inside `async upload(...)` from `if (!file)` to `return { document: doc };` (lines 124–198) with:

```ts
if (!file) throw new BadRequestException('file is required');

const ext = extFromOriginalname(file.originalname);
const sourceType = sourceTypeFromExt(ext);
const mimeType = (mime.lookup(file.path) || file.mimetype || 'application/octet-stream') as string;
const mediaRoot = process.env.STORAGE_ROOT || process.env.MEDIA_ROOT || './media';
const mediaRootAbs = path.isAbsolute(mediaRoot) ? mediaRoot : path.join(process.cwd(), mediaRoot);

// 1. Validate extension
const allowedExt = new Set(['mp4', 'mov', 'm4v', 'mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg']);
const extClean = ext.replace('.', '').toLowerCase();
if (!allowedExt.has(extClean)) {
  try { fs.unlinkSync(file.path); } catch {}
  throw new BadRequestException(`Unsupported file extension: .${extClean}`);
}

// 2. Validate mime type
const allowedMime = new Set([
  'video/mp4',
  'video/quicktime',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/vnd.wave',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/aac',
  'audio/flac',
  'audio/ogg',
]);
if (!allowedMime.has(mimeType)) {
  try { fs.unlinkSync(file.path); } catch {}
  throw new BadRequestException(`Unsupported mime type: ${mimeType}`);
}

// 3. SHA-256 + duplicate check
const sha256 = await sha256File(file.path);
const existing = await this.library.findMediaBySha256(user.userId, sha256, file.size);
if (existing) {
  try { fs.unlinkSync(file.path); } catch {}
  if (existing.media?.sha256 && existing.media?.path) {
    this.ensureWaveformCache(existing.media.sha256, existing.media.path, mediaRootAbs);
  }
  return { document: existing, duplicated: true };
}

// 4. Compute final path (flat storage: nanoid filename IS the relative path)
const finalFilename = path.basename(file.path);
const finalPath = path.join(mediaRootAbs, finalFilename);
const relPathPosix = finalFilename;

// 5. Create DB record with the final path
const doc = await this.library.createDocument(user.userId, {
  name: file.originalname,
  parentId: parentId || null,
  sourceType,
  media: {
    storage: 'local',
    path: relPathPosix,
    mimeType,
    size: file.size,
    sha256,
  },
});

// 6. Move file from tmp/ to STORAGE_ROOT/ (atomic on same filesystem)
try {
  fs.renameSync(file.path, finalPath);
} catch (renameErr) {
  // Edge case: rename failed — roll back DB record and clean up tmp file
  try { await this.library.updateDocument(user.userId, doc.id, { isDeleted: true } as any); } catch {}
  try { fs.unlinkSync(file.path); } catch {}
  throw new BadRequestException('Failed to move uploaded file to storage');
}

// 7. Waveform cache — must run AFTER rename (file is now in STORAGE_ROOT/, not tmp/)
this.ensureWaveformCache(sha256, relPathPosix, mediaRootAbs);

return { document: doc };
```

- [ ] **Step 3: Add `cleanOrphanTmpFiles` private method**

Add this method after `ensureWaveformCache` (~line 223):

```ts
private cleanOrphanTmpFiles() {
  const mediaRoot = process.env.STORAGE_ROOT || process.env.MEDIA_ROOT || './media';
  const mediaRootAbs = path.isAbsolute(mediaRoot) ? mediaRoot : path.join(process.cwd(), mediaRoot);
  const tmpDir = path.join(mediaRootAbs, 'tmp');
  if (!fs.existsSync(tmpDir)) return;

  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const filename of fs.readdirSync(tmpDir)) {
    const filePath = path.join(tmpDir, filename);
    try {
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < oneHourAgo) {
        fs.unlinkSync(filePath);
        this.logger.log(`Cleaned orphan tmp file: ${filename}`);
      }
    } catch { /* silently skip */ }
  }
}
```

- [ ] **Step 4: Call `cleanOrphanTmpFiles` at startup**

In the constructor, after the existing `setTimeout(() => this.tryNightlyCleanup(), 5000)` line (~line 76), add:

```ts
// Clean up any tmp files left by previous server crashes
setTimeout(() => this.cleanOrphanTmpFiles(), 3000);
```

- [ ] **Step 5: Compile and start the backend**

```bash
cd backend_nest_mvp && npm run build
```

Expected: no TypeScript errors.

```bash
npm run start:dev
```

Expected: server starts, and in the logs you should see either "Cleaned orphan tmp file: ..." (if there are stale files) or nothing (clean start). No errors.

- [ ] **Step 6: Manual verification — temp folder flow**

1. Upload a valid media file through the UI.
2. While uploading, check that `STORAGE_ROOT/tmp/` receives the file (it will disappear when the upload finishes successfully).
3. After upload completes, verify:
   - `STORAGE_ROOT/` contains the file (flat, no subdirs).
   - `STORAGE_ROOT/tmp/` is empty.
   - The document appears in the Media tab.
4. Upload a second copy of the same file. Verify the SHA-256 duplicate is detected, the tmp file is deleted, and `{ duplicated: true }` is returned.

- [ ] **Step 7: Manual verification — interrupted upload cleanup**

1. Stop the backend mid-upload (kill the process). A partial file will be in `STORAGE_ROOT/tmp/`.
2. Manually set the modification time of that file to >1h ago (or temporarily lower the threshold to 1 minute for testing).
3. Restart the backend.
4. Confirm the log shows "Cleaned orphan tmp file: ..." and the file is gone from `tmp/`.

---

## Self-Review Checklist (Post-Plan)

### Spec coverage
- [x] `beforeunload` warning when uploads active → Task 2 Step 3
- [x] Cancel button per job in `PujadesPanel` → Task 3
- [x] `api.uploadMedia` returns `{ promise, abort }` → Task 1
- [x] `xhr.onabort` handler → Task 1 Step 1
- [x] `async` removed from `uploadMedia` → Task 1 Step 1
- [x] `registerAbort` + `cancelJob` in `UploadContext` → Task 2
- [x] `completeJob` cleans abort handle → Task 2 Step 4
- [x] `cancelJob` is no-op when handle missing → Task 2 Step 5
- [x] Both call-sites in `SonilabLibraryView` updated → Task 4 Steps 2–3
- [x] `CreateProjectModal` call-site updated → Task 5
- [x] Multer writes to `tmp/` → Task 6 Step 1
- [x] `relPathPosix` computed from final path → Task 6 Step 2
- [x] DB record created before rename → Task 6 Step 2
- [x] `fs.renameSync` after DB creation → Task 6 Step 2
- [x] `ensureWaveformCache` after rename → Task 6 Step 2
- [x] Rename failure cleans up DB + tmp → Task 6 Step 2
- [x] `cleanOrphanTmpFiles` on startup → Task 6 Steps 3–4
- [x] `tmp/` never touches `STORAGE_ROOT/` → by design (scoped to `tmpDir`)
- [x] `mediaRootAbs` computed inside Multer callback → Task 6 Step 1
