// frontend/components/Settings/UserStyles/SubtitleStylePreview.tsx
import React from 'react';

const cellStyle = (el: string): React.CSSProperties => ({
  fontFamily: `var(--us-sub-${el}-family)`,
  fontSize:   `var(--us-sub-${el}-size)`,
  color:      `var(--us-sub-${el}-color)`,
  fontWeight: `var(--us-sub-${el}-weight)` as any,
  fontStyle:  `var(--us-sub-${el}-style)`,
});

export const SubtitleStylePreview: React.FC = () => {
  return (
    <div className="p-4 rounded-xl mt-4" style={{ backgroundColor: 'var(--th-editor-bg, #1a1a1a)', border: '1px solid var(--th-border)' }}>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--th-text-muted)' }}>Visualització</div>
      <div
        className="grid items-center"
        style={{
          gridTemplateColumns: 'var(--us-sub-grid-columns)',
          gridTemplateRows: 'var(--us-sub-row-height)',
        }}
      >
        <div style={cellStyle('takelabel')}>TAKE 1</div>
        <div style={cellStyle('idcps')}>#001 · 12cps</div>
        <div style={cellStyle('timecode')}>00:00:01,200 → 00:00:03,600</div>
        <div style={cellStyle('charcounter')}>32</div>
        <div style={cellStyle('content')}>Aquest és un text d'exemple del subtítol.</div>
      </div>
      <div className="flex gap-2 mt-2">
        <span style={cellStyle('actionbuttons')}>+ Sobre</span>
        <span style={cellStyle('actionbuttons')}>+ Sota</span>
        <span style={cellStyle('actionbuttons')}>Dividir</span>
      </div>
    </div>
  );
};
