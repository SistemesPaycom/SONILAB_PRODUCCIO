// frontend/components/Settings/UserStyles/StyleAtomEditor.tsx
import React from 'react';
import type { StyleAtom } from '../../../types/UserStyles/userStylesTypes';

const FONT_FACES = ['sans-serif', 'serif', 'monospace', 'Arial', 'Verdana', 'Times New Roman', 'Courier Prime, monospace'];

interface Props {
  label: string;
  atom: StyleAtom;
  onChange: (patch: Partial<StyleAtom>) => void;
  /** Tamaño mínimo permitido (px). Por defecto 8. */
  minSize?: number;
  /** Tamaño máximo permitido (px). Por defecto 32. */
  maxSize?: number;
  /** Si és `true`, tots els controls queden deshabilitats i amb opacitat
   * reduïda. S'utilitza quan el preset actiu és `builtin: true` i no es
   * pot modificar directament. */
  disabled?: boolean;
}

export const StyleAtomEditor: React.FC<Props> = ({ label, atom, onChange, minSize = 8, maxSize = 32, disabled = false }) => {
  const cursorClass = disabled ? 'cursor-not-allowed' : '';
  const containerOpacity = disabled ? 'opacity-50' : '';
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-[150px_1fr] items-center gap-4 py-3 border-b last:border-b-0 ${containerOpacity}`}
      style={{ borderColor: 'var(--th-border)' }}
    >
      <h4 className="font-semibold md:text-right" style={{ color: 'var(--th-text-primary)' }}>{label}</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--th-text-muted)' }}>Tipografia</label>
          <select
            value={atom.fontFamily}
            onChange={e => onChange({ fontFamily: e.target.value })}
            disabled={disabled}
            className={`w-full rounded-md px-2 py-1 text-sm ${cursorClass}`}
            style={{ backgroundColor: 'var(--th-bg-tertiary)', border: '1px solid var(--th-border)', color: 'var(--th-text-primary)' }}
          >
            {FONT_FACES.map(f => <option key={f} value={f}>{f}</option>)}
            {/* Si la familia actual no està a la llista, l'afegim per no perdre-la */}
            {!FONT_FACES.includes(atom.fontFamily) && (
              <option value={atom.fontFamily}>{atom.fontFamily}</option>
            )}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--th-text-muted)' }}>Mida (px)</label>
          <input
            type="number"
            min={minSize}
            max={maxSize}
            value={atom.fontSize}
            disabled={disabled}
            onChange={e => {
              const n = parseInt(e.target.value, 10);
              if (!Number.isNaN(n)) onChange({ fontSize: Math.max(minSize, Math.min(maxSize, n)) });
            }}
            className={`w-full rounded-md px-2 py-1 text-sm ${cursorClass}`}
            style={{ backgroundColor: 'var(--th-bg-tertiary)', border: '1px solid var(--th-border)', color: 'var(--th-text-primary)' }}
          />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--th-text-muted)' }}>Color</label>
          <input
            type="color"
            value={atom.color}
            disabled={disabled}
            onChange={e => onChange({ color: e.target.value })}
            className={`w-full h-8 p-0 bg-transparent border-none rounded-md ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          />
        </div>
        <div className="flex items-center gap-3 pb-1">
          <label className={`flex items-center gap-1.5 text-sm ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`} style={{ color: 'var(--th-text-secondary)' }}>
            <input type="checkbox" checked={atom.bold}   onChange={e => onChange({ bold:   e.target.checked })} disabled={disabled} className="w-4 h-4 rounded" />
            Negreta
          </label>
          <label className={`flex items-center gap-1.5 text-sm ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`} style={{ color: 'var(--th-text-secondary)' }}>
            <input type="checkbox" checked={atom.italic} onChange={e => onChange({ italic: e.target.checked })} disabled={disabled} className="w-4 h-4 rounded" />
            Cursiva
          </label>
        </div>
      </div>
    </div>
  );
};
