# User Styles — Diseño

**Fecha**: 2026-04-06
**Estado**: Validado por el usuario, pendiente de plan de implementación
**Alcance**: Refactor del panel de configuración para introducir una pestaña "Estils" con sub-pestañas (Editor de guions, Editor de subtítols, Inici), presets por usuario persistidos en backend y refactor de fragilidad del editor de subtítulos.

---

## 1. Motivación

El panel de configuración actual tiene una pestaña "Estils Editor" que solo afecta al editor de guiones. Se necesita:

- Permitir que el usuario personalice tipografía, tamaño y color de elementos de **tres zonas** distintas: editor de guiones, editor de subtítulos y home/llibreria.
- Soportar **accesibilidad visual** (usuarios con problemas de visión que necesitan letra más grande).
- Guardar la configuración **en la cuenta del usuario** (no solo en el navegador) para que viaje entre dispositivos.
- Permitir **presets nombrados** por sub-pestaña (ej. "Lectura gran", "Compacte"), gestionados como JSON.
- Garantizar que cambiar tamaños de fuente **no rompa los layouts** existentes (especialmente en el editor de subtítulos, que es el más frágil).

Los temas globales (admin, oscuro/claro/etc.) **no se tocan**: siguen siendo responsabilidad de `ThemeContext` y afectan a toda la app por igual. Los estilos del usuario son una capa **independiente** y específica del usuario.

## 2. Naming y ubicación

| Elemento | Catalán (canon) |
|---|---|
| Pestaña raíz | "Estils" (sustituye a "Estils Editor") |
| Sub-pestaña 1 | "Editor de guions" |
| Sub-pestaña 2 | "Editor de subtítols" |
| Sub-pestaña 3 | "Inici" |

Se mantiene coherencia con el resto del modal (catalán: General, Tema, Dreceres, Lector).

## 3. Modelo de datos

Un único objeto JSON serializable, almacenado en `user.preferences.userStyles`:

```ts
// frontend/types/UserStyles/userStylesTypes.ts

export interface StyleAtom {
  fontFamily: string;
  fontSize: number;       // px
  color: string;          // #rrggbb
  bold: boolean;
  italic: boolean;
}

export interface ScriptEditorStyleSet {
  take: StyleAtom;
  speaker: StyleAtom;
  timecode: StyleAtom;
  dialogue: StyleAtom;
  dialogueParentheses: StyleAtom;
  dialogueTimecodeParentheses: StyleAtom;
}

export interface SubtitleEditorStyleSet {
  content: StyleAtom;        // texto editable del subtítulo
  timecode: StyleAtom;       // IN/OUT en TimecodeInput
  idCps: StyleAtom;          // ID y CPS
  takeLabel: StyleAtom;      // etiqueta TAKE
  charCounter: StyleAtom;    // contador de caracteres
  actionButtons: StyleAtom;  // barra de acciones de la fila
}

export interface HomeStyleSet {
  fileName: StyleAtom;       // nombre de archivo/carpeta
  formatLabel: StyleAtom;    // SNLBPRO, SRT, LNK…
  dateTime: StyleAtom;       // fecha y hora
  tableHeader: StyleAtom;    // capçalera Nom/Format/Data
  navTabs: StyleAtom;        // Files/Projectes/Media/Paperera
  breadcrumb: StyleAtom;     // ruta superior
}

export type StyleScope = 'scriptEditor' | 'subtitleEditor' | 'home';

export interface StyleSetMap {
  scriptEditor: ScriptEditorStyleSet;
  subtitleEditor: SubtitleEditorStyleSet;
  home: HomeStyleSet;
}

export interface UserStylePreset<S extends StyleScope = StyleScope> {
  id: string;            // nanoid
  name: string;          // editable por el usuario
  builtin?: boolean;     // true para 'Per defecte' (no borrable, no renombrable)
  styles: StyleSetMap[S];
}

export interface ScopeState<S extends StyleScope> {
  activePresetId: string;
  presets: UserStylePreset<S>[];
}

export interface UserStylesPayload {
  version: 1;
  scriptEditor:    ScopeState<'scriptEditor'>;
  subtitleEditor:  ScopeState<'subtitleEditor'>;
  home:            ScopeState<'home'>;
}
```

