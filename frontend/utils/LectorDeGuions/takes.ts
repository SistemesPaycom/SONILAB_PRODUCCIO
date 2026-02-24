// utils/LectorDeGuions/takes.ts
import type { TakeInfo } from './indexers';
export type TakeAnchor = TakeInfo; // Aligning with the indexer's output

export function findTakes(text: string): TakeAnchor[] {
  const re = /TAKE\s*#\s*(\d+)/g;
  const out: TakeAnchor[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({ num: Number(m[1]), start: m.index, end: m.index + m[0].length });
  }
  return out;
}

export function findTakesWithRanges(text: string): TakeAnchor[] {
  const re = /TAKE\s*#\s*(\d+)/g;
  const found: TakeAnchor[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    found.push({ num: Number(m[1]), start: m.index, end: m.index + m[0].length });
  }
  for (let i = 0; i < found.length; i++) {
    const next = found[i + 1];
    found[i].end = next ? next.start : text.length;
  }
  return found;
}
