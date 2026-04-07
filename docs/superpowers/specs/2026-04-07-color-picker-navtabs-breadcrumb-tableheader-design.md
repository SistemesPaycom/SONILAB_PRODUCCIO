# Color picker per a navTabs / breadcrumb / tableHeader — Design

**Data:** 2026-04-07
**Autor:** Marc Domínguez (amb assistència de Claude)
**Branch objectiu:** `feat/user-styles`

---

## 1. Context i problema

Els 3 elements `tableHeader`, `navTabs` i `breadcrumb` del scope `home` actualment **amaguen el selector de color** al panell de configuració (`HomeStylesPanel.tsx`, prop `hideColor: true`). El motiu original era que el seu color venia de classes Tailwind hardcodejades amb estats actiu/inactiu (`text-white`, `text-gray-200`, `text-gray-400`), i exposar el picker hauria estat confús perquè els canvis no s'haurien reflectit a la UI real.

Conseqüència: l'usuari pot configurar tipografia, mida, negreta i cursiva d'aquests elements, però **no el color**. A més, com que la columna "Color" desapareix, la fila té només 3 columnes en lloc de 4 i l'alineació visual es trenca respecte a "Nom d'arxiu" / "Format" / "Data i hora".

## 2. Objectius

- Permetre que l'usuari personalitzi el color dels 3 elements des del panell de configuració.
- Mantenir l'alineació visual de les 6 files del `HomeStylesPanel` (4 columnes sempre).
- **Que el preset de l'usuari prevalgui sempre sobre el tema admin** (Sonilab/Dark/Light/Midnight) — una vegada l'usuari personalitza un color, aquest mana fins que faci "Restablir per defecte".
- **No reintroduir el parpadeig** que es va arreglar a la commit `ef60b36`.

## 3. No-objectius

- No exposar control "color actiu vs color inactiu" (un sol color base per element).
- No tocar el pipeline de CSS vars (`applyUserStylesToDOM.ts`), ni el context d'usuaris (`UserStylesContext.tsx`), ni la migració (`userStylesMigration.ts`), ni les factories (`factoryStyles.ts`).
- No afegir `color-mix()`, `MutationObserver`, callback refs ni `setProperty('important')` — totes aquestes tècniques estan prohibides perquè van causar el parpadeig anterior.
- No tocar `LibraryFileItem.tsx` (ja revertit a inline `style`).
- No afegir `!important` enlloc.

## 4. Decisions de disseny

### 4.1 Enfoc: quitar les classes Tailwind hardcodejades

Els 3 elements tenen avui classes Tailwind de color que entren en conflicte amb les CSS vars del preset:

| Element | Estat actual | Canvi necessari |
|---------|--------------|-----------------|
| navTabs (4 botons) | Classes Tailwind `text-white`/`text-gray-200`. Inline `style` no té `color`. | (a) Eliminar les 2 classes Tailwind. (b) Afegir `color: 'var(--us-home-navtabs-color)'` als 4 inline styles. |
| breadcrumb (contenidor) | Inline `style` té `color: 'var(--th-text-secondary)'` hardcodejat. | Canviar a `color: 'var(--us-home-breadcrumb-color)'`. |
| breadcrumb (migues, dins del contenidor) | Classes Tailwind `text-gray-200` (última)/`text-gray-400` (clickables) que sobreescriuen el color heretat. | Eliminar les 2 classes — el color s'hereta del wrapper. |
| tableHeader | Inline `style` té `color: 'var(--th-text-muted)'` hardcodejat. Sense classes Tailwind. | Canviar a `color: 'var(--us-home-tableheader-color)'`. |

Després d'eliminar-les, el `style={{ color: 'var(--us-home-X-color)' }}` que ja existeix als inline styles guanya per especificitat CSS estàndard.

### 4.2 Distinció visual actiu/inactiu sense color

Un cop quitat el control de color via classes Tailwind, cada element manté la distinció actiu/inactiu per altres mitjans que **ja existeixen** al codi:

- **navTabs**: el botó actiu té `background-color: var(--th-accent)` (via classe `lib-nav-active`), els inactius `var(--th-bg-tertiary)`. El contrast del fons és suficient. La icona/text manté el mateix color del preset en ambdós estats.
- **breadcrumb**: la miga activa (última, no clickable) ja és `font-black` (peso 900), les inactives són pes normal. Diferenciació pel pes, no pel color.
- **tableHeader**: estat únic, no hi ha distinció a fer.

### 4.3 Per què no cal `!important`

S'ha verificat el `ThemeContext.tsx`: les regles que injecten color per a `text-white`, `text-gray-200`, `text-gray-400` (per ex. `[data-theme="light"] .text-white { color: #18181b; }`) **NO porten `!important`**. Un inline `style={{ color: ... }}` les guanya per la regla d'especificitat CSS estàndard (inline > selectors).

Això vol dir que **no cal cap acrobacia** (callback refs, `setProperty('important')`, `MutationObserver`). Només cal eliminar les classes Tailwind dels 3 elements i deixar que el `style` inline existent funcioni.

