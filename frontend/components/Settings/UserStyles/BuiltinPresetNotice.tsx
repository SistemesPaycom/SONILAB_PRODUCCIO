// frontend/components/Settings/UserStyles/BuiltinPresetNotice.tsx
import React from 'react';
import { useAuth } from '../../../context/Auth/AuthContext';

/**
 * Avís visual que es mostra als panells d'estils quan el preset actiu és builtin.
 * Per a admins: explica que poden editar els estils globals.
 * Per a usuaris: explica que poden editar i guardar amb un nom nou.
 */
export const BuiltinPresetNotice: React.FC = () => {
  const { isAdmin } = useAuth();

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
        {isAdmin ? (
          <p style={{ color: 'var(--th-text-secondary)' }}>
            Ets administrador. Pots editar els estils globals de la plataforma.
            Edita els valors i fes clic a <strong>Guardar</strong>. Escriu{' '}
            <strong>Per defecte</strong> per aplicar els canvis a tots els usuaris.
          </p>
        ) : (
          <p style={{ color: 'var(--th-text-secondary)' }}>
            Aquest és el preset &quot;Per defecte&quot; del sistema. Edita els
            valors i fes clic a <strong>Guardar</strong> per crear un preset
            propi basat en aquest.
          </p>
        )}
      </div>
    </div>
  );
};
