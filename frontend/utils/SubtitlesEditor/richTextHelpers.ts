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

  // Neteja final
  return result
    .replace(/\u00A0/g, ' ') // Espais no separables a normals
    .replace(/\n{3,}/g, '\n\n') // Màxim 2 salts
    .trim();
}
