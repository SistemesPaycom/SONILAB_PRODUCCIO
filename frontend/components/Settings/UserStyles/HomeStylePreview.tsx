// frontend/components/Settings/UserStyles/HomeStylePreview.tsx
import React from 'react';

/**
 * Preview fidel dels estils aplicats al home/llibreria real.
 *
 * Els elements `fileName`, `format` i `datetime` són els únics que permeten
 * personalitzar el color — els altres tres (`navtabs`, `breadcrumb`,
 * `tableheader`) llegeixen el color del tema admin a la UI real, per això
 * en aquesta preview també usem les mateixes CSS vars `--th-*` per evitar
 * mentir a l'usuari.
 */
const cellStyle = (el: string, colorOverride?: string): React.CSSProperties => ({
  fontFamily: `var(--us-home-${el}-family)`,
  fontSize:   `var(--us-home-${el}-size)`,
  color:      colorOverride ?? `var(--us-home-${el}-color)`,
  fontWeight: `var(--us-home-${el}-weight)` as any,
  fontStyle:  `var(--us-home-${el}-style)`,
});

export const HomeStylePreview: React.FC = () => {
  return (
    <div className="p-4 rounded-xl mt-4" style={{ backgroundColor: 'var(--th-bg-secondary)', border: '1px solid var(--th-border)' }}>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--th-text-muted)' }}>Visualització</div>
      <div className="flex gap-3 mb-2">
        <span style={cellStyle('navtabs', '#ffffff')}>Files</span>
        <span style={cellStyle('navtabs', '#e5e7eb')}>Projectes</span>
        <span style={cellStyle('navtabs', '#e5e7eb')}>Media</span>
      </div>
      <div className="mb-2" style={cellStyle('breadcrumb', 'var(--th-text-secondary)')}>
        Files / Projecte demo / Capítol 1
      </div>
      <div className="grid grid-cols-[1fr_120px_140px] gap-3 mb-2 uppercase tracking-widest" style={cellStyle('tableheader', 'var(--th-text-muted)')}>
        <span>Nom</span><span>Format</span><span>Data i hora</span>
      </div>
      <div className="grid grid-cols-[1fr_120px_140px] gap-3 py-1">
        <span style={cellStyle('filename')}>capitol_01.snlbpro</span>
        <span style={cellStyle('format')}>SNLBPRO</span>
        <span style={cellStyle('datetime')}>06/04/2026 14:23</span>
      </div>
      <div className="grid grid-cols-[1fr_120px_140px] gap-3 py-1">
        <span style={cellStyle('filename')}>capitol_01.srt</span>
        <span style={cellStyle('format')}>SRT</span>
        <span style={cellStyle('datetime')}>06/04/2026 14:25</span>
      </div>
    </div>
  );
};
