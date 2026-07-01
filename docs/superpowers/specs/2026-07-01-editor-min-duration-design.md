# Disseny: Durada mínima configurable per bloc de subtítol

**Data:** 2026-07-01  
**Equivalència:** Paràmetre "Minimum duration (ms)" de Subtitle Edit  
**Valor per defecte:** 1000 ms  

---

## 1. Problema i motivació

L'editor de subtítols de Sonilab aplica un **pis absolut de 100 ms** (`MIN_SEG_DURATION_MS`) a la durada de cada bloc. Aquest valor és un resguard intern compartit amb el pipeline de transcripció del backend i **no és configurable per l'usuari**.

Subtitle Edit ofereix un camp "Minimum duration (ms)" als ajustos de l'editor que impedeix reduir qualsevol bloc per sota del llindar triat. L'usuari demana el mateix comportament.

---

## 2. Àmbit i enfocament

### Inclòs
- Afegir clau localStorage `EDITOR_MIN_DURATION_MS` (default 1000 ms).
- Afegir `minDurationMs` a `GeneralConfig` i propagar-lo a tots els punts d'aplicació.
- Exposar el control a `SettingsModal` (secció "Editor de Subtítols"), seguint exactament el patró de `editorMinGapMs`.
- Fer complir el llindar a tots els 6 punts d'aplicació actuals:
  - `VideoSubtitlesEditorView` (3 punts: `handleSetTcIn`, `handleSetTcOut`, `handleSegmentChange`)
  - `VideoSrtStandaloneEditorView` (1 punt: `handleSegmentChange`, on a més hi ha un bug amb `0.1` hardcoded)
  - `WaveformTimeline` (2 punts: `resize-start`, `resize-end`)
- Afegir la nova clau a `factoryReset.ts` (KEYS_TO_REMOVE).

### Exclòs
- Cap canvi al pipeline de transcripció del backend (`transcription.processor.ts`) ni a `MIN_SEG_DURATION_MS`.
- No aplicar el nou llindar a subtítols que *ja existeixin* en obrir un SRT (no retroactiu).
- No mostrar indicador visual de blocs que ja estiguin per sota del llindar.

---

## 3. Regla d'aplicació

En tots els punts d'aplicació:

```
minDurSec = Math.max(MIN_SEG_DURATION_MS, generalConfig.minDurationMs ?? 1000) / 1000
```

- Si l'usuari estableix 0 ms, el pis absolut de 100 ms continua actuant.
- Si l'usuari estableix 1000 ms (default), el pis efectiu és 1 s.
- No hi ha màxim UI (màx. pràctic: 5000 ms al control).

---

## 4. Canvis per fitxer

### 4.1 `frontend/constants.ts`

**Afegir** una nova clau a `LOCAL_STORAGE_KEYS` just a sota de `EDITOR_MIN_GAP_MS`:

```typescript
/** Durada mínima d'un bloc de subtítol a l'editor (ms). Preferència d'usuari. Default: 1000. */
EDITOR_MIN_DURATION_MS: 'snlbpro_editor_min_duration_ms',
```

Cap canvi a `MIN_SEG_DURATION_MS` (és un pis intern, no user-facing).

---

### 4.2 `frontend/types/Subtitles.ts`

Afegir `minDurationMs` a `GeneralConfig`:

```typescript
export interface GeneralConfig {
  maxCharsPerLine: number;
  maxLinesPerSubtitle: number;
  /** Marge mínim entre subtítols consecutius (ms). Default: 160 */
  minGapMs?: number;
  /** Durada mínima de cada bloc (ms). Default: 1000. Equivalent a Subtitle Edit "Minimum duration". */
  minDurationMs?: number;
}
```

---

### 4.3 `frontend/components/SettingsModal.tsx`

**A) Afegir lectura localStorage** (al bloc d'inicialitzacions d'estat, al costat de `editorMinGapMs`):

