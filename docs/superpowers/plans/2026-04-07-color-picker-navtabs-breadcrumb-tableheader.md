# Color picker per a navTabs/breadcrumb/tableHeader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Habilitar el color picker per als 3 elements del scope `home` (navTabs, breadcrumb, tableHeader) que ara l'amaguen, sense reintroduir el parpadeig de la commit `ef60b36`.

**Architecture:** Eliminar les classes Tailwind hardcodejades de color (`text-white`/`text-gray-200`/`text-gray-400`/`text-gray-500`) dels 3 elements al `SonilabLibraryView.tsx` i fer que els inline `style={{ color: 'var(--us-home-X-color)' }}` (que ja existeixen al pipeline de CSS vars `applyUserStylesToDOM.ts`) prevalguin per especificitat estàndard. Eliminar la prop `hideColor` del `StyleAtomEditor` i els overrides hardcodejats del `HomeStylePreview`. **No tocar** `UserStylesContext.tsx`, `applyUserStylesToDOM.ts`, `factoryStyles.ts`, `userStylesMigration.ts`, `ThemeContext.tsx` ni `LibraryFileItem.tsx`.

**Tech Stack:** React 19 + TypeScript 5.8, Tailwind CSS via CDN, CSS custom properties (`--us-*`, `--th-*`), Playwright MCP per a verificació, Vite 6.

**Spec de referència:** [docs/superpowers/specs/2026-04-07-color-picker-navtabs-breadcrumb-tableheader-design.md](../specs/2026-04-07-color-picker-navtabs-breadcrumb-tableheader-design.md)

**Branch:** `feat/user-styles`

---

## Notes prèvies importants per a l'implementer

### Anti-patrons absolutament prohibits

Aquests patrons van causar el bug del parpadeig que es va arreglar a la commit `ef60b36`. **NO** els facis servir per cap motiu — encara que pensis que cal `!important`:

- ❌ `useImportantStyleRef` (callback refs personalitzades)
- ❌ Callback refs (`ref={node => { ... }}`) per aplicar estils
- ❌ `element.style.setProperty(prop, value, 'important')`
- ❌ `MutationObserver` per a CSS
- ❌ `useEffect` que apliqui estils al DOM directament
- ❌ Afegir `!important` a regles CSS noves al `ThemeContext.tsx` o a qualsevol `<style>` block
- ❌ Tocar `frontend/context/UserStyles/UserStylesContext.tsx` (estabilització amb `meRef` ja feta i validada)
- ❌ Tocar `frontend/context/UserStyles/applyUserStylesToDOM.ts` (emissor únic de CSS vars)
- ❌ Tocar `frontend/context/UserStyles/factoryStyles.ts` (factory ja correcta)
- ❌ Tocar `frontend/components/Library/LibraryFileItem.tsx` (ja revertit a inline `style`)

### Per què funciona sense `!important`

Verificat al `frontend/context/Theme/ThemeContext.tsx` línies 180-187:

```css
/* ── TEXT: white/light → dark (NO !important — inline styles win) ── */
[data-theme="light"] .text-white     { color: #18181b; }
[data-theme="light"] .text-gray-200  { color: #27272a; }
[data-theme="light"] .text-gray-400  { color: #52525b; }
[data-theme="light"] .text-gray-500  { color: #6b7280; }
```

Aquestes regles **NO** porten `!important`. Un inline `style={{ color: 'var(--us-home-X-color)' }}` les guanya per especificitat CSS estàndard (inline > selectors). Cap acrobacia tècnica necessària.

### Estructura del codi

- **Únic lloc on es renderitzen els 3 elements**: `frontend/components/Library/SonilabLibraryView.tsx` — verificat amb 4 greps independents.
- **Únic emissor de les CSS vars `--us-home-*`**: `frontend/context/UserStyles/applyUserStylesToDOM.ts` (línies 100-107) — emet `--us-home-{filename,format,datetime,tableheader,navtabs,breadcrumb}-{family,size,color,weight,style}`.
- **Factory amb defaults**: `frontend/context/UserStyles/factoryStyles.ts:69-76` — els 3 elements ja tenen `var(--th-text-*)` per defecte.

### Comandes útils

```bash
# Type-check sense build
cd frontend && npx tsc --noEmit
# Hi ha 6 errors baseline preexistents — no en pot afegir cap de nou.

# Build complet
cd frontend && npm run build

# Servir frontend localment (per Playwright o navegador)
# El backend cal arrencar a part. Per al test anti-parpadeig amb backend
# real, l'usuari ja té VITE_USE_BACKEND=1 al .env del frontend.
cd frontend && npm run dev
```

### Regla de commits

Cada Task acaba amb un commit petit, atòmic, amb missatge en català (segueix el patró del repo). Mai amesar commits.

---

## File Structure

| Fitxer | Tipus de canvi | Responsabilitat post-canvi |
|--------|----------------|---------------------------|
| `frontend/components/Library/SonilabLibraryView.tsx` | Modificar | Renderitzar els 3 elements amb el color del preset, sense classes Tailwind interferents |
| `frontend/components/Settings/UserStyles/StyleAtomEditor.tsx` | Modificar | Editor uniforme de qualsevol StyleAtom, sense la prop `hideColor` |
| `frontend/components/Settings/UserStyles/HomeStylesPanel.tsx` | Modificar | Llistar les 6 files del scope `home` sense `hideColor: true` |
| `frontend/components/Settings/UserStyles/HomeStylePreview.tsx` | Modificar | Previsualitzar fidelment els colors del preset, sense overrides hardcodejats |
| `Skills_Claude/domain-user-styles.md` | Modificar | Documentar que els 3 elements són color-personalitzables i corregir `version: 2` |

