// utils/SubtitlesEditor/splitHelpers.ts

import { stripSrtTags } from './textMetrics';

export interface SmartSplitResult {
  leftText: string;
  rightText: string;
  /** Proporció de la durada que correspon a la primera meitat (longitud sense tags) */
  splitRatio: number;
}

/**
 * Divideix el text d'un subtítol en un punt "lògic" quan no hi ha cursor
 * disponible (botó S, drecera global fora de l'editor). Comportament estàndard
 * dels editors de subtítols (Subtitle Edit, Aegisub):
 *   - Si el bloc té més d'una línia: talla pel salt de línia més proper al
 *     centre del text. En un bloc de 2 línies, la línia 1 queda al primer
 *     segment i la línia 2 passa sencera al segon.
 *   - Si és una sola línia: talla per l'espai més proper al centre — mai
 *     a mitja paraula.
 *   - El centre es calcula sobre el text sense tags SRT, i cap tag no es
 *     parteix mai per la meitat (els candidats són només \n o espais).
 * Retorna null si no hi ha cap divisió possible amb dues meitats no buides.
 */
export function computeSmartSplit(text: string): SmartSplitResult | null {
  const raw = text || '';
  const totalLen = stripSrtTags(raw).length;
  if (totalLen < 2) return null;

  // Candidats de tall: salts de línia si n'hi ha; si no, espais.
  const isMultiline = raw.includes('\n');
  const sep = isMultiline ? '\n' : ' ';
  const candidates: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === sep) candidates.push(i);
  }

  let leftText: string;
  let rightText: string;

  if (candidates.length > 0) {
    // Tria el candidat que deixa les dues meitats més equilibrades
    let best = candidates[0];
    let bestDiff = Infinity;
    for (const c of candidates) {
      const leftLen = stripSrtTags(raw.slice(0, c)).length;
      const diff = Math.abs(leftLen - totalLen / 2);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = c;
      }
    }
    leftText = raw.slice(0, best).trimEnd();
    rightText = raw.slice(best + 1).trimStart();
  } else {
    // Una sola paraula sense espais: migpunt dur
    const mid = Math.floor(raw.length / 2);
    leftText = raw.slice(0, mid).trimEnd();
    rightText = raw.slice(mid).trimStart();
  }

  if (!leftText || !rightText) return null;

  // Reequilibra tags SRT oberts a cavall del tall: <i>a\nb</i> → <i>a</i> + <i>b</i>
  for (const t of ['i', 'b', 'u']) {
    const opens = (leftText.match(new RegExp(`<${t}>`, 'gi')) || []).length;
    const closes = (leftText.match(new RegExp(`</${t}>`, 'gi')) || []).length;
    if (opens > closes) {
      leftText = `${leftText}</${t}>`;
      rightText = `<${t}>${rightText}`;
    }
  }

  const leftLen = stripSrtTags(leftText).length;
  const rightLen = stripSrtTags(rightText).length;
  const denom = leftLen + rightLen;
  const splitRatio = denom > 0 ? leftLen / denom : 0.5;

  return { leftText, rightText, splitRatio };
}
