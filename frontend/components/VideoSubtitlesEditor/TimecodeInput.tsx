import React, { useState, useRef, useCallback } from 'react';
import { secondsToSrtTime } from '../../utils/SubtitlesEditor/srtParser';

const srtTimeToSeconds = (tc: string): number | null => {
  const m = tc.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})$/);
  if (!m) return null;
  const h = parseInt(m[1]), min = parseInt(m[2]), sec = parseInt(m[3]), ms = parseInt(m[4]);
  if (min >= 60 || sec >= 60) return null;
  return h * 3600 + min * 60 + sec + ms / 1000;
};

interface TimecodeInputProps {
  value: number;
  label: 'IN' | 'OUT';
  isEditable: boolean;
  onCommit: (newSeconds: number) => void;
}

export const TimecodeInput: React.FC<TimecodeInputProps> = ({ value, label, isEditable, onCommit }) => {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback((e: React.MouseEvent) => {
    if (!isEditable) return;
    e.stopPropagation();
    setInputVal(secondsToSrtTime(value));
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  }, [isEditable, value]);

  const commit = useCallback(() => {
    const parsed = srtTimeToSeconds(inputVal);
    if (parsed !== null && parsed >= 0) onCommit(parsed);
    setEditing(false);
  }, [inputVal, onCommit]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') { setEditing(false); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const step = e.ctrlKey ? 1 : e.shiftKey ? 0.01 : 0.1;
      const newVal = Math.max(0, value + (e.key === 'ArrowUp' ? step : -step));
      onCommit(newVal);
    }
  };

  const handleAdjust = (direction: 1 | -1) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isEditable) return;
    const step = e.ctrlKey ? 1 : e.shiftKey ? 0.01 : 0.1;
    onCommit(Math.max(0, value + direction * step));
  };

  const labelEl = (
    <span className="bg-gray-800/50 px-1 rounded text-[9px] text-gray-400 flex-shrink-0 select-none">{label}</span>
  );

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {labelEl}
        <input
          ref={inputRef}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-[10px] text-yellow-300 bg-gray-900 border border-yellow-500/50 rounded px-0.5 w-[7.5ch] outline-none"
          style={{ fontFamily: "'Courier Prime', monospace" }}
          autoFocus
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5 group/tc" onClick={(e) => e.stopPropagation()}>
      {labelEl}
      {isEditable ? (
        <>
          <button
            className="opacity-0 group-hover/tc:opacity-100 text-[8px] text-gray-500 hover:text-blue-400 transition-opacity leading-none px-px select-none"
            onMouseDown={handleAdjust(-1)}
            tabIndex={-1}
            title="-100ms  |  Shift -10ms  |  Ctrl -1s"
          >◀</button>
          <span
            className="font-mono text-[10px] text-gray-300 hover:text-yellow-300 hover:bg-yellow-500/10 rounded px-0.5 cursor-text transition-colors"
            onClick={startEdit}
            title="Clic per editar el timecode"
          >
            {secondsToSrtTime(value)}
          </span>
          <button
            className="opacity-0 group-hover/tc:opacity-100 text-[8px] text-gray-500 hover:text-blue-400 transition-opacity leading-none px-px select-none"
            onMouseDown={handleAdjust(1)}
            tabIndex={-1}
            title="+100ms  |  Shift +10ms  |  Ctrl +1s"
          >▶</button>
        </>
      ) : (
        <span className="font-mono text-[10px] text-gray-300">{secondsToSrtTime(value)}</span>
      )}
    </div>
  );
};