### 4.4 Lliçons del parpadeig (anti-patrons prohibits)

El parpadeig de la commit anterior va ser causat per `useImportantStyleRef` (callback refs que cridaven `setProperty('important')` a cada render). El fix de la commit `ef60b36` va ser:
1. Estabilitzar `UserStylesContext` amb `meRef` per trencar la cadena de re-renders.
2. Revertir tots els callback refs a inline `style={{}}`.

**Aquest disseny respecta totes dues regles**: cap callback ref nou, cap `setProperty`, cap dependència nova al context.

## 5. Components afectats

| Fitxer | Tipus de canvi | Línies aprox. |
|--------|----------------|---------------|
| `frontend/components/Library/SonilabLibraryView.tsx` | (a) Eliminar `text-white`/`text-gray-200` dels 4 botons navTabs. (b) Afegir `color: 'var(--us-home-navtabs-color)'` als 4 inline styles. (c) Canviar el `color` del wrapper del breadcrumb a `var(--us-home-breadcrumb-color)`. (d) Eliminar `text-gray-200`/`text-gray-400` de les migues del breadcrumb. (e) Eliminar `text-gray-500` del separador `/` entre migues (línia 925). (f) Canviar el `color` del header de taula a `var(--us-home-tableheader-color)`. | ~744-810, ~913, ~925, ~932-934, ~949 |
| `frontend/components/Settings/UserStyles/StyleAtomEditor.tsx` | Eliminar la prop `hideColor` i el placeholder buit. Render uniforme amb 4 columnes. | tot el fitxer |
| `frontend/components/Settings/UserStyles/HomeStylesPanel.tsx` | Eliminar `hideColor: true` de les 3 files. | línies 17-19 |
| `frontend/components/Settings/UserStyles/HomeStylePreview.tsx` | **Eliminar els overrides hardcodejats** del helper `cellStyle` per als 3 elements: `'#ffffff'` i `'#e5e7eb'` als 3 spans de navtabs (línies 26-28), `'var(--th-text-secondary)'` al breadcrumb (línia 30), `'var(--th-text-muted)'` al tableheader (línia 33). Després del canvi, la preview reflectirà el color real del preset. També actualitzar el comentari del header del fitxer (línies 4-12) que actualment diu que aquests 3 elements "llegeixen el color del tema admin a la UI real" — ja no és cert. | línies 4-12, 26-33 |

**Fitxers explícitament NO tocats** (per evitar reintroduir el parpadeig):
- `frontend/context/UserStyles/UserStylesContext.tsx`
- `frontend/context/UserStyles/applyUserStylesToDOM.ts`
- `frontend/context/UserStyles/factoryStyles.ts`
- `frontend/context/UserStyles/userStylesMigration.ts`
- `frontend/context/Theme/ThemeContext.tsx`
- `frontend/components/Library/LibraryFileItem.tsx`

## 6. Migració i compatibilitat

Cap canvi de schema. Els presets `v2` ja existents tenen els camps `color` per a `tableHeader`/`navTabs`/`breadcrumb`. La factory `FACTORY_HOME_STYLES` ja els defineix amb `var(--th-text-*)`. L'única diferència és que ara aquests colors **es veuran a la UI real** en lloc de ser ignorats.

Els usuaris que ja tenen presets guardats no notaran cap canvi visual fins que toquin el picker de color, perquè el color heretat seguirà sent `var(--th-text-*)`.

## 7. Tema admin vs preset d'usuari

Decisió: **el preset d'usuari sempre guanya**.

- Color per defecte (factory) = `var(--th-text-*)` → es resol contra el tema actual.
- Si l'usuari toca el picker, el valor passa a ser un hex fix (per exemple `#ff0000`) i ja no es resol contra el tema. Persisteix entre canvis de tema.
- Per tornar al color del tema, l'usuari ha de fer "Restablir per defecte" al `StylesPresetBar` (que recarrega la factory).

Això és coherent amb el principi que va expressar l'usuari: *"que lo que se edite en estilo prevalezca a lo que se ponga en Temas"*.

## 8. Verificació amb Playwright

Després d'implementar, executar aquests checks amb el plugin Playwright:

### 8.1 Test de no-regressió visual
1. Carregar la home amb `VITE_USE_BACKEND=1`.
2. Snapshot inicial.
3. Verificar amb `browser_snapshot` que els 4 botons navTabs, el breadcrumb i la cabecera de taula són visibles i tenen contrast llegible en els 3 temes (sonilab, dark, light).

### 8.2 Test anti-parpadeig (crític)
Aquest és el gat que ja vam tenir. Cal verificar que **NO** torna.
1. Carregar home, esperar 5 segons.
2. Executar via `browser_evaluate`:
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
3. **Criteri d'èxit**: ≤ 2 mutacions en 5 segons (1 inicial + tolerància). Si > 5 → fallar la verificació immediatament i revertir.

