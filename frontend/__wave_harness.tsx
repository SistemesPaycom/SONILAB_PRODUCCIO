// TEMP-HARNESS (SPS-0035) — s'esborra en acabar la verificació.
// Munta el WaveformTimeline REAL (export memoitzat) amb el useDocumentHistory REAL i simula el pare
// standalone: re-render a cada tick de currentTime (250 ms) amb isPlaying=true.
//   ?mode=old  → handlers cablejats com ABANS del fix (funció plana + arrow inline + deps a l'objecte)
//   ?mode=new  → handlers cablejats com DESPRÉS del fix (deps als mètodes)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import WaveformTimeline from './components/VideoEditor/WaveformTimeline';
import { useDocumentHistory } from './hooks/useDocumentHistory';
import type { Segment, Id } from './appTypes';

const MODE = new URLSearchParams(location.search).get('mode') === 'old' ? 'old' : 'new';
(window as any).__mode = MODE;

const INITIAL: Segment[] = [
  { id: 1, startTime: 0, endTime: 2, originalText: 'un' },
  { id: 2, startTime: 3, endTime: 5, originalText: 'dos' },
];

const Harness: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying] = useState(true);
  const [activeSegmentId] = useState<number | null>(1);
  const isEditing = true;
  const videoRef = useRef<HTMLVideoElement>(null);

  const subsHistory = useDocumentHistory<Segment[]>('harness-doc', INITIAL);
  const segments = subsHistory.present;

  useEffect(() => {
    const id = window.setInterval(() => setCurrentTime((t) => t + 0.25), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    (window as any).__parentRenders = ((window as any).__parentRenders ?? 0) + 1;
  });

  const onSeek = useCallback((_t: number) => {}, []);
  const handleSegmentClick = useCallback((_id: Id) => {}, [segments, onSeek]);

  const applyUpdate = (id: Id, s: number, e: number) => {
    (window as any).__updates = ((window as any).__updates ?? 0) + 1;
    subsHistory.updateDraft((prev) =>
      prev.map((seg) => (seg.id === id ? { ...seg, startTime: s, endTime: e } : seg)),
    );
  };
  const applyCommit = () => {
    (window as any).__commits = ((window as any).__commits ?? 0) + 1;
    subsHistory.commit();
  };
  (window as any).__segments = segments;
  (window as any).__canUndo = subsHistory.canUndo;

  // ── ABANS del fix ──
  const updateOld = (id: Id, s: number, e: number) => {
    if (!isEditing) return;
    applyUpdate(id, s, e);
  };
  const cueOld = useCallback(
    (_t: number) => { subsHistory.commit(); },
    [isEditing, activeSegmentId, segments, subsHistory],
  );

  // ── DESPRÉS del fix ──
  const updateNew = useCallback(
    (id: Id, s: number, e: number) => {
      if (!isEditing) return;
      applyUpdate(id, s, e);
    },
    [isEditing, subsHistory.updateDraft],
  );
  const updateEndNew = useCallback(() => {
    if (!isEditing) return;
    applyCommit();
  }, [isEditing, subsHistory.commit]);
  const cueNew = useCallback(
    (_t: number) => { subsHistory.commit(); },
    [isEditing, activeSegmentId, segments, subsHistory.commit],
  );

  const old = MODE === 'old';
  const cue = old ? cueOld : cueNew;

  return (
    <div style={{ height: 150, width: '100%' }}>
      <video ref={videoRef} style={{ display: 'none' }} />
      <WaveformTimeline
        videoFile={null}
        mediaDocId={null}
        segments={segments}
        duration={30}
        currentTime={currentTime}
        onSeek={onSeek}
        isPlaying={isPlaying}
        videoRef={videoRef as React.RefObject<HTMLVideoElement>}
        activeId={activeSegmentId}
        onSegmentUpdate={old ? updateOld : updateNew}
        onSegmentUpdateEnd={old ? () => subsHistory.commit() : updateEndNew}
        onSegmentClick={handleSegmentClick}
        onSetCueStart={cue}
        onSetCueEnd={cue}
        onSetCueStartKeepDuration={cue}
        onRippleFromCue={cue}
        autoScroll={true}
        scrollMode="page"
        onUndo={() => subsHistory.undo()}
        onRedo={() => subsHistory.redo()}
        canUndo={subsHistory.canUndo}
        canRedo={subsHistory.canRedo}
        autoScrollWave={true}
        onToggleAutoScrollWave={() => {}}
        scrollModeWave="page"
        onScrollModeChangeWave={() => {}}
        scrollModeLocked={true}
        autosaveEnabled={true}
        onToggleAutosave={() => {}}
        onSave={() => {}}
        onExportSrt={() => {}}
        minGapMs={160}
        minDurationMs={1000}
      />
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<Harness />);
