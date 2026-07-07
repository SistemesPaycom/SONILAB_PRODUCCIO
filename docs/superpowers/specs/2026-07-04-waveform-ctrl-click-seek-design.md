# Disseny: Ctrl/Cmd + clic = seek pur (estil Nuendo) al visualitzador d'ona

**Data:** 2026-07-04
**Component afectat:** `WaveformTimeline` (compartit pels dos editors)
**Fase:** 2 (continuació de `2026-07-04-waveform-drag-hold-deadzone-design.md`)
**Valor per defecte:** activat (ON)

---

## 1. Problema i motivació

A l'editor, l'usuari vol una manera **garantida** de moure el cursor de transport a un punt exacte de l'ona **sense cap risc** de moure o redimensionar un esdeveniment, encara que cliqui just a sobre d'un bloc. És el patró de Nuendo (i de modificadors a programes 3D com Blender): un modificador de teclat que canvia el rol del ratolí.

Actualment, clicar sobre un esdeveniment pot acabar sent un drag (si es manté i es mou). Amb aquest modificador, l'usuari se n'assegura: **només seek, mai moure res**.

---

## 2. Decisions (validades amb l'usuari)

- **Modificador:** `Ctrl` **o** `Cmd` (`e.ctrlKey || e.metaKey`), igual que el zoom amb roda actual del component.
- **Ctrl+arrossegar:** fa **scrub** del cursor (segueix el ratolí contínuament), reaprofitant el camí de seek d'espai buit. Mai toca un esdeveniment.
- **Toggle a configuració:** clau `WAVEFORM_CTRL_CLICK_SEEK` (booleà), **default `true`**. Amb OFF, el modificador s'ignora (comportament normal de clic/drag).

### Nota Mac (important)
A macOS, **Ctrl+clic = clic secundari** (botó dret → `contextmenu`, `e.button === 2`). El guard existent `if (e.button !== 0) return;` de `handleMouseDown` ja exclou aquest cas de manera natural. Per això a Mac el modificador útil és **Cmd** (`metaKey`, botó 0), i a Windows **Ctrl** (`ctrlKey`, botó 0). Usar `ctrlKey || metaKey` cobreix tots dos sense codi específic de plataforma.

---

## 3. Mecanisme (mínim, reaprofita codi provat)

**Model mental:** amb el modificador premut (i el toggle actiu), l'ona es tracta com a **espai buit** → sempre seek/scrub, mai segments.

A `handleMouseDown`, es calcula un booleà `seekOnly` i **es salta el hit-test de segments** quan és cert:

```typescript
const seekOnly = (e.ctrlKey || e.metaKey) && getCtrlClickSeek();
const hit = seekOnly ? null : hitTestSegment(e.clientX);
if (hit) { /* ...grab + hold timer (igual que ara)... */ }
```

Amb `hit = null`, `dragSegIdRef` queda `null`, i:
- **Clic sol:** a `handleMouseUp`, `!wasDragged && !wasSeekDrag && dragSegId==null` → `onSeek(pixelToTime(e.clientX))` → cursor al temps clicat.
- **Arrossegar:** a `handleMouseMove`, la branca 3 (scrub d'espai buit: `mouseDownActiveRef && !dragSegIdRef`, `dx>3`) → `throttledSeek` → scrub. A `handleMouseUp`, `wasSeekDrag` fa flush del seek pendent.

No cal codi nou de moviment; només **desviar** cap al camí existent.

**Sense conflictes:** `handleWheel` usa `ctrlKey||metaKey` però és event de **roda** (zoom), independent del `mousedown`. `Shift` (overlap durant drag) no s'usa aquí.

---

## 4. Canvis per fitxer

### 4.1 `frontend/constants.ts`
Afegir a `LOCAL_STORAGE_KEYS`, sota `WAVEFORM_DRAG_DEADZONE_PX`:
```typescript
/** Ctrl/Cmd + clic a l'ona mou només el cursor de transport (mai un esdeveniment). Preferència d'usuari. Default: true. */
WAVEFORM_CTRL_CLICK_SEEK: 'snlbpro_waveform_ctrl_click_seek',
```

### 4.2 `frontend/components/VideoEditor/WaveformTimeline.tsx`

**A)** Nova funció lectora (sota `getDeadzonePx`):
```typescript
/** Read Ctrl/Cmd-click-seek preference from localStorage; default true */
function getCtrlClickSeek(): boolean {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.WAVEFORM_CTRL_CLICK_SEEK);
    if (raw == null) return true;
    return JSON.parse(raw) !== false;
  } catch { return true; }
}
```

