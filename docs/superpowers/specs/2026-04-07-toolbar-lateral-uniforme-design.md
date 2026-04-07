# Toolbar lateral uniforme amb navTabs — Design

**Data:** 2026-04-07
**Autor:** Marc Domínguez (amb assistència de Claude)
**Branch objectiu:** `feat/user-styles`
**Cicles anteriors:**
- Color picker per a navTabs/breadcrumb/tableHeader (commits `984c327`..`31f1fc3`)
- navTabs uniformes + DATA I HORA resizable (commits `617ab57`..`ebeb6c1`)

---

## 1. Context i problema

Després del cicle anterior (que va fer els 4 botons navTabs uniformes), la verificació visual va detectar que els 3 botons del **toolbar lateral** (a la dreta de la fila superior) segueixen sense escalar amb el preset i sense canviar de color quan l'usuari el personalitza:

| Botó | Línia | Issue |
|------|-------|-------|
| Crear carpeta | `SonilabLibraryView.tsx:916` | `text-sm` (Tailwind 14px fix), icon `<Icons.FolderPlus />` amb mida fixa per defecte (`w-6 h-6`), color `text-gray-200` no llegit del preset |
| Importar fitxer | `SonilabLibraryView.tsx:917` | Mateix patró que Crear carpeta amb `<Icons.Upload />` |
| Crear projecte | `SonilabLibraryView.tsx:918-924` | `text-sm` per al text "Crear projecte", `py-1.5` (a diferència de `py-2` dels altres), fons accent `var(--th-btn-primary-bg)` + text blanc `var(--th-btn-primary-text)` |

Conseqüència visual:
- Quan l'usuari posa el preset `home.navTabs.fontSize` a 24px, els 4 navTabs creixen però els 3 del toolbar es queden petits → fila superior heterogènia.
- Quan l'usuari canvia el color del preset a vermell, els 4 navTabs es renderitzen en vermell però els icons del toolbar segueixen en gris → incoherència visual.

## 2. Objectius

1. Fer que els 3 botons del toolbar lateral (Crear carpeta, Importar fitxer, Crear projecte) tinguin la mateixa alçada visual que els 4 navTabs amb qualsevol valor del preset `home.navTabs.fontSize`.
2. Fer que els icons SVG dels botons "Crear carpeta" i "Importar fitxer" segueixin el color del preset `home.navTabs.color`.
3. Fer que el text "Crear projecte" escali amb `home.navTabs.fontSize` però **mantingui el seu color blanc original** (`var(--th-btn-primary-text)`) per garantir contrast amb el fons accent.
4. **No reintroduir el parpadeig** dels cicles anteriors.

## 3. No-objectius

- Crear un nou atom `home.toolbarButtons` al preset. Reusem `home.navTabs` per simplicitat.
- Tocar els fitxers prohibits per anti-parpadeig: `UserStylesContext.tsx`, `applyUserStylesToDOM.ts`, `factoryStyles.ts`, `userStylesMigration.ts`, `ThemeContext.tsx`, `LibraryFileItem.tsx`, `icons.tsx`.
- Substituir el text "Crear projecte" per un icon. El text es manté.
- Tocar altres botons de la sidebar (Notificacions, Configuració, Tasques IA) que estan al peu i no formen part del toolbar superior.
- Tocar els botons d'accions de selecció múltiple (Copiar, Retallar, Renombrar, Eliminar) que apareixen quan hi ha selecció.
- Afegir `!important`, `setProperty('important')`, `MutationObserver`, callback refs, `useImportantStyleRef`.

## 4. Decisions de disseny

### 4.1 Compartir l'atom `home.navTabs` (sense crear-ne un nou)

**Decisió**: els 3 botons del toolbar llegeixen exactament les mateixes CSS vars que els 4 navTabs (`--us-home-navtabs-{family,size,color,weight,style}`).

