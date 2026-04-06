// frontend/components/Settings/UserStyles/HomeStylesPanel.tsx
import React from 'react';
import { useUserStyles } from '../../../context/UserStyles/UserStylesContext';
import { StyleAtomEditor } from './StyleAtomEditor';
import { StylesPresetBar } from './StylesPresetBar';
import { HomeStylePreview } from './HomeStylePreview';
import type { HomeStyleSet } from '../../../types/UserStyles/userStylesTypes';

// Els elements `tableHeader`, `navTabs` i `breadcrumb` amaguen el selector de
// color perquè el seu color ve del tema admin (o d'estats actiu/inactiu) i no
// del preset d'usuari. Exposar-lo confondria l'usuari — els canvis no es
// veurien reflectits a la UI real.
const ROWS: { key: keyof HomeStyleSet; label: string; hideColor?: boolean }[] = [
  { key: 'fileName',    label: "Nom d'arxiu" },
  { key: 'formatLabel', label: 'Format' },
  { key: 'dateTime',    label: 'Data i hora' },
  { key: 'tableHeader', label: 'Capçalera taula',       hideColor: true },
  { key: 'navTabs',     label: 'Pestanyes navegació',   hideColor: true },
  { key: 'breadcrumb',  label: 'Breadcrumb',            hideColor: true },
];

export const HomeStylesPanel: React.FC = () => {
  const { activePreset, updateAtom } = useUserStyles();
  const preset = activePreset('home');

  return (
    <div>
      <StylesPresetBar scope="home" />
      {ROWS.map(row => (
        <StyleAtomEditor
          key={row.key}
          label={row.label}
          atom={preset.styles[row.key]}
          onChange={patch => updateAtom('home', row.key, patch)}
          hideColor={row.hideColor}
        />
      ))}
      <HomeStylePreview />
    </div>
  );
};
