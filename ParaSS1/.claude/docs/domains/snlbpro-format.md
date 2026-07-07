# Dominio: Formato de guion snlbpro

## Qué es este dominio

`snlbpro` es el formato interno de guion de Sonilab. Es un formato de texto propio, generado por conversión de CSV, PDF o DOCX. Los archivos tienen `sourceType: 'snlbpro'` en MongoDB. El nombre anterior del formato era `slsf` — los documentos legacy siguen existiendo con ese valor.

## Pipeline de importación

### Desde PDF o DOCX (flujo principal)

```
PDF / DOCX → scriptImportPipeline.ts → csvToSnlbpro() → documento con sourceType: 'snlbpro'
```

**Archivos:**
- `frontend/utils/Import/scriptImportPipeline.ts` — entry point del pipeline; devuelve `{ content, sourceType: 'snlbpro' }`
- `frontend/utils/EditorDeGuions/csvConverter.ts` — función `csvToSnlbpro(csvContent: string): string`
- `frontend/components/Library/LibraryView.tsx` — llama a la pipeline y crea el documento con `sourceType = 'snlbpro'`

### Desde SRT (conversión puntual)

```
SRT content → convertSrtToSnlbpro() → string snlbpro
```

**Archivos:**
- `frontend/utils/SubtitlesEditor/srtToSnlbpro.ts` — función `convertSrtToSnlbpro(srtContent: string): string`; usa internamente `csvToSnlbpro`

### Alias disponibles

```ts
// csvConverter.ts
export const csvToScriptTxt = csvToSnlbpro;       // alias descriptivo

// srtToSnlbpro.ts
export const convertSrtToScriptTxt = convertSrtToSnlbpro;  // alias descriptivo
```

## Detección al abrir un documento

En `frontend/components/Library/OpenWithModal.tsx`:

```ts
const isSnlbpro =
  doc.sourceType?.toLowerCase() === 'snlbpro'
  || doc.sourceType?.toLowerCase() === 'slsf'    // legacy MongoDB
  || doc.name.toLowerCase().endsWith('.slsf');    // legacy nombre de archivo
```

Si `isSnlbpro` es true, se ofrece el editor de guion (`openMode: 'editor-ssrtlsf'`).

## Exportación y descarga

En `frontend/utils/EditorDeGuions/exportUtils.ts`:
```ts
if (doc.name.endsWith('.snlbpro')) return doc.name.slice(0, -8);  // quita extensión
if (doc.name.endsWith('.slsf')) return doc.name.slice(0, -5);     // legacy
```

En `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx`:
```ts
// Regex para limpiar extensión en descarga
const cleanName = doc.name.replace(/\.(snlbpro|slsf)$/, '');
```

## Editor que lo consume

`openMode: 'editor-ssrtlsf'` → renderiza `SsrtlsfEditorView` desde `App.tsx`.

La conversión de CSV a formato snlbpro también se usa en `App.tsx` para mostrar el guion en el editor:
```ts
import { csvToSnlbpro } from './utils/EditorDeGuions/csvConverter';
```

## Qué hacer si se modifica este formato

1. Modificar la función `csvToSnlbpro` en `csvConverter.ts`.
2. Verificar que `convertSrtToSnlbpro` en `srtToSnlbpro.ts` sigue produciendo output compatible.
3. Verificar que `scriptImportPipeline.ts` sigue devolviendo `sourceType: 'snlbpro'`.
4. Verificar que `OpenWithModal.tsx` sigue detectando el tipo correctamente (incluyendo legacy).
5. Verificar que `exportUtils.ts` y `VideoSubtitlesEditorView.tsx` siguen limpiando la extensión correctamente.
6. Si cambia el `sourceType` string: ver también `domain-source-types.md`.

## Compatibilidad legacy

No eliminar las comprobaciones de `slsf` hasta confirmar que no existen documentos legacy en producción. Los documentos `slsf` en MongoDB son válidos y deben seguir abriéndose correctamente.
