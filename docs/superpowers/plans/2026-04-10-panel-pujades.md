# Panel de Pujades — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken fixed-position upload widget with a proper "Pujades" panel (modal overlay, same visual style as TasksIAPanel) driven by a shared UploadContext, fixing the stuck-at-100% bug and making uploads visible from any origin.

**Architecture:** A new `UploadContext` provided at `AuthedGate` level wraps `LibraryProvider`, making upload state accessible to both `SonilabLibraryView` and `CreateProjectModal`. `PujadesPanel` is rendered in `MainAppContent` alongside `TasksIAPanel`. The sidebar button in LibraryView triggers the panel via a new `onOpenPujades` prop.

**Tech Stack:** React 18 + TypeScript + Tailwind CSS. No external dependencies added — uses `crypto.randomUUID()` (native browser API) for job IDs.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/context/Upload/UploadContext.tsx` | Create | UploadJob type, provider, `useUploadContext` hook |
| `frontend/components/Pujades/PujadesPanel.tsx` | Create | Modal panel UI, mirrors TasksIAPanel visually |
| `frontend/App.tsx` | Modify | Add UploadProvider, `isPujadesOpen` state, `<PujadesPanel>`, `onOpenPujades` prop to LibraryView |
| `frontend/components/Library/SonilabLibraryView.tsx` | Modify | Remove old uploadProgress state, use context, fix catch bug, add Pujades button, remove widget |
| `frontend/components/Projects/CreateProjectModal.tsx` | Modify | Add context calls + progress callback to `handleUploadNewMedia` |

---

## Task 1: Create UploadContext

**Files:**
- Create: `frontend/context/Upload/UploadContext.tsx`

- [ ] **Step 1.1: Create the context file**

Create `frontend/context/Upload/UploadContext.tsx` with this exact content:

```tsx
import React, { createContext, useContext, useState } from 'react';

export interface UploadJob {
  id: string;
  name: string;
  pct: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

interface UploadContextValue {
  jobs: UploadJob[];
  addJob: (id: string, name: string) => void;
  updateJob: (id: string, pct: number) => void;
  completeJob: (id: string, success: boolean, error?: string) => void;
}

const UploadContext = createContext<UploadContextValue | null>(null);

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<UploadJob[]>([]);

  const addJob = (id: string, name: string) => {
    setJobs(prev => [...prev, {
      id,
      name,
      pct: 0,
      status: 'uploading',
      startedAt: new Date().toISOString(),
    }]);
  };

  const updateJob = (id: string, pct: number) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, pct } : j));
  };

  const completeJob = (id: string, success: boolean, error?: string) => {
    setJobs(prev => prev.map(j =>
      j.id === id
        ? { ...j, status: success ? 'done' : 'error', pct: success ? 100 : j.pct, finishedAt: new Date().toISOString(), ...(error ? { error } : {}) }
        : j
    ));
  };

  return (
    <UploadContext.Provider value={{ jobs, addJob, updateJob, completeJob }}>
      {children}
    </UploadContext.Provider>
  );
};

export const useUploadContext = (): UploadContextValue => {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error('useUploadContext must be used within UploadProvider');
  return ctx;
};
```

- [ ] **Step 1.2: Verify the file compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`

Expected: no errors related to `UploadContext.tsx`. (Other pre-existing errors are acceptable.)

- [ ] **Step 1.3: Commit**

```bash
git add frontend/context/Upload/UploadContext.tsx
git commit -m "feat(pujades): UploadContext amb addJob/updateJob/completeJob"
```

---

## Task 2: Create PujadesPanel

**Files:**
- Create: `frontend/components/Pujades/PujadesPanel.tsx`

- [ ] **Step 2.1: Create the panel component**

Create `frontend/components/Pujades/PujadesPanel.tsx` with this exact content:

