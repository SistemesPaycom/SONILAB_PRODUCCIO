import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useLibrary, LibraryProvider } from './context/Library/SonilabLibraryContext';
import { ViewType, SortByKey, SortOrder, OpenMode, Layout, EditorStyles, TranslationTask, TranscriptionTask } from './appTypes';
import { LibraryView } from './components/Library/SonilabLibraryView';
import { VideoEditorView } from './components/VideoEditor/VideoEditorView';
import { VideoSubtitlesEditorView } from './components/VideoSubtitlesEditor/VideoSubtitlesEditorView';
import { SsrtlsfEditorView } from './components/SsrtlsfEditor/SsrtlsfEditorView';
import { VideoSrtStandaloneEditorView } from './components/VideoSubtitlesEditor/VideoSrtStandaloneEditorView';
import SrtPreviewView from './components/VideoSubtitlesEditor/SrtPreviewView';
import { MediaPreviewView } from './components/VideoEditor/MediaPreviewView';
import ScriptExternalView from './components/ScriptExternalView';
import LoadingPreviewView from './components/LoadingPreviewView';
import Toolbar from './components/EditorDeGuions/Toolbar';
import Editor from './components/EditorDeGuions/Editor';
import { ColumnView } from './components/EditorDeGuions/ColumnView';
import { CsvView } from './components/EditorDeGuions/CsvView';
import { useDocumentHistory } from './hooks/useDocumentHistory';
import { DirtyGuardModal } from './components/DirtyGuardModal';
import { translateScript } from './utils/EditorDeGuions/translator';
import { csvToSnlbpro, scriptToCsv } from './utils/EditorDeGuions/csvConverter';
import { parseScript } from './utils/EditorDeGuions/scriptParser';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useHashRoute } from './hooks/useHashRoute';
import useLocalStorage from './hooks/useLocalStorage';
import { LOCAL_STORAGE_KEYS } from './constants';
import SettingsModal from './components/SettingsModal';
import * as Icons from './components/icons';
import { AuthModal } from './components/Auth/AuthModal';

import { AuthProvider, useAuth } from './context/Auth/AuthContext';
import { ThemeProvider } from './context/Theme/ThemeContext';
import { api } from './services/api';
import TasksIAPanel, { JobRecord } from './components/TasksIA/TasksIAPanel';

const DEFAULT_STYLES: EditorStyles = {
  take: { fontFamily: 'Courier Prime, monospace', fontSize: 16, color: '#000000', bold: true, italic: false },
  speaker: { fontFamily: 'Courier Prime, monospace', fontSize: 14, color: '#000000', bold: true, italic: false },
  timecode: { fontFamily: 'Courier Prime, monospace', fontSize: 13, color: '#666666', bold: false, italic: false },
  dialogue: { fontFamily: 'Courier Prime, monospace', fontSize: 14, color: '#000000', bold: false, italic: false },
  dialogueParentheses: { fontFamily: 'Courier Prime, monospace', fontSize: 14, color: '#555555', bold: false, italic: true },
  dialogueTimecodeParentheses: { fontFamily: 'Courier Prime, monospace', fontSize: 13, color: '#0055aa', bold: true, italic: false },
};

const MIN_LIBRARY_WIDTH = 280;
const COLLAPSED_WIDTH = 60; 

const MEDIA_EXTS = ['mp4', 'mov', 'webm', 'wav', 'mp3', 'ogg', 'm4a'];

