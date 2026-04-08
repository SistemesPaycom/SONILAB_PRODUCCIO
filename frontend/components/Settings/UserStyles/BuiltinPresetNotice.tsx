// frontend/components/Settings/UserStyles/BuiltinPresetNotice.tsx
import React from 'react';

/**
 * Avís visual que es mostra al capdamunt dels 3 paneles d'estils
 * (Script / Subtitle / Home) quan el preset actiu és `builtin: true`,
 * és a dir, el preset 'Per defecte' del sistema. Informa l'usuari que
 * aquest preset no és modificable i el convida a crear-ne un de nou
 * amb el botó 'Nou' de la barra superior.
 */
export const BuiltinPresetNotice: React.FC = () => {
  return (
    <div
      className="flex items-start gap-3 p-4 rounded-xl mb-4"
      style={{
        backgroundColor: 'rgba(59,130,246,0.08)',
        border: '1px solid rgba(59,130,246,0.25)',
      }}
    >
      <span className="text-blue-400 text-lg leading-none mt-0.5">ℹ</span>
      <div className="flex-1 text-sm">
        <p className="font-bold text-blue-300 mb-1">Preset del sistema</p>
        <p style={{ color: 'var(--th-text-secondary)' }}>
          Aquest és el preset &quot;Per defecte&quot; del sistema i no es pot
          modificar. Si vols personalitzar els estils, fes clic a{' '}
          <strong>Nou</strong> a la barra superior per crear un preset nou
          basat en aquest.
        </p>
      </div>
    </div>
  );
};
