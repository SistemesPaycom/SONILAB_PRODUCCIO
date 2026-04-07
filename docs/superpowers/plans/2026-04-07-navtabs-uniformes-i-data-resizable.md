# navTabs uniformes i columna DATA I HORA resizable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fer que els 4 botons navTabs tinguin sempre la mateixa mida visual escalant amb el preset, i fer que la columna DATA I HORA sigui resizable amb el ratolí.

**Architecture:** Dos canvis independents al mateix fitxer (`SonilabLibraryView.tsx`) + 2 nous SVG icons a `icons.tsx`. (a) Substituir els 2 emojis dels botons Projectes/Media per nous SVG dedicats `Pin`/`Film`, i fer que els 4 SVG dels botons navTabs usin `w-[1em] h-[1em]` per escalar amb el font-size del preset. (b) Replicar el patró ja existent de `nameColWidth`/`formatColWidth` per a una nova `dateColWidth`, amb un resize handle equivalent als de Nom i Format.

**Tech Stack:** React 19 + TypeScript 5.8, Tailwind CSS via CDN, CSS custom properties (`--us-*`).

**Spec de referència:** [docs/superpowers/specs/2026-04-07-navtabs-uniformes-i-data-resizable-design.md](../specs/2026-04-07-navtabs-uniformes-i-data-resizable-design.md)

**Branch:** `feat/user-styles`

**Cicle anterior:** Color picker (Tasks 1-8 ja merged a la branca, commits `984c327`..`31f1fc3`)

---

## Notes prèvies importants per a l'implementer

### Anti-patrons absolutament prohibits

Aquests patrons van causar el bug del parpadeig que es va arreglar a la commit `ef60b36`. **NO** els facis servir per cap motiu:

- ❌ `useImportantStyleRef` (callback refs personalitzades)
- ❌ Callback refs (`ref={node => { ... }}`) per aplicar estils
- ❌ `element.style.setProperty(prop, value, 'important')`
- ❌ `MutationObserver` per a CSS
- ❌ `useEffect` que apliqui estils al DOM directament
- ❌ Afegir `!important` a regles CSS noves
- ❌ Tocar `frontend/context/UserStyles/UserStylesContext.tsx`
- ❌ Tocar `frontend/context/UserStyles/applyUserStylesToDOM.ts`
- ❌ Tocar `frontend/context/UserStyles/factoryStyles.ts`
- ❌ Tocar `frontend/context/UserStyles/userStylesMigration.ts`
- ❌ Tocar `frontend/context/Theme/ThemeContext.tsx`
- ❌ Tocar `frontend/components/Library/LibraryFileItem.tsx`

### Per què `1em` és segur

El `<button>` ja té `font-size: var(--us-home-navtabs-size)` al seu inline style des del cicle anterior (Task 4). Un SVG fill amb `className="w-[1em] h-[1em]"` heretarà aquesta mida. És CSS bàsic i funciona a tots els navegadors moderns.

### Per què `currentColor` és segur

Tots els SVG existents a `icons.tsx` ja usen `stroke="currentColor"`. Els nous també l'usaran. Això fa que el `color: var(--us-home-navtabs-color)` del botó es propagui automàticament al stroke del SVG, sense necessitat de cap altre canvi.

### Patró ja existent al codi (Issue #2)

`SonilabLibraryView.tsx` ja té dues columnes resizable: Nom i Format. Els seus handlers són:
- `handleResizeNameMouseDown` (línies 144-162)
- `handleResizeFormatMouseDown` (línies 164-182)

El nou `handleResizeDateMouseDown` ha de ser una **còpia literal** del de Format, només canviant `formatColWidth`/`setFormatColWidth` per `dateColWidth`/`setDateColWidth`, i el min/max de `60..250` a `80..300`.

### Comandes útils

```bash
# Type-check sense build
cd frontend && npx tsc --noEmit
# Hi ha 6 errors baseline preexistents — no en pot afegir cap de nou.

# Build complet
cd frontend && npm run build
```

