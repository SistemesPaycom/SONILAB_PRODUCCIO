# Disseny — Presets Nuendo-style + Global Styles per Admin

**Data:** 2026-04-09  
**Estat:** Aprovat, pendent de pla d'implementació

---

## Resum executiu

Dues millores encadenades:

1. **Reestructura del sistema de presets** (estil Nuendo): elimina el botó "Nou", permet editar qualsevol preset (inclòs "Per defecte") sense guardar automàticament, i canalitza tot el guardado a través d'un modal de nom explícit amb validació.

2. **Global Styles per admin**: els administradors poden sobreescriure el preset "Per defecte" a nivell de base de dades, de manera que tots els usuaris (nous o que facin Factory Reset) vegin els estils globals de la plataforma.

---

## Decisions de disseny tancades

- **Opció A aprovada**: globals integrats a `GET /auth/me` (sense segon fetch, sense risc de flicker).
- **Backend**: MongoDB + Mongoose (no Prisma), nou mòdul `settings` amb patró singleton (`settingKey: 'global'`).
- **Preset "custom"**: borrador auto-guardat per scope; nom `"custom"` reservat com `"Per defecte"`.
- **Cada scope és independent**: l'admin pot guardar `subtitleEditor` globalment sense afectar `scriptEditor` ni `home`.
- **Factory Reset**: activa el preset builtin ("Per defecte") per als tres scopes i elimina el "custom"; els presets custom de l'usuari es preserven.

---

## Secció 1 — Reestructura del sistema de Presets

### Flux d'edició

1. L'usuari toca qualsevol valor d'estil (color picker, font, mida) en qualsevol preset actiu.
2. Si el preset actiu **no és** `id: 'custom'`: es clona l'actiu cap a un nou preset `{ id: 'custom', name: 'custom', builtin: false }` i s'activa.
3. El patch s'aplica al preset "custom".
4. El "custom" s'auto-guarda al backend via debounce (1500ms) — protegeix canvis si es tanca la pestanya.
5. Apareix l'indicador "· Canvis no guardats" a la barra de presets.

### Flux de Guardar

Clicar "Guardar" (sempre habilitat) obre `SavePresetModal`:

```
Input de text pre-emplenat amb:
  - El nom del preset origen si l'usuari venia d'un preset nomenat
  - Buit si venia del preset builtin "Per defecte"

Validació en confirmar:
  1. Nom buit → error "El nom no pot estar buit"
  2. Nom === 'custom' (case-insensitive) → error "Nom reservat"
  3. Nom === 'Per defecte' && !isAdmin → error "Nom reservat al sistema"
  4. Nom === 'Per defecte' && isAdmin → flux admin global (Secció 3)
  5. Nom coincideix amb preset existent:
       → Pas de doble confirmació: "Vols sobreescriure 'X'?" [Sobreescriure] [Canviar nom]
       → Si confirma: sobreescriu styles del preset existent, activa'l, elimina "custom"
  6. Nom nou:
       → Crea preset { id: genId(), name, builtin: false, styles: currentStyles }
       → Activa'l, elimina "custom"
  7. En tots els casos (5 i 6): dispara schedulePush() amb el payload net
```

### Canvis a `StylesPresetBar`

| Element | Abans | Després |
|---------|-------|---------|
| Botó "Nou" | Visible | **Eliminat** |
| Botó "Guardar" | Deshabilitat si `builtin` | **Sempre habilitat** |
| Botó "Eliminar" | Bloquejat si `builtin` | Bloquejat si `builtin || id === 'custom'` |
| Indicador de canvis | No existeix | Apareix si `presets.some(p => p.id === 'custom')` |

### `SavePresetModal` — nou component

- Input text per al nom del preset
- Pas 1: input + validació
- Pas 2 (si nom existent): confirmació de sobreescriptura
- Per a admin salvant "Per defecte": avís especial "Estàs a punt de modificar els estils globals per a tots els usuaris"
- Botons: "Guardar" / "Cancel·lar" (pas 1), "Sobreescriure" / "Canviar nom" (pas 2)

### `BuiltinPresetNotice` — text diferenciat per rol

- **Usuari normal**: missatge actual — "Aquest és el preset 'Per defecte' del sistema. Si vols personalitzar els estils, edita'ls i fes clic a **Guardar** per crear un preset nou basat en aquest."
- **Admin**: "Ets administrador. Pots editar els estils globals de la plataforma. Fes clic a **Guardar** i escriu **Per defecte** per aplicar-los a tots els usuaris."

### Noms reservats del sistema

| Nom | Reservat per a |
|-----|----------------|
| `Per defecte` | preset builtin del sistema (editable per admins) |
| `custom` | borrador temporal d'edicions no guardades |

La validació és **case-insensitive** i s'aplica a tots els scopes.

---

## Secció 2 — Backend: Global Styles

### Nova col·lecció MongoDB: `GlobalSettings`

