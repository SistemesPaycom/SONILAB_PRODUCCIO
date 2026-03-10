// utils/SubtitlesEditor/segmentGuionDiff.ts
import { parseScript } from '../EditorDeGuions/scriptParser';
import type { Segment } from '../../types/Subtitles';

/**
 * Normalitza text per comparar: minúscules, elimina directions d'escena,
 * puntuació i marcadors de personatge.
 */
function normalizeText(text: string): string {
  return text
    .replace(/\([^)]*\)/g, ' ')     // (OFF), (ON), (G), directions d'escena
    .replace(/\*[^*]+\*/g, ' ')     // *PERSONATGE* markers
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-zA-Z0-9àáâãäåèéêëìíîïòóôõöùúûüçñÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÇÑ\s'·]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calcula quina fracció dels bigrames del segment apareix en els bigrames del take.
 * Mètrica "recall": cobertura del segment dins el take.
 * Retorna [0..1].
 */
function segmentCoverageInTake(segText: string, takeText: string): number {
  const getBigrams = (s: string): string[] => {
    const result: string[] = [];
    for (let i = 0; i < s.length - 1; i++) result.push(s.slice(i, i + 2));
    return result;
  };

  const biSeg = getBigrams(segText);
  if (biSeg.length === 0) return 1; // segment buit → no marcar

  const biTakeSet = new Set(getBigrams(takeText));
  const matched = biSeg.filter((bg) => biTakeSet.has(bg)).length;
  return matched / biSeg.length;
}

/**
 * Construeix un mapa { takeNum → text de diàleg combinat } a partir del contingut del guió.
 * Exclou línies REPICAR (no cal comparar-les).
 */
export function buildTakeDialogMap(guionContent: string): Map<number, string> {
  const map = new Map<number, string>();
  if (!guionContent?.trim()) return map;

  const { takes } = parseScript(guionContent);

  for (const take of takes) {
    const match = take.takeLabel?.match(/TAKE\s*#?\s*(\d+)/i);
    if (!match) continue;
    const takeNum = parseInt(match[1], 10);

    const dialogParts: string[] = [];
    for (const line of take.lines) {
      // Saltar REPICAR
      if (/^\*REPICAR\*/i.test((line.raw || '').trim())) continue;
      if (line.text?.trim()) {
        dialogParts.push(line.text.trim());
      }
    }

    if (dialogParts.length > 0) {
      map.set(takeNum, dialogParts.join(' '));
    }
  }

  return map;
}

const COVERAGE_THRESHOLD = 0.50; // sota d'aquest valor → hasDiff = true
const MIN_CHARS = 6;              // segments molt curts no es comparen

/**
 * Afegeix el camp `hasDiff` a cada segment comparant el seu text
 * amb el diàleg del TAKE associat en el guió.
 *
 * Un segment es marca com a diferent (hasDiff=true) quan la cobertura
 * dels seus bigrames dins el text del take és inferior al llindar.
 */
export function applyGuionDiff(
  segments: Segment[],
  takeDialogMap: Map<number, string>,
): Segment[] {
  if (takeDialogMap.size === 0) return segments.map((s) => ({ ...s, hasDiff: false }));

  return segments.map((seg) => {
    const takeNum = seg.primaryTakeNum;
    if (!takeNum) return { ...seg, hasDiff: false };

    const takeDialog = takeDialogMap.get(takeNum);
    if (!takeDialog) return { ...seg, hasDiff: false };

    const normSeg = normalizeText(seg.originalText || '');
    const normTake = normalizeText(takeDialog);

    // Textos massa curts: no comparar
    if (normSeg.length < MIN_CHARS) return { ...seg, hasDiff: false };
    if (normTake.length < MIN_CHARS) return { ...seg, hasDiff: false };

    // Coincidència exacta com a substring (cas ideal)
    if (normTake.includes(normSeg)) return { ...seg, hasDiff: false };

    // Cobertura de bigrames del segment dins del take
    const coverage = segmentCoverageInTake(normSeg, normTake);
    return { ...seg, hasDiff: coverage < COVERAGE_THRESHOLD };
  });
}
