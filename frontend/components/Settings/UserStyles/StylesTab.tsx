// frontend/components/Settings/UserStyles/StylesTab.tsx
import React, { useState } from 'react';
import { ScriptStylesPanel } from './ScriptStylesPanel';
import { SubtitleStylesPanel } from './SubtitleStylesPanel';
import { HomeStylesPanel } from './HomeStylesPanel';

type SubTab = 'script' | 'subtitle' | 'home';

export const StylesTab: React.FC = () => {
  const [active, setActive] = useState<SubTab>('home');

  const TabButton: React.FC<{ id: SubTab; label: string }> = ({ id, label }) => {
    const isActive = active === id;
    return (
      <button
        onClick={() => setActive(id)}
        className="px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all rounded-md"
        style={isActive
          ? { backgroundColor: 'var(--th-accent)', color: 'var(--th-text-inverse)' }
          : { backgroundColor: 'var(--th-bg-tertiary)', color: 'var(--th-text-muted)' }
        }
      >
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <TabButton id="home"     label="Inici" />
        <TabButton id="subtitle" label="Editor de subtítols" />
        <TabButton id="script"   label="Editor de guions" />
      </div>
      {active === 'script'   && <ScriptStylesPanel />}
      {active === 'subtitle' && <SubtitleStylesPanel />}
      {active === 'home'     && <HomeStylesPanel />}
    </div>
  );
};
