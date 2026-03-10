// utils/SubtitlesEditor/srtParser.ts
import type { Segment } from '../../types/Subtitles';

export const srtTimeToSeconds = (tc: string): number => {
  const parts = tc.trim().split(/[:,]/).map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return NaN;
  return parts[0] * 3600 + parts[1] * 60 + parts[2] + parts[3] / 1000;
};

export const secondsToSrtTime = (time: number): string => {
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = Math.floor(time % 60);
  const milliseconds = Math.round((time - Math.floor(time)) * 1000);

  const pad = (num: number, length = 2) => String(num).padStart(length, '0');

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(milliseconds, 3)}`;
};

export function parseSrt(input: string): Segment[] {
  const segments: Segment[] = [];
  const blocks = input.replace(/\r/g, '').split('\n\n');

  for (const block of blocks) {
    if (!block.trim()) continue;

    const lines = block.split('\n');
    if (lines.length < 2) continue;

    const id = parseInt(lines[0], 10);
    const timeMatch = lines[1].match(
      /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/,
    );

    if (Number.isNaN(id) || !timeMatch) continue;

    const startTime = srtTimeToSeconds(timeMatch[1]);
    const endTime = srtTimeToSeconds(timeMatch[2]);
    const textLines = lines.slice(2);
    const originalText = textLines.join('\n');

    segments.push({
      id,
      startTime,
      endTime,
      originalText,
      richText: originalText,
    });
  }

  return segments;
}

export function serializeSrt(segments: Segment[]): string {
  return segments
    .map((segment) => {
      const textToUse = segment.richText || segment.originalText;
      return [
        segment.id,
        `${secondsToSrtTime(segment.startTime)} --> ${secondsToSrtTime(segment.endTime)}`,
        textToUse,
      ].join('\n');
    })
    .join('\n\n');
}