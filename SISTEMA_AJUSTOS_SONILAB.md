# Sistema d'Ajustos (Configuració) de Sonilab — Guia completa per reimplementar-lo

> **Per a qui és aquest document.** Per a una IA (o persona) que ha de replicar el sistema
> d'Ajustos de Sonilab en **una altra aplicació que corre en local amb Electron**. Assumeix
> que **NO saps res** d'aquesta app: aquí tens la teoria, el model mental, i codi real
> copiat literalment perquè puguis decidir què reutilitzar i com adaptar-ho.
>
> **Stack original:** React + Vite + TypeScript + Tailwind CSS. Estat via Context API +
> `localStorage` + un backend NestJS opcional. Res d'això és obligatori per a tu: al final
> hi ha una secció d'**adaptació a Electron** que explica què treure.
>
> **Nota sobre ADMIN (important).** A Sonilab, algunes accions (guardar un preset d'estils
> *global* per a tots els usuaris) requereixen rol `admin` perquè hi ha multi-usuari i un
> backend compartit. **A la teva app local d'Electron això no cal**: no hi ha usuaris ni
> servidor, cada instal·lació és d'una sola persona. Tot i així ho documento igualment i marco
> cada punt amb `[ADMIN]` perquè tinguis el quadre complet i decideixis. On vegis `[ADMIN]`,
> a la teva app pots **eliminar la comprovació i deixar l'acció sempre disponible**.

---

## 0. Índex mental — què hi ha dins de "Configuració"

El modal de Configuració agrupa **tres sistemes completament independents** + un bloc
d'ajustos solts. Entendre que són independents és la clau de tot:

| Sistema | Pestanya(es) | Què controla | Variables CSS | On es guarda |
|---|---|---|---|---|
| **1. Tema / Colors** | `Tema` | Paleta de colors global de tota l'app (fons, text, accent, editor, ona…) | `--th-*` | localStorage + backend |
| **2. Estils d'usuari** | `Estils` | Tipografia (font, mida, color, negreta/cursiva) per zones concretes | `--us-*` | localStorage + backend |
| **3. Dreceres de teclat** | `Dreceres` | Combinacions de tecles, **agrupades per subaplicació** | — (no CSS) | localStorage + backend |
| **4. Ajustos solts** | `General`, `Lector` | Valors numèrics/booleans varis (amplada llibreria, fps, marges…) | — | localStorage |

Els tres sistemes segueixen **el mateix patró conceptual**:

```
Definició de VALORS PER DEFECTE (al codi, font de veritat)
        │
        ▼
CONTEXT de React (provider) que manté l'estat viu
        │
        ├──► escriu CSS custom properties a document.documentElement  (temes i estils)
        ├──► persisteix a localStorage  (i opcionalment a un backend)
        └──► exposa un hook (useTheme / useUserStyles) perquè la UI llegeixi/modifiqui
```

La idea central de temes i estils és **no acoblar el color/tipografia als components**: els
components escriuen `color: var(--th-text-primary)` o `fontSize: var(--us-sub-content-size)`,
i qui canvia el valor de la variable és el sistema d'ajustos. Canviar un token repinta tota
l'app instantàniament sense re-renderitzar res de React.

---

## 1. El modal de Configuració i el sistema de pestanyes

Fitxer: `frontend/components/SettingsModal.tsx` (~1176 línies). És un modal overlay amb una
fila de pestanyes a dalt. Les pestanyes de primer nivell són:

```ts
type ActiveTab = 'general' | 'estils' | 'shortcuts' | 'reader' | 'theme';
```

Renderitzades així (fixa't que és una simple màquina d'estats amb `useState`):

```tsx
const [activeTab, setActiveTab] = useState<ActiveTab>('general');

// ... capçalera del modal ...

<div className="flex" style={{ backgroundColor: 'var(--th-bg-primary)', borderBottom: '1px solid var(--th-border)' }}>
   <TabButton tabId="general"   label="General" />
   <TabButton tabId="theme"     label="Tema" />
   <TabButton tabId="estils"    label="Estils" />
   <TabButton tabId="shortcuts" label="Dreceres" />
   <TabButton tabId="reader"    label="Lector" />
</div>

<div className="p-8 overflow-y-auto flex-grow">
  {activeTab === 'shortcuts' ? <ShortcutsTab /> :
   activeTab === 'theme'     ? ( /* editor de tema, veure §2 */ ) :
   activeTab === 'estils'    ? <StylesTab /> :
   activeTab === 'general'   ? ( /* ajustos solts, veure §4 */ ) :
   ( /* 'reader' → placeholder "properament" */ )}
</div>
```

