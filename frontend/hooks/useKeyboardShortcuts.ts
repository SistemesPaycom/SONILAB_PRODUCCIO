// frontend/hooks/useKeyboardShortcuts.ts
import { useEffect, useCallback, useRef } from 'react';
import { AppShortcuts } from '../types';
import { DEFAULT_SHORTCUTS, LOCAL_STORAGE_KEYS } from '../constants';

type ActionHandler = (action: string) => void;

// Cache de dreceres fora del component per evitar JSON.parse a cada keydown
let _cachedShortcutsRaw: string | null = null;
let _cachedShortcuts: AppShortcuts = DEFAULT_SHORTCUTS;
function getCachedShortcuts(): AppShortcuts {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.SHORTCUTS);
  if (stored !== _cachedShortcutsRaw) {
    _cachedShortcutsRaw = stored;
    _cachedShortcuts = stored ? JSON.parse(stored) : DEFAULT_SHORTCUTS;
  }
  return _cachedShortcuts;
}

/**
 * Hook per gestionar dreceres de teclat globals o per mòdul.
 * @param appId El mòdul de l'app actiu per filtrar dreceres.
 * @param onAction Callback que rep l'identificador de l'acció detectada.
 */
export function useKeyboardShortcuts(
  appId: keyof AppShortcuts,
  onAction: ActionHandler,
  enabled: boolean = true,
) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    const shortcuts = getCachedShortcuts();

    const appShortcuts = [
      ...(shortcuts.general || []),
      ...(shortcuts[appId] || []),
    ];

    const target = e.target as HTMLElement;
    const isInput =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable;

    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');

    let keyName = e.key;
    if (keyName === ' ') keyName = 'Space';
    if (keyName === '+') keyName = 'Plus';
    if (keyName === '-') keyName = 'Minus';
    if (keyName === ',') keyName = 'Comma';

    const hasMod = e.ctrlKey || e.metaKey || e.altKey;
    if (isInput && !hasMod && keyName.length === 1) return;

    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

    parts.push(keyName);
    const pressedCombo = parts.join('+').replace('Meta', 'Ctrl').replace(/\s+/g, '');

    const found = appShortcuts.find(
      (s) =>
        s.combo.replace(/\s+/g, '').replace('+', '').toLowerCase() ===
        pressedCombo.replace('+', '').toLowerCase(),
    );

    if (found) {
      e.preventDefault();
      onAction(found.action);
    }
  }, [appId, onAction, enabled]);

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}