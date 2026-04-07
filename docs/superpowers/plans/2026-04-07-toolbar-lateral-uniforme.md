# Toolbar lateral uniforme amb navTabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fer que els 3 botons del toolbar lateral (Crear carpeta, Importar fitxer, Crear projecte) tinguin la mateixa alçada, font-size i color que els 4 navTabs, llegint el mateix atom `home.navTabs` del preset.

**Architecture:** Tres edicions localitzades al bloc del toolbar lateral de `SonilabLibraryView.tsx` (línies 916-924). Reusem l'atom `home.navTabs` que ja existeix; cap canvi al sistema de preset, cap fitxer prohibit. Els icons SVG `FolderPlus` i `Upload` reben `w-[1em] h-[1em]` per escalar amb el font-size del preset, igual que els 4 navTabs del cicle anterior. El botó "Crear projecte" llegeix `family/size/weight/style` del preset però manté el `color: var(--th-btn-primary-text)` (blanc) per garantir contrast amb el fons accent.

**Tech Stack:** React 19 + TypeScript 5.8, Tailwind CSS via CDN, CSS custom properties (`--us-*`).

**Spec de referència:** [docs/superpowers/specs/2026-04-07-toolbar-lateral-uniforme-design.md](../specs/2026-04-07-toolbar-lateral-uniforme-design.md)

**Branch:** `feat/user-styles`

**Cicles anteriors:**
- Color picker (commits `984c327`..`31f1fc3`)
- navTabs uniformes + DATA I HORA resizable (commits `617ab57`..`ebeb6c1`)

---

## Notes prèvies importants per a l'implementer

### Anti-patrons absolutament prohibits

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
- ❌ Tocar `frontend/components/icons.tsx`

### Patró ja conegut del cicle anterior

Els 4 botons navTabs ja apliquen aquest patró als 4 botons del cantó superior esquerre. Per exemple, el botó `goLibrary` (línies 744-760):

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
  <Icons.Folder className="w-[1em] h-[1em]" />
</button>
```

Aquest cicle aplica el mateix patró als 3 botons del toolbar, amb una excepció documentada per al botó "Crear projecte": NO inclou `color` al inline style perquè manté `var(--th-btn-primary-text)` ja existent al style original (blanc) per contrast amb el fons accent.

### Per què `1em` és segur

El `<button>` ja tindrà `font-size: var(--us-home-navtabs-size)` al seu inline style després del canvi. Un SVG fill amb `className="w-[1em] h-[1em]"` heretarà aquesta mida.

### Per què `currentColor` als SVG funcionarà

`Icons.FolderPlus` i `Icons.Upload` (a `frontend/components/icons.tsx:22-32`) ja usen `stroke="currentColor"`. Quan el botó tingui `color: var(--us-home-navtabs-color)` al inline style, el stroke del SVG hereta automàticament aquell color.

### Comandes útils

```bash
# Type-check
cd frontend && npx tsc --noEmit
# Esperat: 6 errors baseline.

# Build complet
cd frontend && npm run build
```

### Regla de commits

Cada Task acaba amb un commit petit, atòmic, amb missatge en català. Mai amesar commits.

---

## File Structure

| Fitxer | Tipus de canvi | Responsabilitat post-canvi |
|--------|----------------|---------------------------|
| `frontend/components/Library/SonilabLibraryView.tsx` | Modificar (3 botons del toolbar lateral) | (a) Crear carpeta amb font/icon escalables i color del preset. (b) Importar fitxer amb font/icon escalables i color del preset. (c) Crear projecte amb font escalable, mantenint color blanc del fons accent. |

**Fitxers explícitament NO tocats**:
- `frontend/context/UserStyles/UserStylesContext.tsx`
- `frontend/context/UserStyles/applyUserStylesToDOM.ts`
- `frontend/context/UserStyles/factoryStyles.ts`
- `frontend/context/UserStyles/userStylesMigration.ts`
- `frontend/context/Theme/ThemeContext.tsx`
- `frontend/components/Library/LibraryFileItem.tsx`
- `frontend/components/icons.tsx`

---

## Tasques

L'ordre va dels canvis més simples (botons amb icon) al més complicat (botó amb text). Després verificació visual.

---

### Task 1: Modificar el botó "Crear carpeta"

**Files:**
- Modify: `frontend/components/Library/SonilabLibraryView.tsx` (línia ~916)

- [ ] **Step 1.1: Llegir el bloc actual del toolbar**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && sed -n '914,925p' frontend/components/Library/SonilabLibraryView.tsx
```