### Regla de commits

Cada Task acaba amb un commit petit, atòmic, amb missatge en català. Mai amesar commits.

---

## File Structure

| Fitxer | Tipus de canvi | Responsabilitat post-canvi |
|--------|----------------|---------------------------|
| `frontend/components/icons.tsx` | Modificar (afegir 2 exports) | Afegir `Pin` (xinxeta) i `Film` (claqueta) seguint el mateix patró que els existents |
| `frontend/components/Library/SonilabLibraryView.tsx` | Modificar (3 blocs de canvis) | (a) Botons navTabs amb SVG escalables. (b) Estat i handler per `dateColWidth`. (c) Columna DATA I HORA al header amb resize handle. |

**Fitxers explícitament NO tocats**:
- `frontend/context/UserStyles/UserStylesContext.tsx`
- `frontend/context/UserStyles/applyUserStylesToDOM.ts`
- `frontend/context/UserStyles/factoryStyles.ts`
- `frontend/context/UserStyles/userStylesMigration.ts`
- `frontend/context/Theme/ThemeContext.tsx`
- `frontend/components/Library/LibraryFileItem.tsx`

---

## Tasques

L'ordre va de menor risc (afegir 2 SVG nous) a major risc (modificar el header del table grid), passant per modificacions iòsmofiques (els 4 botons navTabs).

---

### Task 1: Afegir `Pin` i `Film` a `icons.tsx`

**Files:**
- Modify: `frontend/components/icons.tsx` (afegir 2 exports al final del fitxer)

- [ ] **Step 1.1: Llegir el final del fitxer per confirmar el patró**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && tail -10 frontend/components/icons.tsx
```

Esperat: veure l'export de `EarIcon` (l'últim del fitxer, línies 245-250) com a referència del patró.

- [ ] **Step 1.2: Afegir `Pin` i `Film` al final del fitxer**

Afegir aquestes 12 línies al final del fitxer (després de l'export de `EarIcon`):

```tsx

export const Pin: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 12V4h1a1 1 0 100-2H7a1 1 0 100 2h1v8l-3 3v2h5.586l.707 4.707L12 22l.707-2.293L13.414 17H19v-2l-3-3z" />
  </svg>
);

export const Film: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4h18M3 12h18M3 16h18M7 4v16M17 4v16" />
  </svg>
);
```

Notes sobre els paths:
- `Pin`: dibuixa una xinxeta vertical amb la cabeça a dalt i la punta a baix (substitut visual de l'emoji 📌). Pattern simètric a `Folder`.
- `Film`: dibuixa una tira de pel·lícula amb perforacions als laterals (substitut visual de l'emoji 🎞️). Pattern simètric a `Trash`.
- Tots dos usen `stroke="currentColor"` (igual que la resta) → hereten el `color` del botó pare.
- Tots dos accepten `className` i `size` props (mateix patró que la resta).

- [ ] **Step 1.3: Type-check (esperat: 6 errors baseline, 0 nous)**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend" && npx tsc --noEmit 2>&1 | grep -v "^$" | wc -l
```

Esperat: `6`.

- [ ] **Step 1.4: Verificar que els imports de `Icons` continuen funcionant**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && grep -n "Icons.Pin\|Icons.Film" frontend/
```

Esperat: cap output (encara no s'usen enlloc — Task 2 els consumirà).

- [ ] **Step 1.5: Commit**

```bash
git add frontend/components/icons.tsx
git commit -m "$(cat <<'EOF'
feat(icons): afegir Pin i Film SVG per als navTabs

Dos icons nous per substituir els emojis Projectes (📌) i Media (🎞️)
del bloc dels 4 botons navTabs. Mateix patró que la resta d'icons
(stroke=currentColor, className/size props).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Substituir emojis i fer els 4 SVG escalables (`w-[1em] h-[1em]`)

⚠️ Aquesta task toca el fitxer més sensible (`SonilabLibraryView.tsx`). Llegeix tota la Task abans de començar.