**Reglas**:
- `version: 1` permite migraciones futuras del shape.
- Cada scope tiene su `activePresetId` independiente.
- `builtin: true` marca el preset 'Per defecte' creado por la migración: no borrable, no renombrable, sí editable, sí "Restablir als valors de fàbrica".
- Crear un preset = clonar el activo con un nombre nuevo.

## 4. Capa de aplicación: CSS variables

El contexto emite CSS custom properties `--us-*` en `:root` calculadas a partir del preset activo de cada scope. Los componentes leen las variables, **no** props.

### 4.1 Naming de variables

```
--us-script-<element>-{family|size|color|weight|style}    (6 elementos)
--us-sub-<element>-{family|size|color|weight|style}        (6 elementos)
--us-home-<element>-{family|size|color|weight|style}       (6 elementos)
```

Variables derivadas para el editor de subtítulos (no editables, calculadas):

```
--us-sub-row-height        rowHeight = max(24, ceil(maxAtomSize * 1.55))
--us-sub-row-padding-y     ceil(maxAtomSize * 0.25)
--us-sub-grid-columns      string CSS de las 5 columnas calculadas en px
--us-sub-virtual-estimate  rowHeight * maxLines + márgenes
```

### 4.2 Función central

```ts
// frontend/context/UserStyles/applyUserStylesToDOM.ts

function emitAtomVars(prefix: string, atom: StyleAtom): Record<string, string> {
  return {
    [`${prefix}-family`]: atom.fontFamily,
    [`${prefix}-size`]:   `${atom.fontSize}px`,
    [`${prefix}-color`]:  atom.color,
    [`${prefix}-weight`]: atom.bold ? '700' : '400',
    [`${prefix}-style`]:  atom.italic ? 'italic' : 'normal',
  };
}

export function applyUserStylesToDOM(payload: UserStylesPayload): void {
  // recorre los 3 scopes, calcula derivadas para subtítulos, escribe todo en :root
}
```

### 4.3 Mapeo a componentes existentes

| Componente | Cambio |
|---|---|
| `frontend/components/EditorDeGuions/ColumnView.tsx` | `getInlineStyle()` lee `var(--us-script-*)` en lugar de `editorStyles` props. Eliminar prop `editorStyles`. |
| `frontend/components/VideoSubtitlesEditor/SegmentItem.tsx` | Sustituir `text-[14.5px]`, `'Courier Prime'`, `text-[10px]`, etc. por `style={{ fontFamily: 'var(--us-sub-content-family)', fontSize: 'var(--us-sub-content-size)', … }}` para cada elemento (content, timecode, idCps, takeLabel, charCounter, actionButtons). Eliminar `ROW_HEIGHT` const. Grid `gridTemplateRows` y `gridTemplateColumns` leen vars derivadas. |
| `frontend/components/VideoSubtitlesEditor/TimecodeInput.tsx` | Sustituir hardcodes por vars `--us-sub-timecode-*`. El `width: '7.5ch'` se queda (recalcula automáticamente con la nueva fuente). |
| `frontend/components/VideoSubtitlesEditor/SubtitlesEditor.tsx` | `estimateSize` toma valor de `useUserStyles().subtitleRowEstimate`. `useEffect(() => rowVirtualizer.measure(), [subtitleRowEstimate])`. |
| `frontend/components/Library/LibraryFileItem.tsx` | Cada elemento textual lee `--us-home-*`. |
| `frontend/components/Library/SonilabLibraryView.tsx` | Tabs, breadcrumb y header de tabla leen `--us-home-*`. |
| `frontend/App.tsx` | Eliminar `editorStyles` state + props drilling. Envolver árbol en `<UserStylesProvider>` (dentro de `ThemeProvider`). |
| `frontend/components/SettingsModal.tsx` | Eliminar props `editorStyles` / `onStylesChange`. Sustituir tab `editor` por tab `estils`. |
| `frontend/components/ScriptExternalView.tsx` | Eliminar la lectura directa de `LOCAL_STORAGE_KEYS.EDITOR_STYLES` y la prop `editorStyles` que pasa a `ColumnView`. La vista externa monta su propio `<UserStylesProvider>` (que arranca leyendo el cache `snlbpro_user_styles_<userId>` y, en cuanto el evento `USER_PROFILE_LOADED` llega, se sincroniza). Como esta vista vive en otra ventana, recibe las actualizaciones vía el evento `storage` que ya dispara el cache local cuando la ventana principal escribe. |