Esperat: veure els 3 botons del toolbar (Crear carpeta, Importar fitxer, Crear projecte) amb el seu estat actual.

- [ ] **Step 1.2: Substituir el botó "Crear carpeta"**

Cerca aquesta línia exacta:

```tsx
                                    <button onClick={() => setCreateFolderModalOpen(true)} className="px-3 py-2 text-gray-200 rounded-lg text-sm font-semibold flex items-center gap-2 hover:brightness-125" style={{ backgroundColor: 'var(--th-bg-tertiary)' }} title="Crear carpeta"><Icons.FolderPlus /></button>
```

i substitueix-la per:

```tsx
                                    <button onClick={() => setCreateFolderModalOpen(true)} className="px-3 py-2 rounded-lg font-semibold flex items-center hover:brightness-125" style={{ backgroundColor: 'var(--th-bg-tertiary)', fontFamily: 'var(--us-home-navtabs-family)', fontSize: 'var(--us-home-navtabs-size)', color: 'var(--us-home-navtabs-color)', fontWeight: 'var(--us-home-navtabs-weight)' as any, fontStyle: 'var(--us-home-navtabs-style)' }} title="Crear carpeta"><Icons.FolderPlus className="w-[1em] h-[1em]" /></button>
```

Canvis:
1. Eliminades les classes Tailwind `text-gray-200` (color hardcodejat) i `text-sm` (font-size hardcodejat).
2. Eliminada la classe `gap-2` (era inert perquè el botó només té un fill — l'icon).
3. Afegides 5 propietats del preset al inline `style`: `fontFamily`, `fontSize`, `color`, `fontWeight`, `fontStyle`.
4. Afegida `className="w-[1em] h-[1em]"` al `<Icons.FolderPlus />` perquè escali amb el font-size del botó pare.
5. El `backgroundColor: 'var(--th-bg-tertiary)'` es manté.

- [ ] **Step 1.3: Verificar el canvi**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && grep -n "setCreateFolderModalOpen" frontend/components/Library/SonilabLibraryView.tsx
```

Esperat: 2 línies. La primera ha de ser el `useState` (per ex. al voltant de la línia 78) i la segona ha de ser la nova versió del botó (al voltant de la línia 916). La línia del botó ha de contenir `var(--us-home-navtabs-family)`.

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && sed -n '914,918p' frontend/components/Library/SonilabLibraryView.tsx | grep -E "text-gray-200|text-sm"
```

Esperat: cap output (les classes Tailwind hardcoded han desaparegut del bloc).

- [ ] **Step 1.4: Type-check**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend" && npx tsc --noEmit 2>&1 | grep -v "^$" | wc -l
```

Esperat: `6` (errors baseline).

- [ ] **Step 1.5: Commit**

```bash
git add frontend/components/Library/SonilabLibraryView.tsx
git commit -m "$(cat <<'EOF'
feat(library): bot\u00f3 Crear carpeta uniforme amb navTabs

El bot\u00f3 'Crear carpeta' del toolbar ara llegeix
var(--us-home-navtabs-*) per a font-family, size, color, weight i
style. L'icon FolderPlus usa w-[1em] h-[1em] per escalar amb el
font-size del preset.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Modificar el botó "Importar fitxer"

**Files:**
- Modify: `frontend/components/Library/SonilabLibraryView.tsx` (línia ~917)

- [ ] **Step 2.1: Substituir el botó "Importar fitxer"**

Cerca aquesta línia exacta:

```tsx
                                    <button onClick={() => setImportModalOpen(true)} className="px-3 py-2 text-gray-200 rounded-lg text-sm font-semibold flex items-center gap-2 hover:brightness-125" style={{ backgroundColor: 'var(--th-bg-tertiary)' }} title="Importar fitxer"><Icons.Upload /></button>
```

i substitueix-la per:

```tsx
                                    <button onClick={() => setImportModalOpen(true)} className="px-3 py-2 rounded-lg font-semibold flex items-center hover:brightness-125" style={{ backgroundColor: 'var(--th-bg-tertiary)', fontFamily: 'var(--us-home-navtabs-family)', fontSize: 'var(--us-home-navtabs-size)', color: 'var(--us-home-navtabs-color)', fontWeight: 'var(--us-home-navtabs-weight)' as any, fontStyle: 'var(--us-home-navtabs-style)' }} title="Importar fitxer"><Icons.Upload className="w-[1em] h-[1em]" /></button>
```

Mateix patró que la Task 1: eliminades `text-gray-200`, `text-sm`, `gap-2`; afegides 5 propietats del preset al inline `style`; afegida `className="w-[1em] h-[1em]"` al `<Icons.Upload />`; mantingut el `backgroundColor`.

- [ ] **Step 2.2: Verificar el canvi**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && grep -n "setImportModalOpen" frontend/components/Library/SonilabLibraryView.tsx
```

Esperat: 2 línies (useState + botó). La línia del botó ha de contenir `var(--us-home-navtabs-family)`.

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && sed -n '914,919p' frontend/components/Library/SonilabLibraryView.tsx | grep -E "text-gray-200|text-sm"
```

Esperat: cap output.

- [ ] **Step 2.3: Type-check**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend" && npx tsc --noEmit 2>&1 | grep -v "^$" | wc -l
```

Esperat: `6`.

- [ ] **Step 2.4: Commit**

```bash
git add frontend/components/Library/SonilabLibraryView.tsx
git commit -m "$(cat <<'EOF'
feat(library): bot\u00f3 Importar fitxer uniforme amb navTabs

Mateix patr\u00f3 que el bot\u00f3 Crear carpeta: l'inline style llegeix
var(--us-home-navtabs-*) i l'icon Upload usa w-[1em] h-[1em].

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Modificar el botó "Crear projecte"

⚠️ Aquest botó té una particularitat: **NO ha d'incloure `color` del preset** al inline style. Manté `color: var(--th-btn-primary-text)` (blanc) per garantir contrast amb el fons accent (blau).

**Files:**
- Modify: `frontend/components/Library/SonilabLibraryView.tsx` (línies ~918-924)

- [ ] **Step 3.1: Substituir el botó "Crear projecte"**

Cerca aquest bloc exacte:

```tsx
                                    <button
    onClick={() => setIsCreateProjectOpen(true)}
    className="px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: 'var(--th-btn-primary-bg)', color: 'var(--th-btn-primary-text)' }}
    title="Crear projecte"
  >
    Crear projecte
  </button>
```

i substitueix-lo per:

```tsx
                                    <button
    onClick={() => setIsCreateProjectOpen(true)}
    className="px-3 py-2 rounded-lg font-semibold" style={{ backgroundColor: 'var(--th-btn-primary-bg)', color: 'var(--th-btn-primary-text)', fontFamily: 'var(--us-home-navtabs-family)', fontSize: 'var(--us-home-navtabs-size)', fontWeight: 'var(--us-home-navtabs-weight)' as any, fontStyle: 'var(--us-home-navtabs-style)' }}
    title="Crear projecte"
  >
    Crear projecte
  </button>
```

Canvis:
1. Eliminada la classe `text-sm` (font-size hardcodejat).
2. Canviat `py-1.5` per `py-2` per alinear l'alçada amb els altres 6 botons (4 navTabs + 2 toolbar).
3. Afegides **4** propietats del preset al inline `style`: `fontFamily`, `fontSize`, `fontWeight`, `fontStyle`. **NO** s'afegeix `color` — el botó manté el seu `color: var(--th-btn-primary-text)` original perquè el text blanc segueixi llegible sobre el fons accent blau.
4. El `backgroundColor: 'var(--th-btn-primary-bg)'` es manté (fons accent blau).

- [ ] **Step 3.2: Verificar que el botó NO té `var(--us-home-navtabs-color)` (excepció intencional)**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && sed -n '918,926p' frontend/components/Library/SonilabLibraryView.tsx | grep "var(--us-home-navtabs-color)"
```

Esperat: cap output. (És intencional — el botó "Crear projecte" no llegeix el color del preset perquè manté el seu color blanc.)

- [ ] **Step 3.3: Verificar que el botó SÍ té les altres 4 propietats del preset**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && sed -n '918,926p' frontend/components/Library/SonilabLibraryView.tsx | grep -c "var(--us-home-navtabs-"
```

Esperat: `4` (family, size, weight, style — sense color).

- [ ] **Step 3.4: Verificar que `py-1.5` ha desaparegut**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && sed -n '918,926p' frontend/components/Library/SonilabLibraryView.tsx | grep "py-1.5"
```

Esperat: cap output (s'ha canviat per `py-2`).

- [ ] **Step 3.5: Verificar que `py-2` està present**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && sed -n '918,926p' frontend/components/Library/SonilabLibraryView.tsx | grep "py-2"
```

Esperat: 1 línia que conté `px-3 py-2 rounded-lg font-semibold`.

- [ ] **Step 3.6: Type-check**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend" && npx tsc --noEmit 2>&1 | grep -v "^$" | wc -l
```

Esperat: `6`.

- [ ] **Step 3.7: Commit**

```bash
git add frontend/components/Library/SonilabLibraryView.tsx
git commit -m "$(cat <<'EOF'
feat(library): bot\u00f3 Crear projecte uniforme amb navTabs

El text 'Crear projecte' ara llegeix var(--us-home-navtabs-family/size/
weight/style) per\u00f2 mant\u00e9 el color blanc original sobre el fons accent
per garantir contrast. Padding canviat de py-1.5 a py-2 per alinear
l'al\u00e7ada amb els altres 6 botons.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Verificació visual i anti-parpadeig (manual per l'usuari)

