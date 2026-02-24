
export interface ScriptLine {
  raw: string;
  speaker?: string;
  text: string;
}

export interface TakeBlock {
  id: number;
  takeLabel: string;
  timecode?: string;
  finalTimecode?: string;
  lines: ScriptLine[];
}

const TAKE_REGEX = /^TAKE\s*#?\s*\d+/i;
const TIMECODE_REGEX = /^\d{2}:\d{2}:\d{2}$/;
const SPEAKER_REGEX = /^\s*\*[^*]+\*/;
const SEPARATOR_REGEX = /^\s*[-–—]{10,}\s*$/;

function mergeTextContinuations(lines: ScriptLine[]): ScriptLine[] {
  const result: ScriptLine[] = [];
  let i = 0;
  while (i < lines.length) {
    let line = { ...lines[i] };
    const normalizeSpaces = (text: string) => text.replace(/\s{2,}/g, ' ');

    if (line.speaker && line.text) {
      let j = i + 1;
      while (
        j < lines.length &&
        !lines[j].speaker &&
        lines[j].text &&
        !SEPARATOR_REGEX.test(lines[j].raw)
      ) {
        line.text = normalizeSpaces(line.text + ' ' + lines[j].text);
        j++;
      }
      result.push(line);
      i = j;
      continue;
    }

    if (!line.speaker && line.text && !SEPARATOR_REGEX.test(line.raw)) {
      let j = i + 1;
      while (
        j < lines.length &&
        !lines[j].speaker &&
        lines[j].text &&
        !SEPARATOR_REGEX.test(lines[j].raw)
      ) {
        line.text = normalizeSpaces(line.text + ' ' + lines[j].text);
        j++;
      }
      result.push(line);
      i = j;
      continue;
    }
    result.push(line);
    i++;
  }
  return result;
}

function groupSpeakersWithFollowingText(lines: ScriptLine[]): ScriptLine[] {
  const result: ScriptLine[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.speaker && !line.text) {
      const groupStart = i;
      let j = i + 1;
      while (j < lines.length && lines[j].speaker && !lines[j].text) j++;
      if (j < lines.length && !lines[j].speaker && lines[j].text) {
        const textLine = lines[j];
        const firstWithText: ScriptLine = {
          ...lines[groupStart],
          text: textLine.text,
        };
        result.push(firstWithText);
        for (let k = groupStart + 1; k < j; k++) result.push(lines[k]);
        i = j + 1;
        continue;
      }
    }
    result.push(line);
    i++;
  }
  return result;
}

export function parseScript(
  content: string
): { preamble: string; takes: TakeBlock[] } {
  const lines = content.split(/\r?\n/);
  let idx = 0;
  while (idx < lines.length && !TAKE_REGEX.test(lines[idx])) idx++;
  const preambleLines = lines
    .slice(0, idx)
    .filter((l) => !SEPARATOR_REGEX.test(l));
  const takeLines = lines.slice(idx);
  const parsedTakes: Omit<TakeBlock, 'id'>[] = [];
  let i = 0;

  while (i < takeLines.length) {
    const line = takeLines[i];
    if (!line.trim() || SEPARATOR_REGEX.test(line)) {
      i++;
      continue;
    }
    if (TAKE_REGEX.test(line)) {
      const takeLabel = line.trim();
      let timecode: string | undefined;
      if (
        i + 1 < takeLines.length &&
        TIMECODE_REGEX.test(takeLines[i + 1].trim())
      ) {
        timecode = takeLines[i + 1].trim();
        i += 2;
      } else i += 1;
      const scriptLines: ScriptLine[] = [];
      while (i < takeLines.length && !TAKE_REGEX.test(takeLines[i])) {
        const l = takeLines[i];
        if (!l.trim() || SEPARATOR_REGEX.test(l)) {
          scriptLines.push({ raw: l, text: '' });
          i++;
          continue;
        }
        const tabIndex = l.indexOf('\t');
        if (tabIndex !== -1) {
          let speakerPart = l.slice(0, tabIndex).trim();
          let textPart = l.slice(tabIndex + 1).trim();
          const extraMatch = textPart.match(/^((\*[^*]+\*\s*)+)/);
          if (extraMatch) {
            const extraNamesRaw = extraMatch[1];
            const extraNamesClean = extraNamesRaw.trim();
            speakerPart = `${speakerPart} ${extraNamesClean}`;
            textPart = textPart.slice(extraMatch[0].length).trimStart();
          }
          scriptLines.push({ raw: l, speaker: speakerPart, text: textPart });
        } else if (SPEAKER_REGEX.test(l)) {
          const multiMatch = l.match(/^(\s*(\*[^*]+\*)+)\s*/);
          const speakerWithStars = multiMatch
            ? multiMatch[1].trim()
            : l.trim();
          const textPart = multiMatch
            ? l.slice(multiMatch[0].length).trim()
            : '';
          scriptLines.push({
            raw: l,
            speaker: speakerWithStars,
            text: textPart,
          });
        } else scriptLines.push({ raw: l, text: l.trim() });
        i++;
      }
      const mergedLines = mergeTextContinuations(scriptLines);
      const groupedLines = groupSpeakersWithFollowingText(mergedLines);
      parsedTakes.push({ takeLabel, timecode, lines: groupedLines });
    } else i++;
  }

  const finalTakes: TakeBlock[] = parsedTakes.map((t, index) => {
    const newTake: TakeBlock = { ...t, id: index + 1 };
    
    while (
      newTake.lines.length > 0 &&
      !newTake.lines[newTake.lines.length - 1].speaker &&
      !newTake.lines[newTake.lines.length - 1].text.trim()
    ) {
      newTake.lines.pop();
    }

    const lastLine = newTake.lines[newTake.lines.length - 1];
    if (lastLine && !lastLine.speaker && TIMECODE_REGEX.test(lastLine.text)) {
      newTake.finalTimecode = lastLine.text;
      newTake.lines.pop();
    }
    return newTake;
  });

  return { preamble: preambleLines.join('\n'), takes: finalTakes };
}