**Per què**:
- Coherència visual: l'usuari té un sol control ("Pestanyes navegació") al panell de configuració que afecta tota la fila superior.
- Cap canvi al sistema de preset: no toquem `userStylesTypes.ts`, `factoryStyles.ts`, `applyUserStylesToDOM.ts`, `userStylesMigration.ts`, `HomeStylesPanel.tsx` ni `HomeStylePreview.tsx`. Tots aquests són fitxers prohibits per anti-parpadeig — evitar-los redueix dràsticament el risc de regressió.
- YAGNI: l'usuari no ha demanat control separat per al toolbar.

**Alternativa descartada**: crear `home.toolbarButtons` com a atom nou. Hauria requerit modificar 6+ fitxers de l'sistema de preset, tot ells prohibits o sensibles.

### 4.2 SVG amb `w-[1em] h-[1em]`

**Decisió**: els icons `Icons.FolderPlus` i `Icons.Upload` (Crear carpeta i Importar fitxer) reben `className="w-[1em] h-[1em]"` per escalar amb el font-size del botó pare.

**Per què**:
- Mateix patró que el cicle anterior (`Icons.Folder`, `Icons.Pin`, `Icons.Film`, `Icons.Trash` ja usen aquest patró als 4 navTabs).
- Els components `FolderPlus` i `Upload` ja usen `stroke="currentColor"` per defecte → canviaran de color amb el preset automàticament.
- Cap canvi a `icons.tsx`. Cap import nou.

### 4.3 Botó "Crear projecte" — text fluid però color fix

**Decisió**: el botó "Crear projecte" llegeix `var(--us-home-navtabs-{family,size,weight,style})` per al text, però **NO** llegeix `var(--us-home-navtabs-color)`. Es manté `color: var(--th-btn-primary-text)` (blanc).

**Per què**:
- L'alçada del botó creixerà amb el font-size del preset (igual que els altres) → manté la coherència de fila.
- El text "Crear projecte" es renderitza amb la mida del preset (per ex. 24px quan el preset és 24px).
- El fons accent (`var(--th-btn-primary-bg)`, blau) es manté → preserva la jerarquia visual de "acció principal".
- Si llegís el color del preset, l'usuari podria posar text fosc i el botó quedaria il·legible (text fosc sobre fons blau accent). Aquest risc es mitiga forçant el text blanc per defecte.

### 4.4 Padding `py-1.5` → `py-2`

**Decisió**: el botó "Crear projecte" canvia de `py-1.5` a `py-2` per alinear-se amb els altres botons del toolbar i amb els navTabs.

**Per què**: total uniformitat d'alçada amb la resta. Sense aquest canvi, el botó "Crear projecte" tindria 4px menys d'alçada (padding inferior + superior) que els altres 6.

### 4.5 Lliçons del parpadeig (anti-patrons prohibits)

Aquest cicle respecta les mateixes regles que els anteriors:
1. Cap fitxer prohibit tocat
2. Cap callback ref
3. Cap `setProperty('important')`
4. Cap `MutationObserver`
5. Cap `useImportantStyleRef`
6. Cap `!important` nou
7. Cap canvi al sistema de preset (`UserStylesContext`, `applyUserStylesToDOM`, etc.)

## 5. Components afectats

| Fitxer | Tipus de canvi | Detall |
|--------|----------------|--------|
| `frontend/components/Library/SonilabLibraryView.tsx` | Modificar (3 botons del toolbar) | (a) **Crear carpeta** (línia 916): eliminar `text-sm text-gray-200` de className, afegir 5 propietats del preset al inline `style` (family, size, color, weight, style), afegir `className="w-[1em] h-[1em]"` al `<Icons.FolderPlus />`, eliminar `gap-2` (és inert ara). (b) **Importar fitxer** (línia 917): mateix patró amb `<Icons.Upload />`. (c) **Crear projecte** (línies 918-924): eliminar `text-sm` de className, canviar `py-1.5` per `py-2`, afegir 4 propietats del preset al inline `style` (family, size, weight, style — **NO color** per preservar `var(--th-btn-primary-text)`). |