⚠️ **Aquesta task NO modifica codi, només verifica.** Si trobes regressió, **NO** intentis arreglar-la dins d'aquesta task — para, reporta el problema, i obre una nova task de fix.

**Prerequisits**:
- L'usuari té el frontend obert al seu navegador (probablement `localhost:3000` amb backend connectat).
- Vite ha aplicat HMR amb els canvis de Tasks 1-3.

- [ ] **Step 4.1: Pre-flight check**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend" && npx tsc --noEmit 2>&1 | grep -v "^$" | wc -l
```

Esperat: `6`.

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && git status
```

Esperat: working tree clean.

- [ ] **Step 4.2: Verificació visual base (preset per defecte)**

Demana a l'usuari que:

1. Hard reload (Ctrl+Shift+R) per aplicar tots els canvis HMR
2. Vagi a la home
3. Verifiqui que **els 7 botons de la fila superior tenen la mateixa alçada visual**:
   - 4 navTabs (Files, Projectes, Media, Paperera)
   - Crear carpeta
   - Importar fitxer
   - Crear projecte
4. Verifiqui que els 6 primers botons mostren els icons amb el color correcte (gris/blanc del tema)
5. Verifiqui que "Crear projecte" segueix amb fons blau accent i text blanc
6. Reporti què veu

