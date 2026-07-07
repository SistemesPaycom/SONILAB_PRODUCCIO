# Disseny: Hold per defecte 50 ms + zona morta anti-tremolor a l'arrossegament d'esdeveniments

**Data:** 2026-07-04
**Component afectat:** `WaveformTimeline` (visualitzador d'ona compartit pels dos editors de subtítols)
**Valors per defecte nous:** hold **50 ms** (abans 500), zona morta **6 px** (nova)

---

## 1. Problema i motivació

En el visualitzador d'ona, arrossegar un esdeveniment (bloc de subtítol) requereix **mantenir premut** el botó del ratolí un temps mínim abans que el drag s'"armi". Aquest temps és configurable (`WAVEFORM_HOLD_MS`, slider "Temps de pressió per moure segment") i el seu **default actual és 500 ms**.

Els usuaris de proves han reportat que el programa **triga massa a respondre** en començar a arrossegar un esdeveniment: mig segon de pulsació abans de poder moure res es percep com a *lag* molest. La decisió és **baixar el default a 50 ms** perquè el drag sigui àgil de sèrie.

**Risc conegut d'aquesta baixada:** el temps de hold compleix alhora **dues** funcions:
1. Retard abans de poder arrossegar (com més baix, més àgil) ← el que volem millorar.
2. **Finestra de protecció** contra la tremolor: mentre s'espera el temporitzador, el moviment s'ignora del tot; un cop armat el drag, **qualsevol** micro-moviment ja desplaça l'esdeveniment.

Per tant, 50 ms fa el drag àgil però **escurça la protecció**: un clic deliberat sobre un esdeveniment que duri >50 ms (molt habitual) tindrà el drag armat, i una tremolor de la mà el desplaçarà sense voler. Els usuaris sense pols fi (o amb l'edat) són especialment vulnerables.

**Mitigació escollida — zona morta de moviment:** un cop armat el drag, l'esdeveniment **no es mou** fins que el punter s'allunya més d'un llindar configurable (px) del punt de `mousedown`. La tremolor per sota d'aquest marge s'ignora. A més, si es deixa anar sense superar mai la zona morta, es tracta com a **clic** (selecciona + situa el cursor), encara que la pulsació hagi durat >50 ms.

> **Distinció clau vs. un "llindar de moviment" clàssic:** aquí el moviment **NO activa** el drag (això seria perillós: una tremolor durant un clic ràpid arrossegaria l'esdeveniment). Aquí el moviment només **suprimeix** els desplaçaments minúsculs després d'armar per temps. És la funció inversa i va a favor de l'usuari sense pols fi.

---

## 2. Àmbit i enfocament

### Inclòs (Fase 1 — aquesta spec)
- Baixar el default de `WAVEFORM_HOLD_MS` de **500 → 50 ms** (als dos punts que han de coincidir).
- Afegir clau localStorage `WAVEFORM_DRAG_DEADZONE_PX` (default **6**, rang 0–40, **0 = desactivat**).
- Implementar la zona morta a `WaveformTimeline` (armat per temps intacte + gate de moviment post-armat).
- Redefinir la discriminació clic/drag: **clic = pulsació que no ha superat mai la zona morta** (independentment de la durada).
- Exposar el control de zona morta a `SettingsModal`, just sota el de "Temps de pressió per moure segment".
- Afegir la nova clau a `factoryReset.ts` (`KEYS_TO_REMOVE`).

### Exclòs
- **Fase 2 (Ctrl+clic estil Nuendo)** — documentada a §6, es dissenyarà i implementarà en una spec pròpia posterior. No forma part d'aquesta implementació.
- Cap canvi a `minDurationMs`, `minGapMs` ni a la lògica de resize/overlap existent.
- Cap canvi al backend.

---

## 3. Model d'interacció resultant

`WaveformTimeline` fa servir refs per gestionar el drag (no re-render per moviment). El flux queda així:

**`mousedown` sobre un esdeveniment:**
- S'inicia el temporitzador de hold (`getHoldMs()`, default 50 ms).
- Es captura la zona morta del moment (`getDeadzonePx()`) en un ref.
- Es reinicia `dragMovedRef = false`.

**Mentre s'espera el temporitzador (`holdTimerRef !== null`):** el moviment s'ignora (comportament actual, sense canvis).

**En disparar-se el temporitzador (pulsació > hold):** s'arma el drag (`dragArmedRef = true`, tipus `move`/`resize-start`/`resize-end`), però **encara no es mou res**.

**`mousemove` amb drag armat:**
- Si `dragMovedRef` és `false`: es calcula `|Δx|` des del `mousedown`. Si `|Δx| <= zonaMorta` → **return** (no es mou). Si la supera → `dragMovedRef = true` (comença el drag real).
- Si `dragMovedRef` és `true`: es desplaça/redimensiona l'esdeveniment com fins ara.

**`mouseup`:**
- Si `dragMovedRef` és `true` → `onSegmentUpdateEnd()` (commit del moviment real).
- Si `dragMovedRef` és `false` i no hi ha hagut scrub → **clic simple** → `onSeek(pixelToTime(clientX))`: mou el cursor de transport al **punt exacte clicat**, tant sobre un esdeveniment com a espai buit. **Mai selecciona.**

> **Actualització posterior (defecte reportat en proves):** originalment el clic simple sobre un esdeveniment cridava `onSegmentClick` (selecciona), i com que el pare fa `onSeek(startTime-0.05)`, el cursor saltava a l'INICI de l'esdeveniment en comptes d'anar on s'havia clicat. Corregit: **clic simple = seek al punt clicat (mai selecciona); la selecció és amb DOBLE CLIC** (estil Subtitle Edit), via `handleDoubleClick` → `onSegmentClick(id)`. El doble clic respecta el mode seek pur de la Fase 2 (amb Ctrl/Cmd no selecciona).

**Taula de casos (esdeveniment sota el punter):**

| Gest | Hold armat? | Supera zona morta? | Resultat |
|------|:-:|:-:|----------|
| Clic ràpid (<50 ms) | No | — | Seek al punt clicat (no selecciona) |
| Clic lent quiet (>50 ms, sense moure) | Sí | No | Seek al punt clicat (no selecciona) |
| Clic lent amb tremolor petita (<zona morta) | Sí | No | Seek al punt clicat, sense desplaçar l'esdeveniment |
| **Doble clic** sobre esdeveniment | — | — | **Selecciona** l'esdeveniment (`onSegmentClick`) |
| Drag intencionat (prem i mou decididament) | Sí | Sí | Arrossega / redimensiona |

Amb zona morta = 0, el gate es desactiva: qualsevol moviment ≥1 px després d'armar desplaça (comportament equivalent a l'actual, però amb hold 50 ms).

---

## 4. Canvis per fitxer

### 4.1 `frontend/constants.ts`

**Afegir** una nova clau a `LOCAL_STORAGE_KEYS`, just sota `WAVEFORM_HOLD_MS` (línia 20):

```typescript
/** Marge de moviment (px) a superar per iniciar l'arrossegament d'un esdeveniment (anti-tremolor). Default: 6. 0 = desactivat. */
WAVEFORM_DRAG_DEADZONE_PX: 'snlbpro_waveform_drag_deadzone_px',
```

---

### 4.2 `frontend/components/VideoEditor/WaveformTimeline.tsx`

**A) `getHoldMs()` — canviar el fallback 500 → 50** (línies 64–73). Els tres punts de retorn per defecte (`raw == null`, `!Number.isFinite`, `catch`) passen de `500` a `50`:

```typescript
/** Read hold-ms from localStorage; clamp 0–2000, fallback 50 */
function getHoldMs(): number {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.WAVEFORM_HOLD_MS);
    if (raw == null) return 50;
    const parsed = JSON.parse(raw);
    const n = typeof parsed === 'number' ? parsed : Number(parsed);
    if (!Number.isFinite(n)) return 50;
    return Math.max(0, Math.min(2000, n));
  } catch { return 50; }
}
```

**B) Nova funció `getDeadzonePx()`** (just sota `getHoldMs`), mateix patró:

