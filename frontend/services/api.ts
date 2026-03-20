// frontend/services/api.ts
const FALLBACK_API_URL =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : 'http://localhost:8000';

const API_URL = (process.env.VITE_API_URL || FALLBACK_API_URL).replace(/\/$/, '');
const TOKEN_KEY = 'sonilab_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (!token) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, token);
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

async function request<T>(
  path: string,
  opts: { method?: HttpMethod; body?: any; headers?: Record<string, string> } = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const init: RequestInit = {
    method: opts.method || 'GET',
    headers,
    credentials: 'include', // por si más adelante migras a cookies
  };

  if (opts.body instanceof FormData) {
    init.body = opts.body;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body);
  }

  const res = await fetch(`${API_URL}${path}`, init);

   if (res.status === 401) {
    setToken(null);
    window.dispatchEvent(new Event('AUTH_REQUIRED'));
  }

  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const data = await res.json();
      msg = data?.message ? (Array.isArray(data.message) ? data.message.join(', ') : data.message) : msg;
    } catch {}
    throw new Error(msg);
  }

  // 204 no content
  if (res.status === 204) return undefined as unknown as T;

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return (await res.json()) as T;

  // fallback (texto)
  return (await res.text()) as unknown as T;
}

export const api = {
  // Auth
  async register(email: string, password: string) {
    return request<{ accessToken: string }>(`/auth/register`, {
      method: 'POST',
      body: { email, password },
    });
  },
  async login(email: string, password: string) {
    return request<{ accessToken: string }>(`/auth/login`, {
      method: 'POST',
      body: { email, password },
    });
  },
  async me() {
    return request<{ id: string; email: string; name?: string; role: string }>(`/auth/me`);
  },
  async adminListUsers() {
    return request<any[]>(`/auth/admin/users`);
  },
  async adminCreateUser(payload: { email: string; password: string; name?: string; role?: 'admin' | 'user' }) {
    return request<any>(`/auth/admin/users`, { method: 'POST', body: payload });
  },
async listProjects() {
  return request<any[]>(`/projects`);
},
  // Library tree
  async getTree() {
    return request<{ folders: any[]; documents: any[] }>(`/library/tree`);
  },

  // Folders
  async createFolder(name: string, parentId: string | null) {
    return request<any>(`/folders`, { method: 'POST', body: { name, parentId } });
  },
  async patchFolder(id: string, patch: any) {
    return request<any>(`/folders/${id}`, { method: 'PATCH', body: patch });
  },
  async deleteFolder(id: string) {
    return request<any>(`/folders/${id}`, { method: 'DELETE' });
  },

  // Documents
  async createDocument(payload: any) {
    return request<any>(`/documents`, { method: 'POST', body: payload });
  },
  async patchDocument(id: string, patch: any) {
    return request<any>(`/documents/${id}`, { method: 'PATCH', body: patch });
  },
  async deleteDocument(id: string) {
    return request<any>(`/documents/${id}`, { method: 'DELETE' });
  },
  async updateSrt(id: string, srtText: string) {
    return request<any>(`/documents/${id}/srt`, { method: 'PATCH', body: { srtText } });
  },

  // ── Edit lock ──────────────────────────────────────────────────────────
  async acquireLock(docId: string, userName?: string) {
    return request<any>(`/documents/${docId}/lock`, { method: 'POST', body: { userName } });
  },
  async releaseLock(docId: string) {
    return request<any>(`/documents/${docId}/lock`, { method: 'DELETE' });
  },
  /**
   * Versió keepalive de releaseLock per usar en beforeunload.
   * fetch keepalive=true sobreviu al tancament de pàgina (el browser no la cancel·la).
   */
  releaseLockBeacon(docId: string) {
    const token = getToken();
    fetch(`${API_URL}/documents/${docId}/lock`, {
      method: 'DELETE',
      keepalive: true,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => {});
  },
  async getLockStatus(docId: string) {
    return request<{ lockedByUserId: string | null; lockedByUserName: string | null; lockedAt: string | null; isExpired: boolean }>(`/documents/${docId}/lock`);
  },

  // Media
 async uploadMedia(file: File, onProgress?: (pct: number) => void) {
  const token = getToken(); // tu helper actual

  const fd = new FormData();
  fd.append('file', file);

  return await new Promise<{ document: any; duplicated?: boolean }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/media/upload`, true);

    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 100);
      onProgress?.(pct);
    };

    xhr.onerror = () => reject(new Error('Upload failed (network error)'));

    xhr.onload = () => {
      const ok = xhr.status >= 200 && xhr.status < 300;
      if (!ok) {
        try {
          const data = JSON.parse(xhr.responseText || '{}');
          const msg = data?.message
            ? (Array.isArray(data.message) ? data.message.join(', ') : data.message)
            : `HTTP ${xhr.status}`;
          if (xhr.status === 401) {
            setToken(null);
            window.dispatchEvent(new Event('AUTH_REQUIRED'));
          }
          reject(new Error(msg));
        } catch {
          reject(new Error(`HTTP ${xhr.status}`));
        }
        return;
      }

      try {
        const data = JSON.parse(xhr.responseText);
        resolve(data);
      } catch {
        reject(new Error('Invalid JSON response from upload'));
      }
    };

    xhr.send(fd);
  });
},
  async listMedia() {
    return request<any[]>(`/media/list`);
  },
  streamUrl(docId: string) {
    return `${API_URL}/media/${docId}/stream`;
  },
  /** Fetch cached waveform peaks from backend. Returns null if unavailable. */
  async getWaveform(docId: string): Promise<{
    cached: boolean;
    waveform: {
      version: number;
      peaksPerSecond: number;
      duration: number;
      sampleRate: number;
      peakCount: number;
      peaks: number[];
    };
  } | null> {
    try {
      return await request(`/media/${docId}/waveform`);
    } catch {
      return null;
    }
  },

  async downloadMediaAsFile(docId: string, filename: string): Promise<File> {
    const token = getToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(this.streamUrl(docId), {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to download media: ${res.status}`);
    const blob = await res.blob();
    const type = blob.type || 'application/octet-stream';
    return new File([blob], filename, { type });
  },

  // Transcription options
  async transcriptionOptions() {
    return request<any>(`/transcription/options`);
  },

  // Projects / Jobs
  async createProject(payload: { name: string; mediaDocumentId: string; settings?: any }) {
    return request<any>(`/projects`, { method: 'POST', body: payload });
  },
  async createProjectFromExisting(payload: { name: string; mediaDocumentId: string; srtText: string; settings?: any }) {
    return request<any>(`/projects/from-existing`, { method: 'POST', body: payload });
  },
  async getJob(id: string) {
    return request<any>(`/jobs/${id}`);
  },
  async listJobs(options?: { limit?: number; status?: string }) {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.status) params.set('status', options.status);
    const qs = params.toString();
    return request<any[]>(`/jobs${qs ? `?${qs}` : ''}`);
  },
  async getProjectBySrt(srtDocId: string) {
    return request<any>(`/projects/by-srt/${srtDocId}`);
  },

  //Restore 
  async restoreFolder(id: string) {
  return request(`/folders/${id}/restore`, { method: 'PATCH' });
},
async restoreDocument(id: string) {
  return request(`/documents/${id}/restore`, { method: 'PATCH' });
},
async purgeFolder(id: string) {
  return request(`/folders/${id}/purge`, { method: 'DELETE' });
},
async purgeDocument(id: string) {
  return request(`/documents/${id}/purge`, { method: 'DELETE' });
},

  // ─── Guión de proyecto ───────────────────────────────────────────────────

  /** Obtiene el texto del guión vinculado a un proyecto */
  async getProjectGuion(projectId: string): Promise<{ text: string | null; guionDocumentId: string | null }> {
    return request(`/projects/${projectId}/guion`);
  },

  /** Vincula/actualiza el guión de un proyecto pasando texto plano */
  async setProjectGuion(projectId: string, text: string, name?: string): Promise<{ guionDocumentId: string }> {
    return request(`/projects/${projectId}/guion`, {
      method: 'POST',
      body: { text, name },
    });
  },

  /** Sube un archivo DOCX/PDF/TXT y lo vincula como guión del proyecto */
  async uploadProjectGuionFile(
    projectId: string,
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<{ guionDocumentId: string }> {
    const token = getToken();
    const fd = new FormData();
    fd.append('file', file);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/projects/${projectId}/guion/upload`, true);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
      };

      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.onload = () => {
        if (xhr.status === 401) {
          setToken(null);
          window.dispatchEvent(new Event('AUTH_REQUIRED'));
          reject(new Error('Unauthorized'));
          return;
        }
        if (xhr.status < 200 || xhr.status >= 300) {
          try {
            const data = JSON.parse(xhr.responseText || '{}');
            reject(new Error(data?.message || `HTTP ${xhr.status}`));
          } catch {
            reject(new Error(`HTTP ${xhr.status}`));
          }
          return;
        }
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('Invalid JSON response'));
        }
      };

      xhr.send(fd);
    });
  },

  // ─── Correcció de transcripció ────────────────────────────────────────────

  /** Opcions disponibles per al corrector (modes LLM, models, defaults) */
  async getCorrectionOptions(): Promise<{
    llmModes: Array<{ value: string; label: string }>;
    llmModels: Array<{ value: string; label: string }>;
    defaults: { llmMode: string; llmModel: string; threshold: number; window: number };
  }> {
    return request(`/projects/correction/options`);
  },

  /** Corregeix la transcripció SRT del projecte usant el guió vinculat */
  async correctTranscript(
    projectId: string,
    options: { threshold?: number; window?: number; llmMode?: string; llmModel?: string; allowSplit?: boolean; method?: string } = {},
  ): Promise<{
    correctedSrt: string;
    changes: Array<{
      seg_idx: number;
      start: string;
      end: string;
      original: string;
      corrected: string;
      guion_speaker: string;
      guion_text: string;
      score: number;
      method: string;
    }>;
    summary: { totalSegments: number; changed: number; unchanged: number };
  }> {
    return request(`/projects/${projectId}/correct-transcript`, {
      method: 'POST',
      body: options,
    });
  },

  /** Aplica el SRT corregit al projecte (sobreescriu el SRT actual) */
  async applyCorrectedSrt(
    projectId: string,
    correctedSrt: string,
  ): Promise<{ ok: boolean }> {
    return request(`/projects/${projectId}/apply-correction`, {
      method: 'POST',
      body: { correctedSrt },
    });
  },
};