**Files:**
- Modify: `frontend/components/Library/SonilabLibraryView.tsx` (línies ~744-815)

- [ ] **Step 2.1: Llegir el fragment per confirmar les línies**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && sed -n '744,815p' frontend/components/Library/SonilabLibraryView.tsx
```

Esperat: veure 4 blocs `<button>` (`goLibrary`, `goProjects`, `goMedia`, `goTrash`) amb els seus contingutes actuals (Folder SVG, emoji 📌, emoji 🎞️, Trash SVG).

- [ ] **Step 2.2: Substituir el contingut del botó `goLibrary`**

Cerca aquesta línia exacta dins del bloc del botó goLibrary:

```tsx
    <Icons.Folder className="w-4 h-4" />
```

i substitueix-la per:

```tsx
    <Icons.Folder className="w-[1em] h-[1em]" />
```

Canvi únic: `w-4 h-4` → `w-[1em] h-[1em]`.

- [ ] **Step 2.3: Substituir el contingut del botó `goProjects`**

Cerca aquesta línia exacta dins del bloc del botó goProjects:

```tsx
    <span>📌</span>
```

i substitueix-la per:

```tsx
    <Icons.Pin className="w-[1em] h-[1em]" />
```

- [ ] **Step 2.4: Substituir el contingut del botó `goMedia`**

Cerca aquesta línia exacta dins del bloc del botó goMedia:

```tsx
    <span>🎞️</span>
```

i substitueix-la per:

```tsx
    <Icons.Film className="w-[1em] h-[1em]" />
```

- [ ] **Step 2.5: Substituir el contingut del botó `goTrash`**

Cerca aquesta línia exacta dins del bloc del botó goTrash:

```tsx
    <Icons.Trash className="w-4 h-4" />
```

i substitueix-la per:

```tsx
    <Icons.Trash className="w-[1em] h-[1em]" />
```

- [ ] **Step 2.6: Verificar que els 4 botons usen el patró nou**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && sed -n '744,815p' frontend/components/Library/SonilabLibraryView.tsx | grep -E "w-\[1em\] h-\[1em\]"
```

Esperat: **exactament 4 línies** (una per botó: Folder, Pin, Film, Trash).

- [ ] **Step 2.7: Verificar que ja no hi ha emojis als 4 botons**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && sed -n '744,815p' frontend/components/Library/SonilabLibraryView.tsx | grep -E "📌|🎞️"
```

Esperat: cap output.

- [ ] **Step 2.8: Verificar que ja no hi ha `w-4 h-4` als botons navTabs**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && sed -n '744,815p' frontend/components/Library/SonilabLibraryView.tsx | grep "w-4 h-4"
```

Esperat: cap output.

**Important**: el patró `w-4 h-4` apareix a altres parts del fitxer (per exemple, al checkbox del header de la taula). NO modificar res fora del bloc de navTabs.

- [ ] **Step 2.9: Verificar que els botons "Crear"/"Guardar" dels modals NO han estat tocats**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && grep -c "lib-nav-active text-white" frontend/components/Library/SonilabLibraryView.tsx
```

Esperat: `2` (els botons "Crear" i "Guardar" dels modals).

- [ ] **Step 2.10: Type-check**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend" && npx tsc --noEmit 2>&1 | grep -v "^$" | wc -l
```

Esperat: `6` (errors baseline).

- [ ] **Step 2.11: Commit**

```bash
git add frontend/components/Library/SonilabLibraryView.tsx
git commit -m "$(cat <<'EOF'
fix(user-styles): navTabs amb SVG escalables i uniformes

Substituïts els emojis 📌/🎞️ per Icons.Pin/Icons.Film, i tots 4 SVG
dels navTabs usen w-[1em] h-[1em] per escalar amb el font-size del
preset. Resultat: els 4 botons sempre tenen la mateixa mida visual.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Afegir estat `dateColWidth` i handler `handleResizeDateMouseDown`

**Files:**
- Modify: `frontend/components/Library/SonilabLibraryView.tsx` (afegir 1 useState i 1 handler)

- [ ] **Step 3.1: Llegir el bloc dels useState i handlers existents**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && sed -n '85,90p' frontend/components/Library/SonilabLibraryView.tsx
```

