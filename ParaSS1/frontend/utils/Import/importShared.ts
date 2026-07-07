
// utils/Import/importShared.ts

// Opcions generals que passen App.tsx, pdfImporter i docxImporter
export interface ImportOptions {
  cleanSpaces: boolean;        // substituir espais “estranys” per espai normal
  applyTabHeuristic: boolean;  // convertir "*NOM*   TEXT" en "*NOM*\tTEXT"
}

/**
 * Processat comú del text que ve del PDF:
 *  - normalitza salts de línia
 *  - treu etiquetes HTML (<b>, <i>, …)
 *  - reenganxa línies trencades de paràgrafs (només dins del cos del guió)
 *  - aplica l’heurística "*NOM*   TEXT" -> "*NOM*\tTEXT"
 */
export function postProcessImportedText(
  rawText: string,
  options: ImportOptions
): string {
  // 1) Normalitza salts de línia a "\n"
  let text = rawText.replace(/\r\n?/g, '\n');

  // 2) Treu qualsevol etiqueta HTML (només fem servir <b> i <i> al PDF)
  text = text.replace(/<[^>]+>/g, '');

  // 3) Espais no separables, etc.
  if (options.cleanSpaces) {
    text = text.replace(/[\u00A0\u2000-\u200B]/g, ' ');
  }

  // 4) Trailing spaces al final de línia
  text = text.replace(/[ \t]+$/gm, '');

  // 5) Reenganxa línies trencades de paràgrafs.
  //    NOMÉS després d’entrar al cos del guió (quan ja hem vist un TAKE).
  const lines = text.split('\n');
  const resultLines: string[] = [];

  const isTakeLine = (s: string) => /^TAKE\s*#?\s*\d+/i.test(s);
  const isTimecode = (s: string) => /^\d{2}:\d{2}(:\d{2})?$/.test(s);
  const isSpeaker = (s: string) => /^\*[^*]+\*/.test(s.trim());
  const isSeparator = (s: string) => /^[-–—]{5,}$/.test(s.trim());

  let inScriptBody = false; // passa a true quan trobem el primer TAKE

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/g, '');
    const trimmed = line.trim();

    // Línia buida -> guardem com a separador, però no en repetim moltes seguides
    if (!trimmed) {
      if (resultLines.length === 0 || resultLines[resultLines.length - 1] !== '') {
        resultLines.push('');
      }
      continue;
    }

    const isTake = isTakeLine(trimmed);
    const isBlockStart =
      isTake || isTimecode(trimmed) || isSpeaker(trimmed) || isSeparator(trimmed);

    if (isTake) {
      inScriptBody = true;
    }

    // SI LA LÍNIA ÉS NOMÉS UN NÚMERO I SOM AL COS DEL GUIÓ, ÉS UN NÚMERO DE PÀGINA RESIDUAL.
    // L'ignorem completament per evitar que s'ajunti al diàleg anterior.
    const isSolitaryNumber = /^\d+$/.test(trimmed);
    if (inScriptBody && isSolitaryNumber && !isBlockStart) {
        continue;
    }

    if (resultLines.length === 0) {
      resultLines.push(trimmed);
      continue;
    }

    const prev = resultLines[resultLines.length - 1];
    const prevTrimmed = prev.trim();

    // Només ajuntem línies si ja som dins del cos del guió
    // i si aquesta línia NO és inici de bloc.
    if (inScriptBody && !isBlockStart && prevTrimmed !== '') {
      resultLines[resultLines.length - 1] =
        (prevTrimmed + ' ' + trimmed).replace(/ {2,}/g, ' ');
    } else {
      // Nou bloc (o bé encara som al preàmbul)
      resultLines.push(trimmed);
    }
  }

  text = resultLines.join('\n');

  // 6) Heurística "*NOM*   TEXT" -> "*NOM*\tTEXT"
  if (options.applyTabHeuristic) {
    const speakerLineRegex = /^\s*\*[^*]+\*/;
    const processedLines = text.split('\n').map((line) => {
      if (!speakerLineRegex.test(line)) return line;
      if (line.includes('\t')) return line; // ja està OK

      // 2+ espais després de *NOM*
      const firstSpaceRunAfterName = /^(\s*\*[^*]+\*)(\s{2,})(.+)$/;
      let m = line.match(firstSpaceRunAfterName);
      if (m) {
        const namePart = m[1];
        const rest = m[3];
        return `${namePart}\t${rest.trimStart()}`;
      }

      // Si només hi ha 1 espai, també el convertim a TAB
      const firstSpaceAfterName = /^(\s*\*[^*]+\*)(\s+)(.+)$/;
      m = line.match(firstSpaceAfterName);
      if (m) {
        const namePart = m[1];
        const rest = m[3];
        return `${namePart}\t${rest.trimStart()}`;
      }

      return line;
    });

    text = processedLines.join('\n');
  }

  return text;
}
