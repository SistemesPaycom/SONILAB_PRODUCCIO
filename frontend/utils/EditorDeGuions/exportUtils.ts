// utils/EditorDeGuions/exportUtils.ts
import { Document } from '../../appTypes';

declare const XLSX: any;
declare const html2canvas: any;
declare const jspdf: any;

function getBaseFilename(doc: Document | null): string {
  if (!doc) return 'script';
  if (doc.name.endsWith('.snlbpro')) return doc.name.slice(0, -8);
  if (doc.name.endsWith('.slsf')) return doc.name.slice(0, -5); // legacy
  if (doc.name.endsWith('.txt')) return doc.name.slice(0, -4);
  return doc.name;
}

/**
 * Exporta la vista actual del guio a PDF usant el motor natiu d'impressio del navegador.
 *
 * ARQUITECTURA
 * ------------
 * Creem un <iframe> ocult aillat del DOM principal, hi clonem el contingut de
 * #page-content-area (o #page-content-area-video) amb totes les classes i estils
 * inline intactes, hi copiem totes les fulles d'estil del document pare (incloent
 * el CSS generat per Tailwind CDN JIT), hi afegim un bloc de regles @page i
 * break-inside:avoid, i cridem iframe.contentWindow.print().
 *
 * El navegador renderitza el HTML directament a PDF amb el seu propi motor
 * (PDFium/Skia), per tant el document resultant:
 *   - conserva el text com a text real (seleccionable, cercable amb Ctrl+F,
 *     anotable en Edge/Chrome),
 *   - conserva la tipografia, els colors (parentesis amb estil distint segons
 *     siguin timecode/numero o text normal), alineacions i sangries,
 *   - no talla els TAKEs per la meitat (break-inside: avoid sobre l'ancoratge
 *     [data-page-break-anchor="true"] que ColumnView ja emet),
 *   - no depen de jsPDF ni html2canvas: no hi ha limit de strings de V8, de
 *     manera que escala a guions de qualsevol mida.
 *
 * L'usuari rep el dialeg natiu d'impressio i tria "Guardar com PDF" com a desti.
 *
 * NOTA sobre la implementacio legacy
 * ----------------------------------
 * La versio anterior basada en html2canvas + jsPDF genera PDFs de NOMES imatges
 * (sense text real). Aixo rompia Ctrl+F i la seleccio de text, i a mes petava
 * amb "RangeError: Invalid string length" en guions grans perque jsPDF
 * concatena tot el PDF en una unica string de JS abans de desar-lo. Es conserva
 * aillada al final d'aquest fitxer com `exportToPdfLegacyCanvas` (no exportada)
 * nomes com a referencia historica. No s'ha d'utilitzar.
 */
