// frontend/components/Settings/UserStyles/ScriptStylesPanel.tsx
import React from 'react';
import { useUserStyles } from '../../../context/UserStyles/UserStylesContext';
import { StyleAtomEditor } from './StyleAtomEditor';
import { StylesPresetBar } from './StylesPresetBar';
import { BuiltinPresetNotice } from './BuiltinPresetNotice';
import { ScriptStylePreview } from './ScriptStylePreview';
import type { ScriptEditorStyleSet } from '../../../types/UserStyles/userStylesTypes';

const ROWS: { key: keyof ScriptEditorStyleSet; label: string }[] = [
  { key: 'take',                        label: 'Takes' },
  { key: 'speaker',                     label: 'Noms' },
  { key: 'timecode',                    label: 'Codi de temps' },
  { key: 'dialogue',                    label: 'Text' },
  { key: 'dialogueParentheses',         label: 'Text (parèntesi)' },
  { key: 'dialogueTimecodeParentheses', label: 'TC/Núm. (parèntesi)' },
];

export const ScriptStylesPanel: React.FC = () => {
  const { activePreset, updateAtom } = useUserStyles();
  const preset = activePreset('scriptEditor');

  return (
    <div>
      <StylesPresetBar scope="scriptEditor" />
      {preset.builtin && <BuiltinPresetNotice />}
      {ROWS.map(row => (
        <StyleAtomEditor
          key={row.key}
          label={row.label}
          atom={preset.styles[row.key]}
          onChange={patch => updateAtom('scriptEditor', row.key, patch)}
        />
      ))}
      <ScriptStylePreview />
    </div>
  );
};