**Fitxers explícitament NO tocats** (per evitar reintroduir el parpadeig):
- `frontend/context/UserStyles/UserStylesContext.tsx`
- `frontend/context/UserStyles/applyUserStylesToDOM.ts`
- `frontend/context/UserStyles/factoryStyles.ts`
- `frontend/context/UserStyles/userStylesMigration.ts`
- `frontend/context/Theme/ThemeContext.tsx`
- `frontend/components/Library/LibraryFileItem.tsx`

---

## Tasques

L'ordre és important: comencem pel canvi més baix-risc i visiblement aïllable (`StyleAtomEditor`), després el panell de configuració, després el preview, i finalment el component de la UI real (`SonilabLibraryView.tsx`) on el risc de regressió és més alt. Després verificacions visuals i actualització de la documentació de domini.

---

### Task 1: Eliminar la prop `hideColor` del `StyleAtomEditor`

Per què primer: és el canvi més contingut. Si cap consumidor falla al type-check, ho sabem immediatament i és fàcil de rectificar.

**Files:**
- Modify: `frontend/components/Settings/UserStyles/StyleAtomEditor.tsx`

- [ ] **Step 1.1: Llegir el fitxer per confirmar l'estat actual**

```bash
# Ja conegut: la prop hideColor existeix a línia 21, s'usa al destructuring
# de línia 24, i es renderitza condicionalment a línies 59-74.
```

- [ ] **Step 1.2: Eliminar la documentació JSDoc i la declaració de la prop**

Substituir les línies 15-22 actuals (interfície `Props`):

```tsx
interface Props {
  label: string;
  atom: StyleAtom;
  onChange: (patch: Partial<StyleAtom>) => void;
  /** Tamaño mínimo permitido (px). Por defecto 8. */
  minSize?: number;
  /** Tamaño máximo permitido (px). Por defecto 32. */
  maxSize?: number;
  /**
   * Oculta el selector de color. Útil per elements on el color està lligat al
   * tema admin o a un estat (actiu/inactiu) i no pot ser personalitzat pel
   * preset d'usuari — exposar el color picker confondria l'usuari perquè els
   * canvis no es reflectirien a la UI real.
   */
  hideColor?: boolean;
}
```

per:

```tsx
interface Props {
  label: string;
  atom: StyleAtom;
  onChange: (patch: Partial<StyleAtom>) => void;
  /** Tamaño mínimo permitido (px). Por defecto 8. */
  minSize?: number;
  /** Tamaño máximo permitido (px). Por defecto 32. */
  maxSize?: number;
}
```

- [ ] **Step 1.3: Eliminar `hideColor` del destructuring del component**

Substituir la línia 24 actual:

```tsx
export const StyleAtomEditor: React.FC<Props> = ({ label, atom, onChange, minSize = 8, maxSize = 32, hideColor = false }) => {
```

per:

```tsx
export const StyleAtomEditor: React.FC<Props> = ({ label, atom, onChange, minSize = 8, maxSize = 32 }) => {
```

- [ ] **Step 1.4: Eliminar el render condicional `hideColor`**

Substituir el bloc actual de línies 59-74:

```tsx
        {hideColor ? (
          // Placeholder buit per mantenir l'alineació de columnes — el color
          // d'aquest element ve del tema admin / estat actiu i no es pot
          // personalitzar des d'aquí.
          <div aria-hidden="true" />
        ) : (
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--th-text-muted)' }}>Color</label>
            <input
              type="color"
              value={atom.color}
              onChange={e => onChange({ color: e.target.value })}
              className="w-full h-8 p-0 bg-transparent border-none rounded-md cursor-pointer"
            />
          </div>
        )}
```

per:

```tsx
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--th-text-muted)' }}>Color</label>
          <input
            type="color"
            value={atom.color}
            onChange={e => onChange({ color: e.target.value })}
            className="w-full h-8 p-0 bg-transparent border-none rounded-md cursor-pointer"
          />
        </div>
```

- [ ] **Step 1.5: Type-check (esperat: 6 errors baseline, 0 nous)**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | tee /tmp/tsc-out.txt
```

Expected: exactament 6 errors baseline (els mateixos que abans):
```
components/EditorDeGuions/Toolbar.tsx(102,11): error TS17001: ...
components/EditorDeGuions/Toolbar.tsx(120,11): error TS17001: ...
components/TasksIA/TasksIAPanel.tsx(206,27): error TS17001: ...
components/VideoEditor/MediaPreviewView.tsx(133,17): error TS17001: ...
components/VideoEditor/MediaPreviewView.tsx(141,17): error TS17001: ...
context/Library/LibraryDataContext.tsx(333,7): error TS2353: ...
```

Si apareix un error nou amb "Property 'hideColor' does not exist on type 'Props'" → Task 2 ho arreglarà. **Procedeix igualment al Step 1.6** perquè Task 2 acabarà el type-check.

- [ ] **Step 1.6: Commit**

```bash
git add frontend/components/Settings/UserStyles/StyleAtomEditor.tsx
git commit -m "$(cat <<'EOF'
refactor(user-styles): eliminar prop hideColor del StyleAtomEditor

Tots els elements del scope home són ara color-personalitzables.
Cap consumidor necessita amagar el picker de color.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Eliminar `hideColor: true` del `HomeStylesPanel`

**Files:**
- Modify: `frontend/components/Settings/UserStyles/HomeStylesPanel.tsx`

- [ ] **Step 2.1: Substituir el ROWS i el render**

Substituir tot el contingut actual del fitxer per:

