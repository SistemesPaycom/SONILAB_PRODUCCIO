
import type { TakeBlock } from './scriptParser';
import { MAX_SPEAKER_CHARS_PER_LINE } from '../../constants';

const SEPARATOR = ' | ';
const TIMECODE_REGEX = /^\d{2}:\d{2}:\d{2}$/;

/**
 * Splits a speaker field like *SPEAKER 1**SPEAKER 2* into an array of names.
 */
function splitSpeakers(speakerField: string): string[] {
    if (!speakerField) return [];
    // Matches content between asterisks: *CONTENT*
    const speakerRegex = /\*([^*]+)\*/g;
    const speakers: string[] = [];
    let match;
    while ((match = speakerRegex.exec(speakerField)) !== null) {
        speakers.push(match[1].trim());
    }
    return speakers;
}

/**
 * Converteix una estructura de Takes a una cadena de text en format CSV.
 */
export function scriptToCsv(takes: TakeBlock[]): string {
  const csvRows: string[] = [];

  for (const take of takes) {
    const takeLabel = take.takeLabel || '';

    // Línia especial per al codi de temps del TAKE
    if (take.timecode) {
      csvRows.push([takeLabel, '', take.timecode].join(SEPARATOR));
    }

    let i = 0;
    while (i < take.lines.length) {
      const line = take.lines[i];

      if (!line.speaker) {
        // Ignorem línies sense personatge (com anotacions o línies buides)
        i++;
        continue;
      }
      
      const text = line.text || '';
      
      // A line with a speaker and text is considered the start of a potential group.
      if (text) {
        const sharedText = text;
        const groupSpeakers: string[] = [];

        // Add speakers from the first line of the group
        groupSpeakers.push(...splitSpeakers(line.speaker));

        // Look ahead for subsequent lines that are just speakers (part of the same logical group)
        let j = i + 1;
        while (j < take.lines.length && take.lines[j].speaker && !take.lines[j].text) {
          groupSpeakers.push(...splitSpeakers(take.lines[j].speaker!));
          j++;
        }

        // Create a CSV row for each speaker found in the group with the shared text
        for (const speaker of groupSpeakers) {
          csvRows.push([takeLabel, speaker, sharedText].join(SEPARATOR));
        }

        // Advance the main loop counter past the entire group we just processed
        i = j;
      } else {
        // This is a speaker line with no text, and it wasn't part of a preceding group.
        // Treat it as an "orphan" speaker with no text.
        const speakers = splitSpeakers(line.speaker);
        for (const speaker of speakers) {
          csvRows.push([takeLabel, speaker, ''].join(SEPARATOR));
        }
        i++;
      }
    }
  }

  return csvRows.join('\n');
}


/**
 * Converteix una cadena de text CSV a format de guió .slsf.
 */
export function csvToSlsf(csvContent: string): string {
  if (!csvContent.trim()) return '';

  const rows = csvContent.split('\n').map(line => {
    const parts = line.split(SEPARATOR);
    return {
      takeLabel: parts[0]?.trim() || '',
      speaker: parts[1]?.trim() || '',
      text: parts.slice(2).join(SEPARATOR).trim() || '',
    };
  });

  // Group rows by take label, preserving order
  const takes = new Map<string, { timecode?: string; lines: { speaker: string; text: string }[] }>();
  const takeOrder: string[] = [];
  
  rows.forEach(row => {
    if (!row.takeLabel && !row.speaker && !row.text) return;
    const takeLabel = row.takeLabel;
    if (!takes.has(takeLabel)) {
      takes.set(takeLabel, { lines: [] });
      takeOrder.push(takeLabel);
    }
    
    // Check for special timecode row
    if (!row.speaker && TIMECODE_REGEX.test(row.text)) {
      const takeData = takes.get(takeLabel)!;
      takeData.timecode = row.text;
    } else {
      takes.get(takeLabel)!.lines.push({ speaker: row.speaker, text: row.text });
    }
  });
  
  const slsfParts = takeOrder.map(takeLabel => {
    const takeData = takes.get(takeLabel) || { lines: [] };
    let takeScript = `${takeLabel}\n`;

    if (takeData.timecode) {
      takeScript += `${takeData.timecode}\n`;
    }
    
    const takeRows = takeData.lines;
    let i = 0;
    while (i < takeRows.length) {
      const currentRow = takeRows[i];
      if (!currentRow.speaker) {
        if(currentRow.text) takeScript += `\t${currentRow.text}\n`;
        i++;
        continue;
      }
      
      const groupText = currentRow.text;
      
      // Find group of consecutive speakers with same text
      let j = i;
      while (j < takeRows.length && takeRows[j].speaker && takeRows[j].text === groupText) {
        j++;
      }
      
      const group = takeRows.slice(i, j);
      const speakerTokens = group.map(row => `*${row.speaker}*`);
      
      // Concatena tots els personatges del grup en una sola línia.
      // La vista de columnes s'encarregarà de l'ajustament visual.
      const allSpeakersOnOneLine = speakerTokens.join('');

      if (allSpeakersOnOneLine) {
        if (groupText) {
          takeScript += `${allSpeakersOnOneLine}\t${groupText}\n`;
        } else {
          takeScript += `${allSpeakersOnOneLine}\n`;
        }
      }
      
      i = j; // Move to the next group
    }
    return takeScript;
  });

  return slsfParts.join('\n------------------------------------------------------------------------------------\n');
}