Singleton: un sol document a la col·lecció, identificat per `settingKey: 'global'`.

```typescript
@Schema({ timestamps: true })
class GlobalSettings {
  @Prop({ required: true, unique: true, index: true })
  settingKey: string; // sempre 'global'

  @Prop({ type: Object, default: {} })
  userStyles: {
    scriptEditor?:   any; // StyleSetMap['scriptEditor']
    subtitleEditor?: any; // StyleSetMap['subtitleEditor']
    home?:           any; // StyleSetMap['home']
  };
}
```

### Nou mòdul NestJS: `settings`

```
backend_nest_mvp/src/modules/settings/
  settings.schema.ts
  settings.service.ts
  settings.controller.ts
  settings.module.ts
```

### Endpoints nous

| Mètode | Ruta | Guards | Body | Descripció |
|--------|------|--------|------|------------|
| `GET` | `/settings/global-styles` | `JwtAuthGuard` | — | Retorna `{ scriptEditor?, subtitleEditor?, home? }` |
| `PATCH` | `/settings/global-styles` | `JwtAuthGuard + RolesGuard + @Roles('admin')` | `{ scope, styles }` | Actualitza un scope concret (upsert) |

**Body del PATCH:**
```json
{ "scope": "subtitleEditor", "styles": { /* StyleSetMap['subtitleEditor'] */ } }
```

Un scope a la vegada — preserva la independència entre scopes.

### Integració amb `GET /auth/me`

El controller existent `AuthController.me()` delega a `UsersService.findById()`. Cal que retorni un camp addicional `globalStyles`:

```json
{
  "id": "...",
  "email": "...",
  "role": "admin",
  "preferences": { "userStyles": { ... } },
  "globalStyles": {
    "scriptEditor": { ... },
    "subtitleEditor": { ... },
    "home": { ... }
  }
}
```

`globalStyles` és `null` si cap admin ha configurat res → el frontend fa fallback als `FACTORY_*` hardcoded.

**Implementació**: `AuthController.me()` injecta `SettingsService` directament i afegeix `globalStyles` a la resposta manualment. `UsersService.findById()` no canvia — segueix retornant només dades d'usuari.

### Regles de no-flicker del backend

- `PATCH /settings/global-styles` no toca `me.preferences.userStyles` de l'admin.
- La resposta del PATCH no es retorna a `AuthContext` — no activa cap re-render.
- `globalStyles` arriba una sola vegada per sessió, amb el `GET /auth/me` inicial.

---

## Secció 3 — Frontend: Integració global styles

### `overrideBuiltinPresets()` — source of truth dinàmic

La funció actual substitueix el preset builtin per les `FACTORY_*` constants. Amb el canvi, rep `globalStyles` de `me`:

```typescript
function overrideBuiltinPresets(
  payload: UserStylesPayload,
  globalStyles: { scriptEditor?: any; subtitleEditor?: any; home?: any } | null,
): UserStylesPayload {
  const factoryFor = (scope, global) => global?.[scope] ?? FACTORY_DEFAULTS[scope];
  // ... mateixa lògica de replaceBuiltin però usant factoryFor(scope, globalStyles)
}
```

**Garantia anti-flicker**: segueix dins del guard `migratedUserIds` — executa exactament una vegada per sessió per userId.

### `UserStylesContext` — canvis a funcions existents

**`updateAtom(scope, atomKey, patch)`** — canvi:
```
Abans: aplica el patch al preset actiu directament
Ara:   si actiu !== 'custom':
         → si ja existia un preset 'custom' (edició anterior no guardada): REEMPLAÇA'L
           amb una còpia fresca del preset actiu actual
         → si no existia: crea preset 'custom' clonat del preset actiu actual
         → activa 'custom'
         → aplica patch al 'custom'
       si actiu === 'custom' → aplica patch directament (comportament actual)
```

Reemplaçar el "custom" existent garanteix que l'usuari sempre treballa sobre el preset que tenia seleccionat quan ha tornat a editar, sense acumular canvis de sessions anteriors.

**`schedulePush()`** — sense canvis. El "custom" s'auto-guarda com qualsevol altre preset via debounce.

**`savePayloadNow()`** — sense canvis. S'usa internament per `savePreset` i `saveGlobalPreset` per forçar un push immediat després del guardado. El botó "Guardar" de la UI obre el modal i NO crida `savePayloadNow` directament.

### Noves funcions al context

**`savePreset(scope, name): Promise<'ok' | 'conflict' | 'blocked'>`**
- Implementa la lògica de validació i persistència descrita a la Secció 1.
- Retorna `'conflict'` si el nom existeix i el modal ha de mostrar el pas de confirmació.