```typescript
const [editorMinDurationMs, setEditorMinDurationMs] = useLocalStorage<number>(
  LOCAL_STORAGE_KEYS.EDITOR_MIN_DURATION_MS, 1000
);
```

**B) Afegir control UI** a la secció "Editor de Subtítols", just sota el control de "Marge mínim entre subtítols" (línia ~950). Seguint el mateixa estructura JSX:

```tsx
<div className="flex items-center justify-between pt-4 border-t border-[var(--th-border)]/30">
  <div>
    <p className="font-bold text-gray-200">Durada mínima de subtítol</p>
    <p className="text-xs text-gray-500 italic">
      Impedeix reduir un bloc per sota d'aquest llindar (ms). Equivalent a "Minimum duration" de Subtitle Edit.
    </p>
  </div>
  <div className="flex items-center gap-2">
    <input
      type="number"
      min="0" max="5000" step="50"
      value={editorMinDurationMs}
      onChange={(e) => setEditorMinDurationMs(Math.max(0, parseInt(e.target.value, 10) || 0))}
      className="w-20 rounded-lg px-3 py-2 text-white font-mono text-center outline-none"
      style={{ backgroundColor: 'var(--th-bg-tertiary)', border: '1px solid var(--th-border)', '--tw-ring-color': 'var(--th-accent)' } as any}
    />
    <span className="text-xs font-mono" style={{ color: 'var(--th-editor-meta)' }}>ms</span>
  </div>
</div>
```

---

### 4.4 `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx`

**A) Afegir lectura localStorage** (al costat de la lectura de `editorMinGapMs`, línia ~237):

```typescript
const [editorMinDurationMs, setEditorMinDurationMs] = useLocalStorage<number>(
  LOCAL_STORAGE_KEYS.EDITOR_MIN_DURATION_MS, 1000
);
```

**B) Afegir `minDurationMs` a `generalConfig`** (línia ~239):

```typescript
const generalConfig = useMemo<GeneralConfig>(() => ({
  maxCharsPerLine: 40,
  maxLinesPerSubtitle: maxLinesSubs,
  minGapMs: editorMinGapMs,
  minDurationMs: editorMinDurationMs,  // NOU
}), [maxLinesSubs, editorMinGapMs, editorMinDurationMs]);
```

**C) Derivar `minDurSec` local** (just sota la definició de `MIN_SEG_DURATION` al top del component inner, línia ~53 és module-level, cal fer-ho dins del component):

Com que `MIN_SEG_DURATION` és una constant de mòdul i `generalConfig.minDurationMs` depèn de l'estat, la derivació ha d'anar als punts d'aplicació:

```typescript
// En cada punt d'aplicació, substituir MIN_SEG_DURATION per:
const minDurSec = Math.max(MIN_SEG_DURATION_MS, generalConfig.minDurationMs ?? 1000) / 1000;
```

**D) Punts d'aplicació** (3 funcions):

**`handleSetTcIn` (~línies 824–841):**
- Canviar `if (startTime >= seg.endTime - MIN_SEG_DURATION)` → `if (startTime >= seg.endTime - minDurSec)`
- Afegir `minDurSec` al bloc del callback (i a les deps de `useCallback`)

**`handleSetTcOut` (~línies 844–856):**
- Canviar `if (endTime - seg.startTime < MIN_SEG_DURATION)` → `if (endTime - seg.startTime < minDurSec)`
- Afegir `minDurSec` al bloc del callback (i a les deps de `useCallback`)

**`handleSegmentChange` (~línies 891–905):**
- Canviar `if (endTime - startTime < MIN_SEG_DURATION)` → `if (endTime - startTime < minDurSec)`
- `minDurSec` es calcula dins del callback amb `generalConfig.minDurationMs`
- Les deps actuals són `[isEditing, subsHistory, generalConfig.minGapMs]` → afegir `generalConfig.minDurationMs` a la llista de deps