```typescript
/** Read drag dead-zone px from localStorage; clamp 0–40, fallback 6 */
function getDeadzonePx(): number {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.WAVEFORM_DRAG_DEADZONE_PX);
    if (raw == null) return 6;
    const parsed = JSON.parse(raw);
    const n = typeof parsed === 'number' ? parsed : Number(parsed);
    if (!Number.isFinite(n)) return 6;
    return Math.max(0, Math.min(40, n));
  } catch { return 6; }
}
```

**C) Nous refs** (al bloc de refs de drag, després de `seekDragActiveRef`, ~línia 131):

```typescript
const dragMovedRef = useRef(false);   // true un cop el punter supera la zona morta després d'armar
const deadzonePxRef = useRef(0);      // zona morta (px) capturada al mousedown
```

**D) `handleMouseDown`** — al bloc de reinicialitzacions (~línia 569, al costat de `dragArmedRef.current = false;`), afegir:

```typescript
dragMovedRef.current = false;
deadzonePxRef.current = getDeadzonePx();
```

**E) `handleMouseMove`, branca de drag de segment** (~línia 610). Afegir el gate de zona morta a l'inici de la branca, **abans** de calcular `curT`:

```typescript
if (dragArmedRef.current && dragSegIdRef.current && dragTypeRef.current) {
  // Zona morta: després d'armar, ignora moviments minúsculs (tremolor) fins que
  // el punter supera el llindar configurat. Evita desplaçar un esdeveniment en un clic.
  if (!dragMovedRef.current) {
    const dxAbs = Math.abs(e.clientX - mouseDownClientRef.current.x);
    if (dxAbs <= deadzonePxRef.current) return;        // dins la zona morta → no moure
    dragMovedRef.current = true;                        // superada → comença el drag real
    dragAnchorTimeRef.current = pixelToTime(e.clientX); // reancora al punt de creuament (evita el salt = zona morta)
  }
  const curT = pixelToTime(e.clientX);
  // ... (resta de la branca sense canvis: move / resize-start / resize-end + onSegmentUpdate)
}
```

