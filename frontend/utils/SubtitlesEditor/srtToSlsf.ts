
import { parseSrt } from './srtParser';
import { csvToSlsf } from '../EditorDeGuions/csvConverter';

const MAX_LINES_PER_TAKE = 16;
const MAX_TAKE_DURATION_SECONDS = 90; // 1:30 minuts

const formatSeconds = (totalSeconds: number): string => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const getSmartTimeLabel = (currentTime: number, takeStartTime: number): string => {
  const currentMin = Math.floor(currentTime / 60);
  const startMin = Math.floor(takeStartTime / 60);
  const seconds = Math.floor(currentTime % 60);
  const secondsStr = String(seconds).padStart(2, '0');

  if (currentMin === startMin) {
    return `(${secondsStr})`;
  } else {
    return `(${currentMin}:${secondsStr})`;
  }
};

/**
 * Converteix contingut SRT a SLSF (via format intermedi de graella/CSV)
 * Segueix el format professional on el personatge per defecte és "P"
 * i la primera línia de cada take conté el codi de temps inicial.
 */
export function convertSrtToSlsf(srtContent: string): string {
  const segments = parseSrt(srtContent);
  if (segments.length === 0) return '';

  const csvRows: string[] = [];
  let currentTakeNum = 1;
  let linesInTake = 0;
  let takeStartTime = -1;

  const SEPARATOR = ' | ';

  segments.forEach((seg) => {
    // Decidir si hem de tancar take i obrir-ne un de nou per durada o línies
    const durationSinceTakeStart = takeStartTime !== -1 ? (seg.startTime - takeStartTime) : 0;
    const shouldSplitByDuration = durationSinceTakeStart > MAX_TAKE_DURATION_SECONDS;
    const shouldSplitByLines = linesInTake >= MAX_LINES_PER_TAKE;

    if (takeStartTime === -1 || shouldSplitByDuration || shouldSplitByLines) {
      if (takeStartTime !== -1) {
        currentTakeNum++;
        linesInTake = 0;
      }
      takeStartTime = seg.startTime;
      const takeLabel = `TAKE #${currentTakeNum}`;
      
      // Línia de capçalera del TAKE (PERSONATGE buit, TEXT amb codi de temps absolut HH:MM:SS)
      csvRows.push([takeLabel, '', formatSeconds(takeStartTime)].join(SEPARATOR));
    }

    const takeLabel = `TAKE #${currentTakeNum}`;
    const timeLabel = getSmartTimeLabel(seg.startTime, takeStartTime);
    const cleanText = seg.originalText.replace(/\n/g, ' '); // Aplanem el text del subtítol
    
    // Línia de diàleg (PERSONATGE "P", TEXT amb prefix de temps intel·ligent)
    csvRows.push([takeLabel, 'P', `${timeLabel} ${cleanText}`].join(SEPARATOR));
    
    linesInTake++;
  });

  // Convertim la graella generada a SLSF utilitzant el conversor existent del sistema
  return csvToSlsf(csvRows.join('\n'));
}