**E) Pas de `minDurationMs` al `WaveformTimeline`** (línia ~1110, on es passa `minGapMs`):
```tsx
<WaveformTimeline
  ...
  minGapMs={generalConfig.minGapMs}
  minDurationMs={generalConfig.minDurationMs}   // NOU
  ...
/>
```

---

### 4.5 `frontend/components/VideoSubtitlesEditor/VideoSrtStandaloneEditorView.tsx`

**Mateixa operació que 4.4**, però per la vista standalone:

**A) Llegir localStorage:**
```typescript
const [editorMinDurationMs, setEditorMinDurationMs] = useLocalStorage<number>(
  LOCAL_STORAGE_KEYS.EDITOR_MIN_DURATION_MS, 1000
);
```

**B) Afegir a `generalConfig`:**
```typescript
const generalConfig = useMemo<GeneralConfig>(() => ({
  maxCharsPerLine: 40,
  maxLinesPerSubtitle: maxLinesSubs,
  minGapMs: editorMinGapMs,
  minDurationMs: editorMinDurationMs,   // NOU
}), [maxLinesSubs, editorMinGapMs, editorMinDurationMs]);
```

**C) Corregir bug existent i aplicar nova restricció a `handleSegmentChange` (~línia 347):**

Línia actual (BUG - hardcoded 0.1s sense usar la constant):
```typescript
if (endTime - startTime < 0.1) endTime = startTime + 0.1;
```

Canviar per:
```typescript
const minDurSec = Math.max(MIN_SEG_DURATION_MS, generalConfig.minDurationMs ?? 1000) / 1000;
if (endTime - startTime < minDurSec) endTime = startTime + minDurSec;
```

I importar `MIN_SEG_DURATION_MS` des de `../../constants` si encara no és importat (verificar imports existents — ja importa `LOCAL_STORAGE_KEYS` i `isAudioOnly`).

**D) Pas al `WaveformTimeline`** (~línia 524):
```tsx
<WaveformTimeline
  ...
  minGapMs={generalConfig.minGapMs}
  minDurationMs={generalConfig.minDurationMs}   // NOU
  ...
/>
```

---

### 4.6 `frontend/components/VideoEditor/WaveformTimeline.tsx`

**A) Afegir prop a la interfície** (~línia 51):
```typescript
/** Durada mínima d'un subtítol (ms). Default: 1000 */
minDurationMs?: number;
```

**B) Destructurar i establir default** (~línia 105):
```typescript
minGapMs = 160,
minDurationMs = 1000,  // NOU
```

**C) Derivar constant local** (just sota `MIN_SEG_DURATION` ~línia 73 però dins del component, o com a variable reactiva):

Com que els props s'avaluen en render i les refs de drag necessiten el valor al moment del move, la manera més neta és calcular-ho com a variable `const` local dins del component body que el closure del drag captura correctament a través d'un `ref`:

```typescript
// Dins el component WaveformTimeline, al cos principal (no dins d'un useEffect):
const minDurSecRef = useRef(Math.max(MIN_SEG_DURATION_MS, minDurationMs) / 1000);
useEffect(() => {
  minDurSecRef.current = Math.max(MIN_SEG_DURATION_MS, minDurationMs) / 1000;
}, [minDurationMs]);
```

Alternativament (més senzill ja que el drag consulta refs i el valor canvia rarament): simplement recalcular dins `handleMouseMove`:

```typescript
const minDurSec = Math.max(MIN_SEG_DURATION_MS, minDurationMs) / 1000;
// (calculat una vegada al top de handleMouseMove, no en hot path de canvas draw)
```

**Recomanació**: Usar un `ref` per evitar que `handleMouseMove` (funció estable via `useCallback`) calgui recrear-se cada cop que `minDurationMs` canvia. Patró:

```typescript
const minDurMsRef = useRef(minDurationMs);
useEffect(() => { minDurMsRef.current = minDurationMs; }, [minDurationMs]);
```

I als punts de drag:
```typescript
const minDurSec = Math.max(MIN_SEG_DURATION_MS, minDurMsRef.current) / 1000;
```