Esperat: veure les línies amb `nameColWidth` i `formatColWidth`.

- [ ] **Step 3.2: Afegir `dateColWidth` després de `formatColWidth`**

Cerca aquesta línia exacta:

```tsx
  const [formatColWidth, setFormatColWidth] = useState(100);
```

i substitueix-la per (afegint una nova línia just després):

```tsx
  const [formatColWidth, setFormatColWidth] = useState(100);
  const [dateColWidth, setDateColWidth] = useState(140);
```

- [ ] **Step 3.3: Llegir l'handler `handleResizeFormatMouseDown` per confirmar el patró**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && sed -n '164,183p' frontend/components/Library/SonilabLibraryView.tsx
```

Esperat: veure l'handler complet `handleResizeFormatMouseDown` (línies 164-182).

- [ ] **Step 3.4: Afegir `handleResizeDateMouseDown` després de `handleResizeFormatMouseDown`**

Cerca aquest bloc exacte (línies 164-182):

```tsx
  const handleResizeFormatMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = formatColWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setFormatColWidth(Math.max(60, Math.min(250, startWidth + deltaX)));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };
```

i substitueix-lo per (afegint el nou handler just després del bloc existent):

```tsx
  const handleResizeFormatMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = formatColWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setFormatColWidth(Math.max(60, Math.min(250, startWidth + deltaX)));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleResizeDateMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = dateColWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setDateColWidth(Math.max(80, Math.min(300, startWidth + deltaX)));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };
```

Notes:
- L'handler nou és literalment una **còpia literal** de `handleResizeFormatMouseDown` amb 4 substitucions:
  - `formatColWidth` → `dateColWidth`
  - `setFormatColWidth` → `setDateColWidth`
  - `Math.max(60, Math.min(250, ...))` → `Math.max(80, Math.min(300, ...))`
- Cap altre canvi.

- [ ] **Step 3.5: Type-check**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend" && npx tsc --noEmit 2>&1 | grep -v "^$" | wc -l
```

Esperat: `6`.

**Nota**: aquest commit deixa `dateColWidth` definit però no usat — TypeScript NO marcarà error perquè `setDateColWidth` és accedit pel handler. Si veus un warning de "unused", continua igualment perquè Task 4 ho consumirà.

- [ ] **Step 3.6: Commit**

```bash
git add frontend/components/Library/SonilabLibraryView.tsx
git commit -m "$(cat <<'EOF'
feat(library): afegir estat dateColWidth i resize handler

Estat i handler isomòrfic al patró existent de Nom i Format.
Min 80px, max 300px, per defecte 140px (sense regressió visual).
Encara no consumit pel render — Task 4 ho farà.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Consumir `dateColWidth` al `gridColumns` i afegir el resize handle al header

**Files:**
- Modify: `frontend/components/Library/SonilabLibraryView.tsx` (modificar `gridColumns` + el `<div>` de la columna DATA I HORA al header)

- [ ] **Step 4.1: Modificar `gridColumns` per llegir `dateColWidth`**

Cerca aquesta línia exacta (línia ~730):

```tsx
  const gridColumns = `32px ${nameColWidth}px ${formatColWidth}px 140px 40px`;
```

i substitueix-la per:

```tsx
  const gridColumns = `32px ${nameColWidth}px ${formatColWidth}px ${dateColWidth}px 40px`;
```

Canvi únic: `140px` → `${dateColWidth}px`.

- [ ] **Step 4.2: Llegir el `<div>` actual de la columna DATA I HORA al header**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && sed -n '983,988p' frontend/components/Library/SonilabLibraryView.tsx
```

