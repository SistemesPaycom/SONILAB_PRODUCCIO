# CLAUDE.md — Punto de entrada para integrar el formato de guion SNLBPRO

> **Si eres Claude Code y te han pedido "integrar la manera de interpretar y codificar
> los guiones" (de Sonilab) en este proyecto, ESTE es tu punto de partida.**
> Lee este archivo entero, luego `README.md`, y solo entonces empieza a leer el código.
> No toques ni muevas nada hasta tener el mapa completo en la cabeza.

Este es un paquete **autocontenido y de solo lectura**, copiado **byte a byte** del subsistema
del formato `snlbpro` de **Sonilab Producció**: cómo se guardan los guiones en texto plano
estructurado (TAKES, timecodes, intervenciones) y cómo se parsean, convierten a CSV, visualizan
y exportan. **Nada aquí fue modificado** respecto al original; es una *vista* del subsistema, no
una refactorización.

---

## 1. Orden de lectura (hazlo exactamente en este orden)

1. **Este `CLAUDE.md`** — el mapa, los contratos y el protocolo de integración.
2. **`README.md`** — referencia profunda: la **gramática real del formato con un ejemplo
   concreto**, el mapeo CSV, la tabla de todos los ficheros con su rol, el diagrama de flujo
   encode/decode/view/export/import y el detalle del glue.
3. **`_MANIFEST.json`** — lista legible por máquina (30 ficheros incluidos + 16 entradas de
   glue) con el rol de cada uno. Útil para localizar archivos por categoría.
4. **Docs de dominio** en `.claude/docs/domains/`:
   - `snlbpro-format.md` — especificación del formato y su pipeline (legacy `slsf` incluido).
   - `source-types.md` — clasificación de documentos por `sourceType`.
   - `script-pdf-export.md` — arquitectura de exportación a PDF.
   - `subtitles.md` — modelo `Segment` y formato SRT.
5. **El código**, por capas (ver §4).

---

## 2. Mapa rápido: "quiero X → empieza por Y"

| Necesito entender / integrar… | Fichero de entrada |
|---|---|
| Cómo se **DECODIFICA** el texto del guion → estructura de TAKES | `frontend/utils/EditorDeGuions/scriptParser.ts` (`parseScript`) |
| Cómo se pasa **a/desde CSV** (la vista de datos tipo hoja de cálculo) | `frontend/utils/EditorDeGuions/csvConverter.ts` (`scriptToCsv`, `csvToSnlbpro`) |
| Timecodes internos en el texto: `(57)`, `(01:23)`, `(00:01:53)` | `frontend/utils/EditorDeGuions/timecodeHelpers.ts` |
| Rangos temporales de cada TAKE (sync con audio/vídeo) | `frontend/utils/EditorDeGuions/takeRanges.ts` |
| Importar **DOCX/PDF** a guion | `frontend/utils/Import/scriptImportPipeline.ts` |
| Convertir **SRT ↔ guion** | `frontend/utils/SubtitlesEditor/srtToSnlbpro.ts`, `srtToSsrtlsf.ts` |
| Buscar/indexar **personajes y takes** (lectura de doblaje) | `frontend/utils/ScriptUtils/indexers.ts`, `search.ts`, `takes.ts` |
| **Exportar** (PDF / TXT / XLSX / CSV) | `frontend/utils/EditorDeGuions/exportUtils.ts` |
| **Mostrar** el guion (columnas / datos / texto crudo) | `frontend/components/EditorDeGuions/ColumnView.tsx`, `CsvView.tsx`, `Editor.tsx` |
| Generar el prompt de **traducción IA** preservando TAKEs/speakers/TC | `frontend/utils/EditorDeGuions/translationPrompt.ts` |

---

## 3. Invariantes del formato que NO debes romper

La fuente de verdad es `scriptParser.ts` (decode) + `csvConverter.ts` (encode). El detalle con
ejemplo está en `README.md` §2/§3. Resumen de reglas que deben mantenerse coherentes:

- **TAKE**: línea que casa `^TAKE\s*#?\s*\d+` (insensible a mayúsculas). Ej.: `TAKE #12`, `TAKE 12`.
- **Timecode absoluto del TAKE**: línea exactamente `^\d{2}:\d{2}:\d{2}$`, justo debajo del TAKE.
- **Intervención**: `*PERSONAJE*` + **TABULADOR** + diálogo. Varios personajes que comparten
  frase: `*A**B*\tTEXTO`. Speaker suelto sin texto: se agrupa con la línea de texto siguiente.
