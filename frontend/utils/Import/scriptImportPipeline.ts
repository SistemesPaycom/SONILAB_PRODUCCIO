/**
 * utils/Import/scriptImportPipeline.ts
 *
 * PIPELINE COMPARTIT D'IMPORTACIÓ DE GUIONS ESTRUCTURATS
 * =====================================================
 * Converteix DOCX o PDF al format TXT canònic de SONILAB
 * (text pla estructurat amb takes, personatges i diàlegs),
 * de la MATEIXA manera que ho fa la importació convencional
 * des de LibraryView.tsx.
 *
 * TOTS els fluxos d'importació de guió (LibraryView, CreateProjectModal,
 * ScriptViewPanel, etc.) han de passar per aquesta funció.
 * No hi ha d'haver branques paral·leles ni lògica duplicada.
 *
 * Entrades acceptades: .docx, .pdf
 * Sortida: contingut TXT canònic + CSV derivat + nom de fitxer .txt
 */

import { importDocxFile } from './docxImporter';
import { importPdfFile } from './pdfImporter';
import type { ImportOptions } from './importShared';
import { parseScript } from '../EditorDeGuions/scriptParser';
import { scriptToCsv } from '../EditorDeGuions/csvConverter';

/** Opcions de normalització per defecte (les mateixes que LibraryView) */
const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  cleanSpaces: true,
  applyTabHeuristic: true,
};

/**
 * Resultat de la importació d'un guió estructurat.
 */
export interface ImportedStructuredScript {
  /** Nom final del fitxer amb extensió .txt */
  fileName: string;
  /** Nom base sense extensió (per a referència) */
  baseName: string;
  /**
   * Contingut TXT canònic estructurat.
   * És la FONT DE VERITAT per a la vista MONO i el parser.
   * Format: TAKE #N / HH:MM:SS / *PERSONATGE*\tDIÀLEG / separadors
   */
  content: string;
  /**
   * Contingut CSV derivat del contingut canònic.
   * Usat per la vista DADES (CsvView).
   * Format: TAKE | PERSONATGE | TEXT (separador ' | ')
   */
  csvContent: string;
  /**
   * Tipus intern per a la biblioteca (compat. legacy .slsf).
   * El nom visible és .txt però sourceType manté 'slsf' per a detecció.
   */
  sourceType: 'slsf';
}

/**
 * Importa un fitxer DOCX o PDF i el converteix al format TXT estructurat
 * canònic de SONILAB, usant exactament la mateixa lògica que la importació
 * convencional de la biblioteca (LibraryView.tsx).
 *
 * @param file   Fitxer seleccionat per l'usuari (.docx o .pdf)
 * @param options Opcions de normalització (per defecte: cleanSpaces + applyTabHeuristic)
 * @throws Error si el format del fitxer no és .docx ni .pdf
 *
 * @example
 *   const result = await importStructuredScriptFromFile(file);
 *   // result.content → TXT canònic (per a MONO / COLUMNES)
 *   // result.csvContent → CSV derivat (per a DADES)
 *   // result.fileName → 'nom_original.txt'
 */
export async function importStructuredScriptFromFile(
  file: File,
  options: ImportOptions = DEFAULT_IMPORT_OPTIONS
): Promise<ImportedStructuredScript> {
  const originalName = file.name;
  const lastDotIndex = originalName.lastIndexOf('.');
  const baseName =
    lastDotIndex !== -1 ? originalName.substring(0, lastDotIndex) : originalName;
  const ext = originalName.toLowerCase().split('.').pop() || '';

  let content: string;

  if (ext === 'docx') {
    content = await importDocxFile(file, options);
  } else if (ext === 'pdf') {
    content = await importPdfFile(file, options);
  } else {
    throw new Error(
      `Format no suportat per a guions estructurats: .${ext}. ` +
        `Usa DOCX o PDF. Els fitxers TXT s'han d'importar directament ` +
        `si ja estan en format SONILAB.`
    );
  }

  // Derivem el CSV a partir del contingut canònic (idèntic a LibraryView)
  const { takes } = parseScript(content);
  const csvContent = scriptToCsv(takes);

  return {
    fileName: `${baseName}.txt`,
    baseName,
    content,
    csvContent,
    sourceType: 'slsf',
  };
}
