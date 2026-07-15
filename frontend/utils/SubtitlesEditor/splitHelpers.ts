// utils/SubtitlesEditor/splitHelpers.ts

import { MIN_SEG_DURATION_MS } from '../../constants';
import { stripSrtTags } from './textMetrics';

export interface SplitTimes {
  /** Fi de la primera meitat */
  leftEnd: number;
  /** Inici de la segona meitat (= leftEnd + gap efectiu) */
  rightStart: number;
}

/**
 * Reparteix la durada d'un bloc entre les dues meitats d'un split respectant la
 * durada mínima configurable i el gap mínim entre subtítols.
 *
 * Jerarquia (la mateixa que als altres punts d'enforcement de l'editor): la durada
 * mínima mana sobre el gap. Si el bloc no dona per a 2 × minDur + gap, primer
 * s'encongeix el gap (fins a 1 ms — mai 0: dos subtítols consecutius no poden
 * compartir timecode) i, només si tampoc n'hi ha prou, es degraden les dues durades
 * per igual, amb pis absolut MIN_SEG_DURATION_MS. Mai es toca `endTime` del bloc
 * original, de manera que el buit amb el subtítol següent queda intacte.
 *
 * Retorna null si el bloc no admet ni dues meitats del pis absolut.
 * Càlcul en mil·lisegons sencers: els timecodes SRT tenen resolució de ms.
 */
export function computeSplitTimes(params: {
  startTime: number;
  endTime: number;
  /** Proporció de la durada per a la primera meitat (es clampa a [0,1]) */
  ratio: number;
  /**
   * Punt de tall absolut (segons). Si es passa, mana sobre `ratio`: la primera
   * meitat acaba EXACTAMENT aquí i la segona comença un gap més tard (estil
   * Subtitle Edit). El split pel playhead l'usa perquè el tall caigui on és la
   * línia i no desplaçat per la part proporcional del gap. Les mateixes guardes
   * de durada mínima i gap s'hi apliquen igual.
   */
  cutTime?: number;
  minDurSec: number;
  gapSec: number;
}): SplitTimes | null {
  const { startTime, endTime } = params;
  const totalMs = Math.round((endTime - startTime) * 1000);
  const absMinMs = MIN_SEG_DURATION_MS;
  if (!Number.isFinite(totalMs) || totalMs < 2 * absMinMs + 1) return null;

  const minDurMs = Math.max(absMinMs, Math.round(params.minDurSec * 1000));
  const gapWantedMs = Math.max(1, Math.round(params.gapSec * 1000));
  const gapMs = Math.min(gapWantedMs, Math.max(1, totalMs - 2 * minDurMs));

  const usableMs = totalMs - gapMs;
  const floorMs = Math.min(minDurMs, Math.floor(usableMs / 2));
  const ratio = Math.min(1, Math.max(0, params.ratio || 0));
  const wantedMs = params.cutTime !== undefined && Number.isFinite(params.cutTime)
    ? Math.round((params.cutTime - startTime) * 1000)
    : Math.round(usableMs * ratio);
  const leftMs = Math.min(
    usableMs - floorMs,
    Math.max(floorMs, wantedMs),
  );

  return {
    leftEnd: startTime + leftMs / 1000,
    rightStart: startTime + (leftMs + gapMs) / 1000,
  };
}

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
 *     punt objectiu del text. En un bloc de 2 línies, la línia 1 queda al
 *     primer segment i la línia 2 passa sencera al segon.
 *   - Si és una sola línia: talla per l'espai més proper al punt objectiu —
 *     mai a mitja paraula.
 *   - El punt objectiu es calcula sobre el text sense tags SRT, i cap tag no
 *     es parteix mai per la meitat (els candidats són només \n o espais).
 *
 * `targetRatio` és la proporció del text on es vol tallar: 0.5 (per defecte) =
 * centre, que és el que volen el botó S i la drecera de split sense cursor. El
 * split pel playhead (Ctrl+Shift+K) hi passa la proporció temporal del playhead
 * dins del bloc, perquè el text es reparteixi igual que la durada.
 *
 * Retorna null si no hi ha cap divisió possible amb dues meitats no buides.
 */
export function computeSmartSplit(text: string, targetRatio: number = 0.5): SmartSplitResult | null {
  const raw = text || '';
  const totalLen = stripSrtTags(raw).length;
  if (totalLen < 2) return null;

  const ratio = Number.isFinite(targetRatio) ? Math.min(1, Math.max(0, targetRatio)) : 0.5;
  const targetLen = totalLen * ratio;

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
    // Tria el candidat més proper al punt objectiu del text
    let best = candidates[0];
    let bestDiff = Infinity;
    for (const c of candidates) {
      const leftLen = stripSrtTags(raw.slice(0, c)).length;
      const diff = Math.abs(leftLen - targetLen);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = c;
      }
    }
    leftText = raw.slice(0, best).trimEnd();
    rightText = raw.slice(best + 1).trimStart();
  } else {
    // Una sola paraula sense espais: tall dur al punt objectiu, mai a la vora
    // (amb ratios extrems deixaria una meitat buida i no hi hauria split).
    const mid = Math.min(raw.length - 1, Math.max(1, Math.floor(raw.length * ratio)));
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