> **Reancoratge (evita el "salt"):** `dragAnchorTimeRef` es fixa al `mousedown`. Sense reancorar, el primer moviment després de creuar la zona morta desplaçaria l'esdeveniment de cop pel valor sencer del llindar (fins a 40 px). En reancorar al punt de creuament, el `delta` inicial és 0 i el drag comença suau des d'allà (l'offset residual cursor↔contingut és ≤ zona morta, imperceptible). Val per a `move`, `resize-start` i `resize-end`.

**F) `handleMouseUp`** (~línia 702). Substituir la discriminació basada en `wasArmed`+`elapsed` per `dragMovedRef`:

```typescript
const wasDragged = dragMovedRef.current;          // el punter ha superat la zona morta → drag real
const wasSeekDrag = seekDragActiveRef.current;

// Commit del drag només si l'esdeveniment s'ha mogut de veritat
if (wasDragged && dragSegIdRef.current) {
  onSegmentUpdateEnd?.();
}

// Clic (cap drag real, cap scrub) → selecciona + situa cursor, independentment de la durada
if (!wasDragged && !wasSeekDrag && e) {
  if (dragSegIdRef.current) {
    onSegmentClick?.(dragSegIdRef.current);
  } else {
    onSeek(pixelToTime(e.clientX));
  }
}
```

- S'elimina l'ús de `performance.now() - mouseDownTsRef.current` i la comparació `elapsed < getHoldMs()` d'aquest bloc (ja no cal: la durada deixa de decidir el clic).
- Al bloc de reset final (~línies 740–745) afegir `dragMovedRef.current = false;`.
- `getHoldMs()` continua usant-se a `handleMouseDown` (temporitzador), així que la funció segueix viva.

**G) `handleMouseLeave`** (~línia 753). Canviar la condició de commit i afegir el reset:

```typescript
if (dragMovedRef.current && dragSegIdRef.current) {   // abans: dragArmedRef.current
  onSegmentUpdateEnd?.();
}
// ... i afegir al bloc de reset:
dragMovedRef.current = false;
```

> **Nota `mouseDownTsRef`:** deixa de llegir-se; es pot conservar (inofensiu) o eliminar la seva escriptura al `mousedown`. Recomanació: conservar-lo per minimitzar el diff (no molesta).

---

### 4.3 `frontend/components/SettingsModal.tsx`

**A) Canviar el default del hold** (línia 567): `500` → `50`.

```typescript
const [waveformHoldMs, setWaveformHoldMs] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.WAVEFORM_HOLD_MS, 50);
```

**B) Afegir estat per a la zona morta** (a continuació):

```typescript
const [waveformDeadzonePx, setWaveformDeadzonePx] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.WAVEFORM_DRAG_DEADZONE_PX, 6);
```

**C) `onChange` del hold** (línia 977): el fallback `|| 500` passa a `|| 50` (coherència amb el nou default):

```typescript
onChange={(e) => setWaveformHoldMs(Math.max(0, Math.min(2000, parseInt(e.target.value, 10) || 50)))}
```

**D) Nou control UI** — inserir un nou bloc just **després** del control "Temps de pressió per moure segment" (després del seu `</div>` de tancament de fila, ~línia 982), mateixa estructura JSX:

```tsx
<div className="flex items-center justify-between pt-4 border-t border-[var(--th-border)]/30">
    <div>
        <p className="font-bold text-gray-200">Marge anti-tremolor per arrossegar</p>
        <p className="text-xs text-gray-500 italic">Un cop iniciat el drag, ignora moviments per sota d'aquest marge (px) per no arrossegar un esdeveniment sense voler. 0 = desactivat.</p>
    </div>
    <div className="flex items-center gap-4">
        <input
            type="range"
            min="0" max="40" step="1"
            value={waveformDeadzonePx}
            onChange={(e) => setWaveformDeadzonePx(Math.max(0, Math.min(40, parseInt(e.target.value, 10) || 0)))}
            className="w-32 cursor-pointer" style={{ accentColor: 'var(--th-accent)' }}
        />
        <span className="text-xs font-mono font-bold w-16 text-right" style={{ color: 'var(--th-accent-text)' }}>{waveformDeadzonePx} px</span>
    </div>
</div>
```

