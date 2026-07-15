// TEMP-HARNESS (SPS-0036) — s'esborra en acabar la verificació.
// Munta la vista REAL (VideoSubtitlesEditorView) dins dels providers reals, sense backend, amb un
// WAV sintètic com a media. Serveix per comptar quants cops es re-renderitza el WaveformTimeline
// REAL durant la reproducció, amb el cablejat REAL del pare (no una reimplementació).
import React, { useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './context/Theme/ThemeContext';
import { AuthProvider } from './context/Auth/AuthContext';
import { UserStylesProvider } from './context/UserStyles/UserStylesContext';
import { LibraryProvider, useLibrary } from './context/Library/SonilabLibraryContext';
import { VideoSubtitlesEditorView } from './components/VideoSubtitlesEditor/VideoSubtitlesEditorView';
import { api } from './services/api';
import type { Document } from './appTypes';

const SRT_ID = 'harness-srt';
const MEDIA_ID = 'harness-media';
const DURATION = 30;

function makeWav(durationSec: number, sampleRate = 8000): Blob {
  const n = durationSec * sampleRate;
  const buf = new ArrayBuffer(44 + n * 2);
  const dv = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true); dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  w(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const env = 0.35 * (0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 3));
    dv.setInt16(44 + i * 2, Math.round(env * 32767 * Math.sin(2 * Math.PI * 220 * t)), true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}
const BLOB_URL = URL.createObjectURL(makeWav(DURATION));

const PEAK_COUNT = DURATION * 100;
const FAKE_PEAKS = Array.from({ length: PEAK_COUNT }, (_, i) => 0.35 * (0.5 + 0.5 * Math.sin((2 * Math.PI * (i / 100)) / 3)));
(api as any).streamUrlWithToken = () => BLOB_URL;
(api as any).streamUrl = () => BLOB_URL;
(api as any).getWaveform = async () => ({
  cached: true,
  waveform: { peaks: FAKE_PEAKS, peakCount: PEAK_COUNT, duration: DURATION, sampleRate: 44100 },
});

localStorage.removeItem('sonilab_token');

const SRT = [
  '1', '00:00:02,000 --> 00:00:05,000', 'Primer subtitol', '',
  '2', '00:00:08,000 --> 00:00:11,000', 'Segon subtitol', '',
  '3', '00:00:14,000 --> 00:00:17,000', 'Tercer subtitol', '',
  '4', '00:00:20,000 --> 00:00:23,000', 'Quart subtitol', '',
].join('\n');

const baseDoc = (id: string, name: string, sourceType: string, content: string): Document => ({
  id, name, parentId: null,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  isDeleted: false, type: 'document',
  contentByLang: { _unassigned: content },
  csvContentByLang: { _unassigned: '' },
  sourceLang: null, isLocked: false, sourceType,
  refTargetId: null, media: null, linkedMediaId: null,
  characters: [], takes: [], layers: [], strokes: [],
  textAnnotations: [], textHighlights: [], annotationLinks: [],
  takeStatuses: {}, takeNotes: {}, characterNotes: [],
});

const SRT_DOC = baseDoc(SRT_ID, 'harness.srt', 'srt', SRT);
const MEDIA_DOC: Document = { ...baseDoc(MEDIA_ID, 'harness.wav', 'wav', ''), media: { size: 1 } };

localStorage.setItem('snlbpro_library_v3', JSON.stringify({ folders: [], documents: [SRT_DOC, MEDIA_DOC] }));

// El SET_INITIAL_STATE de LibraryDataContext esborra syncRequest: cal esperar que la biblioteca hagi carregat.
const SyncSeeder: React.FC = () => {
  const { state, dispatch } = useLibrary();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || (state as any).isLoading) return;
    if (!state.documents.some((d: any) => d.id === MEDIA_ID)) return;
    done.current = true;
    dispatch({ type: 'TRIGGER_SYNC_REQUEST', payload: { docId: MEDIA_ID, type: 'media' } } as any);
  }, [state, dispatch]);
  return null;
};

const noop = () => {};

const Harness: React.FC = () => {
  const doc = useMemo(() => SRT_DOC, []);
  return (
    <ThemeProvider>
      <AuthProvider>
        <UserStylesProvider>
          <LibraryProvider>
            <SyncSeeder />
            <div style={{ height: '100vh', width: '100vw' }}>
              <VideoSubtitlesEditorView
                currentDoc={doc}
                isEditing={true}
                layout={'cols' as any}
                tabSize={4}
                col1Width={200}
                pageWidth="794px"
                editorView="script"
                activeLang="_unassigned"
                onLayoutChange={noop}
                onTabSizeChange={noop}
                onPageWidthChange={noop}
                onEditorViewChange={noop}
                onActiveLangChange={noop}
                onSetSourceLang={noop}
                onTranslate={async () => {}}
                handleTextChange={noop}
                handleEditorBackgroundClick={noop as any}
              />
            </div>
          </LibraryProvider>
        </UserStylesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

createRoot(document.getElementById('root')!).render(<Harness />);
