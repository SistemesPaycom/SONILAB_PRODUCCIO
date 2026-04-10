# Presets Nuendo-style + Global Styles per Admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redissenyar el sistema de presets d'estils (estil Nuendo: botó Nou eliminat, edició lliure, Guardar→modal de nom) i permetre que els admins sobreescriguin el preset "Per defecte" globalment a la base de dades.

**Architecture:** Backend-first: nou mòdul NestJS `settings` amb col·lecció MongoDB singleton `GlobalSettings`. El `GET /auth/me` retorna `globalStyles` per evitar un segon fetch. El frontend reestructura el flux de presets: qualsevol edició crea un borrador `custom` auto-guardat; el botó "Guardar" obre sempre un modal de nom amb validació de rol.

**Tech Stack:** NestJS + Mongoose (MongoDB), React 19, TypeScript 5.8, patró de context existent (`UserStylesContext`).

**Spec de referència:** `docs/superpowers/specs/2026-04-09-preset-global-admin-design.md`

**Regles anti-flicker crítiques (NO VIOLAR):**
- `overrideBuiltinPresets()` SEMPRE dins del guard `migratedUserIds` — mai fora
- Cap `useEffect` amb `[me]` complet — sempre `[me?.id]`
- Cap storage event listener nou
- Cap `setProperty(..., 'important')`, `MutationObserver`, ni `!important` nous
- El debounce auto-save NOMÉS per al preset `'custom'`, mai sobreescriu presets nomenats

**Verificació baseline:**
```bash
cd frontend && npx tsc --noEmit 2>&1 | wc -l   # → 6 errors pre-existents
cd frontend && npm run build                     # → ha de passar OK
```

---

## Fitxers afectats

### Backend (crear)
- `backend_nest_mvp/src/modules/settings/settings.schema.ts` — Mongoose schema `GlobalSettings`
- `backend_nest_mvp/src/modules/settings/settings.service.ts` — `getGlobalStyles()`, `updateGlobalStylesScope()`
- `backend_nest_mvp/src/modules/settings/settings.controller.ts` — `GET/PATCH /settings/global-styles`
- `backend_nest_mvp/src/modules/settings/settings.module.ts` — NestJS module

### Backend (modificar)
- `backend_nest_mvp/src/modules/auth/auth.module.ts` — importar `SettingsModule`
- `backend_nest_mvp/src/modules/auth/auth.controller.ts` — injectar `SettingsService`, retornar `globalStyles` a `me()`
- `backend_nest_mvp/src/app.module.ts` — importar `SettingsModule`

### Frontend (crear)
- `frontend/components/Settings/UserStyles/SavePresetModal.tsx` — modal de nom per al Guardar

### Frontend (modificar)
- `frontend/services/api.ts` — actualitzar tipus `me()`, afegir `patchGlobalStyles()`
- `frontend/context/UserStyles/UserStylesContext.tsx` — `overrideBuiltinPresets` (globalStyles), `updateAtom` (draft 'custom'), + `savePreset`, `saveGlobalPreset`, `hasUnsavedChanges`
- `frontend/components/Settings/UserStyles/StylesPresetBar.tsx` — eliminar "Nou", sempre habilitat "Guardar", indicador 'custom', modal
- `frontend/components/Settings/UserStyles/BuiltinPresetNotice.tsx` — text diferenciat admin/usuari

---

## Task 1: Backend — GlobalSettings schema + SettingsService

**Files:**
- Create: `backend_nest_mvp/src/modules/settings/settings.schema.ts`
- Create: `backend_nest_mvp/src/modules/settings/settings.service.ts`

- [ ] **Step 1: Crear el directori i el schema**

Crear `backend_nest_mvp/src/modules/settings/settings.schema.ts`:

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GlobalSettingsDocument = HydratedDocument<GlobalSettings>;

@Schema({ timestamps: true })
export class GlobalSettings {
  @Prop({ required: true, unique: true, index: true })
  settingKey: string;

  @Prop({ type: Object, default: {} })
  userStyles: {
    scriptEditor?: any;
    subtitleEditor?: any;
    home?: any;
  };
}

export const GlobalSettingsSchema = SchemaFactory.createForClass(GlobalSettings);
```

- [ ] **Step 2: Crear el SettingsService**

Crear `backend_nest_mvp/src/modules/settings/settings.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GlobalSettings, GlobalSettingsDocument } from './settings.schema';