export const exportToPdf = async (doc: Document | null): Promise<void> => {
  const element =
    document.getElementById('page-content-area') ||
    document.getElementById('page-content-area-video');
  if (!element) {
    console.error('[Export] Element to print for PDF not found');
    throw new Error("No s'ha trobat l'element a exportar");
  }

  const title = getBaseFilename(doc);

  // Clon profund del contingut visible del guio: classes de Tailwind, estils
  // inline de ColumnView (tipografia, colors, bold/italic) i estructura queden
  // intactes. Mantenim l'id perque el CSS d'impressio pugui fer-li reset.
  const clonedContent = element.cloneNode(true) as HTMLElement;

  // Iframe ocult, fora de la finestra visible, completament aillat del DOM pare.
  const iframe = document.createElement('iframe');
  iframe.setAttribute('data-script-pdf-print-frame', 'true');
  iframe.style.cssText = [
    'position: fixed',
    'left: -10000px',
    'top: 0',
    'width: 0',
    'height: 0',
    'border: 0',
    'visibility: hidden',
  ].join(';');
  document.body.appendChild(iframe);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    } catch {
      /* noop */
    }
  };

  // Guardem el titol original per restaurar-lo despres de la impressio.
  // Chrome/Edge usen document.title del pare com a nom de fitxer per defecte
  // al dialeg "Guardar com PDF", fins i tot quan es crida print() des d'un iframe.
  const originalParentTitle = document.title;
  let titleRestored = false;
  const restoreTitle = () => {
    if (titleRestored) return;
    titleRestored = true;
    document.title = originalParentTitle;
  };

  try {
    const iframeDoc = iframe.contentDocument;
    const iframeWin = iframe.contentWindow;
    if (!iframeDoc || !iframeWin) {
      throw new Error("No s'ha pogut inicialitzar l'iframe d'impressio");
    }

    // Esquelet minim del document dins de l'iframe.
    iframeDoc.open();
    iframeDoc.write(
      '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>'
    );
    iframeDoc.close();
    iframeDoc.title = title;

    // Base URL: perque els paths relatius de les fulles d'estil copiades
    // (per exemple, qualsevol @font-face que pogues haver-hi en el futur)
    // es resolguin respecte al document pare i no respecte a about:blank.
    const baseEl = iframeDoc.createElement('base');
    baseEl.href = document.baseURI || window.location.href;
    iframeDoc.head.appendChild(baseEl);

    // Copia de totes les fulles d'estil del document principal.
    // Inclou el <style> injectat per Tailwind CDN JIT (inline, accessible sense CORS)
    // i el <style> del index.html amb html{font-size:110%}. D'aquesta manera totes
    // les classes de Tailwind usades per ColumnView (grid, text-right, uppercase,
    // tracking-wide, etc.) funcionen identiques dins de l'iframe.
    const srcSheets = Array.from(document.styleSheets);
    for (const sheet of srcSheets) {
      let injected = false;
      try {
        const rules = (sheet as CSSStyleSheet).cssRules;
        if (rules) {
          const styleEl = iframeDoc.createElement('style');
          styleEl.setAttribute('data-source', 'cloned-from-parent');
          styleEl.textContent = Array.from(rules)
            .map((r) => r.cssText)
            .join('\n');
          iframeDoc.head.appendChild(styleEl);
          injected = true;
        }
      } catch {
        // CORS: alguna fulla cross-origin bloqueja l'acces a cssRules.
        // Fallback: carreguem la fulla per URL dins de l'iframe.
      }
      if (!injected) {
        const href = (sheet as CSSStyleSheet).href;
        if (href) {
          const linkEl = iframeDoc.createElement('link');
          linkEl.rel = 'stylesheet';
          linkEl.href = href;
          iframeDoc.head.appendChild(linkEl);
        }
      }
    }

    // CSS especific d'impressio, aillat dins de l'iframe.
    // - @page: A4 vertical amb margens fixos a dalt/baix/laterals.
    // - print-color-adjust exact: forca que el navegador imprimeixi els colors
    //   reals (per defecte atenua els fons).
    // - [data-page-break-anchor="true"] + break-inside:avoid: garanteix que
    //   cap TAKE es talli per la meitat, igual que feia l'implementacio canvas.
    // - Reset de #page-content-area: eliminem el padding p-12, el shadow, el
    //   border-radius i el width dinamic del editor, perque els margens els
    //   posa @page. Aixi no hi ha doble margen ni doble padding al PDF.
    const printStyle = iframeDoc.createElement('style');
    printStyle.setAttribute('data-source', 'print-rules');
    printStyle.textContent = `
      /*
       * @page amb margin:0 -> Chromium suprimeix els headers/footers automatics
       * del navegador (URL, data, nom de fitxer). Els margens visuals del full
       * es fan amb padding al contenidor de contingut, no a @page.
       *
       * @bottom-right amb counter(page) -> el nostre propi numero de pagina,
       * independent del header/footer del navegador. Aixi conservem paginacio
       * visible pero sense URL ni capcalera.
       */
      @page {
        size: A4 portrait;
        margin: 0;
        @bottom-right {
          content: counter(page);
          font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
          font-size: 9pt;
          color: #888;
          margin: 0 10mm 6mm 0;
        }
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }
      *, *::before, *::after {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      #page-content-area,
      #page-content-area-video {
        box-shadow: none !important;
        border-radius: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        /*
         * Padding que fa de margen visual del full. @page margin es 0.
         * Valors generosos a dalt i baix per donar aire quan el take
         * arriba a omplir la pagina; d'altra manera el text queda pegat
         * al tall del paper. Bottom mes gran per deixar espai al numero
         * de pagina que emet @bottom-right.
         */
        padding: 16mm 12mm 18mm 12mm !important;
        margin: 0 !important;
        background: #ffffff !important;
        box-sizing: border-box !important;
      }
      [data-page-break-anchor="true"] {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      /*
       * Espaiat entre takes NOMES a impressio. No toquem la vista en
       * pantalla: aquestes regles viuen dins de l'iframe i moren amb ell.
       * ColumnView aplica els valors per defecte via style inline; aqui
       * els sobreescrivim amb !important. Els valors han de coincidir
       * amb els que ColumnView usa per a la pantalla (4 / 6) perque el
       * que realment aporta compactacio es reduir el margen del header
       * del take i permetre que els margens del full facin la resta.
       */
      .take-block {
        padding-top: 4px !important;
        margin-bottom: 6px !important;
      }
      .take-block > div:first-of-type {
        margin-bottom: 4px !important;
      }
      [contenteditable] {
        outline: none !important;
      }
    `;
    iframeDoc.head.appendChild(printStyle);

    // Insereix el contingut clonat al body de l'iframe.
    iframeDoc.body.appendChild(clonedContent);

    // Espera que les fonts estiguin carregades dins de l'iframe (si n'hi ha).
    try {
      const fonts: any = (iframeDoc as any).fonts;
      if (fonts && typeof fonts.ready?.then === 'function') {
        await fonts.ready;
      }
    } catch {
      /* noop */
    }

    // Dos rAF consecutius per assegurar que el layout s'ha estabilitzat
    // despres d'injectar els estils i el contingut.
    await new Promise<void>((resolve) => {
      iframeWin.requestAnimationFrame(() =>
        iframeWin.requestAnimationFrame(() => resolve())
      );
    });

    // Registra listeners d'afterprint per netejar l'iframe i restaurar el titol.
    // Posem els listeners tant al window pare com al window de l'iframe: segons
    // el navegador dispara un o l'altre (o tots dos).
    const handleAfterPrint = () => {
      restoreTitle();
      cleanup();
      window.removeEventListener('afterprint', handleAfterPrint);
      try {
        iframeWin.removeEventListener('afterprint', handleAfterPrint);
      } catch {
        /* noop */
      }
    };
    window.addEventListener('afterprint', handleAfterPrint);
    try {
      iframeWin.addEventListener('afterprint', handleAfterPrint);
    } catch {
      /* noop */
    }
    // Fallback: si per qualsevol motiu afterprint no es dispara (algun navegador
    // vell o bloqueig del dialeg), netejem al cap d'un minut.
    setTimeout(() => {
      restoreTitle();
      cleanup();
    }, 60000);

    // Canvi temporal del titol del document pare: Chrome/Edge l'usen com a nom
    // de fitxer suggerit al dialeg de "Guardar com PDF". El restaurem a
    // afterprint (o al timeout de fallback).
    document.title = title;

    iframeWin.focus();
    iframeWin.print();
  } catch (err) {
    restoreTitle();
    cleanup();
    throw err;
  }
};

