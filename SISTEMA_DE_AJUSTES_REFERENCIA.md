# Sistema de Ajustes de Sonilab — Referencia técnica completa

> **Propósito de este documento**
> Describir **todo** el sistema de ajustes/preferencias de la aplicación Sonilab para poder
> **reconstruirlo y adaptarlo en otro proyecto**. La finalidad concreta del proyecto destino es
> tener un panel de ajustes equivalente para editar:
> - **Atajos de teclado** de sus "miniaplicaciones" (scopes/módulos).
> - **Colores de los temas** (theming por tokens semánticos).
> - **Tipografías/estilos por contexto** y otras preferencias.
>
> Este documento es **autosuficiente**: incluye los modelos de datos, los contratos de cada
> subsistema, la lista exhaustiva de variables CSS, los flujos de persistencia y un recetario de
> adaptación. No requiere leer el código original para entenderlo, aunque se citan rutas y líneas
> por si se quiere comparar.
>
> **Nota de estado real del repo origen:** `frontend/context/Theme/ThemeContext.tsx` está
> referenciado por el código (lo importan `App.tsx` y `SettingsModal.tsx`) pero **no está presente
> en el working tree** en el momento de redactar (incidencia de git ajena a este sistema). Su API se
> reconstruye aquí **por inferencia** a partir de su uso real, y se marca claramente como tal.
> Todo lo demás está leído directamente del código.

---

## 0. Índice

