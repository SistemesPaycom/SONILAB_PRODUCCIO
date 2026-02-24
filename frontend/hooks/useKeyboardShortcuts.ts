
import { useEffect, useCallback } from 'react';
import { AppShortcuts, Shortcut } from '../types';
import { DEFAULT_SHORTCUTS, LOCAL_STORAGE_KEYS } from '../constants';

type ActionHandler = (action: string) => void;

/**
 * Hook per gestionar dreceres de teclat globals o per mòdul.
 * @param appId El mòdul de l'app actiu per filtrar dreceres.
 * @param onAction Callback que rep l'identificador de l'acció detectada.
 */
export function useKeyboardShortcuts(appId: keyof AppShortcuts, onAction: ActionHandler) {
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // 1. Obtenir dreceres de localStorage o defaults
    const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.SHORTCUTS);
    const shortcuts: AppShortcuts = stored ? JSON.parse(stored) : DEFAULT_SHORTCUTS;
    
    // Unim les dreceres de la pestanya General amb les específiques de l'App activa
    const appShortcuts = [
        ...(shortcuts.general || []),
        ...(shortcuts[appId] || [])
    ];

    // 2. Detectar si estem en un context d'edició
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || 
                    target.tagName === 'TEXTAREA' || 
                    target.isContentEditable;

    // 3. Normalitzar la combinació premuda per comparar
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    
    // Mapeig de noms de tecles comuns per a les nostres dreceres
    let keyName = e.key;
    if (keyName === ' ') keyName = 'Space';
    if (keyName === '+') keyName = 'Plus';
    if (keyName === '-') keyName = 'Minus';
    if (keyName === ',') keyName = 'Comma';
    
    // Si la tecla és una lletra/número i no hi ha modificadors, només l'afegim si no estem en un input
    const hasMod = e.ctrlKey || e.metaKey || e.altKey;
    if (isInput && !hasMod && keyName.length === 1) return;

    // Ignorar si només s'ha premut una tecla modificadora
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

    // Normalització específica per a comparació (sense espais)
    parts.push(keyName);
    const pressedCombo = parts.join('+').replace('Meta', 'Ctrl').replace(/\s+/g, '');

    // 4. Buscar coincidència
    const found = appShortcuts.find(s => s.combo.replace(/\s+/g, '').replace('+', '').toLowerCase() === pressedCombo.replace('+', '').toLowerCase());

    if (found) {
      // Bloquejar comportament per defecte (ex: Ctrl+S, Ctrl+F, Tab)
      e.preventDefault();
      onAction(found.action);
    }
  }, [appId, onAction]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
