# ParaSS1 — Núcleo del formato de guión SNLBPRO

> Paquete autocontenido extraído **en modo solo lectura** de **Sonilab Producció**.
> Reúne la lógica de **guardado, codificación, parseo, conversión, visualización y exportación** del
> formato de guión `snlbpro` para poder reutilizarla en una aplicación de **guiones de doblaje**.
>
> **Nada de la aplicación original ha sido modificado.** Todos los ficheros se copian tal cual existen
> en el repositorio fuente; este paquete es una *vista* del subsistema, no una refactorización.

> 👉 **¿Vas a integrar esto (humano o Claude Code)?** Empieza por **[`CLAUDE.md`](./CLAUDE.md)**:
> es la guía de entrada (orden de lectura, mapa "quiero X → lee Y", contratos, glue a recablear y
> protocolo de integración por capas). Este `README.md` es la referencia profunda a la que te llevará.

---

## 1. Qué es este paquete

Sonilab guarda los guiones en un formato de **texto plano estructurado** llamado internamente `snlbpro`
(la `sourceType` con la que se etiquetan los documentos de guión; el nombre de fichero visible suele ser
`.txt`). Ese formato es deliberadamente simple —texto plano + tabuladores— para que sea **legible por
humanos** y **importable desde DOCX/PDF** con heurísticas tolerantes a OCR.

ParaSS1 agrupa los módulos que componen ese subsistema:

- **Decodificación / codificación** del formato (`scriptParser`, `csvConverter`).
- **Timecodes** internos y **rangos de TAKE** (`timecodeHelpers`, `takeRanges`).
- **Importación** DOCX/PDF → snlbpro (`scriptImportPipeline`, `docxImporter`, `pdfImporter`, `importShared`).
- **Conversiones** con subtítulos (`srtParser`, `srtToSnlbpro`, `srtToSsrtlsf`).
- **Utilidades de guión** para búsqueda/indexado/takes (`ScriptUtils/*`, `segment*`).
- **Exportación** a PDF/TXT/XLSX/CSV (`exportUtils`).
- **Visores presentacionales** (`ColumnView`, `CsvView`, `Editor`, `SsrtlsfEditorView`, `Toolbar`).
- **Tipos y constantes de referencia** (`appTypes`, `constants`, `types/Subtitles`).
- **Documentación de dominio** del formato.

Lo que **no** entra: los *shells* de aplicación (editores de vídeo, ventanas externas, biblioteca,
router, contextos y `api`). Esos consumen el formato pero son glue específico de Sonilab — ver §6.

---

## 2. Gramática del formato `snlbpro` en disco

La fuente de verdad de la gramática es `scriptParser.ts` (decodificación) y `csvConverter.ts`
(codificación inversa). El fichero es una serie de **TAKES** separados por una línea de **10 o más
guiones**. Cada TAKE contiene:

1. **Línea TAKE** — empieza por `TAKE`, opcionalmente `#`, seguido de un número.
   Regex real: `^TAKE\s*#?\s*\d+` (insensible a mayúsculas). Variantes válidas: `TAKE #12`, `TAKE 12`, `take#12`.
2. **Línea de timecode absoluto (opcional)** — debe ser exactamente `HH:MM:SS`.
   Regex real: `^\d{2}:\d{2}:\d{2}$`. Si la línea siguiente al TAKE encaja, se toma como inicio del TAKE.
3. **Líneas de contenido**, una por intervención:
   - **Speaker + diálogo**: `*PERSONAJE*` + **TABULADOR** + texto. Ej: `*JOAN*\tHola, com estàs?`
   - **Varios speakers en la misma línea**: nombres encadenados entre asteriscos, luego TAB y texto compartido.
     Ej: `*JOAN**MARIA*\tParlen alhora.`
   - **Speaker solo** (sin texto): `*PERSONAJE*` — se agrupa con la línea de texto que le siga.
   - **Diálogo sin speaker**: empieza por TAB. Ej: `\tContinua la frase anterior.`
   - **Continuación**: una línea sin speaker y con texto se **fusiona** con el texto del speaker anterior
     (los espacios dobles se colapsan a uno).