1. [Visión general y arquitectura](#1-visión-general-y-arquitectura)
2. [El modal de ajustes (`SettingsModal`)](#2-el-modal-de-ajustes-settingsmodal)
3. [Subsistema 1 — Temas de color (theming por tokens)](#3-subsistema-1--temas-de-color-theming-por-tokens)
4. [Subsistema 2 — User Styles (tipografía por contexto)](#4-subsistema-2--user-styles-tipografía-por-contexto)
5. [Subsistema 3 — Atajos de teclado](#5-subsistema-3--atajos-de-teclado)
6. [Subsistema 4 — Ajustes "General" (preferencias sueltas)](#6-subsistema-4--ajustes-general-preferencias-sueltas)
7. [Subsistema 5 — Presets de Whisper (backend per-usuario)](#7-subsistema-5--presets-de-whisper-backend-per-usuario)
8. [Persistencia: localStorage + backend](#8-persistencia-localstorage--backend)
9. [Factory Reset (restablecer de fábrica)](#9-factory-reset-restablecer-de-fábrica)
10. [Backend NestJS de settings](#10-backend-nestjs-de-settings)
11. [Recetario de adaptación a otro proyecto](#11-recetario-de-adaptación-a-otro-proyecto)
12. [Inventario de archivos del sistema](#12-inventario-de-archivos-del-sistema)

---

## 1. Visión general y arquitectura

El sistema de ajustes de Sonilab es **modular** y se compone de subsistemas independientes,
unificados visualmente en un único modal (`SettingsModal`) con pestañas. Cada subsistema tiene su
propio modelo de datos, su propia capa de persistencia y su propio mecanismo de aplicación.

### 1.1 Los cinco subsistemas

| # | Subsistema | Qué configura | Estado / aplicación | Persistencia |
|---|-----------|----------------|---------------------|--------------|
| 1 | **Temas de color** | Paleta de la interfaz (fondos, textos, accent, editor, waveform…) | Context React → CSS vars `--th-*` en `:root` | `localStorage` (`snlbpro_theme`, `snlbpro_custom_theme_tokens`) + backend (`preferences.customThemeTokens`) |
| 2 | **User Styles** | Tipografía/tamaño/color/negrita/cursiva por elemento, en 3 contextos (Inici, Editor subtítols, Editor guions) | Context React → CSS vars `--us-*` en `:root` | `localStorage` (`snlbpro_user_styles_<userId>`) + backend (`preferences.userStyles`, debounced 1500 ms) |
| 3 | **Atajos de teclado** | Combos de teclas por scope/módulo | Hook `useKeyboardShortcuts` + `localStorage` | `localStorage` (`snlbpro_shortcuts`) + backend (`preferences.shortcuts`) |
| 4 | **General** | Preferencias sueltas (anchos, márgenes, opacidades, ms…) | `useLocalStorage` directo en componentes | `localStorage` (varias claves) |
| 5 | **Presets Whisper** | Configuraciones de transcripción guardadas | API REST per-usuario | Backend MongoDB (`UserSettings.whisperPresets`) |

### 1.2 Principio de diseño común: "CSS variables como puente"

El patrón central de los subsistemas visuales (1 y 2) es:

```
Estado React (Context)  ──►  setProperty() en document.documentElement (:root)
                                         │
                                         ▼
            CSS custom properties:  --th-*  (temas)   y   --us-*  (user styles)
                                         │
                                         ▼
       Componentes consumen via inline style={{ color: 'var(--th-accent)' }}  ó  className Tailwind con var()
```

Ventajas que explotan:
- **Sin prop-drilling**: cualquier componente (incluidas las previews) lee `var(--th-…)` / `var(--us-…)`.
- **Aplicación instantánea**: cambiar una variable repinta toda la app sin re-render de React.
- **Anti-flicker (regla crítica documentada)**: *nunca* usar callback refs, `!important` ni
  `MutationObserver` para aplicar estilos; consumir siempre las vars vía `style` inline o clases.

### 1.3 Stack

- **Frontend:** React + Vite + Tailwind (hash routing propio, no react-router).
- **Backend:** NestJS + Mongoose/MongoDB. Auth por JWT.
- **Flag de backend:** `USE_BACKEND = import.meta.env.VITE_USE_BACKEND === '1'` (en el origen se lee
  como `process.env.VITE_USE_BACKEND`). Si está desactivado, todo funciona solo con `localStorage`.

---

## 2. El modal de ajustes (`SettingsModal`)

**Archivo:** `frontend/components/SettingsModal.tsx`

### 2.1 Apertura / cierre

- Estado en el padre (`MainAppContent` en `App.tsx`): `const [isSettingsOpen, setIsSettingsOpen] = useState(false)`.
- Render condicional: `{isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}`.
- **Dos disparadores de apertura:**
  1. Botón "Configuració" en el footer de la sidebar (`SonilabLibraryView.tsx`) → `onOpenSettings()`.
  2. Evento global de window: `window.addEventListener('OPEN_SETTINGS', () => setIsSettingsOpen(true))`.
     Permite abrir el modal desde cualquier parte con `window.dispatchEvent(new Event('OPEN_SETTINGS'))`.
- **Cierre:** clic en backdrop, botón ✕ del header, botón "Fet" del footer, o `Escape` (excepto durante
  el flujo de factory reset, que lo bloquea).

### 2.2 Props

```ts
interface SettingsModalProps {
  onClose: () => void;
}
```

Todo lo demás lo obtiene de contextos (`useAuth`, `useTheme`) y `useLocalStorage`. No recibe datos por props.

### 2.3 Pestañas

```ts
type ActiveTab = 'general' | 'estils' | 'shortcuts' | 'reader' | 'theme';
```

| Tab | Etiqueta UI | Contenido |
|-----|-------------|-----------|
| `general` | "General" | Preferencias sueltas + botón Factory Reset (ver §6) |
| `theme` | "Tema" | Selector de temas preset + editor de tema personalizado (ver §3) |
| `estils` | "Estils" | `<StylesTab/>`: sub-tabs Inici / Editor subtítols / Editor guions (ver §4) |
| `shortcuts` | "Dreceres" | Editor de atajos por scope (ver §5) |
| `reader` | "Lector" | Placeholder ("Aquest apartat estarà disponible properament.") |

### 2.4 Layout y estilo (reutilizable tal cual)

```jsx
{/* Backdrop */}
<div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[500] p-4"
     onClick={onClose}>
  {/* Contenedor */}
  <div className="rounded-3xl shadow-2xl w-full max-w-4xl flex flex-col h-[600px] border border-[var(--th-border)] overflow-hidden"
       style={{ backgroundColor: 'var(--th-bg-surface)', color: 'var(--th-text-secondary)' }}
       onClick={e => e.stopPropagation()}>
    {/* Header (p-6): icono + título "Configuració" + logout + ✕ */}
    {/* Barra de tabs (flex): TabButton por cada ActiveTab */}
    {/* Área de contenido (p-8 overflow-y-auto flex-grow), bg var(--th-bg-primary) */}
    {/* Footer (p-6 flex justify-end): botón "Fet" */}
  </div>
</div>
```

Componente interno de pestaña:

```jsx
const TabButton = ({ tabId, label, disabled }) => {
  const isActive = activeTab === tabId;
  // estilos: activo usa var(--th-accent) / var(--th-text-primary); inactivo var(--th-text-muted)
};
```

### 2.5 Z-index de modales anidados

| Modal | z-index |
|-------|---------|
| `SettingsModal` | `z-[500]` |
| `FactoryResetConfirmModal` (anidado) | `z-[800]` |
| `UnsavedChangesWarningModal` (anidado en el anterior) | `z-[900]` |

### 2.6 Imports clave (mapa de dependencias)

```ts
import { AppShortcuts, Shortcut } from '../appTypes';
import { DEFAULT_SHORTCUTS, LOCAL_STORAGE_KEYS, mergeShortcuts } from '../constants';
import { api } from '../services/api';
import useLocalStorage from '../hooks/useLocalStorage';
import { useAuth } from '../context/Auth/AuthContext';
import { useTheme } from '../context/Theme/ThemeContext';          // (contrato inferido, §3.5)
import { CUSTOM_THEME_ID, PRESET_THEMES, TOKEN_GROUPS, buildCustomTheme } from '../context/Theme/themes';
import { StylesTab } from './Settings/UserStyles/StylesTab';
import { factoryReset } from '../utils/factoryReset';
```

---

## 3. Subsistema 1 — Temas de color (theming por tokens)

**Archivo de definición:** `frontend/context/Theme/themes.ts` (presente y completo)
**Context de aplicación/persistencia:** `frontend/context/Theme/ThemeContext.tsx` (contrato inferido — ver §3.5)

### 3.1 Modelo de datos

```ts
export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  /** 4 colores de muestra para la previsualización en el selector */
  preview: [string, string, string, string];
  /** Tokens CSS SIN el prefijo `--`. p.ej. { 'bg-app': '#0A0A0A', 'accent': '#C40000', ... } */
  tokens: Record<string, string>;
}
```

Un **tema** = un set completo de tokens semánticos. Los tokens se vuelcan a `:root` como
`--th-<key>` (ver §3.4). Los componentes consumen `var(--th-accent)`, `var(--th-bg-primary)`, etc.

### 3.2 Temas predefinidos (4)

```ts
export const PRESET_THEMES: ThemeDefinition[] = [THEME_SONILAB, THEME_DARK, THEME_LIGHT, THEME_MIDNIGHT];
export const DEFAULT_THEME_ID = 'sonilab';
export const CUSTOM_THEME_ID = 'custom';
```

| id | name | description | preview (bg, surface, accent, text) |
|----|------|-------------|--------------------------------------|
| `sonilab` | Sonilab | Tema corporativo: negro profundo, accent rojo | `#0A0A0A`,`#161616`,`#C40000`,`#FFFFFF` |
| `dark` | Fosc | Tema oscuro neutro con accent azul | `#18181b`,`#27272a`,`#3b82f6`,`#f4f4f5` |
| `light` | Clar | Tema claro profesional con fondo blanco | `#ffffff`,`#f4f4f5`,`#2563eb`,`#18181b` |
| `midnight` | Midnight | Tema azul profundo con accent índigo | `#0c1222`,`#162032`,`#6366f1`,`#e2e8f0` |

### 3.3 Catálogo completo de tokens

**Cada tema define exactamente este conjunto de claves** (mostradas con el valor del tema Sonilab
como ejemplo; cada tema repite todas las claves con sus propios valores). Esta es la lista
**exhaustiva** — son el contrato que cualquier tema nuevo debe cumplir:

#### Fondos
| token | ejemplo (sonilab) |
|-------|-------------------|
| `bg-app` | `#0A0A0A` |
| `bg-primary` | `#121212` |
| `bg-secondary` | `#1A1A1A` |
| `bg-tertiary` | `#242424` |
| `bg-surface` | `#161616` |
| `bg-hover` | `rgba(255,255,255,0.06)` |
| `bg-active` | `rgba(196,0,0,0.15)` |
| `bg-overlay` | `rgba(0,0,0,0.88)` |

#### Textos
| token | ejemplo |
|-------|---------|
| `text-primary` | `#FFFFFF` |
| `text-secondary` | `#B8B8B8` |
| `text-muted` | `#808080` |
| `text-disabled` | `#555555` |
| `text-inverse` | `#0A0A0A` |

#### Bordes y separadores
| token | ejemplo |
|-------|---------|
| `border` | `#2A2A2A` |
| `border-strong` | `#3A3A3A` |
| `border-subtle` | `rgba(255,255,255,0.08)` |
| `divider` | `#1A1A1A` |

#### Accent y botones
| token | ejemplo |
|-------|---------|
| `accent` | `#C40000` |
| `accent-hover` | `#E00000` |
| `accent-muted` | `rgba(196,0,0,0.20)` |
| `accent-text` | `#FF4444` |
| `btn-primary-bg` | `#C40000` |
| `btn-primary-hover` | `#A80000` |
| `btn-primary-text` | `#FFFFFF` |
| `tab-active-bg` | `#C40000` |
| `tab-active-text` | `#FFFFFF` |
| `tab-active-border` | `#C40000` |
| `focus-ring` | `rgba(196,0,0,0.5)` |
| `link` | `#FF4444` |

#### Estados y alertas
| token | ejemplo |
|-------|---------|
| `success` | `#22c55e` |
| `warning` | `#eab308` |
| `error` | `#ef4444` |
| `info` | `#38bdf8` |
| `alert-warning-bg` | `rgba(234,179,8,0.10)` |
| `alert-warning-text` | `#fbbf24` |
| `alert-warning-border` | `rgba(234,179,8,0.30)` |
| `alert-error-bg` | `rgba(239,68,68,0.10)` |
| `alert-error-text` | `#fca5a5` |
| `alert-error-border` | `rgba(239,68,68,0.30)` |

#### Editor de subtítulos
| token | ejemplo |
|-------|---------|
| `editor-bg` | `#121212` |
| `editor-row-hover` | `rgba(255,255,255,0.04)` |
| `editor-row-active` | `rgba(196,0,0,0.12)` |
| `editor-text` | `#FFFFFF` |
| `editor-text-active` | `#FFFFFF` |
| `editor-text-muted` | `#808080` |
| `editor-caret` | `#FFFFFF` |
| `editor-timecode` | `#B8B8B8` |
| `editor-meta` | `#808080` |
| `editor-label-bg` | `rgba(255,255,255,0.06)` |

#### Timeline / Waveform (onda)
| token | ejemplo |
|-------|---------|
| `waveform-bg` | `#0E0E0E` |
| `waveform-ruler-bg` | `#0A0A0A` |
| `waveform-line` | `#2A2A2A` |
| `waveform-grid` | `rgba(60,60,60,0.3)` |
| `waveform-grid-text` | `rgba(160,160,160,0.6)` |
| `waveform-bar` | `rgba(180,180,180,0.45)` |
| `waveform-bar-play` | `rgba(196,0,0,0.7)` |
| `waveform-seg` | `rgba(196,0,0,0.12)` |
| `waveform-seg-idle` | `rgba(255,255,255,0.06)` |
| `waveform-seg-border` | `#C40000` |
| `waveform-seg-border-idle` | `#555555` |
| `waveform-seg-handle` | `#FF4444` |
| `waveform-seg-handle-idle` | `#888888` |
| `waveform-seg-text` | `rgba(255,200,200,0.9)` |
| `waveform-seg-text-idle` | `rgba(180,180,180,0.7)` |
| `waveform-scrollbar` | `#4b5563 #0E0E0E` |

#### Otros
| token | ejemplo |
|-------|---------|
| `header-bg` | `rgba(22,22,22,0.95)` |
| `badge-bg` | `rgba(196,0,0,0.15)` |
| `badge-text` | `#FF4444` |
| `badge-border` | `rgba(196,0,0,0.3)` |

> Los valores completos de los 4 temas están en `frontend/context/Theme/themes.ts`. Para adaptar a
> otro proyecto basta con copiar ese archivo y reemplazar valores; **mantener las mismas claves**
> garantiza que todos los componentes existentes funcionen.

### 3.4 Tema personalizado y metadatos de edición (`TOKEN_GROUPS`)

El editor de tema personalizado se construye a partir de **metadatos declarativos** que agrupan los
tokens semánticamente (esto es lo que recorre la UI para renderizar los color-pickers):

```ts
export interface TokenGroupDef {
  id: string;
  label: string;
  description?: string;
  tokens: { key: string; label: string }[];
}

export const TOKEN_GROUPS: TokenGroupDef[] = [ /* … */ ];
```

Grupos definidos (id → label → nº de tokens):

| id | label | tokens |
|----|-------|--------|
| `backgrounds` | Fons | 8 (bg-app, bg-primary, bg-secondary, bg-tertiary, bg-surface, bg-hover, bg-active, bg-overlay) |
| `texts` | Textos | 5 (text-primary/secondary/muted/disabled/inverse) |
| `borders` | Bordes i separadors | 4 (border, border-strong, border-subtle, divider) |
| `accent` | Accent i botons | 12 (accent, accent-hover, accent-muted, accent-text, btn-primary-bg, btn-primary-hover, btn-primary-text, tab-active-bg, tab-active-text, tab-active-border, focus-ring, link) |
| `status` | Estats i alertes | 10 (success, warning, error, info + 6 de alert-*) |
| `editor` | Editor de subtítols | 10 (editor-*) |
| `waveform` | Timeline / Ona | 15 (waveform-*) |
| `misc` | Altres | 4 (header-bg, badge-bg, badge-text, badge-border) |

Helper para construir el tema personalizado (merge sobre Sonilab como base para garantizar que
**todas** las claves existan):

```ts
export function buildCustomTheme(tokens: Record<string, string>): ThemeDefinition {
  const merged = { ...THEME_SONILAB.tokens, ...tokens };
  return {
    id: CUSTOM_THEME_ID,        // 'custom'
    name: 'Personalitzat',
    description: 'Tema personalitzat amb colors definits per l\'usuari',
    preview: [merged['bg-app'], merged['bg-surface'], merged['accent'], merged['text-primary']],
    tokens: merged,
  };
}

export function getThemeById(id: string): ThemeDefinition {
  return ALL_THEMES.find(t => t.id === id) ?? THEME_SONILAB;   // fallback al default
}
```

### 3.5 Contrato del `ThemeContext` (⚠️ inferido por uso — archivo ausente en disco)

El componente `SettingsModal` consume `useTheme()` y `App.tsx` envuelve la app en `<ThemeProvider>`.
A partir de su uso real en el modal, el contrato del context es:

```ts
// API expuesta por useTheme() — RECONSTRUIDA por uso, verificar al portar
interface ThemeContextValue {
  theme: ThemeDefinition;                 // tema activo resuelto (preset o custom)
  themeId: string;                        // id del tema seleccionado
  setThemeId(id: string): void;           // cambia tema (y persiste)
  themes: ThemeDefinition[];              // lista de presets para el selector
  customTokens: Record<string,string>;    // tokens del tema personalizado en edición
  setCustomTokens(t: Record<string,string>): void;
  resetCustomTokensFromPreset(presetId: string): void;  // "copiar desde preset" en el editor
}
```

**Lógica de aplicación (patrón estándar a implementar):**

```ts
// Al cambiar theme/themeId, volcar tokens a :root con prefijo --th-
function applyThemeToDOM(theme: ThemeDefinition) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(`--th-${key}`, value);   // 'bg-app' -> '--th-bg-app'
  }
}
```

**Persistencia del tema (claves confirmadas):**
- `snlbpro_theme` (`LOCAL_STORAGE_KEYS.THEME`): id del tema seleccionado. **Se preserva en factory reset.**
- `snlbpro_custom_theme_tokens` (`LOCAL_STORAGE_KEYS.CUSTOM_THEME_TOKENS`): tokens del tema custom (fallback local).
- Backend: `preferences.customThemeTokens` (el factory reset lo pone a `null` vía `api.updateMe`).

### 3.6 UI de la pestaña "Tema" (en `SettingsModal`)

1. **Grid de temas preset**: una card por tema con cuadritos de color (`preview`), nombre,
   descripción, badge "Actiu" si es el seleccionado y radio. Clic → `setThemeId(t.id)`.
2. **Card de tema personalizado**: muestra preview de los `customTokens` actuales; clic inicializa y
   abre el editor (`setThemeId(CUSTOM_THEME_ID)` + `setCustomEditorOpen(true)`).
3. **Editor de tema personalizado** (solo si `themeId === 'custom' && customEditorOpen`):
   - Recorre `TOKEN_GROUPS`; por cada token renderiza un `TokenRow`.
   - **`TokenRow`** = `<input type="color">` + `<input type="text">` con validación CSS (hex, nombre
     o color CSS válido). Patrón **draft**: el texto se edita en estado local y se confirma en `blur`
     o `Enter`; borde rojo si inválido.
   - Dropdown "Copiar desde preset" para volcar tokens de un tema existente al custom.

---

## 4. Subsistema 2 — User Styles (tipografía por contexto)

Sistema de presets tipográficos por **scope** (contexto de la app). Permite al usuario definir
fuente, tamaño, color, negrita y cursiva de cada elemento de texto de tres áreas, guardarlos como
presets nombrados y conmutar entre ellos.

**Archivos:**
- Tipos: `frontend/types/UserStyles/userStylesTypes.ts`
- Context: `frontend/context/UserStyles/UserStylesContext.tsx`
- Fábrica de defaults: `frontend/context/UserStyles/factoryStyles.ts`
- Aplicación al DOM: `frontend/context/UserStyles/applyUserStylesToDOM.ts`
- Migración v1→v2: `frontend/context/UserStyles/userStylesMigration.ts`
- UI: `frontend/components/Settings/UserStyles/*` (panels, editor, preset bar, previews, modal)

### 4.1 Modelo de datos

```ts
// La unidad atómica: especificación tipográfica de un elemento.
export interface StyleAtom {
  fontFamily: string;   // 'Courier Prime, monospace', 'sans-serif', etc.
  fontSize: number;     // px
  color: string;        // hex '#rrggbb' o CSS var 'var(--th-...)'
  bold: boolean;        // weight 700 si true, 400 si no
  italic: boolean;      // 'italic' | 'normal'
}

// Un "scope" = un set de átomos. Tres scopes:
export interface ScriptEditorStyleSet {
  take: StyleAtom;
  speaker: StyleAtom;
  timecode: StyleAtom;
  dialogue: StyleAtom;
  dialogueParentheses: StyleAtom;
  dialogueTimecodeParentheses: StyleAtom;
}
export interface SubtitleEditorStyleSet {
  content: StyleAtom;
  timecode: StyleAtom;
  idCps: StyleAtom;
  takeLabel: StyleAtom;
  charCounter: StyleAtom;
  actionButtons: StyleAtom;
}
export interface HomeStyleSet {
  fileName: StyleAtom;
  formatLabel: StyleAtom;
  dateTime: StyleAtom;
  tableHeader: StyleAtom;
  navTabs: StyleAtom;
  breadcrumb: StyleAtom;
  createProjectSelect: StyleAtom;
}

export type StyleScope = 'scriptEditor' | 'subtitleEditor' | 'home';

export interface StyleSetMap {
  scriptEditor: ScriptEditorStyleSet;
  subtitleEditor: SubtitleEditorStyleSet;
  home: HomeStyleSet;
}

// Un preset = un set de estilos con nombre.
export interface UserStylePreset<S extends StyleScope = StyleScope> {
  id: string;            // 'default' | 'custom' | uuid corto
  name: string;          // 'Per defecte', 'El meu preset', ...
  builtin?: boolean;     // true = preset de sistema inmutable
  styles: StyleSetMap[S];
}

// Estado por scope.
export interface ScopeState<S extends StyleScope> {
  activePresetId: string;
  presets: UserStylePreset<S>[];
}

// Estado raíz (lo que se persiste).
export interface UserStylesPayload {
  version: 2;
  scriptEditor: ScopeState<'scriptEditor'>;
  subtitleEditor: ScopeState<'subtitleEditor'>;
  home: ScopeState<'home'>;
}
```

### 4.2 Tres tipos especiales de preset

- **`builtin` (`id: 'default'`, `name: 'Per defecte'`)**: inmutable. **Se sobreescribe en cada montaje**
  con los valores de `factoryStyles.ts`, para que los cambios de código lleguen a todos los usuarios
  sin migración manual. No se puede renombrar ni borrar.
- **Preset de usuario (`builtin: false`, id uuid)**: creado por el usuario ("Nou" / duplicar / guardar).
- **Draft (`id: 'custom'`)**: estado temporal de edición sin guardar. Aparece al editar un átomo
  estando sobre cualquier preset; se materializa como preset nombrado al "Guardar".

### 4.3 Estilos de fábrica (`factoryStyles.ts`)

Helpers: `courier(size,color,bold?,italic?)`, `sans(...)`, `mono(...)` → construyen `StyleAtom`.

```ts
FACTORY_SCRIPT_STYLES = {
  take:                        courier(16, '#000000', true,  false),
  speaker:                     courier(14, '#000000', true,  false),
  timecode:                    courier(13, '#666666', false, false),
  dialogue:                    courier(14, '#000000', false, false),
  dialogueParentheses:         courier(14, '#555555', false, true),
  dialogueTimecodeParentheses: courier(13, '#0055aa', true,  false),
};
FACTORY_SUBTITLE_STYLES = {
  content:       courier(14, 'var(--th-editor-text)'),
  timecode:      courier(10, 'var(--th-editor-timecode)'),
  idCps:         mono(11,    'var(--th-editor-text-muted)', true),
  takeLabel:     sans(10,    'var(--th-accent-text)', true),
  charCounter:   mono(11,    'var(--th-editor-text-muted)', true),
  actionButtons: sans(9,     'var(--th-editor-meta)'),
};
FACTORY_HOME_STYLES = {
  fileName:            sans(14, 'var(--th-text-primary)'),
  formatLabel:         sans(10, 'var(--th-text-muted)', true),
  dateTime:            mono(10, 'var(--th-text-secondary)'),
  tableHeader:         sans(10, 'var(--th-text-muted)', true),
  navTabs:             sans(14, 'var(--th-text-primary)', true),
  breadcrumb:          sans(14, 'var(--th-text-secondary)'),
  createProjectSelect: sans(14, '#ffffff'),
};
```

> Nota de diseño: Home y Subtitle usan `var(--th-*)` para **heredar el color del tema activo**;
> Script usa hex porque son colores de texto editable independientes del tema. Si el usuario elige
> un color con el picker, se guarda un hex que sobreescribe la var.

### 4.4 Aplicación al DOM (`applyUserStylesToDOM.ts`)

Por cada `StyleAtom` se emiten **5 CSS vars** con un prefijo por elemento:

```ts
function emitAtomVars(prefix, atom) {
  return {
    `${prefix}-family`: atom.fontFamily,
    `${prefix}-size`:   `${atom.fontSize}px`,
    `${prefix}-color`:  atom.color,
    `${prefix}-weight`: atom.bold ? '700' : '400',
    `${prefix}-style`:  atom.italic ? 'italic' : 'normal',
  };
}
// Todo se escribe en :root con root.style.setProperty(k, v)
```

Prefijos generados:
- **Script:** `--us-script-{take|speaker|timecode|dialogue|dialogueparen|dialoguetcparen}-{family|size|color|weight|style}`
- **Subtitle:** `--us-sub-{content|timecode|idcps|takelabel|charcounter|actionbuttons}-{...}`
- **Home:** `--us-home-{filename|format|datetime|tableheader|navtabs|breadcrumb|cpmodal-select}-{...}`

**Métricas derivadas** (solo subtítulos), calculadas a partir del tamaño de fuente máximo:
- `--us-sub-row-height` = `max(24, ceil(maxFontSize * 1.55))` px
- `--us-sub-row-padding-y` = `ceil(rowHeight * 0.16)` px
- `--us-sub-grid-columns` = template de grid calculado con ancho de carácter por columna
  (`fontSize * 0.6` mono / `* 0.55` proporcional). Detección monospace por regex:
  `/courier|consolas|monaco|menlo|monospace|fira ?code|cascadia/`.

Disparador: en `UserStylesContext`, un `useEffect([payload])` serializa el payload y solo llama a
`applyUserStylesToDOM` si cambió el contenido (evita escrituras redundantes).

### 4.5 API del Context (`useUserStyles()`)

```ts
interface UserStylesContextValue {
  payload: UserStylesPayload;
  activePreset<S extends StyleScope>(scope: S): UserStylePreset<S>;
  setActivePreset(scope, presetId): void;
  createPreset(scope, name): string;              // clona el activo, lo activa, devuelve id
  duplicatePreset(scope, presetId): string;       // " (còpia)"
  renamePreset(scope, presetId, name): void;      // bloqueado si builtin
  deletePreset(scope, presetId): void;            // bloqueado si builtin; fallback al primero
  resetActivePreset(scope): void;                 // vuelve a fábrica
  updateAtom<S>(scope, atomKey, patch: Partial<StyleAtom>): void;  // crea draft 'custom' si hace falta
  savePayloadNow(): void;                          // flush inmediato del debounce
  savePreset(scope, name, overwrite?): 'ok' | 'conflict' | 'blocked-custom' | 'blocked-system';
  saveGlobalPreset(scope): Promise<void>;          // admin: empuja default global al backend
  hasUnsavedChanges(scope): boolean;               // true si existe draft 'custom'
  subtitleRowEstimate: number;                     // métrica para virtual scroll
}
```

Mutación central: todo pasa por `mutate(updater)`, que compara serializaciones para evitar no-ops,
y dispara `schedulePush` (debounce backend 1500 ms).

### 4.6 Componentes de UI

- **`StyleAtomEditor`** — editor genérico de **un** átomo. Renderiza siempre 4 controles:
  1. `<select>` de fuente (lista `FONT_FACES = ['sans-serif','serif','monospace','Arial','Verdana','Times New Roman','Courier Prime, monospace']`; si la fuente actual no está, se añade como opción).
  2. `<input type="number">` de tamaño con `min`/`max` (props `minSize=8`, `maxSize=32`, clamp en onChange).
  3. `<input type="color">` de color.
  4. Dos `<input type="checkbox">`: negrita y cursiva.
  Props: `{ label, atom, onChange, minSize?, maxSize?, disabled? }`. Si `disabled` (preset builtin):
  `opacity-50` + controles deshabilitados.
- **`HomeStylesPanel` / `SubtitleStylesPanel` / `ScriptStylesPanel`** — cada uno: `StylesPresetBar`
  + `BuiltinPresetNotice` (si activo es builtin) + lista de `StyleAtomEditor` (uno por átomo) + Preview.
  Etiquetas legibles por átomo (ej. Home: "Nom d'arxiu", "Format", "Data i hora", "Capçalera taula",
  "Pestanyes navegació", "Breadcrumb", "Vídeo / SRT seleccionat").
- **`StylesPresetBar`** — `<select>` de presets (sufijo "(sistema)" si builtin, "●" si custom),
  indicador "· Canvis no guardats", botón Guardar (abre `SavePresetModal`), botón Eliminar
  (deshabilitado si builtin o custom, confirma con `window.confirm`).
- **`SavePresetModal`** — máquina de 3 pasos: `input` (nombre) → `confirm-overwrite` (si nombre existe)
  → `confirm-global` (admin escribiendo "Per defecte" para empujar default global). Maneja los códigos
  de retorno de `savePreset`.
- **`BuiltinPresetNotice`** — aviso informativo (mensajes distintos para admin vs usuario normal).
- **`HomeStylePreview` / `SubtitleStylePreview` / `ScriptStylePreview`** — previews en vivo que leen
  las CSS vars directamente:
  ```ts
  const cellStyle = (el) => ({
    fontFamily: `var(--us-home-${el}-family)`,
    fontSize:   `var(--us-home-${el}-size)`,
    color:      `var(--us-home-${el}-color)`,
    fontWeight: `var(--us-home-${el}-weight)`,
    fontStyle:  `var(--us-home-${el}-style)`,
  });
  ```

### 4.7 Migración v1→v2 (`userStylesMigration.ts`)

- **v1**: colores hardcoded en hex. **v2**: colores de tema como `var(--th-*)`.
- Tabla de mapeo hex→var (subtitle/home; script no se toca):
  ```ts
  const V1_HEX_TO_V2_THEMEVAR = {
    '#f3f4f6':'var(--th-text-primary)', '#6b7280':'var(--th-text-muted)',
    '#9ca3af':'var(--th-text-secondary)', '#ffffff':'var(--th-text-primary)',
    '#b8b8b8':'var(--th-text-secondary)', '#e5e7eb':'var(--th-editor-text)',
    '#ef4444':'var(--th-accent-text)',
  };
  ```
- `loadOrMigrate({ remote, scopedLocal, legacy })` resuelve la fuente por prioridad:
  remote v2 → remote v1 (migra, `needsPush`) → local v2 (push) → local v1 (migra+push) → factory.
  Devuelve `{ payload, needsPush }`.

---

## 5. Subsistema 3 — Atajos de teclado

> **Este es el subsistema más relevante para el proyecto destino** (editar atajos de las
> "miniaplicaciones"). Está prácticamente listo para reutilizar.

**Archivos:**
- Tipos: `frontend/appTypes.ts`
- Defaults + merge: `frontend/constants.ts`
- Hook runtime: `frontend/hooks/useKeyboardShortcuts.ts`
- Editor UI: `frontend/components/SettingsModal.tsx` (tab "shortcuts")

### 5.1 Modelo de datos

```ts
export interface Shortcut {
  id: string;       // único, p.ej. 'g_undo', 'sub_split'
  action: string;   // constante de acción que se despacha, p.ej. 'UNDO', 'SPLIT_SEGMENT'
  label: string;    // texto legible (UI), p.ej. 'Desfer'
  combo: string;    // combinación, p.ej. 'Ctrl+Z', 'Ctrl+Shift+K', 'Alt+N'
}

export interface AppShortcuts {
  general: Shortcut[];          // se fusionan en TODOS los scopes
  scriptEditor: Shortcut[];
  videoEditor: Shortcut[];
  subtitlesEditor: Shortcut[];
}
```

Los **scopes** (`general`, `scriptEditor`, `videoEditor`, `subtitlesEditor`) son el equivalente a las
"miniaplicaciones" del proyecto destino.

### 5.2 Atajos por defecto (`DEFAULT_SHORTCUTS`) — inventario completo

```ts
export const DEFAULT_SHORTCUTS: AppShortcuts = {
  general: [
    { id: 'g_undo', action: 'UNDO', label: 'Desfer',          combo: 'Ctrl+Z' },
    { id: 'g_redo', action: 'REDO', label: 'Refer',           combo: 'Ctrl+Shift+Z' },
    { id: 'g_save', action: 'SAVE', label: 'Guardar canvis',  combo: 'Ctrl+S' },
  ],
  scriptEditor: [
    { id: 'se_mode_csv', action: 'MODE_CSV', label: 'Canviar a mode Dades', combo: 'Ctrl+M' },
  ],
  videoEditor: [
    { id: 've_play', action: 'TOGGLE_PLAY', label: 'Reproduir / Pausa', combo: 'Ctrl+Space' },
  ],
  subtitlesEditor: [
    { id: 'sub_new',          action: 'INSERT_SUBTITLE',       label: 'Nou subtítol (playhead)',     combo: 'Alt+N' },
    { id: 'sub_delete',       action: 'DELETE_SEGMENT',        label: 'Esborrar subtítol',           combo: 'Delete' },
    { id: 'sub_delete_active',action: 'DELETE_ACTIVE_SEGMENT', label: 'Esborrar subtítol actiu',     combo: 'Shift+Delete' },
    { id: 'sub_split',        action: 'SPLIT_SEGMENT',         label: 'Dividir subtítol al cursor',  combo: 'Ctrl+K' },
    { id: 'sub_split_ph',     action: 'SPLIT_AT_PLAYHEAD',     label: 'Dividir al playhead',         combo: 'Ctrl+Shift+K' },
    { id: 'sub_merge',        action: 'MERGE_SEGMENT',         label: 'Unir amb següent',            combo: 'Ctrl+Shift+M' },
    { id: 'sub_play',         action: 'TOGGLE_PLAY_PAUSE',     label: 'Reproduir / Pausa',           combo: 'Ctrl+Space' },
    { id: 'sub_next_line',    action: 'NAVIGATE_NEXT_LINE',    label: 'Següent línia / subtítol',    combo: 'Ctrl+Enter' },
    { id: 'sub_prev_line',    action: 'NAVIGATE_PREV_LINE',    label: 'Anterior línia / subtítol',   combo: 'Ctrl+Shift+Enter' },
    { id: 'sub_set_tc_in',    action: 'SET_TC_IN',             label: 'Marcar TC IN al playhead',    combo: 'Q' },
    { id: 'sub_set_tc_out',   action: 'SET_TC_OUT',            label: 'Marcar TC OUT al playhead',   combo: 'W' },
  ],
};
```

### 5.3 Merge de overrides (no perder defaults nuevos)

```ts
// Solo sobreescribe el campo `combo` por id; los defaults nuevos no presentes en overrides se mantienen.
export function mergeShortcuts(defaults, overrides) {
  if (!overrides) return defaults;
  const result = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const overs = overrides[key];
    if (!overs) continue;
    result[key] = defaults[key].map(def => {
      const ov = overs.find(s => s.id === def.id);
      return ov ? { ...def, combo: ov.combo } : def;
    });
  }
  return result;
}
```

> **Importante:** el modelo actual es **"remap only"** — el usuario solo puede reasignar combos de
> atajos existentes, no crear/eliminar atajos. Para el proyecto destino esto es exactamente lo que se
> quiere (cada miniaplicación declara sus acciones; el usuario solo cambia teclas).

### 5.4 Hook runtime `useKeyboardShortcuts`

```ts
useKeyboardShortcuts(
  appId: keyof AppShortcuts,   // scope activo: 'general' | 'scriptEditor' | 'videoEditor' | 'subtitlesEditor'
  onAction: (action: string) => void,
  enabled: boolean = true,
)
```

Comportamiento:
1. **Cache de atajos en module-scope**: lee `localStorage[snlbpro_shortcuts]` y solo re-parsea JSON si
   cambió el string (evita parsear en cada keydown). Fallback a `DEFAULT_SHORTCUTS`.
2. **Listener global** `window.addEventListener('keydown', ...)`, limpiado en cleanup.
3. **Ignora atajos al escribir**: si el foco está en `INPUT`/`TEXTAREA`/`contentEditable` y la tecla es
   un carácter sin modificador, retorna (no intercepta el texto). Con modificador (Ctrl/Cmd/Alt) sí actúa.
4. **Normalización del combo**:
   - `ctrlKey || metaKey` → `'Ctrl'` (Cmd de Mac se normaliza a Ctrl).
   - `shiftKey` → `'Shift'`, `altKey` → `'Alt'`.
   - Teclas especiales mapeadas: Space→`Space`, Plus→`Plus`, Minus→`Minus`, Comma→`Comma`; letras → MAYÚSCULA.
   - Formato final: `parts.join('+').replace('Meta','Ctrl').replace(/\s+/g,'')`.
5. **Matching**: fusiona `general` + atajos del `appId`; compara combos sin espacios y case-insensitive.
   Al hacer match: `e.preventDefault()` + `onAction(found.action)`.

Sitios de uso (cada vista cablea su `switch(action)`):
- `App.tsx` (scriptEditor: UNDO/REDO/SAVE).
- `VideoSubtitlesEditorView.tsx` (editor completo: ~14 acciones).
- `VideoSrtStandaloneEditorView.tsx` (editor SRT standalone: subconjunto).

### 5.5 Editor de atajos (tab "Dreceres" del `SettingsModal`)

- **Persistencia**: `useLocalStorage<AppShortcuts>(LOCAL_STORAGE_KEYS.SHORTCUTS, DEFAULT_SHORTCUTS)`;
  además `mergeShortcuts(DEFAULT_SHORTCUTS, shortcuts)` para mostrar siempre defaults+overrides.
- **Selector de scope/app** (4 botones), **botón "Reset all"**, tabla de atajos del scope activo.
- **Grabación de combo**: clic en la celda → entra en modo "recording" (input autofocus). `onKeyDown`:
  ```ts
  function handleKeyCapture(e) {
    e.preventDefault(); e.stopPropagation();
    if (['Control','Shift','Alt','Meta'].includes(e.key)) return;  // modificador solo: ignorar
    if (e.key === 'Escape') { /* cancelar grabación */ return; }
    const combo = comboFromEvent(e);  // misma normalización que el hook
    if (combo && recordingId) { updateCombo(recordingId, combo); }
  }
  ```
- **Detección de conflictos** (`findDuplicate`): rechaza combos duplicados **dentro del mismo scope**
  (permite el mismo combo en scopes distintos). Muestra alerta roja.
- **Reset por atajo**: icono de reset visible solo si el combo difiere del default.
- **Sync backend**: si `USE_BACKEND && me`: `api.updateMe({ preferences: { shortcuts: updated } })`.

---

## 6. Subsistema 4 — Ajustes "General" (preferencias sueltas)

Preferencias simples persistidas directamente con `useLocalStorage`, sin context dedicado. Editadas
en la tab "General" del modal, organizadas en secciones:

| Sección | Preferencia | Clave localStorage | Tipo/rango |
|---------|-------------|--------------------|------------|
| Interfície | Ancho de biblioteca | `LIBRARY_WIDTH` | number (px) |
| Editor subtítols | Máx. líneas por subtítulo | `MAX_LINES_SUBS` | number 1–8 |
| Editor subtítols | Opacidad de la rejilla | `SUB_GRID_OPACITY` | range 0–1 |
| Editor subtítols | Gap mínimo entre subtítulos | `EDITOR_MIN_GAP_MS` | number (ms) |
| Editor subtítols | Tiempo de hold en waveform para drag | `WAVEFORM_HOLD_MS` | range 0–2000 (ms) |
| Sincronización vídeo | Margen pre-roll del TAKE | `TAKE_START_MARGIN` | number (s) |
| Sincronización vídeo | Margen post-roll del TAKE | `TAKE_MARGIN` | number (s) |
| Factory Reset | Botón → abre `FactoryResetConfirmModal` | — | — |

Patrón de cada control: input controlado + `useLocalStorage` → se aplica inmediatamente, sin botón
"guardar" explícito.

---

## 7. Subsistema 5 — Presets de Whisper (backend per-usuario)

Configuraciones de transcripción guardadas por usuario. **No** se editan en `SettingsModal`, sino en
`CreateProjectModal`, pero forman parte del backend de settings.

```ts
export interface WhisperConfig {
  engine: string;
  model: string;
  language: string;
  batchSize: number;
  device: 'cpu' | 'cuda';
  timingFix: boolean;
  diarization: boolean;
  minSubGapMs: number;
  enforceMinSubGap: boolean;
}
```

API frontend (`api.ts`):
```ts
api.getWhisperPresets(): Promise<Record<string, WhisperConfig>>          // GET  /settings/whisper-presets
api.saveWhisperPreset(name, config): Promise<void>                       // POST /settings/whisper-presets
api.deleteWhisperPreset(name): Promise<void>                             // DELETE /settings/whisper-presets/:name
```

> **⚠️ Estado real:** el `UserSettingsService` del backend está **declarado pero no implementado**
> (los endpoints están cableados en el controller pero el service no existe en disco). Al portar,
> implementar los 3 métodos `getWhisperPresets/saveWhisperPreset/deleteWhisperPreset` (ver §10.4).

---

## 8. Persistencia: localStorage + backend

### 8.1 Registro completo de claves localStorage (`frontend/constants.ts`)

```ts
export const LOCAL_STORAGE_KEYS = {
  SHORTCUTS: 'snlbpro_shortcuts',
  EDITOR_STYLES: 'snlbpro_editor_styles',          // @deprecated → snlbpro_user_styles_<userId>
  LIBRARY_WIDTH: 'snlbpro_library_width',
  LIBRARY_NAME_COL_WIDTH: 'snlbpro_library_name_col_width',
  LIBRARY_FORMAT_COL_WIDTH: 'snlbpro_library_format_col_width',
  LIBRARY_DATE_COL_WIDTH: 'snlbpro_library_date_col_width',
  TAKE_MARGIN: 'snlbpro_take_margin',
  TAKE_START_MARGIN: 'snlbpro_take_start_margin',
  MAX_LINES_SUBS: 'snlbpro_max_lines_subs',
  SUB_GRID_OPACITY: 'snlbpro_sub_grid_opacity',
  WAVEFORM_HOLD_MS: 'snlbpro_waveform_hold_ms',
  AUTOSAVE_SRT: 'snlbpro_autosave_srt',
  TASKS_TRANSLATION: 'snlbpro_tasks_translation',
  TASKS_TRANSCRIPTION: 'snlbpro_tasks_transcription',
  SRT_EDITOR_MODE: 'snlbpro_srt_editor_mode',       // 'editor-video-subs' | 'editor-srt-standalone'
  EDITOR_MIN_GAP_MS: 'snlbpro_editor_min_gap_ms',
  THEME: 'snlbpro_theme',                           // PRESERVADO en factory reset
  CUSTOM_THEME_TOKENS: 'snlbpro_custom_theme_tokens',
  TASKS_IA_HIDDEN_IDS: 'snlbpro_tasks_ia_hidden_ids',
  PUJADES_HISTORY: 'snlbpro_pujades_history',       // máx 50 registros
  ACTIVE_PAGE: 'snlbpro_active_page',               // library | media | projects
  ACTIVE_VIEW: 'snlbpro_active_view',               // library | trash
  ACTIVE_FOLDER: 'snlbpro_active_folder',
  MEDIA_VIEW_MODE: 'snlbpro_media_view_mode',       // list | grid
  MEDIA_GROUP_BY: 'snlbpro_media_group_by',         // none | type | format | date
  MEDIA_TYPE_FILTER: 'snlbpro_media_type_filter',   // all | video | audio
  MEDIA_SORT_BY: 'snlbpro_media_sort_by',
  MEDIA_SORT_ORDER: 'snlbpro_media_sort_order',     // asc | desc
};
```

Claves **fuera** de ese objeto (con prefijo distinto):
- `snlbpro_user_styles_<userId>` — payload de User Styles (scoped por usuario).
- `sonilab_token` — JWT de auth.
- `sonilab_guion_<docId>` — borradores de guion.

### 8.2 Dos prefijos, regla de oro

| Prefijo | Propósito | Factory reset |
|---------|-----------|---------------|
| `snlbpro_*` | Preferencias de UI, atajos, estilos, historial | Se limpia (blocklist explícito) |
| `sonilab_*` | Auth y borradores | Se preserva |

> **Regla crítica:** las operaciones destructivas (reset) usan **blocklist explícito**, nunca un
> barrido por prefijo, porque ambos prefijos conviven y `sonilab_*` no debe tocarse.

### 8.3 Hook `useLocalStorage`

```ts
function useLocalStorage<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>]
```
Lee al inicializar, escribe en cada setState, y emite/escucha un `StorageEvent` para sincronización
entre pestañas. (Nota: la sync cross-tab está **deshabilitada deliberadamente en User Styles** porque
causaba un bucle ping-pong; ahí se usa recarga manual.)

### 8.4 Backend de preferencias (`/auth/me`)

```ts
api.me()                         // GET  /auth/me  → { id, email, name, role, preferences, globalStyles }
api.updateMe({ preferences })    // PATCH /auth/me → guarda preferences (userStyles, shortcuts, customThemeTokens)
api.patchGlobalStyles({ scope, styles })   // PATCH /settings/global-styles (admin)
```

`preferences` es el contenedor per-usuario de:
- `preferences.userStyles` → `UserStylesPayload` (debounce 1500 ms).
- `preferences.shortcuts` → overrides de `AppShortcuts`.
- `preferences.customThemeTokens` → tokens del tema custom.

### 8.5 Orden de providers en arranque (`index.tsx` → `App.tsx`)

```
applyPendingFactoryReset()          // ANTES de montar React (limpia localStorage si hay reset pendiente)
ReactDOM.createRoot().render(<App/>)
  └─ <ThemeProvider>                 // aplica tema a :root
       └─ <AuthProvider>             // carga me vía api.me()
            └─ <UserStylesProvider>  // necesita me.id para cargar/migrar; aplica --us-* a :root
                 └─ <LibraryProvider><UploadProvider><MainAppContent/>
```

El orden importa: `AuthProvider` antes que `UserStylesProvider` (este necesita `me.id` para la clave
scoped y el remote). `applyPendingFactoryReset` corre **antes** de React para que los `useEffect` de
persistencia no reescriban claves recién borradas.

---

## 9. Factory Reset (restablecer de fábrica)

**Archivo:** `frontend/utils/factoryReset.ts`. Arquitectura en **dos fases** (porque hay que recargar
la página para reconstruir el estado limpio):

### Fase A — `factoryReset()` (antes de recargar)
1. Reset backend: `await api.updateMe({ preferences: { shortcuts: null, customThemeTokens: null } })`.
2. Notifica a otras pestañas: `new BroadcastChannel('snlbpro-factory-reset')`.
3. Pone flags en `sessionStorage`: `PENDING_FLAG = 'snlbpro_factory_reset_pending'`,
   `WARN_FLAG = 'snlbpro_factory_reset_warn'`.
4. Recarga la página.

### Fase B — `applyPendingFactoryReset()` (antes de montar React, en `index.tsx`)
- Lee `PENDING_FLAG`; si está, borra de `localStorage` todas las claves del **blocklist** `KEYS_TO_REMOVE`:
  ```
  SHORTCUTS, EDITOR_STYLES, LIBRARY_WIDTH, LIBRARY_NAME_COL_WIDTH, LIBRARY_FORMAT_COL_WIDTH,
  LIBRARY_DATE_COL_WIDTH, TAKE_MARGIN, TAKE_START_MARGIN, MAX_LINES_SUBS, SUB_GRID_OPACITY,
  WAVEFORM_HOLD_MS, AUTOSAVE_SRT, TASKS_TRANSLATION, TASKS_TRANSCRIPTION, SRT_EDITOR_MODE,
  EDITOR_MIN_GAP_MS, CUSTOM_THEME_TOKENS, 'snlbpro_library_v3'
  ```
  y la clave scoped `CUSTOM_THEME_TOKENS_<userId>` si hay userId.

### Qué se PRESERVA (deliberadamente)
- `snlbpro_theme` (elección de tema).
- `sonilab_token` (auth — reset ≠ logout).
- `sonilab_guion_<docId>` (borradores).
- `snlbpro_user_styles_<userId>` y `preferences.userStyles` (trabajo creativo del usuario).

---

## 10. Backend NestJS de settings

**Módulo:** `backend_nest_mvp/src/modules/settings/`

### 10.1 Schema global (`settings.schema.ts`)

```ts
@Schema({ timestamps: true })
export class GlobalSettings {
  @Prop({ required: true, unique: true, index: true })
  settingKey: string;                              // siempre 'global'
  @Prop({ type: Object, default: {} })
  userStyles: { scriptEditor?: any; subtitleEditor?: any; home?: any };
}
```
Singleton (`settingKey: 'global'`). Guarda los **estilos globales** que un admin empuja a todos.

### 10.2 Schema per-usuario (`user-settings.schema.ts`)

```ts
@Schema({ timestamps: true })
export class UserSettings {
  @Prop({ required: true, unique: true, index: true })
  userId: string;
  @Prop({ type: Object, default: {} })
  whisperPresets: Record<string, WhisperConfig>;   // key = nombre del preset
}
```

### 10.3 Endpoints (`settings.controller.ts`)

| Método | Ruta | Guard | Body | Respuesta |
|--------|------|-------|------|-----------|
| GET | `/settings/global-styles` | `JwtAuthGuard` | — | `{ scriptEditor?, subtitleEditor?, home? } \| null` |
| PATCH | `/settings/global-styles` | `JwtAuthGuard` + `RolesGuard('admin')` | `{ scope, styles }` | `{ ok: true }` |
| GET | `/settings/whisper-presets` | `JwtAuthGuard` | — | `Record<string, WhisperConfig>` |
| POST | `/settings/whisper-presets` | `JwtAuthGuard` (HttpCode 200) | `{ name, config }` | `{ ok: true }` |
| DELETE | `/settings/whisper-presets/:name` | `JwtAuthGuard` | — | `{ ok: true }` |

`userId` se extrae del JWT vía decorator `@CurrentUser() user: RequestUser` (`{ userId, email, role }`).

### 10.4 Service implementado (`settings.service.ts`)

```ts
const SETTING_KEY = 'global';

async getGlobalStyles() {
  const doc = await this.settingsModel.findOne({ settingKey: SETTING_KEY }).lean();
  const styles = doc?.userStyles;
  if (!styles || Object.keys(styles).length === 0) return null;
  return styles;
}

async updateGlobalStylesScope(scope, styles) {
  await this.settingsModel.findOneAndUpdate(
    { settingKey: SETTING_KEY },
    { $set: { [`userStyles.${scope}`]: styles } },
    { upsert: true, new: true },
  );
}
```

### 10.5 Service PENDIENTE de implementar (`UserSettingsService`)

Declarado en el módulo y usado por el controller, **sin archivo en disco**. Implementación esperada:

```ts
@Injectable()
export class UserSettingsService {
  constructor(@InjectModel(UserSettings.name) private model: Model<UserSettingsDocument>) {}

  async getWhisperPresets(userId: string) {
    const doc = await this.model.findOne({ userId }).lean();
    return doc?.whisperPresets ?? {};
  }
  async saveWhisperPreset(userId: string, name: string, config: WhisperConfig) {
    await this.model.findOneAndUpdate(
      { userId }, { $set: { [`whisperPresets.${name}`]: config } }, { upsert: true, new: true },
    );
  }
  async deleteWhisperPreset(userId: string, name: string) {
    await this.model.findOneAndUpdate({ userId }, { $unset: { [`whisperPresets.${name}`]: 1 } });
  }
}
```

### 10.6 Módulo (`settings.module.ts`)

```ts
@Module({
  imports: [MongooseModule.forFeature([
    { name: GlobalSettings.name, schema: GlobalSettingsSchema },
    { name: UserSettings.name,   schema: UserSettingsSchema },
  ])],
  providers: [SettingsService, UserSettingsService, RolesGuard],
  controllers: [SettingsController],
  exports: [SettingsService, UserSettingsService],
})
export class SettingsModule {}
```

---

## 11. Recetario de adaptación a otro proyecto

Guía paso a paso para construir un panel de ajustes equivalente que edite **atajos de las
miniaplicaciones** y **colores de temas**.

### 11.1 Atajos de teclado para "miniaplicaciones"

El modelo `AppShortcuts` ya encaja: cada **miniaplicación = un scope**. Pasos:

1. **Define los scopes** como claves de `AppShortcuts` (una por miniapp). Sustituye
   `scriptEditor/videoEditor/subtitlesEditor` por las tuyas; mantén `general` para atajos globales.
2. **Declara `DEFAULT_SHORTCUTS`**: por cada miniapp, lista sus `Shortcut` con `id` único, `action`
   (la constante que tu app despacha), `label` legible y `combo` por defecto.
3. **Copia tal cual**: `mergeShortcuts`, `useKeyboardShortcuts`, `comboFromEvent`, `findDuplicate`.
   Son lógica pura y portable. Ajusta solo el nombre de la clave localStorage.
4. **Cablea cada miniapp**: `useKeyboardShortcuts('miMiniApp', (action) => switch(action){...}, enabled)`.
5. **Reutiliza el editor** (tab "shortcuts" de `SettingsModal`): selector de scope + tabla con
   grabación de combo + detección de conflictos por scope + reset por atajo.
6. **Persistencia**: `localStorage` (clave única) y opcionalmente backend (`preferences.shortcuts`).

> Si necesitas **añadir/eliminar** atajos (no solo remapear), extiende el editor para permitir crear
> filas; el resto del pipeline (merge por id, matching) lo soporta sin cambios estructurales.

### 11.2 Colores de temas

1. **Copia `themes.ts`**: cambia los valores de los 4 temas y, sobre todo, **decide tu set de tokens**.
   La clave es mantener un único catálogo de tokens compartido por todos los temas.
2. **Define `TOKEN_GROUPS`**: agrupa tus tokens semánticamente; esto alimenta automáticamente el
   editor de tema personalizado (un color-picker por token).
3. **Implementa `ThemeContext`** (en este repo falta el archivo; impleméntalo con el contrato §3.5):
   - Estado `themeId` (persistido en `localStorage`), `theme` resuelto vía `getThemeById`.
   - `customTokens` (persistidos), `setCustomTokens`, `resetCustomTokensFromPreset`.
   - `useEffect`: aplica `theme.tokens` a `:root` como `--th-<key>` con `setProperty`.
4. **Consume en componentes**: `style={{ color: 'var(--th-accent)' }}` o clases Tailwind con `var()`.
5. **Reutiliza la tab "theme"** del `SettingsModal`: grid de presets (usa `preview` para los cuadritos)
   + card de personalizado + editor que recorre `TOKEN_GROUPS` con `TokenRow` (color picker + text con
   validación CSS + patrón draft).

### 11.3 Estilos tipográficos por contexto (opcional, si aplica)

Solo si tu app tiene áreas con tipografía configurable. Reutiliza el patrón `StyleAtom` + scopes +
presets + `applyUserStylesToDOM` (CSS vars `--us-*`) + `StyleAtomEditor`. Es el subsistema más
complejo; portarlo solo si lo necesitas.

### 11.4 Estructura del modal

Reutiliza el esqueleto de `SettingsModal` (§2.4): backdrop + contenedor con header/tabs/contenido/footer,
todo tematizado con `var(--th-*)`. Añade una pestaña por subsistema que quieras exponer.

### 11.5 Patrones transversales a copiar

- **CSS vars como puente** (§1.2): estado → `:root` → `var()`. No prop-drilling, no flicker.
- **Persistencia híbrida**: `localStorage` inmediato + backend con **debounce** (1500 ms) + flush
  manual (`savePayloadNow`) para el botón Guardar.
- **Versionado del payload** + función de migración (`loadOrMigrate`) para evolucionar el esquema.
- **Blocklist explícito** para reset, nunca barrido por prefijo.
- **Merge de overrides por id** para no perder defaults nuevos al actualizar la app.
- **Preservar el trabajo creativo** del usuario en los resets (estilos/presets/borradores).

---

## 12. Inventario de archivos del sistema

### Frontend
| Archivo | Rol |
|---------|-----|
| `frontend/components/SettingsModal.tsx` | Modal contenedor + tabs General/Theme/Shortcuts + editor de tema custom |
| `frontend/components/Settings/UserStyles/StylesTab.tsx` | Sub-tabs de User Styles |
| `frontend/components/Settings/UserStyles/{Home,Subtitle,Script}StylesPanel.tsx` | Paneles de edición por scope |
| `frontend/components/Settings/UserStyles/StyleAtomEditor.tsx` | Editor genérico de un átomo (fuente/tamaño/color/bold/italic) |
| `frontend/components/Settings/UserStyles/StylesPresetBar.tsx` | Selector de preset + Guardar/Eliminar |
| `frontend/components/Settings/UserStyles/SavePresetModal.tsx` | Modal de guardado (input/overwrite/global) |
| `frontend/components/Settings/UserStyles/BuiltinPresetNotice.tsx` | Aviso de preset de sistema |
| `frontend/components/Settings/UserStyles/{Home,Subtitle,Script}StylePreview.tsx` | Previews en vivo |
| `frontend/context/Theme/themes.ts` | Definición de temas + tokens + TOKEN_GROUPS + helpers |
| `frontend/context/Theme/ThemeContext.tsx` | **(ausente en disco)** Provider de tema — contrato en §3.5 |
| `frontend/context/UserStyles/UserStylesContext.tsx` | Estado, mutaciones, persistencia de User Styles |
| `frontend/context/UserStyles/factoryStyles.ts` | Estilos de fábrica por scope |
| `frontend/context/UserStyles/applyUserStylesToDOM.ts` | Volcado a CSS vars `--us-*` + métricas |
| `frontend/context/UserStyles/userStylesMigration.ts` | Migración v1→v2 y `loadOrMigrate` |
| `frontend/types/UserStyles/userStylesTypes.ts` | Tipos del subsistema User Styles |
| `frontend/hooks/useKeyboardShortcuts.ts` | Hook runtime de atajos |
| `frontend/hooks/useLocalStorage.ts` | Hook de persistencia reactiva |
| `frontend/utils/factoryReset.ts` | Reset de fábrica en dos fases |
| `frontend/constants.ts` | `LOCAL_STORAGE_KEYS`, `DEFAULT_SHORTCUTS`, `mergeShortcuts` |
| `frontend/appTypes.ts` | Tipos `Shortcut`, `AppShortcuts` |
| `frontend/services/api.ts` | Cliente HTTP: `me`, `updateMe`, `patchGlobalStyles`, whisper presets |

### Backend
| Archivo | Rol |
|---------|-----|
| `backend_nest_mvp/src/modules/settings/settings.controller.ts` | Endpoints REST |
| `backend_nest_mvp/src/modules/settings/settings.service.ts` | Estilos globales (implementado) |
| `backend_nest_mvp/src/modules/settings/user-settings.service.ts` | **(ausente)** Whisper presets per-usuario |
| `backend_nest_mvp/src/modules/settings/settings.schema.ts` | Schema `GlobalSettings` |
| `backend_nest_mvp/src/modules/settings/user-settings.schema.ts` | Schema `UserSettings` + `WhisperConfig` |
| `backend_nest_mvp/src/modules/settings/settings.module.ts` | Wiring del módulo |
| `backend_nest_mvp/src/modules/auth/auth.controller.ts` | `GET/PATCH /auth/me` (preferences) |

### Documentación de dominio (en el repo origen)
| Archivo | Contenido |
|---------|-----------|
| `.claude/docs/domains/user-styles.md` | Reglas del subsistema User Styles (anti-flicker, persistencia) |
| `.claude/docs/domains/localstorage.md` | Reglas de claves localStorage y reset |

---

*Documento generado como referencia de portabilidad. No modifica código del proyecto Sonilab.*
