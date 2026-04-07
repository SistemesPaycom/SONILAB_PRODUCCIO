# Spec — Botó "Restablir configuració de fàbrica" a Settings → General

**Data:** 2026-04-07
**Estat:** Brainstorming complet, pendent d'aprovació de l'usuari per passar a planificació
**Motivació original:** després de canviar els defaults d'atajos `I`/`O` → `Q`/`W` per al TC IN/OUT del editor de subtítols, els usuaris que ja tenen els combos antics persistits a `localStorage` i/o al backend (`me.preferences.shortcuts`) no veuran els nous defaults fins que reseteguin manualment. Cal donar-los una via fàcil i segura per fer aquest reset.

---

## 1. Objectiu

Afegir un botó **Restablir configuració de fàbrica** a la pestanya Settings → General que netegi els ajustos personalitzats de l'usuari (atajos, ajustos d'UI, personalització fina del tema) tant al client com al backend, mentre **preserva** el contingut creat per l'usuari (presets d'estils tipogràfics, historials de versions de documents) i la sessió oberta. Protegit per un modal de doble confirmació amb checkbox bloquejant.

## 2. Decisions cerrades durant el brainstorming

### 2.1. Decisions inicials (fase de brainstorming)

| Decisió | Opció triada | Justificació |
|---|---|---|
| Abast del reset | **B1 — Reset selectiu conservador** | Cumple la motivació original (els nous defaults Q/W es veuran de veritat) sense tocar treball creatiu de l'usuari. |
| Patró de doble confirmació | **β — Modal únic amb checkbox bloquejant** | Protegeix contra missclicks reals sense sentir-se burocràtic; obliga a llegir què passarà per habilitar el botó. |
| Reset del tema | **(ii) — Preservar `themeId`, esborrar `customThemeTokens`** | Respecta l'elecció bàsica de tema (que l'usuari tornaria a triar igual) però neteja la paleta personalitzada (que sí és afinat fi). |

### 2.2. Decisions afegides per la revisió iterativa (ralph loop)

Aquest spec va passar per un cicle de revisió iterativa de 8 iteracions (documentat a [docs/superpowers/specs/reviews/2026-04-07-ralph-findings.md](docs/superpowers/specs/reviews/2026-04-07-ralph-findings.md)) que va identificar 13 issues, dels quals 6 eren *important*. Les decisions de disseny que en van resultar:

| Decisió | Opció triada | Justificació |
|---|---|---|
| Ordre de neteja de localStorage | **Invertir el flux**: fer la neteja a Fase B (post-reload, pre-render) en lloc de Fase A (pre-reload) | Elimina una race condition real on els `useEffect` de persistència de `TranscriptionContext`/`TranslationContext`/`ThemeContext` podien re-escriure keys entre `removeItem` i `reload` (Issue 4). |
| Suport multi-pestanya | **BroadcastChannel** `snlbpro-factory-reset` per notificar pestanyes germanes + aviso informatiu al modal recomanant tancar altres pestanyes (belt-and-suspenders) | Sense això, altres pestanyes amb estat stale en memòria poden desfer el reset via `useEffect` de persistència o via `api.updateMe` subseqüents (Issue 6). |
| Canvis sense desar de documents | **Check explícit de `history.isDirty` abans d'iniciar el reset** + modal de confirmació addicional amb opcions Desar/Continuar/Cancel·lar | Sense això, el Reset podria destruir silenciosament feina no desada de l'usuari (Issue 7). |
| Estat dels mecanismes de sortida durant in-flight | **Tots bloquejats** (Cancel·lar, Escape, backdrop, X) | Resol la contradicció del spec original i evita estats inconsistents per cancel·lació parcial (Issue 8). |
| Fals negatiu del backend | **Verificació via `api.me()`** post-reload abans de mostrar el banner | Evita mostrar "reset parcial" quan en realitat el backend havia processat la petició però la resposta es va perdre (Issue 10). |


## 3. Què es restableix i què es preserva

### 3.1. Backend (`me.preferences`)

| Camp | Acció | Comentari |
|---|---|---|
| `preferences.shortcuts` | ❌ Esborrat (set a `null`) | Motivació principal del feature. |
| `preferences.customThemeTokens` | ❌ Esborrat (set a `null`) | Paleta del tema personalitzat. |
| `preferences.themeId` | ✓ Preservat | L'usuari segueix amb el tema base que va triar. |
| `preferences.userStyles` | ✓ Preservat | Presets tipogràfics — pot ser hores de feina del usuari. |

### 3.2. localStorage del navegador

**Esborrats explícitament** (lista tancada, no prefix-scan):

```ts
// Totes les keys de LOCAL_STORAGE_KEYS excepte THEME:
LOCAL_STORAGE_KEYS.SHORTCUTS,
LOCAL_STORAGE_KEYS.EDITOR_STYLES,        // legacy/deprecated
LOCAL_STORAGE_KEYS.LIBRARY_WIDTH,
LOCAL_STORAGE_KEYS.LIBRARY_NAME_COL_WIDTH,
LOCAL_STORAGE_KEYS.LIBRARY_FORMAT_COL_WIDTH,
LOCAL_STORAGE_KEYS.LIBRARY_DATE_COL_WIDTH,
LOCAL_STORAGE_KEYS.TAKE_MARGIN,
LOCAL_STORAGE_KEYS.TAKE_START_MARGIN,
LOCAL_STORAGE_KEYS.MAX_LINES_SUBS,
LOCAL_STORAGE_KEYS.SUB_GRID_OPACITY,
LOCAL_STORAGE_KEYS.WAVEFORM_HOLD_MS,
LOCAL_STORAGE_KEYS.AUTOSAVE_SRT,
LOCAL_STORAGE_KEYS.TASKS_TRANSLATION,
LOCAL_STORAGE_KEYS.TASKS_TRANSCRIPTION,
LOCAL_STORAGE_KEYS.SRT_EDITOR_MODE,
LOCAL_STORAGE_KEYS.EDITOR_MIN_GAP_MS,
LOCAL_STORAGE_KEYS.CUSTOM_THEME_TOKENS,

// Keys hardcoded fora de LOCAL_STORAGE_KEYS:
'snlbpro_library_v3', // cache de LibraryDataContext

// Variant per-userId (només si tenim userId):
`${LOCAL_STORAGE_KEYS.CUSTOM_THEME_TOKENS}_${userId}`,
```

