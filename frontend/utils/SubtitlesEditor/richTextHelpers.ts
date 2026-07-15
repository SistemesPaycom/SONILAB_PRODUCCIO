// utils/SubtitlesEditor/richTextHelpers.ts

/**
 * Converteix tags SRT (<i>, <b>, <u>) a HTML net per a l'editor contentEditable.
 */
export function plainToRich(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Re-convertim els tags protegits
    .replace(/&lt;i&gt;/gi, '<i>')
    .replace(/&lt;\/i&gt;/gi, '</i>')
    .replace(/&lt;b&gt;/gi, '<b>')
    .replace(/&lt;\/b&gt;/gi, '</b>')
    .replace(/&lt;u&gt;/gi, '<u>')
    .replace(/&lt;\/u&gt;/gi, '</u>')
    .replace(/ {2}/g, ' &nbsp;') 
    .replace(/\n/g, '<br>');
}

/**
 * Parteix un text SRT en una línia d'HTML per cada línia del text.
 *
 * A diferència de `text.split('\n').map(plainToRich)`, propaga els tags que queden
 * oberts d'una línia a la següent: la forma en bloc `<i>línia1\nlínia2</i>` (habitual
 * en SRT importats) es renderitzaria altrament amb només la primera línia en cursiva,
 * perquè el `</i>` orfe de la segona línia el descarta el parser d'HTML.
 */
export function plainToRichLines(text: string): string[] {
  const open: string[] = [];

  return (text || '').split('\n').map((line) => {
    const prefix = open.map((t) => `<${t}>`).join('');

    const tagRe = /<(\/?)([biu])>/gi;
    let match: RegExpExecArray | null;
    while ((match = tagRe.exec(line)) !== null) {
      const tag = match[2].toLowerCase();
      if (match[1]) {
        const last = open.lastIndexOf(tag);
        if (last !== -1) open.splice(last, 1);
      } else {
        open.push(tag);
      }
    }

    const suffix = [...open].reverse().map((t) => `</${t}>`).join('');
    return plainToRich(prefix + line + suffix);
  });
}

/**
 * Converteix l'HTML del navegador a text pla amb tags SRT estàndard,
 * eliminant estils i tags no suportats.
 */
export function richToPlain(html: string): string {
  if (!html) return '';
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // 1. Processar elements de format de manera recursiva
  const processNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      let content = '';
      el.childNodes.forEach(child => content += processNode(child));

      const tag = el.tagName.toLowerCase();
      if (tag === 'i' || tag === 'em') return `<i>${content}</i>`;
      if (tag === 'b' || tag === 'strong') return `<b>${content}</b>`;
      if (tag === 'u') return `<u>${content}</u>`;
      if (tag === 'br') return '\n';
      if (tag === 'div' || tag === 'p') return '\n' + content;
      
      return content; // Ignorar altres tags però mantenir el contingut
    }
    
    return '';
  };

  let result = '';
  tempDiv.childNodes.forEach(child => result += processNode(child));

  // Neteja final — eliminem salts de línia de contorn però preservem espais intencionals
  return result
    .replace(/\u00A0/g, ' ') // Espais no separables a normals
    .replace(/\n{3,}/g, '\n\n') // Màxim 2 salts
    .replace(/^\n+|\n+$/g, ''); // Elimina \n inicials/finals sense afectar espais
}
