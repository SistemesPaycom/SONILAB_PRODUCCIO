
// utils/Import/docxImporter.ts
// Importador de DOCX -> text pla tipus guió

// IMPORTANT: fem servir la build de navegador de mammoth
// declarada a index.html (mammoth.browser.min.js).
// Això exposa un objecte global `mammoth`.
declare const mammoth: {
  extractRawText(options: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
};

import { ImportOptions } from './importShared';

/**
 * Aplica transformacions específiques per als guions DOCX
 * per deixar-los amb la mateixa estructura que els PDF:
 *  - salts de línia normals (sense línies buides extra)
 *  - línies de personatge: "*NOM*<TAB>TEXT"
 */
function normalizeDocxRawText(rawText: string, options: ImportOptions): string {
  // 1) Normalitza salts de línia a \n
  let text = rawText.replace(/\r\n?/g, '\n');

  // 2) DOCX (mammoth) posa normalment \n\n entre paràgrafs.
  //    Això ens crea una línia buida entre cada línia del guió.
  //    Ho aplanem perquè s’assembli al que fa el PDF:
  //      "línia\n\nlínia" => "línia\nlínia"
  text = text.replace(/\n{2,}/g, '\n');

  // 3) Neteja espais no separables, si cal
  if (options.cleanSpaces) {
    text = text.replace(/[\u00A0\u2000-\u200B]/g, ' ');
  }

  // 4) Elimina espais / tabs al final de línia
  text = text.replace(/[ \t]+$/gm, '');

  // 5) Converteix espais després de *NOM* en TAB perquè
  //    el ColumnView pugui separar bé personatge i text.
  if (options.applyTabHeuristic) {
    const speakerLineRegex = /^\s*\*[^*]+\*/; // línia que comença per *NOM*

    const lines = text.split('\n');
    const processed = lines.map((line) => {
      if (!speakerLineRegex.test(line)) return line;

      // Si ja hi ha un TAB, no toquem res
      if (line.includes('\t')) return line;

      // Substitueix el primer bloc de 2+ espais després del *NOM* per un TAB
      const firstSpaceRunAfterName = /^(\s*\*[^*]+\*)(\s{2,})(.+)$/;
      const m = line.match(firstSpaceRunAfterName);
      if (m) {
        const [, namePart, , rest] = m;
        return `${namePart}\t${rest.trimStart()}`;
      }

      // Fallback: si només hi ha un espai, també el convertim a TAB
      const firstSpaceAfterName = /^(\s*\*[^*]+\*)(\s+)(.+)$/;
      const m2 = line.match(firstSpaceAfterName);
      if (m2) {
        const [, namePart, , rest] = m2;
        return `${namePart}\t${rest.trimStart()}`;
      }

      return line;
    });

    text = processed.join('\n');
  }

  return text;
}

/**
 * Importa un DOCX i el converteix a text pla amb la mateixa estructura
 * que el PDF (TAKE, timecode, *PERSONATGE* + TAB + text, etc.).
 */
export async function importDocxFile(
  file: File,
  options: ImportOptions
): Promise<string> {
  // 1) Llegim el DOCX com a ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  // 2) Extreiem TEXT (no HTML) de Word.
  const { value: rawText } = await mammoth.extractRawText({ arrayBuffer });

  // 3) Normalització específica per a guions
  const normalized = normalizeDocxRawText(rawText, options);

  return normalized;
}
