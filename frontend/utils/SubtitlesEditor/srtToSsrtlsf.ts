
import { parseSrt, secondsToSrtTime } from './srtParser';

/**
 * Converteix SRT a SSRTLSF (Simple SRT Layout Standard Format)
 * Estructura de sortida per cada segment:
 * [TIME]
 * P
 * [TEXT]
 */
export function convertSrtToSsrtlsf(srtContent: string): string {
  const segments = parseSrt(srtContent);
  if (segments.length === 0) return '';

  return segments
    .map(seg => {
      const timeStr = secondsToSrtTime(seg.startTime);
      const cleanText = seg.originalText.replace(/\n/g, ' ');
      return `${timeStr}\nP\n${cleanText}`;
    })
    .join('\n');
}

/**
 * Parsers per a l'editor SSRTLSF
 */
export interface SsrtListRow {
  id: string;
  tc: string;
  char: string;
  text: string;
}

export function parseSsrtlsf(content: string): SsrtListRow[] {
  if (!content.trim()) return [];
  const lines = content.split('\n');
  const rows: SsrtListRow[] = [];
  
  for (let i = 0; i < lines.length; i += 3) {
    if (lines[i]) {
      rows.push({
        id: `ssrt_${i}`,
        tc: lines[i]?.trim() || '',
        char: lines[i+1]?.trim() || 'P',
        text: lines[i+2]?.trim() || ''
      });
    }
  }
  return rows;
}

export function serializeSsrtlsf(rows: SsrtListRow[]): string {
  return rows.map(r => `${r.tc}\n${r.char}\n${r.text}`).join('\n');
}