const SETTING_KEY = 'global';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(GlobalSettings.name)
    private readonly settingsModel: Model<GlobalSettingsDocument>,
  ) {}

  async getGlobalStyles(): Promise<{
    scriptEditor?: any;
    subtitleEditor?: any;
    home?: any;
  } | null> {
    const doc = await this.settingsModel
      .findOne({ settingKey: SETTING_KEY })
      .lean();
    const styles = (doc as any)?.userStyles;
    if (!styles || Object.keys(styles).length === 0) return null;
    return styles;
  }

  async updateGlobalStylesScope(
    scope: 'scriptEditor' | 'subtitleEditor' | 'home',
    styles: any,
  ): Promise<void> {
    await this.settingsModel.findOneAndUpdate(
      { settingKey: SETTING_KEY },
      { $set: { [`userStyles.${scope}`]: styles } },
      { upsert: true, new: true },
    );
  }
}
```

- [ ] **Step 3: Verificar que compila sense errors nous**

```bash
cd backend_nest_mvp && npx tsc --noEmit 2>&1 | head -20
```

Ha de mostrar 0 errors nous relacionats amb settings.

- [ ] **Step 4: Commit**

```bash
cd backend_nest_mvp && git add src/modules/settings/settings.schema.ts src/modules/settings/settings.service.ts
git commit -m "feat(settings): GlobalSettings schema + SettingsService"
```

---

## Task 2: Backend — SettingsController + SettingsModule

**Files:**
- Create: `backend_nest_mvp/src/modules/settings/settings.controller.ts`
- Create: `backend_nest_mvp/src/modules/settings/settings.module.ts`

- [ ] **Step 1: Crear el SettingsController**

Crear `backend_nest_mvp/src/modules/settings/settings.controller.ts`:

```typescript
import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('/global-styles')
  async getGlobalStyles() {
    return this.settingsService.getGlobalStyles();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('/global-styles')
  async updateGlobalStyles(
    @Body() body: { scope: 'scriptEditor' | 'subtitleEditor' | 'home'; styles: any },
  ) {
    await this.settingsService.updateGlobalStylesScope(body.scope, body.styles);
    return { ok: true };
  }
}
```

- [ ] **Step 2: Crear el SettingsModule**

Crear `backend_nest_mvp/src/modules/settings/settings.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GlobalSettings, GlobalSettingsSchema } from './settings.schema';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GlobalSettings.name, schema: GlobalSettingsSchema },
    ]),
  ],
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
```

- [ ] **Step 3: Verificar compilació**

```bash
cd backend_nest_mvp && npx tsc --noEmit 2>&1 | head -20
```

0 errors nous.

- [ ] **Step 4: Commit**

```bash
git add src/modules/settings/settings.controller.ts src/modules/settings/settings.module.ts
git commit -m "feat(settings): SettingsController + SettingsModule"
```

---

## Task 3: Backend — Integrar SettingsModule + AuthController retorna globalStyles

**Files:**
- Modify: `backend_nest_mvp/src/app.module.ts`
- Modify: `backend_nest_mvp/src/modules/auth/auth.module.ts`
- Modify: `backend_nest_mvp/src/modules/auth/auth.controller.ts`

- [ ] **Step 1: Afegir SettingsModule a AppModule**

A `backend_nest_mvp/src/app.module.ts`, afegir l'import:

```typescript
import { SettingsModule } from './modules/settings/settings.module';
```

I afegir `SettingsModule` a l'array `imports`:

```typescript
    HealthModule,
    UsersModule,
    AuthModule,
    LibraryModule,
    MediaModule,
    ProjectsModule,
    SettingsModule,   // ← afegir aquí
    ThrottlerModule.forRoot([
```

- [ ] **Step 2: Afegir SettingsModule a AuthModule**

A `backend_nest_mvp/src/modules/auth/auth.module.ts`:

Afegir l'import:
```typescript
import { SettingsModule } from '../settings/settings.module';
```

Afegir `SettingsModule` a `imports` del decorator `@Module`:
```typescript
  imports: [
    UsersModule,
    SettingsModule,   // ← afegir aquí
    PassportModule,
    JwtModule.registerAsync({
```

- [ ] **Step 3: Actualitzar AuthController per retornar globalStyles a me()**

A `backend_nest_mvp/src/modules/auth/auth.controller.ts`:

Afegir l'import de `SettingsService`:
```typescript
import { SettingsService } from '../settings/settings.service';
```

Actualitzar el constructor:
```typescript
  constructor(
    private readonly auth: AuthService,
    private readonly usersService: UsersService,
    private readonly settingsService: SettingsService,
  ) {}
```

Substituir el mètode `me()` complet:
```typescript
  @UseGuards(JwtAuthGuard)
  @Get('/me')
  async me(@CurrentUser() user: RequestUser) {
    if (!user?.userId) return null;
    const [userData, globalStyles] = await Promise.all([
      this.usersService.findById(user.userId),
      this.settingsService.getGlobalStyles(),
    ]);
    return { ...userData, globalStyles: globalStyles ?? null };
  }
```

- [ ] **Step 4: Verificar compilació backend**

```bash
cd backend_nest_mvp && npx tsc --noEmit 2>&1 | head -20
```

0 errors nous.

- [ ] **Step 5: Test manual dels endpoints**

Arrancar el backend (`npm run start:dev`) i verificar amb curl:

```bash
# Login per obtenir token
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sonilab.com","password":"..."}' | jq -r '.accessToken')

# GET /auth/me — ha de retornar globalStyles: null (o {} si ja hi ha dades)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/auth/me | jq '.globalStyles'

# PATCH /settings/global-styles amb usuari admin — ha de retornar { ok: true }
curl -X PATCH http://localhost:8000/settings/global-styles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scope":"home","styles":{"fileName":{"fontFamily":"sans-serif","fontSize":16,"color":"#ff0000","bold":false,"italic":false}}}' | jq '.'

# GET /auth/me — ara globalStyles.home ha de tenir el valor guardat
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/auth/me | jq '.globalStyles'
```

- [ ] **Step 6: Commit**

```bash
git add src/app.module.ts src/modules/auth/auth.module.ts src/modules/auth/auth.controller.ts
git commit -m "feat(settings): integrar SettingsModule + me() retorna globalStyles"
```

---

## Task 4: Frontend — api.ts: update me() + patchGlobalStyles()

**Files:**
- Modify: `frontend/services/api.ts`

- [ ] **Step 1: Actualitzar el tipus de retorn de me()**

A `frontend/services/api.ts`, localitzar la línia:
```typescript
  async me() {
    return request<{ id: string; email: string; name?: string; role: string; preferences?: any }>(`/auth/me`);
  },
```

Substituir per:
```typescript
  async me() {
    return request<{
      id: string;
      email: string;
      name?: string;
      role: string;
      preferences?: any;
      globalStyles?: {
        scriptEditor?: any;
        subtitleEditor?: any;
        home?: any;
      } | null;
    }>(`/auth/me`);
  },
```

- [ ] **Step 2: Afegir patchGlobalStyles()**

A `frontend/services/api.ts`, afegir just després del mètode `updateMe`:

```typescript
  async patchGlobalStyles(payload: {
    scope: 'scriptEditor' | 'subtitleEditor' | 'home';
    styles: any;
  }): Promise<void> {
    await request<void>(`/settings/global-styles`, {
      method: 'PATCH',
      body: payload,
    });
  },
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | wc -l
```

Ha de seguir sent 6 (o menys). No ha d'augmentar.

- [ ] **Step 4: Commit**

```bash
git add frontend/services/api.ts
git commit -m "feat(api): me() retorna globalStyles + patchGlobalStyles()"
```

---

## Task 5: Frontend — UserStylesContext: overrideBuiltinPresets accepta globalStyles

**Files:**
- Modify: `frontend/context/UserStyles/UserStylesContext.tsx` (línies 49-82 i 297)

Aquesta tasca modifica **només** `overrideBuiltinPresets` i la seva crida. No toca `updateAtom` ni res més.

- [ ] **Step 1: Substituir la funció overrideBuiltinPresets**

Localitzar la funció `overrideBuiltinPresets` (línies 49-82 aproximadament) i substituir-la completament:

```typescript
function overrideBuiltinPresets(
  payload: UserStylesPayload,
  globalStyles: { scriptEditor?: any; subtitleEditor?: any; home?: any } | null,
): UserStylesPayload {
  const factoryFor = (scope: StyleScope): any => {
    const g = globalStyles as any;
    switch (scope) {
      case 'scriptEditor':   return g?.scriptEditor   ?? FACTORY_SCRIPT_STYLES;
      case 'subtitleEditor': return g?.subtitleEditor ?? FACTORY_SUBTITLE_STYLES;
      case 'home':           return g?.home           ?? FACTORY_HOME_STYLES;
    }
    throw new Error(`Unknown scope ${String(scope)}`);
  };

  const replaceBuiltin = <S extends { presets: any[]; activePresetId: string }>(
    state: S,
    scope: StyleScope,
  ): S => {
    const factory = factoryFor(scope);
    const nextPresets = state.presets.map((p: any) =>
      p.builtin
        ? { id: 'default', name: 'Per defecte', builtin: true, styles: factory }
        : p,
    );
    if (!nextPresets.some((p: any) => p.builtin)) {
      nextPresets.unshift({
        id: 'default',
        name: 'Per defecte',
        builtin: true,
        styles: factory,
      });
    }
    return { ...state, presets: nextPresets };
  };

  return {
    ...payload,
    scriptEditor:   replaceBuiltin(payload.scriptEditor,   'scriptEditor'),
    subtitleEditor: replaceBuiltin(payload.subtitleEditor, 'subtitleEditor'),
    home:           replaceBuiltin(payload.home,           'home'),
  };
}
```

- [ ] **Step 2: Actualitzar la crida a overrideBuiltinPresets dins del useEffect**

Localitzar dins del `useEffect` (deps `[me?.id]`) la línia:
```typescript
    const normalized = overrideBuiltinPresets(cleaned);
```

Substituir per:
```typescript
    const globalStyles: { scriptEditor?: any; subtitleEditor?: any; home?: any } | null =
      (me as any)?.globalStyles ?? null;
    const normalized = overrideBuiltinPresets(cleaned, globalStyles);
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | wc -l
```

Ha de seguir ≤ 6.

- [ ] **Step 4: Commit**

```bash
git add frontend/context/UserStyles/UserStylesContext.tsx
git commit -m "feat(user-styles): overrideBuiltinPresets usa globalStyles del backend"
```

---

## Task 6: Frontend — UserStylesContext: updateAtom crea borrador 'custom'

**Files:**
- Modify: `frontend/context/UserStyles/UserStylesContext.tsx` (funció `updateAtom`)

- [ ] **Step 1: Substituir la funció updateAtom**

Localitzar la funció `updateAtom` (aproximadament línies 431-450) i substituir-la completament:

```typescript
  const updateAtom = useCallback(<S extends StyleScope>(
    scope: S,
    atomKey: keyof StyleSetMap[S],
    patch: Partial<StyleAtom>,
  ) => {
    mutate(prev => {
      const state = prev[scope] as ScopeState<S>;
      const activeId = state.activePresetId;

      if (activeId !== 'custom') {
        // Clonar el preset actiu cap a un nou 'custom' (reemplaça el 'custom' existent si n'hi havia)
        const sourcePreset =
          state.presets.find(p => p.id === activeId) ?? state.presets[0];
        const clonedStyles = JSON.parse(JSON.stringify(sourcePreset.styles));
        const patchedStyles = {
          ...clonedStyles,
          [atomKey]: { ...(clonedStyles[atomKey] as StyleAtom), ...patch },
        };
        const customPreset: UserStylePreset = {
          id: 'custom',
          name: 'custom',
          builtin: false,
          styles: patchedStyles,
        };
        const presetsWithoutCustom = state.presets.filter((p: any) => p.id !== 'custom');
        return {
          ...prev,
          [scope]: {
            activePresetId: 'custom',
            presets: [...presetsWithoutCustom, customPreset],
          },
        } as UserStylesPayload;
      }

      // Ja en 'custom': aplica el patch directament
      return {
        ...prev,
        [scope]: {
          ...state,
          presets: state.presets.map(p => {
            if (p.id !== 'custom') return p;
            const currentAtom = (p.styles as any)[atomKey] as StyleAtom;
            return { ...p, styles: { ...p.styles, [atomKey]: { ...currentAtom, ...patch } } };
          }),
        },
      } as UserStylesPayload;
    });
  }, [mutate]);
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | wc -l
```

Ha de seguir ≤ 6.

- [ ] **Step 3: Test ràpid en browser**

Arrancar el frontend (`npm run dev`), obrir Settings → Estils, seleccionar el preset "Per defecte", canviar una font → verificar:
- El dropdown canvia a "custom ●"
- Les CSS vars s'apliquen al DOM immediatament
- NO hi ha parpadeo

- [ ] **Step 4: Commit**

```bash
git add frontend/context/UserStyles/UserStylesContext.tsx
git commit -m "feat(user-styles): updateAtom crea borrador custom en editar"
```

---

## Task 7: Frontend — UserStylesContext: savePreset + saveGlobalPreset + hasUnsavedChanges

**Files:**
- Modify: `frontend/context/UserStyles/UserStylesContext.tsx`

- [ ] **Step 1: Afegir savePreset, saveGlobalPreset i hasUnsavedChanges a la interfície**

Localitzar la interfície `UserStylesContextValue` i afegir les tres entrades noves just abans del tancament `}`:

```typescript
  /** Guarda el preset 'custom' amb el nom indicat. Retorna 'conflict' si el nom ja existeix
   *  i overwrite=false, 'blocked-custom' si el nom és reservat 'custom',
   *  'blocked-system' si el nom és 'Per defecte' i l'usuari no és admin, 'ok' si èxit. */
  savePreset(
    scope: StyleScope,
    name: string,
    overwrite?: boolean,
  ): 'ok' | 'conflict' | 'blocked-custom' | 'blocked-system';
  /** Guarda els estils del borrador 'custom' com a globals al backend (admin only). */
  saveGlobalPreset(scope: StyleScope): Promise<void>;
  /** Retorna true si hi ha un preset 'custom' (canvis no guardats) per al scope indicat. */
  hasUnsavedChanges(scope: StyleScope): boolean;
```

- [ ] **Step 2: Implementar savePreset**

Afegir just DESPRÉS de la funció `savePayloadNow` (aproximadament línia 465):

```typescript
  const savePreset = useCallback((
    scope: StyleScope,
    name: string,
    overwrite = false,
  ): 'ok' | 'conflict' | 'blocked-custom' | 'blocked-system' => {
    const trimmed = name.trim();
    if (!trimmed) return 'blocked-custom';
    if (trimmed.toLowerCase() === 'custom') return 'blocked-custom';
    if (
      trimmed.toLowerCase() === 'per defecte' &&
      meRef.current?.role !== 'admin'
    ) return 'blocked-system';

    const prevPayload = payloadRef.current;
    const state = prevPayload[scope];
    const customPreset = state.presets.find(p => p.id === 'custom');
    if (!customPreset) return 'ok'; // res a guardar

    const existing = state.presets.find(
      p => p.id !== 'custom' && p.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing && !overwrite) return 'conflict';

    let newPayload: UserStylesPayload;

    if (existing && overwrite) {
      const updatedPresets = state.presets
        .map(p =>
          p.id === existing.id
            ? { ...p, styles: JSON.parse(JSON.stringify(customPreset.styles)) }
            : p,
        )
        .filter(p => p.id !== 'custom');
      newPayload = {
        ...prevPayload,
        [scope]: { activePresetId: existing.id, presets: updatedPresets },
      } as UserStylesPayload;
    } else {
      const newId = genId();
      const newPreset: UserStylePreset = {
        id: newId,
        name: trimmed,
        builtin: false,
        styles: JSON.parse(JSON.stringify(customPreset.styles)),
      };
      const presetsWithoutCustom = state.presets.filter(p => p.id !== 'custom');
      newPayload = {
        ...prevPayload,
        [scope]: { activePresetId: newId, presets: [...presetsWithoutCustom, newPreset] },
      } as UserStylesPayload;
    }

    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setPayload(newPayload);
    if (USE_BACKEND && meRef.current) {
      api.updateMe({ preferences: { userStyles: newPayload } }).catch(() => {});
    }
    return 'ok';
  }, []);
```

- [ ] **Step 3: Implementar saveGlobalPreset**

Afegir just DESPRÉS de `savePreset`:

```typescript
  const saveGlobalPreset = useCallback(async (scope: StyleScope): Promise<void> => {
    const prevPayload = payloadRef.current;
    const state = prevPayload[scope];
    const customPreset = state.presets.find(p => p.id === 'custom');
    const activePreset = state.presets.find(p => p.id === state.activePresetId) ?? state.presets[0];
    const stylesToSave = (customPreset ?? activePreset).styles;

    await api.patchGlobalStyles({ scope, styles: stylesToSave });

    // Actualitzar el preset builtin localment + eliminar 'custom' + activar builtin
    const presetsWithoutCustom = state.presets.filter(p => p.id !== 'custom');
    const presetsUpdated = presetsWithoutCustom.map(p =>
      p.builtin ? { ...p, styles: JSON.parse(JSON.stringify(stylesToSave)) } : p,
    );

    const newPayload: UserStylesPayload = {
      ...prevPayload,
      [scope]: { activePresetId: 'default', presets: presetsUpdated },
    } as UserStylesPayload;

    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setPayload(newPayload);
    if (USE_BACKEND && meRef.current) {
      api.updateMe({ preferences: { userStyles: newPayload } }).catch(() => {});
    }
  }, []);
```

- [ ] **Step 4: Implementar hasUnsavedChanges**

Afegir just DESPRÉS de `saveGlobalPreset`:

```typescript
  const hasUnsavedChanges = useCallback((scope: StyleScope): boolean => {
    return payload[scope].presets.some(p => p.id === 'custom');
  }, [payload]);
```

- [ ] **Step 5: Afegir les tres funcions al value i al useMemo**

Localitzar la definició de `value` (aproximadament `const value: UserStylesContextValue = useMemo(...)`) i afegir les noves funcions:

```typescript
  const value: UserStylesContextValue = useMemo(() => ({
    payload,
    activePreset,
    setActivePreset,
    createPreset,
    duplicatePreset,
    renamePreset,
    deletePreset,
    resetActivePreset,
    updateAtom,
    savePayloadNow,
    savePreset,           // ← nou
    saveGlobalPreset,     // ← nou
    hasUnsavedChanges,    // ← nou
    subtitleRowEstimate,
  }), [
    payload,
    activePreset,
    setActivePreset,
    createPreset,
    duplicatePreset,
    renamePreset,
    deletePreset,
    resetActivePreset,
    updateAtom,
    savePayloadNow,
    savePreset,           // ← nou
    saveGlobalPreset,     // ← nou
    hasUnsavedChanges,    // ← nou
    subtitleRowEstimate,
  ]);
```

- [ ] **Step 6: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | wc -l
```

Ha de seguir ≤ 6.

- [ ] **Step 7: Commit**

```bash
git add frontend/context/UserStyles/UserStylesContext.tsx
git commit -m "feat(user-styles): savePreset + saveGlobalPreset + hasUnsavedChanges"
```

---

## Task 8: Frontend — SavePresetModal (component nou)

**Files:**
- Create: `frontend/components/Settings/UserStyles/SavePresetModal.tsx`

- [ ] **Step 1: Crear el component**

Crear `frontend/components/Settings/UserStyles/SavePresetModal.tsx`:

```tsx
// frontend/components/Settings/UserStyles/SavePresetModal.tsx
import React, { useState } from 'react';
import { useUserStyles } from '../../../context/UserStyles/UserStylesContext';
import { useAuth } from '../../../context/Auth/AuthContext';
import type { StyleScope } from '../../../types/UserStyles/userStylesTypes';

interface Props {
  scope: StyleScope;
  /** Nom pre-emplenat. Buit si l'usuari venia del preset builtin o del 'custom'. */
  initialName: string;
  onClose: () => void;
}

type Step = 'input' | 'confirm-overwrite' | 'confirm-global';

export const SavePresetModal: React.FC<Props> = ({ scope, initialName, onClose }) => {
  const { savePreset, saveGlobalPreset } = useUserStyles();
  const { isAdmin } = useAuth();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('input');
  const [saving, setSaving] = useState(false);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('El nom no pot estar buit.'); return; }

    if (trimmed.toLowerCase() === 'per defecte' && isAdmin) {
      setStep('confirm-global');
      return;
    }

    const result = savePreset(scope, trimmed, false);
    if (result === 'ok') { onClose(); return; }
    if (result === 'conflict') { setStep('confirm-overwrite'); return; }
    if (result === 'blocked-custom') {
      setError('El nom "custom" és reservat pel sistema.');
      return;
    }
    if (result === 'blocked-system') {
      setError('El nom "Per defecte" és reservat al sistema. Només els administradors el poden usar.');
      return;
    }
  };

  const handleOverwrite = () => {
    savePreset(scope, name.trim(), true);
    onClose();
  };

  const handleGlobalSave = async () => {
    setSaving(true);
    try {
      await saveGlobalPreset(scope);
      onClose();
    } catch {
      setError("Error en guardar els estils globals. Comprova la connexió i torna-ho a intentar.");
      setStep('input');
    } finally {
      setSaving(false);
    }
  };

  const overlay = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50';
  const modal = 'rounded-2xl p-6 w-80 shadow-2xl';
  const modalStyle: React.CSSProperties = {
    backgroundColor: 'var(--th-bg-secondary)',
    border: '1px solid var(--th-border)',
    color: 'var(--th-text-primary)',
  };
  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--th-bg-tertiary)',
    border: '1px solid var(--th-border)',
    color: 'var(--th-text-primary)',
    width: '100%',
    padding: '0.375rem 0.75rem',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    outline: 'none',
  };
  const btn = 'px-3 py-1.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed';
  const btnStyle: React.CSSProperties = {
    backgroundColor: 'var(--th-bg-tertiary)',
    color: 'var(--th-text-primary)',
    border: '1px solid var(--th-border)',
  };
  const primaryStyle: React.CSSProperties = {
    backgroundColor: 'var(--th-btn-primary-bg)',
    color: 'var(--th-btn-primary-text)',
    border: '1px solid var(--th-border)',
  };
  const dangerStyle: React.CSSProperties = {
    backgroundColor: 'var(--th-bg-tertiary)',
    color: '#f87171',
    border: '1px solid var(--th-border)',
  };

  if (step === 'confirm-overwrite') {
    return (
      <div className={overlay} onClick={onClose}>
        <div className={modal} style={modalStyle} onClick={e => e.stopPropagation()}>
          <p className="text-sm mb-4" style={{ color: 'var(--th-text-secondary)' }}>
            Ja existeix un preset amb el nom{' '}
            <strong style={{ color: 'var(--th-text-primary)' }}>"{name.trim()}"</strong>.
            Vols sobreescriure&apos;l?
          </p>
          <div className="flex gap-2 justify-end">
            <button className={btn} style={btnStyle} onClick={() => setStep('input')}>
              Canviar nom
            </button>
            <button className={btn} style={dangerStyle} onClick={handleOverwrite}>
              Sobreescriure
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'confirm-global') {
    return (
      <div className={overlay} onClick={onClose}>
        <div className={modal} style={modalStyle} onClick={e => e.stopPropagation()}>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#f59e0b' }}>
            Admin — Acció global
          </p>
          <p className="text-sm mb-4" style={{ color: 'var(--th-text-secondary)' }}>
            Estàs a punt de modificar els estils globals per a{' '}
            <strong style={{ color: 'var(--th-text-primary)' }}>tots els usuaris</strong>{' '}
            de la plataforma. Aquesta acció és immediata.
          </p>
          {error && <p className="text-xs mb-2" style={{ color: '#f87171' }}>{error}</p>}
          <div className="flex gap-2 justify-end">
            <button className={btn} style={btnStyle} onClick={() => setStep('input')} disabled={saving}>
              Cancel·lar
            </button>
            <button className={btn} style={primaryStyle} onClick={handleGlobalSave} disabled={saving}>
              {saving ? 'Guardant...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={overlay} onClick={onClose}>
      <div className={modal} style={modalStyle} onClick={e => e.stopPropagation()}>
        <p className="text-sm font-bold mb-3">Guardar preset</p>
        <input
          style={inputStyle}
          value={name}
          onChange={e => { setName(e.target.value); setError(null); }}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onClose(); }}
          placeholder="Nom del preset"
          autoFocus
        />
        {error && <p className="text-xs mt-1 mb-1" style={{ color: '#f87171' }}>{error}</p>}
        <div className="flex gap-2 justify-end mt-3">
          <button className={btn} style={btnStyle} onClick={onClose}>
            Cancel·lar
          </button>
          <button className={btn} style={primaryStyle} onClick={handleSubmit}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | wc -l
```

Ha de seguir ≤ 6.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/Settings/UserStyles/SavePresetModal.tsx
git commit -m "feat(user-styles): SavePresetModal component"
```

---

## Task 9: Frontend — StylesPresetBar rework

**Files:**
- Modify: `frontend/components/Settings/UserStyles/StylesPresetBar.tsx`

Substituir el contingut complet del fitxer:

- [ ] **Step 1: Reescriure StylesPresetBar.tsx**

```tsx
// frontend/components/Settings/UserStyles/StylesPresetBar.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useUserStyles } from '../../../context/UserStyles/UserStylesContext';
import { SavePresetModal } from './SavePresetModal';
import type { StyleScope } from '../../../types/UserStyles/userStylesTypes';

interface Props {
  scope: StyleScope;
}

export const StylesPresetBar: React.FC<Props> = ({ scope }) => {
  const { payload, setActivePreset, deletePreset, hasUnsavedChanges } = useUserStyles();
  const [showModal, setShowModal] = useState(false);
  const state = payload[scope];
  const active = state.presets.find(p => p.id === state.activePresetId) ?? state.presets[0];
  const hasCustom = hasUnsavedChanges(scope);
  const isBuiltin = active.builtin;
  const isCustom = active.id === 'custom';

  // Recordar el nom del preset origen (el que l'usuari tenia seleccionat antes d'editar)
  // S'usa com a nom pre-emplenat del modal. Quan el preset actiu és 'custom', el ref
  // manté el nom de l'últim preset nomenat. Quan és builtin, buit ('').
  const originNameRef = useRef('');
  useEffect(() => {
    if (active.id !== 'custom') {
      originNameRef.current = active.builtin ? '' : active.name;
    }
  }, [active.id, active.name, active.builtin]);

  const handleDelete = () => {
    if (isBuiltin || isCustom) return;
    if (!window.confirm('Vols eliminar el preset "' + active.name + '"? Aquesta acció no es pot desfer.')) return;
    deletePreset(scope, active.id);
  };

  const btn = 'px-3 py-1.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed';
  const btnStyle: React.CSSProperties = {
    backgroundColor: 'var(--th-bg-tertiary)',
    color: 'var(--th-text-primary)',
    border: '1px solid var(--th-border)',
  };
  const primaryStyle: React.CSSProperties = {
    backgroundColor: 'var(--th-btn-primary-bg)',
    color: 'var(--th-btn-primary-text)',
    border: '1px solid var(--th-border)',
  };
  const dangerStyle: React.CSSProperties = {
    backgroundColor: 'var(--th-bg-tertiary)',
    color: '#f87171',
    border: '1px solid var(--th-border)',
  };

  return (
    <>
      <div
        className="flex items-center gap-2 p-3 rounded-xl mb-4"
        style={{ backgroundColor: 'var(--th-bg-secondary)', border: '1px solid var(--th-border)' }}
      >
        <span className="text-xs font-bold uppercase tracking-widest mr-1" style={{ color: 'var(--th-text-muted)' }}>
          Preset
        </span>
        <select
          value={active.id}
          onChange={e => setActivePreset(scope, e.target.value)}
          className="px-2 py-1 text-sm rounded-md flex-1 max-w-xs"
          style={{ backgroundColor: 'var(--th-bg-tertiary)', border: '1px solid var(--th-border)', color: 'var(--th-text-primary)' }}
        >
          {state.presets.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}{p.builtin ? ' (sistema)' : ''}{p.id === 'custom' ? ' ●' : ''}
            </option>
          ))}
        </select>

        {hasCustom && (
          <span className="text-xs whitespace-nowrap" style={{ color: '#f59e0b' }}>
            · Canvis no guardats
          </span>
        )}

        <button
          className={btn}
          style={primaryStyle}
          onClick={() => setShowModal(true)}
          title="Guardar els canvis com a preset"
        >
          Guardar
        </button>
        <button
          className={btn}
          style={dangerStyle}
          onClick={handleDelete}
          disabled={isBuiltin || isCustom}
          title={
            isBuiltin
              ? 'No es pot eliminar el preset del sistema'
              : isCustom
              ? 'Guarda els canvis primer per poder eliminar'
              : 'Eliminar aquest preset'
          }
        >
          Eliminar
        </button>
      </div>

      {showModal && (
        <SavePresetModal
          scope={scope}
          initialName={originNameRef.current}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
};
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | wc -l
```

Ha de seguir ≤ 6.

- [ ] **Step 3: Test en browser**

Obrir Settings → Estils → verificar:
- Botó "Nou" ha desaparegut ✓
- "Guardar" sempre visible i habilitat ✓
- Editar qualsevol valor → apareix "● custom" al dropdown i "· Canvis no guardats" ✓
- Clicar "Guardar" → obre modal ✓
- Escriure un nom nou → es crea el preset i es tanca el modal ✓
- Obrir modal de nou amb nom existent → apareix el pas de confirmació de sobreescriptura ✓

- [ ] **Step 4: Commit**

```bash
git add frontend/components/Settings/UserStyles/StylesPresetBar.tsx
git commit -m "feat(user-styles): StylesPresetBar Nuendo-style (sense Nou, Guardar→modal)"
```

---

## Task 10: Frontend — BuiltinPresetNotice text admin vs usuari

**Files:**
- Modify: `frontend/components/Settings/UserStyles/BuiltinPresetNotice.tsx`

- [ ] **Step 1: Substituir el component complet**

```tsx
// frontend/components/Settings/UserStyles/BuiltinPresetNotice.tsx
import React from 'react';
import { useAuth } from '../../../context/Auth/AuthContext';

/**
 * Avís visual que es mostra als panells d'estils quan el preset actiu és builtin.
 * Per a admins: explica que poden editar els estils globals.
 * Per a usuaris: explica que poden editar i guardar amb un nom nou.
 */
export const BuiltinPresetNotice: React.FC = () => {
  const { isAdmin } = useAuth();

  return (
    <div
      className="flex items-start gap-3 p-4 rounded-xl mb-4"
      style={{
        backgroundColor: 'rgba(59,130,246,0.08)',
        border: '1px solid rgba(59,130,246,0.25)',
      }}
    >
      <span className="text-blue-400 text-lg leading-none mt-0.5">ℹ</span>
      <div className="flex-1 text-sm">
        <p className="font-bold text-blue-300 mb-1">Preset del sistema</p>
        {isAdmin ? (
          <p style={{ color: 'var(--th-text-secondary)' }}>
            Ets administrador. Pots editar els estils globals de la plataforma.
            Edita els valors i fes clic a <strong>Guardar</strong>. Escriu{' '}
            <strong>Per defecte</strong> per aplicar els canvis a tots els usuaris.
          </p>
        ) : (
          <p style={{ color: 'var(--th-text-secondary)' }}>
            Aquest és el preset &quot;Per defecte&quot; del sistema. Edita els
            valors i fes clic a <strong>Guardar</strong> per crear un preset
            propi basat en aquest.
          </p>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | wc -l
```

Ha de seguir ≤ 6.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/Settings/UserStyles/BuiltinPresetNotice.tsx
git commit -m "feat(user-styles): BuiltinPresetNotice text diferenciat admin/usuari"
```

---

## Task 11: Verificació final i test manual complet

**Files:** cap modificació

- [ ] **Step 1: TypeScript sense augment d'errors**

```bash
cd frontend && npx tsc --noEmit 2>&1 | wc -l
```

Resultat esperat: ≤ 6 (el baseline pre-existent).

- [ ] **Step 2: Build de producció passa**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Resultat esperat: `✓ built in X.Xs` sense errors.

- [ ] **Step 3: Test manual — usuari normal**

1. Login com a usuari (no admin)
2. Obrir Settings → Estils → Script
3. Verificar: botó "Nou" absent ✓, "Guardar" habilitat ✓
4. Canviar la font del "take" → dropdown mostra "custom ●", indicador "· Canvis no guardats" ✓
5. Clicar "Guardar" → modal apareix ✓
6. Escriure "Per defecte" → error "reservat al sistema" ✓
7. Escriure "custom" → error "reservat" ✓
8. Escriure "Test usuari" → modal tanca, preset creat, cap parpadeo ✓
9. Recàrrega → preset "Test usuari" persisteix ✓

- [ ] **Step 4: Test manual — admin: guardar globals**

1. Login com a admin
2. Obrir Settings → Estils → Home
3. Verificar avís "Ets administrador. Pots editar els estils globals..." ✓
4. Canviar la mida de fileName a 18px → dropdown mostra "custom ●" ✓
5. Clicar "Guardar" → modal apareix
6. Escriure "Per defecte" → pas de confirmació "Acció global" apareix ✓
7. Confirmar → modal tanca, preset builtin actualitzat localment ✓
8. Login amb un altre usuari → `/auth/me` retorna `globalStyles.home.fileName.fontSize = 18` ✓
9. Obrir Settings → Estils → Home → preset "Per defecte" mostra fontSize 18 ✓

- [ ] **Step 5: Test anti-flicker**

1. Obrir DevTools → Performance → gravar 5 segons mentre s'edita un color
2. Verificar que NO apareix el patró de mutations massives (el bug original eren ~49.000 en 3s)
3. Obrir 2 pestanyes simultànies, editar en una → verificar que l'altra NO entra en loop ✓

- [ ] **Step 6: Commit final de verificació**

```bash
git add -A
git status  # verificar que no hi ha fitxers inesperats
git commit -m "chore: verificació final presets Nuendo + global styles admin"
```
