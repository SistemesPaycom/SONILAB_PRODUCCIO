
// utils/EditorDeGuions/takeRanges.ts
import { parseScript } from './scriptParser';
import { extractTakeInternalTimecodes } from './timecodeHelpers';

export type TakeRange = {
  takeNum: number;
  start: number; // segons
  end: number;   // segons (exclusiu)
};

type BuildTakeRangesParams = {
  content: string;
  takeStartMarginSeconds?: number;
  takeEndMarginSeconds?: number; 
  durationSeconds?: number;
  
  // Paràmetres d'enduriment
  maxOverlapSeconds?: number;                       // Màxim solapament permès entre takes (default 120s)
  internalTcMaxAfterNextStartSeconds?: number;      // Màxima extensió d'un TC intern més enllà del següent take (default 120s)
  internalTcPlausibilityLimitSeconds?: number;      // Màxima distància d'un TC intern respecte a l'inici del take (default 600s)
  maxTakeDurationFallbackSeconds?: number;          // Durada per defecte si no hi ha següent take ni duration (default 180s)
  absurdDurationLimitSeconds?: number;              // Límit de seguretat per evitar rangs infinits (default 1200s)
};

const DEFAULTS = {
  START_MARGIN: 2,
  END_MARGIN: 2,
  MAX_OVERLAP: 120,
  INTERNAL_LIMIT: 600,
  FALLBACK_DUR: 180,
  ABSURD_LIMIT: 1200,
};

// Converteix "HH:MM:SS" o "MM:SS" a segons
function timecodeToSeconds(tc: string): number {
  const clean = tc.trim();
  const parts = clean.split(':').map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return -1;

  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return -1;
}

export function buildTakeRangesFromScript(params: BuildTakeRangesParams): TakeRange[] {
  const {
    content,
    takeStartMarginSeconds = DEFAULTS.START_MARGIN,
    takeEndMarginSeconds = DEFAULTS.END_MARGIN,
    durationSeconds,
    maxOverlapSeconds = DEFAULTS.MAX_OVERLAP,
    internalTcMaxAfterNextStartSeconds = DEFAULTS.MAX_OVERLAP,
    internalTcPlausibilityLimitSeconds = DEFAULTS.INTERNAL_LIMIT,
    maxTakeDurationFallbackSeconds = DEFAULTS.FALLBACK_DUR,
    absurdDurationLimitSeconds = DEFAULTS.ABSURD_LIMIT,
  } = params;

  const { takes } = parseScript(content || '');
  if (!takes?.length) return [];

  // Passa 1: Extreure dades bàsiques i ordenar per trobar els "veïns"
  const rawTakes = takes
    .map((take) => {
      const m = take.takeLabel?.match(/TAKE\s*#?\s*(\d+)/i);
      const takeNum = m ? parseInt(m[1], 10) : NaN;
      const rawStart = take.timecode ? timecodeToSeconds(take.timecode) : -1;

      if (!Number.isFinite(takeNum) || takeNum < 0 || rawStart < 0) return null;

      const fullText = [
        take.takeLabel ?? '',
        take.timecode ?? '',
        ...(take.lines || []).map((l) => l.raw ?? l.text ?? ''),
        take.finalTimecode ?? '',
      ].filter(Boolean).join('\n');

      // Apliquem el marge d'inici (Pre-roll)
      const start = Math.max(0, rawStart - takeStartMarginSeconds);

      return { takeNum, start, rawStart, fullText };
    })
    .filter(Boolean) as Array<{ takeNum: number; start: number; rawStart: number; fullText: string }>;

  rawTakes.sort((a, b) => a.start - b.start);

  // Passa 2: Calcular intervals amb coneixement del següent TAKE
  const ranges: TakeRange[] = rawTakes.map((t, idx) => {
    const next = rawTakes[idx + 1];

    // --- FILTRAT DE MICRO-TIMECODES INTERNS ---
    // Nota: els TCs interns s'haurien de basar en el t.rawStart per ser fidels al guió
    let internalUpperBound = t.rawStart + internalTcPlausibilityLimitSeconds;
    
    if (next) {
      internalUpperBound = Math.min(internalUpperBound, next.rawStart + internalTcMaxAfterNextStartSeconds);
    }
    
    if (durationSeconds && durationSeconds > 0) {
      internalUpperBound = Math.min(internalUpperBound, durationSeconds);
    }

    const internalTCs = extractTakeInternalTimecodes(t.fullText, t.rawStart)
      .filter((time) => time >= t.rawStart - 0.5)
      .filter((time) => time <= internalUpperBound);

    const internalMax = internalTCs.length ? Math.max(...internalTCs) : t.rawStart;

    // --- CÀLCUL DE L'END ---
    const endBase = internalMax + takeEndMarginSeconds;
    let end: number;

    if (next) {
      // Un take s'atura on digui el seu contingut + marge de sortida.
      end = endBase;
      
      // Limitem el solapament màxim respecte al següent inici per seguretat.
      // Important: comparem amb l'inici ja amb marge del següent per evitar buits innecessaris.
      end = Math.min(end, next.start + maxOverlapSeconds);
    } else {
      // ÚLTIM TAKE: Si sabem la durada del vídeo, l'estirem fins al final
      if (durationSeconds && durationSeconds > 0) {
        end = Math.max(endBase, durationSeconds);
      } else {
        end = Math.max(endBase, t.start + maxTakeDurationFallbackSeconds);
      }
    }

    // --- SANITY CHECKS FINALS ---
    if (durationSeconds && durationSeconds > 0) {
      end = Math.min(end, durationSeconds);
    }
    if (end <= t.start) {
      end = t.start + takeEndMarginSeconds;
    }
    if (end - t.start > absurdDurationLimitSeconds) {
      end = t.start + maxTakeDurationFallbackSeconds;
    }

    return {
      takeNum: t.takeNum,
      start: t.start,
      end: Math.round(end * 1000) / 1000,
    };
  });

  return ranges;
}
