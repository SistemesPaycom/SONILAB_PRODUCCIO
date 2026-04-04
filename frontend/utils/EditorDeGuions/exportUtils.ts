// utils/EditorDeGuions/exportUtils.ts
import { Document } from '../../types';

declare const XLSX: any;
declare const html2canvas: any;
declare const jspdf: any;

function getBaseFilename(doc: Document | null): string {
  if (!doc) return 'script';
  if (doc.name.endsWith('.snlbpro')) return doc.name.slice(0, -8);
  if (doc.name.endsWith('.slsf')) return doc.name.slice(0, -5); // legacy
  return doc.name;
}

/**
 * Exporta la vista actual (div#page-content-area) a PDF en format A4.
 * - Captura tot el contingut amb html2canvas.
 * - Calcula la mida d’una pàgina A4 en píxels de canvas.
 * - Talla el canvas en trossos, intentant tallar just abans del següent TAKE
 *   (els <section> amb data-page-break-anchor="true"), i evitant que
 *   l’últim TAKE quedi sol en una pàgina si encara cap al full anterior.
 */
export const exportToPdf = async (doc: Document | null) => {
  const element = document.getElementById('page-content-area');
  if (!element) {
    console.error('Element to capture for PDF not found');
    return;
  }

  // 1. Captura DOM amb html2canvas (un sol canvas gegant)
  const canvas: HTMLCanvasElement = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  });

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  // 2. Configura jsPDF A4 en mil·límetres
  const pdf = new jspdf.jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidthMm = pdf.internal.pageSize.getWidth();
  const pageHeightMm = pdf.internal.pageSize.getHeight();

  // Relació píxels (canvas) -> mm (PDF) mantenint proporció d’ample
  const pxPerMm = canvasWidth / pageWidthMm;
  const pageHeightPx = pageHeightMm * pxPerMm;

  // 3. Localitza tots els anchors de tall (cada TAKE)
  const anchors = Array.from(
    element.querySelectorAll('[data-page-break-anchor="true"]')
  ) as HTMLElement[];

  const elementRect = element.getBoundingClientRect();
  const elementTopOnPage = elementRect.top + window.scrollY;

  // Posicions Y (en píxels de canvas) de cada anchor
  const anchorPositionsPx: number[] = [];

  for (const anchor of anchors) {
    const rect = anchor.getBoundingClientRect();
    const anchorTopOnPage = rect.top + window.scrollY;
    const offsetInElement = anchorTopOnPage - elementTopOnPage; // píxels DOM
    const scaleY = canvasHeight / elementRect.height; // relació DOM->canvas
    const yOnCanvas = offsetInElement * scaleY;
    if (yOnCanvas > 0 && yOnCanvas < canvasHeight) {
      anchorPositionsPx.push(yOnCanvas);
    }
  }

  // Ordena i elimina duplicats
  anchorPositionsPx.sort((a, b) => a - b);
  const uniqueAnchorsPx = Array.from(new Set(anchorPositionsPx));

  // 4. Calcular punts de tall de pàgina (en coordenades de canvas)
  //    Estratègia:
  //    - Recorrem els anchors de dalt a baix.
  //    - Si la distància des de l’últim tall fins a aquest anchor
  //      supera l’alçada de pàgina, fem un tall al darrer anchor
  //      vàlid (no l’actual).
  //    - Això evita que l’últim anchor generi una pàgina extra si no cal.
  const pageBreaksPx: number[] = [];

  let lastBreakPx = 0;          // inici del bloc actual
  let lastCandidatePx = 0;      // darrer anchor vist que podria ser tall

  for (const anchorY of uniqueAnchorsPx) {
    // Si aquest anchor, sumat al tram actual, ja supera una pàgina A4...
    if (anchorY - lastBreakPx > pageHeightPx) {
      // Fem el tall al darrer anchor que havíem vist (no el que ja desborda).
      const breakY =
        lastCandidatePx > lastBreakPx
          ? lastCandidatePx
          : lastBreakPx + pageHeightPx; // fallback si no hi havia cap anchor

      pageBreaksPx.push(Math.min(breakY, canvasHeight));
      lastBreakPx = breakY;
    }

    // Actualitzem el darrer anchor vist.
    lastCandidatePx = anchorY;
  }

  // Si després de processar tots els anchors encara queda un tram més alt
  // que una pàgina, afegim talls fixos d'alçada màxima.
  while (canvasHeight - lastBreakPx > pageHeightPx) {
    const breakY = lastBreakPx + pageHeightPx;
    pageBreaksPx.push(Math.min(breakY, canvasHeight));
    lastBreakPx = breakY;
  }

  // 5. Retalla el canvas en pàgines segons pageBreaksPx
  let pageStartPx = 0;
  let pageIndex = 0;

  const addSliceToPdf = (startPx: number, endPx: number) => {
    const sliceHeightPx = endPx - startPx;
    if (sliceHeightPx <= 0) return;

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvasWidth;
    pageCanvas.height = sliceHeightPx;

    const ctx = pageCanvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get 2D context for page canvas');
      return;
    }

    ctx.drawImage(
      canvas,
      0,
      startPx,
      canvasWidth,
      sliceHeightPx,
      0,
      0,
      canvasWidth,
      sliceHeightPx
    );

    const imgDataPage = pageCanvas.toDataURL('image/png');
    const sliceHeightMm = sliceHeightPx / pxPerMm;

    if (pageIndex > 0) {
      pdf.addPage(); // nova pàgina A4
    }

    pdf.addImage(imgDataPage, 'PNG', 0, 0, pageWidthMm, sliceHeightMm);
    pageIndex++;
  };

  // Primer, totes les pàgines definides pels talls calculats
  for (const breakY of pageBreaksPx) {
    addSliceToPdf(pageStartPx, breakY);
    pageStartPx = breakY;
  }

  // Finalment, l’últim tram des de l’últim tall fins al final del canvas.
  // Si encara hi ha contingut, això inclourà l’últim TAKE i espai restant.
  if (pageStartPx < canvasHeight) {
    addSliceToPdf(pageStartPx, canvasHeight);
  }

  pdf.save(`${getBaseFilename(doc)}.pdf`);
};