Esperat: veure quelcom semblant a:

```tsx
                <div onClick={() => handleSortChange(SortByKey.Date)} className="cursor-pointer whitespace-nowrap px-4 h-full flex items-center hover:bg-white/5 transition-colors border-r border-[var(--th-border)]">
                  <span>Data i hora</span>
                </div>
```

- [ ] **Step 4.3: Modificar el `<div>` de la columna DATA I HORA per afegir el resize handle**

Cerca aquest bloc exacte:

```tsx
                <div onClick={() => handleSortChange(SortByKey.Date)} className="cursor-pointer whitespace-nowrap px-4 h-full flex items-center hover:bg-white/5 transition-colors border-r border-[var(--th-border)]">
                  <span>Data i hora</span>
                </div>
```

i substitueix-lo per:

```tsx
                <div className="relative group/header flex items-center h-full border-r border-[var(--th-border)]">
                  <div onClick={() => handleSortChange(SortByKey.Date)} className="flex-1 cursor-pointer whitespace-nowrap px-4 h-full flex items-center hover:bg-white/5 transition-colors">
                    <span>Data i hora</span>
                  </div>
                  <div onMouseDown={handleResizeDateMouseDown} onClick={(e) => e.stopPropagation()} className="absolute -right-0.5 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/20 group-hover/header:bg-white/10 transition-colors z-40" title="Canviar amplada">
                    <div className="h-full w-[1px] bg-white/10 group-hover/header:bg-white/20 mx-auto" />
                  </div>
                </div>
```

Notes:
- L'estructura nova és **idèntica** a la dels `<div>` de Nom (línies ~968-975) i Format (línies ~976-983) del header.
- L'`<div>` extern fa de `relative group/header` per posicionar el handle absolut.
- L'`<div>` intern manté el `onClick={() => handleSortChange(SortByKey.Date)}` (sort per data, comportament existent preservat).
- El handle nou (`<div onMouseDown={handleResizeDateMouseDown}>`) és una còpia literal del de Format/Nom amb el handler nou.
- El `border-r` i `whitespace-nowrap` es preserven (passen al wrapper extern i al sort wrapper intern respectivament).

- [ ] **Step 4.4: Verificar que el handler s'ha connectat correctament**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && grep -c "handleResizeDateMouseDown" frontend/components/Library/SonilabLibraryView.tsx
```

Esperat: `2` (1 ocurrència a la definició del handler, 1 al `onMouseDown` del header).

- [ ] **Step 4.5: Verificar que el `gridColumns` ja no té el `140` hardcoded**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && grep -n "gridColumns" frontend/components/Library/SonilabLibraryView.tsx
```

Esperat: una línia que conté `${dateColWidth}px`, NO `140px`.

- [ ] **Step 4.6: Verificar que el sort per data segueix funcionant (comportament preservat)**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && grep -n "handleSortChange(SortByKey.Date)" frontend/components/Library/SonilabLibraryView.tsx
```

Esperat: 1 ocurrència (dins del nou `<div>` interior amb `flex-1 cursor-pointer`).

- [ ] **Step 4.7: Type-check**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend" && npx tsc --noEmit 2>&1 | grep -v "^$" | wc -l
```

Esperat: `6`.

- [ ] **Step 4.8: Commit**

```bash
git add frontend/components/Library/SonilabLibraryView.tsx
git commit -m "$(cat <<'EOF'
feat(library): columna DATA I HORA resizable amb el ratolí

gridColumns ara llegeix dateColWidth en lloc del 140px hardcoded.
El header de la columna DATA I HORA ara té un resize handle isomòrfic
als de Nom i Format. Min 80px, max 300px, per defecte 140px (cap
regressió per a usuaris que no toquin el handle).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Verificació visual i anti-parpadeig (manual per l'usuari)

⚠️ **Aquesta task NO modifica codi, només verifica.** Si trobes regressió, **NO** intentis arreglar-la dins d'aquesta task — para, reporta el problema, i obre una nova task de fix.

**Prerequisits**:
- L'usuari té el frontend obert al seu navegador (probablement `localhost:3000` amb backend connectat).
- Vite ha aplicat HMR amb els canvis de Tasks 1-4.

- [ ] **Step 5.1: Pre-flight check**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend" && npx tsc --noEmit 2>&1 | grep -v "^$" | wc -l
```

