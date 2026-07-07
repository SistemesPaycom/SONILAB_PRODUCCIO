# Hold per defecte 50 ms + zona morta anti-tremolor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fer que arrossegar un esdeveniment al visualitzador d'ona respongui de seguida (baixar el hold per defecte de 500 → 50 ms) i, alhora, protegir els usuaris sense pols fi afegint una **zona morta de moviment configurable** (default 6 px, 0 = desactivada) que evita desplaçaments accidentals en un clic. Un clic que no supera la zona morta selecciona + situa el cursor, independentment de la durada de la pulsació.

**Architecture:** El hold ja existeix (`WAVEFORM_HOLD_MS`, llegit per `getHoldMs()` dins `WaveformTimeline`, amb slider a `SettingsModal`). La zona morta segueix el **mateix patró**: clau localStorage nova (`WAVEFORM_DRAG_DEADZONE_PX`), llegida **directament** dins `WaveformTimeline` via `getDeadzonePx()` (sense passar props pels dos editors), amb slider a `SettingsModal` i entrada a `factoryReset`. La discriminació clic/drag passa de basar-se en el temps de pulsació a basar-se en si el punter ha superat la zona morta (`dragMovedRef`).

**Tech Stack:** React 19 + TypeScript 5.8, Vite, `useLocalStorage` hook, `useRef` per a l'estat de drag (sense re-render per moviment).

**Spec de referència:** `docs/superpowers/specs/2026-07-04-waveform-drag-hold-deadzone-design.md`

## Global Constraints

