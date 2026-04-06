# User Styles — Fix Flicker and Colors Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar el parpadeo continuo del Home que aparece al abrir el panel de configuración de estilos (y al editar colores), y arreglar los colores por defecto que quedan ilegibles cuando el usuario activa el tema claro — garantizando que los estilos del usuario prevalezcan sobre el tema admin sin pelearse con él.

**Architecture:** Tres causas raíz identificadas, tres fixes quirúrgicos:

1. **Loop de aplicación al DOM** en `UserStylesContext.tsx`: el `useEffect([me])` vuelve a ejecutar `loadOrMigrate` cada vez que el objeto `me` de AuthContext cambia de identidad (cualquier mutación en Auth), y como el backend merge actual NO devuelve `preferences.userStyles` dentro del `me` del React state, la rama `remote === null` se dispara repetidamente sobreescribiendo el payload actual del usuario con el factory. La solución es **bloquear la migración inicial a un único trigger por userId** usando un `useRef<Set<string>>` — se migra exactamente UNA vez por sesión y usuario.

2. **Colores por defecto hardcoded rotos en tema claro**: `LibraryFileItem.tsx` y `SonilabLibraryView.tsx` (tras Tasks 13 y 14 de la rama `feat/user-styles`) usan inline styles con hex fijos (`#f3f4f6`, `#9ca3af`, etc.) para los elementos que NO tienen `hideColor` — y esos hex están calibrados para tema oscuro. `injectThemeOverrides()` del `ThemeContext` solo rescribe classes Tailwind, no inline styles, así que el tema claro queda con letra gris clara sobre fondo blanco. La solución es **cambiar los valores por defecto del factory a las variables `var(--th-text-*)` del tema** — los inline styles heredarán dinámicamente el color correcto del tema activo, y los usuarios que personalicen un color a un hex fijo lo mantendrán como override explícito.

3. **Preset por defecto ya guardado con valores hex** (usuarios que ya arrancaron con la rama nueva): hay que invalidar esos valores solo cuando todavía coinciden con el hex hardcoded obsoleto, para no pisar personalizaciones reales del usuario. Se hace con un bumpeo controlado de `version` en el payload y una migración de `version: 1 → version: 2`.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, patrón de contexto existente (ThemeContext + UserStylesContext).

**Spec de referencia:** [docs/superpowers/specs/2026-04-06-user-styles-design.md](../specs/2026-04-06-user-styles-design.md)

**Reglas heredadas (de `frontend/CLAUDE.md`):**
- No romper navegación entre tabs, selección múltiple, modales ni vistas existentes.
- Cambios pequeños, verificables, reversibles.
- No tocar módulos no relacionados.

**Verificación:** tras cada tarea:
- `cd frontend && npx tsc --noEmit 2>&1 | wc -l` — baseline actual: **6 errores TS** pre-existentes. El conteo no debe aumentar.
- `cd frontend && npm run build` — debe pasar OK.
- Al final, verificación manual con **Playwright MCP** (Task 8).

---

## Phase A — Fix del loop de aplicación al DOM

### Task 1: Bloquear `loadOrMigrate` a un único trigger por userId

**Files:**
- Modify: `frontend/context/UserStyles/UserStylesContext.tsx:143-154`

**Causa raíz:** el `useEffect([me])` dispara `loadOrMigrate` cada vez que el objeto `me` cambia de identidad en React (cualquier re-render del AuthContext donde se recrea `me`). Como `api.updateMe` en el frontend **no refresca `me` con el backend response**, `me.preferences.userStyles` sigue siendo `null` en el state de React. Eso significa que cada trigger del useEffect entra en la rama `remote === null`, construye el factory y llama `setPayload(factory)` — **sobreescribiendo lo que el usuario acabe de editar**. Combinado con el `useEffect([payload])` que aplica al DOM, esto produce el parpadeo visible.

- [ ] **Step 1: Añadir un ref para trackear migraciones por userId**

Localiza en `frontend/context/UserStyles/UserStylesContext.tsx` las líneas 113-116:

```ts
  const [payload, setPayload] = useState<UserStylesPayload>(() =>
    buildInitialPayload({ legacy: readLegacyEditorStyles() }),
  );
  const debounceRef = useRef<number | null>(null);
```

Añade después de `debounceRef`:

```ts
  /**
   * Set d'userIds que ja han passat per `loadOrMigrate` en aquesta sessió.
   * Evita re-executar la migració cada cop que l'objecte `me` canvia
   * d'identitat (cosa que passa en qualsevol mutació de AuthContext i
   * pisaria les edicions recents de l'usuari).
   */
  const migratedUserIds = useRef<Set<string>>(new Set());
```

- [ ] **Step 2: Guardar el useEffect de carga inicial/migración**

Localiza el useEffect actual (líneas 143-154 aprox.):

```ts
  // Càrrega inicial / migració quan entra el perfil.
  useEffect(() => {
    if (!me) return;
    const remote: UserStylesPayload | null = (me as any)?.preferences?.userStyles ?? null;
    const scopedLocal = readScopedLocal(me.id);
    const legacy = readLegacyEditorStyles();
    const result = loadOrMigrate({ remote, scopedLocal, legacy });
    setPayload(result.payload);
    if (result.needsPush && USE_BACKEND) {
      api.updateMe({ preferences: { userStyles: result.payload } }).catch(() => {});
    }
  }, [me]);
```

