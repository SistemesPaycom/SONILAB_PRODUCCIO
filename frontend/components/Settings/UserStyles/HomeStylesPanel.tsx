// frontend/components/Settings/UserStyles/HomeStylesPanel.tsx
import React from 'react';
import { useUserStyles } from '../../../context/UserStyles/UserStylesContext';
import { StyleAtomEditor } from './StyleAtomEditor';
import { StylesPresetBar } from './StylesPresetBar';
import { BuiltinPresetNotice } from './BuiltinPresetNotice';
import { HomeStylePreview } from './HomeStylePreview';
import type { HomeStyleSet } from '../../../types/UserStyles/userStylesTypes';

const ROWS_GENERAL: { key: keyof HomeStyleSet; label: string }[] = [
  { key: 'fileName',    label: "Nom d'arxiu" },
  { key: 'formatLabel', label: 'Format' },
  { key: 'dateTime',    label: 'Data i hora' },
  { key: 'tableHeader', label: 'Capçalera taula' },
  { key: 'navTabs',     label: 'Pestanyes navegació' },
  { key: 'breadcrumb',  label: 'Breadcrumb' },
];

const ROWS_CREATE_PROJECT: { key: keyof HomeStyleSet; label: string }[] = [
  { key: 'createProjectSelect', label: 'Vídeo / SRT seleccionat' },
];

export const HomeStylesPanel: React.FC = () => {
  const { activePreset, updateAtom } = useUserStyles();
  const preset = activePreset('home');

  return (
    <div>
      <StylesPresetBar scope="home" />
      {preset.builtin && <BuiltinPresetNotice />}

      {ROWS_GENERAL.map(row => (
        <StyleAtomEditor
          key={row.key}
          label={row.label}
          atom={preset.styles[row.key]}
          onChange={patch => updateAtom('home', row.key, patch)}
        />
      ))}

      <div className="border-t border-[var(--th-border)] my-3" />
      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 px-1 mb-2">
        Finestra creació de projectes
      </div>
      {ROWS_CREATE_PROJECT.map(row => (
        <StyleAtomEditor
          key={row.key}
          label={row.label}
          atom={preset.styles[row.key]}
          onChange={patch => updateAtom('home', row.key, patch)}
        />
      ))}

      <HomeStylePreview />
    </div>
  );
};
