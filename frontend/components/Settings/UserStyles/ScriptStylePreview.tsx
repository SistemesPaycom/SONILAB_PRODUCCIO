// frontend/components/Settings/UserStyles/ScriptStylePreview.tsx
import React from 'react';

const cellStyle = (el: string): React.CSSProperties => ({
  fontFamily: `var(--us-script-${el}-family)`,
  fontSize:   `var(--us-script-${el}-size)`,
  color:      `var(--us-script-${el}-color)`,
  fontWeight: `var(--us-script-${el}-weight)` as any,
  fontStyle:  `var(--us-script-${el}-style)`,
});

export const ScriptStylePreview: React.FC = () => {
  return (
    <div className="p-4 rounded-xl mt-4" style={{ backgroundColor: '#fafafa', border: '1px solid var(--th-border)' }}>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--th-text-muted)' }}>Visualització</div>
      <div className="space-y-1">
        <div style={cellStyle('take')}>TAKE 1</div>
        <div className="flex gap-3">
          <div style={cellStyle('speaker')}>PERSONATGE</div>
          <div style={cellStyle('timecode')}>00:00:01,200</div>
        </div>
        <div style={cellStyle('dialogue')}>
          Aquest és un text d'exemple del diàleg{' '}
          <span style={cellStyle('dialogueparen')}>(amb una nota entre parèntesis)</span>{' '}
          i també{' '}
          <span style={cellStyle('dialoguetcparen')}>(00:01)</span>{' '}
          un codi de temps.
        </div>
      </div>
    </div>
  );
};