Esperat: `6`.

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && git status
```

Esperat: working tree clean.

- [ ] **Step 5.2: Demanar a l'usuari que faci hard reload i verifiqui visualment Issue #1 (navTabs)**

Demana a l'usuari que:

1. Faci hard reload de la home (Ctrl+Shift+R)
2. Verifiqui que els 4 botons (Files, Projectes, Media, Paperera) tenen exactament la mateixa mida visual amb el preset per defecte
3. Vagi a Configuració → Estils → Inici → "Pestanyes navegació", canvii la mida a 24px
4. Verifiqui que els 4 botons creixen **uniformement**
5. Faci "Restablir" per tornar a la mida per defecte
6. Reporti què veu (especialment si hi ha alguna mida desigual o alguna icona invisible)

- [ ] **Step 5.3: Demanar a l'usuari que verifiqui visualment Issue #2 (DATA I HORA)**

Demana a l'usuari que:

1. Posicioni el ratolí a la **vora dreta** de "DATA I HORA" al header de la taula
2. Verifiqui que el cursor canvia a `cursor-col-resize`
3. Arrossegui a la dreta — la columna s'amplia
4. Arrossegui a l'esquerra fins al mínim (la columna no ha de baixar més de 80px)
5. Arrossegui a la dreta fins al màxim (la columna no ha de pujar més de 300px)
6. Verifiqui que la columna del menú "..." segueix visible i accessible
7. Si arrossega la columna molt a la dreta, verifiqui que apareix scroll horitzontal i que pot recuperar el handle fent scroll
8. Faci recàrrega de la pàgina (F5) i verifiqui que `dateColWidth` torna a 140px (sense persistència)

- [ ] **Step 5.4: Test anti-parpadeig (manual amb snippet)**

Demana a l'usuari que:

1. Tanqui DevTools si està obert
2. Hard reload (Ctrl+Shift+R)
3. Esperi 5 segons
4. Obri DevTools → Console
5. Escrigui `allow pasting` i Enter (per desbloquejar el paste)
6. Enganxi aquest snippet (UNA SOLA VEGADA):

```js
let count = 0;
const obs = new MutationObserver(muts => {
  for (const m of muts) if (m.attributeName === 'style') count++;
});
obs.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
setTimeout(() => {
  obs.disconnect();
  console.log('Mutacions de style en 5s:', count);
}, 5000);
```

7. Esperi 5 segons sense fer res
8. Reporti el resultat

**Criteri d'èxit**: ≤ 2 mutacions en 5 segons.

**Si surt > 5**: para immediatament. NO segueixis amb la resta. Reporta el resultat i revisa si algun canvi ha pogut introduir un re-render. Aquesta és la regressió que volem evitar.

- [ ] **Step 5.5: Verificar no regressió de cicle anterior (Tasks 1-6 del color picker)**

Demana a l'usuari que:

1. Vagi a Configuració → Estils → Inici
2. Verifiqui que les 6 files mostren totes 4 columnes (Tipografia / Mida / Color / Negreta+Cursiva)
3. Canvii el color de "Pestanyes navegació" a un valor reconeixible (p. ex. vermell `#ff0000`)
4. Tanqui el modal i verifiqui que els 4 botons navTabs apareixen en vermell
5. Faci "Restablir" per tornar als colors per defecte

