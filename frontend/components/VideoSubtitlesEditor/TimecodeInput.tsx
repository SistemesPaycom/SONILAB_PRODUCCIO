import React, { useState, useRef, useCallback, useEffect } from 'react';
import { secondsToSrtTime } from '../../utils/SubtitlesEditor/srtParser';

// ── Timecode segmentat — tipus i constants ────────────────────────────────────
type Field = 'hh' | 'mm' | 'ss' | 'ms';
const FIELDS: Field[] = ['hh', 'mm', 'ss', 'ms'];
const MAX_DIGITS: Record<Field, number> = { hh: 2, mm: 2, ss: 2, ms: 3 };

/**
 * Converteix segons a camps segmentats.
 * NO usa secondsToSrtTime: Math.round pot produir ms=1000, trencant qualsevol regex.
 */
const parseIntoFields = (secs: number): Record<Field, string> => {
  const v = Math.max(0, secs);
  const hh = Math.min(99, Math.floor(v / 3600));
  const mm = Math.floor((v % 3600) / 60);
  const ss = Math.floor(v % 60);
  const ms = Math.min(999, Math.round((v % 1) * 1000));
  return {
    hh: String(hh).padStart(2, '0'),
    mm: String(mm).padStart(2, '0'),
    ss: String(ss).padStart(2, '0'),
    ms: String(ms).padStart(3, '0'),
  };
};

interface TimecodeInputProps {
  value: number;
  label: 'IN' | 'OUT';
  isEditable: boolean;
  onCommit: (newSeconds: number) => void;
}