- **NO fer commits, branques ni push.** Deixar tot al working tree (regla del CLAUDE.md arrel; el commit s'oferirà al final si l'usuari el demana).
- Default hold: **50 ms**. Els **dos** punts han de coincidir: fallback de `getHoldMs()` i default de `SettingsModal`.
- Default zona morta: **6 px**. Clau: `'snlbpro_waveform_drag_deadzone_px'`. Rang UI 0–40. **0 = desactivada** (valor vàlid, no s'ha de "corregir" a un mínim).
- La zona morta **no activa** el drag; només suprimeix micro-moviments **després** d'armar per temps. L'armat segueix sent per temps (comportament intacte).
- No tocar `minDurationMs` / `minGapMs` / resize / overlap ni el backend.
- `MIN_SEG_DURATION_MS` no es toca.
- Build: `cd frontend && npm run build` → zero errors de TypeScript. No hi ha tests automàtics; verificació manual amb `npm run dev`.

---

### Task 1: Foundation — clau localStorage nova

**Files:**
- Modify: `frontend/constants.ts`

**Interfaces:**
- Produeix: `LOCAL_STORAGE_KEYS.WAVEFORM_DRAG_DEADZONE_PX` (`'snlbpro_waveform_drag_deadzone_px'`); consumida per les Tasks 2, 3 i 4.

- [ ] **Step 1: Afegir la clau a `frontend/constants.ts`**

  Trobar l'entrada `WAVEFORM_HOLD_MS` (línia ~20):
  ```typescript
  WAVEFORM_HOLD_MS: 'snlbpro_waveform_hold_ms',
  ```
  Afegir **immediatament a sota**:
  ```typescript
  /** Marge de moviment (px) a superar per iniciar l'arrossegament d'un esdeveniment (anti-tremolor). Default: 6. 0 = desactivat. */
  WAVEFORM_DRAG_DEADZONE_PX: 'snlbpro_waveform_drag_deadzone_px',
  ```

- [ ] **Step 2: TypeScript check**
  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | head -30
  ```
  Esperat: zero errors.

---

### Task 2: Factory Reset — incloure la clau nova

**Files:**
- Modify: `frontend/utils/factoryReset.ts`

**Interfaces:**
- Consumeix: `LOCAL_STORAGE_KEYS.WAVEFORM_DRAG_DEADZONE_PX` (Task 1).
- Produeix: `KEYS_TO_REMOVE` inclou la clau nova → Factory Reset la neteja.

- [ ] **Step 1: Afegir la clau a `KEYS_TO_REMOVE`**

  Trobar (línia ~39):
  ```typescript
  LOCAL_STORAGE_KEYS.WAVEFORM_HOLD_MS,
  ```
  Afegir **immediatament a sota**:
  ```typescript
  LOCAL_STORAGE_KEYS.WAVEFORM_HOLD_MS,
  LOCAL_STORAGE_KEYS.WAVEFORM_DRAG_DEADZONE_PX,
  ```

- [ ] **Step 2: TypeScript check**
  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | head -30
  ```
  Esperat: zero errors.

---

### Task 3: WaveformTimeline — hold 50 ms + zona morta + discriminació clic/drag

**Files:**
- Modify: `frontend/components/VideoEditor/WaveformTimeline.tsx`

**Interfaces:**
- Consumeix: `LOCAL_STORAGE_KEYS.WAVEFORM_DRAG_DEADZONE_PX` (Task 1). `LOCAL_STORAGE_KEYS` ja està importat.
- Produeix: comportament de drag àgil (50 ms) amb zona morta anti-tremolor; clic estàtic sempre selecciona/situa cursor.

- [ ] **Step 1: `getHoldMs()` — fallback 500 → 50**

  Trobar la funció (línies ~64–73) i substituir els **tres** valors `500` per `50`:
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

- [ ] **Step 2: Nova funció `getDeadzonePx()`**

  Just **a sota** de `getHoldMs()` (abans de `const EDGE_HIT_PX`), afegir:
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

- [ ] **Step 3: Nous refs**

  Al bloc de refs de drag, després de `const seekDragActiveRef = useRef(false);` (línia ~131), afegir:
  ```typescript
  const dragMovedRef = useRef(false);   // true un cop el punter supera la zona morta després d'armar
  const deadzonePxRef = useRef(0);      // zona morta (px) capturada al mousedown
  ```

- [ ] **Step 4: `handleMouseDown` — reset + captura de zona morta**

  Al bloc de reinicialitzacions (~línia 569), on hi ha `dragArmedRef.current = false;`, afegir a continuació:
  ```typescript
  dragArmedRef.current = false;
  dragMovedRef.current = false;
  deadzonePxRef.current = getDeadzonePx();
  ```

- [ ] **Step 5: `handleMouseMove` — gate de zona morta a la branca de drag**

  Trobar l'inici de la branca de drag de segment (~línia 610):
  ```typescript
  if (dragArmedRef.current && dragSegIdRef.current && dragTypeRef.current) {
    const curT = pixelToTime(e.clientX);
  ```
  Inserir el gate **abans** de `const curT`:
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
  ```
  (La resta de la branca —`move` / `resize-start` / `resize-end` + `onSegmentUpdate`— no canvia.)
  > **Reancoratge:** en creuar la zona morta es reancora `dragAnchorTimeRef` al punt actual perquè el drag comenci suau (sense un salt igual al llindar). Imperceptible a 6 px; important si l'usuari puja la zona morta cap a 40 px.

- [ ] **Step 6: `handleMouseUp` — discriminació per `dragMovedRef`**

  Trobar (~línies 705–725):
  ```typescript
  const wasArmed = dragArmedRef.current;
  const wasSeekDrag = seekDragActiveRef.current;

  // Finish segment drag
  if (wasArmed && dragSegIdRef.current) {
    onSegmentUpdateEnd?.();
  }

  // Short click → select segment + seek on mouseUp (only if no drag occurred)
  if (!wasArmed && !wasSeekDrag && e) {
    const elapsed = performance.now() - mouseDownTsRef.current;
    if (elapsed < getHoldMs()) {
      // If the short click was on a segment, select it now (triggers parent seek too)
      if (dragSegIdRef.current) {
        onSegmentClick?.(dragSegIdRef.current);
      } else {
        // Empty space: direct seek
        onSeek(pixelToTime(e.clientX));
      }
    }
  }
  ```
  Substituir per:
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

- [ ] **Step 7: `handleMouseUp` — reset de `dragMovedRef`**

  Al bloc de reset final (~línies 740–745, on hi ha `dragArmedRef.current = false;`), afegir:
  ```typescript
  dragArmedRef.current = false;
  dragMovedRef.current = false;
  ```

- [ ] **Step 8: `handleMouseLeave` — commit condicionat + reset**

  Trobar (~línia 755):
  ```typescript
  if (dragArmedRef.current && dragSegIdRef.current) {
    onSegmentUpdateEnd?.();
  }
  ```
  Canviar la condició a `dragMovedRef`:
  ```typescript
  if (dragMovedRef.current && dragSegIdRef.current) {
    onSegmentUpdateEnd?.();
  }
  ```
  I al bloc de reset d'aquesta funció (on hi ha `dragArmedRef.current = false;`), afegir `dragMovedRef.current = false;`.

  > `getHoldMs()` continua usant-se al `handleMouseDown` (temporitzador), així que no queda mort. `mouseDownTsRef` deixa de llegir-se; es pot conservar (inofensiu) per minimitzar el diff.

- [ ] **Step 9: TypeScript check**
  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | head -30
  ```
  Esperat: zero errors. Vigilar avisos de variables no usades si l'eslint és estricte (`wasArmed` ja no existeix; `elapsed` eliminat).

---

### Task 4: SettingsModal — hold default 50 + control de zona morta

**Files:**
- Modify: `frontend/components/SettingsModal.tsx`

**Interfaces:**
- Consumeix: `LOCAL_STORAGE_KEYS.WAVEFORM_DRAG_DEADZONE_PX` (Task 1).
- Produeix: default del hold coherent amb `getHoldMs()` (50) i nou slider de zona morta persistit.

- [ ] **Step 1: Hold default 500 → 50**

  Trobar (línia ~567):
  ```typescript
  const [waveformHoldMs, setWaveformHoldMs] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.WAVEFORM_HOLD_MS, 500);
  ```
  Canviar el `500` final per `50`, i afegir **a sota** l'estat de la zona morta:
  ```typescript
  const [waveformHoldMs, setWaveformHoldMs] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.WAVEFORM_HOLD_MS, 50);
  const [waveformDeadzonePx, setWaveformDeadzonePx] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.WAVEFORM_DRAG_DEADZONE_PX, 6);
  ```

- [ ] **Step 2: `onChange` del hold — fallback `|| 500` → `|| 50`**

  Trobar (línia ~977):
  ```typescript
  onChange={(e) => setWaveformHoldMs(Math.max(0, Math.min(2000, parseInt(e.target.value, 10) || 500)))}
  ```
  Canviar per:
  ```typescript
  onChange={(e) => setWaveformHoldMs(Math.max(0, Math.min(2000, parseInt(e.target.value, 10) || 50)))}
  ```

- [ ] **Step 3: Nou control de zona morta**

  Trobar el tancament del control "Temps de pressió per moure segment" (~línia 982): és el `</div>` que tanca el bloc `<div className="flex items-center justify-between pt-4 border-t ...">` d'aquell control. **Just després** d'aquest `</div>` (i abans del `</div>` que tanca el contenidor de la secció), inserir:
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
  > El fallback `|| 0` aquí és **correcte** (0 és vàlid i desitjat), a diferència del hold on `|| 50` evita col·lapsar a 0 per un parse buit.

- [ ] **Step 4: TypeScript check**
  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | head -30
  ```
  Esperat: zero errors.

---

### Task 5: Build complet + verificació manual

**Files:** cap — només verificació.

- [ ] **Step 1: Build complet**
  ```bash
  cd frontend && npm run build 2>&1 | tail -20
  ```
  Esperat: `✓ built in X.XXs`, zero errors de tipus.

- [ ] **Step 2: Dev server**
  ```bash
  cd frontend && npm run dev
  ```

- [ ] **Step 3: Verificar els controls de config**
  - Obrir Ajustos → secció de l'editor de subtítols.
  - "Temps de pressió per moure segment": ha de mostrar **50 ms** per defecte (si mai s'ha tocat la clau).
  - Nou "Marge anti-tremolor per arrossegar": ha de mostrar **6 px** per defecte. Moure'l a 0 i a 20; en recarregar, el valor persisteix.

- [ ] **Step 4: Verificar drag àgil (hold 50 ms)**
  - Obrir un SRT amb ona a l'editor. Prémer un esdeveniment i moure de seguida: ha de començar a arrossegar quasi immediatament (no cal esperar ~0,5 s).

- [ ] **Step 5: Verificar la zona morta (anti-tremolor)**
  - Amb zona morta = 20 px: prémer sobre un esdeveniment, mantenir >50 ms i moure **poc** (<20 px) → l'esdeveniment **no** s'ha de moure; en deixar anar, s'ha de **seleccionar + situar el cursor** (com un clic).
  - Moure clarament >20 px → arrossega amb normalitat.

- [ ] **Step 6: Verificar clic estàtic lent**
  - Prémer sobre un esdeveniment ~300 ms sense moure i deixar anar → ha de **seleccionar + situar el cursor** (no fer res estrany, no desplaçar-lo).

- [ ] **Step 7: Verificar zona morta = 0**
  - Posar zona morta a 0. Prémer i moure 1 px després d'armar → desplaça (gate desactivat). Comportament equivalent a l'anterior però amb hold 50 ms.

- [ ] **Step 8: Verificar resize amb zona morta**
  - Prémer una vora (resize-start / resize-end), mantenir i moure poc (<zona morta) → no redimensiona fins superar-la.

- [ ] **Step 9: Verificar els dos editors**
  - Repetir Steps 4–8 tant a `VideoSubtitlesEditorView` com a `VideoSrtStandaloneEditorView` (comparteixen `WaveformTimeline`, han de comportar-se igual).

- [ ] **Step 10: Verificar Factory Reset**
  - Posar hold a 300 ms i zona morta a 25 px. Factory Reset. En recarregar: hold torna a **50**, zona morta a **6**.