Sustitúyelo por:

```ts
  // Càrrega inicial / migració — només una vegada per userId i per sessió.
  // Si `me` canvia d'identitat (qualsevol mutació a AuthContext) però el userId
  // ja ha estat migrat, no fem res: l'estat actual del payload ja és la font
  // de veritat fins que l'usuari faci logout o recarregui la pàgina.
  useEffect(() => {
    if (!me?.id) return;
    if (migratedUserIds.current.has(me.id)) return;
    migratedUserIds.current.add(me.id);

    const remote: UserStylesPayload | null = (me as any)?.preferences?.userStyles ?? null;
    const scopedLocal = readScopedLocal(me.id);
    const legacy = readLegacyEditorStyles();
    const result = loadOrMigrate({ remote, scopedLocal, legacy });
    setPayload(result.payload);
    if (result.needsPush && USE_BACKEND) {
      api.updateMe({ preferences: { userStyles: result.payload } }).catch(() => {});
    }
  }, [me?.id]);
```

Notas del canvi:
- La dependency pasa de `[me]` a `[me?.id]` (primitiva → estable).
- `migratedUserIds.current.has(me.id)` bloquea re-ejecuciones en la misma sesión.
- Al hacer logout + login con otro usuario, el set persiste — pero el `me.id` nuevo no está en el set, así que migra correctamente.

- [ ] **Step 3: Limpiar el set de migraciones cuando el usuario hace logout**

Añade un segundo useEffect justo DESPUÉS del useEffect anterior:

```ts
  // Quan l'usuari fa logout, netegem el set de migracions perquè un login
  // posterior amb el mateix userId torni a llegir el backend.
  useEffect(() => {
    if (me === null) migratedUserIds.current.clear();
  }, [me]);
```

- [ ] **Step 4: Type-check + build**

Run: `cd frontend && npx tsc --noEmit 2>&1 | wc -l`
Expected: **6** (baseline).

Run: `cd frontend && npm run build 2>&1 | tail -3`
Expected: build OK.

- [ ] **Step 5: Commit**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO"
git add frontend/context/UserStyles/UserStylesContext.tsx
git commit -m "fix(user-styles): evitar bucle de loadOrMigrate en canvis d'identitat de me

El useEffect de càrrega inicial depenia de [me], i cada mutació del
AuthContext que regenerava l'objecte me feia re-executar loadOrMigrate.
Com que api.updateMe no refresca me amb la resposta del backend,
me.preferences.userStyles queda sempre null en el state de React i la
branca \"remote === null\" construïa el factory i sobreescrivia les
edicions recents de l'usuari.

Solucio: bloquejar la migracio a un unic trigger per userId i per sessio
mitjan\u00e7ant un useRef<Set<string>>. En logout es neteja el set.
Dependency canvia de [me] a [me?.id] per reduir re-triggers innecessaris.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Evitar aplicar al DOM si el payload no ha canviat de contingut

**Files:**
- Modify: `frontend/context/UserStyles/UserStylesContext.tsx:118-122`

**Causa raíz adicional:** aunque Task 1 elimina el loop principal, cualquier re-render futuro del provider con el mismo `payload` por referencia ya no dispara `useEffect([payload])`, pero una defensa en profundidad es evitar re-escribir las CSS vars si el contingut no ha canviat. Es barato y blinda contra regressions futures.

- [ ] **Step 1: Memoitzar l'aplicació al DOM amb comparació de contingut**

Localiza en `frontend/context/UserStyles/UserStylesContext.tsx` el useEffect de la línia 118 aprox.:

```ts
  // Aplica al DOM en cada canvi.
  useEffect(() => {
    applyUserStylesToDOM(payload);
  }, [payload]);
```

Sustitúyelo per:

```ts
  // Aplica al DOM només quan el contingut serialitzat canvia.
  // Defensa addicional: si React ens dona un payload nou per referencia pero
  // amb el mateix contingut, no tornem a escriure les CSS vars.
  const lastAppliedPayloadRef = useRef<string>('');
  useEffect(() => {
    const serialized = JSON.stringify(payload);
    if (serialized === lastAppliedPayloadRef.current) return;
    lastAppliedPayloadRef.current = serialized;
    applyUserStylesToDOM(payload);
  }, [payload]);
```

- [ ] **Step 2: Type-check + build**

Run: `cd frontend && npx tsc --noEmit 2>&1 | wc -l`
Expected: **6**.

Run: `cd frontend && npm run build 2>&1 | tail -3`
Expected: build OK.

- [ ] **Step 3: Commit**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO"
git add frontend/context/UserStyles/UserStylesContext.tsx
git commit -m "fix(user-styles): saltar applyUserStylesToDOM si el contingut no ha canviat

Defensa en profunditat contra re-aplicacions innecessaries de les CSS
vars al DOM. Comparem el payload serialitzat contra l'ultima aplicacio;
si es identic, no tornem a escriure les propietats a :root.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase B — Colors per defecte que funcionen en tots els temes

### Task 3: Canviar el factory del home a CSS vars del tema

**Files:**
- Modify: `frontend/context/UserStyles/factoryStyles.ts:67-74`

