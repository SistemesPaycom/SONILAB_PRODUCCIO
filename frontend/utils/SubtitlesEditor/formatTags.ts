// utils/SubtitlesEditor/formatTags.ts

/**
 * Manipulació NO destructiva de tags de format SRT (<i>, <b>, <u>) sobre strings.
 * Cada funció opera EXCLUSIVAMENT sobre el tag indicat: mai toca els altres tags.
 * Lectura case-insensitive (tolerància a <I> de fitxers externs), escriptura en minúscules.
 * Funcions pures: sense DOM, sense React (verificables de manera aïllada).
 */

export type SrtFormatTag = 'i' | 'b' | 'u';

/** Elimina totes les aparicions de <tag> i </tag> (case-insensitive). No toca cap altre tag. */
export function stripTag(text: string, tag: SrtFormatTag): string {
  if (!text) return text;
  return text.replace(new RegExp(`</?${tag}>`, 'gi'), '');
}

/** true si el text té contingut visible (fora de qualsevol seqüència <...>). */
export function hasVisibleText(text: string): boolean {
  if (!text) return false;
  return text.replace(/<[^>]*>/g, '').trim().length > 0;
}

/**
 * true si TOT el text visible està dins de regions <tag>…</tag>.
 * - Els blancs (espais, salts de línia) fora de regions s'ignoren:
 *   "<i>l1</i>\n<i>l2</i>" i "<i>l1\nl2</i>" compten totes dues com a tot-taggejat.
 * - Qualsevol altra seqüència <...> és markup, no text visible.
 * - Un <tag> obert sense tancar cobreix fins al final (tolerància a tags desequilibrats).
 * - Sense text visible → false.
 */
export function isFullyTagged(text: string, tag: SrtFormatTag): boolean {
  if (!text) return false;
  const openRe = new RegExp(`^<${tag}>$`, 'i');
  const closeRe = new RegExp(`^</${tag}>$`, 'i');
  let depth = 0;
  let sawVisible = false;

  // Recorregut únic: trossos de text visible separats per tokens <...>
  const tokenRe = /<[^>]*>/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  const chunkOk = (chunk: string): boolean => {
    if (chunk.trim().length === 0) return true; // blancs: ignorats
    sawVisible = true;
    return depth > 0; // text visible fora de regió → invalida
  };

  while ((m = tokenRe.exec(text)) !== null) {
    if (!chunkOk(text.slice(lastIndex, m.index))) return false;
    if (openRe.test(m[0])) depth++;
    else if (closeRe.test(m[0])) depth = Math.max(0, depth - 1);
    lastIndex = m.index + m[0].length;
  }
  if (!chunkOk(text.slice(lastIndex))) return false;
  return sawVisible;
}

/**
 * Embolcalla CADA LÍNIA amb <tag>…</tag> (convenció per-línia; en lectura també
 * s'accepta la forma en bloc <i>l1\nl2</i>). Línies sense text visible queden intactes (mai <i></i>).
 * PRECONDICIÓ del cridador: text ja passat per stripTag(text, tag).
 */
export function wrapTagPerLine(text: string, tag: SrtFormatTag): string {
  if (!text) return text;
  return text
    .split('\n')
    .map(line => (hasVisibleText(line) ? `<${tag}>${line}</${tag}>` : line))
    .join('\n');
}

/** true si hi ha ≥1 text amb contingut visible i TOTS els que en tenen són fullyTagged. */
export function allFullyTagged(texts: string[], tag: SrtFormatTag): boolean {
  const formattable = texts.filter(hasVisibleText);
  if (formattable.length === 0) return false;
  return formattable.every(t => isFullyTagged(t, tag));
}

/**
 * Toggle en lot amb semàntica "make consistent":
 * - Si TOTS els textos amb contingut visible són tot-taggejats → TREURE el tag de tots.
 * - Si no → APLICAR a tots: normalitzar primer (stripTag) i embolcallar per línia.
 *   Així "hola <i>com</i> estas" esdevé "<i>hola com estas</i>" (mai tags niats).
 * - Els textos sense contingut visible es retornen byte-idèntics.
 * Retorna un array nou de la mateixa longitud i ordre.
 */
export function toggleTagOnTexts(texts: string[], tag: SrtFormatTag): string[] {
  const removing = allFullyTagged(texts, tag);
  return texts.map(t => {
    if (!hasVisibleText(t)) return t;
    return removing ? stripTag(t, tag) : wrapTagPerLine(stripTag(t, tag), tag);
  });
}