4. **Timecode final (opcional)**: si la última línea del TAKE es un `HH:MM:SS` suelto, se guarda como
   `finalTimecode` del TAKE y no se renderiza como diálogo.

Todo lo que aparece **antes** del primer `TAKE` se conserva como `preamble` (excluyendo separadores).

### Timecodes internos dentro del diálogo

Dentro del texto pueden aparecer timecodes entre paréntesis, resueltos por `extractTakeInternalTimecodes()`:

- `(SS)` — **dos dígitos** obligatorios; se interpreta como segundos dentro del minuto del TAKE
  (con *wrap* al minuto siguiente si `SS` es bastante menor que el segundo de inicio).
- `(MM:SS)` — minutos:segundos; asume la misma hora que el TAKE (suma 1h si hace falta).
- `(HH:MM:SS)` — absoluto directo.
- Los paréntesis con letras (`(OFF)`, `(DL)`, …) se **ignoran**.

### Bloque de ejemplo real

```
GUIÓ DE DOBLATGE — EPISODI 3
(preàmbul lliure abans del primer TAKE)

TAKE #1
00:00:12
*JOAN*	Bon dia a tothom. (15) Avui comencem aviat.
	Aquesta línia continua el parlament d'en Joan.
*MARIA*	Hola Joan! (00:00:21)
------------------------------------------------------------------------------------
TAKE #2
00:00:30
*JOAN**MARIA*	Parlen alhora i diuen el mateix.
*NARRADOR*	(45) I així acaba l'escena.
00:00:58
```

En este ejemplo: el TAKE #1 arranca en `00:00:12`; `(15)` se resuelve a `00:00:15`, `(00:00:21)` es
absoluto; la línea con solo TAB es continuación de Joan; el TAKE #2 tiene dos speakers compartiendo
texto y un `finalTimecode` de `00:00:58`.

---

## 3. Mapeo CSV (representación intermedia)

`csvConverter.ts` traduce los TAKES parseados a una rejilla **CSV con separador `' | '`** (espacio,
barra, espacio). Es la representación que usa la vista de datos (`CsvView`) y varias exportaciones.

| Columna | Significado |
|---|---|
| `takeLabel` | Etiqueta del TAKE tal cual (`TAKE #1`) |
| `speaker` | Nombre del personaje **sin** asteriscos (vacío en filas especiales) |
| `text` | Diálogo, o el `HH:MM:SS` en la fila de timecode del TAKE |

Reglas de la rejilla:

- **Fila de timecode del TAKE**: `TAKE #N |  | HH:MM:SS` (speaker vacío, texto = timecode).
- **Fila de diálogo**: `TAKE #N | PERSONAJE | TEXTO`.
- **Varios speakers con texto compartido**: se emite **una fila por personaje** repitiendo el texto;
  al reconstruir (`csvToSnlbpro`), las filas consecutivas con el **mismo texto** se vuelven a unir en una
  sola línea `*A**B*\tTEXTO`.
- Una fila sin speaker pero con un `HH:MM:SS` en `text` se reinterpreta como timecode del TAKE al decodificar.

Ejemplo de la rejilla CSV correspondiente al bloque anterior (parcial):

```
TAKE #1 |  | 00:00:12
TAKE #1 | JOAN | Bon dia a tothom. (15) Avui comencem aviat. Aquesta línia continua el parlament d'en Joan.
TAKE #1 | MARIA | Hola Joan! (00:00:21)
TAKE #2 |  | 00:00:30
TAKE #2 | JOAN | Parlen alhora i diuen el mateix.
TAKE #2 | MARIA | Parlen alhora i diuen el mateix.
TAKE #2 | NARRADOR | (45) I així acaba l'escena.
```

Al reconstruir TXT, los TAKES se separan con una línea de **84 guiones** (ver `csvToSnlbpro`).

---

## 4. Ficheros incluidos por categoría

