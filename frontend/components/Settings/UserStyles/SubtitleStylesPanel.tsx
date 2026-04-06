// frontend/components/Settings/UserStyles/SubtitleStylesPanel.tsx
import React from 'react';
import { useUserStyles } from '../../../context/UserStyles/UserStylesContext';
import { StyleAtomEditor } from './StyleAtomEditor';
import { StylesPresetBar } from './StylesPresetBar';
import { SubtitleStylePreview } from './SubtitleStylePreview';
import type { SubtitleEditorStyleSet } from '../../../types/UserStyles/userStylesTypes';

const ROWS: { key: keyof SubtitleEditorStyleSet; label: string }[] = [
  { key: 'content',       label: 'Text del subtítol' },
  { key: 'timecode',      label: 'Codi de temps (IN/OUT)' },
  { key: 'idCps',         label: 'ID i CPS' },
  { key: 'takeLabel',     label: 'Etiqueta TAKE' },
  { key: 'charCounter',   label: 'Comptador caràcters' },
  { key: 'actionButtons', label: "Botons d'acció" },
];

export const SubtitleStylesPanel: React.FC = () => {
  const { activePreset, updateAtom } = useUserStyles();
  const preset = activePreset('subtitleEditor');

  return (
    <div>
      <StylesPresetBar scope="subtitleEditor" />
      {ROWS.map(row => (
        <StyleAtomEditor
          key={row.key}
          label={row.label}
          atom={preset.styles[row.key]}
          onChange={patch => updateAtom('subtitleEditor', row.key, patch)}
        />
      ))}
      <SubtitleStylePreview />
    </div>
  );
};