const NotificationModal: React.FC<{
  translationTasks: TranslationTask[];
  transcriptionTasks: TranscriptionTask[];
  onClearTranslations: () => void;
  onClearTranscriptions: () => void;
  onClose: () => void;
}> = ({ translationTasks, transcriptionTasks, onClearTranslations, onClearTranscriptions, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[500] p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh] overflow-hidden" style={{ backgroundColor: 'var(--th-bg-surface)', border: '1px solid var(--th-border)' }} onClick={e => e.stopPropagation()}>
        <div className="p-5 flex justify-between items-center" style={{ borderBottom: '1px solid var(--th-border)', backgroundColor: 'var(--th-bg-secondary)' }}>
          <h4 className="font-bold text-xl text-white flex items-center gap-3">
            <Icons.Bell className="w-6 h-6" style={{ color: 'var(--th-accent-text)' }} />
            Notificacions
          </h4>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none transition-colors">&times;</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-8">
          {/* --- Traduccions --- */}
          <div>
            <h4 className="font-black text-sm text-gray-200 mb-3">Tasques de Traducció IA</h4>

            {translationTasks.length === 0 ? (
              <div className="py-6 text-center text-gray-500 italic">No hi ha tasques de traducció.</div>
            ) : (
              <div className="space-y-4">
                {translationTasks.map(task => (
                  <div key={task.id} className="p-4 rounded-xl transition-colors" style={{ backgroundColor: 'var(--th-bg-primary)', border: '1px solid var(--th-border)' }}>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded" style={{ color: 'var(--th-text-muted)', backgroundColor: 'var(--th-bg-tertiary)' }}>
                        {new Date(task.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm ${
                        task.status === 'completed' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                        task.status === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                        'animate-pulse'
                      }`} style={task.status === 'processing' ? { backgroundColor: 'var(--th-accent-muted)', color: 'var(--th-accent-text)', border: '1px solid var(--th-focus-ring)' } : undefined}>
                        {task.status === 'processing' ? 'Processant...' : task.status === 'completed' ? 'Finalitzada' : 'Error'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-bold text-gray-100 flex-1 truncate" title={task.documentName}>
                        {task.documentName}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] font-bold px-3 py-1 rounded-lg" style={{ color: 'var(--th-text-secondary)', backgroundColor: 'var(--th-bg-tertiary)', border: '1px solid var(--th-border-subtle)' }}>
                        <span className="uppercase" style={{ color: 'var(--th-accent-text)' }}>{task.fromLang}</span>
                        <span className="text-gray-600">→</span>
                        <span className="uppercase text-emerald-400">{task.toLang}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* --- Transcripcions --- */}
          <div>
            <h4 className="font-black text-sm text-gray-200 mb-3">Transcripcions WhisperX</h4>

            {transcriptionTasks.length === 0 ? (
              <div className="py-6 text-center text-gray-500 italic">No hi ha transcripcions.</div>
            ) : (
              <div className="space-y-4">
                {transcriptionTasks.map(t => (
                  <div key={t.id} className="p-4 rounded-xl" style={{ backgroundColor: 'var(--th-bg-primary)', border: '1px solid var(--th-border)' }}>
                    <div className="flex justify-between">
                      <div className="font-bold text-gray-100 truncate pr-4" title={t.projectName}>{t.projectName}</div>
                      <div className="text-xs text-gray-300">{t.status}</div>
                    </div>

                    <div className="h-2 rounded overflow-hidden mt-2" style={{ backgroundColor: 'var(--th-bg-tertiary)' }}>
                      <div className="h-2" style={{ width: `${t.progress}%`, backgroundColor: 'var(--th-accent)' }} />
                    </div>
                    <div className="text-xs text-gray-300 mt-1">{t.progress}%</div>

                    {t.status === 'error' && <div className="text-xs text-red-300 mt-1">{t.error}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-5 flex gap-4" style={{ borderTop: '1px solid var(--th-border)', backgroundColor: 'var(--th-bg-secondary)' }}>
          <button
            onClick={onClearTranslations}
            disabled={!translationTasks.some(t => t.status !== 'processing')}
            className="flex-1 py-3 text-xs font-black rounded-xl transition-all uppercase tracking-widest disabled:opacity-30"
            style={{ color: 'var(--th-text-secondary)', backgroundColor: 'var(--th-bg-tertiary)', border: '1px solid var(--th-border)' }}
          >
            Netejar traduccions
          </button>

          <button
            onClick={onClearTranscriptions}
            disabled={!transcriptionTasks.some(t => t.status !== 'queued' && t.status !== 'processing')}
            className="flex-1 py-3 text-xs font-black rounded-xl transition-all uppercase tracking-widest disabled:opacity-30"
            style={{ color: 'var(--th-text-secondary)', backgroundColor: 'var(--th-bg-tertiary)', border: '1px solid var(--th-border)' }}
          >
            Netejar transcripcions
          </button>

          <button
            onClick={onClose}
            className="flex-1 py-3 text-xs font-black rounded-xl transition-all uppercase tracking-widest shadow-lg active:scale-95"
            style={{ backgroundColor: 'var(--th-btn-primary-bg)', color: 'var(--th-btn-primary-text)', border: '1px solid var(--th-accent)' }}
          >
            Tancar
          </button>
        </div>
      </div>
    </div>
  );
};
const MainAppContent: React.FC = () => {
  const { state, dispatch, useBackend } = useLibrary();
  const { me: authMe } = useAuth();

  const [openDocId, setOpenDocId] = useState<string | null>(null);
  const [openMode, setOpenMode] = useState<OpenMode | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeLang, setActiveLang] = useState<string>('');

  // ── Edit lock: tracks if the current document is locked by another user ──
  const [docLockInfo, setDocLockInfo] = useState<{ lockedByUserName: string; lockedByUserId: string } | null>(null);
  const prevOpenDocIdRef = useRef<string | null>(null);
  // Which docId WE currently hold a lock on (null = we don't hold any lock)
  const heldLockRef = useRef<string | null>(null);

  // Check/acquire lock when opening a document for editing. Release on change.
  useEffect(() => {
    if (!useBackend) return;

    const prevDocId = prevOpenDocIdRef.current;
    prevOpenDocIdRef.current = openDocId;

    // Release lock on the previous document when navigating away
    if (prevDocId && prevDocId !== openDocId && heldLockRef.current === prevDocId) {
      api.releaseLock(prevDocId).catch(() => {});
      heldLockRef.current = null;
    }

    if (!openDocId || !isEditing) {
      // Also release if we still hold the lock on this same doc (e.g. isEditing→false)
      if (openDocId && heldLockRef.current === openDocId) {
        api.releaseLock(openDocId).catch(() => {});
        heldLockRef.current = null;
      }
      setDocLockInfo(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const lockStatus = await api.getLockStatus(openDocId);
        if (cancelled) return;

        const myId = authMe?.id;
        if (
          lockStatus.lockedByUserId &&
          lockStatus.lockedByUserId !== myId &&
          !lockStatus.isExpired
        ) {
          // Another user has this document open for editing → read-only
          setDocLockInfo({
            lockedByUserName: lockStatus.lockedByUserName || lockStatus.lockedByUserId,
            lockedByUserId: lockStatus.lockedByUserId,
          });
          setIsEditing(false);
          return;
        }

        // Acquire/refresh the lock
        await api.acquireLock(openDocId, authMe?.name || authMe?.email || '');
        heldLockRef.current = openDocId;
        setDocLockInfo(null);
      } catch {
        // Lock check failed — open normally, don't block
        setDocLockInfo(null);
      }
    })();

    return () => { cancelled = true; };
  }, [openDocId, isEditing, useBackend, authMe]);

  // Heartbeat: refresh lock every 2 minutes to prevent TTL expiry while editing
  useEffect(() => {
    if (!useBackend || !openDocId || !isEditing) return;
    const id = setInterval(() => {
      api.acquireLock(openDocId, authMe?.name || authMe?.email || '').catch(() => {});
    }, 2 * 60 * 1000); // every 2 min
    return () => clearInterval(id);
  }, [useBackend, openDocId, isEditing, authMe]);

  // Release lock when tab/window is closed (keepalive survives page unload)
  useEffect(() => {
    if (!useBackend) return;
    const handleUnload = () => {
      if (heldLockRef.current) api.releaseLockBeacon(heldLockRef.current);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [useBackend]);

const [page, setPage] = useState<'library' | 'media' | 'projects'>('library');
  const [isLibraryCollapsed, setIsLibraryCollapsed] = useState(false);
  const [libraryWidth, setLibraryWidth] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.LIBRARY_WIDTH, 420);
  const [layout, setLayout] = useState<Layout>('cols');
  const [editorView, setEditorView] = useState<'script' | 'csv'>('script');
  const [tabSize, setTabSize] = useState(4);
  const [pageWidth, setPageWidth] = useState('794px');
  const [editorStyles, setEditorStyles] = useLocalStorage<EditorStyles>(LOCAL_STORAGE_KEYS.EDITOR_STYLES, DEFAULT_STYLES);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Toasts de tasques completades (notificació HOME)
  const [completedToasts, setCompletedToasts] = useState<JobRecord[]>([]);
  const handleTaskCompleted = useCallback((job: JobRecord) => {
    setCompletedToasts(prev => {
      // Evitar duplicats
      if (prev.some(j => j.id === job.id)) return prev;
      return [...prev, job];
    });
    // Auto-dismiss after 8s
    setTimeout(() => {
      setCompletedToasts(prev => prev.filter(j => j.id !== job.id));
    }, 8000);
  }, []);

  // ── Background poller: detecta tasques completades per mostrar toast ──
  const bgJobStatusRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    if (!useBackend) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const jobs: JobRecord[] = await api.listJobs({ limit: 20 });
        if (cancelled) return;
        const prevMap = bgJobStatusRef.current;
        for (const j of jobs) {
          const prev = prevMap.get(j.id);
          if (prev && prev !== 'done' && prev !== 'error' && j.status === 'done') {
            handleTaskCompleted(j);
          }
        }
        const newMap = new Map<string, string>();
        for (const j of jobs) newMap.set(j.id, j.status);
        bgJobStatusRef.current = newMap;
      } catch { /* ignore */ }
    };
    poll();
    const id = setInterval(poll, 10_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [useBackend, handleTaskCompleted]);

  const currentDoc = useMemo(() => state.documents.find(d => d.id === openDocId), [openDocId, state.documents]);

  const isResizingRef = useRef(false);
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isLibraryCollapsed) return;
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [isLibraryCollapsed]);

  // RAF throttle per al resize de la librería — evita rerenders+localStorage writes a cada mousemove
  const libResizeRafRef = useRef(0);
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      if (libResizeRafRef.current) return; // ja hi ha un frame pendent
      libResizeRafRef.current = requestAnimationFrame(() => {
        libResizeRafRef.current = 0;
        const newWidth = Math.max(MIN_LIBRARY_WIDTH, Math.min(window.innerWidth, e.clientX));
        setLibraryWidth(newWidth);
      });
    };
    const handleMouseUp = () => {
      isResizingRef.current = false;
      if (libResizeRafRef.current) { cancelAnimationFrame(libResizeRafRef.current); libResizeRafRef.current = 0; }
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (libResizeRafRef.current) cancelAnimationFrame(libResizeRafRef.current);
    };
  }, [setLibraryWidth]);

  useEffect(() => {
    const handleOpenSettings = () => setIsSettingsOpen(true);
    window.addEventListener('OPEN_SETTINGS', handleOpenSettings);
    return () => window.removeEventListener('OPEN_SETTINGS', handleOpenSettings);
  }, []);

  const effectiveLang = useMemo(() => {
    if (!currentDoc) return '';
    if (activeLang && currentDoc.contentByLang[activeLang] !== undefined) return activeLang;
    const keys = Object.keys(currentDoc.contentByLang);
    if (keys.includes('_unassigned')) return '_unassigned';
    if (currentDoc.sourceLang && keys.includes(currentDoc.sourceLang)) return currentDoc.sourceLang;
    return keys[0] || '';
  }, [currentDoc, activeLang]);

  useEffect(() => {
    if (currentDoc && effectiveLang !== activeLang) {
      setActiveLang(effectiveLang);
    }
  }, [currentDoc?.id, effectiveLang, activeLang]);

  useEffect(() => {
  if (!useBackend) return;
  if (openMode !== 'editor-video-subs' && openMode !== 'editor-srt-standalone') return;
  if (!openDocId) return;

  const doc = state.documents.find((d) => d.id === openDocId);
  if (!doc) return;

  const isSrt = (doc.sourceType || '').toLowerCase() === 'srt' || doc.name.toLowerCase().endsWith('.srt');
  if (!isSrt) return;

  let cancelled = false;

  void (async () => {
    try {
      const proj = await api.getProjectBySrt(doc.id);
      if (cancelled) return;

      const mediaId = proj?.mediaDocumentId || proj?.mediaDocId;
      if (mediaId) {
        dispatch({ type: 'TRIGGER_SYNC_REQUEST', payload: { docId: mediaId, type: 'media' } });
      }
    } catch (e) {
      console.warn('getProjectBySrt failed', e);
    }
  })();

  return () => {
    cancelled = true;
  };
}, [useBackend, openMode, openDocId, state.documents, dispatch]);

  const docContent = useMemo(() => currentDoc?.contentByLang[effectiveLang] || '', [currentDoc, effectiveLang]);
  const history = useDocumentHistory(openDocId || 'temp', docContent);

  // Contingut CSV per a la vista DADES: usa el valor guardat o el deriva del guió canònic si és buit
  const csvContentToShow = useMemo(() => {
    if (!currentDoc || !effectiveLang) return '';
    const stored = currentDoc.csvContentByLang[effectiveLang];
    if (stored) return stored;
    const content = currentDoc.contentByLang[effectiveLang] || '';
    if (!content) return '';
    const { takes } = parseScript(content);
    return scriptToCsv(takes);
  }, [currentDoc, effectiveLang]);

  const handleSave = useCallback(() => {
    history.save((data) => {
      if (currentDoc) {
        dispatch({
          type: 'UPDATE_DOCUMENT_CONTENTS',
          payload: { documentId: currentDoc.id, lang: effectiveLang, content: data, csvContent: '' }
        });
      }
    });
  }, [history, currentDoc, effectiveLang, dispatch]);

  const enableScriptShortcuts =
  !!openDocId &&
  isEditing &&
  (openMode === 'editor' || openMode === 'editor-video' || openMode === 'editor-ssrtlsf');

  useKeyboardShortcuts('scriptEditor', (action) => {
    if (!openDocId) return;
    switch (action) {
      case 'UNDO': history.undo(); break;
      case 'REDO': history.redo(); break;
      case 'SAVE': handleSave(); break;
    }
  }, enableScriptShortcuts);

  const [pendingNav, setPendingNav] = useState<{ id: string | null, mode: OpenMode | null, edit: boolean } | null>(null);
  const [showDirtyModal, setShowDirtyModal] = useState(false);

  const handleOpenDocument = (docId: string | null, mode: OpenMode | null, editMode: boolean) => {
    if (history.isDirty) {
      setPendingNav({ id: docId, mode, edit: editMode });
      setShowDirtyModal(true);
      return;
    }
    setOpenDocId(docId);
    setOpenMode(mode);
    setIsEditing(editMode);
  };

  const handleTextChange = (newText: string, sourceView: 'script' | 'csv' | 'mono') => {
    if (!currentDoc || !isEditing || !effectiveLang) return;
    if (sourceView === 'csv') {
      // newText és contingut CSV de CsvView; el convertim a format canònic de guió
      const canonicalContent = csvToSnlbpro(newText);
      history.updateDraft(canonicalContent);
      history.commit(canonicalContent);
      dispatch({
        type: 'UPDATE_DOCUMENT_CONTENTS',
        payload: { documentId: currentDoc.id, lang: effectiveLang, content: canonicalContent, csvContent: newText }
      });
      return;
    }
    history.updateDraft(newText);
    dispatch({
      type: 'UPDATE_DOCUMENT_CONTENTS',
      payload: { documentId: currentDoc.id, lang: effectiveLang, content: newText, csvContent: '' }
    });
  };

  const handleTranslate = async (from: string, to: string, taskId: string) => {
    if (!currentDoc) return;
    try {
      const translated = await translateScript(docContent, from, to);
      dispatch({ type: 'ADD_TRANSLATION', payload: { documentId: currentDoc.id, lang: to, content: translated, csvContent: '' } });
      dispatch({ type: 'UPDATE_TRANSLATION_TASK_STATUS', payload: { id: taskId, status: 'completed' } });
      setActiveLang(to);
    } catch (e) {
      dispatch({ type: 'UPDATE_TRANSLATION_TASK_STATUS', payload: { id: taskId, status: 'error' } });
    }
  };

  const confirmNavigation = () => {
    if (pendingNav) {
      setOpenDocId(pendingNav.id);
      setOpenMode(pendingNav.mode);
      setIsEditing(pendingNav.edit);
      setPendingNav(null);
    }
    setShowDirtyModal(false);
  };

  const renderMainContent = () => {
    if (!currentDoc || !openMode) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-40">
           <div className="w-32 h-32 rounded-full flex items-center justify-center mb-8" style={{ backgroundColor: 'var(--th-bg-surface)', border: '1px solid var(--th-border)' }}>
              <svg className="w-16 h-16" style={{ color: 'var(--th-accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
           </div>
           <h2 className="text-3xl font-black uppercase tracking-tighter text-white">Script Editor Pro</h2>
           <p className="text-gray-500 mt-2 max-w-sm">Selecciona un document de la llibreria per començar a treballar o importar un nou guió.</p>
        </div>
      );
    }

if (openMode === 'editor-video') return <VideoEditorView {...toolbarProps} currentDoc={currentDoc} isEditing={isEditing} handleTextChange={handleTextChange} handleEditorBackgroundClick={() => {}} />;
    if (openMode === 'editor-video-subs') return <VideoSubtitlesEditorView {...toolbarProps} currentDoc={currentDoc} isEditing={isEditing} handleTextChange={handleTextChange} handleEditorBackgroundClick={() => {}} />;
    if (openMode === 'editor-ssrtlsf') return <SsrtlsfEditorView currentDoc={currentDoc} isEditing={isEditing} onClose={() => handleOpenDocument(null, null, false)} onUpdateContent={(txt) => handleTextChange(txt, 'script')} />;
    if (openMode === 'editor-srt-standalone') {
      if (!isEditing) return <SrtPreviewView currentDoc={currentDoc} onClose={() => handleOpenDocument(null, null, false)} />;
      return <VideoSrtStandaloneEditorView currentDoc={currentDoc} isEditing={isEditing} onClose={() => handleOpenDocument(null, null, false)} />;
    }

    // --- CORRECCIÓ: Previsualització multimèdia o de text ---
    if (!isEditing) {
      const isMedia = currentDoc.sourceType && MEDIA_EXTS.includes(currentDoc.sourceType.toLowerCase());
      
      if (isMedia) {
        return <MediaPreviewView currentDoc={currentDoc} />;
      }

      return (
        <main className="flex-grow overflow-y-auto p-8 flex flex-col items-center custom-scrollbar" style={{ backgroundColor: 'var(--th-bg-app)' }}>
           <div className="bg-white text-gray-900 shadow-2xl rounded-sm p-12 transition-all duration-300" style={{ width: pageWidth }}>
              <ColumnView
                content={history.present}
                setContent={(txt) => handleTextChange(txt, 'script')}
                isEditable={false}
                col1Width={200}
                editorStyles={editorStyles}
              />
           </div>
        </main>
      );
    }

    return (
      <div className="flex-1 flex flex-col min-h-0">
        <Toolbar {...toolbarProps} onUndo={() => history.undo()} onRedo={() => history.redo()} canUndo={history.canUndo} canRedo={history.canRedo} />
        <main className="flex-grow overflow-y-auto p-8 flex flex-col items-center custom-scrollbar" style={{ backgroundColor: 'var(--th-bg-app)' }}>
           <div id="page-content-area" className="bg-white text-gray-900 shadow-2xl rounded-sm p-12 transition-all duration-300" style={{ width: pageWidth }}>
              {editorView === 'csv' ? (
                <CsvView content={csvContentToShow} setContent={handleTextChange} isEditable={isEditing} pageWidth={pageWidth} />
              ) : layout === 'mono' ? (
                <Editor content={history.present} setContent={(txt) => handleTextChange(txt, 'mono')} isEditable={isEditing} tabSize={tabSize} />
              ) : (
                <ColumnView content={history.present} setContent={(txt) => handleTextChange(txt, 'script')} isEditable={isEditing} col1Width={200} editorStyles={editorStyles} />
              )}
           </div>
        </main>
      </div>
    );
  };

  const toolbarProps = {
    currentDoc, layout, onLayoutChange: setLayout,
    tabSize, onTabSizeChange: setTabSize,
    pageWidth, onPageWidthChange: setPageWidth,
    editorView, onEditorViewChange: setEditorView,
    activeLang: effectiveLang, onActiveLangChange: setActiveLang,
    onSetSourceLang: (lang: string) => dispatch({ type: 'SET_SOURCE_LANG', payload: { documentId: currentDoc?.id || '', lang } }),
    onTranslate: handleTranslate, col1Width: 200, editorStyles
  };

  return (
    <div className="h-screen flex text-white font-sans overflow-hidden" style={{ backgroundColor: 'var(--th-bg-app)' }}>
      <DirtyGuardModal 
        isOpen={showDirtyModal}
        onSave={() => { history.save((data) => handleTextChange(data, 'script')); confirmNavigation(); }}
        onDiscard={confirmNavigation}
        onCancel={() => { setShowDirtyModal(false); setPendingNav(null); }}
      />
      <aside
        style={{ width: isLibraryCollapsed ? COLLAPSED_WIDTH : libraryWidth, backgroundColor: 'var(--th-bg-app)' }}
        className={`flex-shrink-0 transition-[width] duration-200 ease-out relative z-10 will-change-[width]`}
      >
        <LibraryView 
            onOpenDocument={handleOpenDocument} 
            isCollapsed={isLibraryCollapsed} 
            setIsCollapsed={setIsLibraryCollapsed} 
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenNotifications={() => setIsNotificationsOpen(true)}
            page={page}
  onChangePage={(p) => { setPage(p); setOpenDocId(null); setOpenMode(null); setIsEditing(false); }}
        />
        {!isLibraryCollapsed && (
            <div
                onMouseDown={handleMouseDown}
                className="absolute top-0 right-0 w-2 h-full cursor-col-resize z-50 group bg-transparent"
            />
        )}
        {/* Botón toggle siempre visible en el borde derecho */}
        <button
          onClick={() => setIsLibraryCollapsed(!isLibraryCollapsed)}
          title={isLibraryCollapsed ? 'Expandir librería' : 'Colapsar librería'}
          className="absolute top-1/2 -right-3 -translate-y-1/2 z-[40] w-6 h-10 flex items-center justify-center rounded-r-md bg-gray-700 text-gray-300 hover:text-white transition-colors shadow-lg border border-gray-600"
          style={{ fontSize: '10px' }}
        >
          {isLibraryCollapsed ? '›' : '‹'}
        </button>
      </aside>
      <section className="flex-1 flex flex-col min-w-0" style={{ backgroundColor: 'var(--th-bg-app)' }}>
        {/* ── Lock banner: document obert en mode lectura per un altre usuari ── */}
        {docLockInfo && (
          <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 bg-amber-900/60 border-b border-amber-600/40 text-amber-200 text-xs font-bold backdrop-blur-sm z-10">
            <span className="text-amber-400 text-base">🔒</span>
            <span>
              Document obert en <strong>mode lectura</strong> — en ús per{' '}
              <span className="text-amber-300">{docLockInfo.lockedByUserName}</span>
            </span>
            <span className="ml-auto text-amber-500/70 text-[10px] uppercase tracking-wider">Només lectura</span>
          </div>
        )}
        {renderMainContent()}
      </section>

      {isSettingsOpen && (
        <SettingsModal 
            onClose={() => setIsSettingsOpen(false)} 
            editorStyles={editorStyles} 
            onStylesChange={setEditorStyles} 
        />
      )}

      {isNotificationsOpen && (
        <TasksIAPanel
          onClose={() => setIsNotificationsOpen(false)}
          onTaskCompleted={handleTaskCompleted}
        />
      )}

      {history.isDirty && (
        <div className="fixed bottom-4 right-4 px-3 py-1 bg-amber-500 text-black text-[10px] font-black uppercase rounded-full shadow-lg animate-pulse z-[100]">
          Canvis sense desar
        </div>
      )}

      {/* Toast notifications per tasques completades */}
      {completedToasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[600] flex flex-col gap-2 pointer-events-auto">
          {completedToasts.map(toast => (
            <div
              key={toast.id}
              className="bg-emerald-900/90 border border-emerald-600/50 rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3 min-w-[320px] backdrop-blur-md"
              style={{ animation: 'slideInRight 0.3s ease-out' }}
            >
              <span className="text-emerald-400 text-lg">✓</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-emerald-100 truncate">{toast.projectName}</p>
                <p className="text-[10px] text-emerald-400/80 uppercase tracking-widest font-bold">Transcripció completada</p>
              </div>
              <button
                onClick={() => setCompletedToasts(prev => prev.filter(j => j.id !== toast.id))}
                className="text-emerald-500 hover:text-white text-lg transition-colors"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const USE_BACKEND = process.env.VITE_USE_BACKEND === '1';

// ─── Editor en nova pestanya (sense sidebar) ─────────────────────────────────
const EditorTabContent: React.FC<{ mode: OpenMode; docId: string }> = ({ mode, docId }) => {
  const { state, dispatch, useBackend } = useLibrary();
  const { me: authMe } = useAuth();
  const currentDoc = useMemo(() => state.documents.find(d => d.id === docId), [docId, state.documents]);
  const [isEditing, setIsEditing] = useState(true);
  const [docLockInfo, setDocLockInfo] = useState<{ lockedByUserName: string; lockedByUserId: string } | null>(null);
  // Tracks whether THIS tab currently holds the lock (to release cleanly)
  const lockHeldRef = useRef(false);
  const [activeLang, setActiveLang] = useState('');
  const [layout, setLayout] = useState<Layout>('cols');
  const [editorView, setEditorView] = useState<'script' | 'csv'>('script');
  const [tabSize, setTabSize] = useState(4);
  const [pageWidth, setPageWidth] = useState('794px');
  const [editorStyles, setEditorStyles] = useLocalStorage<EditorStyles>(LOCAL_STORAGE_KEYS.EDITOR_STYLES, DEFAULT_STYLES);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const effectiveLang = useMemo(() => {
    if (!currentDoc) return '';
    if (activeLang && currentDoc.contentByLang[activeLang] !== undefined) return activeLang;
    const keys = Object.keys(currentDoc.contentByLang);
    if (keys.includes('_unassigned')) return '_unassigned';
    if (currentDoc.sourceLang && keys.includes(currentDoc.sourceLang)) return currentDoc.sourceLang;
    return keys[0] || '';
  }, [currentDoc, activeLang]);

  useEffect(() => {
    if (currentDoc && effectiveLang !== activeLang) setActiveLang(effectiveLang);
  }, [currentDoc?.id, effectiveLang, activeLang]);

  // Sync request per media (com a MainAppContent)
  useEffect(() => {
    if (!useBackend) return;
    if (mode !== 'editor-video-subs' && mode !== 'editor-srt-standalone') return;
    if (!docId) return;
    const doc = state.documents.find(d => d.id === docId);
    if (!doc) return;
    const isSrt = (doc.sourceType || '').toLowerCase() === 'srt' || doc.name.toLowerCase().endsWith('.srt');
    if (!isSrt) return;
    let cancelled = false;
    void (async () => {
      try {
        const proj = await api.getProjectBySrt(doc.id);
        if (cancelled) return;
        const mediaId = proj?.mediaDocumentId || proj?.mediaDocId;
        if (mediaId) dispatch({ type: 'TRIGGER_SYNC_REQUEST', payload: { docId: mediaId, type: 'media' } });
      } catch (e) { console.warn('getProjectBySrt failed', e); }
    })();
    return () => { cancelled = true; };
  }, [useBackend, mode, docId, state.documents, dispatch]);

  // ── Edit lock ──────────────────────────────────────────────────────────────
  // Check/acquire lock when tab opens. Release on HOME navigation or tab close.
  useEffect(() => {
    if (!useBackend || !docId) return;

    let cancelled = false;
    void (async () => {
      try {
        const lockStatus = await api.getLockStatus(docId);
        if (cancelled) return;

        const myId = authMe?.id;
        if (
          lockStatus.lockedByUserId &&
          lockStatus.lockedByUserId !== myId &&
          !lockStatus.isExpired
        ) {
          // Another user has this document — force read-only
          setDocLockInfo({
            lockedByUserName: lockStatus.lockedByUserName || lockStatus.lockedByUserId,
            lockedByUserId: lockStatus.lockedByUserId,
          });
          setIsEditing(false);
          lockHeldRef.current = false;
          return;
        }

        // Acquire/refresh the lock
        await api.acquireLock(docId, authMe?.name || authMe?.email || '');
        lockHeldRef.current = true;
        setDocLockInfo(null);
      } catch {
        // Lock check failed — open normally, don't block
        lockHeldRef.current = false;
        setDocLockInfo(null);
      }
    })();

    return () => { cancelled = true; };
  }, [docId, useBackend, authMe]);

  // Heartbeat: refresh lock every 2 minutes to prevent TTL expiry
  useEffect(() => {
    if (!useBackend || !docId || !isEditing) return;
    const id = setInterval(() => {
      api.acquireLock(docId, authMe?.name || authMe?.email || '').catch(() => {});
    }, 2 * 60 * 1000); // every 2 min
    return () => clearInterval(id);
  }, [useBackend, docId, isEditing, authMe]);

  // Release lock on tab/window close (keepalive survives page unload)
  useEffect(() => {
    if (!useBackend || !docId) return;
    const handleUnload = () => {
      if (lockHeldRef.current) api.releaseLockBeacon(docId);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [useBackend, docId]);

  const docContent = useMemo(() => currentDoc?.contentByLang[effectiveLang] || '', [currentDoc, effectiveLang]);
  const history = useDocumentHistory(docId || 'temp', docContent);

  const csvContentToShow = useMemo(() => {
    if (!currentDoc || !effectiveLang) return '';
    const stored = currentDoc.csvContentByLang[effectiveLang];
    if (stored) return stored;
    const content = currentDoc.contentByLang[effectiveLang] || '';
    if (!content) return '';
    const { takes } = parseScript(content);
    return scriptToCsv(takes);
  }, [currentDoc, effectiveLang]);

  const handleSave = useCallback(() => {
    history.save((data) => {
      if (currentDoc) {
        dispatch({ type: 'UPDATE_DOCUMENT_CONTENTS', payload: { documentId: currentDoc.id, lang: effectiveLang, content: data, csvContent: '' } });
      }
    });
  }, [history, currentDoc, effectiveLang, dispatch]);

  const handleTextChange = (newText: string, sourceView: 'script' | 'csv' | 'mono') => {
    if (!currentDoc || !isEditing || !effectiveLang) return;
    if (sourceView === 'csv') {
      const canonicalContent = csvToSnlbpro(newText);
      history.updateDraft(canonicalContent);
      history.commit(canonicalContent);
      dispatch({ type: 'UPDATE_DOCUMENT_CONTENTS', payload: { documentId: currentDoc.id, lang: effectiveLang, content: canonicalContent, csvContent: newText } });
      return;
    }
    history.updateDraft(newText);
    dispatch({ type: 'UPDATE_DOCUMENT_CONTENTS', payload: { documentId: currentDoc.id, lang: effectiveLang, content: newText, csvContent: '' } });
  };

  const handleTranslate = async (from: string, to: string, taskId: string) => {
    if (!currentDoc) return;
    try {
      const translated = await translateScript(docContent, from, to);
      dispatch({ type: 'ADD_TRANSLATION', payload: { documentId: currentDoc.id, lang: to, content: translated, csvContent: '' } });
      dispatch({ type: 'UPDATE_TRANSLATION_TASK_STATUS', payload: { id: taskId, status: 'completed' } });
      setActiveLang(to);
    } catch (e) {
      dispatch({ type: 'UPDATE_TRANSLATION_TASK_STATUS', payload: { id: taskId, status: 'error' } });
    }
  };

  const enableScriptShortcuts = isEditing && (mode === 'editor' || mode === 'editor-video' || mode === 'editor-ssrtlsf');
  useKeyboardShortcuts('scriptEditor', (action) => {
    switch (action) {
      case 'UNDO': history.undo(); break;
      case 'REDO': history.redo(); break;
      case 'SAVE': handleSave(); break;
    }
  }, enableScriptShortcuts);

  useEffect(() => {
    const handleOpenSettings = () => setIsSettingsOpen(true);
    window.addEventListener('OPEN_SETTINGS', handleOpenSettings);
    return () => window.removeEventListener('OPEN_SETTINGS', handleOpenSettings);
  }, []);

  const toolbarProps = {
    currentDoc, layout, onLayoutChange: setLayout,
    tabSize, onTabSizeChange: setTabSize,
    pageWidth, onPageWidthChange: setPageWidth,
    editorView, onEditorViewChange: setEditorView,
    activeLang: effectiveLang, onActiveLangChange: setActiveLang,
    onSetSourceLang: (lang: string) => dispatch({ type: 'SET_SOURCE_LANG', payload: { documentId: currentDoc?.id || '', lang } }),
    onTranslate: handleTranslate, col1Width: 200, editorStyles
  };

  const handleGoHome = () => {
    // Release lock before navigating — hash change does NOT trigger beforeunload
    if (useBackend && lockHeldRef.current) {
      api.releaseLock(docId).catch(() => {});
      lockHeldRef.current = false;
    }
    window.location.hash = '#/home';
  };

  const renderEditor = () => {
    if (!currentDoc) {
      return (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-t-transparent rounded-full mx-auto mb-4" style={{ borderColor: 'var(--th-accent)', borderTopColor: 'transparent' }} />
            <p className="text-sm">Carregant document…</p>
          </div>
        </div>
      );
    }

    if (mode === 'editor-video') return <VideoEditorView {...toolbarProps} currentDoc={currentDoc} isEditing={isEditing} handleTextChange={handleTextChange} handleEditorBackgroundClick={() => {}} />;
    if (mode === 'editor-video-subs') return <VideoSubtitlesEditorView {...toolbarProps} currentDoc={currentDoc} isEditing={isEditing} handleTextChange={handleTextChange} handleEditorBackgroundClick={() => {}} />;
    if (mode === 'editor-ssrtlsf') return <SsrtlsfEditorView currentDoc={currentDoc} isEditing={isEditing} onClose={handleGoHome} onUpdateContent={(txt) => handleTextChange(txt, 'script')} />;
    if (mode === 'editor-srt-standalone') return <VideoSrtStandaloneEditorView currentDoc={currentDoc} isEditing={isEditing} onClose={handleGoHome} />;

    // Mode 'editor' (guió bàsic)
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <Toolbar {...toolbarProps} onUndo={() => history.undo()} onRedo={() => history.redo()} canUndo={history.canUndo} canRedo={history.canRedo} />
        <main className="flex-grow overflow-y-auto p-8 flex flex-col items-center custom-scrollbar" style={{ backgroundColor: 'var(--th-bg-app)' }}>
          <div id="page-content-area" className="bg-white text-gray-900 shadow-2xl rounded-sm p-12 transition-all duration-300" style={{ width: pageWidth }}>
            {editorView === 'csv' ? (
              <CsvView content={csvContentToShow} setContent={handleTextChange} isEditable={isEditing} pageWidth={pageWidth} />
            ) : layout === 'mono' ? (
              <Editor content={history.present} setContent={(txt) => handleTextChange(txt, 'mono')} isEditable={isEditing} tabSize={tabSize} />
            ) : (
              <ColumnView content={history.present} setContent={(txt) => handleTextChange(txt, 'script')} isEditable={isEditing} col1Width={200} editorStyles={editorStyles} />
            )}
          </div>
        </main>
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col text-white font-sans overflow-hidden" style={{ backgroundColor: 'var(--th-bg-app)' }}>
      {/* Header amb botó HOME */}
      <header className="flex-shrink-0 flex items-center gap-3 px-4 py-2" style={{ backgroundColor: 'var(--th-bg-secondary)', borderBottom: '1px solid var(--th-border)' }}>
        <button
          onClick={handleGoHome}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold hover:text-white transition-colors"
          style={{ color: 'var(--th-text-secondary)' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" /></svg>
          HOME
        </button>
        <div className="w-px h-5" style={{ backgroundColor: 'var(--th-border)' }} />
        <span className="text-xs text-gray-500 truncate" title={currentDoc?.name || ''}>
          {currentDoc?.name || 'Carregant…'}
        </span>
        {history.isDirty && (
          <span className="ml-auto px-2 py-0.5 bg-amber-500 text-black text-[9px] font-black uppercase rounded-full animate-pulse">
            Canvis sense desar
          </span>
        )}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className={`${history.isDirty ? '' : 'ml-auto'} p-1.5 rounded-lg transition-colors hover:bg-white/10`}
          style={{ color: 'var(--th-text-secondary)' }}
          title="Configuració"
        >
          <Icons.Settings className="w-5 h-5" />
        </button>
      </header>

      {/* Lock banner: read-only mode when document is in use by another user */}
      {docLockInfo && (
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 bg-amber-900/60 border-b border-amber-600/40 text-amber-200 text-xs font-semibold">
          <span>🔒</span>
          <span>
            Document obert en <strong>mode lectura</strong> — en ús per{' '}
            <span className="text-amber-100 font-bold">{docLockInfo.lockedByUserName}</span>
          </span>
          <span className="ml-auto px-2 py-0.5 bg-amber-700/60 rounded text-amber-300 font-black uppercase text-[10px] tracking-wider">
            Només lectura
          </span>
        </div>
      )}

      {/* Contingut de l'editor */}
      <div className="flex-1 min-h-0 flex flex-col">
        {renderEditor()}
      </div>

      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} editorStyles={editorStyles} onStylesChange={setEditorStyles} />
      )}
    </div>
  );
};

const AuthedGate: React.FC = () => {
  const { authed, reason, markAuthed } = useAuth();
  const route = useHashRoute();

  if (route.view === 'loading-preview') {
    return <LoadingPreviewView />;
  }

  return (
    <>
      <AuthModal
        open={USE_BACKEND && !authed}
        onDone={() => markAuthed()}
        reason={reason}
      />
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
    </>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthedGate />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;