### 8.3 Test del color picker funcional
1. Obrir Configuració → Estils → Inici (per defecte ja és la pestanya activa).
2. Verificar que les 6 files tenen 4 columnes alineades (visualment uniformes).
3. Canviar el color de `tableHeader` a un valor reconeixible (ex. `#ff0000`).
4. Verificar via `browser_evaluate`:
   ```js
   getComputedStyle(document.documentElement).getPropertyValue('--us-home-tableheader-color');
   // ha de retornar '#ff0000' o similar
   ```
5. Tancar el modal, tornar a home, snapshot/screenshot per verificar visualment que la cabecera de taula està en vermell.
6. Repetir per `navTabs` amb `#00ff00` i `breadcrumb` amb `#0000ff`.

### 8.4 Test del ordre de pestanyes (ja fet, només confirmar)
- Verificar que l'ordre és: Inici → Editor de subtítols → Editor de guions.
- Verificar que "Inici" és la pestanya activa quan obres el modal.

### 8.5 Test de persistència
1. Canviar un color, esperar 2 segons (debounce backend = 1500ms).
2. Recarregar la pàgina (`browser_navigate` al mateix URL).
3. Verificar que el color persisteix llegint la CSS var.

### 8.6 Si Playwright no reprodueix el parpadeig al meu entorn
Demanar a l'usuari que executi el snippet del MutationObserver al seu entorn amb backend real, i compari resultats.

## 9. Riscos i mitigacions

| Risc | Probabilitat | Mitigació |
|------|-------------|-----------|
| Reintroduir el parpadeig per algun canvi col·lateral | Mitja | Cap canvi a `UserStylesContext` ni `applyUserStylesToDOM`. Test 8.2 obligatori. |
| Botó navTab actiu queda il·legible en tema light (icona fosca sobre fons accent fosc) | Baixa | Ja verificat: en tema light, el fons accent és blau clar i el text-primary és fosc → contrast suficient (ratio > 4.5:1). Si falla, ajustar la factory de `navTabs` a `var(--th-text-inverse)` per defecte. |
| Color picker emet hex inesperat | Molt baixa | El `<input type="color">` HTML5 sempre retorna `#rrggbb`. Cap validació addicional necessària. |
| L'usuari no entén que el seu canvi sobreescriu el tema | Baixa | Comportament intuïtiu i alineat amb el principi "preset prevaleix". El "Restablir per defecte" ja està al `StylesPresetBar`. |

## 10. Out-of-scope explícit

- Refactor d'altres elements del scope `subtitleEditor` o `scriptEditor`.
- Canvis al schema de `StyleAtom` (no afegim camps nous).
- Suport per a "color actiu vs inactiu" diferenciat.
- Animacions de transició quan canvia el color.
- Validació de contrast WCAG.

## 10.1 Limitacions conegudes (no són bugs)

- **Emojis no canvien de color**: els botons `Projectes` (📌) i `Media` (🎞️) usen emojis Unicode. El `color` CSS no afecta els emojis natius — sempre es renderitzen amb els seus colors propis del sistema. Només els icons SVG (`Files`/`Folder`, `Paperera`/`Trash`) canvien de color via `currentColor`. **Aquesta és una limitació visual coneguda i no s'ha de tractar com un bug**. Si en el futur cal coherència visual, els emojis s'haurien de substituir per icons SVG dedicats — fora de l'abast d'aquest spec.
- **`font-black` de la miga activa del breadcrumb**: la última miga (no clickable) té la classe Tailwind `font-black` (peso 900) hardcodejada per diferenciar-la visualment de les inactives. Aquesta classe sobreescriu el `font-weight` heretat del wrapper. Conseqüència: si l'usuari activa "Negreta" al preset (peso 700), els inactius seran 700 i l'activa 900 — la diferència segueix sent visible. Si l'usuari desactiva "Negreta" (peso 400), els inactius seran 400 i l'activa 900 — diferència més marcada. Ambdós escenaris són correctes; **no cal eliminar `font-black`** perquè el comportament és coherent amb el principi de diferenciació actiu/inactiu pel pes.

## 11. Criteris d'acceptació

1. ✅ Les 6 files del `HomeStylesPanel` tenen 4 columnes alineades.
2. ✅ El color picker funciona per a `tableHeader`, `navTabs` i `breadcrumb`.
3. ✅ El color editat pel preset es veu a la home real (no només a la preview).
4. ✅ El color persisteix entre recàrregues amb backend actiu.
5. ✅ El test 8.2 (anti-parpadeig) passa: ≤ 2 mutacions de `style` en 5 segons.
6. ✅ Els 3 temes (sonilab, dark, light) renderitzen els 3 elements de manera llegible amb la factory per defecte.
7. ✅ TypeScript build manté els 6 errors baseline (no afegir-ne de nous).

---

**Autoritzacions necessàries**: cap. Tot el treball és local al frontend, sense canvis de schema, sense canvis de backend.