export const TimecodeInput: React.FC<TimecodeInputProps> = ({ value, label, isEditable, onCommit }) => {
  const [editing, setEditing] = useState(false);

  // ── Estat segmentat ───────────────────────────────────────────────────────
  const [fields, setFields] = useState<Record<Field, string>>(parseIntoFields(0));

  const hhRef = useRef<HTMLInputElement>(null);
  const mmRef = useRef<HTMLInputElement>(null);
  const ssRef = useRef<HTMLInputElement>(null);
  const msRef = useRef<HTMLInputElement>(null);
  const fieldRefs: Record<Field, React.RefObject<HTMLInputElement>> = {
    hh: hhRef, mm: mmRef, ss: ssRef, ms: msRef,
  };

  const committingRef = useRef(false);

  useEffect(() => {
    if (!editing) return;
    setFields(parseIntoFields(value));
  }, [value, editing]);

  const startEdit = useCallback((e: React.MouseEvent) => {
    if (!isEditable) return;
    e.stopPropagation();
    committingRef.current = false;
    setFields(parseIntoFields(value));
    setEditing(true);
    requestAnimationFrame(() => {
      fieldRefs.hh.current?.focus();
      fieldRefs.hh.current?.select();
    });
  }, [isEditable, value]);

  const commit = useCallback(() => {
    if (committingRef.current) return;
    committingRef.current = true;
    let hh = parseInt(fields.hh) || 0;
    let mm = parseInt(fields.mm) || 0;
    let ss = parseInt(fields.ss) || 0;
    let ms = parseInt(fields.ms) || 0;
    // carry-up
    if (ms >= 1000) { ss += Math.floor(ms / 1000); ms %= 1000; }
    if (ss >= 60)   { mm += Math.floor(ss / 60);   ss %= 60;   }
    if (mm >= 60)   { hh += Math.floor(mm / 60);   mm %= 60;   }
    hh = Math.min(hh, 99);
    // carry-down (Nuendo-style)
    if (ms < 0) { const b = Math.ceil(-ms / 1000); ss -= b; ms += b * 1000; }
    if (ss < 0) { const b = Math.ceil(-ss / 60);   mm -= b; ss += b * 60;   }
    if (mm < 0) { const b = Math.ceil(-mm / 60);   hh -= b; mm += b * 60;   }
    if (hh < 0) { hh = 0; mm = 0; ss = 0; ms = 0; }
    onCommit(hh * 3600 + mm * 60 + ss + ms / 1000);
    setEditing(false);
    setTimeout(() => { committingRef.current = false; }, 0);
  }, [fields, onCommit]);

  // ── Helpers de navegació interna ──────────────────────────────────────────────
  const nextField = (f: Field): Field => FIELDS[(FIELDS.indexOf(f) + 1) % FIELDS.length];
  const prevField = (f: Field): Field => FIELDS[(FIELDS.indexOf(f) - 1 + FIELDS.length) % FIELDS.length];
  const focusField = (field: Field) => {
    requestAnimationFrame(() => {
      fieldRefs[field].current?.focus();
      fieldRefs[field].current?.select();
    });
  };

  const handleChange = (field: Field) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    setFields(prev => ({ ...prev, [field]: val }));
    if (val.length >= MAX_DIGITS[field] && field !== 'ms') {
      focusField(nextField(field));
    }
  };

  const handleKeyDown = (field: Field) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      setEditing(false);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      e.shiftKey ? focusField(prevField(field)) : focusField(nextField(field));
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const step = e.ctrlKey ? 1 : e.shiftKey ? 0.01 : 0.1;
      onCommit(Math.max(0, value + (e.key === 'ArrowUp' ? step : -step)));
    }
  };

  const handleContainerBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      commit();
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
    <span
      className="rounded flex-shrink-0 select-none inline-block text-center"
      style={{
        width: '4ch',
        backgroundColor: 'var(--th-editor-label-bg)',
        fontFamily: 'var(--us-sub-timecode-family)',
        fontSize:   'var(--us-sub-timecode-size)',
        color:      'var(--us-sub-timecode-color)',
        fontWeight: 'var(--us-sub-timecode-weight)' as any,
        fontStyle:  'var(--us-sub-timecode-style)',
      }}
    >{label}</span>
  );

  if (editing) {
    const segStyle: React.CSSProperties = {
      background: 'transparent',
      border: 'none',
      color: '#facc15',
      textAlign: 'center' as const,
      outline: 'none',
      padding: '0 2px',
      fontFamily: 'var(--us-sub-timecode-family)',
      fontSize:   'var(--us-sub-timecode-size)',
      fontWeight: 'var(--us-sub-timecode-weight)' as any,
      fontStyle:  'var(--us-sub-timecode-style)',
    };
    const sepStyle: React.CSSProperties = {
      color: '#6b7280',
      userSelect: 'none' as const,
      fontFamily: 'var(--us-sub-timecode-family)',
      fontSize:   'var(--us-sub-timecode-size)',
      padding: '0 1px',
      flexShrink: 0,
    };
    return (
      <div
        className="flex items-center gap-1"
        onBlur={handleContainerBlur}
        onClick={e => e.stopPropagation()}
      >
        {labelEl}
        <div
          className="flex items-center rounded border border-yellow-500/50"
          style={{ background: 'var(--th-editor-label-bg)', padding: '3px 5px' }}
        >
          <input ref={hhRef} style={{ ...segStyle, width: 20 }}
            value={fields.hh} maxLength={2}
            onChange={handleChange('hh')} onKeyDown={handleKeyDown('hh')}
            onFocus={e => e.target.select()} />
          <span style={sepStyle}>:</span>
          <input ref={mmRef} style={{ ...segStyle, width: 20 }}
            value={fields.mm} maxLength={2}
            onChange={handleChange('mm')} onKeyDown={handleKeyDown('mm')}
            onFocus={e => e.target.select()} />
          <span style={sepStyle}>:</span>
          <input ref={ssRef} style={{ ...segStyle, width: 20 }}
            value={fields.ss} maxLength={2}
            onChange={handleChange('ss')} onKeyDown={handleKeyDown('ss')}
            onFocus={e => e.target.select()} />
          <span style={sepStyle}>,</span>
          <input ref={msRef} style={{ ...segStyle, width: 30 }}
            value={fields.ms} maxLength={3}
            onChange={handleChange('ms')} onKeyDown={handleKeyDown('ms')}
            onFocus={e => e.target.select()} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5 group/tc" onClick={(e) => e.stopPropagation()}>
      {labelEl}
      {isEditable ? (
        <>
          <button
            className="opacity-0 group-hover/tc:opacity-100 transition-opacity leading-none px-px select-none"
            style={{
              fontFamily: 'var(--us-sub-timecode-family)',
              fontSize:   'var(--us-sub-timecode-size)',
              color:      'var(--us-sub-timecode-color)',
              fontWeight: 'var(--us-sub-timecode-weight)' as any,
              fontStyle:  'var(--us-sub-timecode-style)',
            }}
            onMouseDown={handleAdjust(-1)}
            tabIndex={-1}
            title="-100ms  |  Shift -10ms  |  Ctrl -1s"
          >◀</button>
          <span
            className="hover:text-yellow-600 hover:bg-yellow-500/10 rounded px-0.5 cursor-text transition-colors"
            style={{
              fontFamily: 'var(--us-sub-timecode-family)',
              fontSize:   'var(--us-sub-timecode-size)',
              color:      'var(--us-sub-timecode-color)',
              fontWeight: 'var(--us-sub-timecode-weight)' as any,
              fontStyle:  'var(--us-sub-timecode-style)',
            }}
            onClick={startEdit}
            title="Clic per editar el timecode"
          >
            {secondsToSrtTime(value)}
          </span>
          <button
            className="opacity-0 group-hover/tc:opacity-100 transition-opacity leading-none px-px select-none"
            style={{
              fontFamily: 'var(--us-sub-timecode-family)',
              fontSize:   'var(--us-sub-timecode-size)',
              color:      'var(--us-sub-timecode-color)',
              fontWeight: 'var(--us-sub-timecode-weight)' as any,
              fontStyle:  'var(--us-sub-timecode-style)',
            }}
            onMouseDown={handleAdjust(1)}
            tabIndex={-1}
            title="+100ms  |  Shift +10ms  |  Ctrl +1s"
          >▶</button>
        </>
      ) : (
        <span
          style={{
            fontFamily: 'var(--us-sub-timecode-family)',
            fontSize:   'var(--us-sub-timecode-size)',
            color:      'var(--us-sub-timecode-color)',
            fontWeight: 'var(--us-sub-timecode-weight)' as any,
            fontStyle:  'var(--us-sub-timecode-style)',
          }}
        >{secondsToSrtTime(value)}</span>
      )}
    </div>
  );
};