```tsx
// frontend/components/Settings/UserStyles/HomeStylesPanel.tsx
import React from 'react';
import { useUserStyles } from '../../../context/UserStyles/UserStylesContext';
import { StyleAtomEditor } from './StyleAtomEditor';
import { StylesPresetBar } from './StylesPresetBar';
import { HomeStylePreview } from './HomeStylePreview';
import type { HomeStyleSet } from '../../../types/UserStyles/userStylesTypes';

const ROWS: { key: keyof HomeStyleSet; label: string }[] = [
  { key: 'fileName',    label: "Nom d'arxiu" },
  { key: 'formatLabel', label: 'Format' },
  { key: 'dateTime',    label: 'Data i hora' },
  { key: 'tableHeader', label: 'Capçalera taula' },
  { key: 'navTabs',     label: 'Pestanyes navegació' },
  { key: 'breadcrumb',  label: 'Breadcrumb' },
];

export const HomeStylesPanel: React.FC = () => {
  const { activePreset, updateAtom } = useUserStyles();
  const preset = activePreset('home');

  return (
    <div>
      <StylesPresetBar scope="home" />
      {ROWS.map(row => (
        <StyleAtomEditor
          key={row.key}
          label={row.label}
          atom={preset.styles[row.key]}
          onChange={patch => updateAtom('home', row.key, patch)}
        />
      ))}
      <HomeStylePreview />
    </div>
  );
};
```

Notes del canvi: tipus de `ROWS` perd `hideColor?: boolean` i les 3 files perden `hideColor: true`. Crida a `<StyleAtomEditor>` perd la prop `hideColor={row.hideColor}`.

- [ ] **Step 2.2: Type-check (esperat: 6 errors baseline, 0 nous)**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "^$" | wc -l
```

Expected: `6` (només els errors baseline preexistents).

Si surt > 6 → llegir l'output complet, identificar el nou error, i corregir abans de continuar.

- [ ] **Step 2.3: Commit**

```bash
git add frontend/components/Settings/UserStyles/HomeStylesPanel.tsx
git commit -m "$(cat <<'EOF'
refactor(user-styles): activar color picker per a navTabs/breadcrumb/tableHeader

Els 3 elements del scope home ja no amaguen el selector de color. La
factory continua usant var(--th-text-*) per defecte; quan l'usuari toqui
el picker el preset prevaldrà sobre el tema.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Eliminar overrides hardcodejats del `HomeStylePreview`

**Files:**
- Modify: `frontend/components/Settings/UserStyles/HomeStylePreview.tsx`

- [ ] **Step 3.1: Substituir tot el contingut del fitxer**

Substituir el contingut actual per:

```tsx
// frontend/components/Settings/UserStyles/HomeStylePreview.tsx
import React from 'react';

/**
 * Preview fidel dels estils aplicats al home/llibreria real.
 *
 * Tots els elements del scope home (incloent navtabs, breadcrumb i tableheader)
 * són color-personalitzables des del preset d'usuari. La preview reflecteix
 * els colors actuals del preset llegint directament les CSS vars `--us-home-*`.
 *
 * Nota: la preview no simula el fons accent (var(--th-accent)) que tindrà
 * el botó actiu del navTab a la UI real. La diferenciació actiu/inactiu
 * només és visible al component real (SonilabLibraryView), no aquí.
 */
const cellStyle = (el: string): React.CSSProperties => ({
  fontFamily: `var(--us-home-${el}-family)`,
  fontSize:   `var(--us-home-${el}-size)`,
  color:      `var(--us-home-${el}-color)`,
  fontWeight: `var(--us-home-${el}-weight)` as any,
  fontStyle:  `var(--us-home-${el}-style)`,
});

export const HomeStylePreview: React.FC = () => {
  return (
    <div className="p-4 rounded-xl mt-4" style={{ backgroundColor: 'var(--th-bg-secondary)', border: '1px solid var(--th-border)' }}>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--th-text-muted)' }}>Visualització</div>
      <div className="flex gap-3 mb-2">
        <span style={cellStyle('navtabs')}>Files</span>
        <span style={cellStyle('navtabs')}>Projectes</span>
        <span style={cellStyle('navtabs')}>Media</span>
      </div>
      <div className="mb-2" style={cellStyle('breadcrumb')}>
        Files / Projecte demo / Capítol 1
      </div>
      <div className="grid grid-cols-[1fr_120px_140px] gap-3 mb-2 uppercase tracking-widest" style={cellStyle('tableheader')}>
        <span>Nom</span><span>Format</span><span>Data i hora</span>
      </div>
      <div className="grid grid-cols-[1fr_120px_140px] gap-3 py-1">
        <span style={cellStyle('filename')}>capitol_01.snlbpro</span>
        <span style={cellStyle('format')}>SNLBPRO</span>
        <span style={cellStyle('datetime')}>06/04/2026 14:23</span>
      </div>
      <div className="grid grid-cols-[1fr_120px_140px] gap-3 py-1">
        <span style={cellStyle('filename')}>capitol_01.srt</span>
        <span style={cellStyle('format')}>SRT</span>
        <span style={cellStyle('datetime')}>06/04/2026 14:25</span>
      </div>
    </div>
  );
};
```

Canvis respecte a l'original:
- El helper `cellStyle` perd el paràmetre `colorOverride` — ja no cal.
- Els 3 spans navtabs ja no passen `'#ffffff'`/`'#e5e7eb'`.
- El breadcrumb ja no passa `'var(--th-text-secondary)'`.
- El tableheader ja no passa `'var(--th-text-muted)'`.
- Comentari del header actualitzat per reflectir el comportament nou.

- [ ] **Step 3.2: Type-check**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "^$" | wc -l
```

Expected: `6` (errors baseline únicament).

- [ ] **Step 3.3: Commit**

```bash
git add frontend/components/Settings/UserStyles/HomeStylePreview.tsx
git commit -m "$(cat <<'EOF'
refactor(user-styles): eliminar overrides hardcodejats del HomeStylePreview

La preview ara reflecteix fidelment el color del preset per als 6
elements. El paràmetre colorOverride del helper cellStyle es elimina.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Aplicar `var(--us-home-navtabs-color)` als 4 botons navTabs