**Fitxers explícitament NO tocats** (per evitar reintroduir el parpadeig):
- `frontend/context/UserStyles/UserStylesContext.tsx`
- `frontend/context/UserStyles/applyUserStylesToDOM.ts`
- `frontend/context/UserStyles/factoryStyles.ts`
- `frontend/context/UserStyles/userStylesMigration.ts`
- `frontend/context/Theme/ThemeContext.tsx`
- `frontend/components/Library/LibraryFileItem.tsx`
- `frontend/components/icons.tsx`

## 6. Comportament esperat

### Estat per defecte (font-size = 14px del preset)

- Tots 7 botons (4 navTabs + 3 toolbar) tenen la mateixa alçada visual (~28-32px amb el `py-2` i el padding intern dels 14px).
- Els 6 primers botons (4 navTabs + Crear carpeta + Importar fitxer) renderitzen els seus icons amb el color del tema (`var(--th-text-primary)` per defecte).
- El botó "Crear projecte" té fons blau accent i text blanc.

### Quan l'usuari canvia el preset a font-size = 24px

- Tots 7 botons creixen al mateix temps (~58-62px d'alçada).
- Els 6 icons SVG (Folder, Pin, Film, Trash, FolderPlus, Upload) creixen a 24px.
- El text "Crear projecte" creix a 24px.
- L'amplada del botó "Crear projecte" creix horitzontalment per acomodar el text més gran.

### Quan l'usuari canvia el color del preset (per ex. vermell `#ff0000`)

- Els 6 icons SVG es renderitzen en vermell (`currentColor` heretat de `color: var(--us-home-navtabs-color)` al botó).
- El text "Crear projecte" **NO canvia** — es manté blanc per garantir contrast amb el fons accent. Comportament intencional, documentat al 4.3.

### Quan l'usuari canvia tipografia, negreta o cursiva al preset

- Tots 7 botons reflecteixen els canvis a fonts/icons.
- El botó "Crear projecte" reflecteix els canvis al text (negreta, cursiva, family) però NO al color.

## 7. Migració

Cap. Reusem l'atom `home.navTabs` que ja existeix des del cicle del color picker. Cap canvi al schema del payload, cap canvi a `userStylesMigration.ts`.

## 8. Verificació

Mateix patró que els cicles anteriors: verificació visual manual per part de l'usuari.

### 8.1 TypeScript build (automàtic, en cada Task del plan)
```bash
cd frontend && npx tsc --noEmit
```
Esperat: 6 errors baseline. Cap de nou.

### 8.2 Test anti-parpadeig (manual amb snippet)
Després de tots els canvis: hard reload de la home, F12 → Console, escriure `allow pasting`, executar:

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

Esperat: ≤ 5 mutacions en 5s (idealment 0-2). Una sola execució per garantir validesa del mesurament.

### 8.3 Visual a la home (manual)

**Test base**:
1. Anar a la home amb preset per defecte
2. Verificar que tots 7 botons (4 navTabs + Crear carpeta + Importar fitxer + Crear projecte) tenen la mateixa alçada visual
3. Verificar que els 6 icons es veuen amb el color del tema correctament
4. Verificar que "Crear projecte" segueix amb fons blau accent i text blanc

**Test amb mida gran**:
1. Configuració → Estils → Inici → "Pestanyes navegació", canviar mida a 24px
2. Tancar el modal i tornar a la home
3. Verificar que tots 7 botons creixen uniformement
4. Verificar que els 6 icons SVG creixen junt amb els navTabs
5. Verificar que el text "Crear projecte" també creix

**Test amb color**:
1. Configuració → Estils → Inici → "Pestanyes navegació", canviar color a `#ff0000`
2. Verificar que els 6 icons (Folder, Pin, Film, Trash, FolderPlus, Upload) es veuen en vermell
3. Verificar que el text "Crear projecte" **NO** canvia al vermell (es manté blanc)
4. Restablir per defecte

### 8.4 No regressió de cicles anteriors

- Color picker dels 3 elements (navTabs, breadcrumb, tableHeader) segueix funcionant
- Resize de DATA I HORA segueix funcionant
- Truncate de DATA I HORA segueix funcionant
- Click als 3 botons d'acció obre els seus respectius modals correctament:
  - Crear carpeta → modal "Crear carpeta"
  - Importar fitxer → modal d'importació
  - Crear projecte → modal "Crear projecte"

## 9. Riscos i mitigacions

| Risc | Probabilitat | Mitigació |
|------|-------------|-----------|
| El text "Crear projecte" amb mida gran del preset (per ex. 30px) ocupa massa amplada horitzontal i empeny altres botons | Baixa | El layout existent és `flex` — el botó creixerà horitzontalment sense empènyer, però potser cal fer scroll horitzontal. Acceptable. Si l'usuari ho considera molest, redueix la mida del preset. |
| Reintroducció del parpadeig | Molt baixa | Cap fitxer prohibit tocat. Test 8.2 obligatori. |
| L'usuari espera que el color del text "Crear projecte" canviï amb el preset | Mitja | Documentat al 4.3 i a "Limitacions conegudes". Si l'usuari ho demana, és un canvi futur que requerirà mitigació de contrast (forçar text blanc o negre segons la luminositat del color escollit). |
| Algun test de no regressió falla per haver tocat la mateixa zona del fitxer que les Tasks anteriors | Baixa | El bloc del toolbar (línies 916-924) NO toca el bloc dels navTabs (línies 744-815) ni el bloc del header de taula (línies 1005-1012). Zones diferents. |

## 10. Out-of-scope explícit

- Crear un nou atom `home.toolbarButtons` al preset.
- Fer que el botó "Crear projecte" canviï de color amb el preset (mantindrem el blanc).
- Tocar els botons de la sidebar inferior (Notificacions, Configuració, Tasques IA).
- Tocar els botons d'accions de selecció múltiple (Copiar, Retallar, Renombrar, Eliminar).
- Substituir el text "Crear projecte" per un icon.
- Mitigació de contrast WCAG (per al text del botó "Crear projecte" amb diferents fons accent dels temes).

## 11. Limitacions conegudes (no són bugs)

- **Color del text "Crear projecte" no segueix el preset**: és intencional per garantir contrast amb el fons accent blau. Si l'usuari posa el color del preset a un valor que coincideixi amb el blau accent, no notaria que els altres botons hereten el color però aquest no.

## 12. Criteris d'acceptació

1. ✅ Els 3 botons del toolbar (Crear carpeta, Importar fitxer, Crear projecte) tenen la mateixa alçada visual que els 4 navTabs amb qualsevol valor del preset.
2. ✅ Els icons `FolderPlus` i `Upload` segueixen el color del preset `home.navTabs.color`.
3. ✅ El text "Crear projecte" escala amb `home.navTabs.fontSize` però manté el color blanc (`var(--th-btn-primary-text)`).
4. ✅ El fons del botó "Crear projecte" continua sent `var(--th-btn-primary-bg)` (blau accent).
5. ✅ El test anti-parpadeig (verificació 8.2) passa: ≤ 5 mutacions de `style` en 5s.
6. ✅ El TypeScript build manté els 6 errors baseline (cap de nou).
7. ✅ Cap fitxer prohibit tocat. Cap patró prohibit introduït.
8. ✅ Cap regressió de cicles anteriors (color picker, navTabs SVG, DATA I HORA resizable, truncate).
9. ✅ Els 3 botons mantenen la seva funcionalitat d'obrir els seus modals respectius.

---

**Autoritzacions necessàries**: cap. Tot el treball és local al frontend, sense canvis de schema, sense canvis de backend.