> Nota: el fallback `|| 0` a l'`onChange` és correcte aquí (a diferència del hold), perquè 0 és un valor vàlid i desitjat (zona morta desactivada).

---

### 4.4 `frontend/utils/factoryReset.ts`

Afegir a `KEYS_TO_REMOVE`, just sota `WAVEFORM_HOLD_MS` (línia 39):

```typescript
LOCAL_STORAGE_KEYS.WAVEFORM_HOLD_MS,
LOCAL_STORAGE_KEYS.WAVEFORM_DRAG_DEADZONE_PX,   // NOU
```

---

## 5. Casos límit

| Cas | Comportament esperat |
|-----|----------------------|
| Usuari ja té `WAVEFORM_HOLD_MS = 500` desat (va tocar el slider) | Manté 500; el nou default no l'afecta (`useLocalStorage` no reescriu si la clau existeix) |
| Usuari **mai** ha tocat el slider | Passa a fer servir 50 ms (nou fallback de `getHoldMs`) i el slider mostra 50 (nou default) — coherents |
| Zona morta = 0 | Gate desactivat: qualsevol moviment ≥1 px després d'armar desplaça (com abans, però amb hold 50) |
| Clic lent quiet sobre esdeveniment (>50 ms, sense moure) | **Selecciona + situa cursor** (millora respecte a l'actual, que no feia res) |
| Press llarg quiet a **espai buit** (>50 ms) | Ara fa `onSeek` en deixar anar (abans no, per la guarda `elapsed`). Canvi menor i coherent amb "clic a l'ona = situa cursor" |
| Resize-start / resize-end | També passen per la zona morta (no es redimensiona fins superar-la) |
| Shift durant el drag (overlap) | Sense canvis; independent de la zona morta |
| Factory Reset | S'esborren `WAVEFORM_HOLD_MS` i `WAVEFORM_DRAG_DEADZONE_PX`; tornen a 50 / 6 |
| Sincronització dos punts del hold | `getHoldMs()` fallback i default de `SettingsModal` **han de coincidir** (tots dos = 50) |

---

## 6. Fase 2 — Ctrl+clic estil Nuendo (a estudiar després, fora d'abast d'aquesta implementació)

**Concepte:** un modificador de teclat que garanteix un *seek pur* — mou la barra de transport (playhead) al codi de temps clicat i **mai** arrossega un esdeveniment, encara que es cliqui a sobre. Inspirat en Nuendo i en l'ús de modificadors (Ctrl/Alt/Shift) a programes 3D com Blender.

**Notes de disseny preliminars (per validar a la spec pròpia):**
- **Ctrl està lliure** al drag actual: només s'usa amb la roda per fer zoom (`handleWheel`). Shift ja s'usa per permetre overlap. Per tant Ctrl+clic no xoca amb res.
- Comportament: si `e.ctrlKey` al `mousedown` sobre l'ona → no iniciar temporitzador de hold ni armar drag; fer `onSeek(pixelToTime(e.clientX))` (probablement al `mouseup`, coherent amb la resta).
- **Activable des de config, activat per defecte** (p.ex. clau `WAVEFORM_CTRL_CLICK_SEEK`, default `true`). Amb l'opció desactivada, Ctrl+clic no té comportament especial.
- Punts a decidir a la Fase 2: interacció amb el zoom Ctrl+roda (el zoom és amb roda, el seek amb clic — no col·lideixen), feedback de cursor, i si Alt/Shift han de tenir rols addicionals.

---

## 7. Fitxers modificats (resum Fase 1)

| Fitxer | Tipus de canvi |
|--------|----------------|
| `frontend/constants.ts` | +1 clau localStorage (`WAVEFORM_DRAG_DEADZONE_PX`) |
| `frontend/components/VideoEditor/WaveformTimeline.tsx` | hold default 500→50, +`getDeadzonePx()`, +2 refs, gate de zona morta, discriminació clic/drag per `dragMovedRef` |
| `frontend/components/SettingsModal.tsx` | hold default 500→50 (+`||50`), +1 estat, +1 control UI (slider px) |
| `frontend/utils/factoryReset.ts` | +1 entrada a `KEYS_TO_REMOVE` |

**Total: 4 fitxers, ~40–50 línies noves/modificades.**

---

## 8. No cal canviar

- `VideoSubtitlesEditorView.tsx` / `VideoSrtStandaloneEditorView.tsx` — la zona morta i el hold es llegeixen **directament** de localStorage dins `WaveformTimeline` (mateix patró que `getHoldMs()`); no cal passar props nous.
- Lògica de `minDurationMs` / `minGapMs` / resize / overlap — intacta.
- Backend — no afectat.