**Causa raíz:** `FACTORY_HOME_STYLES` usa hex hardcoded (`#f3f4f6`, `#9ca3af`, etc.) que només funcionen en tema fosc. `injectThemeOverrides` del ThemeContext reescriu classes Tailwind amb `!important`, pero no pot tocar inline styles. Per tant al canviar a tema clar el text queda gris clar sobre fons blanc — il·legible. La solució és referenciar les CSS variables del tema (`var(--th-text-primary)`, etc.) com a valor per defecte, i deixar que el `color picker` del usuari guardi overrides hex només quan decideixi personalitzar.

- [ ] **Step 1: Actualitzar els factories de home i subtítols**

Localitza a `frontend/context/UserStyles/factoryStyles.ts` (línies 52-74):

```ts
export const FACTORY_SUBTITLE_STYLES: SubtitleEditorStyleSet = {
  content:        courier(14, '#e5e7eb'),
  timecode:       courier(10, '#9ca3af'),
  // idCps i charCounter usen `font-black` (900) en SegmentItem.tsx; bold (700) és la
  // millor aproximació amb el StyleAtom actual (que només té bold:boolean).
  idCps:          mono(11,    '#9ca3af', true),
  takeLabel:      sans(10,    '#ef4444', true),
  charCounter:    mono(11,    '#9ca3af', true),
  actionButtons:  sans(9,     '#9ca3af'),
};

/**
 * Reproduce el aspecto actual del home/llibreria (SonilabLibraryView.tsx,
 * LibraryFileItem.tsx).
 */
export const FACTORY_HOME_STYLES: HomeStyleSet = {
  fileName:     sans(14, '#f3f4f6'),
  formatLabel:  sans(10, '#6b7280', true),
  dateTime:     mono(10, '#9ca3af'),
  tableHeader:  sans(10, '#6b7280', true),
  navTabs:      sans(14, '#ffffff', true),
  breadcrumb:   sans(14, '#b8b8b8'),
};
```

Substitueix-ho per:

```ts
/**
 * Colors per defecte que deleguen en les CSS vars del tema admin.
 * D'aquesta manera, el factory es adaptable a qualsevol tema (sonilab,
 * dark, light, midnight) sense hard-codar hex. L'usuari pot seguir
 * personalitzant el color amb el color picker, i llavors el valor
 * guardat sera un hex fix (override explicit).
 */
export const FACTORY_SUBTITLE_STYLES: SubtitleEditorStyleSet = {
  content:        courier(14, 'var(--th-editor-text)'),
  timecode:       courier(10, 'var(--th-editor-timecode)'),
  // idCps i charCounter usen `font-black` (900) en SegmentItem.tsx; bold (700) és la
  // millor aproximació amb el StyleAtom actual (que només té bold:boolean).
  idCps:          mono(11,    'var(--th-editor-text-muted)', true),
  takeLabel:      sans(10,    'var(--th-accent-text)', true),
  charCounter:    mono(11,    'var(--th-editor-text-muted)', true),
  actionButtons:  sans(9,     'var(--th-editor-meta)'),
};

/**
 * Reproduce el aspecto actual del home/llibreria (SonilabLibraryView.tsx,
 * LibraryFileItem.tsx). Igual que FACTORY_SUBTITLE_STYLES, els colors
 * referencien les CSS vars del tema per adaptar-se a qualsevol tema actiu.
 */
export const FACTORY_HOME_STYLES: HomeStyleSet = {
  fileName:     sans(14, 'var(--th-text-primary)'),
  formatLabel:  sans(10, 'var(--th-text-muted)', true),
  dateTime:     mono(10, 'var(--th-text-secondary)'),
  tableHeader:  sans(10, 'var(--th-text-muted)', true),
  navTabs:      sans(14, 'var(--th-text-primary)', true),
  breadcrumb:   sans(14, 'var(--th-text-secondary)'),
};
```

Notes del canvi:
- `FACTORY_SCRIPT_STYLES` es queda igual (són colors editables del editor de guions, que es renderitzen sobre un fons blanc fix i estan lligats al contingut del guio, no al tema).
- Els valors dels CSS vars del tema (`--th-text-primary`, etc.) són definits per `ThemeContext.applyThemeToDOM` i estan disponibles en runtime — qualsevol tema (sonilab/light/dark/midnight) proporciona aquests tokens.

- [ ] **Step 2: Type-check + build**

Run: `cd frontend && npx tsc --noEmit 2>&1 | wc -l`
Expected: **6**.

Run: `cd frontend && npm run build 2>&1 | tail -3`
Expected: build OK.

- [ ] **Step 3: Commit**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO"
git add frontend/context/UserStyles/factoryStyles.ts
git commit -m "fix(user-styles): colors per defecte del home i subtitols deleguen al tema