- **Continuación**: línea sin speaker y con texto → se fusiona con el diálogo anterior.
- **Timecodes internos**: `(SS)` (exactamente 2 dígitos), `(MM:SS)`, `(HH:MM:SS)`. Paréntesis
  con letras (`(OFF)`, `(DL)`…) se ignoran.
- **Separador entre TAKES**: línea de **10+ guiones** (al reconstruir se emiten 84).
- **CSV**: separador **exacto** `' | '` (espacio-barra-espacio) → columnas `TAKE | SPEAKER | TEXT`.

> Si decides cambiar cualquiera de estas reglas, hazlo deliberadamente y propágalo **a la vez**
> a parser + serializer + visores; si no, el round-trip texto↔CSV deja de ser fiel.

---

## 4. Capas y orden recomendado de integración (de pura a UI)

Integra y verifica cada capa antes de pasar a la siguiente.

1. **Núcleo puro** (sin React, sin app, portable tal cual): `scriptParser`, `csvConverter`,
   `timecodeHelpers`, `takeRanges`, `ScriptUtils/{indexers,search,takes}`, `translationPrompt`.
   **Empieza aquí.** Es lógica pura y es lo que de verdad reutilizas para doblaje.
2. **Conversiones**: `SubtitlesEditor/{srtParser,srtToSnlbpro,srtToSsrtlsf,segmentTakeLinker,
   segmentGuionDiff}`. Requieren el tipo `Segment` (`frontend/types/Subtitles.ts`, incluido).
3. **Importación**: `Import/{scriptImportPipeline,docxImporter,pdfImporter,importShared}`.
   Dependen de libs externas en runtime: **`mammoth`** (DOCX) y **`pdfjs-dist`** (PDF). Ver README §6.
4. **Exportación**: `exportUtils`. Depende de **`XLSX`** (SheetJS) global y de `window.print()`.
5. **UI (React)**: `components/EditorDeGuions/*` y `components/SsrtlsfEditor/*`. Aquí está el
   **único glue de app** que hay que recablear (ver §5).

---

## 5. Contratos a satisfacer y glue a recablear

### Contratos de tipo (incluidos como REFERENCIA en este paquete)
- **`Document`** (`frontend/appTypes.ts`): lo consumen `exportUtils`, `Toolbar`, `CsvView`,
  `SsrtlsfEditorView`. Subtipo mínimo viable: `name`, `content`, `csvContent`/`csvContentByLang`,
  `sourceType`.
- **`EditorStyles`** (`appTypes.ts`): tipografía que aplica `ColumnView`.
- **`Segment`** (`frontend/types/Subtitles.ts`, incluido): lo usan los módulos de conversión.
- **`MAX_SPEAKER_CHARS_PER_LINE`** (`frontend/constants.ts`, incluido): umbral de ajuste de speakers.

### Glue de app que NO está aquí — provee un equivalente
- **`useLibrary`** (`context/Library/SonilabLibraryContext`): fuente de `Document`. Lo usan
  `Toolbar` y otros. Sustitúyelo por tu propia fuente de datos.
- **`../icons`**: iconos compartidos importados por `Toolbar` y `SsrtlsfEditorView`. Provee los
  tuyos o adapta esos imports.
- **`translator.ts`**: estaba importado en el `App.tsx` original pero **ya no existe** en el árbol
  fuente; **re-impleméntalo** a partir de `translationPrompt.ts` (incluido).
- Router (`useHashRoute`), biblioteca, modales y backend `api`: ver la tabla completa en README §6.

---

## 6. Estructura de carpetas (preservada a propósito)

Las rutas relativas originales (`frontend/...`, `.claude/docs/...`) se conservan **deliberadamente**
para que los imports relativos entre los ficheros copiados (`../../constants`,
`../EditorDeGuions/scriptParser`, etc.) **resuelvan dentro del paquete** sin tocarlos. Si reubicas
ficheros a otra estructura, recuerda actualizar esos imports en consecuencia.

---

## 7. Regla de integridad

Este paquete se ensambló **sin modificar ningún fichero de la aplicación original**. Los `.ts`/`.tsx`
y los `.md` de dominio son copias exactas (verificadas por hash SHA-256). `appTypes.ts` y
`constants.ts` se incluyen **como referencia del contrato**, no como punto de edición. El glue de §5
queda fuera a propósito: documenta lo que hay que re-conectar, no lo que hay que copiar.