El botó de pestanya, per referència visual (usa els tokens de tema per pintar-se, cosa que
demostra el punt anterior — la pròpia UI d'ajustos consumeix `--th-*`):

```tsx
const TabButton: React.FC<{ tabId: ActiveTab; label: string; disabled?: boolean }> = ({ tabId, label, disabled }) => {
  const isActive = activeTab === tabId;
  return (
    <button
      onClick={() => !disabled && setActiveTab(tabId)}
      disabled={disabled}
      className="px-6 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2"
      style={isActive
        ? { borderColor: 'var(--th-accent)', color: 'var(--th-text-primary)' }
        : { borderColor: 'transparent', color: 'var(--th-text-muted)' }
      }
    >
      {label}
    </button>
  );
};
```

**Concepte clau: dos nivells de pestanyes.** Dins d'algunes pestanyes de primer nivell hi ha
un **segon nivell** de subpestanyes:

- `Estils` → subpestanyes `Inici` / `Editor de subtítols` / `Editor de guions` (una per *scope* d'estil).
- `Dreceres` → subpestanyes `General` / `Editor Guions` / `Reproductor Vídeo` / `Subtítols SRT`
  (una per **subaplicació**). Aquesta és exactament la jerarquia "dins de dreceres hi ha les de
  cada subaplicació" que buscaves.

---

## 2. Sistema de TEMA / COLORS (`--th-*`)

### 2.1 Model mental

Un **tema** és un diccionari de *tokens semàntics* → color. "Semàntic" vol dir que el token
no es diu `red` sinó `accent`, no es diu `#121212` sinó `bg-primary`. Els components mai
escriuen un hex; escriuen `var(--th-accent)`. Canviar de tema = reescriure tots els
`--th-*` a l'arrel del document.

Hi ha **4 temes predefinits** (presets) + **1 tema personalitzat** que l'usuari edita token
a token.

Fitxers:
- `frontend/context/Theme/themes.ts` — definició dels temes i metadata d'edició.
- `frontend/context/Theme/ThemeContext.tsx` — provider: aplica al DOM, persisteix, exposa `useTheme`.

### 2.2 Estructura d'un tema

```ts
export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  /** Colors de mostra per a la previsualització (4 quadradets) */
  preview: [string, string, string, string];
  /** Tokens CSS SENSE el prefix -- (s'afegeix --th- en aplicar-los) */
  tokens: Record<string, string>;
}
```

Exemple real del tema per defecte (retallat — són ~90 tokens; aquí els grups principals):

```ts
export const THEME_SONILAB: ThemeDefinition = {
  id: 'sonilab',
  name: 'Sonilab',
  description: 'Tema corporatiu: negre profund, accent vermell',
  preview: ['#0A0A0A', '#161616', '#C40000', '#FFFFFF'],
  tokens: {
    // Fons
    'bg-app':         '#0A0A0A',
    'bg-primary':     '#121212',
    'bg-secondary':   '#1A1A1A',
    'bg-tertiary':    '#242424',
    'bg-surface':     '#161616',
    'bg-hover':       'rgba(255, 255, 255, 0.06)',
    'bg-active':      'rgba(196, 0, 0, 0.15)',
    'bg-overlay':     'rgba(0, 0, 0, 0.88)',
    // Textos (jerarquia)
    'text-primary':   '#FFFFFF',
    'text-secondary': '#B8B8B8',
    'text-muted':     '#808080',
    'text-disabled':  '#555555',
    'text-inverse':   '#0A0A0A',
    // Bordes
    'border':         '#2A2A2A',
    'border-strong':  '#3A3A3A',
    'border-subtle':  'rgba(255, 255, 255, 0.08)',
    // Accent + botons
    'accent':         '#C40000',
    'accent-hover':   '#E00000',
    'accent-muted':   'rgba(196, 0, 0, 0.20)',
    'accent-text':    '#FF4444',
    'btn-primary-bg':   '#C40000',
    'btn-primary-hover':'#A80000',
    'btn-primary-text': '#FFFFFF',
    // Estats
    'success': '#22c55e', 'warning': '#eab308', 'error': '#ef4444', 'info': '#38bdf8',
    // Editor de subtítols (colors específics del subsistema)
    'editor-bg': '#121212', 'editor-text': '#FFFFFF', 'editor-timecode': '#B8B8B8', /* … */
    // Timeline / ona d'àudio
    'waveform-bg': '#0E0E0E', 'waveform-bar': 'rgba(180,180,180,0.45)', 'waveform-seg-border': '#C40000', /* … */
    // Alertes, badges, tabs, links, focus…
    'tab-active-bg': '#C40000', 'link': '#FF4444', 'focus-ring': 'rgba(196,0,0,0.5)', /* … */
  },
};
```

Els altres 3 presets (`THEME_DARK` blau neutre, `THEME_LIGHT` clar, `THEME_MIDNIGHT` blau
profund) tenen **exactament les mateixes claus** amb valors diferents. Aquesta és una regla
d'or: **tots els temes han de definir el mateix conjunt de tokens**, si no, en canviar de
tema quedarien variables sense actualitzar.

```ts
export const PRESET_THEMES: ThemeDefinition[] = [THEME_SONILAB, THEME_DARK, THEME_LIGHT, THEME_MIDNIGHT];
export const DEFAULT_THEME_ID = 'sonilab';
export const CUSTOM_THEME_ID = 'custom';
```

### 2.3 Tema personalitzat (construcció + editor per grups)

El tema custom es construeix fent *merge* de tokens arbitraris de l'usuari sobre el tema base,
de manera que **sempre estiguin totes les claus** encara que l'usuari només n'hagi tocat una:

```ts
export function buildCustomTheme(tokens: Record<string, string>): ThemeDefinition {
  const merged = { ...THEME_SONILAB.tokens, ...tokens };  // base garanteix completesa
  return {
    id: CUSTOM_THEME_ID,
    name: 'Personalitzat',
    description: 'Tema personalitzat amb colors definits per l\'usuari',
    preview: [merged['bg-app'], merged['bg-surface'], merged['accent'], merged['text-primary']],
    tokens: merged,
  };
}
```

Per a l'editor visual, els tokens s'agrupen semànticament amb metadata (`TOKEN_GROUPS`), de
manera que la UI pinta seccions "Fons", "Textos", "Accent i botons", etc., cadascuna amb els
seus tokens i una etiqueta llegible:

```ts
export interface TokenGroupDef {
  id: string;
  label: string;
  description?: string;
  tokens: { key: string; label: string }[];
}

export const TOKEN_GROUPS: TokenGroupDef[] = [
  { id: 'backgrounds', label: 'Fons', description: 'Colors de fons de l\'aplicació', tokens: [
      { key: 'bg-app',     label: 'Aplicació (fons principal)' },
      { key: 'bg-primary', label: 'Primari' },
      /* … */
  ]},
  { id: 'texts',   label: 'Textos', tokens: [ { key: 'text-primary', label: 'Principal' }, /* … */ ] },
  { id: 'accent',  label: 'Accent i botons', tokens: [ { key: 'accent', label: 'Accent' }, /* … */ ] },
  { id: 'status',  label: 'Estats i alertes', tokens: [ /* … */ ] },
  { id: 'editor',  label: 'Editor de subtítols', tokens: [ /* … */ ] },
  { id: 'waveform',label: 'Timeline / Ona', tokens: [ /* … */ ] },
  { id: 'misc',    label: 'Altres', tokens: [ /* … */ ] },
];
```

La UI de l'editor recorre `TOKEN_GROUPS` i, per cada token, pinta una fila amb un *color
picker* natiu (`<input type="color">`) + un camp de text (per acceptar `rgba()`, `hsl()`,
keywords…). El camp de text valida el color creant un element temporal i mirant si el
navegador l'accepta:

```tsx
// TokenRow — commit del valor només si és un color CSS vàlid
const commit = (val: string) => {
  const trimmed = val.trim();
  if (!trimmed) return;
  const el = document.createElement('div');
  el.style.color = '';
  el.style.color = trimmed;                 // el navegador rebutja colors invàlids
  if (el.style.color !== '' || trimmed === 'transparent' || trimmed === 'inherit') {
    onChange(tokenKey, trimmed);            // vàlid → aplica
  } else {
    setInvalid(true);                       // invàlid → marca en vermell, no aplica
  }
};
```

I l'editor complet (retallat) itera grups i tokens:

```tsx
{TOKEN_GROUPS.map(group => (
  <div key={group.id}>
    <h4>{group.label}</h4>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
      {group.tokens.map(({ key, label }) => (
        <TokenRow
          key={key}
          tokenKey={key}
          label={label}
          value={resolvedCustomTheme.tokens[key] || ''}
          onChange={handleCustomTokenChange}   // → setCustomTokens({ [key]: value })
        />
      ))}
    </div>
  </div>
))}
```

Hi ha també un botó **"Copiar des de…"** que inicialitza el tema custom a partir d'un preset
existent (`resetCustomTokensFromPreset(presetId)`), útil com a punt de partida.

### 2.4 El provider: com s'aplica al DOM i com es persisteix

Aquest és el cor del sistema. `applyThemeToDOM` escriu cada token com a CSS custom property
a `:root`:

```ts
function applyThemeToDOM(theme: ThemeDefinition) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(`--th-${key}`, value);    // 'accent' → --th-accent
  }
  document.body.style.backgroundColor = theme.tokens['bg-app'] || '';  // evita flash blanc
  root.setAttribute('data-theme', theme.id);          // permet queries CSS per tema
  injectThemeOverrides(theme.id);                     // veure nota Tailwind més avall
}
```

El provider (`ThemeProvider`) manté `themeId` + `customTokens` a l'estat, els aplica quan
canvien, i els persisteix a **dos llocs**: localStorage (immediat, per evitar flash al
recarregar) i backend (debounced 1,5 s). Signatura del context exposat:

```ts
interface ThemeContextValue {
  theme: ThemeDefinition;                                    // tema actiu resolt
  themeId: string;
  setThemeId: (id: string) => void;                          // canviar preset o 'custom'
  themes: ThemeDefinition[];                                  // presets per llistar
  customTokens: Record<string, string>;
  setCustomTokens: (tokens: Record<string, string>) => void; // merge parcial + valida + persisteix
  resetCustomTokensFromPreset: (presetId: string) => void;
}
```

Punts fins que et convé conèixer (i replicar o simplificar):

1. **Prevenció de "flash"**: al primer render s'aplica el tema llegit de localStorage
   síncronament, abans que React pinti res:
   ```ts
   useMemo(() => applyThemeToDOM(getThemeById(themeIdRaw)), []);
   ```
2. **Validació i sanitització** de colors abans de persistir (descarta valors buits/invàlids)
   amb un regex + fallback al navegador (`isValidCssColor` / `sanitizeTokens`).
3. **Scoping per usuari** a localStorage: les claus poden portar sufix `_<userId>` per no
   barrejar comptes al mateix navegador. **[ADMIN]/multi-usuari — a Electron pots ignorar-ho.**
4. **Overrides de Tailwind** (`injectThemeOverrides`): com que l'app original fa servir moltes
   classes utilitàries de Tailwind amb colors *hardcoded* (`bg-gray-900`, `text-white`…), per
   als temes `sonilab` i `light` s'injecta un `<style>` que reescriu aquestes classes cap a
   la paleta correcta (p. ex. en `light` inverteix text clar→fosc). **Això és una crossa
   específica de Tailwind; si la teva app no fa servir classes de color hardcoded i sempre
   escriu `var(--th-*)`, NO necessites res d'això.** El mecanisme, per si el vols:
   ```ts
   function injectThemeOverrides(themeId: string) {
     let styleEl = document.getElementById('th-theme-overrides');
     if (themeId !== 'sonilab' && themeId !== 'light') { styleEl?.remove(); return; }
     if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'th-theme-overrides'; document.head.appendChild(styleEl); }
     styleEl.textContent = `
       [data-theme="light"] .text-white { color: #18181b; }   /* … centenars de regles … */
     `;
   }
   ```

### 2.5 Com un component consumeix el tema

No cal cap hook per pintar — només CSS var:

```tsx
<div style={{ backgroundColor: 'var(--th-bg-secondary)', border: '1px solid var(--th-border)' }}>
  <h3 style={{ color: 'var(--th-text-primary)' }}>Títol</h3>
  <button style={{ backgroundColor: 'var(--th-btn-primary-bg)', color: 'var(--th-btn-primary-text)' }}>OK</button>
</div>
```

Només necessites `useTheme()` quan vols **llegir o canviar** el tema (p. ex. la llista de
selecció de temes al modal):

```tsx
const { themeId, setThemeId, themes } = useTheme();
// ...
{themes.map(t => (
  <button key={t.id} onClick={() => setThemeId(t.id)}>
    {t.preview.map((c, i) => <div key={i} style={{ backgroundColor: c }} />)}  {/* quadradets */}
    {t.name} {themeId === t.id && '(Actiu)'}
  </button>
))}
```

---

## 3. Sistema de DRECERES de teclat (per subaplicació)

Aquest és el sistema que t'interessava especialment: **dreceres agrupades per subaplicació**,
amb un grup `general` que aplica a totes.

Fitxers:
- `frontend/constants.ts` — `DEFAULT_SHORTCUTS`, `mergeShortcuts`, `LOCAL_STORAGE_KEYS`.
- `frontend/appTypes.ts` — tipus `Shortcut` / `AppShortcuts`.
- `frontend/hooks/useKeyboardShortcuts.ts` — el hook que ESCOLTA el teclat i dispara accions.
- `frontend/components/SettingsModal.tsx` → `ShortcutsTab` — la UI d'edició (gravador + conflictes).

### 3.1 Model de dades

```ts
export interface Shortcut {
  id: string;      // identificador estable, únic (p. ex. 'sub_split')
  action: string;  // acció lògica que dispara (p. ex. 'SPLIT_SEGMENT')
  label: string;   // text visible a la UI (p. ex. 'Dividir subtítol al cursor')
  combo: string;   // combinació en notació canònica (p. ex. 'Ctrl+K')
}

export interface AppShortcuts {
  general:         Shortcut[];  // apliquen a TOTES les subapps
  scriptEditor:    Shortcut[];  // subaplicació: editor de guions
  videoEditor:     Shortcut[];  // subaplicació: reproductor de vídeo
  subtitlesEditor: Shortcut[];  // subaplicació: editor de subtítols SRT
}
```

**El concepte de "scope" (àmbit / subaplicació) és el nucli:** cada clau de `AppShortcuts` és
una subaplicació. `general` és transversal. Quan estàs dins d'una subapp, les dreceres actives
són `general` + les d'aquella subapp. Afegir una subapp nova = afegir una clau nova aquí.

### 3.2 Valors per defecte (font de veritat)

```ts
export const DEFAULT_SHORTCUTS: AppShortcuts = {
  general: [
    { id: 'g_undo', action: 'UNDO', label: 'Desfer',          combo: 'Ctrl+Z' },
    { id: 'g_redo', action: 'REDO', label: 'Refer',           combo: 'Ctrl+Shift+Z' },
    { id: 'g_save', action: 'SAVE', label: 'Guardar canvis',  combo: 'Ctrl+S' },
  ],
  scriptEditor: [
    { id: 'se_mode_csv', action: 'MODE_CSV', label: 'Canviar a mode Dades',  combo: 'Ctrl+M' },
    { id: 'se_find',     action: 'FIND',     label: 'Cercar i substituir',   combo: 'Ctrl+F' },
  ],
  videoEditor: [
    { id: 've_play', action: 'TOGGLE_PLAY', label: 'Reproduir / Pausa', combo: 'Ctrl+Space' },
  ],
  subtitlesEditor: [
    { id: 'sub_new',         action: 'INSERT_SUBTITLE',      label: 'Nou subtítol (playhead)',   combo: 'Alt+N' },
    { id: 'sub_delete',      action: 'DELETE_SEGMENT',       label: 'Esborrar subtítol',         combo: 'Delete' },
    { id: 'sub_delete_active',action:'DELETE_ACTIVE_SEGMENT',label: 'Esborrar subtítol actiu',   combo: 'Shift+Delete' },
    { id: 'sub_split',       action: 'SPLIT_SEGMENT',        label: 'Dividir subtítol al cursor',combo: 'Ctrl+K' },
    { id: 'sub_split_ph',    action: 'SPLIT_AT_PLAYHEAD',    label: 'Dividir al playhead',       combo: 'Ctrl+Shift+K' },
    { id: 'sub_merge',       action: 'MERGE_SEGMENT',        label: 'Unir amb següent',          combo: 'Ctrl+Shift+M' },
    { id: 'sub_play',        action: 'TOGGLE_PLAY_PAUSE',    label: 'Reproduir / Pausa',         combo: 'Ctrl+Space' },
    { id: 'sub_next_line',   action: 'NAVIGATE_NEXT_LINE',   label: 'Següent línia / subtítol',  combo: 'Ctrl+Enter' },
    { id: 'sub_prev_line',   action: 'NAVIGATE_PREV_LINE',   label: 'Anterior línia / subtítol', combo: 'Ctrl+Shift+Enter' },
    { id: 'sub_set_tc_in',   action: 'SET_TC_IN',            label: 'Marcar TC IN al playhead',  combo: 'Q' },
    { id: 'sub_set_tc_out',  action: 'SET_TC_OUT',           label: 'Marcar TC OUT al playhead', combo: 'W' },
    { id: 'sub_find',        action: 'FIND',                 label: 'Cercar i substituir',       combo: 'Ctrl+F' },
  ],
};
```

Observa: el `combo` per defecte és **una etiqueta de text canònica**, no un codi de tecla del
navegador. La conversió event↔combo la fa el hook (§3.4).

### 3.3 Merge amb overrides de l'usuari

L'usuari només guarda els `combo` que ha canviat; la resta s'omplen des dels defaults. Això
permet afegir dreceres noves en futures versions sense trencar les personalitzacions guardades:

```ts
/** Merge overrides de l'usuari sobre DEFAULT_SHORTCUTS per id. Només sobreescriu `combo`. */
export function mergeShortcuts(
  defaults: AppShortcuts,
  overrides: Partial<Record<keyof AppShortcuts, Shortcut[]>> | null | undefined,
): AppShortcuts {
  if (!overrides) return defaults;
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof AppShortcuts)[]) {
    const overs = overrides[key];
    if (!overs) continue;
    result[key] = defaults[key].map((def) => {
      const ov = overs.find((s) => s.id === def.id);
      return ov ? { ...def, combo: ov.combo } : def;   // només el combo es sobreescriu
    });
  }
  return result;
}
```

### 3.4 El hook que escolta el teclat i dispara accions

Aquest és el consum en runtime. `useKeyboardShortcuts(appId, onAction)` registra un listener
global de `keydown`, combina `general` + les dreceres de la subapp indicada, i quan detecta
un combo que coincideix, crida `onAction(action)`.

```ts
// hooks/useKeyboardShortcuts.ts (complet, és curt i molt reutilitzable)
import { useEffect, useCallback } from 'react';
import { AppShortcuts } from '../appTypes';
import { DEFAULT_SHORTCUTS, LOCAL_STORAGE_KEYS } from '../constants';

type ActionHandler = (action: string) => void;

// Cache fora del component: evita JSON.parse a cada keydown
let _cachedShortcutsRaw: string | null = null;
let _cachedShortcuts: AppShortcuts = DEFAULT_SHORTCUTS;
function getCachedShortcuts(): AppShortcuts {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.SHORTCUTS);
  if (stored !== _cachedShortcutsRaw) {
    _cachedShortcutsRaw = stored;
    _cachedShortcuts = stored ? JSON.parse(stored) : DEFAULT_SHORTCUTS;
  }
  return _cachedShortcuts;
}

type KeyEventLike = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>;

// Normalitza per comparar (ignora espais, tracta Meta com Ctrl, minúscules)
const normalizeCombo = (combo: string): string =>
  combo.replace(/\s+/g, '').replace('Meta', 'Ctrl').replace('+', '').toLowerCase();

function mapKeyName(key: string): string {
  if (key === ' ') return 'Space';
  if (key === '+') return 'Plus';
  if (key === '-') return 'Minus';
  if (key === ',') return 'Comma';
  return key;
}

/** Converteix un event de teclat a la MATEIXA notació que els `combo` dels defaults. */
export function comboFromEvent(e: KeyEventLike): string | null {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null;  // modificador sol → ignora
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');   // Cmd de Mac = Ctrl
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');
  parts.push(mapKeyName(e.key));
  return parts.join('+');   // p. ex. 'Ctrl+Shift+K'
}

export function useKeyboardShortcuts(
  appId: keyof AppShortcuts,
  onAction: ActionHandler,
  enabled: boolean = true,
) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;
    const shortcuts = getCachedShortcuts();
    const appShortcuts = [ ...(shortcuts.general || []), ...(shortcuts[appId] || []) ];  // general + subapp

    // No segrestar tecles simples mentre s'escriu en un input/textarea/contentEditable
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    const hasMod = e.ctrlKey || e.metaKey || e.altKey;
    if (isInput && !hasMod && mapKeyName(e.key).length === 1) return;

    const pressedCombo = comboFromEvent(e);
    if (!pressedCombo) return;

    const found = appShortcuts.find((s) => normalizeCombo(s.combo) === normalizeCombo(pressedCombo));
    if (found) {
      e.preventDefault();
      onAction(found.action);   // dispara l'acció lògica
    }
  }, [appId, onAction, enabled]);

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}
```

**Com es connecta cada subaplicació** (exemple real de l'editor de subtítols): la subapp crida
el hook amb el seu `appId` i un `switch` que tradueix `action` → funció concreta. Fixa't que
`UNDO`/`REDO`/`SAVE` (del grup `general`) també arriben aquí i es gestionen localment:

```tsx
// dins de VideoSubtitlesEditorView.tsx
useKeyboardShortcuts('subtitlesEditor', (action) => {
  switch (action) {
    case 'TOGGLE_PLAY_PAUSE': onTogglePlay(); break;
    case 'UNDO': subsHistory.undo(); break;           // ← ve del grup 'general'
    case 'REDO': subsHistory.redo(); break;
    case 'SAVE': handleSave(); break;                 // ← ve del grup 'general'
    case 'SPLIT_SEGMENT': handleSplitSegmentAtCursor(); break;
    case 'SPLIT_AT_PLAYHEAD': handleSplitSegmentAtPlayhead(); break;
    case 'MERGE_SEGMENT': handleMergeSegmentWithNext(); break;
    case 'SET_TC_IN': handleSetTcIn(); break;
    case 'SET_TC_OUT': handleSetTcOut(); break;
    case 'INSERT_SUBTITLE': handleInsertSegmentAtCursor(); break;
    // … la resta d'accions de la subapp …
  }
});
```

Hi ha també un helper `findGeneralShortcutAction(e)` per a casos on un input aïlla les seves
tecles amb `stopPropagation` però encara vol deixar passar les dreceres globals (Undo/Redo/Save).

### 3.5 La UI d'edició: gravador de dreceres + detecció de conflictes

`ShortcutsTab` (dins `SettingsModal.tsx`) és la pantalla de la pestanya "Dreceres". Té:

1. Una fila de botons per triar la **subaplicació activa** (aquí es veu la jerarquia "dins de
   dreceres, les de cada subapp"):
   ```tsx
   const appLabels: Record<ShortcutApp, string> = {
     general:         'General',
     scriptEditor:    'Editor Guions',
     videoEditor:     'Reproductor Vídeo',
     subtitlesEditor: 'Subtítols SRT',
   };
   const sortedApps: ShortcutApp[] = ['general', 'scriptEditor', 'videoEditor', 'subtitlesEditor'];
   // … botons que fan setActiveApp(appId) …
   ```
2. Una **taula** de les dreceres de la subapp activa (Acció | Combinació | reset).
3. Un **gravador**: en clicar el combo, el camp entra en mode "gravació" i captura la següent
   combinació premuda:
   ```tsx
   const handleKeyCapture = useCallback((e: React.KeyboardEvent) => {
     e.preventDefault();
     e.stopPropagation();
     if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;  // espera tecla real
     if (e.key === 'Escape') { setRecordingId(null); return; }         // Esc cancel·la
     const combo = recorderCombo(e);                                   // reusa comboFromEvent
     if (combo && recordingId) { updateCombo(recordingId, combo); setRecordingId(null); }
   }, [recordingId, updateCombo]);
   ```
   `recorderCombo` reutilitza `comboFromEvent` del hook (mateixa font de veritat de notació) i
   només posa la tecla final en majúscula per casar amb el format guardat (`Ctrl+Shift+Z`).
4. **Detecció de conflictes** dins del mateix scope (no pots assignar el mateix combo a dues
   accions de la mateixa subapp):
   ```tsx
   function findDuplicate(shortcuts: AppShortcuts, currentId: string, combo: string): Shortcut | null {
     const norm = combo.replace(/\s+/g, '').toLowerCase();
     for (const key of Object.keys(shortcuts) as (keyof AppShortcuts)[]) {
       const group = shortcuts[key];
       if (!group.some((s) => s.id === currentId)) continue;   // troba l'scope de currentId
       for (const s of group) {                                 // busca duplicat NOMÉS en aquest scope
         if (s.id !== currentId && s.combo.replace(/\s+/g, '').toLowerCase() === norm) return s;
       }
       break;
     }
     return null;
   }
   ```
   Si `updateCombo` detecta duplicat, mostra un avís i **no** aplica el canvi.
5. **Reset individual** (`resetOne(id)` torna una drecera al seu default) i **Reset total**
   (`resetAll()` torna tot a `DEFAULT_SHORTCUTS`).

La persistència: `ShortcutsTab` guarda a localStorage via `useLocalStorage(LOCAL_STORAGE_KEYS.SHORTCUTS, DEFAULT_SHORTCUTS)`
i, si hi ha backend, també fa `api.updateMe({ preferences: { shortcuts } })`. **[Backend
opcional — a Electron treu aquesta segona part.]**

---

## 4. Sistema d'ESTILS d'usuari (`--us-*`) — tipografia per zones

Aquest sistema és **paral·lel al de temes** però per a **tipografia** (font, mida, color,
negreta, cursiva) de zones concretes, i afegeix un concepte de **presets guardables**.

Fitxers:
- `frontend/types/UserStyles/userStylesTypes.ts` — tipus.
- `frontend/context/UserStyles/factoryStyles.ts` — valors de fàbrica.
- `frontend/context/UserStyles/applyUserStylesToDOM.ts` — emet les CSS vars `--us-*`.
- `frontend/context/UserStyles/UserStylesContext.tsx` — provider + `useUserStyles`.
- `frontend/components/Settings/UserStyles/*` — la UI de la pestanya "Estils".

### 4.1 Model de dades: àtom, scope, preset

La unitat mínima és un **StyleAtom** (com es pinta un tros de text):

```ts
export interface StyleAtom {
  fontFamily: string;
  fontSize: number;   // px
  color: string;      // #rrggbb  (o pot ser 'var(--th-...)' per delegar al tema!)
  bold: boolean;
  italic: boolean;
}
```

Els àtoms s'agrupen per **scope** (una subaplicació d'estil). Hi ha 3 scopes, cadascun amb el
seu conjunt d'àtoms nomenats per la zona que pinten:

```ts
export type StyleScope = 'scriptEditor' | 'subtitleEditor' | 'home';

export interface ScriptEditorStyleSet {   // editor de guions
  take: StyleAtom; speaker: StyleAtom; timecode: StyleAtom;
  dialogue: StyleAtom; dialogueParentheses: StyleAtom; dialogueTimecodeParentheses: StyleAtom;
}
export interface SubtitleEditorStyleSet {  // editor de subtítols
  content: StyleAtom; timecode: StyleAtom; idCps: StyleAtom;
  takeLabel: StyleAtom; charCounter: StyleAtom; actionButtons: StyleAtom;
}
export interface HomeStyleSet {            // biblioteca / inici
  fileName: StyleAtom; formatLabel: StyleAtom; dateTime: StyleAtom;
  tableHeader: StyleAtom; navTabs: StyleAtom; breadcrumb: StyleAtom; createProjectSelect: StyleAtom;
}
```

Cada scope té un o més **presets** (un conjunt d'àtoms amb nom), i un `activePresetId`:

```ts
export interface UserStylePreset<S extends StyleScope = StyleScope> {
  id: string;
  name: string;
  builtin?: boolean;          // true = 'Per defecte' (del sistema, no editable directament)
  styles: StyleSetMap[S];
}
export interface ScopeState<S extends StyleScope> { activePresetId: string; presets: UserStylePreset<S>[]; }

export interface UserStylesPayload {
  version: 2;
  scriptEditor:   ScopeState<'scriptEditor'>;
  subtitleEditor: ScopeState<'subtitleEditor'>;
  home:           ScopeState<'home'>;
}
```

### 4.2 Valors de fàbrica (font de veritat)

Fixa't en un detall potent: el color d'un àtom pot ser un hex fix **o una CSS var del tema**
(`var(--th-editor-text)`). Així els estils de fàbrica **s'adapten automàticament al tema
actiu**; només quan l'usuari toca el color picker es guarda un hex fix (override explícit).

```ts
const courier = (size, color, bold=false, italic=false): StyleAtom => ({ fontFamily: 'Courier Prime, monospace', fontSize: size, color, bold, italic });
const sans    = (size, color, bold=false, italic=false): StyleAtom => ({ fontFamily: 'sans-serif', fontSize: size, color, bold, italic });
const mono    = (size, color, bold=false, italic=false): StyleAtom => ({ fontFamily: 'monospace', fontSize: size, color, bold, italic });

export const FACTORY_SCRIPT_STYLES: ScriptEditorStyleSet = {
  take:                        courier(16, '#000000', true,  false),
  speaker:                     courier(14, '#000000', true,  false),
  timecode:                    courier(13, '#666666', false, false),
  dialogue:                    courier(14, '#000000', false, false),
  dialogueParentheses:         courier(14, '#555555', false, true),
  dialogueTimecodeParentheses: courier(13, '#0055aa', true,  false),
};

export const FACTORY_SUBTITLE_STYLES: SubtitleEditorStyleSet = {
  content:       courier(14, 'var(--th-editor-text)'),        // ← delega al tema
  timecode:      courier(10, 'var(--th-editor-timecode)'),
  idCps:         mono(11,    'var(--th-editor-text-muted)', true),
  takeLabel:     sans(10,    'var(--th-accent-text)', true),
  charCounter:   mono(11,    'var(--th-editor-text-muted)', true),
  actionButtons: sans(9,     'var(--th-editor-meta)'),
};

export const FACTORY_HOME_STYLES: HomeStyleSet = {
  fileName:            sans(14, 'var(--th-text-primary)'),
  formatLabel:         sans(10, 'var(--th-text-muted)', true),
  dateTime:            mono(10, 'var(--th-text-secondary)'),
  tableHeader:         sans(10, 'var(--th-text-muted)', true),
  navTabs:             sans(14, 'var(--th-text-primary)', true),
  breadcrumb:          sans(14, 'var(--th-text-secondary)'),
  createProjectSelect: sans(14, '#ffffff'),
};
```

### 4.3 Emissió al DOM: d'àtom a variables CSS

Cada àtom es converteix en 5 CSS vars (`-family`, `-size`, `-color`, `-weight`, `-style`) amb
un prefix per zona. Es fa servir només el preset **actiu** de cada scope:

```ts
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
  const root = document.documentElement;
  const all: Record<string, string> = {};

  const se = activePreset(payload.scriptEditor).styles;
  Object.assign(all, emitAtomVars('--us-script-take',    se.take));
  Object.assign(all, emitAtomVars('--us-script-speaker', se.speaker));
  // … resta d'àtoms de script …

  const sb = activePreset(payload.subtitleEditor).styles;
  Object.assign(all, emitAtomVars('--us-sub-content',  sb.content));
  Object.assign(all, emitAtomVars('--us-sub-timecode', sb.timecode));
  // … resta …

  const hm = activePreset(payload.home).styles;
  Object.assign(all, emitAtomVars('--us-home-filename', hm.fileName));
  // … resta …

  // També emet mètriques DERIVADES (alçada de fila, columnes del grid) calculades
  // a partir de les mides de font — útil per a virtual scroll de llistes llargues:
  all['--us-sub-row-height']   = `${metrics.rowHeight}px`;
  all['--us-sub-grid-columns'] = computeSubGridCols(sb);

  for (const [k, v] of Object.entries(all)) root.style.setProperty(k, v);
}
```

I un component consumeix aquestes vars igual que amb el tema:

```tsx
// LibraryFileItem.tsx — el nom del fitxer usa les vars d'estil de la zona 'home'
<span style={{
  fontFamily: 'var(--us-home-filename-family)',
  fontSize:   'var(--us-home-filename-size)',
  color:      'var(--us-home-filename-color)',
  fontWeight: 'var(--us-home-filename-weight)' as any,
  fontStyle:  'var(--us-home-filename-style)',
}}>{fileName}</span>
```

### 4.4 El provider i les operacions de preset

`useUserStyles()` exposa un API ric per gestionar presets. Les operacions clau:

```ts
interface UserStylesContextValue {
  payload: UserStylesPayload;
  activePreset<S>(scope: S): UserStylePreset<S>;
  setActivePreset(scope, presetId): void;
  createPreset(scope, name): string;       // clona l'actiu → nou preset editable
  duplicatePreset(scope, presetId): string;
  renamePreset(scope, presetId, name): void;   // bloquejat si builtin
  deletePreset(scope, presetId): void;         // bloquejat si builtin
  resetActivePreset(scope): void;              // torna l'actiu als valors de fàbrica
  updateAtom<S>(scope, atomKey, patch): void;  // editar un àtom (veure sota)
  savePreset(scope, name, overwrite?): 'ok' | 'conflict' | 'blocked-custom' | 'blocked-system';
  saveGlobalPreset(scope): Promise<void>;      // [ADMIN] guarda com a global per a tots
  hasUnsavedChanges(scope): boolean;
  // …
}
```

**Patró "esborrany custom":** quan l'usuari edita un àtom d'un preset que no és editable
(p. ex. el `builtin` 'Per defecte'), el sistema **clona automàticament** l'estil actiu a un
preset especial amb `id: 'custom'` i hi aplica el canvi. Així el preset del sistema mai es
modifica, i l'usuari veu "· Canvis no guardats" fins que decideix guardar-los amb nom:

```ts
const updateAtom = (scope, atomKey, patch) => {
  mutate(prev => {
    const state = prev[scope];
    if (state.activePresetId !== 'custom') {
      // Clona el preset actiu → 'custom' i aplica el patch
      const source = state.presets.find(p => p.id === state.activePresetId) ?? state.presets[0];
      const patched = { ...clone(source.styles), [atomKey]: { ...source.styles[atomKey], ...patch } };
      const customPreset = { id: 'custom', name: 'custom', builtin: false, styles: patched };
      return { ...prev, [scope]: { activePresetId: 'custom',
               presets: [...state.presets.filter(p => p.id !== 'custom'), customPreset] } };
    }
    // Ja en 'custom' → aplica el patch directament
    // …
  });
};
```

**`savePreset`** converteix l'esborrany 'custom' en un preset amb nom. Aquí és on apareixen les
comprovacions de rol:

```ts
const savePreset = (scope, name, overwrite = false) => {
  const trimmed = name.trim();
  if (!trimmed) return 'blocked-custom';
  if (trimmed.toLowerCase() === 'custom') return 'blocked-custom';         // nom reservat
  if (trimmed.toLowerCase() === 'per defecte' && meRef.current?.role !== 'admin')
    return 'blocked-system';   // [ADMIN] només un admin pot sobreescriure el preset del sistema
  // … detecta conflicte de nom, crea o sobreescriu preset, persisteix …
  return 'ok';
};
```

**`saveGlobalPreset` [ADMIN]:** guarda l'estil actual com el "Per defecte" **de tots els
usuaris** cridant `api.patchGlobalStyles(...)`. En una app local això no té sentit (no hi ha
"tots els usuaris") — **a Electron elimina aquesta funció sencera** o converteix-la en "guardar
com a nou default local".

**Override permanent del builtin:** en cada arrencada, el provider substitueix el preset
`builtin: true` de cada scope pels valors de `factoryStyles.ts` del codi actual. Així, si en
una futura versió canvies el default al codi, arriba a tothom sense migracions. Els presets
`builtin: false` (creats per l'usuari) es preserven intactes.

### 4.5 La UI de la pestanya "Estils"

`StylesTab` té subpestanyes per scope, i cada panell mostra una **barra de presets**
(`StylesPresetBar`: selector + Guardar + Eliminar) sobre una llista de `StyleAtomEditor` (un
editor per àtom amb selector de font, mida, color i checkboxes negreta/cursiva):

```tsx
export const StylesTab: React.FC = () => {
  const [active, setActive] = useState<'script'|'subtitle'|'home'>('home');
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <TabButton id="home"     label="Inici" />
        <TabButton id="subtitle" label="Editor de subtítols" />
        <TabButton id="script"   label="Editor de guions" />
      </div>
      {active === 'script'   && <ScriptStylesPanel />}
      {active === 'subtitle' && <SubtitleStylesPanel />}
      {active === 'home'     && <HomeStylesPanel />}
    </div>
  );
};
```

`StyleAtomEditor` (l'editor d'un àtom) mostra el patró UI complet: `<select>` de tipografia,
`<input type="number">` de mida amb clamp min/max, `<input type="color">`, i dos checkboxes.

**Atenció a aquest matís, que és fàcil d'entendre al revés:** quan el preset actiu és
`builtin` ('Per defecte'), els controls **NO** es bloquegen. L'usuari pot editar lliurement i
el `updateAtom` **forka automàticament** l'estil a l'esborrany `custom` (§4.4) — el preset del
sistema mai es toca. El que es mostra és un avís informatiu (`BuiltinPresetNotice`) explicant
que cal "Guardar" amb un nom per convertir-ho en un preset propi. `StyleAtomEditor` accepta una
prop `disabled`, però **cap panell la passa actualment** (és vestigial: en pots prescindir).

El codi complet dels panells, del modal de guardar i de l'avís està a l'**Apèndix B**.

---

## 5. Ajustos "General" i "Lector" — valors solts

No tot són sistemes grans. La pestanya `General` és una llista de controls que llegeixen/
escriuen valors individuals a localStorage via un hook genèric `useLocalStorage<T>(key, default)`
(retorna `[value, setValue]`, com `useState` però persistit). Exemples reals:

```tsx
const [libraryWidth, setLibraryWidth]       = useLocalStorage<number>(LOCAL_STORAGE_KEYS.LIBRARY_WIDTH, 420);
const [maxLinesSubs, setMaxLinesSubs]       = useLocalStorage<number>(LOCAL_STORAGE_KEYS.MAX_LINES_SUBS, 2);
const [gridOpacity, setGridOpacity]         = useLocalStorage<number>(LOCAL_STORAGE_KEYS.SUB_GRID_OPACITY, 0);
const [editorFps, setEditorFps]             = useLocalStorage<number>(LOCAL_STORAGE_KEYS.EDITOR_FPS, DEFAULT_FPS);
const [waveViewMode, setWaveViewMode]       = useLocalStorage<'page'|'duo'>(LOCAL_STORAGE_KEYS.WAVEFORM_VIEW_MODE, 'page');
// … cada un pintat com una fila amb label + input/range/toggle …
```

`Lector` en aquesta versió és un placeholder ("Aquest apartat estarà disponible properament").
És l'espai reservat per a una futura subaplicació. Et serveix de plantilla per veure com
s'afegeix una pestanya buida.

---

## 6. Factory Reset (restablir configuració)

Fitxer: `frontend/utils/factoryReset.ts`. Restableix la config a l'estat de fàbrica. És
interessant perquè resol una *race condition* amb els providers que persisteixen, amb una
**arquitectura de dues fases**:

- **Fase A** (`factoryReset`, abans de recarregar): neteja les preferències al backend, avisa
  les altres pestanyes via `BroadcastChannel`, i marca un *flag* a `sessionStorage`. **NO** toca
  localStorage encara (per evitar que un `useEffect` de persistència el torni a escriure).
- **Fase B** (`applyPendingFactoryReset`, després de recarregar, **abans de muntar React**):
  llegeix el flag i neteja les claus de localStorage síncronament, abans que cap provider munti.

```ts
// index.tsx — es crida ABANS de ReactDOM.render
import { applyPendingFactoryReset } from './utils/factoryReset';
applyPendingFactoryReset();   // si hi ha reset pendent, neteja localStorage aquí
// … després: ReactDOM.createRoot(root).render(<App />)
```

La llista de claus a esborrar és **explícita** (una blocklist, no un escaneig per prefix),
perquè algunes claus s'han de **preservar** (el tema triat, els presets d'estils, el token de
sessió, els historials de versions):

```ts
export const KEYS_TO_REMOVE: readonly string[] = [
  LOCAL_STORAGE_KEYS.SHORTCUTS,
  LOCAL_STORAGE_KEYS.LIBRARY_WIDTH,
  LOCAL_STORAGE_KEYS.MAX_LINES_SUBS,
  LOCAL_STORAGE_KEYS.CUSTOM_THEME_TOKENS,
  // … tots els ajustos, PERÒ NO LOCAL_STORAGE_KEYS.THEME (es preserva) …
];
```

La UI de confirmació és un modal amb dues columnes ("Es restablirà" vs "Es preservarà") + un
checkbox obligatori, i un sub-modal que avisa si hi ha canvis sense desar en algun editor.

---

## 7. Model de persistència (resum transversal)

Tots els sistemes segueixen el mateix esquema de dues capes:

1. **localStorage** — immediat, per a arrencada ràpida sense *flash* i per funcionar offline.
   Les claus viuen centralitzades a `LOCAL_STORAGE_KEYS` (`constants.ts`):
   ```ts
   export const LOCAL_STORAGE_KEYS = {
     SHORTCUTS:            'snlbpro_shortcuts',
     THEME:                'snlbpro_theme',
     CUSTOM_THEME_TOKENS:  'snlbpro_custom_theme_tokens',
     LIBRARY_WIDTH:        'snlbpro_library_width',
     MAX_LINES_SUBS:       'snlbpro_max_lines_subs',
     EDITOR_FPS:           'snlbpro_editor_fps',
     // … ~30 claus més …
   };
   // (els estils d'usuari usen la clau derivada  snlbpro_user_styles_<userId>)
   ```
2. **Backend** (NestJS, opcional) — font de veritat entre dispositius. S'hi escriu *debounced*
   (~1,5 s) via `api.updateMe({ preferences: { shortcuts | themeId | customThemeTokens | userStyles } })`.
   Tot el codi de backend està darrere d'un flag:
   ```ts
   const USE_BACKEND = process.env.VITE_USE_BACKEND === '1';
   // … if (USE_BACKEND && me) api.updateMe(...) …
   ```
   Al carregar el perfil, un event `USER_PROFILE_LOADED` porta les `preferences` guardades i
   sobreescriu l'estat local.

**Scoping per usuari:** al mateix navegador poden conviure diversos comptes, per això algunes
claus porten sufix `_<userId>`. **[Multi-usuari — a Electron, una instal·lació = un usuari,
pots eliminar tot el scoping i quedar-te amb claus planes.]**

---

## 8. Ordre de muntatge dels providers

L'ordre importa perquè els estils de fàbrica deleguen als tokens del tema:

```tsx
// App.tsx
<ThemeProvider>            {/* 1r: escriu --th-* */}
  <AuthProvider>          {/* identitat/usuari — a Electron pot desaparèixer */}
    <UserStylesProvider>  {/* escriu --us-*, alguns delegant a --th-* */}
      <AuthedGate />       {/* la resta de l'app */}
    </UserStylesProvider>
  </AuthProvider>
</ThemeProvider>
```

---

## 9. Guia d'adaptació a la teva app Electron local

El sistema està dissenyat perquè el **backend sigui opcional**, així que portar-lo a Electron
és sobretot **treure coses**, no afegir-ne. Recomanacions concretes:

| Element original | Què fer a Electron local |
|---|---|
| `localStorage` al renderer | **Funciona igual** dins d'una finestra Electron (Chromium). Pots deixar-ho tal qual. Si vols persistència més robusta o compartida entre finestres, canvia la capa de persistència per [`electron-store`](https://github.com/sindresorhus/electron-store) via IPC, mantenint la mateixa forma de dades. |
| `USE_BACKEND` / `api.updateMe` / `api.patchGlobalStyles` | **Elimina totes les branques de backend.** Deixa només la persistència local. Els providers ja funcionen sense backend (el flag ja ho contempla). |
| `AuthProvider`, `me`, `userId`, `role`, scoping `_<userId>` | **Elimina.** No hi ha login ni multi-usuari. Claus de localStorage planes. |
| `[ADMIN]` — `role === 'admin'`, `saveGlobalPreset`, "Per defecte" bloquejat | **Elimina les comprovacions.** Deixa totes les accions sempre disponibles. Si vols, permet editar/guardar el default directament. |
| `event USER_PROFILE_LOADED` | **Elimina** (era per hidratar des del backend). |
| `injectThemeOverrides` (overrides Tailwind) | **Només si uses Tailwind amb colors hardcoded.** Si els teus components ja pinten sempre amb `var(--th-*)`, no cal. |
| Debounce de 1,5 s de persistència | Pots reduir-lo o eliminar-lo; amb `localStorage`/`electron-store` local, escriure sovint no té cost de xarxa. |
| Factory reset de dues fases + `BroadcastChannel` | Simplifica-ho: sense la carrera del backend, pots netejar localStorage i recarregar la finestra directament. Manté la **blocklist explícita** de què esborrar vs preservar. |

**El que has de conservar sí o sí** (és el valor del sistema):

1. **Tokens semàntics `--th-*`** i que els components pintin amb `var(--th-*)` en lloc d'hex.
2. **Presets de tema complets** (mateixes claus a tots) + editor de tema custom per grups.
3. **Model de dreceres `AppShortcuts` amb scopes per subaplicació** + `general` transversal,
   `mergeShortcuts`, el hook `useKeyboardShortcuts(appId, onAction)`, i la notació de combos
   canònica compartida entre el gravador i el detector.
4. **Estils `--us-*` per àtoms/scopes**, amb `emitAtomVars` i el patró de preset 'custom'
   (esborrany) → guardar amb nom.
5. **Un únic lloc per a claus de persistència** (`LOCAL_STORAGE_KEYS`) i **un únic lloc per als
   valors per defecte** (`DEFAULT_SHORTCUTS`, `PRESET_THEMES`, `FACTORY_*_STYLES`).

**Avantatge extra a Electron:** si vols dreceres globals de sistema operatiu (funcionen encara
que la finestra no tingui focus), pots registrar-les al procés *main* amb el mòdul
[`globalShortcut`](https://www.electronjs.org/docs/latest/api/global-shortcut) d'Electron,
reutilitzant els mateixos `combo` guardats (només hauràs de traduir la notació `Ctrl+Shift+K`
al format d'accelerador d'Electron `CommandOrControl+Shift+K`). Per a dreceres dins de la
finestra (el cas habitual), el hook `useKeyboardShortcuts` tal qual ja et serveix.

---

## 10. Checklist mínim per reimplementar de zero

1. [ ] Defineix els **tokens de tema** (llista semàntica) i 1–2 presets complets. Escriu-los a
       `:root` com `--th-*` amb una funció `applyThemeToDOM`.
2. [ ] Fes que **tots els components** pintin amb `var(--th-*)`, mai hex directe.
3. [ ] Provider de tema amb `useTheme()` (`themeId`, `setThemeId`, `customTokens`,
       `setCustomTokens`) + persistència local.
4. [ ] Editor de tema per grups (`TOKEN_GROUPS`) amb color picker + validació.
5. [ ] Defineix `AppShortcuts` amb els teus scopes/subapps + `DEFAULT_SHORTCUTS`.
6. [ ] Copia `useKeyboardShortcuts` + `comboFromEvent` + `normalizeCombo` (gairebé literal).
7. [ ] A cada subapp, crida el hook amb el seu `appId` i un `switch(action)`.
8. [ ] UI de dreceres: selector d'scope + taula + gravador (`handleKeyCapture`) + conflictes
       (`findDuplicate`) + reset individual/total.
9. [ ] (Opcional) Estils `--us-*`: `StyleAtom`, scopes, `emitAtomVars`, presets amb esborrany
       'custom', editor d'àtoms.
10. [ ] Centralitza claus de persistència i valors per defecte. Afegeix un factory reset amb
        blocklist explícita (esborrar) vs preservar.
11. [ ] Munta els providers en ordre: **Tema → (Auth si cal) → Estils → App**.

---

## Apèndix A — `useLocalStorage`, la peça que ho sosté tot

Tots els ajustos solts, les dreceres i el tema es persisteixen amb aquest hook genèric. És
`useState` + `localStorage` + sincronització entre hooks. **Còpia'l literal**, és la base:

```ts
// hooks/useLocalStorage.ts (complet)
import React, { useState, useEffect } from 'react';

function useLocalStorage<T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      const stringifiedValue = JSON.stringify(valueToStore);

      setStoredValue(valueToStore);
      window.localStorage.setItem(key, stringifiedValue);

      // El navegador NO emet 'storage' a la pestanya que escriu — només a les altres.
      // L'emetem a mà perquè altres hooks useLocalStorage de LA MATEIXA finestra
      // que comparteixen aquesta clau es resincronitzin.
      window.dispatchEvent(new StorageEvent('storage', {
        key: key,
        newValue: stringifiedValue,
        storageArea: window.localStorage,
      }));
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key) {
        try {
          setStoredValue(e.newValue ? JSON.parse(e.newValue) : initialValue);
        } catch (error) {
          console.error(error);
          setStoredValue(initialValue);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setValue];
}

export default useLocalStorage;
```

**Dos detalls que t'estalviaran hores:**

1. El `window.dispatchEvent(new StorageEvent('storage', …))` manual és **imprescindible**. El
   navegador només emet `storage` a les *altres* pestanyes, mai a la que escriu. Sense aquesta
   línia, dos components de la mateixa finestra que fan `useLocalStorage('x')` es
   desincronitzarien: un escriu i l'altre no se n'assabenta fins a un remount.
2. **Compte amb l'efecte ping-pong** si a Electron tens diverses finestres (`BrowserWindow`).
   A Sonilab, el `UserStylesProvider` va patir exactament això: escoltava `storage` i feia
   `setPayload`, cosa que provocava un bucle P1→P2→P1 de ~790 aplicacions/segon amb
   *flicker* massiu al DOM. **La solució adoptada va ser desactivar deliberadament la
   sincronització cross-tab** dels estils (limitació coneguda i acceptada: si edites en una
   finestra, l'altra no ho veu fins que la recarregues). Si vols sincronitzar entre finestres
   a Electron, **no facis servir `storage`**: fes servir IPC amb un `senderId` explícit per
   missatge i descarta els teus propis ecos.

---

## Apèndix B — Codi complet de la UI d'estils (panells, guardar preset, avís)

### B.1 Un panell d'scope (patró calcable per a qualsevol scope)

Un panell = barra de presets + avís si builtin + un `StyleAtomEditor` per àtom + preview.
La llista `ROWS` és l'única cosa que canvia entre scopes:

```tsx
// components/Settings/UserStyles/SubtitleStylesPanel.tsx (complet)
import React from 'react';
import { useUserStyles } from '../../../context/UserStyles/UserStylesContext';
import { StyleAtomEditor } from './StyleAtomEditor';
import { StylesPresetBar } from './StylesPresetBar';
import { BuiltinPresetNotice } from './BuiltinPresetNotice';
import { SubtitleStylePreview } from './SubtitleStylePreview';
import type { SubtitleEditorStyleSet } from '../../../types/UserStyles/userStylesTypes';

const ROWS: { key: keyof SubtitleEditorStyleSet; label: string }[] = [
  { key: 'content',       label: 'Text del subtítol' },
  { key: 'timecode',      label: 'Codi de temps (IN/OUT)' },
  { key: 'idCps',         label: 'ID i CPS' },
  { key: 'takeLabel',     label: 'Etiqueta TAKE' },
  { key: 'charCounter',   label: 'Comptador caràcters' },
  { key: 'actionButtons', label: "Botons d'acció" },
];

export const SubtitleStylesPanel: React.FC = () => {
  const { activePreset, updateAtom } = useUserStyles();
  const preset = activePreset('subtitleEditor');

  return (
    <div>
      <StylesPresetBar scope="subtitleEditor" />
      {preset.builtin && <BuiltinPresetNotice />}
      {ROWS.map(row => (
        <StyleAtomEditor
          key={row.key}
          label={row.label}
          atom={preset.styles[row.key]}
          onChange={patch => updateAtom('subtitleEditor', row.key, patch)}
        />
      ))}
      <SubtitleStylePreview />
    </div>
  );
};
```

Cada panell acaba amb un **component de previsualització** (`SubtitleStylePreview`,
`ScriptStylePreview`, `HomeStylePreview`): un tros de UI fals que pinta amb les mateixes
`var(--us-*)`, perquè l'usuari vegi el resultat sense sortir dels ajustos. Com que consumeix
les CSS vars, s'actualitza sol en temps real — no cal cablejar-hi res.

### B.2 El modal de guardar preset — i el flux `[ADMIN]` complet

Aquest fitxer és **on viu tota la lògica d'admin** del sistema d'estils. És una màquina de 3
passos: `input` → (`confirm-overwrite` | `confirm-global`).

```tsx
// components/Settings/UserStyles/SavePresetModal.tsx (lògica; s'ometen els estils inline)
type Step = 'input' | 'confirm-overwrite' | 'confirm-global';

export const SavePresetModal: React.FC<Props> = ({ scope, initialName, onClose }) => {
  const { savePreset, saveGlobalPreset } = useUserStyles();
  const { isAdmin } = useAuth();                       // [ADMIN] ← a Electron: elimina
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('input');
  const [saving, setSaving] = useState(false);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('El nom no pot estar buit.'); return; }

    // [ADMIN] Si un admin escriu literalment "Per defecte", no crea un preset propi:
    // està demanant canviar el default GLOBAL de la plataforma → confirmació extra.
    if (trimmed.toLowerCase() === 'per defecte' && isAdmin) {
      setStep('confirm-global');
      return;
    }

    const result = savePreset(scope, trimmed, false);
    if (result === 'ok')            { onClose(); return; }
    if (result === 'conflict')      { setStep('confirm-overwrite'); return; }   // nom ja existent
    if (result === 'blocked-custom'){ setError('El nom "custom" és reservat pel sistema.'); return; }
    if (result === 'blocked-system'){ // [ADMIN] usuari normal intentant usar "Per defecte"
      setError('El nom "Per defecte" és reservat al sistema. Només els administradors el poden usar.');
      return;
    }
  };

  const handleOverwrite = () => { savePreset(scope, name.trim(), true); onClose(); };

  const handleGlobalSave = async () => {                // [ADMIN] escriu al backend per a TOTHOM
    setSaving(true);
    try { await saveGlobalPreset(scope); onClose(); }
    catch { setError('Error en guardar els estils globals. Comprova la connexió i torna-ho a intentar.'); setStep('input'); }
    finally { setSaving(false); }
  };

  if (step === 'confirm-overwrite') return (/* "Ja existeix «X». Sobreescriure?" → Canviar nom | Sobreescriure */);
  if (step === 'confirm-global')    return (/* [ADMIN] Avís taronja: "modificaràs els estils
                                               globals per a TOTS els usuaris" → Cancel·lar | Confirmar */);
  return (/* input del nom + Enter=guardar, Escape=tancar + Cancel·lar | Guardar */);
};
```

**Com queda això a la teva app Electron.** Sense multi-usuari, tot el ramal `confirm-global`
desapareix i el modal es redueix a: *input de nom* + *confirmació de sobreescriptura*. Dues
opcions raonables:

- **Simple:** elimina `isAdmin`, `saveGlobalPreset`, el pas `confirm-global` i el retorn
  `'blocked-system'`. "Per defecte" passa a ser un nom com qualsevol altre (o el reserves i
  prou). Mantén `'blocked-custom'` (el nom `custom` sí que ha de seguir reservat: és
  l'identificador intern de l'esborrany).
- **Equivalent local:** conserva el pas de confirmació, però en comptes de "per a tots els
  usuaris" que escrigui el nou default **al fitxer de config local**. És l'anàleg útil: "fes
  d'aquests estils el meu nou punt de partida permanent".

### B.3 L'avís de preset del sistema

```tsx
// components/Settings/UserStyles/BuiltinPresetNotice.tsx (complet)
export const BuiltinPresetNotice: React.FC = () => {
  const { isAdmin } = useAuth();                       // [ADMIN] ← a Electron: deixa només la branca else
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl mb-4"
         style={{ backgroundColor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)' }}>
      <span className="text-blue-400 text-lg leading-none mt-0.5">ℹ</span>
      <div className="flex-1 text-sm">
        <p className="font-bold text-blue-300 mb-1">Preset del sistema</p>
        {isAdmin ? (
          <p style={{ color: 'var(--th-text-secondary)' }}>
            Ets administrador. Pots editar els estils globals de la plataforma. Edita els valors
            i fes clic a <strong>Guardar</strong>. Escriu <strong>Per defecte</strong> per aplicar
            els canvis a tots els usuaris.
          </p>
        ) : (
          <p style={{ color: 'var(--th-text-secondary)' }}>
            Aquest és el preset &quot;Per defecte&quot; del sistema. Edita els valors i fes clic
            a <strong>Guardar</strong> per crear un preset propi basat en aquest.
          </p>
        )}
      </div>
    </div>
  );
};
```

---

## Apèndix C — On apareix `[ADMIN]` exactament (llista tancada)

Perquè tinguis el quadre complet i puguis eliminar-ho amb confiança, **aquests són tots els
punts del sistema d'ajustos on el rol d'administrador té algun efecte**. No n'hi ha cap més:

| # | Lloc | Comportament amb admin | Comportament sense admin | Què fer a Electron |
|---|---|---|---|---|
| 1 | `UserStylesContext.savePreset()` | Pot desar un preset anomenat "Per defecte" | Retorna `'blocked-system'` i mostra error | Elimina la comprovació de `role` |
| 2 | `UserStylesContext.saveGlobalPreset()` | Crida `api.patchGlobalStyles()` → canvia el default de tots els usuaris | No s'hi arriba mai | **Elimina la funció** o fes-la escriure la config local |
| 3 | `SavePresetModal` pas `confirm-global` | Avís taronja "Admin — Acció global" + confirmació | Pas inexistent | Elimina el pas |
| 4 | `BuiltinPresetNotice` | Text "Ets administrador… Escriu «Per defecte»…" | Text "Edita i guarda per crear un preset propi" | Deixa només el text d'usuari normal |
| 5 | `UserStylesContext` — `me.globalStyles` | Els estils globals del backend pisen els `FACTORY_*` en muntar | Igual (els rep, no els edita) | Elimina; els `FACTORY_*` del codi són l'únic default |

**Res del sistema de TEMA ni del de DRECERES depèn d'admin.** Aquests dos els pots portar
sencers sense tocar cap comprovació de permisos — només treure'n la persistència a backend.

---

## Apèndix D — mapa de fitxers de referència a l'app original

```
frontend/
├── constants.ts                              # LOCAL_STORAGE_KEYS, DEFAULT_SHORTCUTS, mergeShortcuts
├── appTypes.ts                               # Shortcut, AppShortcuts, StyleAtom (legacy), …
├── index.tsx                                 # crida applyPendingFactoryReset() abans de React
├── App.tsx                                   # ordre de providers; wiring de dreceres 'general'
├── hooks/
│   ├── useKeyboardShortcuts.ts               # hook detector + comboFromEvent
│   └── useLocalStorage.ts                    # [value,setValue] persistit
├── utils/factoryReset.ts                     # reset de dues fases
├── context/
│   ├── Theme/themes.ts                       # presets + TOKEN_GROUPS + buildCustomTheme
│   ├── Theme/ThemeContext.tsx                # applyThemeToDOM, persistència, useTheme
│   └── UserStyles/
│       ├── factoryStyles.ts                  # FACTORY_*_STYLES
│       ├── applyUserStylesToDOM.ts           # emitAtomVars → --us-*
│       └── UserStylesContext.tsx             # presets, custom, useUserStyles
└── components/
    ├── SettingsModal.tsx                     # modal + tabs + ShortcutsTab + editor de tema + factory reset UI
    └── Settings/UserStyles/                  # StylesTab, panells per scope, StyleAtomEditor, StylesPresetBar, SavePresetModal
```