### 4.4 Por qué CSS variables

1. **Cero re-renders** al cambiar valores: solo se actualiza CSS, React no rerenderiza. Crítico para `SegmentItem` con muchas filas.
2. **Sin props drilling** a `ColumnView`, `SegmentItem`, `LibraryFileItem`.
3. **Preview en vivo** dentro del modal modificando temporalmente las vars del root.

## 5. Persistencia

### 5.1 Backend

Reutilizar el endpoint existente `PATCH /auth/me` con el merge poco profundo de `preferences`:

```ts
api.updateMe({
  preferences: {
    userStyles: <UserStylesPayload>
  }
});
```

- **No se crea endpoint nuevo**.
- **No cambia el schema**: `user.preferences` ya es `Object`.
- El `UserStylesContext` envía siempre el `UserStylesPayload` completo, no fragmentos.

### 5.2 Cache local

- Clave scoped por usuario: `snlbpro_user_styles_<userId>`.
- Se reescribe en cada cambio para arranque inmediato sin parpadeo.
- Sirve también de fallback offline.

### 5.3 Debounce

Mismo patrón que `ThemeContext`: 1500 ms. Cualquier edición:
1. Aplica al DOM inmediatamente.
2. Reescribe el cache local.
3. Programa el push debounced al backend.
4. Al cerrar el modal, flush final inmediato.

### 5.4 Carga inicial (USER_PROFILE_LOADED)

```ts
function loadOrMigrate(me: User): UserStylesPayload {
  if (me.preferences?.userStyles?.version === 1) return me.preferences.userStyles;

  const scoped = readLocalStorage(`snlbpro_user_styles_${me.id}`);
  if (scoped?.version === 1) {
    schedulePush(scoped);
    return scoped;
  }

  const legacy = readLocalStorage('snlbpro_editor_styles');
  const payload = buildInitialPayload({ legacy });
  writeLocalStorage(`snlbpro_user_styles_${me.id}`, payload);
  schedulePush(payload);
  return payload;
}
```

## 6. UI del panel de configuración

### 6.1 Cambio en `SettingsModal.tsx`

```ts
type ActiveTab = 'general' | 'tema' | 'estils' | 'dreceres' | 'lector';
```

Sustituye `'editor'` por `'estils'`. Las otras pestañas no se tocan.

### 6.2 Componentes nuevos

Todos en `frontend/components/Settings/UserStyles/`:

| Componente | Responsabilidad |
|---|---|
| `StylesTab.tsx` | Container de la nueva tab. Estado de sub-pestaña activa. |
| `StylesPresetBar.tsx` | Selector de preset + acciones (nou/duplica/reanomena/elimina/reset). Reusable para los 3 scopes. |
| `StyleAtomEditor.tsx` | Fila reutilizable: label + family + size + color + bold + italic. Sustituye a `StyleControlGroup` actual. |
| `ScriptStylesPanel.tsx` | 6 `StyleAtomEditor` para guiones. |
| `SubtitleStylesPanel.tsx` | 6 `StyleAtomEditor` para subtítulos. |
| `HomeStylesPanel.tsx` | 6 `StyleAtomEditor` para inici. |
| `ScriptStylePreview.tsx` | Mini-fragmento (TAKE + speaker + diálogo) leyendo `--us-script-*`. |
| `SubtitleStylePreview.tsx` | 1-2 filas falsas de subtítulo leyendo `--us-sub-*`. |
| `HomeStylePreview.tsx` | 2-3 filas falsas de archivo + breadcrumb + tab leyendo `--us-home-*`. |

### 6.3 Comportamiento de la preset bar

| Acción | Efecto |
|---|---|
| Selector dropdown | Cambia `activePresetId` del scope, emite vars al DOM. |
| Nou | Clona el preset activo con nombre `"Nou preset"` (editable inline) y lo activa. |
| Duplica | Clona el activo con nombre `"<nom> (còpia)"`. |
| Reanomena | Prompt inline. Bloqueado si `builtin`. |
| Elimina (✕) | Bloqueado si `builtin`. Si se borra el activo, se activa el primero de la lista. |
| Restablir | Sobrescribe los valores del preset activo con los `FACTORY_*_STYLES`. Permitido también para `builtin`. |