/**
 * Exporta el contingut del guió a TXT pla per idioma actiu.
 */
export const exportToTxt = (doc: Document | null, activeLang: string) => {
  if (!doc || !activeLang) return;
  const content = doc.contentByLang[activeLang];
  if (content === undefined) return;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${getBaseFilename(doc)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Exporta totes les dades (TAKE, PERSONATGE, TEXT) a Excel per idioma actiu.
 */
export const exportToXlsx = (doc: Document | null, activeLang: string) => {
  if (!doc || !activeLang) return;
  const csvContent = doc.csvContentByLang[activeLang];
  if (csvContent === undefined) return;

  const data = csvContent.split('\n').map((row) => row.split(' | '));
  const header = ['TAKE', 'PERSONATGE', 'TEXT'];
  data.unshift(header);

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dades');
  XLSX.writeFile(wb, `${getBaseFilename(doc)}.xlsx`);
};

/**
 * Exporta un CSV amb només TAKE i TC per idioma actiu.
 * - PERSONATGE buit
 * - TEXT és timecode HH:MM:SS
 * - TAKE del tipus "TAKE #X" -> només X
 */
export const exportTakesCsv = (doc: Document | null, activeLang: string) => {
  if (!doc || !activeLang) {
    console.warn('No document or active language for CSV export.');
    return;
  }

  const csvContent = doc.csvContentByLang[activeLang];
  if (csvContent === undefined) {
    console.warn('No csvContent available on document for the active language.');
    return;
  }

  const lines = csvContent.split('\n');
  const timecodeRegex = /^\d{2}:\d{2}:\d{2}$/;
  const outputRows: string[] = ['TAKE,TC'];

  for (const rawRow of lines) {
    if (!rawRow.trim()) continue;

    const parts = rawRow.split(' | ');
    const takeRaw = (parts[0] || '').trim();
    const speaker = (parts[1] || '').trim();
    const text = (parts[2] || '').trim();

    if (speaker !== '') continue;
    if (!timecodeRegex.test(text)) continue;

    const takeMatch = /^TAKE\s*#?(\d+)/i.exec(takeRaw);
    if (!takeMatch) continue;

    const takeNumber = takeMatch[1];
    outputRows.push(`${takeNumber},${text}`);
  }

  if (outputRows.length === 1) {
    alert("No s'han trobat takes amb timecode per exportar.");
    return;
  }

  const csvOutputContent = outputRows.join('\n');
  const blob = new Blob([csvOutputContent], {
    type: 'text/csv;charset=utf-8',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${getBaseFilename(doc)}_takes_tc.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