### format-core — núcleo de codificación/decodificación
| Fichero | Rol |
|---|---|
| `frontend/utils/EditorDeGuions/scriptParser.ts` | **Decodificador**: TXT snlbpro → `{ preamble, takes: TakeBlock[] }`. Define `ScriptLine`/`TakeBlock` |
| `frontend/utils/EditorDeGuions/csvConverter.ts` | **Puente** snlbpro ↔ CSV: `scriptToCsv()` y `csvToSnlbpro()` (separador `' | '`) |
| `frontend/utils/EditorDeGuions/timecodeHelpers.ts` | Resuelve timecodes internos `(SS)`/`(MM:SS)`/`(HH:MM:SS)` a segundos absolutos |
| `frontend/utils/EditorDeGuions/takeRanges.ts` | `buildTakeRangesFromScript()` → `TakeRange[]` (takeNum, start, end en segundos) |
| `frontend/utils/EditorDeGuions/translationPrompt.ts` | Reglas de prompt IA para traducción de doblaje (preserva TAKEs/speakers/timecodes). Lógica pura |

### import — DOCX/PDF → snlbpro
| Fichero | Rol |
|---|---|
| `frontend/utils/Import/scriptImportPipeline.ts` | **Punto de entrada** `importStructuredScriptFromFile()`; emite `ImportedStructuredScript` (content + csvContent + `sourceType:'snlbpro'`) |
| `frontend/utils/Import/docxImporter.ts` | Extrae texto de DOCX (global `mammoth` del CDN) y aplica heurística de TAB |
| `frontend/utils/Import/pdfImporter.ts` | Extrae texto de PDF (`pdfjs-dist` del importmap), detecta negrita/cursiva, quita números de página |
| `frontend/utils/Import/importShared.ts` | `ImportOptions` y `postProcessImportedText()`: normalización compartida |

### conversion — subtítulos ↔ guión
| Fichero | Rol |
|---|---|
| `frontend/utils/SubtitlesEditor/srtParser.ts` | Parseo SRT ↔ segundos (`parseSrt`, `secondsToSrtTime`) |
| `frontend/utils/SubtitlesEditor/srtToSnlbpro.ts` | SRT → snlbpro vía CSV (`convertSrtToSnlbpro`); parte por duración/líneas, speaker `P` por defecto |
| `frontend/utils/SubtitlesEditor/srtToSsrtlsf.ts` | SRT ↔ SSRTLSF (`parseSsrtlsf`, `serializeSsrtlsf`, `SsrtListRow`) |

### script-utils — búsqueda, indexado, vínculo segmento↔take
| Fichero | Rol |
|---|---|
| `frontend/utils/ScriptUtils/indexers.ts` | Indexa personajes y takes (anchor points). Lógica pura |
| `frontend/utils/ScriptUtils/search.ts` | `findMatches()` y tipo `Match` para resaltado/navegación. Lógica pura |
| `frontend/utils/ScriptUtils/takes.ts` | Localiza/extrae bloques TAKE con rango (depende de `./indexers`) |
| `frontend/utils/SubtitlesEditor/segmentTakeLinker.ts` | Asocia segmentos a `TakeRange[]` por solapamiento (Regla de Oro: `startTime` define el take primario) |
| `frontend/utils/SubtitlesEditor/segmentGuionDiff.ts` | Diff texto-segmento vs diálogo (bigramas); mapa take→diálogo desde snlbpro |

### export
| Fichero | Rol |
|---|---|
| `frontend/utils/EditorDeGuions/exportUtils.ts` | Exporta a **PDF** (impresión nativa vía iframe), **TXT**, **XLSX**, **CSV** (Nuendo CSV1 / Takes CSV2). Solo depende del tipo `Document` |

### viewer / editor — componentes presentacionales
| Fichero | Rol |
|---|---|
| `frontend/components/EditorDeGuions/ColumnView.tsx` | Visor en columnas (TAKE/TC + speaker/diálogo, anchors de salto de página, resaltado). Usa `EditorStyles`, `MAX_SPEAKER_CHARS_PER_LINE`, `Match` |
| `frontend/components/EditorDeGuions/CsvView.tsx` | Tabla editable CSV (TAKE \| SPEAKER \| TEXT) con columnas redimensionables. Autocontenido |
| `frontend/components/EditorDeGuions/Editor.tsx` | Editor `textarea` de texto snlbpro crudo (vista MONO) |
| `frontend/components/EditorDeGuions/Toolbar.tsx` | Barra con layout/idioma/undo-redo y menú de exportación. Llama a `exportUtils`; **requiere reconectar** `useLibrary` (ver §6) |
| `frontend/components/SsrtlsfEditor/SsrtlsfEditorView.tsx` | Editor tabular SSRTLSF (timecode \| personaje \| texto) con exportación a Excel (XLSX) |