### 6.4 Edición en vivo

`StyleAtomEditor` → `updatePresetAtom(scope, atomKey, atomPatch)`:
1. El context recalcula CSS vars y las aplica al DOM inmediatamente (preview en vivo + editor real detrás del modal también actualizado).
2. Programa el debounced PATCH al backend.

## 7. Refactor de fragilidad del editor de subtítulos

### 7.1 ROW_HEIGHT dinámico

`SegmentItem.tsx`: eliminar `const ROW_HEIGHT = '24px'`. El grid lee `var(--us-sub-row-height)`. El context calcula:

```ts
const maxAtomSize = Math.max(
  sb.content.fontSize,
  sb.timecode.fontSize,
  sb.idCps.fontSize,
  sb.takeLabel.fontSize,
  sb.charCounter.fontSize,
);
const rowHeight = Math.max(24, Math.ceil(maxAtomSize * 1.55));
```

`line-height` y `min-height` del texto editable también pasan a `var(--us-sub-row-height)`.

### 7.2 Anchos de columna del grid

Sustituir `gridTemplateColumns: '10ch 12ch 21ch 5ch max-content'` por `gridTemplateColumns: 'var(--us-sub-grid-columns)'`.

El context calcula:

```ts
function computeSubGridCols(sb: SubtitleEditorStyleSet): string {
  const chOf = (atom: StyleAtom) => atom.fontSize * (isMono(atom.fontFamily) ? 0.6 : 0.55);
  const takeCol      = `${Math.ceil(chOf(sb.takeLabel)    * 10)}px`;
  const idCpsCol     = `${Math.ceil(chOf(sb.idCps)        * 12)}px`;
  const timecodeCol  = `${Math.ceil(chOf(sb.timecode)     * 21)}px`;
  const charCntCol   = `${Math.ceil(chOf(sb.charCounter)  *  5)}px`;
  return `${takeCol} ${idCpsCol} ${timecodeCol} ${charCntCol} max-content`;
}
```

`isMono(family)` detecta familias monoespaciadas (Courier, Consolas, monospace, etc.) para ajustar el factor de aproximación de `1ch`. La columna final `max-content` absorbe cualquier desajuste.

### 7.3 TimecodeInput

`TimecodeInput.tsx` lee vars `--us-sub-timecode-*`. El `width: '7.5ch'` se queda — `1ch` se reevalúa contra la nueva `font-size` del propio elemento.

### 7.4 Virtual scroll dinámico

`SubtitlesEditor.tsx`:

```ts
const { subtitleRowEstimate } = useUserStyles();

const rowVirtualizer = useVirtualizer({
  // …
  estimateSize: () => subtitleRowEstimate,
});

useEffect(() => {
  rowVirtualizer.measure();
}, [subtitleRowEstimate]);
```

`measure()` invalida el cache de medidas y recalcula posiciones (soportado nativamente por `@tanstack/react-virtual`).

### 7.5 Fuera de alcance

`SrtPreviewView.tsx` (vista solo lectura del SRT) **no** se incluye en este refactor. Tiene `width: '134px'` y `height: '22px'` hardcoded para badges de timecode, pero es vista de preview, no de edición. Si más adelante se quiere extender, las vars `--us-sub-*` ya están listas y solo hay que sustituir.

## 8. Migración

### 8.1 `buildInitialPayload`

```ts
function buildInitialPayload({ legacy }: { legacy?: EditorStyles }): UserStylesPayload {
  const scriptDefault = {
    id: 'default',
    name: 'Per defecte',
    builtin: true,
    styles: legacy ?? FACTORY_SCRIPT_STYLES,
  };
  const subtitleDefault = {
    id: 'default',
    name: 'Per defecte',
    builtin: true,
    styles: FACTORY_SUBTITLE_STYLES,
  };
  const homeDefault = {
    id: 'default',
    name: 'Per defecte',
    builtin: true,
    styles: FACTORY_HOME_STYLES,
  };
  return {
    version: 1,
    scriptEditor:    { activePresetId: 'default', presets: [scriptDefault] },
    subtitleEditor:  { activePresetId: 'default', presets: [subtitleDefault] },
    home:            { activePresetId: 'default', presets: [homeDefault] },
  };
}
```

### 8.2 Valores de fábrica

