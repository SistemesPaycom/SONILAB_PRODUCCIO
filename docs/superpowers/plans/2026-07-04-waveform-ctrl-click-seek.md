# Ctrl/Cmd + clic = seek pur (estil Nuendo) — Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development o executing-plans. Passos amb `- [ ]`.

**Goal:** Amb Ctrl (o Cmd) premut sobre l'ona i el toggle actiu, clicar/arrossegar mou només el cursor de transport i **mai** un esdeveniment (estil Nuendo). Toggle a configuració, default ON.

**Architecture:** Mateix patró de lectura directa de localStorage dins `WaveformTimeline` (com `getHoldMs`/`getDeadzonePx`). El mecanisme desvia cap al camí de seek/scrub ja existent saltant el hit-test de segments quan `seekOnly`.

**Spec:** `docs/superpowers/specs/2026-07-04-waveform-ctrl-click-seek-design.md`

## Global Constraints
- **NO commits.** Working tree.
- Clau: `'snlbpro_waveform_ctrl_click_seek'`, default **true**.
- Modificador: `e.ctrlKey || e.metaKey`. No tocar el guard `button !== 0` (exclou el Ctrl+clic=botó-dret de Mac).
- No tocar la lògica de hold/zona morta ni el camí de seek (només desviar-hi).
- Build: `cd frontend && npm run build` → 0 errors TS.

---

### Task 1: Clau localStorage
- Modify: `frontend/constants.ts`
- [ ] Sota `WAVEFORM_DRAG_DEADZONE_PX`, afegir:
  ```typescript
  /** Ctrl/Cmd + clic a l'ona mou només el cursor de transport (mai un esdeveniment). Preferència d'usuari. Default: true. */
  WAVEFORM_CTRL_CLICK_SEEK: 'snlbpro_waveform_ctrl_click_seek',
  ```
- [ ] `npx tsc --noEmit` → 0 errors.

### Task 2: Factory Reset
- Modify: `frontend/utils/factoryReset.ts`
- [ ] Sota `LOCAL_STORAGE_KEYS.WAVEFORM_DRAG_DEADZONE_PX,` afegir `LOCAL_STORAGE_KEYS.WAVEFORM_CTRL_CLICK_SEEK,`.

### Task 3: WaveformTimeline
- Modify: `frontend/components/VideoEditor/WaveformTimeline.tsx`
- [ ] **A)** Sota `getDeadzonePx()`, afegir `getCtrlClickSeek()` (retorna boolean, default true; `JSON.parse(raw) !== false`).
- [ ] **B)** A `handleMouseDown`, substituir `const hit = hitTestSegment(e.clientX);` per:
  ```typescript
  const seekOnly = (e.ctrlKey || e.metaKey) && getCtrlClickSeek();
  const hit = seekOnly ? null : hitTestSegment(e.clientX);
  ```
- [ ] **C)** A `handleMouseMove`, branca 4 (hover, `!mouseDownActiveRef.current`), substituir el càlcul de `hit`/cursor per la versió amb `seekOnly` (curtcircuit: `getCtrlClickSeek()` només si hi ha modificador):
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
- [ ] `npx tsc --noEmit` → 0 errors.

### Task 4: SettingsModal
- Modify: `frontend/components/SettingsModal.tsx`
- [ ] **A)** Sota `waveformDeadzonePx`, afegir estat `waveformCtrlSeek` (`useLocalStorage<boolean>(..., true)`).
- [ ] **B)** Després del control "Marge anti-tremolor" (~línia 999), abans del `</div>` que tanca la secció, afegir el botó-pastilla toggle (veure spec §4.3 B).
- [ ] `npx tsc --noEmit` → 0 errors.

### Task 5: Build + verificació
- [ ] `cd frontend && npm run build` → `✓ built`.
- [ ] Verificació runtime (harness aïllat, com Fase 1): amb Ctrl premut → clic sobre segment = `seek(t)`, cap `update`/`click`; Ctrl+drag = `seek` repetit (scrub), cap `update`. Sense Ctrl → drag normal. Toggle OFF (localStorage `false`) → Ctrl ignorat, drag normal.