/**
 * Exporta el contingut del guio a TXT pla per idioma actiu.
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
 * CSV2: Exporta NNN;HH:MM:SS per cada take amb timecode.
 * Format per importar marcadors de take a Nuendo.
 */
export const exportTakesCsv2 = (doc: Document | null, activeLang: string) => {
  if (!doc || !activeLang) return;
  const csvContent = doc.csvContentByLang[activeLang];
  if (!csvContent) return;

  const SEP = ' | ';
  const TC_RE = /^\d{2}:\d{2}:\d{2}$/;
  const outputRows: string[] = [];

  for (const line of csvContent.split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split(SEP);
    const takeRaw = (parts[0] || '').trim();
    const speaker = (parts[1] || '').trim();
    const text = (parts[2] || '').trim();
    if (speaker !== '' || !TC_RE.test(text)) continue;
    const m = /^TAKE\s*#?(\d+)/i.exec(takeRaw);
    if (!m) continue;
    const num = String(parseInt(m[1])).padStart(3, '0');
    outputRows.push(`${num};${text}`);
  }

  if (outputRows.length === 0) {
    alert("No s'han trobat takes amb timecode per exportar.");
    return;
  }

  const blob = new Blob([outputRows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${getBaseFilename(doc)}_takes.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// --- helpers interns per a CSV1 ---

function tcToSecs(tc: string): number {
  const [h, m, s] = tc.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

function secsToTc(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Extreu el codi de temps inicial d'una linia de text si existeix.
 * Formats reconeguts: (57)  (02)  (01:30)
 */
function extractLeadingInlineTc(
  text: string,
  lastKnownSecs: number
): { newSecs: number; cleanText: string } | null {
  // (MM:SS)
  const mmss = /^\(\s*(\d{1,2}):(\d{2})\s*\)/.exec(text);
  if (mmss) {
    const mm = parseInt(mmss[1]);
    const ss = parseInt(mmss[2]);
    const baseH = Math.floor(lastKnownSecs / 3600);
    const candidate = baseH * 3600 + mm * 60 + ss;
    const newSecs = candidate >= lastKnownSecs ? candidate : (baseH + 1) * 3600 + mm * 60 + ss;
    return { newSecs, cleanText: text.slice(mmss[0].length).trimStart() };
  }
  // (SS) - nomes digits, valor valid de segon 0-59
  const ss_match = /^\(\s*(\d{1,2})\s*\)/.exec(text);
  if (ss_match) {
    const ss = parseInt(ss_match[1]);
    if (ss <= 59) {
      const lastM = Math.floor((lastKnownSecs % 3600) / 60);
      const lastH = Math.floor(lastKnownSecs / 3600);
      const lastS = lastKnownSecs % 60;
      let newM = lastM, newH = lastH;
      if (ss < lastS) {
        newM++;
        if (newM >= 60) { newM = 0; newH++; }
      }
      const newSecs = newH * 3600 + newM * 60 + ss;
      return { newSecs, cleanText: text.slice(ss_match[0].length).trimStart() };
    }
  }
  return null;
}

/**
 * CSV1: Exporta marcadors per a Nuendo amb TC d'entrada per cada personatge.
 * Format: Start;Name;Description  (sense cabecera)
 */
export const exportNuendoCsv1 = (doc: Document | null, activeLang: string) => {
  if (!doc || !activeLang) return;
  const csvContent = doc.csvContentByLang[activeLang];
  if (!csvContent) return;

  const SEP = ' | ';
  const TC_RE = /^\d{2}:\d{2}:\d{2}$/;
  const outputRows: string[] = [];

  let lastKnownSecs = 0;

  for (const line of csvContent.split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split(SEP);
    const takeRaw = (parts[0] || '').trim();
    const speaker = (parts[1] || '').trim();
    const text = (parts[2] || '').trim();

    // Fila de TC de take: actualitzem el referent temporal
    if (!speaker && TC_RE.test(text)) {
      lastKnownSecs = tcToSecs(text);
      continue;
    }

    // Fila de personatge
    if (!speaker) continue;

    let lineSecs = lastKnownSecs;
    let displayText = text;

    const extracted = extractLeadingInlineTc(text, lastKnownSecs);
    if (extracted) {
      lineSecs = extracted.newSecs;
      displayText = extracted.cleanText;
      lastKnownSecs = lineSecs;
    }

    const tc = secsToTc(lineSecs);
    const name = takeRaw ? `${takeRaw} · ${speaker}` : speaker;
    outputRows.push(`${tc};${name};${displayText}`);
  }

  if (outputRows.length === 0) {
    alert("No s'han trobat linies de personatge per exportar.");
    return;
  }

  const blob = new Blob([outputRows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${getBaseFilename(doc)}_nuendo.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/* ============================================================================
 *                            LEGACY — NO UTILITZAR
 * ============================================================================
 *
 * `exportToPdfLegacyCanvas` es la implementacio anterior del export a PDF del
 * guio. Es CONSERVA aillada pero NO es crida des d'enlloc. Esta aqui nomes com
 * a referencia historica.
 *
 * Per que NO es fa servir:
 *  1. Genera PDFs 100% imatge (captures de html2canvas + addImage a jsPDF).
 *     Aixo trencava Ctrl+F, la seleccio de text i les anotacions textuals
 *     al visor d'Edge/Chrome. Els actors que usen els PDFs no podien cercar.
 *  2. Peta amb "RangeError: Invalid string length" en guions grans (~200+
 *     takes). jsPDF concatena tot el PDF en una unica string de JS dins de
 *     pdf.save(), i V8 te un limit dur de ~512 MB per string. Amb prou
 *     segments PNG acumulats, aquest limit es supera.
 *
 * Substituit per `exportToPdf` (a dalt d'aquest fitxer), que usa
 * window.print() des d'un iframe aillat i genera un PDF amb text real.
 *
 * AVIS: si algu elimina aquesta funcio en el futur, pot tambe netejar els
 * scripts de html2canvas i jspdf del index.html SI ningu mes els usa.
 * Avui dia aquestes llibreries nomes les referencia aquesta funcio legacy
 * dins del frontend.
 *
 * @deprecated No fer servir. Vegeu exportToPdf a la part superior del fitxer.
 * @internal
 * ============================================================================
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const exportToPdfLegacyCanvas = async (doc: Document | null): Promise<void> => {
  const element =
    document.getElementById('page-content-area') ||
    document.getElementById('page-content-area-video');
  if (!element) {
    console.error('[Export][legacy] Element to capture for PDF not found');
    throw new Error("No s'ha trobat l'element a exportar");
  }

  const SCALE = 2;
  // Limit segur d'alcada de canvas per a la majoria de navegadors (~16384 px).
  const MAX_CANVAS_H = 14000;
  const MAX_DOM_H_PER_SEGMENT = Math.floor(MAX_CANVAS_H / SCALE);
  const BREAK_MARGIN_MM = 8;
  const PAGE_W_MM = 210;

  const domW = element.clientWidth;
  const domH = element.scrollHeight;
  const canvasPxPerMm = (domW * SCALE) / PAGE_W_MM;

  const getOffsetY = (child: HTMLElement): number => {
    let offset = 0;
    let el: HTMLElement | null = child;
    while (el && el !== element) {
      offset += el.offsetTop;
      el = el.offsetParent as HTMLElement | null;
    }
    return offset;
  };

  const anchors = Array.from(
    element.querySelectorAll('[data-page-break-anchor="true"]')
  ) as HTMLElement[];

  const anchorYs: number[] = [];
  for (const anchor of anchors) {
    const y = getOffsetY(anchor);
    if (y > 0 && y < domH) anchorYs.push(y);
  }
  anchorYs.sort((a, b) => a - b);
  const uniqueYs = [...new Set(anchorYs)];

  const breaks: number[] = [];
  let lastBp = 0;
  let lastCand = 0;
  for (const y of uniqueYs) {
    if (y - lastBp > MAX_DOM_H_PER_SEGMENT) {
      const bp = lastCand > lastBp ? lastCand : lastBp + MAX_DOM_H_PER_SEGMENT;
      breaks.push(Math.min(bp, domH));
      lastBp = bp;
    }
    lastCand = y;
  }
  while (domH - lastBp > MAX_DOM_H_PER_SEGMENT) {
    const bp = lastBp + MAX_DOM_H_PER_SEGMENT;
    breaks.push(Math.min(bp, domH));
    lastBp = bp;
  }

  const segs: Array<[number, number]> = [];
  let s = 0;
  for (const bp of breaks) { segs.push([s, bp]); s = bp; }
  segs.push([s, domH]);

  const isOnly = segs.length === 1;
  let pdf: any = null;

  const captureSegment = async (startY: number, height: number): Promise<HTMLCanvasElement> => {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-html2canvas-export-wrapper', 'true');
    wrapper.style.cssText = [
      'position: fixed',
      'left: -100000px',
      'top: 0',
      `width: ${domW}px`,
      `height: ${height}px`,
      'overflow: hidden',
      'background: #ffffff',
      'margin: 0',
      'padding: 0',
      'z-index: -1',
      'pointer-events: none',
    ].join(';');

    const clone = element.cloneNode(true) as HTMLElement;
    clone.removeAttribute('id');
    clone.style.position = 'absolute';
    clone.style.top = `${-startY}px`;
    clone.style.left = '0';
    clone.style.margin = '0';
    clone.style.width = `${domW}px`;

    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    try {
      const canvas: HTMLCanvasElement = await html2canvas(wrapper, {
        scale: SCALE,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: domW,
        windowHeight: height,
      });
      return canvas;
    } finally {
      document.body.removeChild(wrapper);
    }
  };

  for (let i = 0; i < segs.length; i++) {
    const [segStart, segEnd] = segs[i];
    const segDomH = segEnd - segStart;
    const isFirst = i === 0;
    const isLast = i === segs.length - 1;

    const sliceCanvas = await captureSegment(segStart, segDomH);

    const imgData = sliceCanvas.toDataURL('image/png');
    const imgHMm = (segDomH * SCALE) / canvasPxPerMm;
    const topMm = isFirst || isOnly ? 0 : BREAK_MARGIN_MM;
    const botMm = isLast || isOnly ? 0 : BREAK_MARGIN_MM;
    const pageHMm = topMm + imgHMm + botMm;

    if (isFirst) {
      pdf = new jspdf.jsPDF({ orientation: 'p', unit: 'mm', format: [PAGE_W_MM, pageHMm] });
    } else {
      pdf.addPage([PAGE_W_MM, pageHMm]);
    }
    pdf.addImage(imgData, 'PNG', 0, topMm, PAGE_W_MM, imgHMm);
  }

  pdf.save(`${getBaseFilename(doc)}.pdf`);
};