⚠️ **Aquesta és la primera modificació al fitxer més sensible (`SonilabLibraryView.tsx`).** Llegeix tota la Task abans de començar. La regla del CLAUDE.md de la carpeta `Library/` aplica: "no rediseñis la UI si el problema és funcional".

**Files:**
- Modify: `frontend/components/Library/SonilabLibraryView.tsx` (línies ~744-810)

- [ ] **Step 4.1: Llegir el fragment exacte abans d'editar**

Run (només per visualitzar i confirmar línies, no per modificar):
```bash
# Mostra els 4 botons navTabs perquè confirmis l'estat abans del canvi.
sed -n '744,810p' frontend/components/Library/SonilabLibraryView.tsx
```

Has de veure 4 blocs `<button onClick={...}>` consecutius (`goLibrary`, `goProjects`, `goMedia`, `goTrash`), cadascun amb:
- Una `className` template literal amb `text-white` o `text-gray-200` segons l'estat
- Un `style` object amb `fontFamily/fontSize/fontWeight/fontStyle` però **sense** `color`

- [ ] **Step 4.2: Modificar el botó `goLibrary` (Files)**

Substituir aquest bloc:

```tsx
  <button
    onClick={goLibrary}
    className={`px-2.5 py-2 rounded-lg transition-colors flex items-center justify-center
      ${(view === 'library' && page === 'library') ? 'text-white lib-nav-active' : 'text-gray-200 lib-nav-inactive'}
      ${isCollapsed ? 'w-10 h-10 !p-0' : ''}`}
    style={{
      fontFamily: 'var(--us-home-navtabs-family)',
      fontSize:   'var(--us-home-navtabs-size)',
      fontWeight: 'var(--us-home-navtabs-weight)' as any,
      fontStyle:  'var(--us-home-navtabs-style)',
    }}
    title="Files"
    aria-label="Files"
  >
    <Icons.Folder className="w-4 h-4" />
  </button>
```

per:

```tsx
  <button
    onClick={goLibrary}
    className={`px-2.5 py-2 rounded-lg transition-colors flex items-center justify-center
      ${(view === 'library' && page === 'library') ? 'lib-nav-active' : 'lib-nav-inactive'}
      ${isCollapsed ? 'w-10 h-10 !p-0' : ''}`}
    style={{
      fontFamily: 'var(--us-home-navtabs-family)',
      fontSize:   'var(--us-home-navtabs-size)',
      color:      'var(--us-home-navtabs-color)',
      fontWeight: 'var(--us-home-navtabs-weight)' as any,
      fontStyle:  'var(--us-home-navtabs-style)',
    }}
    title="Files"
    aria-label="Files"
  >
    <Icons.Folder className="w-4 h-4" />
  </button>
```

Canvis:
1. `text-white lib-nav-active` → `lib-nav-active` (eliminem `text-white`)
2. `text-gray-200 lib-nav-inactive` → `lib-nav-inactive` (eliminem `text-gray-200`)
3. Afegim `color: 'var(--us-home-navtabs-color)',` al `style` (just abans de `fontWeight`)

- [ ] **Step 4.3: Modificar el botó `goProjects`**

Substituir:

```tsx
  <button
    onClick={goProjects}
    className={`px-2.5 py-2 rounded-lg transition-colors flex items-center justify-center
      ${(view === 'library' && page === 'projects') ? 'text-white lib-nav-active' : 'text-gray-200 lib-nav-inactive'}
      ${isCollapsed ? 'w-10 h-10 !p-0' : ''}`}
    style={{
      fontFamily: 'var(--us-home-navtabs-family)',
      fontSize:   'var(--us-home-navtabs-size)',
      fontWeight: 'var(--us-home-navtabs-weight)' as any,
      fontStyle:  'var(--us-home-navtabs-style)',
    }}
    title="Projectes"
    aria-label="Projectes"
  >
    <span>📌</span>
  </button>
```

per:

```tsx
  <button
    onClick={goProjects}
    className={`px-2.5 py-2 rounded-lg transition-colors flex items-center justify-center
      ${(view === 'library' && page === 'projects') ? 'lib-nav-active' : 'lib-nav-inactive'}
      ${isCollapsed ? 'w-10 h-10 !p-0' : ''}`}
    style={{
      fontFamily: 'var(--us-home-navtabs-family)',
      fontSize:   'var(--us-home-navtabs-size)',
      color:      'var(--us-home-navtabs-color)',
      fontWeight: 'var(--us-home-navtabs-weight)' as any,
      fontStyle:  'var(--us-home-navtabs-style)',
    }}
    title="Projectes"
    aria-label="Projectes"
  >
    <span>📌</span>
  </button>
```

- [ ] **Step 4.4: Modificar el botó `goMedia`**

Substituir:

```tsx
  <button
    onClick={goMedia}
    className={`px-2.5 py-2 rounded-lg transition-colors flex items-center justify-center
      ${(view === 'library' && page === 'media') ? 'text-white lib-nav-active' : 'text-gray-200 lib-nav-inactive'}
      ${isCollapsed ? 'w-10 h-10 !p-0' : ''}`}
    style={{
      fontFamily: 'var(--us-home-navtabs-family)',
      fontSize:   'var(--us-home-navtabs-size)',
      fontWeight: 'var(--us-home-navtabs-weight)' as any,
      fontStyle:  'var(--us-home-navtabs-style)',
    }}
    title="Media"
    aria-label="Media"
  >
    <span>🎞️</span>
  </button>
```

per:

```tsx
  <button
    onClick={goMedia}
    className={`px-2.5 py-2 rounded-lg transition-colors flex items-center justify-center
      ${(view === 'library' && page === 'media') ? 'lib-nav-active' : 'lib-nav-inactive'}
      ${isCollapsed ? 'w-10 h-10 !p-0' : ''}`}
    style={{
      fontFamily: 'var(--us-home-navtabs-family)',
      fontSize:   'var(--us-home-navtabs-size)',
      color:      'var(--us-home-navtabs-color)',
      fontWeight: 'var(--us-home-navtabs-weight)' as any,
      fontStyle:  'var(--us-home-navtabs-style)',
    }}
    title="Media"
    aria-label="Media"
  >
    <span>🎞️</span>
  </button>
```

