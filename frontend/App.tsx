import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useLibrary, LibraryProvider } from './context/Library/LibraryContext';
import { ViewType, SortByKey, SortOrder, OpenMode, Layout, EditorStyles, TranslationTask, TranscriptionTask } from './types';
import { LibraryView } from './components/Library/LibraryView';
import { VideoEditorView } from './components/VideoEditor/VideoEditorView';
import { VideoSubtitlesEditorView } from './components/VideoSubtitlesEditor/VideoSubtitlesEditorView';
import { LectorView } from './components/LectorDeGuions/LectorView';
import { SsrtlsfEditorView } from './components/SsrtlsfEditor/SsrtlsfEditorView';
import { VideoSrtStandaloneEditorView } from './components/VideoSubtitlesEditor/VideoSrtStandaloneEditorView';
import { MediaPreviewView } from './components/VideoEditor/MediaPreviewView';
import Toolbar from './components/EditorDeGuions/Toolbar';
import Editor from './components/EditorDeGuions/Editor';
import { ColumnView } from './components/EditorDeGuions/ColumnView';
import { CsvView } from './components/EditorDeGuions/CsvView';
import { useDocumentHistory } from './hooks/useDocumentHistory';
import { DirtyGuardModal } from './components/DirtyGuardModal';
import { translateScript } from './utils/EditorDeGuions/translator';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import useLocalStorage from './hooks/useLocalStorage';
import { LOCAL_STORAGE_KEYS } from './constants';
import SettingsModal from './components/SettingsModal';
import * as Icons from './components/icons';
import { AuthModal } from './components/Auth/AuthModal';

