
// utils/Import/pdfImporter.ts
// @ts-ignore - resolt via importmap a index.html
import * as pdfjsLib from 'pdfjs-dist';
import { ImportOptions, postProcessImportedText } from './importShared';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

export async function importPdfFile(
  file: File,
  options: ImportOptions
): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

  if (pdf.numPages === 0) {
    throw new Error('El PDF està buit.');
  }

  let rawText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const pageHeight = viewport.height;
    
    const textContent = await page.getTextContent();
    const styles = textContent.styles;

    let lastY = -1;
    let pageLines: string[] = [];
    let currentLine = '';

    // Llindars per detectar capçaleres i peus de pàgina (números de pàgina)
    const headerThreshold = pageHeight * 0.93; 
    const footerThreshold = pageHeight * 0.07;

    textContent.items.forEach((item: any) => {
      const str = item.str;
      const x = item.transform[4];
      const y = item.transform[5]; // En PDF.js la Y sol anar de baix a dalt

      // HEURÍSTICA ANTI-NÚMERO DE PÀGINA:
      // Si el text és només un número i està a la zona de capçalera o peu, l'ignorem.
      const isSolitaryNumber = /^\d+$/.test(str.trim());
      const isInHMargin = y > headerThreshold || y < footerThreshold;
      
      if (isSolitaryNumber && isInHMargin) {
        return; 
      }

      if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 2) {
        pageLines.push(currentLine);
        currentLine = '';
      }

      let text = str;
      if (text.trim() !== '') {
        const style = styles[item.fontName];
        const fontName = item.fontName || '';
        const fontFamily = style ? style.fontFamily || '' : '';

        const isBold =
          /bold|black|heavy|demi/i.test(fontFamily) ||
          /bold|black|heavy|demi/i.test(fontName);
        const isItalic =
          /italic|oblique/i.test(fontFamily) ||
          /italic|oblique/i.test(fontName);

        if (isBold) text = `<b>${text}</b>`;
        if (isItalic) text = `<i>${text}</i>`;
      }

      currentLine += text;
      lastY = item.transform[5];
    });

    pageLines.push(currentLine);
    rawText += pageLines.join('\n') + '\n';
  }

  if (!rawText.trim()) {
    throw new Error('No s’ha trobat cap capa de text al PDF.');
  }

  return postProcessImportedText(rawText, options);
}