- [ ] **Step 4.5: Modificar el botó `goTrash` (Paperera)**

Substituir:

```tsx
  <button
    onClick={goTrash}
    className={`px-2.5 py-2 rounded-lg transition-colors flex items-center justify-center
      ${view === 'trash' ? 'text-white lib-nav-active' : 'text-gray-200 lib-nav-inactive'}
      ${isCollapsed ? 'w-10 h-10 !p-0' : ''}`}
    style={{
      fontFamily: 'var(--us-home-navtabs-family)',
      fontSize:   'var(--us-home-navtabs-size)',
      fontWeight: 'var(--us-home-navtabs-weight)' as any,
      fontStyle:  'var(--us-home-navtabs-style)',
    }}
    title="Paperera"
    aria-label="Paperera"
  >
    <Icons.Trash className="w-4 h-4" />
  </button>
```

per:

```tsx
  <button
    onClick={goTrash}
    className={`px-2.5 py-2 rounded-lg transition-colors flex items-center justify-center
      ${view === 'trash' ? 'lib-nav-active' : 'lib-nav-inactive'}
      ${isCollapsed ? 'w-10 h-10 !p-0' : ''}`}
    style={{
      fontFamily: 'var(--us-home-navtabs-family)',
      fontSize:   'var(--us-home-navtabs-size)',
      color:      'var(--us-home-navtabs-color)',
      fontWeight: 'var(--us-home-navtabs-weight)' as any,
      fontStyle:  'var(--us-home-navtabs-style)',
    }}
    title="Paperera"
    aria-label="Paperera"
  >
    <Icons.Trash className="w-4 h-4" />
  </button>
```

- [ ] **Step 4.6: Verificar que NO has tocat els botons "Crear"/"Guardar" dels modals**

Aquests botons (línies 1059, 1079) també usen `lib-nav-active text-white` però **NO** són part del scope `navTabs` — són botons de modal i el `text-white` és intencional per al fons accent.

Run:
```bash
grep -n "lib-nav-active text-white" frontend/components/Library/SonilabLibraryView.tsx
```

Expected: 2 línies (1059 i 1079, els botons "Crear" i "Guardar" dels modals). Si en surten més o menys, has tocat alguna cosa que no havies de tocar — revisa.

- [ ] **Step 4.7: Verificar que ja no queda cap navTab amb `text-white` o `text-gray-200`**

Run:
```bash
sed -n '744,810p' frontend/components/Library/SonilabLibraryView.tsx | grep -E "text-white|text-gray-200"
```

Expected: cap output (les 4 ocurrències han desaparegut del bloc 744-810).

- [ ] **Step 4.8: Type-check**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "^$" | wc -l
```

Expected: `6` (errors baseline).

- [ ] **Step 4.9: Commit**

```bash
git add frontend/components/Library/SonilabLibraryView.tsx
git commit -m "$(cat <<'EOF'
fix(user-styles): aplicar color del preset als 4 botons navTabs

Eliminades les classes Tailwind text-white/text-gray-200 dels 4 botons
i afegit color: var(--us-home-navtabs-color) als inline styles. Els
botons "Crear"/"Guardar" dels modals no es toquen — segueixen usant
text-white per al seu fons accent.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Aplicar `var(--us-home-breadcrumb-color)` al breadcrumb

**Files:**
- Modify: `frontend/components/Library/SonilabLibraryView.tsx` (línies ~909-940)

- [ ] **Step 5.1: Llegir el fragment exacte**

Run (només per confirmar):
```bash
sed -n '909,940p' frontend/components/Library/SonilabLibraryView.tsx
```

Has de veure el `<div>` wrapper del breadcrumb amb `color: 'var(--th-text-secondary)'` al `style`, els `breadcrumbs.map` amb el separador `<span className="text-gray-500 mx-1">/</span>`, i els botons de miga amb `text-gray-200`/`text-gray-400` segons l'estat actiu/inactiu.

- [ ] **Step 5.2: Modificar el wrapper del breadcrumb**

Substituir:

```tsx
        {!isCollapsed && (
            <div
              className="flex items-center gap-2 px-4 py-2 mb-2 mx-2 min-h-10"
              style={{
                color: 'var(--th-text-secondary)',
                borderBottom: '1px solid var(--th-border)',
                fontFamily: 'var(--us-home-breadcrumb-family)',
                fontSize:   'var(--us-home-breadcrumb-size)',
                fontWeight: 'var(--us-home-breadcrumb-weight)' as any,
                fontStyle:  'var(--us-home-breadcrumb-style)',
              }}
            >
```

per:

```tsx
        {!isCollapsed && (
            <div
              className="flex items-center gap-2 px-4 py-2 mb-2 mx-2 min-h-10"
              style={{
                color: 'var(--us-home-breadcrumb-color)',
                borderBottom: '1px solid var(--th-border)',
                fontFamily: 'var(--us-home-breadcrumb-family)',
                fontSize:   'var(--us-home-breadcrumb-size)',
                fontWeight: 'var(--us-home-breadcrumb-weight)' as any,
                fontStyle:  'var(--us-home-breadcrumb-style)',
              }}
            >
```

Canvi únic: `'var(--th-text-secondary)'` → `'var(--us-home-breadcrumb-color)'`.

- [ ] **Step 5.3: Modificar el separador `/` entre migues**

Substituir:

```tsx
                            {index > 0 && <span className="text-gray-500 mx-1">/</span>}
```

per:

```tsx
                            {index > 0 && <span className="mx-1">/</span>}
```