import { AuthProvider, useAuth } from './context/Auth/AuthContext';
import { api } from './services/api';

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
      <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
          <h4 className="font-bold text-xl text-white flex items-center gap-3">
            <Icons.Bell className="w-6 h-6 text-blue-400" />
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
                  <div key={task.id} className="p-4 bg-gray-900/60 rounded-xl border border-gray-700/50 hover:border-600 transition-colors">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-mono font-bold text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
                        {new Date(task.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm ${
                        task.status === 'completed' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                        task.status === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                        'bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse'
                      }`}>
                        {task.status === 'processing' ? 'Processant...' : task.status === 'completed' ? 'Finalitzada' : 'Error'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-bold text-gray-100 flex-1 truncate" title={task.documentName}>
                        {task.documentName}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400 bg-gray-800/80 px-3 py-1 rounded-lg border border-gray-700/50">
                        <span className="uppercase text-blue-400">{task.fromLang}</span>
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
                  <div key={t.id} className="p-4 bg-gray-900/60 rounded-xl border border-gray-700/50">
                    <div className="flex justify-between">
                      <div className="font-bold text-gray-100 truncate pr-4" title={t.projectName}>{t.projectName}</div>
                      <div className="text-xs text-gray-300">{t.status}</div>
                    </div>

                    <div className="h-2 bg-gray-700 rounded overflow-hidden mt-2">
                      <div className="h-2 bg-blue-500" style={{ width: `${t.progress}%` }} />
                    </div>
                    <div className="text-xs text-gray-300 mt-1">{t.progress}%</div>

                    {t.status === 'error' && <div className="text-xs text-red-300 mt-1">{t.error}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-gray-700 bg-gray-900/30 flex gap-4">
          <button
            onClick={onClearTranslations}
            disabled={!translationTasks.some(t => t.status !== 'processing')}
            className="flex-1 py-3 text-xs font-black text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-xl transition-all uppercase tracking-widest disabled:opacity-30 border border-gray-600"
          >
            Netejar traduccions
          </button>

          <button
            onClick={onClearTranscriptions}
            disabled={!transcriptionTasks.some(t => t.status !== 'queued' && t.status !== 'processing')}
            className="flex-1 py-3 text-xs font-black text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-xl transition-all uppercase tracking-widest disabled:opacity-30 border border-gray-600"
          >
            Netejar transcripcions
          </button>

          <button
            onClick={onClose}
            className="flex-1 py-3 text-xs font-black text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all uppercase tracking-widest border border-blue-500 shadow-lg active:scale-95"
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
  
  const [openDocId, setOpenDocId] = useState<string | null>(null);
  const [openMode, setOpenMode] = useState<OpenMode | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeLang, setActiveLang] = useState<string>('');
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

  const currentDoc = useMemo(() => state.documents.find(d => d.id === openDocId), [openDocId, state.documents]);

  const isResizingRef = useRef(false);
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isLibraryCollapsed) return;
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [isLibraryCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = Math.max(MIN_LIBRARY_WIDTH, Math.min(window.innerWidth, e.clientX));
      setLibraryWidth(newWidth);
    };
    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
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
  if (openMode !== 'editor-video-subs') return;
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
    history.updateDraft(newText);
    if (sourceView === 'csv') history.commit(newText);
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
           <div className="w-32 h-32 bg-gray-800 rounded-full flex items-center justify-center mb-8 border border-gray-700">
              <svg className="w-16 h-16 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
           </div>
           <h2 className="text-3xl font-black uppercase tracking-tighter text-white">Script Editor Pro</h2>
           <p className="text-gray-500 mt-2 max-w-sm">Selecciona un document de la llibreria per començar a treballar o importar un nou guió.</p>
        </div>
      );
    }

    if (openMode === 'lector') return <LectorView documentId={currentDoc.id} onClose={() => handleOpenDocument(null, null, false)} onNavigateDocument={(id) => handleOpenDocument(id, 'lector', false)} editorStyles={editorStyles} col1Width={200} />;
    if (openMode === 'editor-video') return <VideoEditorView {...toolbarProps} currentDoc={currentDoc} isEditing={isEditing} handleTextChange={handleTextChange} handleEditorBackgroundClick={() => {}} />;
    if (openMode === 'editor-video-subs') return <VideoSubtitlesEditorView {...toolbarProps} currentDoc={currentDoc} isEditing={isEditing} handleTextChange={handleTextChange} handleEditorBackgroundClick={() => {}} />;
    if (openMode === 'editor-ssrtlsf') return <SsrtlsfEditorView currentDoc={currentDoc} isEditing={isEditing} onClose={() => handleOpenDocument(null, null, false)} onUpdateContent={(txt) => handleTextChange(txt, 'script')} />;
    if (openMode === 'editor-srt-standalone') return <VideoSrtStandaloneEditorView currentDoc={currentDoc} isEditing={isEditing} onClose={() => handleOpenDocument(null, null, false)} />;

    // --- CORRECCIÓ: Previsualització multimèdia o de text ---
    if (!isEditing) {
      const isMedia = currentDoc.sourceType && MEDIA_EXTS.includes(currentDoc.sourceType.toLowerCase());
      
      if (isMedia) {
        return <MediaPreviewView currentDoc={currentDoc} />;
      }

      return (
        <main className="flex-grow overflow-y-auto bg-[#0f172a] p-8 flex flex-col items-center custom-scrollbar">
           <div className="bg-white shadow-2xl rounded-sm p-12 transition-all duration-300" style={{ width: pageWidth }}>
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
        <main className="flex-grow overflow-y-auto bg-[#0f172a] p-8 flex flex-col items-center custom-scrollbar">
           <div className="bg-white shadow-2xl rounded-sm p-12 transition-all duration-300" style={{ width: pageWidth }}>
              {editorView === 'csv' ? (
                <CsvView content={currentDoc.csvContentByLang[effectiveLang]} setContent={handleTextChange} isEditable={isEditing} pageWidth={pageWidth} />
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
    <div className="h-screen flex bg-[#020617] text-white font-sans overflow-hidden">
      <DirtyGuardModal 
        isOpen={showDirtyModal}
        onSave={() => { history.save((data) => handleTextChange(data, 'script')); confirmNavigation(); }}
        onDiscard={confirmNavigation}
        onCancel={() => { setShowDirtyModal(false); setPendingNav(null); }}
      />
      <aside 
        style={{ width: isLibraryCollapsed ? COLLAPSED_WIDTH : libraryWidth }}
        className={`flex-shrink-0 transition-width duration-300 ease-in-out bg-[#020617] relative z-10`}
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
          className="absolute top-1/2 -right-3 -translate-y-1/2 z-[60] w-6 h-10 flex items-center justify-center rounded-r-md bg-gray-700 hover:bg-blue-600 text-gray-300 hover:text-white transition-colors shadow-lg border border-gray-600 hover:border-blue-500"
          style={{ fontSize: '10px' }}
        >
          {isLibraryCollapsed ? '›' : '‹'}
        </button>
      </aside>
      <section className="flex-1 flex flex-col min-w-0 bg-[#020617]">
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
        <NotificationModal
  translationTasks={state.translationTasks}
  transcriptionTasks={state.transcriptionTasks}
  onClearTranslations={() => dispatch({ type: 'CLEAR_COMPLETED_TASKS' })}
  onClearTranscriptions={() => dispatch({ type: 'CLEAR_COMPLETED_TRANSCRIPTION_TASKS' })}
  onClose={() => setIsNotificationsOpen(false)}
/>
      )}

      {history.isDirty && (
        <div className="fixed bottom-4 right-4 px-3 py-1 bg-amber-500 text-black text-[10px] font-black uppercase rounded-full shadow-lg animate-pulse z-[100]">
          Canvis sense desar
        </div>
      )}
    </div>
  );
};

const USE_BACKEND = process.env.VITE_USE_BACKEND === '1';

const AuthedGate: React.FC = () => {
  const { authed, reason, markAuthed } = useAuth();

  return (
    <>
      <AuthModal
        open={USE_BACKEND && !authed}
        onDone={() => markAuthed()}
        reason={reason}
      />
      {(!USE_BACKEND || authed) && (
        <LibraryProvider>
          <MainAppContent />
        </LibraryProvider>
      )}
    </>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AuthedGate />
    </AuthProvider>
  );
};

export default App;