- [ ] **Step 4.3: Verificació amb mida del preset gran**

Demana a l'usuari que:

1. Vagi a Configuració → Estils → Inici → "Pestanyes navegació"
2. Canvii la mida a 24px
3. Tanqui el modal
4. Verifiqui que **els 7 botons creixen al mateix temps i a la mateixa alçada**
5. Verifiqui que els 6 icons SVG (Folder, Pin, Film, Trash, FolderPlus, Upload) creixen junt
6. Verifiqui que el text "Crear projecte" també creix
7. Restablir per defecte

- [ ] **Step 4.4: Verificació amb color del preset**

Demana a l'usuari que:

1. Vagi a Configuració → Estils → Inici → "Pestanyes navegació"
2. Canvii el color a vermell `#ff0000`
3. Tanqui el modal
4. Verifiqui que **els 6 icons** (Folder, Pin, Film, Trash, FolderPlus, Upload) es veuen en **vermell**
5. Verifiqui que el text "Crear projecte" **NO** canvia al vermell (es manté blanc — comportament intencional)
6. Restablir per defecte

- [ ] **Step 4.5: Test anti-parpadeig (manual amb snippet)**

Demana a l'usuari que:

1. Tanqui DevTools si està obert
2. Hard reload (Ctrl+Shift+R)
3. Esperi 5 segons
4. Obri DevTools → Console
5. Escrigui `allow pasting` i Enter
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

**Criteri d'èxit**: ≤ 5 mutacions en 5 segons (idealment 0-2).

**Si surt > 5**: para immediatament. NO segueixis amb la resta. Revisa si algun canvi ha pogut introduir un re-render.

- [ ] **Step 4.6: Verificació no regressió de cicles anteriors**

Demana a l'usuari que verifiqui que segueixen funcionant:

1. **Color picker dels 3 elements** (navTabs, breadcrumb, tableHeader): obrir Configuració → Estils → Inici, verificar que les 6 files mostren totes 4 columnes.
2. **DATA I HORA resizable**: passar el ratolí per la vora dreta de "DATA I HORA" al header de la taula, verificar que el cursor canvia a `cursor-col-resize`.
3. **DATA I HORA truncate**: arrossegar la columna fins al mínim, verificar que el text es talla amb "..." en lloc de desbordar-se.
4. **Click als 3 botons d'acció**: cada botó (Crear carpeta, Importar fitxer, Crear projecte) ha d'obrir el seu modal corresponent.