Canvi: eliminem `text-gray-500` perquè el separador hereti el color del wrapper.

- [ ] **Step 5.4: Modificar les classes condicionals dels botons de miga**

Substituir:

```tsx
                                disabled={index === breadcrumbs.length - 1} 
                                className={`px-2 py-1 rounded transition-colors ${index === breadcrumbs.length - 1 ? 'font-black text-gray-200 bg-transparent cursor-default' : 'hover:bg-white/10 text-gray-400'}`}
```

per:

```tsx
                                disabled={index === breadcrumbs.length - 1} 
                                className={`px-2 py-1 rounded transition-colors ${index === breadcrumbs.length - 1 ? 'font-black bg-transparent cursor-default' : 'hover:bg-white/10'}`}
```

Canvis:
- Eliminem `text-gray-200` de la miga activa (mantenim `font-black` per a la diferenciació visual pel pes).
- Eliminem `text-gray-400` de les migues inactives.

Ambdues migues hereten ara `var(--us-home-breadcrumb-color)` del wrapper.

- [ ] **Step 5.5: Verificar el resultat**

Run:
```bash
sed -n '909,940p' frontend/components/Library/SonilabLibraryView.tsx | grep -E "text-gray-200|text-gray-400|text-gray-500"
```

Expected: cap output.

- [ ] **Step 5.6: Type-check**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "^$" | wc -l
```

Expected: `6`.

- [ ] **Step 5.7: Commit**

```bash
git add frontend/components/Library/SonilabLibraryView.tsx
git commit -m "$(cat <<'EOF'
fix(user-styles): aplicar color del preset al breadcrumb

Wrapper del breadcrumb ara llegeix var(--us-home-breadcrumb-color).
Eliminades les classes text-gray-200/text-gray-400/text-gray-500 de les
migues i del separador. La diferenciació actiu/inactiu de la miga es
manté pel pes (font-black).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Aplicar `var(--us-home-tableheader-color)` a la cabecera de taula

**Files:**
- Modify: `frontend/components/Library/SonilabLibraryView.tsx` (línia ~949)

- [ ] **Step 6.1: Llegir el fragment**

Run (només per confirmar):
```bash
sed -n '946,958p' frontend/components/Library/SonilabLibraryView.tsx
```

Has de veure el `<header>` amb `color: 'var(--th-text-muted)'` al `style`.

- [ ] **Step 6.2: Modificar el `color` del header**

Substituir:

```tsx
              <header
                className="grid gap-0 items-center uppercase tracking-widest sticky top-0 z-30 py-2.5 mx-2"
                style={{
                  color: 'var(--th-text-muted)',
                  backgroundColor: 'var(--th-bg-secondary)',
                  borderBottom: '1px solid var(--th-border)',
                  gridTemplateColumns: gridColumns,
                  fontFamily: 'var(--us-home-tableheader-family)',
                  fontSize:   'var(--us-home-tableheader-size)',
                  fontWeight: 'var(--us-home-tableheader-weight)' as any,
                  fontStyle:  'var(--us-home-tableheader-style)',
                }}
              >
```

per:

```tsx
              <header
                className="grid gap-0 items-center uppercase tracking-widest sticky top-0 z-30 py-2.5 mx-2"
                style={{
                  color: 'var(--us-home-tableheader-color)',
                  backgroundColor: 'var(--th-bg-secondary)',
                  borderBottom: '1px solid var(--th-border)',
                  gridTemplateColumns: gridColumns,
                  fontFamily: 'var(--us-home-tableheader-family)',
                  fontSize:   'var(--us-home-tableheader-size)',
                  fontWeight: 'var(--us-home-tableheader-weight)' as any,
                  fontStyle:  'var(--us-home-tableheader-style)',
                }}
              >
```

Canvi únic: `'var(--th-text-muted)'` → `'var(--us-home-tableheader-color)'`.

- [ ] **Step 6.3: Type-check**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "^$" | wc -l
```

Expected: `6`.

- [ ] **Step 6.4: Commit**

```bash
git add frontend/components/Library/SonilabLibraryView.tsx
git commit -m "$(cat <<'EOF'
fix(user-styles): aplicar color del preset al header de taula

El header ara llegeix var(--us-home-tableheader-color) en lloc del
hardcoded var(--th-text-muted).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Verificació visual i anti-parpadeig amb Playwright

⚠️ **Aquesta task NO modifica codi, només verifica.** Si trobes regressió, **NO** intentis arreglar-la dins d'aquesta task — para, reporta el problema, i obre una nova task de fix.

**Prerequisits:**
- El backend de Sonilab ha d'estar arrencat (l'usuari té `VITE_USE_BACKEND=1` al `.env`).
- L'usuari ha de poder iniciar sessió a la web.
- El frontend ha d'estar arrencat (`cd frontend && npm run dev`) o l'usuari ja l'està utilitzant.

**Eines:** plugin Playwright via MCP (`mcp__plugin_playwright_playwright__*`).

- [ ] **Step 7.1: Pre-flight check**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "^$" | wc -l
```

Expected: `6`.

```bash
git status
```

Expected: working tree clean (totes les Tasks 1-6 committejades).

- [ ] **Step 7.2: Navegar a la home i fer snapshot inicial**

Tools: `mcp__plugin_playwright_playwright__browser_navigate` amb URL del frontend (per ex. `http://localhost:5173/` — confirmar amb l'usuari).

Després: `mcp__plugin_playwright_playwright__browser_snapshot` per capturar l'estat inicial. Verificar que es veuen els 4 botons navTabs (Files, Projectes, Media, Paperera), el breadcrumb i la cabecera de taula.

- [ ] **Step 7.3: Test anti-parpadeig (CRÍTIC)**

Tool: `mcp__plugin_playwright_playwright__browser_evaluate` amb aquest script:

```js
let count = 0;
const obs = new MutationObserver(muts => {
  for (const m of muts) if (m.attributeName === 'style') count++;
});
obs.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
await new Promise(r => setTimeout(r, 5000));
obs.disconnect();
return count;
```

**Criteri d'èxit**: el resultat ha de ser `≤ 2`.

**Si surt > 5**: para immediatament. NO segueixis amb la resta de la verificació. Reporta el resultat i revisa si algun canvi ha pogut introduir un re-render. Aquesta és la regressió que volem evitar.

- [ ] **Step 7.4: Verificar que les CSS vars s'emeten correctament**

Tool: `browser_evaluate` amb:

```js
const cs = getComputedStyle(document.documentElement);
return {
  navtabs:     cs.getPropertyValue('--us-home-navtabs-color').trim(),
  breadcrumb:  cs.getPropertyValue('--us-home-breadcrumb-color').trim(),
  tableheader: cs.getPropertyValue('--us-home-tableheader-color').trim(),
};
```

Expected: 3 valors no buits. Per a un usuari nou, els 3 seran `var(--th-text-primary)`/`var(--th-text-secondary)`/`var(--th-text-muted)` resoltsa hex pel navegador. Per a un usuari amb preset personalitzat, seran hex.

- [ ] **Step 7.5: Verificar que la cabecera de taula NO té el color `var(--th-text-muted)` hardcoded**

Tool: `browser_evaluate` amb:

```js
const header = document.querySelector('header.uppercase.tracking-widest');
return {
  found: !!header,
  inlineColor: header ? header.style.color : null,
  computedColor: header ? getComputedStyle(header).color : null,
};
```

Expected: `inlineColor` ha de contenir `var(--us-home-tableheader-color)` i `computedColor` ha de ser un valor RGB/RGBA resolt.

- [ ] **Step 7.6: Test funcional del color picker**

1. `mcp__plugin_playwright_playwright__browser_click` al botó de Configuració (a la sidebar inferior).
2. Click a la pestanya "ESTILS" (la 3a del modal).
3. Verificar amb `browser_snapshot` que la pestanya activa per defecte és "Inici" i que les 6 files mostren totes 4 columnes (Tipografia / Mida / Color / Negreta+Cursiva).
4. Per `tableHeader`: omplir el camp de color amb `#ff0000` via `browser_fill_form` o `browser_evaluate` (fent dispatchEvent del color input).
5. Esperar 1 segon perquè s'apliqui.
6. `browser_evaluate`:
   ```js
   getComputedStyle(document.documentElement).getPropertyValue('--us-home-tableheader-color').trim();
   ```
   Expected: `'#ff0000'`.
7. Tancar el modal (`browser_click` al botó FET o ✕).
8. `browser_take_screenshot` de la home — verificar visualment que la cabecera "NOM / FORMAT / DATA..." apareix en vermell.

- [ ] **Step 7.7: Test del breadcrumb i navTabs amb colors reconeixibles**

Repetir Step 7.6 per:
- `navTabs` amb `#00ff00` (verd) — verificar que les icones Files i Paperera (SVG, no emojis) apareixen en verd. Els emojis 📌 i 🎞️ NO canviaran de color: és una limitació coneguda documentada al spec.
- `breadcrumb` amb `#0000ff` (blau) — verificar que el text del breadcrumb apareix en blau (tant la miga activa com les inactives).

- [ ] **Step 7.8: Test de persistència**

1. Després de canviar els 3 colors al Step 7.6 i 7.7, esperar 2.5 segons (debounce backend = 1500ms + marge).
2. `mcp__plugin_playwright_playwright__browser_navigate` al mateix URL (recàrrega).
3. `browser_evaluate`:
   ```js
   const cs = getComputedStyle(document.documentElement);
   return {
     navtabs:     cs.getPropertyValue('--us-home-navtabs-color').trim(),
     breadcrumb:  cs.getPropertyValue('--us-home-breadcrumb-color').trim(),
     tableheader: cs.getPropertyValue('--us-home-tableheader-color').trim(),
   };
   ```
   Expected: els 3 valors hex (`#00ff00`, `#0000ff`, `#ff0000`) — han persistit al backend i s'han recarregat.

- [ ] **Step 7.9: Restaurar valors per defecte**

1. Tornar a Configuració → Estils → Inici.
2. Click a "Restablir" del `StylesPresetBar`.
3. Confirmar el dialog.
4. Verificar que els colors tornen a `var(--th-text-*)`.

- [ ] **Step 7.10: Test de no-regressió en els 4 temes**

Per cada tema (sonilab, dark, light, midnight):
1. Anar a Configuració → Tema → seleccionar el tema.
2. `browser_take_screenshot` de la home centrant els 4 botons navTabs, el breadcrumb i la cabecera de taula.
3. **Verificació visual**: comprovar que els 3 elements són llegibles (contrast suficient) en tots 4 temes.

**Si en algun tema l'icona del botó actiu del navTab queda il·legible** (per exemple, icona fosca sobre fons accent fosc en tema light): NO arreglis amb una hack hardcoded. Para i obre una nova task per ajustar la factory de `navTabs.color` a un valor que garanteixi contrast (per exemple `var(--th-text-inverse)`).

- [ ] **Step 7.11: Tornar a executar el test anti-parpadeig després de tots els canvis interactius**

Repetir Step 7.3. Expected: `≤ 2`.

Si ara surt > 5 però al Step 7.3 donava ≤ 2, vol dir que algun event de la UI (canviar tema, canviar color, navegar) ha introduït re-renders persistents. Para i investiga.

- [ ] **Step 7.12: Documentar resultats al commit**

```bash
git status
```

Expected: working tree clean — la verificació no ha modificat codi.

No fer commit aquí. Si tot ha anat bé, la verificació queda en la pròpia descripció de la PR/branch.

---

### Task 8: Actualitzar `domain-user-styles.md`

