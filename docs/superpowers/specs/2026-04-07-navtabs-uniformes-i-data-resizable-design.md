# navTabs uniformes i columna DATA I HORA resizable — Design

**Data:** 2026-04-07
**Autor:** Marc Domínguez (amb assistència de Claude)
**Branch objectiu:** `feat/user-styles`
**Cicle anterior:** Color picker per a navTabs/breadcrumb/tableHeader (Tasks 1-8 ja merged a la branca)

---

## 1. Context i problema

Després del cicle anterior (que va habilitar el color picker per als 3 elements del scope `home`), la verificació visual va detectar 2 issues que NO formaven part de l'àmbit original:

### Issue #1 — Mides desiguals dels 4 botons navTabs

Els 4 botons `Files`, `Projectes`, `Media`, `Paperera` mostren contingut heterogeni:

| Botó | Contingut actual | Tipus | Escala amb font-size? |
|------|-----------------|-------|----------------------|
| Files | `<Icons.Folder className="w-4 h-4" />` | SVG amb mida fixa | NO |
| Projectes | `<span>📌</span>` | Emoji Unicode | SÍ |
| Media | `<span>🎞️</span>` | Emoji Unicode | SÍ |
| Paperera | `<Icons.Trash className="w-4 h-4" />` | SVG amb mida fixa | NO |

Quan l'usuari canvia el preset `home.navTabs` a una mida gran (per ex. 24px), els botons amb emojis creixen però els botons amb SVG no. Resultat visual: 2 botons grans, 2 botons petits, mateixa fila.

### Issue #2 — Columna "DATA I HORA" amb amplada fixa

A `frontend/components/Library/SonilabLibraryView.tsx:730`:

```ts
const gridColumns = `32px ${nameColWidth}px ${formatColWidth}px 140px 40px`;
```

La columna DATA I HORA està hardcoded a `140px`. Les altres dues columnes editables (Nom i Format) sí són resizable amb el ratolí. Quan l'usuari posa el preset `home.dateTime` a una mida gran, el text de la columna no cap en 140px i el header "DATA I HORA" queda enganxat al text dels valors de les files.

## 2. Objectius

1. Fer que els 4 botons navTabs tinguin sempre la mateixa mida visual, escalant uniformement amb el preset `home.navTabs`.
2. Fer que la columna "DATA I HORA" sigui resizable amb el ratolí, amb el mateix patró que les columnes Nom i Format.
3. **No reintroduir el parpadeig** que es va arreglar al cicle anterior.
4. **No tocar el botó "Crear projecte"** ni cap dels botons d'acció del toolbar lateral — són un cicle dedicat futur.

## 3. No-objectius

- Tocar el botó "Crear projecte" / "Crear carpeta" / "Importar fitxer". Aquests són botons d'acció del toolbar i no formen part del scope `home.navTabs`. Si es vol fer que també escalin, serà un cicle propi amb un nou atom (probablement `home.toolbarButtons`) — fora de l'àmbit d'aquest spec.
- Persistir l'amplada de DATA I HORA entre recàrregues. Coherent amb el patró existent (`nameColWidth` i `formatColWidth` tampoc no es persisteixen).
- Auto-recalcular l'amplada de DATA I HORA segons el preset. L'usuari sempre la controla manualment.
- Tocar `userStylesTypes.ts`, `factoryStyles.ts`, `applyUserStylesToDOM.ts`, `userStylesMigration.ts`, `UserStylesContext.tsx`, `ThemeContext.tsx`, `LibraryFileItem.tsx`. Tots aquests són fitxers prohibits per evitar reintroduir el parpadeig.
- Afegir `!important`, `setProperty('important')`, `MutationObserver`, callback refs, `useImportantStyleRef`. Tots són anti-patrons coneguts.

## 4. Decisions de disseny

### 4.1 Issue #1 — Tots els navTabs com a SVG amb `w-[1em] h-[1em]`

