// frontend/hooks/useKeyboardShortcuts.ts
import { useEffect, useCallback } from 'react';
import { AppShortcuts } from '../appTypes';
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

/** Forma mínima d'un event de teclat: val tant per al natiu com per al sintètic de React. */
type KeyEventLike = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>;

const normalizeCombo = (combo: string): string =>
  combo.replace(/\s+/g, '').replace('Meta', 'Ctrl').replace('+', '').toLowerCase();

function mapKeyName(key: string): string {
  if (key === ' ') return 'Space';
  if (key === '+') return 'Plus';
  if (key === '-') return 'Minus';
  if (key === ',') return 'Comma';
  return key;
}

/** Combo de l'event en la mateixa notació que els `combo` de DEFAULT_SHORTCUTS; null si és una tecla modificadora sola. */
function comboFromEvent(e: KeyEventLike): string | null {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null;

  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');
  parts.push(mapKeyName(e.key));

  return parts.join('+');
}

/**
 * Acció de la llista `general` (Desfer / Refer / Guardar) a què correspon l'event, si n'hi ha cap.
 * La fan servir els camps de text que aïllen les seves tecles amb stopPropagation i necessiten
 * deixar passar igualment les dreceres globals cap al listener de window.
 */
export function findGeneralShortcutAction(e: KeyEventLike): string | null {
  const combo = comboFromEvent(e);
  if (!combo) return null;
  const found = (getCachedShortcuts().general || []).find(
    (s) => normalizeCombo(s.combo) === normalizeCombo(combo),
  );
  return found ? found.action : null;
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

    const hasMod = e.ctrlKey || e.metaKey || e.altKey;
    if (isInput && !hasMod && mapKeyName(e.key).length === 1) return;

    const pressedCombo = comboFromEvent(e);
    if (!pressedCombo) return;

    const found = appShortcuts.find(
      (s) => normalizeCombo(s.combo) === normalizeCombo(pressedCombo),
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