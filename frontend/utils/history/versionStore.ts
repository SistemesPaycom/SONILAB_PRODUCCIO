// utils/history/versionStore.ts

export interface DocumentVersion {
  id: string;
  timestamp: string;
  payload: any;
  meta?: string;
}

const STORAGE_PREFIX = 'slsf_versions_';
const MAX_VERSIONS_PER_DOC = 50;

/**
 * Crea una versió persistent del document.
 */
export function createSavePoint(docId: string, payload: any, meta?: string): DocumentVersion {
  const versions = getVersions(docId);
  const newVersion: DocumentVersion = {
    id: `v_${Date.now()}`,
    timestamp: new Date().toISOString(),
    payload,
    meta
  };

  const updated = [newVersion, ...versions].slice(0, MAX_VERSIONS_PER_DOC);
  localStorage.setItem(`${STORAGE_PREFIX}${docId}`, JSON.stringify(updated));
  return newVersion;
}

/**
 * Llista totes les versions d'un document.
 */
export function getVersions(docId: string): DocumentVersion[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${docId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Elimina l'historial de versions d'un document (p.ex. en esborrar-lo definitivament).
 */
export function clearVersions(docId: string) {
  localStorage.removeItem(`${STORAGE_PREFIX}${docId}`);
}