`frontend/context/UserStyles/factoryStyles.ts`. Deben **reproducir exactamente el aspecto actual** para que ningún usuario perciba cambio visual al migrar.

- `FACTORY_SCRIPT_STYLES` = el actual `DEFAULT_STYLES` de [App.tsx:35-42](frontend/App.tsx#L35-L42).
- `FACTORY_SUBTITLE_STYLES` = mapeo de los hardcodes actuales:
  - `content`: Courier Prime monospace, 14 px, color resuelto de `var(--th-editor-text)`.
  - `timecode`: Courier Prime monospace, 10 px, color resuelto de `var(--th-editor-timecode)`.
  - `idCps`: monospace, 11 px, color resuelto de `var(--th-editor-text-muted)`.
  - `takeLabel`: sans-serif, 10 px, color resuelto de `var(--th-accent-text)`.
  - `charCounter`: monospace, 11 px, color resuelto de `var(--th-editor-text-muted)`.
  - `actionButtons`: sans-serif, 9 px, color resuelto de `var(--th-editor-meta)`.
- `FACTORY_HOME_STYLES`:
  - `fileName`: sans-serif, 14 px, `#f3f4f6`.
  - `formatLabel`: sans-serif, 10 px bold, `#6b7280`.
  - `dateTime`: monospace, 10 px, `#9ca3af`.
  - `tableHeader`: sans-serif, 10 px black, color resuelto de `var(--th-text-muted)`.
  - `navTabs`: sans-serif, 14 px semibold, `#ffffff`.
  - `breadcrumb`: sans-serif, 14 px, color resuelto de `var(--th-text-secondary)`.

Los colores `var(--th-*)` se resuelven a hex en el momento de la primera migración usando `getComputedStyle(document.documentElement).getPropertyValue('--th-…')`. A partir de ese instante el preset 'Per defecte' del usuario tiene colores fijos: **los estilos del usuario son independientes del tema admin**.

### 8.3 Cleanup del legacy

`snlbpro_editor_styles` **no se borra**. Razón: rollback de versión seguro. Se deja como dato muerto y se documenta en `constants.ts` como deprecated.

### 8.4 Orden de providers

```
AuthProvider
  └─ ThemeProvider
       └─ UserStylesProvider          ← NUEVO
            └─ SubtitleEditorProvider
                 └─ … resto
```

`UserStylesProvider` se monta dentro de `ThemeProvider` para poder leer `--th-*` durante la migración inicial (resolución de colores).

### 8.5 Eliminar state legacy

[App.tsx:264](frontend/App.tsx#L264): eliminar `const [editorStyles, setEditorStyles] = useLocalStorage(...)` y todo el props drilling hacia `ColumnView` y `SettingsModal`.

## 9. Archivos nuevos y modificados

### 9.1 Archivos nuevos

- `frontend/types/UserStyles/userStylesTypes.ts`
- `frontend/context/UserStyles/UserStylesContext.tsx`
- `frontend/context/UserStyles/applyUserStylesToDOM.ts`
- `frontend/context/UserStyles/factoryStyles.ts`
- `frontend/context/UserStyles/userStylesMigration.ts`
- `frontend/components/Settings/UserStyles/StylesTab.tsx`
- `frontend/components/Settings/UserStyles/StylesPresetBar.tsx`
- `frontend/components/Settings/UserStyles/StyleAtomEditor.tsx`
- `frontend/components/Settings/UserStyles/ScriptStylesPanel.tsx`
- `frontend/components/Settings/UserStyles/SubtitleStylesPanel.tsx`
- `frontend/components/Settings/UserStyles/HomeStylesPanel.tsx`
- `frontend/components/Settings/UserStyles/ScriptStylePreview.tsx`
- `frontend/components/Settings/UserStyles/SubtitleStylePreview.tsx`
- `frontend/components/Settings/UserStyles/HomeStylePreview.tsx`
- `Skills_Claude/domain-user-styles.md` (nuevo dominio para CLAUDE.md§10)

### 9.2 Archivos modificados

- `frontend/App.tsx` — quitar `editorStyles` state + props drilling, montar `UserStylesProvider`.
- `frontend/components/SettingsModal.tsx` — sustituir tab `editor` por `estils`, eliminar props `editorStyles`/`onStylesChange`, eliminar `StyleControlGroup` (sustituido por `StyleAtomEditor`).
- `frontend/components/EditorDeGuions/ColumnView.tsx` — `getInlineStyle()` lee CSS vars.
- `frontend/components/VideoSubtitlesEditor/SegmentItem.tsx` — quitar `ROW_HEIGHT`, sustituir hardcodes por CSS vars, grid usa vars derivadas.
- `frontend/components/VideoSubtitlesEditor/SubtitlesEditor.tsx` — `estimateSize` dinámico + `useEffect(measure)`.
- `frontend/components/VideoSubtitlesEditor/TimecodeInput.tsx` — sustituir hardcodes por CSS vars.
- `frontend/components/Library/LibraryFileItem.tsx` — sustituir hardcodes por CSS vars `--us-home-*`.
- `frontend/components/Library/SonilabLibraryView.tsx` — sustituir hardcodes textuales por CSS vars.
- `frontend/components/ScriptExternalView.tsx` — eliminar lectura directa de `LOCAL_STORAGE_KEYS.EDITOR_STYLES`, montar `UserStylesProvider`, propagar la sincronización entre ventanas vía evento `storage`.
- `frontend/constants.ts` — marcar `EDITOR_STYLES` como deprecated (sin borrar).
- `Skills_Claude/domain-localstorage.md` — añadir entrada `snlbpro_user_styles_<userId>`.

### 9.3 Sin cambios

- Backend NestJS: cero. El schema y el endpoint actuales bastan.
- `ThemeContext` y temas admin: cero.
- Editor de guion `Editor.tsx`: cero (solo `ColumnView` aplica estilos).
- `SrtPreviewView.tsx`: cero (fuera de alcance).

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El cálculo `ch → px` para `--us-sub-grid-columns` es aproximado. | Factores 0.6 (mono) y 0.55 (sans) calibrados para fuentes web comunes. La columna final `max-content` absorbe el desajuste. Calibrar si aparece problema visual concreto. |
| Cambiar `estimateSize` con virtualización montada puede causar saltos visuales. | `rowVirtualizer.measure()` reposiciona limpiamente. En la práctica el usuario está en el modal, no en la lista. |
| Resolver `var(--th-*)` a hex en migración bloquea la sincronización futura con cambios de tema. | Es **deliberado**: los estilos del usuario son independientes del tema. Si el usuario quiere alinear con un nuevo tema usa "Restablir als valors de fàbrica". |
| Usuarios con `snlbpro_editor_styles` previo perderían su configuración si se borra. | No se borra. Migración automática al preset 'Per defecte' al primer load del nuevo código. |
| Ruptura de la prop `editorStyles` en componentes externos al editor. | Búsqueda exhaustiva durante la implementación. Solo `App.tsx`, `SettingsModal.tsx`, `ColumnView.tsx` y `ScriptExternalView.tsx` la consumen — todos quedan cubiertos por el refactor. |

## 11. Fuera de alcance explícito

- Refactor de `SrtPreviewView.tsx` (vista solo lectura del SRT).
- Estilos del editor de waveform / timeline.
- Estilos del modal `SettingsModal` mismo (los colores del propio panel siguen viniendo del tema admin).
- Sincronización automática entre tema admin y presets de usuario.
- Importación/exportación de presets en archivo (la persistencia es solo backend + cache).
- Preset compartido entre usuarios (cada usuario tiene los suyos).

## 12. Aceptación

El diseño se considera implementado correctamente cuando:

1. La pestaña "Estils Editor" del modal ha sido sustituida por "Estils" con 3 sub-pestañas funcionales.
2. Cada sub-pestaña permite editar 6 atoms tipográficos individualmente, gestionar presets (crear, duplicar, renombrar, eliminar, restablir) y muestra preview en vivo.
3. Los cambios se persisten en `user.preferences.userStyles` (backend) y en `snlbpro_user_styles_<userId>` (cache local).
4. Cambiar `fontSize` del texto editable de subtítulos a 22 px no rompe el layout: las filas crecen, las columnas se ajustan y el virtual scroll sigue posicionando bien.
5. Un usuario con `snlbpro_editor_styles` previo abre la app y ve sus valores antiguos como contenido del preset 'Per defecte' del editor de guiones, sin acción manual.
6. El tema admin (oscuro/claro/etc.) sigue funcionando igual que antes y no interfiere con los estilos del usuario.
