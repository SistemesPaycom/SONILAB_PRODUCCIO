// utils/SubtitlesEditor/textMetrics.ts

/**
 * Elimina totes les etiquetes de format SRT (com <b>, <i>, <u>) per obtenir el text net.
 * Utilitzat per al càlcul de mètriques com CPS i CPL.
 */
export function stripSrtTags(text: string): string {
  if (!text) return '';
  // Elimina qualsevol contingut entre < i >
  return text.replace(/<[^>]*>/g, '');
}

/**
 * Calcula els caràcters per segon (CPS) d'un text donada la seva durada,
 * ignorant les etiquetes de format.
 */
export function computeCps(text: string, durationSeconds: number): number {
  if (durationSeconds <= 0) {
    return 0;
  }
  const cleanText = stripSrtTags(text);
  return cleanText.length / durationSeconds;
}

/**
 * Divideix un text en un array de línies basant-se en el caràcter de salt de línia (\n).
 */
export function splitLines(text: string): string[] {
  return text.split('\n');
}