```tsx
import React, { useState } from 'react';
import * as Icons from '../icons';
import { useUploadContext, UploadJob } from '../../context/Upload/UploadContext';

type TabFilter = 'active' | 'history';

interface PujadesPanelProps {
  onClose: () => void;
}

const PujadesPanel: React.FC<PujadesPanelProps> = ({ onClose }) => {
  const { jobs } = useUploadContext();
  const [tab, setTab] = useState<TabFilter>('active');

  const activeJobs = jobs.filter(j => j.status === 'uploading');
  const historyJobs = jobs.filter(j => j.status === 'done' || j.status === 'error');
  const displayJobs = tab === 'active' ? activeJobs : historyJobs;

  const statusLabel = (s: UploadJob['status']) => {
    switch (s) {
      case 'uploading': return 'Pujant';
      case 'done': return 'Completat';
      case 'error': return 'Error';
    }
  };

  const statusColor = (s: UploadJob['status']) => {
    switch (s) {
      case 'uploading': return 'animate-pulse pujades-uploading';
      case 'done': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'error': return 'bg-red-500/20 text-red-400 border-red-500/30';
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Ara mateix';
    if (diffMin < 60) return `Fa ${diffMin} min`;
    return d.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[500] p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <style>{`.pujades-uploading { background-color: var(--th-accent-muted); color: var(--th-accent-text); border-color: var(--th-focus-ring); }`}</style>
      <div
        className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
          <h4 className="font-bold text-xl text-white flex items-center gap-3">
            <Icons.Upload className="w-6 h-6" style={{ color: 'var(--th-accent-text)' }} />
            Pujades
          </h4>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-3xl leading-none transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700/50 bg-gray-900/30">
          <button
            onClick={() => setTab('active')}
            className={`flex-1 py-3 text-sm font-black uppercase tracking-widest transition-colors relative ${
              tab === 'active' ? '' : 'text-gray-500 hover:text-gray-300'
            }`}
            style={tab === 'active' ? { color: 'var(--th-accent-text)' } : undefined}
          >
            En curs
            {activeJobs.length > 0 && (
              <span
                className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold border"
                style={{ backgroundColor: 'var(--th-accent-muted)', color: 'var(--th-accent-text)', borderColor: 'var(--th-accent)' }}
              >
                {activeJobs.length}
              </span>
            )}
            {tab === 'active' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: 'var(--th-accent)' }} />
            )}
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex-1 py-3 text-sm font-black uppercase tracking-widest transition-colors relative ${
              tab === 'history' ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Historial
            {tab === 'history' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          {displayJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              {tab === 'active' ? (
                <>
                  <span className="text-4xl mb-3">📂</span>
                  <p className="text-sm font-bold">Cap pujada activa</p>
                  <p className="text-xs mt-1">Les pujades en curs apareixeran aquí</p>
                </>
              ) : (
                <>
                  <span className="text-4xl mb-3">📋</span>
                  <p className="text-sm font-bold">Historial buit</p>
                  <p className="text-xs mt-1">Les pujades completades es mostraran aquí</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {displayJobs.map(job => (
                <div
                  key={job.id}
                  className="p-4 bg-gray-900/60 rounded-xl border border-gray-700/50 hover:border-gray-600/60 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0 pr-3">
                      <h5 className="text-sm font-bold text-gray-100 truncate" title={job.name}>
                        {job.name}
                      </h5>
                      <span className="text-[10px] font-mono text-gray-500">
                        {formatTime(job.startedAt)}
                      </span>
                    </div>
                    <span
                      className={`flex-shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusColor(job.status)}`}
                    >
                      {statusLabel(job.status)}
                    </span>
                  </div>

                  {job.status === 'uploading' && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(job.pct, 2)}%`, backgroundColor: 'var(--th-accent)' }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-gray-500">Pujant...</span>
                        <span className="text-[10px] font-mono text-gray-400">{job.pct}%</span>
                      </div>
                    </div>
                  )}

                  {job.status === 'error' && job.error && (
                    <div className="mt-2 px-3 py-2 rounded-lg bg-red-900/20 border border-red-800/30">
                      <p className="text-[11px] text-red-300 break-words">{job.error}</p>
                    </div>
                  )}

                  {job.status === 'done' && job.finishedAt && (
                    <div className="mt-1 text-[10px] text-emerald-500/70">
                      Completat {formatTime(job.finishedAt)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-900/30 flex items-center justify-between text-[10px] text-gray-500">
          <span>
            {activeJobs.length > 0
              ? `${activeJobs.length} pujada${activeJobs.length > 1 ? 's' : ''} activa${activeJobs.length > 1 ? 's' : ''}`
              : 'Cap pujada activa'}
          </span>
          <span>{historyJobs.length} al historial</span>
        </div>
      </div>
    </div>
  );
};

export default PujadesPanel;
```

- [ ] **Step 2.2: Verify TypeScript**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -i "PujadesPanel\|UploadContext"`

Expected: no errors on these two files.

- [ ] **Step 2.3: Commit**

```bash
git add frontend/components/Pujades/PujadesPanel.tsx
git commit -m "feat(pujades): PujadesPanel component (mirrors TasksIAPanel)"
```

---

## Task 3: Update App.tsx

**Files:**
- Modify: `frontend/App.tsx`

Context for edits — current state of relevant lines:
- Line 35: `import TasksIAPanel, { JobRecord } from './components/TasksIA/TasksIAPanel';`
- Line 290: `  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);`
- Lines 645–653: `<LibraryView>` usage (inside `MainAppContent` return)
- Lines 691–695: `{isNotificationsOpen && <TasksIAPanel ... />}`
- Lines 1052–1061: `<LibraryProvider>` block inside `AuthedGate`

- [ ] **Step 3.1: Add imports**

In `frontend/App.tsx`, after line 35 (`import TasksIAPanel...`), add:

```tsx
import { UploadProvider } from './context/Upload/UploadContext';
import PujadesPanel from './components/Pujades/PujadesPanel';
```

- [ ] **Step 3.2: Add `isPujadesOpen` state in MainAppContent**

In `frontend/App.tsx`, find line 290:
```tsx
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
```

Replace with:
```tsx
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isPujadesOpen, setIsPujadesOpen] = useState(false);
```

- [ ] **Step 3.3: Add `onOpenPujades` prop to LibraryView**

In `frontend/App.tsx`, find lines 645–653:
```tsx
        <LibraryView 
            onOpenDocument={handleOpenDocument} 
            isCollapsed={isLibraryCollapsed} 
            setIsCollapsed={setIsLibraryCollapsed} 
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenNotifications={() => setIsNotificationsOpen(true)}
            page={page}
  onChangePage={(p) => { setPage(p); setOpenDocId(null); setOpenMode(null); setIsEditing(false); }}
        />
```

Replace with:
```tsx
        <LibraryView 
            onOpenDocument={handleOpenDocument} 
            isCollapsed={isLibraryCollapsed} 
            setIsCollapsed={setIsLibraryCollapsed} 
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenNotifications={() => setIsNotificationsOpen(true)}
            onOpenPujades={() => setIsPujadesOpen(true)}
            page={page}
  onChangePage={(p) => { setPage(p); setOpenDocId(null); setOpenMode(null); setIsEditing(false); }}
        />
```

- [ ] **Step 3.4: Add PujadesPanel render**

In `frontend/App.tsx`, find lines 691–695:
```tsx
      {isNotificationsOpen && (
        <TasksIAPanel
          onClose={() => setIsNotificationsOpen(false)}
          onTaskCompleted={handleTaskCompleted}
        />
      )}
```

Replace with:
```tsx
      {isNotificationsOpen && (
        <TasksIAPanel
          onClose={() => setIsNotificationsOpen(false)}
          onTaskCompleted={handleTaskCompleted}
        />
      )}

      {isPujadesOpen && (
        <PujadesPanel onClose={() => setIsPujadesOpen(false)} />
      )}
```

- [ ] **Step 3.5: Wrap LibraryProvider with UploadProvider in AuthedGate**

In `frontend/App.tsx`, find lines 1052–1061 in `AuthedGate`:
```tsx
      {(!USE_BACKEND || authed) && (
        <LibraryProvider>
          {route.view === 'script-view' && route.docId ? (
            <ScriptExternalView docId={route.docId} />
          ) : route.view === 'editor' && route.mode && route.docId ? (
            <EditorTabContent mode={route.mode} docId={route.docId} />
          ) : (
            <MainAppContent />
          )}
        </LibraryProvider>
      )}
```

Replace with:
```tsx
      {(!USE_BACKEND || authed) && (
        <UploadProvider>
          <LibraryProvider>
            {route.view === 'script-view' && route.docId ? (
              <ScriptExternalView docId={route.docId} />
            ) : route.view === 'editor' && route.mode && route.docId ? (
              <EditorTabContent mode={route.mode} docId={route.docId} />
            ) : (
              <MainAppContent />
            )}
          </LibraryProvider>
        </UploadProvider>
      )}
```

- [ ] **Step 3.6: Verify TypeScript**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -i "App.tsx"`

Expected: no new errors in `App.tsx`.

- [ ] **Step 3.7: Commit**

```bash
git add frontend/App.tsx
git commit -m "feat(pujades): App.tsx — UploadProvider, isPujadesOpen, PujadesPanel"
```

---

## Task 4: Update SonilabLibraryView.tsx

**Files:**
- Modify: `frontend/components/Library/SonilabLibraryView.tsx`

This task has the most changes. Do them in order to avoid leaving the file in a broken state.

- [ ] **Step 4.1: Add import for useUploadContext**

In `frontend/components/Library/SonilabLibraryView.tsx`, find line 19:
```tsx
import { useAuth } from '../../context/Auth/AuthContext';
```

Replace with:
```tsx
import { useAuth } from '../../context/Auth/AuthContext';
import { useUploadContext } from '../../context/Upload/UploadContext';
```

- [ ] **Step 4.2: Add `onOpenPujades` to LibraryViewProps interface**

Find lines 24–30:
```tsx
interface LibraryViewProps {
  onOpenDocument: (docId: string, mode: OpenMode, editingMode: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
  onOpenSettings: () => void;
  onOpenNotifications: () => void;
}
```

Replace with:
```tsx
interface LibraryViewProps {
  onOpenDocument: (docId: string, mode: OpenMode, editingMode: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
  onOpenSettings: () => void;
  onOpenNotifications: () => void;
  onOpenPujades: () => void;
}
```

- [ ] **Step 4.3: Destructure `onOpenPujades` from props**

Find lines 63–69:
```tsx
export const LibraryView: React.FC<LibraryViewProps> = ({
  onOpenDocument,
  isCollapsed,
  setIsCollapsed,
  onOpenSettings,
  onOpenNotifications,
}) => {
```

Replace with:
```tsx
export const LibraryView: React.FC<LibraryViewProps> = ({
  onOpenDocument,
  isCollapsed,
  setIsCollapsed,
  onOpenSettings,
  onOpenNotifications,
  onOpenPujades,
}) => {
```

- [ ] **Step 4.4: Replace `uploadProgress` state with `useUploadContext`**

Find line 91:
```tsx
  const [uploadProgress, setUploadProgress] = useState<{ name: string; pct: number } | null>(null);
```

Replace with:
```tsx
  const { addJob, updateJob, completeJob } = useUploadContext();
```

- [ ] **Step 4.5: Fix `handleSingleFileUpload` — hoist job ID, replace progress calls, fix catch bug**

This step makes three coordinated changes to `handleSingleFileUpload`. Do them together in one edit pass.

**Change A** — add `let _uploadJobId` before `if (useBackend)` so the catch block can reach it.

Find lines 275–276:
```tsx
     if (useBackend) {
  if (['mp4', 'wav', 'mov', 'webm', 'ogg', 'mp3', 'm4a'].includes(ext || '')) {
```

Replace with:
```tsx
     let _uploadJobId: string | undefined;
     if (useBackend) {
  if (['mp4', 'wav', 'mov', 'webm', 'ogg', 'mp3', 'm4a'].includes(ext || '')) {
```

**Change B** — replace the `} else {` upload branch (lines 294–319) to use `_uploadJobId`:

Find:
```tsx
    } else {
      // No probable match — proceed with normal upload
      setUploadProgress({ name: file.name, pct: 0 });

      const uploadResult = await api.uploadMedia(file, (pct) => {
        setUploadProgress({ name: file.name, pct });
      }, null);

      setUploadProgress(null);

      if (uploadResult.duplicated) {
        // Backend confirmed real duplicate by SHA-256
        const existingDoc = uploadResult.document;
        const pathParts: string[] = [];
        let pid: string | null = existingDoc.parentId ?? null;
        while (pid) {
          const folder = state.folders.find(f => f.id === pid);
          if (!folder) break;
          pathParts.unshift(folder.name);
          pid = folder.parentId ?? null;
        }
        const folderPath = pathParts.length > 0 ? pathParts.join(' / ') : 'Arrel';
        setDuplicateNotice({ fileName: file.name, existingName: existingDoc.name, existingDocId: existingDoc.id || existingDoc._id, folderPath, file, targetParentId: null });
      } else {
        await reloadTree();
      }
    }
```

Replace with:
```tsx
    } else {
      // No probable match — proceed with normal upload
      _uploadJobId = crypto.randomUUID();
      addJob(_uploadJobId, file.name);

      const uploadResult = await api.uploadMedia(file, (pct) => {
        updateJob(_uploadJobId!, pct);
      }, null);

      completeJob(_uploadJobId, true);
      _uploadJobId = undefined;

      if (uploadResult.duplicated) {
        // Backend confirmed real duplicate by SHA-256
        const existingDoc = uploadResult.document;
        const pathParts: string[] = [];
        let pid: string | null = existingDoc.parentId ?? null;
        while (pid) {
          const folder = state.folders.find(f => f.id === pid);
          if (!folder) break;
          pathParts.unshift(folder.name);
          pid = folder.parentId ?? null;
        }
        const folderPath = pathParts.length > 0 ? pathParts.join(' / ') : 'Arrel';
        setDuplicateNotice({ fileName: file.name, existingName: existingDoc.name, existingDocId: existingDoc.id || existingDoc._id, folderPath, file, targetParentId: null });
      } else {
        await reloadTree();
      }
    }
```

**Change C** — fix the catch block (the stuck-at-100% bug). Find lines 345–348:
```tsx
    } catch (error) {
      console.error(`Error important arxiu ${file.name}:`, error);
      setUploadBlockError(`Error important ${file.name}: ${(error as any)?.message || 'error desconegut'}`);
    }
```

Replace with:
```tsx
    } catch (error) {
      if (_uploadJobId) completeJob(_uploadJobId, false, (error as any)?.message || 'error desconegut');
      console.error(`Error important arxiu ${file.name}:`, error);
      setUploadBlockError(`Error important ${file.name}: ${(error as any)?.message || 'error desconegut'}`);
    }
```

- [ ] **Step 4.6: Replace `handleContinueUpload` body**

Find lines 351–383:
```tsx
  const handleContinueUpload = async () => {
    if (!duplicateNotice) return;
    const { file, targetParentId } = duplicateNotice;
    const savedNotice = duplicateNotice; // snapshot for error recovery
    // Close modal — progress bar takes over during upload
    setDuplicateNotice(null);
    try {
      setUploadProgress({ name: file.name, pct: 0 });
      const uploadResult = await api.uploadMedia(file, (pct) => setUploadProgress({ name: file.name, pct }), targetParentId);
      setUploadProgress(null);
      if (uploadResult.duplicated) {
        // Backend confirmed real duplicate by SHA-256 — show definitive modal (no tentative)
        const existingDoc = uploadResult.document;
        const pathParts: string[] = [];
        let pid: string | null = existingDoc.parentId ?? null;
        while (pid) {
          const folder = state.folders.find(f => f.id === pid);
          if (!folder) break;
          pathParts.unshift(folder.name);
          pid = folder.parentId ?? null;
        }
        const folderPath = pathParts.length > 0 ? pathParts.join(' / ') : 'Arrel';
        setDuplicateNotice({ fileName: file.name, existingName: existingDoc.name, existingDocId: existingDoc.id || existingDoc._id, folderPath, file, targetParentId: null });
      } else {
        await reloadTree();
      }
    } catch (err) {
      setUploadProgress(null);
      console.error('Error en continue upload:', err);
      // Restore modal with error so user doesn't lose context silently
      setDuplicateNotice(savedNotice);
    }
  };
```

Replace with:
```tsx
  const handleContinueUpload = async () => {
    if (!duplicateNotice) return;
    const { file, targetParentId } = duplicateNotice;
    const savedNotice = duplicateNotice; // snapshot for error recovery
    // Close modal — panel takes over during upload
    setDuplicateNotice(null);
    const jobId = crypto.randomUUID();
    addJob(jobId, file.name);
    try {
      const uploadResult = await api.uploadMedia(file, (pct) => updateJob(jobId, pct), targetParentId);
      completeJob(jobId, true);
      if (uploadResult.duplicated) {
        // Backend confirmed real duplicate by SHA-256 — show definitive modal (no tentative)
        const existingDoc = uploadResult.document;
        const pathParts: string[] = [];
        let pid: string | null = existingDoc.parentId ?? null;
        while (pid) {
          const folder = state.folders.find(f => f.id === pid);
          if (!folder) break;
          pathParts.unshift(folder.name);
          pid = folder.parentId ?? null;
        }
        const folderPath = pathParts.length > 0 ? pathParts.join(' / ') : 'Arrel';
        setDuplicateNotice({ fileName: file.name, existingName: existingDoc.name, existingDocId: existingDoc.id || existingDoc._id, folderPath, file, targetParentId: null });
      } else {
        await reloadTree();
      }
    } catch (err) {
      completeJob(jobId, false, (err as any)?.message || 'error desconegut');
      console.error('Error en continue upload:', err);
      // Restore modal with error so user doesn't lose context silently
      setDuplicateNotice(savedNotice);
    }
  };
```

- [ ] **Step 4.7: Add Pujades button in sidebar**

Find lines 1054–1059:
```tsx
      <div className={`flex-shrink-0 mt-4 pt-4 space-y-3 ${!isCollapsed ? 'mx-2' : 'flex flex-col items-center'}`} style={!isCollapsed ? { borderTop: '1px solid var(--th-border)' } : undefined}>
        <button onClick={onOpenNotifications} className={`rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${isCollapsed ? 'w-10 h-10 justify-center p-0' : 'px-3 py-2 w-full'} text-gray-200 hover:brightness-125 relative`} style={{ backgroundColor: 'var(--th-bg-tertiary)' }} title="Notificacions">
          <Icons.Bell className={isCollapsed ? 'w-5 h-5' : 'w-5 h-5'} />
          <span className={isCollapsed ? 'hidden' : 'inline'}>Tasques IA</span>
          {activeTasksCount > 0 && <span className={`absolute -top-1 -right-1 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-2 ring-gray-900 ${isCollapsed ? 'scale-75' : ''}`} style={{ backgroundColor: 'var(--th-accent)' }}>{activeTasksCount}</span>}
        </button>
```

Replace with:
```tsx
      <div className={`flex-shrink-0 mt-4 pt-4 space-y-3 ${!isCollapsed ? 'mx-2' : 'flex flex-col items-center'}`} style={!isCollapsed ? { borderTop: '1px solid var(--th-border)' } : undefined}>
        <button onClick={onOpenNotifications} className={`rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${isCollapsed ? 'w-10 h-10 justify-center p-0' : 'px-3 py-2 w-full'} text-gray-200 hover:brightness-125 relative`} style={{ backgroundColor: 'var(--th-bg-tertiary)' }} title="Notificacions">
          <Icons.Bell className={isCollapsed ? 'w-5 h-5' : 'w-5 h-5'} />
          <span className={isCollapsed ? 'hidden' : 'inline'}>Tasques IA</span>
          {activeTasksCount > 0 && <span className={`absolute -top-1 -right-1 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-2 ring-gray-900 ${isCollapsed ? 'scale-75' : ''}`} style={{ backgroundColor: 'var(--th-accent)' }}>{activeTasksCount}</span>}
        </button>
        <PujadesButton isCollapsed={isCollapsed} onOpen={onOpenPujades} />
```

Note: `PujadesButton` is a small helper defined just below. Add this component right before the `export const LibraryView` line (before line 63):

```tsx
const PujadesButton: React.FC<{ isCollapsed: boolean; onOpen: () => void }> = ({ isCollapsed, onOpen }) => {
  const { jobs } = useUploadContext();
  const activeCount = jobs.filter(j => j.status === 'uploading').length;
  return (
    <button
      onClick={onOpen}
      className={`rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${isCollapsed ? 'w-10 h-10 justify-center p-0' : 'px-3 py-2 w-full'} text-gray-200 hover:brightness-125 relative`}
      style={{ backgroundColor: 'var(--th-bg-tertiary)' }}
      title="Pujades"
    >
      <Icons.Upload className="w-5 h-5" />
      <span className={isCollapsed ? 'hidden' : 'inline'}>Pujades</span>
      {activeCount > 0 && (
        <span
          className={`absolute -top-1 -right-1 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-2 ring-gray-900 ${isCollapsed ? 'scale-75' : ''}`}
          style={{ backgroundColor: 'var(--th-accent)' }}
        >
          {activeCount}
        </span>
      )}
    </button>
  );
};
```

- [ ] **Step 4.8: Remove the old uploadProgress widget**

Find lines 1129–1138:
```tsx
{uploadProgress && (
  <div className="fixed bottom-4 left-4 z-[600] text-gray-100 px-4 py-3 rounded-xl shadow-xl" style={{ backgroundColor: 'var(--th-bg-surface)', border: '1px solid var(--th-border)' }}>
    <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--th-text-muted)' }}>Upload</div>
    <div className="text-sm font-semibold truncate max-w-[320px]">{uploadProgress.name}</div>
    <div className="mt-2 h-2 w-80 rounded overflow-hidden" style={{ backgroundColor: 'var(--th-bg-tertiary)' }}>
      <div className="h-2" style={{ width: `${uploadProgress.pct}%`, backgroundColor: 'var(--th-accent)' }} />
    </div>
    <div className="mt-1 text-xs text-gray-300">{uploadProgress.pct}%</div>
  </div>
)}
```

Delete these 9 lines entirely (replace with nothing).

- [ ] **Step 4.9: Verify TypeScript**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -i "SonilabLibraryView"`

Expected: no errors.

- [ ] **Step 4.10: Commit**

```bash
git add frontend/components/Library/SonilabLibraryView.tsx
git commit -m "feat(pujades): LibraryView usa UploadContext, elimina widget vell, afegeix botó Pujades"
```

---

## Task 5: Update CreateProjectModal.tsx

**Files:**
- Modify: `frontend/components/Projects/CreateProjectModal.tsx`

- [ ] **Step 5.1: Add import for useUploadContext**

In `frontend/components/Projects/CreateProjectModal.tsx`, find line 3:
```tsx
import { useLibrary } from '../../context/Library/SonilabLibraryContext';
```

Replace with:
```tsx
import { useLibrary } from '../../context/Library/SonilabLibraryContext';
import { useUploadContext } from '../../context/Upload/UploadContext';
```

- [ ] **Step 5.2: Consume the context inside the component**

Find the component that contains `handleUploadNewMedia`. Look for the line that defines the component's top-level hooks (near `useLibrary`, `useState`, etc.) and add:

```tsx
  const { addJob, updateJob, completeJob } = useUploadContext();
```

Place it right after the existing `const { ... } = useLibrary();` call.

- [ ] **Step 5.3: Replace `handleUploadNewMedia`**

Find lines 295–310:
```tsx
  const handleUploadNewMedia = (file: File) => {
    void (async () => {
      setErr(null);
      setBusy(true);
      try {
        const r = await api.uploadMedia(file);
        const newId = r?.document?.id;
        await reloadTree();
        if (newId) setMediaId(newId);
      } catch (e: any) {
        setErr(e?.message || 'Error subiendo vídeo');
      } finally {
        setBusy(false);
      }
    })();
  };
```

Replace with:
```tsx
  const handleUploadNewMedia = (file: File) => {
    void (async () => {
      setErr(null);
      setBusy(true);
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
    })();
  };
```

- [ ] **Step 5.4: Verify TypeScript**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -i "CreateProjectModal"`

Expected: no errors.

- [ ] **Step 5.5: Commit**

```bash
git add frontend/components/Projects/CreateProjectModal.tsx
git commit -m "feat(pujades): CreateProjectModal reporta progrés via UploadContext"
```

---

## Task 6: Final verification

- [ ] **Step 6.1: Full TypeScript check**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -v node_modules | head -30`

Expected: no new errors compared to pre-implementation baseline. (Pre-existing errors from other files are acceptable.)

- [ ] **Step 6.2: Manual smoke test — pujada des de Media**

1. Obre l'app al navegador
2. Ves a la pestanya **Media**
3. Arrossega un fitxer de vídeo per pujar-lo
4. Comprova que el widget vell (`fixed bottom-4 left-4`) **no apareix**
5. Comprova que el botó **"Pujades"** a la barra lateral mostra un badge amb el número `1`
6. Fes clic al botó "Pujades" → s'obre el panell modal
7. Ves a la pestanya "En curs" → veus la barra de progrés del fitxer en curs
8. Quan finalitza → el badge desapareix, la pestanya "Historial" mostra el fitxer amb estat "Completat"

- [ ] **Step 6.3: Manual smoke test — pujada des de CreateProjectModal**

1. Crea un projecte nou amb un vídeo nou (opció "Pujar nou vídeo")
2. Comprova que el panell "Pujades" reflecteix la pujada en curs
3. Comprova que l'error anterior (stuck at 100%) no es reprodueix si el servidor retorna un error

- [ ] **Step 6.4: Manual smoke test — error de xarxa**

1. Amb les DevTools del navegador, activa el mode offline (Network → Offline)
2. Intenta pujar un fitxer des de Media
3. Comprova que al panell "Pujades" apareix l'estat **"Error"** en vermell (no queda penjat al `100%`)
4. Comprova que el toast d'error (`uploadBlockError`) continua funcionant

- [ ] **Step 6.5: Final commit**

```bash
git add -A
git commit -m "feat(pujades): implementació completa Panel de Pujades"
```
