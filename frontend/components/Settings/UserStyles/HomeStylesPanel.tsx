// frontend/components/Settings/UserStyles/HomeStylesPanel.tsx
import React from 'react';
import { useUserStyles } from '../../../context/UserStyles/UserStylesContext';
import { StyleAtomEditor } from './StyleAtomEditor';
import { StylesPresetBar } from './StylesPresetBar';
import { BuiltinPresetNotice } from './BuiltinPresetNotice';
import { HomeStylePreview } from './HomeStylePreview';
import type { HomeStyleSet } from '../../../types/UserStyles/userStylesTypes';

const ROWS: { key: keyof HomeStyleSet; label: string }[] = [
  { key: 'fileName',    label: "Nom d'arxiu" },
  { key: 'formatLabel', label: 'Format' },
  { key: 'dateTime',    label: 'Data i hora' },
  { key: 'tableHeader', label: 'Capçalera taula' },
  { key: 'navTabs',     label: 'Pestanyes navegació' },
  { key: 'breadcrumb',  label: 'Breadcrumb' },
];

export const HomeStylesPanel: React.FC = () => {
  const { activePreset, updateAtom } = useUserStyles();
  const preset = activePreset('home');

  return (
    <div>
      <StylesPresetBar scope="home" />
      {preset.builtin && <BuiltinPresetNotice />}
      {ROWS.map(row => (
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