**`saveGlobalPreset(scope, styles): Promise<void>`**
- Crida `api.patchGlobalStyles({ scope, styles })`.
- En èxit: elimina el preset "custom" del scope, activa el preset builtin (`id: 'default'`).
- **No és un `mutate()` intern** — no toca el payload local de maneira que triggeri el debounce push de `me.preferences.userStyles` per als estils globals.
- Dispara `schedulePush()` únicament per netejar el "custom" del payload de l'usuari.

### `api.ts` — nou mètode

```typescript
patchGlobalStyles(payload: { scope: StyleScope; styles: any }): Promise<void>
// → PATCH /settings/global-styles
```

### "Restablir al Per defecte" — comportament dins el panel d'Estils

Seleccionar "Per defecte" al dropdown de presets ja funciona avui com a reset d'estils — és un simple `setActivePreset(scope, 'default')`. No cal cap botó addicional.

El preset "Per defecte" conté els globals de l'admin (aplicats per `overrideBuiltinPresets` al mount), de manera que seleccionar-lo = veure els estils globals actuals.

El preset "custom" no s'esborra en canviar de preset — es manté al dropdown com a recordatori de canvis no guardats.

### Factory Reset global (Settings → General) — sense canvis

Per acord de sessió anterior (`domain-user-styles.md`, `2026-04-07-reset-configuracio-frontend.md` secció 3):
- La factoryReset global **NO toca** `preferences.userStyles` ni la cache `snlbpro_user_styles_<userId>`.
- Comportament preservat intacte. Qualsevol canvi aquí requereix consens explícit separat.

### Canvis a `AuthContext`

`me` ja inclou `globalStyles` en el tipus:

```typescript
interface Me {
  id: string;
  email: string;
  role: 'admin' | 'user';
  preferences?: { userStyles?: UserStylesPayload };
  globalStyles?: { scriptEditor?: any; subtitleEditor?: any; home?: any } | null;
}
```

`isAdmin` ja existeix al context — no cal cap canvi aquí.

---

## Regles anti-flicker (resum per a la implementació)

Extretes dels logs de la sessió anterior (commits `ef60b36`, `migratedUserIds` fix):

1. **`overrideBuiltinPresets()` dins del guard `migratedUserIds`** — no moure mai fora del guard.
2. **Cap `useEffect` amb `[me]` complet** — sempre primitives (`me?.id`).
3. **Cap storage event listener nou** — el ping-pong cross-tab (790 apply/seg) va ser causat per això.
4. **Cap `setProperty(..., 'important')`, `MutationObserver`, ni `!important` nous** per a CSS vars `--us-*`.
5. **Debounce auto-save NOMÉS per al preset "custom"** — mai sobreescriu presets nomenats automàticament.
6. **`saveGlobalPreset()` no és un `mutate()` intern** — la crida al backend global no ha de reactivar cap cicle de render local.

---

## Fitxers afectats

### Frontend (modificar)
- `frontend/context/UserStyles/UserStylesContext.tsx` — `updateAtom`, `overrideBuiltinPresets`, + `savePreset`, `saveGlobalPreset`
- `frontend/context/UserStyles/factoryStyles.ts` — fallback; sense canvis funcionals
- `frontend/context/Auth/AuthContext.tsx` — afegir `globalStyles` al tipus `Me`
- `frontend/services/api.ts` — afegir `patchGlobalStyles()`
- `frontend/components/Settings/UserStyles/StylesPresetBar.tsx` — eliminar "Nou", habilitar "Guardar", indicador "custom"
- `frontend/components/Settings/UserStyles/BuiltinPresetNotice.tsx` — text diferenciat admin/usuari

### Frontend (crear)
- `frontend/components/Settings/UserStyles/SavePresetModal.tsx` — nou component modal

### Backend (crear)
- `backend_nest_mvp/src/modules/settings/settings.schema.ts`
- `backend_nest_mvp/src/modules/settings/settings.service.ts`
- `backend_nest_mvp/src/modules/settings/settings.controller.ts`
- `backend_nest_mvp/src/modules/settings/settings.module.ts`

### Backend (modificar)
- `backend_nest_mvp/src/modules/auth/auth.controller.ts` — `me()` afegeix `globalStyles`
- `backend_nest_mvp/src/app.module.ts` — importar `SettingsModule`

---

## Ordre d'implementació recomanat

1. **Backend primer**: schema → service → controller → module → AppModule → tests manuals amb curl
2. **AuthContext**: afegir tipus `globalStyles` a `Me`
3. **`api.ts`**: afegir `patchGlobalStyles()`
4. **`UserStylesContext`**: `updateAtom` (flux "custom") + `overrideBuiltinPresets` (usa globals) + `savePreset` + `saveGlobalPreset`
5. **`SavePresetModal`**: component nou
6. **`StylesPresetBar`**: eliminar "Nou", habilitar "Guardar", integrar modal, indicador
7. **`BuiltinPresetNotice`**: text admin vs usuari
8. **Factory Reset**: ajustar comportament
9. **Verificació**: TypeScript + build + test manual admin + test manual usuari