### types / constants — referencia (no modificar)
| Fichero | Rol |
|---|---|
| `frontend/appTypes.ts` | Tipos núcleo: `Document`, `EditorStyles`, `Layout`, `TranslationTask`, `OpenMode`. Contrato que consumen los módulos |
| `frontend/constants.ts` | `MAX_SPEAKER_CHARS_PER_LINE` (30), `A4_WIDTH_PX`, `SUPPORTED_LANGUAGES`, `LOCAL_STORAGE_KEYS`, márgenes de take |
| `frontend/types/Subtitles.ts` | Tipo `Segment` (y `GeneralConfig`) requerido por `srtParser`, `srtToSsrtlsf`, `segmentTakeLinker`, `segmentGuionDiff` |

### doc — especificación de dominio
| Fichero | Rol |
|---|---|
| `.claude/docs/domains/snlbpro-format.md` | Especificación del formato, pipeline, detección por sourceType, compatibilidad legacy `slsf` |
| `.claude/docs/domains/script-pdf-export.md` | Arquitectura de exportación a PDF (iframe, anchors `[data-page-break-anchor]`, tipografía) |
| `.claude/docs/domains/subtitles.md` | Editor de subtítulos y SRT: modelo `Segment`, modos de editor |
| `.claude/docs/domains/source-types.md` | Clasificación de documentos por `sourceType` (snlbpro, srt, txt, pdf, media, legacy slsf) |

---

## 5. Flujo de datos: encode / decode / view / export / import

```
                          ┌──────────────────────────────┐
   DOCX / PDF  ──import──▶ │ scriptImportPipeline         │
                          │  · docxImporter / pdfImporter │
                          │  · importShared (normaliza)   │
                          └──────────────┬───────────────┘
                                         │ TXT canónico snlbpro
                                         ▼
   TXT snlbpro ──decode──▶  parseScript()  ─────▶  TakeBlock[]
   (en disco)                   ▲                     │
        ▲                       │                     │ scriptToCsv()
        │ csvToSnlbpro()        │                     ▼
        └───────────────  CSV (TAKE | SPEAKER | TEXT)  ───▶  CsvView (editable)
                                                       │
                       TakeBlock[] ─ buildTakeRangesFromScript ─▶ TakeRange[]
                                                       │            │
                                                       ▼            ▼
                                              ColumnView /     segmentTakeLinker
                                              Editor (view)    segmentGuionDiff
                                                       │
                                                       ▼
                          exportUtils ──▶  PDF · TXT · XLSX · CSV (Nuendo/Takes)
```

- **Decode**: `parseScript(content)` → `{ preamble, takes }`.
- **Encode**: `csvToSnlbpro(csv)` reconstruye el TXT a partir de la rejilla CSV.
- **Bridge**: `scriptToCsv(takes)` deriva la rejilla CSV desde los TAKES parseados (bidireccional).
- **View**: `ColumnView` (columnas), `CsvView` (rejilla editable), `Editor` (texto crudo MONO).
- **Timing**: `timecodeHelpers` + `takeRanges` calculan los rangos por TAKE para sync con audio/vídeo.
- **Import**: `scriptImportPipeline` unifica DOCX/PDF → TXT canónico + CSV derivado.
- **Export**: `exportUtils` produce PDF (impresión nativa), TXT, XLSX y CSV (Nuendo/Takes).
- **Subtítulos**: `srtParser`/`srtToSnlbpro`/`srtToSsrtlsf` puentean SRT ↔ snlbpro/SSRTLSF.

---

## 6. Glue externo y tipos que el integrador debe cablear

Estos ficheros **NO se copian** (son glue de la app) pero un integrador debe proveer un equivalente:

| Fichero | Por qué queda fuera |
|---|---|
| `frontend/utils/EditorDeGuions/translator.ts` | **Importado en `App.tsx` pero ausente en disco** (eliminado en el working tree). La capa de traducción IA debe re-implementarse usando `translationPrompt.ts` |
| `frontend/components/ScriptExternalView.tsx` | Ventana de visor externo atada a `useLibrary`, `api`, `UserStylesProvider`, `BroadcastChannel` |
| `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` | Editor híbrido guión+subtítulos atado a hooks, contextos, waveform y modales de IA |
| `frontend/components/VideoEditor/VideoEditorView.tsx` | Visor de vídeo con sync de guión atado a `useLibrary`, waveform y paneles |
| `frontend/components/VideoSubtitlesEditor/ScriptViewPanel.tsx` | Panel embebido dependiente de `api` y del shell del editor |
| `frontend/App.tsx` | Router raíz (hash routing, dispatch de `OpenMode`) específico de Sonilab |
| `frontend/hooks/useHashRoute.ts` | Parser de hash `#/editor/{mode}/{docId}` propio de la app |
| `frontend/components/Library/OpenWithModal.tsx` | Detección `isSnlbpro/slsf` y apertura desde la biblioteca |
| `frontend/components/Library/SonilabLibraryView.tsx` | UI de biblioteca que invoca el pipeline (patrón legacy) |
| `frontend/components/Library/LibraryFileItem.tsx` | Fila de biblioteca con etiqueta de formato |
| `frontend/components/Projects/CreateProjectModal.tsx` | Modal que llama a `importStructuredScriptFromFile` |
| `frontend/context/Library/SonilabLibraryContext.tsx` | Estado global (`useLibrary`) sobre backend NestJS |
| `frontend/context/Library/LibraryDataContext.tsx` | Gestión de estado de documentos |
| `frontend/context/UserStyles/UserStylesContext.tsx` | Estilos del usuario (CSS vars `--us-*`) que consume `ColumnView` |
| `frontend/services/api.ts` | Llamadas al backend (`getProjectGuion`, `setProjectGuion`, …) |
| `frontend/components/icons/index.ts` | Iconos compartidos importados por `Toolbar` y `SsrtlsfEditorView` |

### Dependencias externas de runtime (no son código de este repo)

- **`mammoth`** ~1.7.0 — declarado como global desde el CDN en `index.html` (lo usa `docxImporter`).
- **`pdfjs-dist`** ~4.4.168 — vía importmap en `index.html` (lo usa `pdfImporter`).
- **`XLSX`** (SheetJS) — global declarado en `exportUtils`/`SsrtlsfEditorView`.
- **`window.print()`** — motor de impresión del navegador para el export a PDF.
- **React** — para los componentes `viewer`/`editor`.

### Contratos de tipo que hay que satisfacer

- **`Document`** (de `appTypes.ts`): `exportUtils`, `Toolbar`, `CsvView`, `SsrtlsfEditorView` lo consumen.
  Para reutilizar fuera de Sonilab, el integrador puede recortar `Document` a un subtipo con al menos
  `name`, `content`, `csvContent`/`csvContentByLang` y `sourceType`.
- **`EditorStyles`** (de `appTypes.ts`): tipografía que aplica `ColumnView`.
- **`Segment`** (de `types/Subtitles.ts`): incluido en el paquete; lo usan los módulos de conversión.
- **`MAX_SPEAKER_CHARS_PER_LINE`** (de `constants.ts`): umbral de ajuste de speakers en `ColumnView`/`csvConverter`.
- Los componentes `Toolbar`, `SsrtlsfEditorView`, `ScriptExternalView` esperan **`useLibrary`** y/o
  **iconos**: hay que sustituirlos por las fuentes de datos del integrador.

---

## 7. Nota sobre integridad

Este paquete se ha ensamblado **sin modificar ningún fichero de la aplicación original**. Los ficheros
listados en §4 son copias exactas, byte a byte, de su estado en el repositorio de Sonilab. `appTypes.ts`
y `constants.ts` se incluyen **como referencia** del contrato (no como punto de edición). El glue de §6
queda fuera a propósito: documenta lo que un integrador debe re-conectar, no lo que debe copiar.