**Files:**
- Modify: `Skills_Claude/domain-user-styles.md`

- [ ] **Step 8.1: Llegir l'estat actual del fitxer per ubicar les seccions**

Run:
```bash
sed -n '1,40p' Skills_Claude/domain-user-styles.md
```

- [ ] **Step 8.2: Corregir `version: 1` → `version: 2` a la secció Persistencia**

Substituir:

```markdown
- **Backend**: `user.preferences.userStyles` (objeto JSON con `version: 1` y los 3 scopes). Se guarda con `PATCH /auth/me` debounced 1500ms.
```

per:

```markdown
- **Backend**: `user.preferences.userStyles` (objeto JSON con `version: 2` y los 3 scopes). Se guarda con `PATCH /auth/me` debounced 1500ms. La migración de `version: 1` a `version: 2` se gestiona en `userStylesMigration.ts:loadOrMigrate` y mapea hex hardcoded antiguos a `var(--th-*)` del tema admin.
```

- [ ] **Step 8.3: Afegir la regla "el preset prevalece sobre el tema" a "Reglas no negociables"**

Localitzar la secció `## Reglas no negociables`. Després de l'última regla existent (la dels components que no han de rebre `editorStyles` com a prop), afegir aquesta regla nova:

```markdown
- **El preset del usuario prevalece sobre el tema admin para los colores**. La factory por defecto usa `var(--th-text-*)` para que se adapte al tema actual. En cuanto el usuario toca el color picker de un atom, el valor pasa a ser un hex fijo y deja de resolverse contra el tema. Para volver al color del tema, el usuario debe usar "Restablir" en `StylesPresetBar`. Esta regla aplica también a los 3 elementos del scope `home` (`navTabs`, `breadcrumb`, `tableHeader`) — desde 2026-04-07 son color-personalizables como el resto.
```

- [ ] **Step 8.4: Afegir nota sobre eliminació de `hideColor` a la secció "Qué hacer cuando…"**

Aquesta correcció és menor i opcional — només si trobes una secció natural per posar-la. **Si no tens clar on encaixa, no la posis** (YAGNI).

- [ ] **Step 8.5: Commit**

```bash
git add Skills_Claude/domain-user-styles.md
git commit -m "$(cat <<'EOF'
docs(domain): actualitzar user-styles per al color picker complet

Corregit version: 1 → version: 2 i afegida la regla del preset
prevalent sobre el tema admin per als colors. Aplicable a tots els
6 elements del scope home des de 2026-04-07.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review checklist (per a l'implementer)

Al final de totes les tasks, executar manualment:

- [ ] **Build complet**:
  ```bash
  cd frontend && npm run build
  ```
  Expected: build completa sense errors nous (els 6 baseline són TS noEmit, no afecten el build).

- [ ] **Comptar línies de canvi**:
  ```bash
  git log --oneline feat/user-styles..HEAD
  ```
  Expected: 7 commits (Tasks 1, 2, 3, 4, 5, 6, 8). Task 7 no commiteja.

- [ ] **Verificar que els fitxers prohibits NO han estat tocats**:
  ```bash
  git diff --name-only feat/user-styles..HEAD
  ```
  Expected: NO ha de contenir cap d'aquests:
  - `frontend/context/UserStyles/UserStylesContext.tsx`
  - `frontend/context/UserStyles/applyUserStylesToDOM.ts`
  - `frontend/context/UserStyles/factoryStyles.ts`
  - `frontend/context/UserStyles/userStylesMigration.ts`
  - `frontend/context/Theme/ThemeContext.tsx`
  - `frontend/components/Library/LibraryFileItem.tsx`

- [ ] **Verificar que cap commit té amesa**:
  ```bash
  git log --format="%h %s" feat/user-styles..HEAD
  ```
  Expected: 7 commits diferents, cap "amend".

- [ ] **Verificar que el spec és cobert per les tasks**:
  - Spec criteri 1 (4 columnes alineades) → Task 1 + Task 2
  - Spec criteri 2 (color picker funciona) → Task 1, 2, 4, 5, 6
  - Spec criteri 3 (color visible a la home) → Task 4, 5, 6
  - Spec criteri 4 (persistència) → Task 7 Step 7.8
  - Spec criteri 5 (anti-parpadeig ≤ 2) → Task 7 Step 7.3 + 7.11
  - Spec criteri 6 (4 temes llegibles) → Task 7 Step 7.10
  - Spec criteri 7 (TS build OK) → Tasks 1-6 Step "type-check"

---

## Què fer si alguna cosa surt malament

- **Type-check falla amb error nou**: llegeix l'error, identifica de quina Task ve, i corregeix. NO continuïs amb altres Tasks fins que el TS check torni a 6 errors baseline.
- **El parpadeig torna**: revisa si has tocat algun fitxer prohibit. Fes `git diff` del fitxer i revertir-lo. Si no, busca si hi ha algun `useEffect`/`callback ref` nou que hagis introduït sense voler. Reverteix la commit problemàtica i obre una nova investigació.
- **El color del preset no es veu a la UI real**: verifica via DevTools que la classe `text-white`/`text-gray-200`/`text-gray-400`/`text-gray-500` ja no està al `class` de l'element. Si encara hi és, has oblidat un dels Steps de la Task 4 o 5.
- **El botó actiu queda il·legible en tema light**: aplica la mitigació del spec — canvia la factory de `navTabs.color` a `var(--th-text-inverse)`. **PERÒ això sí toca `factoryStyles.ts`** que normalment és prohibit. Aquest és l'únic cas on està autoritzat tocar-lo, i només si el test del Step 7.10 ho demana. Crea una task de fix separada amb commit dedicat.
- **Playwright no reprodueix el parpadeig**: pots demanar a l'usuari que executi el snippet del Step 7.3 al seu navegador real i comparis resultats.