**Decisió**: substituir els 2 emojis (📌, 🎞️) per SVG dedicats nous (`Icons.Pin`, `Icons.Film`) i fer que els 4 SVG escalin amb font-size via `w-[1em] h-[1em]`.

**Per què**: el `1em` és el "100% del font-size del pare". El pare de l'SVG és el `<button>` que ja té `font-size: var(--us-home-navtabs-size)` al seu inline style (gràcies a Task 4 del cicle anterior). Per tant `1em` resol al valor del preset, i tots 4 botons creixen al mateix temps.

**Per què no `1em` només als SVG existents (sense afegir Pin/Film)**:
- Si deixéssim els emojis com a `<span>`, encara hi hauria diferències visuals subtils perquè els emojis Unicode tenen padding intern propi del font del sistema operatiu.
- Substituir-los per SVG garanteix uniformitat 100% i, a més, els fa **monocrom amb `currentColor`** — així respecten el sistema de color del preset (l'`color: var(--us-home-navtabs-color)` que es va aplicar al cicle anterior).

**Alternatives descartades**:
- Mantenir SVG fix i centrar tots els botons en altura: no resol el problema d'arrel.
- Substituir tots a emojis: trenca el sistema de color del preset (els emojis ignoren el `color` CSS).
- Modificar `Icons.tsx` perquè acceptin un `style` prop: fora d'àmbit i toca un component compartit.

### 4.2 Issue #2 — Replicar el patró `nameColWidth`/`formatColWidth`

**Decisió**: afegir un nou estat `dateColWidth` i un handler `handleResizeDateMouseDown` còpia literal dels existents per a Nom i Format.

**Per què**: el patró ja és conegut i provat al codi. La sol·lució és **isomòrfica** als handlers existents — risc mínim de regressió. L'overflow horitzontal **ja existeix** al wrapper (`<div className="flex-1 overflow-auto custom-scrollbar">` a la línia 948), per tant no cal afegir cap CSS nou per al scroll.

**Min/max**: proposem `min: 80px`, `max: 300px`. Mateix rang d'escala que `formatCol` (60-250) ajustat al fet que el contingut és més llarg ("DATA I HORA" + valors com "06/04/2026 14:23").

**Per defecte**: 140px (igual que ara) — cap regressió per a usuaris que no tocaran el handle.

**Per què NO persistir-la**:
- Coherència amb el patró existent (`nameCol` i `formatCol` tampoc no es persisteixen).
- Persistir-la requeriria afegir un key nou a `LOCAL_STORAGE_KEYS` o tocar el `userStylesTypes.ts`. Tots dos són ampliacions massives de l'àmbit.

## 5. Components afectats

| Fitxer | Tipus de canvi | Detall |
|--------|----------------|--------|
| `frontend/components/icons.tsx` | Modificar (afegir 2 exports) | Afegir `Pin` (SVG d'una xinxeta) i `Film` (SVG d'una claqueta o film strip) seguint el mateix patró que `Folder` i `Trash`. Ambdós usen `stroke="currentColor"` per heretar el color CSS. |
| `frontend/components/Library/SonilabLibraryView.tsx` | Modificar (6 canvis localitzats) | (a) Substituir `<Icons.Folder className="w-4 h-4" />` per `<Icons.Folder className="w-[1em] h-[1em]" />` (línia ~759). (b) Substituir `<span>📌</span>` per `<Icons.Pin className="w-[1em] h-[1em]" />` (línia ~775). (c) Substituir `<span>🎞️</span>` per `<Icons.Film className="w-[1em] h-[1em]" />` (línia ~792). (d) Substituir `<Icons.Trash className="w-4 h-4" />` per `<Icons.Trash className="w-[1em] h-[1em]" />` (línia ~813). (e) Afegir `useState dateColWidth = 140` i `handleResizeDateMouseDown` (~línies 88-180). (f) Modificar `gridColumns` per usar `${dateColWidth}px` en lloc de `140` (línia ~730). (g) Convertir el `<div>` de la columna DATA I HORA del header en un `relative group/header` i afegir el `<div onMouseDown={handleResizeDateMouseDown}>` resize handle (línies ~984-986). |

**Fitxers explícitament NO tocats** (per evitar reintroduir el parpadeig):
- `frontend/context/UserStyles/UserStylesContext.tsx`
- `frontend/context/UserStyles/applyUserStylesToDOM.ts`
- `frontend/context/UserStyles/factoryStyles.ts`
- `frontend/context/UserStyles/userStylesMigration.ts`
- `frontend/context/Theme/ThemeContext.tsx`
- `frontend/components/Library/LibraryFileItem.tsx` (les files fan referència al mateix `gridColumns` que es passa com a prop des de `SonilabLibraryView.tsx`, per tant no cal tocar res)

## 6. Comportament esperat

### Issue #1 — navTabs

**Estat per defecte (font-size = 14px)**:
- Tots 4 botons amb la mateixa alçada (~28-32px amb el `py-2` i el padding intern)
- Tots 4 icons SVG renderitzen a 14px amb `currentColor` (que resol a `var(--us-home-navtabs-color)`)

**Quan l'usuari canvia el preset a font-size = 30px**:
- Tots 4 botons creixen al mateix temps (~58-62px d'alçada)
- Tots 4 icons creixen a 30px de mida visual
- Manten 100% d'uniformitat

**Quan l'usuari canvia el color del preset (per ex. a #ff0000)**:
- Els 4 SVG es renderitzen en vermell (gràcies a `currentColor` heretat de `color: var(--us-home-navtabs-color)`)
- Comportament idèntic al cicle anterior — cap regressió

### Issue #2 — DATA I HORA resizable

**Estat per defecte**:
- `dateColWidth = 140px` (idèntic a abans)
- L'usuari NO nota cap canvi al primer reload

**Quan l'usuari arrossega el handle**:
- Cursor canvia a `cursor-col-resize` quan passa per sobre del handle
- L'amplada s'ajusta entre 80px (mín) i 300px (màx)
- El botó "..." (40px) sempre roman a la dreta de DATA I HORA
- Si la suma total excedeix l'amplada del contenidor, apareix scroll horitzontal automàtic (ja existent)

**Recuperar el handle si es perd**:
- L'usuari fa scroll horitzontal a la dreta amb el ratolí o trackpad
- Veu la columna DATA I HORA, el seu handle a la dreta, i la columna del menú "..."
- Tot continua accessible

**Persistència**:
- L'amplada **no es persisteix entre recàrregues** (igual que `nameColWidth`/`formatColWidth`)
- Coherent amb el patró existent

## 7. Verificació

Per què no fem Playwright en aquest cicle: la verificació manual del cicle anterior va ser més efectiva i ràpida. Aquest cicle també es verificarà manualment per l'usuari.

### 7.1 TypeScript build (automàtic, en cada Task del plan)
```bash
cd frontend && npx tsc --noEmit
```
Esperat: 6 errors baseline. Cap de nou.

### 7.2 Test anti-parpadeig (manual amb snippet)
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

Esperat: ≤ 2 mutacions en 5 segons.

**Important**: si l'usuari l'executa múltiples vegades sense tancar DevTools, els observers s'acumulen i el comptador creix exponencialment. Cal una sola execució per a un mesurament vàlid.

### 7.3 Visual a la home (manual)

**Issue #1**:
1. Anar a la home amb preset per defecte
2. Verificar que els 4 botons (Files / Projectes / Media / Paperera) tenen exactament la mateixa alçada i amplada
3. Anar a Configuració → Estils → Inici → "Pestanyes navegació", canviar mida a 24px
4. Verificar que els 4 botons han crescut **uniformement**
5. Tornar a la mida per defecte amb "Restablir"

**Issue #2**:
1. Posicionar el ratolí a la vora dreta de "DATA I HORA" — el cursor ha de canviar a `cursor-col-resize`
2. Arrossegar a la dreta — la columna s'amplia, els valors es veuen amb més espai
3. Arrossegar a l'esquerra fins al mínim (80px)
4. Verificar que la columna "..." segueix visible (40px a la dreta)
5. Arrossegar a la dreta fins al màxim (300px)
6. Verificar que apareix scroll horitzontal i que tot continua accessible
7. Reload de la pàgina → l'amplada torna al valor per defecte (140px) — esperat

### 7.4 No regressió de Tasks 1-6 del cicle anterior
- El color picker dels 3 elements (navTabs, breadcrumb, tableHeader) **segueix funcionant**
- Cap canvi visual als botons "Crear projecte" / "Crear carpeta" / "Importar fitxer"
- El breadcrumb i la cabecera de taula es veuen igual que abans

## 8. Riscos i mitigacions

| Risc | Probabilitat | Mitigació |
|------|-------------|-----------|
| El SVG `Pin` o `Film` amb path inadequat queda visualment diferent dels altres | Baixa | El plan inclourà paths basats en el Heroicons / Lucide style ja present a `Folder`/`Trash`. Si visualment no encaixen, l'usuari pot ajustar-los al moment. |
| `1em` no escala bé en algun navegador | Molt baixa | `em` és CSS bàsic, suportat per tots els navegadors moderns. Ja s'usa a milions de pàgines. |
| El nou `dateColWidth` causa un error de TypeScript per algun motiu | Molt baixa | El patró és literalment una còpia del que ja existeix per a `formatColWidth`. Si funciona allà, funcionarà aquí. |
| L'usuari arrossega DATA I HORA fora de la vista | Baixa | El scroll horitzontal del wrapper ja existeix. L'usuari pot fer scroll per recuperar-lo. Documentat al verificació 7.3. |
| Canvis a `icons.tsx` afecten altres parts de l'app | Molt baixa | Només **afegim** 2 exports nous (Pin, Film). No modifiquem cap dels existents. Els icons existents segueixen igual. |
| Reintroducció del parpadeig | Molt baixa | Cap fitxer prohibit tocat. Cap patró prohibit. Test 7.2 obligatori. |

## 9. Out-of-scope explícit

- Fer escalar els botons "Crear projecte" / "Crear carpeta" / "Importar fitxer" amb el preset.
- Persistir l'amplada de DATA I HORA al backend o al localStorage.
- Auto-recalcular l'amplada segons el preset.
- Tocar els altres scopes de User Styles (`scriptEditor`, `subtitleEditor`).
- Modificar el component `Icons.tsx` per acceptar `style` props.
- Substituir altres emojis del codi (per ex. els icons de drag, els emojis dels file types a `getFileIcon` de `LibraryFileItem.tsx`).

## 10. Criteris d'acceptació

1. ✅ Els 4 botons navTabs tenen la mateixa mida visual amb qualsevol valor del preset `home.navTabs.fontSize`.
2. ✅ Els 4 botons navTabs hereten correctament el color del preset (no regressió respecte a Tasks 1-6 del cicle anterior).
3. ✅ La columna DATA I HORA és resizable amb el ratolí amb el mateix patró que Nom i Format.
4. ✅ El handle de DATA I HORA respecta el mín 80px i màx 300px.
5. ✅ El test anti-parpadeig (verificació 7.2) passa: ≤ 2 mutacions de `style` en 5 segons.
6. ✅ El TypeScript build manté els 6 errors baseline (cap de nou).
7. ✅ Cap fitxer prohibit tocat. Cap patró prohibit introduït.
8. ✅ Cap regressió a Tasks 1-6 del cicle anterior (verificació 7.4).

---

**Autoritzacions necessàries**: cap. Tot el treball és local al frontend, sense canvis de schema, sense canvis de backend.