**Preservats**:
- `LOCAL_STORAGE_KEYS.THEME` (selecció de tema, opció ii)
- `${LOCAL_STORAGE_KEYS.THEME}_${userId}` (variant scopada del tema)
- `snlbpro_versions_<docId>` (historials de versions de documents — possible feina sense desar)
- `snlbpro_user_styles_<userId>` (cache local de presets — es rehidrata del backend)
- `sonilab_guion_<docId>` (còpia local del text del guió per document — pot contenir feina sense desar; definida a [VideoSubtitlesEditorView.tsx:207](frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx#L207), [ScriptExternalView.tsx:22](frontend/components/ScriptExternalView.tsx#L22), [ScriptViewPanel.tsx:38](frontend/components/VideoSubtitlesEditor/ScriptViewPanel.tsx#L38))
- `sonilab_token` (token d'autenticació JWT — Reset ≠ Logout; definit a [api.ts:8](frontend/services/api.ts#L8))
- Qualsevol key amb prefix `slsf_` (orfes legacy, gestió manual documentada a `domain-localstorage.md`)

> **⚠ Nota sobre els prefixes del codebase**: el frontend de Sonilab utilitza **dos** prefixes de localStorage paral·lels:
> - `snlbpro_*` — majoria de keys (tot `LOCAL_STORAGE_KEYS`, `versionStore`, `user_styles_*`, `library_v3`).
> - `sonilab_*` — dos casos: `sonilab_token` (auth) i `sonilab_guion_<docId>` (text del guió per document).
>
> Aquesta dualitat és conseqüència d'evolució històrica del codebase i no cal unificar-la. Però és crític **recordar-la** quan es pensa en el Reset: un prefix scan `snlbpro_*` **no** capturaria les keys `sonilab_*`, i un prefix scan `sonilab_*` **sí** capturaria el token (trencant "Reset ≠ Logout"). **Per això el spec descarta tot prefix scan i usa una llista explícita tancada (`KEYS_TO_REMOVE` a la secció 4.2)**.

**Per què lista explícita i no `Object.keys(localStorage).filter(k => k.startsWith('snlbpro_'))`**: a més del problema dels dos prefixes descrit a la nota de sobre, la segona opció borraria sense distingir les keys que volem preservar dins del mateix prefix (com `snlbpro_versions_*` i `snlbpro_user_styles_*`), i qualsevol feature futura que afegís una key amb el prefix patiría regressió silenciosa. La llista explícita és més verbosa però **segura per defecte**.

## 4. Arquitectura

### 4.1. Mòduls afectats

| Fitxer | Tipus de canvi | Línies aprox |
|---|---|---|
| `frontend/utils/factoryReset.ts` | **NOU** — lògica del reset (Fase A i Fase B) + llista explícita de keys | ~100 |
| `frontend/index.tsx` | Modificat — invocar `applyPendingFactoryReset()` abans del render React | +~10 |
| `frontend/components/SettingsModal.tsx` | Modificat — tarjeta + modal local + handler amb isDirty check | +~160 |
| `frontend/App.tsx` | Modificat — state + effect + banner inline post-reload + listener BroadcastChannel multi-pestanya | +~50 |
| `Skills_Claude/domain-localstorage.md` | Modificat — afegir pas 6 a la guia de keys | +~5 |

**No es modifiquen**: `constants.ts`, `useKeyboardShortcuts.ts`, `AuthContext`, `ThemeContext`, `UserStylesContext`, `TranscriptionContext`, `TranslationContext`, `LibraryDataContext`. Aquests contextos ja gestionen correctament el cas "valor null al backend → fallback als defaults" (verificat al brainstorming) **i** la recàrrega de pàgina garanteix que tots munten amb estat net (la Fase B del reset s'executa al `index.tsx` abans que cap provider React munti).

### 4.2. API de `factoryReset.ts`

El mòdul exposa **dues funcions** (una per a cada fase del reset) més una constant que serveix de font única de veritat per a les keys de localStorage que es netegen.

```ts
// ─── Llista autoritativa de keys de localStorage que el reset esborra ─────
// Font única de veritat. Es referencia des de domain-localstorage.md.
// Quan s'afegeix una key nova a LOCAL_STORAGE_KEYS, decidir si ha d'anar aquí.
const KEYS_TO_REMOVE: readonly string[] = [
  // Totes les keys de LOCAL_STORAGE_KEYS excepte THEME (vegeu secció 3.2):
  LOCAL_STORAGE_KEYS.SHORTCUTS,
  LOCAL_STORAGE_KEYS.EDITOR_STYLES,
  LOCAL_STORAGE_KEYS.LIBRARY_WIDTH,
  LOCAL_STORAGE_KEYS.LIBRARY_NAME_COL_WIDTH,
  LOCAL_STORAGE_KEYS.LIBRARY_FORMAT_COL_WIDTH,
  LOCAL_STORAGE_KEYS.LIBRARY_DATE_COL_WIDTH,
  LOCAL_STORAGE_KEYS.TAKE_MARGIN,
  LOCAL_STORAGE_KEYS.TAKE_START_MARGIN,
  LOCAL_STORAGE_KEYS.MAX_LINES_SUBS,
  LOCAL_STORAGE_KEYS.SUB_GRID_OPACITY,
  LOCAL_STORAGE_KEYS.WAVEFORM_HOLD_MS,
  LOCAL_STORAGE_KEYS.AUTOSAVE_SRT,
  LOCAL_STORAGE_KEYS.TASKS_TRANSLATION,
  LOCAL_STORAGE_KEYS.TASKS_TRANSCRIPTION,
  LOCAL_STORAGE_KEYS.SRT_EDITOR_MODE,
  LOCAL_STORAGE_KEYS.EDITOR_MIN_GAP_MS,
  LOCAL_STORAGE_KEYS.CUSTOM_THEME_TOKENS,
  'snlbpro_library_v3', // cache de LibraryDataContext (no viu a LOCAL_STORAGE_KEYS)
];

const PENDING_FLAG = 'snlbpro_factory_reset_pending';
const WARN_FLAG = 'snlbpro_factory_reset_warn';
const BC_CHANNEL = 'snlbpro-factory-reset';

/**
 * Fase A — Inicia el reset de fàbrica per a l'usuari actual.
 *
 * Què fa:
 * 1. Neteja les preferències del backend (shortcuts, customThemeTokens) via api.updateMe.
 * 2. Notifica altres pestanyes via BroadcastChannel perquè també es recarreguin.
 * 3. Marca un flag `PENDING_FLAG` a sessionStorage amb el userId (o '' si null).
 * 4. Si el backend ha fallat, també marca `WARN_FLAG`.
 *
 * Què NO fa:
 * - NO crida `localStorage.removeItem` directament. Això ho fa `applyPendingFactoryReset()`
 *   al post-reload, abans que cap provider React munti, per evitar la race condition
 *   d'effectes de persistència que poden re-escriure keys durant la finestra entre
 *   removeItem i reload.
 * - NO fa `window.location.reload()`. El cridador ha de fer-ho després.
 */
export async function factoryReset(userId: string | null): Promise<{
  ok: boolean;          // sempre true (mai llança)
  backendOk: boolean;   // false si la crida a updateMe ha fallat
}>;

/**
 * Fase B — Aplica la neteja pendent de localStorage. Invocació obligatòria a
 * `frontend/index.tsx` ABANS del `ReactDOM.createRoot(...).render(<App />)`.
 *
 * Si no hi ha flag `PENDING_FLAG` a sessionStorage, no fa res (cas comú del load inicial).
 *
 * Si n'hi ha:
 * 1. Llegeix el userId del valor del flag (cadena buida si l'usuari no estava logueat).
 * 2. Itera sobre `KEYS_TO_REMOVE` i fa `localStorage.removeItem(key)` per a cadascuna.
 * 3. Si hi ha userId, també elimina la variant scopada: `${CUSTOM_THEME_TOKENS}_${userId}`.
 * 4. Esborra `PENDING_FLAG`.
 * 5. Deixa intacte `WARN_FLAG` si hi era (el banner post-reload l'ha de llegir).
 *
 * Síncrona i segura per a cridar abans del render. No toca React ni api.
 */
export function applyPendingFactoryReset(): void;
```

## 5. Flux d'execució

El flux es divideix en **dues fases** per evitar una race condition real entre la neteja de localStorage i el `window.location.reload()`:

- **Fase A** — executada pel cridador del modal (`SettingsModal.tsx`). Toca backend, notifica altres pestanyes, marca un flag a sessionStorage i dispara el reload.
- **Fase B** — executada a `frontend/index.tsx` **abans** del render React. Llegeix el flag de sessionStorage i, si hi és, neteja localStorage abans que cap provider munti.

### Per què aquest split? (la race condition que evita)

Si es netegés localStorage **abans** del reload (p. ex. `removeItem(...)` + `reload()`), durant els mil·lisegons entre els dos s'obriria una finestra on els `useEffect` de persistència de contextos com `TranscriptionContext`, `TranslationContext` i `ThemeContext` podrien reaccionar a dispatches en vol (respostes de polling, timers pendents) i **re-escriure** les keys que acabem de netejar. Resultat: el reset queda parcialment desfet abans que el reload s'hagi materialitzat.

Fent la neteja a `index.tsx` **després** del reload i **abans** del `ReactDOM.createRoot().render(<App/>)`, no hi ha cap provider React muntat, ni `useEffect` actiu, ni polling loop en marxa, ni cap codi capaç d'escriure a localStorage. La neteja és atòmica respecte a qualsevol consumidor. Aquesta arquitectura elimina la race completament.

---

### Fase A — Prior al reload (dins de `factoryReset()` + cridador)

Executada dins de `factoryReset.ts → factoryReset()` i del handler del modal a `SettingsModal.tsx`.

#### Pas A1 — Backend (try/catch defensiu)

```ts
let backendOk = true;
try {
  await api.updateMe({
    preferences: {
      shortcuts: null,
      customThemeTokens: null,
    },
  });
} catch {
  backendOk = false;
}
```

Només s'envien les dues claus a netejar. La resta (`themeId`, `userStyles`) ni es mencionen, així que el merge del backend les deixa intactes. Confirmat per [users.service.ts:70-73](backend_nest_mvp/src/modules/users/users.service.ts#L70-L73), que fa `set['preferences.${key}'] = value` per a cada clau de l'objecte rebut.

Si el backend falla, **no s'aborta** — es continua amb la resta de passos. El banner post-reload informarà l'usuari (vegeu pas A3 i Fase B post-reload).

#### Pas A2 — Notificar pestanyes germanes via BroadcastChannel

```ts
try {
  const bc = new BroadcastChannel('snlbpro-factory-reset');
  bc.postMessage({ type: 'reset' });
  bc.close();
} catch { /* BC no disponible en navegadors molt antics, ignorar */ }
```

Les altres pestanyes de Sonilab obertes pel mateix usuari reben aquest missatge a un listener que viu a `App.tsx` (vegeu secció **Multi-pestanya** més avall). Cada pestanya germana es recarrega ella mateixa, agafant els defaults nets de la nova localStorage.

Aquesta notificació **ha d'anar abans** del `setItem` de Pas A3 i del reload de Pas A4 per maximitzar la finestra en què les altres pestanyes reben el missatge.

#### Pas A3 — Marcar flag pending i (opcionalment) flag warn a sessionStorage

```ts
try {
  sessionStorage.setItem(PENDING_FLAG, userId ?? '');
  if (!backendOk) {
    sessionStorage.setItem(WARN_FLAG, '1');
  }
} catch { /* sessionStorage deshabilitat (mode privat d'alguns navegadors) */ }
```

El `PENDING_FLAG` duu el `userId` com a payload perquè la Fase B pugui construir la variant scopada de `CUSTOM_THEME_TOKENS` sense haver-se d'esperar que AuthContext es rehidrati. Si l'usuari no estava logueat, el valor és una cadena buida — la Fase B omet les variants scopades en aquest cas.

#### Pas A4 — Reload

```ts
window.location.reload();
```

El reload és el punt en què la pestanya actual avança a Fase B. Les altres pestanyes ja han rebut la notificació BC i s'estan recarregant en paral·lel.

---

### Fase B — Post-reload, abans del render React (`frontend/index.tsx`)

Executada una sola vegada, síncronament, a l'entrypoint de l'aplicació:

```ts
// frontend/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { applyPendingFactoryReset } from './utils/factoryReset';

// ABANS de muntar l'arbre React: si hi ha un reset pendent, aplica la neteja
// de localStorage síncronament. Això garanteix que quan els providers comencin
// a inicialitzar (AuthContext, ThemeContext, TranscriptionContext, etc.), ja
// trobin el localStorage net. Elimina la race condition amb els useEffect de
// persistència dels contextos.
applyPendingFactoryReset();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

#### Implementació d'`applyPendingFactoryReset()`

```ts
export function applyPendingFactoryReset(): void {
  let userId: string | null = null;
  try {
    const pending = sessionStorage.getItem(PENDING_FLAG);
    if (pending === null) return; // cas comú: no hi ha reset pendent
    userId = pending || null;     // '' → null; 'abc123' → 'abc123'
    sessionStorage.removeItem(PENDING_FLAG);
  } catch {
    return; // sessionStorage deshabilitat → no podem saber si hi ha pending
  }

  // Neteja de totes les keys de la llista autoritativa
  for (const key of KEYS_TO_REMOVE) {
    try { localStorage.removeItem(key); } catch { /* improbable, ignorar */ }
  }

  // Variant scopada de CUSTOM_THEME_TOKENS (només si tenim userId)
  if (userId) {
    try {
      localStorage.removeItem(`${LOCAL_STORAGE_KEYS.CUSTOM_THEME_TOKENS}_${userId}`);
    } catch {}
  }

  // NO esborrar WARN_FLAG aquí — el banner post-reload (App.tsx) l'ha de llegir.
}
```

**Important**: aquesta funció **no** esborra `snlbpro_theme` ni la seva variant scopada `snlbpro_theme_<userId>` (decisió de disseny: preservem el `themeId` triat, només netegem `customThemeTokens`).

**Important 2**: aquesta funció **no** toca `snlbpro_versions_<docId>`, `snlbpro_user_styles_<userId>`, `sonilab_guion_<docId>`, `sonilab_token` ni cap altra key que no estigui explícitament a `KEYS_TO_REMOVE`. La filosofia és "blocklist estricta, tot el que no està a la llista es preserva per defecte".

#### Pas B1 — Banner post-reload a `App.tsx` (cas backend fallat)

Constatació important: el codebase **no té sistema global de toasts**. Hi ha un patró ad-hoc a [App.tsx:627-650](frontend/App.tsx#L627-L650) per a notificacions de tasques completades (state `completedToasts` + JSX inline) i un mini-banner "Canvis sense desar" a [App.tsx:621-625](frontend/App.tsx#L621-L625). Per coherència amb aquests patrons, l'avís post-reset es fa amb un banner inline propi, NO amb un sistema de toasts nou.

**Amb l'afegit de la verificació via `api.me()`** (Issue 10 de la revisió): abans de mostrar el banner, comprovem si el backend realment té la preferència a null. Si sí, el `WARN_FLAG` era un fals negatiu (la petició es va processar al servidor però la resposta es va perdre abans d'arribar al client), i el banner no s'ha de mostrar.

```tsx
// Dins del component App, juntament amb els altres useState:
const [factoryResetWarn, setFactoryResetWarn] = useState(false);

useEffect(() => {
  let cancelled = false;
  try {
    const flag = sessionStorage.getItem('snlbpro_factory_reset_warn');
    if (!flag) return;
    sessionStorage.removeItem('snlbpro_factory_reset_warn');

    // Verificació post-reload: el backend realment té shortcuts nullat?
    // Si sí, el WARN era un fals negatiu (la petició es va processar
    // però la resposta no va arribar al client). No mostrem banner.
    api.me()
      .then(profile => {
        if (cancelled) return;
        const backendActuallyReset = !profile?.preferences?.shortcuts;
        if (!backendActuallyReset) setFactoryResetWarn(true);
      })
      .catch(() => {
        // Si ni /me funciona, assumim reset parcial i avisem.
        if (!cancelled) setFactoryResetWarn(true);
      });
  } catch { /* sessionStorage deshabilitat, no hi ha flag, ignorar */ }

  return () => { cancelled = true; };
}, []);

// Dins del JSX de retorn, prop a "Canvis sense desar":
{factoryResetWarn && (
  <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[700] max-w-xl px-4 py-3 bg-amber-900/95 border border-amber-500/50 rounded-xl shadow-2xl backdrop-blur-md flex items-start gap-3">
    <span className="text-amber-400 text-lg">⚠</span>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold text-amber-100">Reset parcial</p>
      <p className="text-xs text-amber-200/80 mt-1">
        S'han restablert els ajustos locals però no s'ha pogut sincronitzar amb el servidor. Algunes preferències poden tornar a aparèixer fins que tornis a provar el reset més tard.
      </p>
    </div>
    <button
      onClick={() => setFactoryResetWarn(false)}
      className="text-amber-400 hover:text-white text-lg transition-colors"
      aria-label="Tancar avís"
    >
      &times;
    </button>
  </div>
)}
```

El banner segueix la mateixa estètica que els altres avisos del fitxer (rounded-xl, backdrop-blur, fixed positioning).

---

### Multi-pestanya (listener BroadcastChannel a `App.tsx`)

Per complementar la notificació que el Pas A2 emet, les altres pestanyes obertes del mateix usuari han de reaccionar al missatge i recarregar-se elles també. L'implementació del listener viu a `App.tsx` dins d'un `useEffect` al nivell més alt:

```tsx
// A App.tsx, al component principal, abans del return:
// Les constants BC_CHANNEL i PENDING_FLAG s'importen des de factoryReset.ts
// perquè siguin font única de veritat (evita drift).
import { BC_CHANNEL, PENDING_FLAG } from './utils/factoryReset';

useEffect(() => {
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(BC_CHANNEL);
    bc.onmessage = (ev) => {
      if (ev.data?.type === 'reset') {
        // Una altra pestanya ha iniciat un Factory Reset. Marquem el flag
        // pending per a aquesta pestanya i ens recarreguem. Al post-reload,
        // applyPendingFactoryReset() netejarà el localStorage (si encara
        // cal — en la pràctica ja estarà net perquè la pestanya A haurà
        // passat primer, però la idempotència és segura).
        try {
          sessionStorage.setItem(PENDING_FLAG, '');
        } catch {}
        window.location.reload();
      }
    };
  } catch { /* BroadcastChannel no disponible, ignorar */ }
  return () => { if (bc) bc.close(); };
}, []);
```

**Nota sobre l'exportació de constants**: `BC_CHANNEL`, `PENDING_FLAG` i `WARN_FLAG` han de ser exportades des de `factoryReset.ts` (no només declarades al mòdul) perquè `App.tsx` les pugui importar. Això garanteix font única de veritat i evita drift.

**Nota sobre idempotència**: la Fase B (`applyPendingFactoryReset`) és idempotent — si la pestanya B la crida quan localStorage ja està net (perquè la pestanya A l'ha netejat abans), els `removeItem` són no-ops. No hi ha conflicte ni corrupció.

---

### Per què la recàrrega és obligatòria

- El cache d'atajos a [useKeyboardShortcuts.ts:9-18](frontend/hooks/useKeyboardShortcuts.ts#L9-L18) és **module-level**, no es refresca esborrant `localStorage`.
- **Almenys 6 contextes React** inicialitzen estat al mount llegint `localStorage`: `ThemeContext`, `AuthContext`, `LibraryDataContext`, `TranscriptionContext`, `TranslationContext`, `UserStylesContext`.
- A més, **9+ components** consumeixen `useLocalStorage(KEY, initial)` que llegeix la key al mount. El hook SÍ escolta events `storage` ([useLocalStorage.ts:33-51](frontend/hooks/useLocalStorage.ts#L33-L51)), però `removeItem` directe **no** dispara aquest event per a la mateixa pestanya (només per a altres pestanyes), i de totes maneres `applyPendingFactoryReset()` s'executa abans que aquests components muntin.
- Sense recàrrega, caldria modificar tots aquests 15+ punts per escoltar un event de reset — un blast radius incompatible amb el principi del CLAUDE.md raíz: "canvis petits, verificables, reversibles, limitats al abast demanat".
- La recàrrega combinada amb la Fase B pre-render és l'arquitectura mínima que garanteix estat net sense tocar cap dels contextos existents.

## 6. UI

### 6.1. Tarjeta a Settings → General

Posició: **al final** del bloc `activeTab === 'general'`, entre la tarjeta "Sincronització de Vídeo" (que tanca a [SettingsModal.tsx:735](frontend/components/SettingsModal.tsx#L735)) i el `</div>` del wrapper a [SettingsModal.tsx:736](frontend/components/SettingsModal.tsx#L736).

Estil consistent amb les altres tarjetes del tab:
- `p-6 rounded-2xl`
- `backgroundColor: 'var(--th-bg-secondary)'`
- `border: '1px solid var(--th-border)'`
- Cabecera `h3` amb `text-lg font-black text-white uppercase tracking-tight mb-4` i icona SVG inline (triangle d'avís).

Contingut:
- Títol: **Restablir configuració**
- Subtext (`text-xs text-gray-500 italic`): "Tornar la configuració d'aquesta aplicació al seu estat per defecte. No afecta els teus presets d'estils ni els historials dels teus documents."
- Botó alineat a la dreta: **Restablir configuració de fàbrica…** (amb el·lipsi per indicar que obre modal)
- Estil destructiu: borde i text en vermell (p. ex. `border-red-500/40 text-red-400`), hover intensifica.

### 6.2. Modal `FactoryResetConfirmModal`

Component local dins de `SettingsModal.tsx` (segueix el patró del fitxer, que defineix `ShortcutsTab` inline).

**Estructura**:

```
┌──────────────────────────────────────────────────────────┐
│  ⚠  Restablir configuració de fàbrica                     │
│  ──────────────────────────────────────────────────────  │
│                                                          │
│  Aquesta acció restablirà la configuració d'aquesta     │
│  aplicació al seu estat per defecte. Algunes coses      │
│  es mantindran intactes.                                 │
│                                                          │
│  ┌─────────────────────┬──────────────────────────┐     │
│  │ ❌ Es restablirà    │ ✓ Es preservarà          │     │
│  ├─────────────────────┼──────────────────────────┤     │
│  │ • Dreceres de       │ • Presets d'estils       │     │
│  │   teclat            │   tipogràfics            │     │
│  │ • Ajustos de la     │ • Tema seleccionat       │     │
│  │   interfície        │ • Historials de          │     │
│  │ • Personalització   │   versions dels          │     │
│  │   del tema          │   documents              │     │
│  │ • Mides i columnes  │ • Sessió oberta          │     │
│  │   de la Llibreria   │   (no es tanca sessió)   │     │
│  └─────────────────────┴──────────────────────────┘     │
│                                                          │
│  ℹ Consell: es recomana tenir només aquesta pestanya   │
│    de Sonilab oberta durant el procés. Les altres       │
│    pestanyes es recarregaran automàticament, però       │
│    per seguretat és millor tancar-les abans.            │
│                                                          │
│  ☐ Entenc que es perdran aquests ajustos i que          │
│    aquesta acció no es pot desfer                        │
│                                                          │
│  ──────────────────────────────────────────────────────  │
│                      [ Cancel·lar ]  [ Restablir ]       │
└──────────────────────────────────────────────────────────┘
```

**Comportament — Estat inicial (checkbox no marcat)**:

- Backdrop fosc, modal centrat (mateix patró que altres modals del codebase, p. ex. `SyncLibraryModal.tsx` — es replicarà el patró durant la implementació).
- **Cancel·lar**: habilitat. També es tanca amb Escape i amb click al backdrop.
- **Restablir configuració** (botó destructiu vermell sòlid): **disabled** mentre `confirmed === false`.
- L'aviso de multi-pestanya és informatiu i sempre visible.

**Comportament — Checkbox marcat, encara no s'ha clicat Restablir**:

- **Cancel·lar**: habilitat (inclou Escape i backdrop).
- **Restablir configuració**: **habilitat**.

**Comportament — Click a Restablir → in-flight (entre click i reload)**:

Durant aquesta finestra, tots els mecanismes de sortida del modal queden **bloquejats**:

| Mecanisme | Estat durant in-flight |
|---|---|
| Botó Cancel·lar | **disabled** |
| Botó Restablir configuració | **disabled**, mostra spinner + text "Restablint…" |
| Tecla Escape | **ignorada** (el handler de Escape del modal comprova el state `isResetting` i retorna sense tancar) |
| Click al backdrop | **ignorat** (handler de backdrop igual que Escape) |
| Botó X de tancament (si n'hi ha) | **disabled** |

**Raó de bloquejar tots els mecanismes**: una cancel·lació parcial deixa l'aplicació en estat inconsistent:
- Si es cancel·la després del pas A1 (backend) però abans del A4 (reload): el backend té `shortcuts = null` però el localStorage encara té les shortcuts velles. La propera vegada que l'usuari edita un shortcut, el SettingsModal llegirà del localStorage, persistirà al backend, i el "reset" haurà estat sense efecte.
- Si es cancel·la després del A2 (BroadcastChannel): les altres pestanyes ja s'estaran recarregant. No es pot aturar. Deixar la pestanya actual sense recarregar crearia un estat on les altres són noves i aquesta és vella.

L'única recuperació d'una cancel·lació parcial és fer un Reset sencer un altre cop. És millor no oferir-la — l'usuari espera ~1-2 segons i acaba.

**Comportament — Cas especial: canvis sense desar al document (Issue 7 de la revisió)**

Si al moment de clicar "Restablir" hi ha canvis sense desar a algun document (`history.isDirty === true` global — detectable via un ref compartit o un Context), el flux es desvia a un **pas de confirmació addicional**:

```
┌──────────────────────────────────────────────────────────┐
│  ⚠  Tens canvis sense desar                              │
│  ──────────────────────────────────────────────────────  │
│                                                          │
│  Tens canvis sense desar en un document. Si continues   │
│  amb el reset, aquests canvis es perdran definitivament.│
│                                                          │
│  Què vols fer?                                           │
│                                                          │
│  ──────────────────────────────────────────────────────  │
│  [ Desar i continuar ]  [ Continuar sense desar ]  [ Cancel·lar ]│
└──────────────────────────────────────────────────────────┘
```

- **Desar i continuar**: invoca el handler `handleSave` del document actiu (cal una manera d'exposar-lo al modal — via un ref global a `App.tsx` o un event custom), espera la confirmació de desat, i llavors continua amb el reset.
- **Continuar sense desar**: procedeix al reset directament, descartant els canvis.
- **Cancel·lar**: tanca aquest modal de confirmació i torna al modal del Reset (o ambdós es tanquen — decisió d'implementació menor).

**Implementació del check `isDirty`**: durant la brainstorming es va identificar que `history.isDirty` viu localment a cada component editor. Per fer-lo accessible al `SettingsModal`, l'opció més simple és afegir un ref global `window.__sonilabIsDirtyRef` (exposat des de `App.tsx` quan hi ha un editor obert) que el handler del Reset consulta. Alternatives més elegants (Context global, event `onbeforeunload` nadiu) queden fora del scope d'aquest feature però són la direcció correcta a llarg plazo (vegeu secció 7 "No es fan").

- **No hi ha tercer pas** (més enllà del de canvis sense desar) entre el click i l'execució: el checkbox JA és la doble confirmació del flux normal. Un tercer "estàs segur?" seria redundant amb el patró β.

## 7. Edge cases i gestió d'errors

| Cas | Comportament |
|---|---|
| Backend caigut | Fase A continua (pas A2 BroadcastChannel, pas A3 flags, pas A4 reload); Fase B neteja localStorage com sempre; post-reload `api.me()` verifica i el banner només apareix si el backend realment NO té la preferència nullada. |
| `localStorage.removeItem` falla (improbable) | try/catch envolt cada crida dins de `applyPendingFactoryReset()`; les altres claus segueixen netejant-se. |
| Usuari sense `me.id` (no logueat) | El feature només té sentit logueat. La tarjeta/botó es mostra igual; el `userId` passat a `factoryReset` és `null` i s'omet la variant scopada de `CUSTOM_THEME_TOKENS`. La crida a `api.updateMe` fallarà (401) → s'agafa al try/catch → `backendOk = false` → banner post-reload (si la verificació `api.me()` no el suprimeix). |
| `sessionStorage.setItem` falla (mode privat Safari legacy, storage denegat) | try/catch envolt tota crida a `sessionStorage` tant a Fase A com a `applyPendingFactoryReset()`. Si falla a A3, el reload es fa igual però sense flag pending — el reset local NO s'aplicarà post-reload (known limitation acceptada). |
| Fals negatiu del backend (request processat però response perduda) | El banner comprova via `api.me()` post-reload si `preferences.shortcuts` realment està nullat. Si sí, no es mostra el banner tot i tenir `WARN_FLAG`. |
| Multi-pestanya sense `BroadcastChannel` suport (IE, navegadors molt antics) | El `try` del pas A2 atrapa l'error silenciosament. Les altres pestanyes no es recarreguen. L'aviso informatiu al modal recomana a l'usuari tancar altres pestanyes abans → fallback manual. |
| Canvis sense desar al moment de Reset | Abans d'iniciar `factoryReset()`, el handler comprova `history.isDirty` global. Si `true`, es desvia a un modal de confirmació addicional amb opcions Desar/Continuar sense desar/Cancel·lar (vegeu secció 6.2). |
| Usuari marca checkbox, després el desmarca | El botó torna a disabled. Estat trivial gestionat per `useState<boolean>`. |
| Usuari fa click a "Restablir" molt ràpid abans del spinner | El handler comprova que no hi ha una crida en curs (`isResetting` state). Doble click no provoca dues crides. |
| Reset → editar shortcut → reset altra vegada | No hi ha estat residual. Cada crida a `factoryReset` és atòmica i el reload garanteix snapshot net. |

## 8. Coses que NO es fan (anti-scope-creep)

- **No** es refactoritza `LOCAL_STORAGE_KEYS` ni es normalitzen les keys hardcoded fora d'ell.
- **No** s'afegeix un sistema de "categories" a `LOCAL_STORAGE_KEYS` (tipus `{key, resetable: true}`). Over-engineering per a tres categories.
- **No** es modifica `useKeyboardShortcuts.ts` perquè el seu cache module-level escolti canvis. La recàrrega elimina la necessitat.
- **No** s'afegeix "deshacer Reset" ni cap backup pre-reset. La doble confirmació és la protecció.
- **No** es crea cap test automàtic. El codebase no té framework de tests d'integració per a UI React; el feature és side-effect-heavy sobre `localStorage`/`reload`. Testing manual estricte segons la secció 9.
- **No** s'afegeix un `beforeunload` handler global que protegeixi TOTS els casos de pèrdua de canvis sense desar (tancar pestanya, navegació accidental, etc.). Això seria una millora transversal molt recomanable però fora del scope d'aquest feature. L'Issue 7 de la revisió iterativa s'ha resolt només dins del scope del Reset (check `history.isDirty` al handler del Reset), no a nivell de sistema.
- **No** s'afegeix un listener de `storage` events als contextos `TranscriptionContext`, `TranslationContext` ni `LibraryDataContext` per fer-los cross-tab-aware. Això és una millora transversal recomanable (faria el Reset multi-pestanya robust fins i tot sense `BroadcastChannel`), però fora del scope d'aquest feature. El `BroadcastChannel` + recàrrega forçada és suficient per al Reset.
- **No** es refactoritza `factoryReset.ts` per modularitzar `KEYS_TO_REMOVE` en grups (p. ex. "ajustos UI" vs "cache de dades"). És una sola llista plana; afegir estructura és over-engineering per a aquest ús.
- **No** es toquen les keys `sonilab_token`, `sonilab_guion_<docId>`, `snlbpro_versions_<docId>`, `snlbpro_user_styles_<userId>` ni les variants scopades del tema (`snlbpro_theme_<userId>`). Aquestes són les principals protegides per preservació explícita.

## 9. Pla de testing manual

### 9.1. Prerequisits

1. Usuari logueat amb estat "personalitzat" preparat manualment per simular un usuari real:
   - Atajos custom: cal entrar a Settings → Dreceres i reassignar `sub_set_tc_in` i `sub_set_tc_out` als valors antics `I` i `O` (per simular un usuari amb prefs anteriors al canvi de defaults Q/W).
   - `max_lines_subs = 4` (ajustar des de Settings → General).
   - `library_width = 600` (arrossegant la vora de la Library, o editant `localStorage.snlbpro_library_width` directament).
   - Tokens custom de tema definits (entrar al tab Tema, modificar alguns colors).
   - Almenys un preset d'estils tipogràfics creat (entrar a Settings → Estils, crear un preset).
   - Almenys un document amb 2-3 versions a l'historial (obrir un document, fer canvis i desar diverses versions).

### 9.2. Casos obligatoris

1. **Happy path**: Reset → reload → comprovar:
   - Atajos = defaults nous (Q/W per TC IN/OUT) ✓
   - max_lines_subs = default
   - library_width = 420 (default)
   - customThemeTokens nets (paleta vanilla)
   - **themeId preservat** (segueix al mateix tema base)
   - **Presets de userStyles preservats**
   - Sessió activa (no logueat fora)

2. **Cancel·lar**: obrir modal, marcar checkbox, click Cancel·lar → modal es tanca, refresc manual confirma que res no ha canviat.

3. **Botó disabled**: obrir modal, intentar click a "Restablir" sense marcar el checkbox → no respon, no passa res.

4. **Backend caigut**: aturar el backend, executar el flux complet → Fase A falla al pas A1 però continua, Fase B neteja localStorage, post-reload apareix **banner** groc d'avís (tret que `api.me()` post-reload confirmi que el backend sí havia processat la petició — cas de fals negatiu). Refresc posterior: el **banner** NO torna a aparèixer (flag `WARN_FLAG` netejat).

5. **Reset doble**: després del primer reset, editar manualment un shortcut, fer el reset un altre cop → no hi ha estat residual, tot torna a defaults.

6. **No regressió Library**: després del reset, obrir Library → es carrega correctament des del backend (la cache `snlbpro_library_v3` està buida però el fetch funciona).

7. **Versionat preservat**: abans del reset, anotar el nombre de versions d'un document. Reset → reload → reobrir el document → confirmar que les versions hi són.

8. **Multi-pestanya**: obrir dues pestanyes de Sonilab amb el mateix usuari. A la pestanya A, entrar a Settings → Dreceres i modificar algun atajo. A la pestanya B, verificar que l'atajo es sincronitza via `storage` event (només per components que usen `useLocalStorage` hook directament, no per contextos com TranscriptionContext). Llavors a la pestanya A, executar Reset. Comprovar:
   - La pestanya A es recarrega i mostra defaults.
   - La pestanya B també es recarrega automàticament (gràcies al listener de `BroadcastChannel` a `App.tsx`).
   - Després de la recàrrega de B, els defaults hi són també.
   - Les transcripcions/traduccions que hi havia en curs a la pestanya B **no tornen a aparèixer** post-reload de B (la Fase B pre-init ha netejat `TASKS_TRANSCRIPTION` i `TASKS_TRANSLATION`).

9. **Canvis sense desar**: obrir un document, fer una edició, veure que apareix el banner "Canvis sense desar". Sense desar, entrar a Settings → Reset → marcar checkbox → click "Restablir" → **comprovar que apareix el modal de confirmació addicional de canvis sense desar**. Provar les tres opcions del modal:
   - "Desar i continuar" → el desat s'executa, llavors el reset continua.
   - "Continuar sense desar" → el reset continua immediatament, els canvis del document es perden definitivament.
   - "Cancel·lar" → torna al modal del Reset (o es tanquen ambdós).

10. **Cancel·lació bloquejada durant in-flight**: després de clicar "Restablir configuració", mentre el spinner gira, provar de pulsar Escape, fer click al backdrop i al botó Cancel·lar (si és visible). Comprovar que **cap dels tres** mecanismes tanca el modal abans que el reload es dispari.

11. **sessionStorage deshabilitat**: en un navegador amb sessionStorage bloquejat (simulable via DevTools → Application → desmarcar Storage → Session Storage), executar el flux. Comprovar que l'app no es bloqueja; el reset local NO s'aplica (perquè no hi ha flag pending que Fase B pugui llegir), però tampoc fa crash — degradació suau. És una **known limitation** acceptada pel spec.

## 10. Dominis afectats (regla 10 del CLAUDE.md raíz)

- **`Skills_Claude/domain-localstorage.md`** ← s'actualitza
  
  Afegir un pas 6 a la secció "Qué hacer si se añade o renombra una clave":
  > 6. Si la nova clau ha de restablir-se al "factory reset", afegir-la a la llista `KEYS_TO_REMOVE` de `frontend/utils/factoryReset.ts`. Si ha de preservar-se (ex: dades del document, presets de l'usuari, sessió), no afegir-la i deixar un comentari aquí explicant per què.

- **`Skills_Claude/domain-user-styles.md`** ← verificar (canvi opcional)
  
  Si el .md descriu explícitament què toca o no als presets, afegir una línia: "el factory reset preserva els presets — vegeu `factoryReset.ts`".

- **No s'afecten** altres dominis. El Reset és transversal però no canvia el model de cap dels dominis registrats.

## 11. Referències al codi

- [SettingsModal.tsx:610-736](frontend/components/SettingsModal.tsx#L610-L736) — bloc del tab General on s'afegirà la tarjeta nova. Inserció entre L735 (tancament tarjeta Video Sync) i L736 (tancament del wrapper `<div className="space-y-6">`).
- [SettingsModal.tsx:133-320](frontend/components/SettingsModal.tsx#L133-L320) — patró `ShortcutsTab` inline a seguir per al component local del modal.
- [SettingsModal.tsx:190-195](frontend/components/SettingsModal.tsx#L190-L195) — `resetAll` dels shortcuts: precedent del codebase per reset destructiu (sense doble confirmació, més laxe).
- [constants.ts:3-32](frontend/constants.ts#L3-L32) — `LOCAL_STORAGE_KEYS`, font autoritativa de les keys client.
- [users.service.ts:59-80](backend_nest_mvp/src/modules/users/users.service.ts#L59-L80) — handler de `PATCH /auth/me`, confirma el merge per clau (`set['preferences.${key}'] = value`).
- [AuthContext.tsx:25-48](frontend/context/Auth/AuthContext.tsx#L25-L48) — `refreshMe()`, hidrata atajos del backend; gestiona `null` correctament gràcies a `if (profile.preferences?.shortcuts)`.
- [ThemeContext.tsx:476-510](frontend/context/Theme/ThemeContext.tsx#L476-L510) — handler de `USER_PROFILE_LOADED`, gestiona `null` correctament gràcies a `if (prefs.themeId && ...)` i `if (prefs.customThemeTokens && ...)`.
- [useKeyboardShortcuts.ts:9-18](frontend/hooks/useKeyboardShortcuts.ts#L9-L18) — cache module-level que justifica la necessitat de recarregar la pàgina.
- [useLocalStorage.ts:33-51](frontend/hooks/useLocalStorage.ts#L33-L51) — listener de `storage` events del hook `useLocalStorage`, que sincronitza components entre pestanyes (rellevant per al suport multi-pestanya).
- [TranscriptionContext.tsx:79-96](frontend/context/Library/TranscriptionContext.tsx#L79-L96) i [TranslationContext.tsx:53-62](frontend/context/Library/TranslationContext.tsx#L53-L62) — contextos que inicialitzen de localStorage **sense** listener de `storage`, motiu pel qual la recàrrega és imprescindible.
- [App.tsx:621-625](frontend/App.tsx#L621-L625) i [App.tsx:627-650](frontend/App.tsx#L627-L650) — banners inline existents que serveixen de patró estètic per al nou banner post-reset.
- [VideoSubtitlesEditorView.tsx:586, 597](frontend/components/VideoSubtitlesEditor/VideoSubtitlesEditorView.tsx#L586) i [ScriptExternalView.tsx:52, 213](frontend/components/ScriptExternalView.tsx#L52) — usos existents de `BroadcastChannel` al codebase, que serveixen de precedent per al nou canal `snlbpro-factory-reset`.

---

## Annex — Resum de motivació

Aquest spec és la segona meitat d'una sessió que va començar amb un fix de precisió per als atajos TC IN/TC OUT del editor de subtítols ([2026-04-07-reporte-tcin-tcout.md](docs/superpowers/specs/2026-04-07-reporte-tcin-tcout.md)). Aquell fix incloïa canviar els defaults d'atajos `I`/`O` → `Q`/`W` per ergonomia. Durant la revisió tècnica es va detectar que els usuaris amb atajos personalitzats persistits a `localStorage` o al backend no veurien els nous defaults sense un reset manual. Aquest feature dona aquesta via de reset, dissenyada de manera més general perquè pugui servir per a futurs casos similars.
