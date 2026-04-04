// frontend/hooks/useHashRoute.ts
import { useState, useEffect } from 'react';
import { OpenMode } from '../types';

export interface HashRoute {
  view: 'home' | 'editor' | 'script-view' | 'loading-preview';
  mode?: OpenMode;
  docId?: string;
}

const VALID_MODES: OpenMode[] = [
  'editor', 'lector', 'editor-video', 'editor-video-subs',
  'editor-ssrtlsf', 'editor-srt-standalone',
];

function parseHash(): HashRoute {
  const hash = window.location.hash.replace(/^#\/?/, '');
  // Format: editor/{mode}/{docId}  or  script-view/{docId}
  const parts = hash.split('/');
  if (parts[0] === 'editor' && parts.length >= 3) {
    const mode = parts[1] as OpenMode;
    const docId = parts.slice(2).join('/'); // docId pot contenir '/'
    if (VALID_MODES.includes(mode) && docId) {
      return { view: 'editor', mode, docId };
    }
  }
  if (parts[0] === 'loading-preview') {
    return { view: 'loading-preview' };
  }
  if (parts[0] === 'script-view' && parts.length >= 2) {
    const docId = parts.slice(1).join('/');
    if (docId) {
      return { view: 'script-view', docId };
    }
  }
  return { view: 'home' };
}

/**
 * Hook lleuger de routing per hash.
 * Parseja #/editor/{mode}/{docId} o retorna view='home'.
 */
export function useHashRoute(): HashRoute {
  const [route, setRoute] = useState<HashRoute>(parseHash);

  useEffect(() => {
    const handler = () => setRoute(parseHash());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  return route;
}
