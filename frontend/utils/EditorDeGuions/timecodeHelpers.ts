// utils/EditorDeGuions/timecodeHelpers.ts

export interface InternalTimecodeOptions {
  /**
   * Si un número (SS) és una mica menor que els segons d'inici del TAKE,
   * NO el considerem "minut següent" (evita que (53) dins d'un TAKE que comença a :54 salti a 01:53).
   */
  wrapToleranceSeconds?: number;
}

/**
 * Extreu timecodes interns d'un text (ex: "(57)", "(01:23)", "(00:01:53)") i els converteix a segons absoluts.
 * Regles:
 *  - HH:MM:SS -> absolut directe
 *  - MM:SS    -> assumim mateixa hora que el TAKE (i si cal, +1 hora)
 *  - SS / SS.SS -> assumim mateix minut que el TAKE; si SS és "massa" menor que l'inici del TAKE, fem wrap al minut següent.
 *                 IMPORTANT: SS ha de tenir 2 dígits per evitar confusions amb llistes (1), (2)...
 */
export function extractTakeInternalTimecodes(
  text: string,
  takeStartSeconds: number,
  opts: InternalTimecodeOptions = {}
): number[] {
  const wrapTol = opts.wrapToleranceSeconds ?? 8;

  const out: number[] = [];
  const regex = /\(([^)]+)\)/g;

  const takeStartHour = Math.floor(takeStartSeconds / 3600);
  const takeStartMin = Math.floor((takeStartSeconds % 3600) / 60);
  const takeStartSec = takeStartSeconds % 60;

  // Helpers
  const clampAtLeastStart = (t: number) => (isFinite(t) ? Math.max(t, takeStartSeconds) : -1);

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const raw = (match[1] ?? '').trim();

    // Ignora coses amb lletres (ex: (OFF), (DL), etc.)
    if (!raw || /[a-zA-Z]/.test(raw)) continue;

    let abs = -1;

    // HH:MM:SS
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(raw)) {
      const [h, m, s] = raw.split(':').map(Number);
      if ([h, m, s].some(Number.isNaN)) continue;
      abs = h * 3600 + m * 60 + s;
      out.push(clampAtLeastStart(abs));
      continue;
    }

    // MM:SS
    if (/^\d{1,2}:\d{2}$/.test(raw)) {
      const [mStr, sStr] = raw.split(':');
      const m = Number(mStr);
      const s = Number(sStr);
      if ([m, s].some(Number.isNaN)) continue;

      let h = takeStartHour;
      if (m + 1 < takeStartMin) h += 1;

      abs = h * 3600 + m * 60 + s;
      out.push(clampAtLeastStart(abs));
      continue;
    }

    // SS o SS.SS (Exigim exactament 2 dígits abans del punt decimal per evitar soroll de llistes)
    if (/^\d{2}(\.\d+)?$/.test(raw)) {
      const s = Number(raw);
      if (Number.isNaN(s)) continue;

      const minuteBase = takeStartHour * 3600 + takeStartMin * 60;
      const candidateSameMinute = minuteBase + s;
      const candidateNextMinute = minuteBase + 60 + s;

      const diff = takeStartSec - s;
      abs = diff > wrapTol ? candidateNextMinute : candidateSameMinute;

      out.push(clampAtLeastStart(abs));
      continue;
    }
  }

  const cleaned = out
    .filter((n) => typeof n === 'number' && isFinite(n) && n >= 0)
    .map((n) => Math.round(n * 1000) / 1000);

  return Array.from(new Set(cleaned)).sort((a, b) => a - b);
}