- [ ] **Step 5.6: Documentar resultats**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && git status
```

Esperat: working tree clean (la verificació no modifica codi).

Si tot ha anat bé, marca la Task com a completada al TodoWrite del controller. **No fer commit.**

Si l'usuari ha trobat alguna regressió, NO continuis. Reporta el problema al controller perquè decideixi si és un fix dins d'aquesta task o un nou cicle.

---

## Self-review checklist (per a l'implementer)

Al final de totes les tasks, executar manualment:

- [ ] **Build complet**:
  ```bash
  cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend" && npm run build
  ```
  Esperat: build completa sense errors nous (els 6 baseline són TS noEmit, no afecten el build).

- [ ] **Comptar línies de canvi**:
  ```bash
  cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && git log --oneline 31f1fc3..HEAD
  ```
  Esperat: 4 commits (Tasks 1, 2, 3, 4). Task 5 no commiteja.

- [ ] **Verificar que els fitxers prohibits NO han estat tocats**:
  ```bash
  cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && git diff --name-only 31f1fc3..HEAD
  ```
  Esperat: NO ha de contenir cap d'aquests:
  - `frontend/context/UserStyles/UserStylesContext.tsx`
  - `frontend/context/UserStyles/applyUserStylesToDOM.ts`
  - `frontend/context/UserStyles/factoryStyles.ts`
  - `frontend/context/UserStyles/userStylesMigration.ts`
  - `frontend/context/Theme/ThemeContext.tsx`
  - `frontend/components/Library/LibraryFileItem.tsx`

- [ ] **Verificar que cap commit té amesa**:
  ```bash
  cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && git log --format="%h %s" 31f1fc3..HEAD
  ```
  Esperat: 4 commits diferents, cap "amend".

- [ ] **Verificar que el spec és cobert per les tasks**:
  - Spec criteri 1 (4 navTabs amb mateixa mida) → Tasks 1 + 2
  - Spec criteri 2 (color del preset es manté) → Task 2 (no toca cap color, només substitueix els emojis per SVG amb `currentColor`)
  - Spec criteri 3 (DATA I HORA resizable) → Tasks 3 + 4
  - Spec criteri 4 (min 80, max 300) → Task 3 Step 3.4
  - Spec criteri 5 (anti-parpadeig ≤ 2) → Task 5 Step 5.4
  - Spec criteri 6 (TS build OK) → Tasks 1-4 amb steps de type-check
  - Spec criteri 7 (cap fitxer/patró prohibit) → Cap dels 4 commits hauria de tocar fitxers prohibits
  - Spec criteri 8 (cap regressió Tasks 1-6 cicle anterior) → Task 5 Step 5.5

---

## Què fer si alguna cosa surt malament

- **Type-check falla amb error nou**: llegeix l'error, identifica de quina Task ve, i corregeix. NO continuïs amb altres Tasks fins que el TS check torni a 6 errors baseline.
- **El parpadeig torna**: revisa si has tocat algun fitxer prohibit. Fes `git diff` del fitxer i revertir-lo. Si no, busca si hi ha algun `useEffect`/`callback ref` nou que hagis introduït sense voler. Reverteix la commit problemàtica i obre una nova investigació.
- **El SVG `Pin` o `Film` queda visualment diferent dels altres**: ajusta el path SVG. El path proposat al Step 1.2 és aproximat — l'usuari pot decidir si li agrada o no quan ho vegi. Si vol un canvi, és un fix de cosmetics.
- **El resize handle de DATA I HORA no funciona o no apareix**: verifica que el `<div>` extern té `relative group/header` i que el `<div>` del handle té `absolute -right-0.5 top-0 bottom-0`. Compara amb el de Format al mateix fitxer.
- **El click "Sort per data" deixa de funcionar**: el `onClick={() => handleSortChange(SortByKey.Date)}` ha de ser al `<div>` interior que conté el `<span>Data i hora</span>`, no al wrapper extern. Sigueix el patró exacte de Nom i Format.
- **L'usuari reporta que la columna "..." es perd**: això NO és un bug — és el comportament esperat quan la suma d'amplades excedeix l'amplada del contenidor. L'usuari ha de fer scroll horizontal per recuperar-la. Documentat al spec secció 6.
