// utils/SubtitlesEditor/segmentTakeLinker.ts
import type { Segment } from '../../types/Subtitles';
import type { TakeRange } from '../EditorDeGuions/takeRanges';

/**
 * Comprova si dos intervals temporals solapen.
 */
function overlaps(segStart: number, segEnd: number, takeStart: number, takeEnd: number): boolean {
  return Math.max(segStart, takeStart) < Math.min(segEnd, takeEnd);
}

/**
 * Vincula una llista de subtítols (segments) als rangs de TAKE detectats al guió.
 * Segueix la Regla d'Or: el startTime mana per al TAKE principal.
 */
export function linkSegmentsToTakeRanges(
  segments: Segment[],
  takeRanges: TakeRange[]
): Segment[] {
  if (!takeRanges.length) {
    return segments.map((s) => ({
      ...s,
      primaryTakeNum: undefined,
      candidateTakeNums: [],
      takeNum: undefined,
    }));
  }

  // Ordenem els rangs per inici cronològic per facilitar les cerques
  const sortedRanges = [...takeRanges].sort((a, b) => a.start - b.start);

  return segments.map((s) => {
    const segStart = s.startTime;
    const segEnd = s.endTime;

    // 1) Trobar tots els TAKES que presenten un solapament temporal real amb la durada del segment
    const overlapping = sortedRanges.filter((r) => overlaps(segStart, segEnd, r.start, r.end));

    let primary: number | undefined = undefined;
    const candidates = new Set<number>();

    if (overlapping.length > 0) {
      // CAS A: El segment trepitja un o més intervals de TAKE.
      
      // Tots els que solapen són candidats vàlids
      overlapping.forEach(r => candidates.add(r.takeNum));

      // Determinem el PRIMARY basat exclusivament en el startTime:
      // Busquem quins d'aquests TAKES contenen realment el segStart.
      const containerTakes = overlapping.filter(r => segStart >= r.start && segStart < r.end);
      
      if (containerTakes.length > 0) {
        // Si el startTime cau dins de més d'un (solapament), triem el que ha començat més TARD
        // (és el TAKE "més fresc" o el nou tall).
        primary = containerTakes.sort((a, b) => b.start - a.start)[0].takeNum;
      } else {
        // Si el startTime no cau exactament dins de cap (ex: micro-gap), 
        // triem el primer que solapa amb la resta de la frase.
        primary = overlapping[0].takeNum;
      }
    } else {
      // CAS B: El segment cau en una zona morta (silenci o buit entre rangs).
      // Només aquí apliquem proximitat per evitar que el badge quedi buit.
      const closest = sortedRanges.reduce((prev, curr) => 
        Math.abs(curr.start - segStart) < Math.abs(prev.start - segStart) ? curr : prev
      );
      primary = closest.takeNum;
      candidates.add(closest.takeNum);
    }

    const candidateList = Array.from(candidates).sort((a, b) => a - b);

    return {
      ...s,
      primaryTakeNum: primary,
      candidateTakeNums: candidateList,
      takeNum: primary, // Compatibilitat amb versions anteriors
    };
  });
}