Els hex hardcoded (#f3f4f6, #9ca3af, ...) funcionaven nomes en tema fosc.
En tema clar, el text quedava gris clar sobre fons blanc — illegible.

Substituim els hex per CSS vars del ThemeContext (var(--th-text-*),
var(--th-editor-*), etc.) perque els colors per defecte s'adaptin
dinamicament a qualsevol tema actiu. L'usuari pot seguir personalitzant
el color amb el color picker; en aquest cas es guardara un hex fix com a
override explicit.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Migració de payload v1 → v2 per a usuaris amb colors hex obsolets

**Files:**
- Modify: `frontend/types/UserStyles/userStylesTypes.ts:94-99`
- Modify: `frontend/context/UserStyles/userStylesMigration.ts`

**Causa raíz:** els usuaris que ja han guardat `snlbpro_user_styles_<userId>` o `user.preferences.userStyles` amb la versió anterior tenen el factory antic (hex) escrit dins. Si només canviem el factory, aquests usuaris seguiran veient els hex — i el bug de colors trencats persistirà per ells. Cal fer una migració de `version: 1 → version: 2` que **detecti els hex exactes del factory antic** i els substitueixi per les noves CSS vars, respectant qualsevol override manual.

- [ ] **Step 1: Bumpar la version del payload**

Localiza en `frontend/types/UserStyles/userStylesTypes.ts` la definició (línies 94-99):

```ts
export interface UserStylesPayload {
  version: 1;
  scriptEditor:    ScopeState<'scriptEditor'>;
  subtitleEditor:  ScopeState<'subtitleEditor'>;
  home:            ScopeState<'home'>;
}
```

Substitueix-ho per:

```ts
export interface UserStylesPayload {
  version: 2;
  scriptEditor:    ScopeState<'scriptEditor'>;
  subtitleEditor:  ScopeState<'subtitleEditor'>;
  home:            ScopeState<'home'>;
}
```

- [ ] **Step 2: Afegir migració v1 → v2 a `userStylesMigration.ts`**

Localiza el fitxer `frontend/context/UserStyles/userStylesMigration.ts`. Afegeix abans de la funció `loadOrMigrate` (aprox. línia 55) el següent bloc:

```ts
/**
 * Mapa dels hex hardcoded del factory antic (v1) cap a les CSS vars del
 * factory nou (v2). Es fa servir per migrar users que ja van guardar el
 * preset 'Per defecte' amb els valors obsolets del FACTORY v1.
 *
 * Qualsevol valor que NO estigui en aquest mapa es considera una
 * personalitzacio manual de l'usuari i es preserva intacte.
 */
const V1_HEX_TO_V2_THEMEVAR: Record<string, string> = {
  // Home (scope 'home')
  '#f3f4f6': 'var(--th-text-primary)',     // fileName
  '#6b7280': 'var(--th-text-muted)',       // formatLabel, tableHeader
  '#9ca3af': 'var(--th-text-secondary)',   // dateTime (i tambe subtitles)
  '#ffffff': 'var(--th-text-primary)',     // navTabs
  '#b8b8b8': 'var(--th-text-secondary)',   // breadcrumb
  // Subtitles (scope 'subtitleEditor')
  '#e5e7eb': 'var(--th-editor-text)',      // content
  // (#9ca3af ja esta mapejat a sobre — compartit entre home/subs)
  '#ef4444': 'var(--th-accent-text)',      // takeLabel
};

function migrateAtomColorsV1ToV2(atom: any): any {
  if (!atom || typeof atom !== 'object') return atom;
  const color = atom.color;
  if (typeof color !== 'string') return atom;
  const mapped = V1_HEX_TO_V2_THEMEVAR[color.toLowerCase()];
  if (!mapped) return atom;
  return { ...atom, color: mapped };
}

function migrateStyleSetV1ToV2(styles: any): any {
  if (!styles || typeof styles !== 'object') return styles;
  const next: any = {};
  for (const [key, atom] of Object.entries(styles)) {
    next[key] = migrateAtomColorsV1ToV2(atom);
  }
  return next;
}

function migratePresetsV1ToV2<S extends StyleScope>(state: ScopeState<S>): ScopeState<S> {
  return {
    activePresetId: state.activePresetId,
    presets: state.presets.map(p => ({
      ...p,
      styles: migrateStyleSetV1ToV2(p.styles),
    })) as UserStylePreset<S>[],
  };
}

/**
 * Migra un payload de v1 a v2. NomÃ©s toca els scopes 'subtitleEditor' i
 * 'home'; 'scriptEditor' queda intacte (els seus hex son colors editables
 * del text del guio, independents del tema).
 */
function migrateV1ToV2(payload: any): UserStylesPayload {
  return {
    version: 2,
    scriptEditor:   payload.scriptEditor,
    subtitleEditor: migratePresetsV1ToV2(payload.subtitleEditor),
    home:           migratePresetsV1ToV2(payload.home),
  };
}
```

- [ ] **Step 3: Enganxar la migració al flux de `loadOrMigrate`**

Encara a `userStylesMigration.ts`, localitza la funció `loadOrMigrate` (aprox. línia 70-90):

```ts
export function loadOrMigrate(args: {
  remote: UserStylesPayload | null | undefined;
  scopedLocal: UserStylesPayload | null;
  legacy: EditorStyles | null;
}): LoadOrMigrateResult {
  if (args.remote && args.remote.version === 1) {
    return { payload: args.remote, needsPush: false };
  }
  if (args.scopedLocal && args.scopedLocal.version === 1) {
    return { payload: args.scopedLocal, needsPush: true };
  }
  return { payload: buildInitialPayload({ legacy: args.legacy }), needsPush: true };
}
```

Substitueix-la per:

```ts
export function loadOrMigrate(args: {
  remote: UserStylesPayload | null | undefined;
  scopedLocal: UserStylesPayload | null;
  legacy: EditorStyles | null;
}): LoadOrMigrateResult {
  // Remote v2: usar tal cual.
  if (args.remote && (args.remote as any).version === 2) {
    return { payload: args.remote, needsPush: false };
  }
  // Remote v1: migrar i marcar needsPush perque el backend s'actualitzi.
  if (args.remote && (args.remote as any).version === 1) {
    return { payload: migrateV1ToV2(args.remote), needsPush: true };
  }
  // Cache local v2: usar tal cual, pero push al backend si USE_BACKEND.
  if (args.scopedLocal && (args.scopedLocal as any).version === 2) {
    return { payload: args.scopedLocal, needsPush: true };
  }
  // Cache local v1: migrar.
  if (args.scopedLocal && (args.scopedLocal as any).version === 1) {
    return { payload: migrateV1ToV2(args.scopedLocal), needsPush: true };
  }
  // Cap font valida: construir des del legacy o del factory.
  return { payload: buildInitialPayload({ legacy: args.legacy }), needsPush: true };
}
```

- [ ] **Step 4: Assegurar que `buildInitialPayload` emet version: 2**

Al mateix fitxer, localitza `buildInitialPayload`:

```ts
export function buildInitialPayload(opts: { legacy?: EditorStyles | null }): UserStylesPayload {
  const scriptStyles: ScriptEditorStyleSet = opts.legacy ?? FACTORY_SCRIPT_STYLES;

  return {
    version: 1,
    scriptEditor: {
      activePresetId: DEFAULT_PRESET_ID,
      presets: [defaultPresetFor<'scriptEditor'>(scriptStyles)],
    },
    ...
```

Canvia `version: 1` a `version: 2`:

```ts
  return {
    version: 2,
    scriptEditor: {
      activePresetId: DEFAULT_PRESET_ID,
      presets: [defaultPresetFor<'scriptEditor'>(scriptStyles)],
    },
    ...
```

- [ ] **Step 5: Type-check + build**

Run: `cd frontend && npx tsc --noEmit 2>&1 | wc -l`
Expected: **6**.

Run: `cd frontend && npm run build 2>&1 | tail -3`
Expected: build OK.

- [ ] **Step 6: Commit**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO"
git add frontend/types/UserStyles/userStylesTypes.ts frontend/context/UserStyles/userStylesMigration.ts
git commit -m "feat(user-styles): migracio v1 a v2 de payload per corregir colors fixos

Els users que ja van arrencar amb la versio anterior tenen el preset
'Per defecte' amb hex hardcoded (#f3f4f6, etc.) que no funcionen en tema
clar. Afegim migracio v1 a v2 que detecta els hex exactes del factory
antic i els substitueix per les noves CSS vars del tema. Els overrides
manuals de l'usuari (qualsevol valor fora del mapa) es preserven intactes.

Bumpem UserStylesPayload.version de 1 a 2 i actualitzem buildInitialPayload.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase C — Prioritat dels user styles sobre el tema

### Task 5: Garantir que els inline `var(--us-*-color)` prevaleixin sobre les CSS regles `text-*`

**Files:**
- Modify: `frontend/components/Library/LibraryFileItem.tsx` (3 elements: filename, format, dateTime)

**Causa raíz:** a `LibraryFileItem` els elements tenen `style={{ color: 'var(--us-home-filename-color)' }}`. Inline styles guanyen contra classes Tailwind en specificity normal, pero **NO** contra classes amb `!important` — i `injectThemeOverrides` aplica `!important` a moltes classes (ex. `[data-theme="light"] .text-gray-100 { color: #1c1c20; }`). Actualment els components no tenen `text-gray-100` al className, pero hi ha remanents de classes que podrien ser afectades per regles més amplies (`.text-gray-200`, etc.). Per garantir que els user styles sempre prevaleixin, els fem `!important` explicit a l'inline style mitjançant `setProperty(..., 'important')` via callback ref, o mes simple: usar `cssText` amb `!important` al style attribute. React 19 accepta `'color': 'var(...) !important'` dins un style object gracies al parseig modern.

- [ ] **Step 1: Crear un helper `importantStyle` per a les vars de user styles**

Afegeix al capçal de `frontend/components/Library/LibraryFileItem.tsx` (despres dels imports):

```ts
/**
 * Construeix un objecte `style` que força els valors amb `!important`
 * mitjançant un callback ref. React 19 no accepta `!important` dins
 * l'objecte style directament; l'unica manera programatica es cridar
 * `el.style.setProperty(prop, value, 'important')` sobre el node real.
 *
 * Aquest helper rep un objecte camelCase i retorna un ref callback que
 * aplica cada propietat com !important al primer render i quan canvi.
 */
function useImportantStyleRef(styles: Record<string, string | undefined>) {
  const ref = React.useCallback((el: HTMLElement | null) => {
    if (!el) return;
    for (const [key, value] of Object.entries(styles)) {
      if (value == null) continue;
      // Converteix camelCase → kebab-case (fontFamily → font-family)
      const kebab = key.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
      el.style.setProperty(kebab, value, 'important');
    }
    // Dependencia del contingut del objecte: re-aplica quan canvia
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(styles)]);
  return ref;
}
```

- [ ] **Step 2: Aplicar `useImportantStyleRef` als 3 elements tipogràfics**

Localitza dins el component `LibraryFileItem`, els tres `<span>` / `<div>` que apliquen user styles (aprox. línies 334, 347, 360 — poden variar lleugerament). El patró actual es:

```tsx
<span
  className="..."
  style={{
    fontFamily: 'var(--us-home-filename-family)',
    fontSize:   'var(--us-home-filename-size)',
    color:      isOrphanLnk ? '#6b7280' : (isLocked ? '#9ca3af' : 'var(--us-home-filename-color)'),
    fontWeight: 'var(--us-home-filename-weight)' as any,
    fontStyle:  'var(--us-home-filename-style)',
  }}
>{item.name}</span>
```

Al començament del component (dins `LibraryFileItem`), afegeix els 3 refs just després del destructuring de props:

```tsx
  const fileNameRef = useImportantStyleRef({
    fontFamily: 'var(--us-home-filename-family)',
    fontSize:   'var(--us-home-filename-size)',
    color:      isOrphanLnk ? '#6b7280' : (isLocked ? '#9ca3af' : 'var(--us-home-filename-color)'),
    fontWeight: 'var(--us-home-filename-weight)',
    fontStyle:  'var(--us-home-filename-style)',
  });

  const formatRef = useImportantStyleRef({
    fontFamily: 'var(--us-home-format-family)',
    fontSize:   'var(--us-home-format-size)',
    color:      'var(--us-home-format-color)',
    fontWeight: 'var(--us-home-format-weight)',
    fontStyle:  'var(--us-home-format-style)',
  });

  const dateTimeRef = useImportantStyleRef({
    fontFamily: 'var(--us-home-datetime-family)',
    fontSize:   'var(--us-home-datetime-size)',
    color:      'var(--us-home-datetime-color)',
    fontWeight: 'var(--us-home-datetime-weight)',
    fontStyle:  'var(--us-home-datetime-style)',
  });
```

Ara canvia els tres elements JSX:

**Element 1 — nom d'arxiu (line ~334):**
```tsx
<span
  ref={fileNameRef}
  className={`truncate ${isLocked ? 'italic' : ''} ${isRef ? 'opacity-80' : ''} ${isOrphanLnk ? 'line-through' : ''}`}
>{item.name}</span>
```

(Elimina l'atribut `style={{...}}` — ara es gestiona pel ref.)

**Element 2 — format label (line ~338):**
```tsx
<div
  ref={formatRef}
  className="flex items-center px-4 uppercase select-none truncate"
>
  {formatLabel}
</div>
```

**Element 3 — data/hora (line ~342):**

Aquest és més subtil perquè el contenidor exterior té el ref, pero els spans interns (`{formattedDate}` i `{formattedTime}`) han d'heretar. Com el ref aplica al contenidor i els hijos hereden `color`/`font*` via CSS inheritance, funciona:

```tsx
<div
  ref={dateTimeRef}
  className="hidden sm:flex items-center gap-2 select-none whitespace-nowrap px-4"
>
  <span>{formattedDate}</span>
  <span className="opacity-40">{formattedTime}</span>
</div>
```

- [ ] **Step 3: Type-check + build**

Run: `cd frontend && npx tsc --noEmit 2>&1 | wc -l`
Expected: **6**.

Run: `cd frontend && npm run build 2>&1 | tail -3`
Expected: build OK.

- [ ] **Step 4: Commit**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO"
git add frontend/components/Library/LibraryFileItem.tsx
git commit -m "fix(user-styles): garantir que LibraryFileItem aplica user styles amb !important

Els inline styles normals perden contra les classes !important que
injectThemeOverrides genera per al tema clar. Fem servir un callback ref
que crida el.style.setProperty(key, value, 'important') sobre els 3
elements tipografics (nom, format, data/hora), perque els user styles
sempre tinguin prioritat sobre el tema admin.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Mateix tractament per als elements del SonilabLibraryView

**Files:**
- Modify: `frontend/components/Library/SonilabLibraryView.tsx`

Els tres elements que ja llegeixen user styles a SonilabLibraryView (nav tabs, breadcrumb, table header) també necessiten el mateix tractament per garantir que els tipus/mides prevalguin en tots els temes. En aquest cas **no** toquem el color (els 3 tenen `hideColor` al panel), només family/size/weight/style.

- [ ] **Step 1: Importar/replicar el helper useImportantStyleRef**

Al principi de `frontend/components/Library/SonilabLibraryView.tsx`, desprès dels imports existents, afegeix (pots copiar-lo literalment de `LibraryFileItem.tsx` del Task 5, o importar-lo — recomanem **copiar-lo** per evitar dependencies cross-file en un fitxer ja gran):

```ts
/**
 * Force inline styles amb !important. Veure LibraryFileItem.tsx per al
 * raonament complert.
 */
function useImportantStyleRef(styles: Record<string, string | undefined>) {
  const ref = React.useCallback((el: HTMLElement | null) => {
    if (!el) return;
    for (const [key, value] of Object.entries(styles)) {
      if (value == null) continue;
      const kebab = key.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
      el.style.setProperty(kebab, value, 'important');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(styles)]);
  return ref;
}
```

- [ ] **Step 2: Aplicar el ref als 4 nav tabs**

Localitza els 4 botons de navegació Files/Projectes/Media/Paperera (línies ~743-805). Cada botó té un bloc `style={{...}}` amb family/size/weight/style. Per aprofitar el helper:

Afegeix un ref compartit abans del JSX:

```ts
  const navTabsRef = useImportantStyleRef({
    fontFamily: 'var(--us-home-navtabs-family)',
    fontSize:   'var(--us-home-navtabs-size)',
    fontWeight: 'var(--us-home-navtabs-weight)',
    fontStyle:  'var(--us-home-navtabs-style)',
  });
```

NO pots passar el mateix ref a 4 botons simultanis (React guarda l'última referència). En comptes, defineix un helper local:

```ts
  const applyNavTabsStyles = React.useCallback((el: HTMLElement | null) => {
    if (!el) return;
    el.style.setProperty('font-family', 'var(--us-home-navtabs-family)', 'important');
    el.style.setProperty('font-size',   'var(--us-home-navtabs-size)',   'important');
    el.style.setProperty('font-weight', 'var(--us-home-navtabs-weight)', 'important');
    el.style.setProperty('font-style',  'var(--us-home-navtabs-style)',  'important');
  }, []);
```

A cada dels 4 botons, elimina l'atribut `style={{ fontFamily: ..., fontSize: ..., ... }}` i afegeix `ref={applyNavTabsStyles}`.

Exemple del primer (Files):
```tsx
<button
  ref={applyNavTabsStyles}
  onClick={goLibrary}
  className={`px-2.5 py-2 rounded-lg transition-colors flex items-center justify-center
    ${(view === 'library' && page === 'library') ? 'text-white lib-nav-active' : 'text-gray-200 lib-nav-inactive'}
    ${isCollapsed ? 'w-10 h-10 !p-0' : ''}`}
  title="Files"
  aria-label="Files"
>
  <Icons.Folder className="w-4 h-4" />
</button>
```

Repeteix el mateix patró (canviar `style={{...}}` per `ref={applyNavTabsStyles}`) als 3 botons restants (Projectes, Media, Paperera).

- [ ] **Step 3: Aplicar el ref al breadcrumb**

Localitza el `<div>` del breadcrumb (línies ~908-919). Actualment:

```tsx
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

Afegeix abans del JSX un callback ref:

```ts
  const applyBreadcrumbStyles = React.useCallback((el: HTMLElement | null) => {
    if (!el) return;
    el.style.setProperty('font-family', 'var(--us-home-breadcrumb-family)', 'important');
    el.style.setProperty('font-size',   'var(--us-home-breadcrumb-size)',   'important');
    el.style.setProperty('font-weight', 'var(--us-home-breadcrumb-weight)', 'important');
    el.style.setProperty('font-style',  'var(--us-home-breadcrumb-style)',  'important');
  }, []);
```

I substitueix l'element:

```tsx
<div
  ref={applyBreadcrumbStyles}
  className="flex items-center gap-2 px-4 py-2 mb-2 mx-2 min-h-10"
  style={{
    color: 'var(--th-text-secondary)',
    borderBottom: '1px solid var(--th-border)',
  }}
>
```

(Nota: el color i el border es queden a l'atribut `style` normal perquè venen del tema i no tenen conflicte; només family/size/weight/style necessiten `!important`.)

- [ ] **Step 4: Aplicar el ref al table header**

Localitza el `<header>` de la taula (línies ~942-957):

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

Afegeix un callback ref:

```ts
  const applyTableHeaderStyles = React.useCallback((el: HTMLElement | null) => {
    if (!el) return;
    el.style.setProperty('font-family', 'var(--us-home-tableheader-family)', 'important');
    el.style.setProperty('font-size',   'var(--us-home-tableheader-size)',   'important');
    el.style.setProperty('font-weight', 'var(--us-home-tableheader-weight)', 'important');
    el.style.setProperty('font-style',  'var(--us-home-tableheader-style)',  'important');
  }, []);
```

I substitueix el `<header>`:

```tsx
<header
  ref={applyTableHeaderStyles}
  className="grid gap-0 items-center uppercase tracking-widest sticky top-0 z-30 py-2.5 mx-2"
  style={{
    color: 'var(--th-text-muted)',
    backgroundColor: 'var(--th-bg-secondary)',
    borderBottom: '1px solid var(--th-border)',
    gridTemplateColumns: gridColumns,
  }}
>
```

- [ ] **Step 5: Type-check + build**

Run: `cd frontend && npx tsc --noEmit 2>&1 | wc -l`
Expected: **6**.

Run: `cd frontend && npm run build 2>&1 | tail -3`
Expected: build OK.

- [ ] **Step 6: Commit**

```bash
cd "d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO"
git add frontend/components/Library/SonilabLibraryView.tsx
git commit -m "fix(user-styles): SonilabLibraryView aplica font user styles amb !important

Nav tabs, breadcrumb i table header fan servir callback refs per forcar
font-family/size/weight/style amb !important. El color dels 3 elements
es queda del tema (no personalitzable pel user).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase D — Verificació

### Task 7: Build final i TS check

- [ ] **Step 1: Build limpio**

Run: `cd frontend && npm run build 2>&1 | tail -10`
Expected: build OK sense nous warnings rellevants.

- [ ] **Step 2: Baseline TS intacte**

Run: `cd frontend && npx tsc --noEmit 2>&1 | wc -l`
Expected: **6**.

- [ ] **Step 3: Cap referència a `version: 1` residual als llocs que haurien de ser v2**

Run: `cd frontend && grep -rn "version: 1" context/UserStyles/ types/UserStyles/ 2>/dev/null`
Expected: cap resultat (tots els punts d'emissió han de ser `version: 2`). Els únics resultats acceptables son dins `userStylesMigration.ts` on es DETECTA v1 per migrar-lo (ex: `(args.remote as any).version === 1`).

Si trobes algun emisor que encara fa `version: 1`, torna al Task 4 i arregla-ho.

---

### Task 8: Verificació manual amb Playwright MCP

**Files:** (només lectura i navegació, cap modificació)

- [ ] **Step 1: Arrencar el dev server**

Run: `cd frontend && npm run dev`
(Deixa'l corrent en background. Agafa el port del output — normalment `:3000` o `:3001`.)

- [ ] **Step 2: Navegar al home amb Playwright**

Usant el tool `mcp__plugin_playwright_playwright__browser_navigate` amb la URL del pas anterior.

- [ ] **Step 3: Verificar que NO hi ha parpadeig al home**

Executa amb `mcp__plugin_playwright_playwright__browser_evaluate`:

```js
() => {
  const root = document.documentElement;
  const samples = [];
  const start = performance.now();
  return new Promise((resolve) => {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'style') {
          samples.push({
            t: Math.round(performance.now() - start),
            filename: root.style.getPropertyValue('--us-home-filename-size'),
          });
        }
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ['style'] });
    setTimeout(() => {
      observer.disconnect();
      resolve({
        totalChanges: samples.length,
        durationMs: Math.round(performance.now() - start),
        samples: samples.slice(0, 20),
      });
    }, 10000);
  });
}
```

Expected: `totalChanges <= 2` (un o dos canvis al principi per la migració inicial; després zero canvis durant 10 segons).

Si `totalChanges > 10` → el parpadeig segueix. Torna al Task 1/2 i investiga.

- [ ] **Step 4: Obrir Configuració → Estils → Inici i editar un tamany**

Amb `mcp__plugin_playwright_playwright__browser_click` sobre el botó "Configuració" i després navega a la pestanya "Estils" → sub-pestanya "Inici". Canvia la mida del "Nom d'arxiu" a 20px.

Expected: el canvi s'aplica immediatament al preview i al home darrere del modal, sense parpadeig ni valors que tornin enrere.

- [ ] **Step 5: Canviar el color del "Nom d'arxiu" a un color personalitzat**

Click sobre el input `type="color"` del "Nom d'arxiu" i introdueix un hex nou (p.ex. `#00ff00`). Si Playwright no pot interactuar amb el color picker directament, usa `browser_evaluate`:

```js
() => {
  const inputs = document.querySelectorAll('input[type="color"]');
  const target = inputs[0]; // primer color picker visible
  target.value = '#00ff00';
  target.dispatchEvent(new Event('input', { bubbles: true }));
  target.dispatchEvent(new Event('change', { bubbles: true }));
  return { count: inputs.length, newValue: target.value };
}
```

Expected: el preview canvia al verd; el nom d'arxiu al home també canvia al verd. NO hi ha parpadeig.

- [ ] **Step 6: Canviar de tema a "Clar" i verificar que els textos son llegibles**

Click a la pestanya "Tema" del modal de configuració. Click al botó del tema "Claro".

Expected: el fons canvia a blanc. El nom d'arxiu a la llibreria (darrere del modal) es llegeix correctament: si el user no havia personalitzat el color, es veu en color fosc sobre fons blanc (heredat del tema clar via `var(--th-text-primary)`).

Si al seleccionar tema clar el text del nom d'arxiu encara es veu gris claro → la Task 3 (factory) o la Task 4 (migració) han fallat.

- [ ] **Step 7: Tancar el dev server**

Cancel el background shell que té el `npm run dev`.

---

## Resum d'arxius modificats

**Modificats:**
- `frontend/context/UserStyles/UserStylesContext.tsx` (Tasks 1, 2)
- `frontend/context/UserStyles/factoryStyles.ts` (Task 3)
- `frontend/context/UserStyles/userStylesMigration.ts` (Task 4)
- `frontend/types/UserStyles/userStylesTypes.ts` (Task 4)
- `frontend/components/Library/LibraryFileItem.tsx` (Task 5)
- `frontend/components/Library/SonilabLibraryView.tsx` (Task 6)

**Sense canvis:** cap altre component, cap altre context, cap altre fitxer de Setting/UserStyles/ (els panels, StyleAtomEditor, previews segueixen igual).

## Criteris d'acceptació

1. **Sense parpadeig** al home amb backend=1 i el modal de configuració obert.
2. **Edició en viu fluida**: canviar mida/color de qualsevol element reflecteix immediatament sense flickers ni valors que reverteixin.
3. **Tema clar llegible**: canviar a tema clar mostra el text del home en colors llegibles sobre fons blanc, sense que l'usuari hagi de fer res.
4. **Els user styles prevaleixen** sobre el tema quan hi ha override explicit: si l'usuari posa color verd a "Nom d'arxiu", el nom es verd en qualsevol tema.
5. **Backward compat**: usuaris amb un `snlbpro_user_styles_<userId>` existent de versió v1 reben automàticament la migració v1→v2 sense perdre cap personalització que hagin fet (qualsevol color fora del mapa de hex-antics es preserva).
6. **Baseline TS mantingut**: `npx tsc --noEmit` segueix retornant 6 errors pre-existents, ni més ni menys.