- [ ] **Step 4.7: Documentar resultats**

Run:
```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && git status
```

Esperat: working tree clean (la verificació no modifica codi).

Si tot ha anat bé, marca la Task com a completada al TodoWrite del controller. **No fer commit.**

---

## Self-review checklist (per a l'implementer)

Al final de totes les tasks, executar manualment:

- [ ] **Build complet**:
  ```bash
  cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend" && npm run build
  ```
  Esperat: build completa sense errors nous.

- [ ] **Comptar línies de canvi**:
  ```bash
  cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && git log --oneline 7e6534c..HEAD
  ```
  Esperat: 3 commits (Tasks 1, 2, 3). Task 4 no commiteja.

- [ ] **Verificar que els fitxers prohibits NO han estat tocats**:
  ```bash
  cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && git diff --name-only 7e6534c..HEAD
  ```
  Esperat: només `frontend/components/Library/SonilabLibraryView.tsx`. NO ha de contenir cap d'aquests:
  - `frontend/context/UserStyles/UserStylesContext.tsx`
  - `frontend/context/UserStyles/applyUserStylesToDOM.ts`
  - `frontend/context/UserStyles/factoryStyles.ts`
  - `frontend/context/UserStyles/userStylesMigration.ts`
  - `frontend/context/Theme/ThemeContext.tsx`
  - `frontend/components/Library/LibraryFileItem.tsx`
  - `frontend/components/icons.tsx`

- [ ] **Verificar que cap commit té amesa**:
  ```bash
  cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO" && git log --format="%h %s" 7e6534c..HEAD
  ```
  Esperat: 3 commits diferents, cap "amend".

- [ ] **Verificar que el spec és cobert per les tasks**:
  - Spec criteri 1 (mateixa alçada que els navTabs) → Tasks 1, 2, 3
  - Spec criteri 2 (icons FolderPlus/Upload segueixen color del preset) → Tasks 1, 2
  - Spec criteri 3 (text "Crear projecte" escala però manté blanc) → Task 3
  - Spec criteri 4 (fons accent del botó "Crear projecte" es manté) → Task 3 Step 3.1 (preserva `backgroundColor`)
  - Spec criteri 5 (anti-parpadeig ≤ 5) → Task 4 Step 4.5
  - Spec criteri 6 (TS build OK) → Tasks 1-3 amb steps de type-check
  - Spec criteri 7 (cap fitxer/patró prohibit) → declarat a notes prèvies + verificat al self-review final
  - Spec criteri 8 (cap regressió cicles anteriors) → Task 4 Step 4.6
  - Spec criteri 9 (botons mantenen funcionalitat de modals) → Task 4 Step 4.6

---

## Què fer si alguna cosa surt malament

- **Type-check falla amb error nou**: llegeix l'error, identifica de quina Task ve, i corregeix. NO continuïs amb altres Tasks fins que el TS check torni a 6 errors baseline.
- **El parpadeig torna**: revisa si has tocat algun fitxer prohibit. Fes `git diff` del fitxer i revertir-lo. Si no, busca si hi ha algun `useEffect`/`callback ref` nou que hagis introduït sense voler. Reverteix la commit problemàtica.
- **Els botons no creixen amb el preset**: verifica que el inline `style` conté `fontSize: 'var(--us-home-navtabs-size)'` i NO té el `text-sm` Tailwind interferint. Pot ser que el `text-sm` quedi residual al `className` per error.
- **El text "Crear projecte" es veu vermell quan canvia el color del preset**: vol dir que has afegit `color: 'var(--us-home-navtabs-color)'` al style del botó "Crear projecte" per error. Treu-lo — el botó "Crear projecte" NO ha de tenir aquesta propietat. Manté `var(--th-btn-primary-text)` original.
- **Els icons FolderPlus/Upload NO escalen amb el preset**: verifica que els components SVG tenen `className="w-[1em] h-[1em]"`. Si no, afegeix-lo.
- **Crear carpeta o Importar fitxer no obre el seu modal**: verifica que el `onClick={() => setCreateFolderModalOpen(true)}` o `onClick={() => setImportModalOpen(true)}` segueix igual. No has d'haver tocat la lògica del onClick, només les classes/style.