**B)** `handleMouseDown` — substituir `const hit = hitTestSegment(e.clientX);` per:
```typescript
const seekOnly = (e.ctrlKey || e.metaKey) && getCtrlClickSeek();
const hit = seekOnly ? null : hitTestSegment(e.clientX);
```
(La resta del bloc `if (hit) {...}` no canvia.)

**C)** `handleMouseMove` — branca 4 (hover cursor, `!mouseDownActiveRef.current`): quan el modificador està premut i el toggle actiu, no mostrar `grab`/`col-resize` (mostrar cursor per defecte), per senyalar el mode seek. Amb curtcircuit, `getCtrlClickSeek()` només es llegeix quan hi ha modificador premut (rar), evitant lectures de localStorage a cada mousemove:
```typescript
if (!mouseDownActiveRef.current) {
  const sc = scrollRef.current;
  if (sc) {
    const seekOnly = (e.ctrlKey || e.metaKey) && getCtrlClickSeek();
    const hit = seekOnly ? null : hitTestSegment(e.clientX);
    sc.style.cursor = hit ? (hit.zone === 'body' ? 'grab' : 'col-resize') : '';
  }
}
```

### 4.3 `frontend/components/SettingsModal.tsx`
**A)** Estat (sota `waveformDeadzonePx`):
```typescript
const [waveformCtrlSeek, setWaveformCtrlSeek] = useLocalStorage<boolean>(LOCAL_STORAGE_KEYS.WAVEFORM_CTRL_CLICK_SEEK, true);
```
**B)** Nou control (botó-pastilla Activat/Desactivat), després del control de "Marge anti-tremolor" (~línia 999), abans del `</div>` que tanca la secció:
```tsx
<div className="flex items-center justify-between pt-4 border-t border-[var(--th-border)]/30">
    <div>
        <p className="font-bold text-gray-200">Ctrl/Cmd + clic mou només el cursor</p>
        <p className="text-xs text-gray-500 italic">Amb Ctrl (o Cmd a Mac) premut, clicar o arrossegar sobre l'ona mou el cursor de transport i mai un esdeveniment. Estil Nuendo.</p>
    </div>
    <button
        type="button"
        onClick={() => setWaveformCtrlSeek((v) => !v)}
        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0"
        style={{
            backgroundColor: waveformCtrlSeek ? 'var(--th-accent)' : 'var(--th-bg-tertiary)',
            color: waveformCtrlSeek ? '#fff' : 'var(--th-editor-meta)',
            border: '1px solid var(--th-border)',
        }}
    >
        {waveformCtrlSeek ? 'Activat' : 'Desactivat'}
    </button>
</div>
```

### 4.4 `frontend/utils/factoryReset.ts`
Afegir a `KEYS_TO_REMOVE`, sota `WAVEFORM_DRAG_DEADZONE_PX`:
```typescript
LOCAL_STORAGE_KEYS.WAVEFORM_CTRL_CLICK_SEEK,
```

---

## 5. Casos límit

| Cas | Comportament |
|-----|--------------|
| Ctrl+clic sobre un esdeveniment (toggle ON) | Seek al temps clicat; l'esdeveniment **no** es mou ni se selecciona |
| Ctrl+arrossegar sobre esdeveniments (ON) | Scrub del cursor; cap esdeveniment tocat |
| Toggle OFF | Ctrl/Cmd s'ignora; clic/drag normal (pot agafar segment) |
| Mac Ctrl+clic | És botó dret (`button 2`) → `handleMouseDown` retorna abans; a Mac s'usa Cmd |
| Ctrl premut només a mig gest | El mode es decideix al `mousedown` (com Nuendo); prémer Ctrl després no canvia el gest en curs |
| Ctrl+roda | Segueix fent zoom (event de roda, no afectat) |
| Factory Reset | La clau s'esborra → torna a `true` |
| Modificador + clic amb toggle ON però sense moure | Seek net al punt (via camí de clic buit) |

---

## 6. Fitxers modificats (resum)

| Fitxer | Canvi |
|--------|-------|
| `frontend/constants.ts` | +1 clau (`WAVEFORM_CTRL_CLICK_SEEK`) |
| `frontend/components/VideoEditor/WaveformTimeline.tsx` | +`getCtrlClickSeek()`, `seekOnly` a mousedown, cursor de hover |
| `frontend/components/SettingsModal.tsx` | +1 estat, +1 toggle UI |
| `frontend/utils/factoryReset.ts` | +1 entrada a `KEYS_TO_REMOVE` |

**Total: 4 fitxers, ~25–30 línies.**

---

## 7. No cal canviar
- El camí de seek/scrub existent (es reaprofita tal qual).
- La lògica de hold/zona morta de la Fase 1 (independent; només s'evita el grab quan `seekOnly`).
- Els dos editors (llegeix directament de localStorage dins `WaveformTimeline`).
- Backend.