**D) Substituir usos de `MIN_SEG_DURATION`** als punts de drag (~línies 642, 649):

```typescript
// Línia 642 (resize-start):
if (ne - ns < minDurSec) ns = ne - minDurSec;

// Línia 649 (resize-end):
if (ne - ns < minDurSec) ne = ns + minDurSec;
```

Nota: la constant de mòdul `MIN_SEG_DURATION` deixa de ser usada en el drag; es pot deixar o eliminar. Deixar-la és inofensiu.

---

### 4.7 `frontend/utils/factoryReset.ts`

Afegir a `KEYS_TO_REMOVE` (~línia 44):

```typescript
LOCAL_STORAGE_KEYS.EDITOR_MIN_GAP_MS,
LOCAL_STORAGE_KEYS.EDITOR_MIN_DURATION_MS,   // NOU (just a continuació)
```

---

## 5. Flux complet del canvi

```
Usuari canvia "Durada mínima" a SettingsModal
  → localStorage['snlbpro_editor_min_duration_ms'] = X
  → editorMinDurationMs (useLocalStorage) reactualitza
  → generalConfig.minDurationMs = X
  → propagat a tots els punts d'aplicació:

  1. handleSetTcIn / handleSetTcOut (Q/W shortcuts):
     - Calcula minDurSec localment
     - Clamps startTime/endTime

  2. handleSegmentChange (edició manual de timecode via TimecodeInput):
     - updateDraft: clamps endTime si endTime - startTime < minDurSec

  3. WaveformTimeline drag resize-start / resize-end:
     - minDurSecRef.current = Math.max(MIN_SEG_DURATION_MS, minDurationMs) / 1000
     - Clamps ns/ne durant el drag
```

---

## 6. Casos límit

| Cas | Comportament esperat |
|-----|---------------------|
| Usuari posa `minDurationMs = 0` | Efectiu = 100 ms (pis absolut `MIN_SEG_DURATION_MS`) |
| SRT existent amb blocs <1000 ms | No es modifiquen en carregar (enforcement only on user action) |
| Import/transcripció | No afectat (MIN_SEG_DURATION_MS backend = 100 ms, no canvia) |
| Split d'un bloc curt | Si el resultat té < minDurSec, el sistema ja clamps per handleSegmentChange |
| Factory Reset | La clau s'esborra, torna al default 1000 ms en el proper accés |
| VideoSrtStandaloneEditorView bug `0.1` | Corregit com a part del canvi (fixat a usar la mateixa fórmula) |

---

## 7. Fitxers modificats (resum)

| Fitxer | Tipus de canvi |
|--------|---------------|
| `frontend/constants.ts` | +1 clau localStorage |
| `frontend/types/Subtitles.ts` | +1 camp a GeneralConfig |
| `frontend/components/SettingsModal.tsx` | +1 estat, +1 control UI |
| `frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx` | +1 estat, +generalConfig, +3 enforcement, +1 prop WaveformTimeline |
| `frontend/components/VideoSubtitlesEditor/VideoSrtStandaloneEditorView.tsx` | +1 estat, +generalConfig, +1 enforcement (+bugfix), +1 prop WaveformTimeline |
| `frontend/components/VideoEditor/WaveformTimeline.tsx` | +1 prop interfície, +ref, +2 enforcement |
| `frontend/utils/factoryReset.ts` | +1 entrada a KEYS_TO_REMOVE |

**Total: 7 fitxers, ~35-40 línies noves/modificades.**

---

## 8. No cal canviar

- `SubtitlesEditor.tsx` — no fa enforcement, és un contenidor passiu.
- `SegmentItem.tsx` — no fa enforcement de durada, delega a `onChange`.
- `TimecodeInput.tsx` — no fa validació semàntica, delega `onCommit`.
- Backend — `MIN_SEG_DURATION_MS = 100` al backend és independent i queda intacte.
