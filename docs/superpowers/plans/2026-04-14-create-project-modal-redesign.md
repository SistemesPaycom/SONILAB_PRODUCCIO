# CreateProjectModal Redesign & Whisper Presets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign CreateProjectModal with collapsible advanced Whisper section + per-user preset persistence, add SRT-from-platform import with "Eliminar original" checkbox, and add auto-LNK creation inside the project folder at project creation.

**Architecture:** Backend adds a new `UserSettings` MongoDB collection for per-user Whisper presets with three REST endpoints. `ProjectsService` gets two new behaviors: auto-LNK creation (non-fatal `try/catch`) and `sourceSrtDocumentId` import flow (reads SRT content from an existing platform document). Frontend gets a completely redesigned modal: 2-column layout, collapsible "Whisper avançat" section with preset selection and save, and a cleaned-up "Importar SRT" tab with platform SRT picker + always-visible "Eliminar original" checkbox.

**Tech Stack:** NestJS + Mongoose (backend), React + TypeScript + TailwindCSS (frontend). No existing unit tests — verification via TypeScript compilation (`tsc --noEmit`).

**Spec:** `docs/superpowers/specs/2026-04-14-create-project-modal-redesign.md`

---

## File map

| Action | File |
|--------|------|
| Modify | `frontend/appTypes.ts` |
| Modify | `frontend/services/api.ts` |
| Full rewrite | `frontend/components/Projects/CreateProjectModal.tsx` |
| **Create** | `backend_nest_mvp/src/modules/settings/user-settings.schema.ts` |
| **Create** | `backend_nest_mvp/src/modules/settings/user-settings.service.ts` |
| Modify | `backend_nest_mvp/src/modules/settings/settings.module.ts` |
| Modify | `backend_nest_mvp/src/modules/settings/settings.controller.ts` |
| Modify | `backend_nest_mvp/src/modules/projects/dto/create-project-from-existing.dto.ts` |
| Modify | `backend_nest_mvp/src/modules/projects/projects.service.ts` |
| Modify | `backend_nest_mvp/src/modules/projects/projects.controller.ts` |

---

## Task 1: Add `WhisperConfig` type to `appTypes.ts`

**Files:**
- Modify: `frontend/appTypes.ts`

- [ ] **Step 1: Add the interface** — append at the end of the file, before the last export if any

```typescript
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

- [ ] **Step 2: Verify TypeScript compiles**

Run from `frontend/`:
```
npx tsc --noEmit
```
Expected: no errors related to `WhisperConfig`.

- [ ] **Step 3: Commit**

```bash
git add frontend/appTypes.ts
git commit -m "feat: add WhisperConfig type to appTypes"
```

---

## Task 2: Create `user-settings.schema.ts`

**Files:**
- Create: `backend_nest_mvp/src/modules/settings/user-settings.schema.ts`

- [ ] **Step 1: Create the file**

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

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

@Schema({ timestamps: true })
export class UserSettings {
  @Prop({ required: true, unique: true, index: true })
  userId: string;

  @Prop({ type: Object, default: {} })
  whisperPresets: Record<string, WhisperConfig>;
}

export type UserSettingsDocument = HydratedDocument<UserSettings>;
export const UserSettingsSchema = SchemaFactory.createForClass(UserSettings);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from `backend_nest_mvp/`:
```
npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add backend_nest_mvp/src/modules/settings/user-settings.schema.ts
git commit -m "feat: add UserSettings schema for per-user Whisper presets"
```

---

## Task 3: Create `user-settings.service.ts`

**Files:**
- Create: `backend_nest_mvp/src/modules/settings/user-settings.service.ts`

- [ ] **Step 1: Create the file**

```typescript
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserSettings, UserSettingsDocument, WhisperConfig } from './user-settings.schema';

const RESERVED_NAMES = ['ve', 'vcat'];

@Injectable()
export class UserSettingsService {
  constructor(
    @InjectModel(UserSettings.name)
    private readonly model: Model<UserSettingsDocument>,
  ) {}

  async getWhisperPresets(userId: string): Promise<Record<string, WhisperConfig>> {
    const doc = await this.model.findOne({ userId }).lean();
    return (doc?.whisperPresets as Record<string, WhisperConfig>) ?? {};
  }

  async saveWhisperPreset(
    userId: string,
    name: string,
    config: WhisperConfig,
  ): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('El nom del preset no pot ser buit');
    if (RESERVED_NAMES.includes(trimmed.toLowerCase())) {
      throw new BadRequestException(`"${trimmed}" és un nom reservat (preset de fàbrica)`);
    }
    await this.model.findOneAndUpdate(
      { userId },
      { $set: { [`whisperPresets.${trimmed}`]: config } },
      { upsert: true, new: true },
    );
  }

  async deleteWhisperPreset(userId: string, name: string): Promise<void> {
    const trimmed = name.trim();
    if (RESERVED_NAMES.includes(trimmed.toLowerCase())) {
      throw new BadRequestException(
        `"${trimmed}" és un preset de fàbrica i no es pot eliminar`,
      );
    }
    // Idempotent: no error if preset does not exist
    await this.model.updateOne(
      { userId },
      { $unset: { [`whisperPresets.${trimmed}`]: '' } },
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from `backend_nest_mvp/`:
```
npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add backend_nest_mvp/src/modules/settings/user-settings.service.ts
git commit -m "feat: add UserSettingsService for Whisper preset CRUD"
```

---

## Task 4: Register `UserSettings` in `settings.module.ts`

**Files:**
- Modify: `backend_nest_mvp/src/modules/settings/settings.module.ts`

- [ ] **Step 1: Replace the entire file**

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GlobalSettings, GlobalSettingsSchema } from './settings.schema';
import { UserSettings, UserSettingsSchema } from './user-settings.schema';
import { SettingsService } from './settings.service';
import { UserSettingsService } from './user-settings.service';
import { SettingsController } from './settings.controller';
import { RolesGuard } from '../../common/guards/roles.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GlobalSettings.name, schema: GlobalSettingsSchema },
      { name: UserSettings.name, schema: UserSettingsSchema },
    ]),
  ],
  providers: [SettingsService, UserSettingsService, RolesGuard],
  controllers: [SettingsController],
  exports: [SettingsService, UserSettingsService],
})
export class SettingsModule {}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from `backend_nest_mvp/`:
```
npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add backend_nest_mvp/src/modules/settings/settings.module.ts
git commit -m "feat: register UserSettings schema and service in SettingsModule"
```

---

## Task 5: Add whisper-preset endpoints to `settings.controller.ts`

**Files:**
- Modify: `backend_nest_mvp/src/modules/settings/settings.controller.ts`

- [ ] **Step 1: Replace the entire file**

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UserSettingsService } from './user-settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user';

@Controller('/settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly userSettingsService: UserSettingsService,
  ) {}

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

  // ── Whisper presets (per-user) ──────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('/whisper-presets')
  async getWhisperPresets(@CurrentUser() user: RequestUser) {
    return this.userSettingsService.getWhisperPresets(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Post('/whisper-presets')
  async saveWhisperPreset(
    @CurrentUser() user: RequestUser,
    @Body() body: { name: string; config: any },
  ) {
    await this.userSettingsService.saveWhisperPreset(user.userId, body.name, body.config);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('/whisper-presets/:name')
  async deleteWhisperPreset(
    @CurrentUser() user: RequestUser,
    @Param('name') name: string,
  ) {
    await this.userSettingsService.deleteWhisperPreset(user.userId, name);
    return { ok: true };
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from `backend_nest_mvp/`:
```
npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 3: Manual smoke test** — start backend and verify endpoints respond:

```bash
# GET — returns {} for a fresh user
curl -H "Authorization: Bearer <token>" http://localhost:8000/settings/whisper-presets
# Expected: {}

# POST — saves a preset
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"name":"MiPreset","config":{"engine":"faster-whisper","model":"large-v3","language":"ca","batchSize":8,"device":"cpu","timingFix":true,"diarization":false,"minSubGapMs":160,"enforceMinSubGap":true}}' \
  http://localhost:8000/settings/whisper-presets
# Expected: {"ok":true}  (HTTP 200)

# GET again — returns the saved preset
curl -H "Authorization: Bearer <token>" http://localhost:8000/settings/whisper-presets
# Expected: {"MiPreset":{...}}

# DELETE
curl -X DELETE -H "Authorization: Bearer <token>" \
  http://localhost:8000/settings/whisper-presets/MiPreset
# Expected: {"ok":true}
```

- [ ] **Step 4: Commit**

```bash
git add backend_nest_mvp/src/modules/settings/settings.controller.ts
git commit -m "feat: add GET/POST/DELETE whisper-presets endpoints to SettingsController"
```

---

## Task 6: Extend `CreateProjectFromExistingDto`

**Files:**
- Modify: `backend_nest_mvp/src/modules/projects/dto/create-project-from-existing.dto.ts`

- [ ] **Step 1: Replace the entire file**

```typescript
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateProjectFromExistingDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsString()
  mediaDocumentId: string;

  // Flux A: SRT de plataforma (nou)
  @IsOptional()
  @IsString()
  sourceSrtDocumentId?: string;

  @IsOptional()
  @IsBoolean()
  deleteOriginalSrt?: boolean;  // default false — mai esborrar per omissió

  // Flux B: SRT extern (retrocompatible)
  @IsOptional()
  @IsString()
  srtText?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from `backend_nest_mvp/`:
```
npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add backend_nest_mvp/src/modules/projects/dto/create-project-from-existing.dto.ts
git commit -m "feat: extend CreateProjectFromExistingDto with sourceSrtDocumentId and deleteOriginalSrt"
```

---

## Task 7: Update `ProjectsService.createProjectFromExisting`

Add `sourceSrtDocumentId` flow + non-fatal LNK creation + soft-delete of original SRT.

**Files:**
- Modify: `backend_nest_mvp/src/modules/projects/projects.service.ts`

- [ ] **Step 1: Add import for `BadRequestException` and `CreateProjectFromExistingDto` at top**

The service already imports `Injectable` and `NotFoundException`. Add `BadRequestException` to the `@nestjs/common` import:

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
```

Also add the DTO import (if not already present):
```typescript
import { CreateProjectFromExistingDto } from './dto/create-project-from-existing.dto';
```

- [ ] **Step 2: Replace the `createProjectFromExisting` method** (currently lines 29–71)

Find and replace the existing method with:

```typescript
async createProjectFromExisting(
  ownerId: string,
  dto: CreateProjectFromExistingDto,
) {
  const {
    name,
    mediaDocumentId,
    sourceSrtDocumentId,
    deleteOriginalSrt = false,
    srtText: rawSrtText,
    settings = {},
  } = dto;

  // Exactly one SRT source must be provided
  if (!sourceSrtDocumentId && !rawSrtText) {
    throw new BadRequestException('Cal proporcionar sourceSrtDocumentId o srtText');
  }
  // If both arrive simultaneously, sourceSrtDocumentId takes priority
  const useDocSource = !!sourceSrtDocumentId;

  // Validate media exists
  const mediaDoc = await this.library.getDocument(ownerId, mediaDocumentId);
  if (!mediaDoc.media?.path) throw new NotFoundException('Media document not found or has no media');

  // Resolve SRT text
  let srtText = rawSrtText ?? '';
  if (useDocSource) {
    const srtSourceDoc = await this.library.getDocument(ownerId, sourceSrtDocumentId!);
    if (!srtSourceDoc || (srtSourceDoc as any).isDeleted) {
      throw new NotFoundException(`SRT document "${sourceSrtDocumentId}" not found`);
    }
    // SRT content lives in contentByLang._unassigned (or first available key)
    const langs = (srtSourceDoc as any).contentByLang ?? {};
    srtText = langs['_unassigned'] ?? Object.values(langs)[0] ?? '';
  }

  // Create project folder
  const folder = await this.library.createFolder(ownerId, name);

  // Create SRT document inside the project folder
  const srtDoc = await this.library.createDocument(ownerId, {
    name: `${name}.srt`,
    parentId: folder.id,
    sourceType: 'srt',
    contentByLang: { _unassigned: srtText },
    isLocked: false,
  } as any);

  // Create project record
  const project = await this.projectModel.create({
    ownerId,
    folderId: folder.id,
    mediaDocumentId,
    srtDocumentId: srtDoc.id,
    status: 'ready',
    settings,
    lastError: null,
  });

  // Create LNK pointing to the media asset inside the project folder (non-fatal)
  try {
    await this.library.createMediaRef(ownerId, mediaDocumentId, folder.id);
  } catch (e) {
    console.warn('[createProjectFromExisting] LNK creation failed (non-fatal):', e);
  }

  // Soft-delete the original SRT document if requested
  if (useDocSource && deleteOriginalSrt === true) {
    try {
      await this.library.softDeleteDocument(ownerId, sourceSrtDocumentId!);
    } catch (e) {
      console.warn('[createProjectFromExisting] Soft-delete of original SRT failed (non-fatal):', e);
    }
  }

  return {
    project: { ...project.toObject(), id: project._id.toString() },
    folder,
    srtDocument: srtDoc,
  };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run from `backend_nest_mvp/`:
```
npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add backend_nest_mvp/src/modules/projects/projects.service.ts
git commit -m "feat: add sourceSrtDocumentId flow and auto-LNK creation to createProjectFromExisting"
```

---

## Task 8: Add auto-LNK creation to `ProjectsService.createProject`

**Files:**
- Modify: `backend_nest_mvp/src/modules/projects/projects.service.ts`

- [ ] **Step 1: Locate the end of `createProject`** — the `return` statement after `queue.add` (currently around line 186–198)

Find the return block:
```typescript
    return {
      project: { ...project.toObject(), id: projectId },
      folder,
      srtDocument: srtDoc,
      job: { ...dbJob.toObject(), id: jobId },
    };
```

**Insert the LNK creation block immediately before the `return`:**

```typescript
    // Create LNK pointing to the media asset inside the project folder (non-fatal)
    try {
      await this.library.createMediaRef(ownerId, mediaDocumentId, folder.id);
    } catch (e) {
      console.warn('[createProject] LNK creation failed (non-fatal):', e);
    }

    return {
      project: { ...project.toObject(), id: projectId },
      folder,
      srtDocument: srtDoc,
      job: { ...dbJob.toObject(), id: jobId },
    };
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from `backend_nest_mvp/`:
```
npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add backend_nest_mvp/src/modules/projects/projects.service.ts
git commit -m "feat: add non-fatal auto-LNK creation to createProject"
```

---

## Task 9: Update `projects.controller.ts` — pass DTO to service

The controller currently calls `createProjectFromExisting` with 5 positional args. After Task 7, the service takes `(ownerId, dto)`.

**Files:**
- Modify: `backend_nest_mvp/src/modules/projects/projects.controller.ts`

- [ ] **Step 1: Find the `createFromExisting` method** (currently lines 37–46) and replace the service call:

Find:
```typescript
  @Post('/from-existing')
  createFromExisting(@CurrentUser() user: RequestUser, @Body() dto: CreateProjectFromExistingDto) {
    return this.projects.createProjectFromExisting(
      user.userId,
      dto.name,
      dto.mediaDocumentId,
      dto.srtText,
      dto.settings ?? {},
    );
  }
```

Replace with:
```typescript
  @Post('/from-existing')
  createFromExisting(@CurrentUser() user: RequestUser, @Body() dto: CreateProjectFromExistingDto) {
    return this.projects.createProjectFromExisting(user.userId, dto);
  }
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from `backend_nest_mvp/`:
```
npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 3: Smoke test** — create a project from an external SRT file (retrocompatibility check):

```bash
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"name":"TestRetro","mediaDocumentId":"<existing-media-id>","srtText":"1\n00:00:01,000 --> 00:00:02,000\nTest\n"}' \
  http://localhost:8000/projects/from-existing
# Expected: JSON with project, folder, srtDocument
```

- [ ] **Step 4: Commit**

```bash
git add backend_nest_mvp/src/modules/projects/projects.controller.ts
git commit -m "refactor: update createFromExisting controller to pass full DTO to service"
```

---

## Task 10: Update `api.ts` — new preset methods + extended `createProjectFromExisting`

**Files:**
- Modify: `frontend/services/api.ts`

- [ ] **Step 1: Import `WhisperConfig` type at the top of the file**

Add at the top of `frontend/services/api.ts` (after any existing imports):
```typescript
import type { WhisperConfig } from '../appTypes';
```

- [ ] **Step 2: Extend `createProjectFromExisting` signature**

Find:
```typescript
  async createProjectFromExisting(payload: { name: string; mediaDocumentId: string; srtText: string; settings?: any }) {
    return request<any>(`/projects/from-existing`, { method: 'POST', body: payload });
  },
```

Replace with:
```typescript
  async createProjectFromExisting(payload: {
    name: string;
    mediaDocumentId: string;
    settings?: any;
    srtText?: string;
    sourceSrtDocumentId?: string;
    deleteOriginalSrt?: boolean;
  }) {
    return request<any>(`/projects/from-existing`, { method: 'POST', body: payload });
  },
```

- [ ] **Step 3: Add 3 whisper-preset methods** — insert after `createProjectFromExisting`:

```typescript
  async getWhisperPresets(): Promise<Record<string, WhisperConfig>> {
    return request<Record<string, WhisperConfig>>(`/settings/whisper-presets`);
  },

  async saveWhisperPreset(name: string, config: WhisperConfig): Promise<void> {
    await request<any>(`/settings/whisper-presets`, {
      method: 'POST',
      body: { name, config },
    });
  },

  async deleteWhisperPreset(name: string): Promise<void> {
    await request<any>(`/settings/whisper-presets/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
  },
```

- [ ] **Step 4: Verify TypeScript compiles**

Run from `frontend/`:
```
npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/services/api.ts
git commit -m "feat: extend createProjectFromExisting and add whisper-preset methods to api.ts"
```

---

## Task 11: Redesign `CreateProjectModal.tsx`

This is a full rewrite. Read the spec (`docs/superpowers/specs/2026-04-14-create-project-modal-redesign.md`) and the visual mockups in `.superpowers/brainstorm/671-1776174484/content/` before implementing.

**Files:**
- Full rewrite: `frontend/components/Projects/CreateProjectModal.tsx`

- [ ] **Step 1: Write the complete new component**

Replace the entire file with:

```typescript
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../services/api';
import { useLibrary } from '../../context/Library/SonilabLibraryContext';
import { useUploadContext } from '../../context/Upload/UploadContext';
import type { Document, OpenMode, WhisperConfig } from '../../appTypes';
import { importStructuredScriptFromFile } from '../../utils/Import/scriptImportPipeline';

// ─── Constants ──────────────────────────────────────────────────────────────

const MEDIA_EXTS = ['mp4', 'mov', 'webm', 'wav', 'mp3', 'ogg', 'm4a'];

const FACTORY_PRESETS: Record<string, WhisperConfig> = {
  VE: {
    engine: 'purfview-xxl', model: 'large-v3', language: 'es',
    batchSize: 16, device: 'cpu', timingFix: true,
    diarization: false, minSubGapMs: 160, enforceMinSubGap: true,
  },
  VCAT: {
    engine: 'purfview-xxl', model: 'large-v3', language: 'ca',
    batchSize: 16, device: 'cpu', timingFix: true,
    diarization: false, minSubGapMs: 160, enforceMinSubGap: true,
  },
};

const MODEL_LABELS: Record<string, string> = {
  tiny: 'tiny — muy rápido, menor precisión',
  base: 'base — rápido',
  small: 'small — equilibrado',
  medium: 'medium — buena calidad',
  'large-v2': 'large-v2 — alta calidad',
  'large-v3': 'large-v3 — mejor calidad',
  'large-v3-turbo': 'large-v3-turbo — rápido y alta calidad',
};

const ENGINE_LABELS: Record<string, string> = {
  'faster-whisper': 'faster-whisper — timestamps nativos',
  'purfview-xxl': 'Purfview XXL — + post-procesado',
  'whisperx': 'whisperx — alineación externa',
  'script-align': 'Script-Align — alineación con guion (máxima calidad)',
};

// isCanonicalMedia — definició canònica (CLAUDE.md §4)
function isCanonicalMedia(d: Document): boolean {
  return d.type === 'document' && !!d.media && !d.refTargetId;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Component ───────────────────────────────────────────────────────────────

export const CreateProjectModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onOpenDocument: (docId: string | null, mode: OpenMode | null, edit: boolean) => void;
}> = ({ open, onClose, onOpenDocument }) => {
  const { state, reloadTree, dispatch } = useLibrary();
  const { addJob, updateJob, completeJob, registerAbort } = useUploadContext();

  // ─── Tab ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'transcribe' | 'importSrt'>('transcribe');

  // ─── Derived ──────────────────────────────────────────────────────────────
  const mediaDocs = useMemo(
    () => state.documents.filter((d) => isCanonicalMedia(d) && !d.isDeleted),
    [state.documents],
  );
  const srtDocs = useMemo(
    () => state.documents.filter(
      (d) => (d.sourceType || '').toLowerCase() === 'srt' && !d.isDeleted && !d.refTargetId,
    ),
    [state.documents],
  );

  // ─── Common fields ────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [mediaId, setMediaId] = useState('');

  // ─── Whisper config ───────────────────────────────────────────────────────
  const [options, setOptions] = useState<any>(null);
  const [profile, setProfile] = useState('VE');
  const [userPresets, setUserPresets] = useState<Record<string, WhisperConfig>>({});
  const [engine, setEngine] = useState('purfview-xxl');
  const [model, setModel] = useState('large-v3');
  const [language, setLanguage] = useState('es');
  const [device, setDevice] = useState<'cpu' | 'cuda'>('cpu');
  const [batchSize, setBatchSize] = useState(16);
  const [timingFix, setTimingFix] = useState(true);
  const [diarization, setDiarization] = useState(false);
  const [numSpeakers, setNumSpeakers] = useState<number | 'auto'>('auto');
  const [minSubGapMs, setMinSubGapMs] = useState(160);
  const [enforceMinSubGap, setEnforceMinSubGap] = useState(true);

  // ─── Advanced section ─────────────────────────────────────────────────────
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [savePresetName, setSavePresetName] = useState('');
  const [savePresetError, setSavePresetError] = useState<string | null>(null);

  // ─── Script-Align ─────────────────────────────────────────────────────────
  const [scriptText, setScriptText] = useState('');
  const [scriptFile, setScriptFile] = useState<File | null>(null);

  // ─── Guió del projecte (opcional) ─────────────────────────────────────────
  const [guionFile, setGuionFile] = useState<File | null>(null);
  const [guionPreviewText, setGuionPreviewText] = useState('');
  const [guionConverting, setGuionConverting] = useState(false);
  const [guionConvertErr, setGuionConvertErr] = useState<string | null>(null);
  const guionConvertedRef = useRef<{ content: string; fileName: string } | null>(null);

  // ─── Import SRT tab ───────────────────────────────────────────────────────
  const [srtDocId, setSrtDocId] = useState('');
  const [deleteOriginalSrt, setDeleteOriginalSrt] = useState(true);
  const [srtFile, setSrtFile] = useState<File | null>(null);

  // ─── Progress / job ───────────────────────────────────────────────────────
  const [busy, setBusy] = useState(false);
  const [jobProgress, setJobProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  // ─── Reset on open ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setBusy(false);
    setErr(null);
    setJobProgress(0);
    setSrtDocId('');
    setDeleteOriginalSrt(true);
    setAdvancedOpen(false);
    setSavePresetOpen(false);
    setSavePresetError(null);
    setSavePresetName('');
    setSrtFile(null);  // sync reset — must be outside async block

    void (async () => {
      try {
        const [opt, presets] = await Promise.all([
          api.transcriptionOptions(),
          api.getWhisperPresets(),
        ]);
        setUserPresets(presets ?? {});
        setOptions(opt);

        // Apply default profile using freshly loaded presets
        const allPresets = { ...FACTORY_PRESETS, ...(presets ?? {}) };
        const defaultProfileName: string = opt?.defaults?.profile || 'VE';
        const defaultPreset = allPresets[defaultProfileName];
        if (defaultPreset) {
          setProfile(defaultProfileName);
          setEngine(defaultPreset.engine);
          setModel(defaultPreset.model);
          setLanguage(defaultPreset.language);
          setBatchSize(defaultPreset.batchSize);
          setDevice(defaultPreset.device);
          setTimingFix(defaultPreset.timingFix);
          setDiarization(defaultPreset.diarization);
          setMinSubGapMs(defaultPreset.minSubGapMs);
          setEnforceMinSubGap(defaultPreset.enforceMinSubGap);
          if (!defaultPreset.diarization) setNumSpeakers('auto');
        } else {
          // Fallback to raw backend defaults if profile not in presets
          const d = opt?.defaults || {};
          setModel(d.model || 'large-v3');
          setEngine(d.engine || 'purfview-xxl');
          setProfile(defaultProfileName);
          setLanguage(d.language || 'es');
          setDevice((d.device || 'cpu') as any);
          setBatchSize(Number(d.batchSize || 16));
          setDiarization(!!d.diarization);
          setTimingFix(d.timingFix !== false);
          setMinSubGapMs(d.minSubGapMs != null ? Number(d.minSubGapMs) : 160);
          setEnforceMinSubGap(d.enforceMinSubGap !== false);
        }
      } catch (e) {
        console.warn('[CreateProjectModal] Failed to load options/presets:', e);
      }
    })();
  }, [open]);

  // ─── Custom detection ─────────────────────────────────────────────────────
  useEffect(() => {
    if (profile === 'custom') return;
    const allPresets = { ...FACTORY_PRESETS, ...userPresets };
    const current = allPresets[profile];
    if (!current) return;
    const changed =
      engine !== current.engine ||
      model !== current.model ||
      language !== current.language ||
      batchSize !== current.batchSize ||
      device !== current.device ||
      timingFix !== current.timingFix ||
      diarization !== current.diarization ||
      minSubGapMs !== current.minSubGapMs ||
      enforceMinSubGap !== current.enforceMinSubGap;
    if (changed) setProfile('custom');
  }, [engine, model, language, batchSize, device, timingFix, diarization, minSubGapMs, enforceMinSubGap]);

  if (!open) return null;

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const applyPreset = (name: string) => {
    const allPresets = { ...FACTORY_PRESETS, ...userPresets };
    const p = allPresets[name];
    if (!p) return;
    setProfile(name);
    setEngine(p.engine);
    setModel(p.model);
    setLanguage(p.language);
    setBatchSize(p.batchSize);
    setDevice(p.device);
    setTimingFix(p.timingFix);
    setDiarization(p.diarization);
    setMinSubGapMs(p.minSubGapMs);
    setEnforceMinSubGap(p.enforceMinSubGap);
    if (!p.diarization) setNumSpeakers('auto');
  };

  const handleSavePreset = async () => {
    const trimmed = savePresetName.trim();
    if (!trimmed) { setSavePresetError('El nom no pot ser buit'); return; }
    if (['ve', 'vcat'].includes(trimmed.toLowerCase())) {
      setSavePresetError('Aquest nom és reservat (preset de fàbrica)');
      return;
    }
    const currentConfig: WhisperConfig = {
      engine, model, language, batchSize, device,
      timingFix, diarization, minSubGapMs, enforceMinSubGap,
    };
    try {
      await api.saveWhisperPreset(trimmed, currentConfig);
      setUserPresets((prev) => ({ ...prev, [trimmed]: currentConfig }));
      setProfile(trimmed);
      setSavePresetOpen(false);
      setSavePresetName('');
      setSavePresetError(null);
    } catch (e: any) {
      setSavePresetError(e?.message || 'Error guardant el preset');
    }
  };

  const handleScriptFileChange = (file: File) => {
    setScriptFile(file);
    void file.text().then((text) => setScriptText(text));
  };

  const handleGuionFileChange = (file: File) => {
    setGuionFile(file);
    setGuionPreviewText('');
    setGuionConvertErr(null);
    guionConvertedRef.current = null;
    setGuionConverting(true);
    void importStructuredScriptFromFile(file)
      .then((result) => {
        guionConvertedRef.current = { content: result.content, fileName: result.fileName };
        setGuionPreviewText(result.content.slice(0, 300));
        setGuionConverting(false);
      })
      .catch((err: Error) => {
        setGuionConvertErr(err?.message || 'Error convertint el guió');
        setGuionConverting(false);
      });
  };

  const uploadGuionToProject = async (projectId: string) => {
    if (!guionFile) return;
    const preConverted = guionConvertedRef.current;
    if (preConverted) {
      await api.setProjectGuion(projectId, preConverted.content, preConverted.fileName);
    } else {
      const result = await importStructuredScriptFromFile(guionFile);
      await api.setProjectGuion(projectId, result.content, result.fileName);
    }
  };

  const handleUploadNewMedia = (file: File) => {
    void (async () => {
      setErr(null);
      setBusy(true);
      const jobId = crypto.randomUUID();
      addJob(jobId, file.name);
      try {
        const { promise: uploadPromise, abort: uploadAbort } = api.uploadMedia(
          file, (pct) => updateJob(jobId, pct),
        );
        registerAbort(jobId, uploadAbort);
        const r = await uploadPromise;
        completeJob(jobId, true);
        const newId = r?.document?.id;
        await reloadTree();
        if (newId) setMediaId(newId);
      } catch (e: any) {
        completeJob(jobId, false, e?.message || 'Error subiendo vídeo');
        setErr(e?.message || 'Error subiendo vídeo');
      } finally {
        setBusy(false);
      }
    })();
  };

  const settings = {
    model, engine, profile, language, batchSize, device,
    diarization, offline: false, timingFix, minSubGapMs, enforceMinSubGap,
    ...(engine === 'script-align' && scriptText.trim() ? { scriptText: scriptText.trim() } : {}),
    ...(diarization && numSpeakers !== 'auto'
      ? { minSpeakers: numSpeakers, maxSpeakers: numSpeakers }
      : {}),
  };

  // ─── Submit handlers ──────────────────────────────────────────────────────

  const createByTranscribe = () => {
    void (async () => {
      setErr(null);
      if (!name.trim()) return setErr('Falta el nombre del proyecto');
      if (!mediaId) return setErr('Selecciona un vídeo');
      if (engine === 'script-align' && !scriptText.trim())
        return setErr('Script-Align requiere el texto del guion');

      setBusy(true);
      try {
        const res = await api.createProject({
          name: name.trim(),
          mediaDocumentId: mediaId,
          settings,
        });

        const jobId = res?.job?.id;
        const newSrtDocId = res?.srtDocument?.id;
        const mediaDocId = res?.project?.mediaDocumentId || mediaId;
        if (!jobId || !newSrtDocId) throw new Error('Respuesta inválida al crear proyecto');

        dispatch({
          type: 'ADD_TRANSCRIPTION_TASK',
          payload: {
            id: jobId,
            projectId: res.project.id,
            projectName: name.trim(),
            srtDocumentId: newSrtDocId,
            mediaDocumentId: mediaDocId,
            status: res.job.status,
            progress: Number(res.job.progress || 0),
            error: null,
            timestamp: new Date().toISOString(),
          },
        });

        if (guionFile) {
          uploadGuionToProject(res.project.id).catch((e) => {
            console.warn('Guion upload failed (non-fatal):', e);
          });
        }

        await reloadTree();
        onClose();
      } catch (e: any) {
        setErr(e?.message || 'Error creando proyecto');
        setBusy(false);
      }
    })();
  };

  const createFromExistingSrt = () => {
    void (async () => {
      setErr(null);
      if (!name.trim()) return setErr('Falta el nombre del proyecto');
      if (!mediaId) return setErr('Selecciona un vídeo');
      if (!srtDocId && !srtFile) return setErr('Selecciona o importa un arxiu SRT');

      setBusy(true);
      try {
        const payload = srtDocId
          ? { name: name.trim(), mediaDocumentId: mediaId, sourceSrtDocumentId: srtDocId, deleteOriginalSrt, settings: {} }
          : { name: name.trim(), mediaDocumentId: mediaId, srtText: await srtFile!.text(), settings: {} };

        const res = await api.createProjectFromExisting(payload);

        const newSrtDocId = res?.srtDocument?.id;
        if (!newSrtDocId) throw new Error('Respuesta inválida al importar SRT');

        if (guionFile && res.project?.id) {
          await uploadGuionToProject(res.project.id).catch((e) => {
            console.warn('Guion upload failed (non-fatal):', e);
          });
        }

        await reloadTree();
        onClose();

        if (guionFile && newSrtDocId) {
          onOpenDocument(newSrtDocId, 'editor-video-subs' as any, true);
        }
      } catch (e: any) {
        setErr(e?.message || 'Error importando SRT');
      } finally {
        setBusy(false);
      }
    })();
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const userPresetKeys = Object.keys(userPresets);
  const isDeleteOriginalEnabled = !!srtDocId;  // only active when platform SRT selected

  return (
    <div
      className="fixed inset-0 z-[900] bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-black text-white">Crear proyecto</h2>
            <div className="flex gap-1.5">
              <button
                className={`px-2.5 py-1 rounded-md text-xs font-bold ${tab === 'transcribe' ? 'text-white' : 'bg-gray-800 text-gray-300'}`}
                style={tab === 'transcribe' ? { backgroundColor: 'var(--th-accent)' } : undefined}
                onClick={() => setTab('transcribe')}
              >
                Transcribir
              </button>
              <button
                className={`px-2.5 py-1 rounded-md text-xs font-bold ${tab === 'importSrt' ? 'text-white' : 'bg-gray-800 text-gray-300'}`}
                style={tab === 'importSrt' ? { backgroundColor: 'var(--th-accent)' } : undefined}
                onClick={() => setTab('importSrt')}
              >
                Importar SRT
              </button>
            </div>
          </div>
          <button
            className="text-gray-400 hover:text-white text-2xl leading-none"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {/* ── 2-column grid ── */}
        <div className="grid grid-cols-2 gap-4 mb-3">
          {/* Left column */}
          <div className="space-y-3">
            {/* Nombre */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Nombre</div>
              <input
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Proyecto 01"
              />
            </div>

            {/* Left col 2nd field — tab dependent */}
            {tab === 'transcribe' ? (
              /* Perfil Whisper */
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Perfil Whisper</div>
                <select
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-sm"
                  value={profile}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val !== 'custom') applyPreset(val);
                  }}
                >
                  <option value="VE">VE</option>
                  <option value="VCAT">VCAT</option>
                  {userPresetKeys.length > 0 && (
                    <option disabled value="">──────────</option>
                  )}
                  {userPresetKeys.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                  {profile === 'custom' && (
                    <option value="custom" disabled style={{ fontStyle: 'italic' }}>
                      (custom)
                    </option>
                  )}
                </select>
              </div>
            ) : (
              /* Arxiu SRT */
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Arxiu SRT</div>
                <div className="flex gap-2 items-center mb-2">
                  {srtFile ? (
                    /* External file selected — show filename badge */
                    <div className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-green-400 text-xs font-mono truncate">
                      📂 {srtFile.name}
                    </div>
                  ) : (
                    /* Platform SRT dropdown */
                    <select
                      className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm"
                      style={{ color: srtDocId ? 'var(--th-text, #e5e7eb)' : '#6b7280' }}
                      value={srtDocId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setSrtDocId(id);
                        if (id) {
                          setDeleteOriginalSrt(true);
                          setSrtFile(null);
                        }
                      }}
                    >
                      <option value="">Selecciona SRT...</option>
                      {srtDocs.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  )}
                  {/* Upload external SRT button */}
                  <label
                    className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white cursor-pointer text-base"
                    title="Importar fitxer SRT extern"
                  >
                    <input
                      type="file"
                      accept=".srt"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setSrtFile(f);
                          setSrtDocId('');
                          setDeleteOriginalSrt(false);
                        }
                        e.currentTarget.value = '';
                      }}
                    />
                    ↑
                  </label>
                  {/* Clear external file */}
                  {srtFile && (
                    <button
                      className="text-xs text-gray-500 hover:text-red-400"
                      onClick={() => { setSrtFile(null); setDeleteOriginalSrt(true); }}
                    >
                      ✕
                    </button>
                  )}
                </div>
                {/* Eliminar original — always visible, changes style based on state */}
                {isDeleteOriginalEnabled ? (
                  <label
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer"
                    style={{ background: '#2d1515', border: '1px solid #7f1d1d' }}
                  >
                    <input
                      type="checkbox"
                      checked={deleteOriginalSrt}
                      onChange={(e) => setDeleteOriginalSrt(e.target.checked)}
                      style={{ accentColor: '#ef4444', width: 12, height: 12 }}
                    />
                    <span className="text-xs font-semibold" style={{ color: '#fca5a5' }}>
                      Eliminar original
                    </span>
                  </label>
                ) : (
                  <label
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg opacity-40 cursor-default"
                    style={{ background: '#161616', border: '1px solid #252525' }}
                  >
                    <input
                      type="checkbox"
                      disabled
                      style={{ accentColor: '#6b7280', width: 12, height: 12 }}
                    />
                    <span className="text-xs font-semibold text-gray-500">
                      Eliminar original
                    </span>
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-3">
            {/* Vídeo / Audio */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Vídeo / Audio</div>
              <div className="flex gap-2 items-center">
                <select
                  className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm"
                  style={{ color: mediaId ? 'var(--th-text, #e5e7eb)' : '#6b7280' }}
                  value={mediaId}
                  onChange={(e) => setMediaId(e.target.value)}
                >
                  <option value="">Selecciona...</option>
                  {mediaDocs.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <label
                  className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white cursor-pointer text-base"
                  title="Importar fitxer de vídeo/àudio"
                >
                  <input
                    type="file"
                    accept={MEDIA_EXTS.map((x) => `.${x}`).join(',')}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadNewMedia(f);
                      e.currentTarget.value = '';
                    }}
                  />
                  ↑
                </label>
              </div>
            </div>

            {/* Guió (opcional) */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">
                Guió <span className="font-normal text-gray-500">(opcional)</span>
              </div>
              <div className="flex gap-2 items-center">
                <div
                  className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs truncate"
                  style={{ color: guionFile ? '#34d399' : '#4b5563' }}
                >
                  {guionFile ? guionFile.name : 'Sin guió'}
                </div>
                <label
                  className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white cursor-pointer text-base"
                  title="Seleccionar guió (DOCX o PDF)"
                >
                  <input
                    type="file"
                    accept=".docx,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleGuionFileChange(f);
                      e.currentTarget.value = '';
                    }}
                  />
                  📄
                </label>
                {guionFile && (
                  <button
                    className="text-xs text-gray-500 hover:text-red-400"
                    onClick={() => {
                      setGuionFile(null);
                      setGuionPreviewText('');
                      setGuionConvertErr(null);
                      guionConvertedRef.current = null;
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
              {guionConverting && (
                <div className="text-[10px] mt-1 animate-pulse" style={{ color: 'var(--th-accent-text)' }}>
                  ⏳ Convertint…
                </div>
              )}
              {guionConvertErr && (
                <div className="text-[10px] mt-1 text-red-400">{guionConvertErr}</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Whisper avançat (Transcribir tab only) ── */}
        {tab === 'transcribe' && (
          <>
            <div className="border-t border-gray-700 mb-0" />
            {/* Toggle row */}
            <div
              className="flex items-center justify-between px-1 py-2 cursor-pointer select-none"
              onClick={() => {
                const next = !advancedOpen;
                setAdvancedOpen(next);
                if (!next) setSavePresetOpen(false);
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Whisper avançat
                </span>
                <span className="text-gray-600 text-xs">{advancedOpen ? '▼' : '▶'}</span>
              </div>
              {advancedOpen && (
                <button
                  className="text-[10px] font-semibold px-2 py-1 rounded bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSavePresetOpen((prev) => !prev);
                    setSavePresetError(null);
                    setSavePresetName('');
                  }}
                >
                  Guardar perfil…
                </button>
              )}
            </div>

            {advancedOpen && (
              <div className="pb-3 space-y-3">
                {/* Motor + Model + Idioma + Batch + Device grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Motor — full width */}
                  <div className="col-span-2">
                    <div className="text-[10px] text-gray-400 mb-1">Motor</div>
                    <select
                      className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-sm"
                      value={engine}
                      onChange={(e) => setEngine(e.target.value)}
                    >
                      {(options?.engines || ['faster-whisper', 'purfview-xxl', 'whisperx', 'script-align']).map(
                        (eng: string) => (
                          <option key={eng} value={eng}>{ENGINE_LABELS[eng] ?? eng}</option>
                        ),
                      )}
                    </select>
                    {engine === 'purfview-xxl' && (
                      <div className="mt-1 text-xs rounded px-2 py-1" style={{ color: 'var(--th-accent-text)', backgroundColor: 'var(--th-accent-muted)' }}>
                        Purfview XXL: faster-whisper + post-procesado (fix casing, puntuación, fusión de líneas)
                      </div>
                    )}
                    {engine === 'script-align' && (
                      <div className="mt-1 text-xs text-green-400 bg-green-900/30 rounded px-2 py-1">
                        Script-Align: alinea el texto del guion al audio. Requiere el guion del doblaje.
                      </div>
                    )}
                  </div>

                  {engine !== 'script-align' && (
                    <div>
                      <div className="text-[10px] text-gray-400 mb-1">Modelo</div>
                      <select
                        className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-sm"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                      >
                        {[...new Set<string>(options?.models || ['tiny','base','small','medium','large-v2','large-v3','large-v3-turbo'])].map(
                          (m: string) => <option key={m} value={m}>{MODEL_LABELS[m] ?? m}</option>,
                        )}
                      </select>
                    </div>
                  )}

                  <div>
                    <div className="text-[10px] text-gray-400 mb-1">Idioma</div>
                    <input
                      className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-sm"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      placeholder="ca / es / en"
                    />
                  </div>

                  {engine !== 'script-align' && (
                    <>
                      <div>
                        <div className="text-[10px] text-gray-400 mb-1">Batch</div>
                        <input
                          type="number" min={1} max={64}
                          className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-sm"
                          value={batchSize}
                          onChange={(e) => setBatchSize(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 mb-1">Device</div>
                        <select
                          className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-sm"
                          value={device}
                          onChange={(e) => setDevice(e.target.value as any)}
                        >
                          <option value="cpu">cpu</option>
                          <option value="cuda">cuda</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>

                {/* Checkboxes */}
                <label className="flex items-center gap-2 text-sm text-gray-200">
                  <input
                    type="checkbox"
                    checked={timingFix}
                    onChange={(e) => setTimingFix(e.target.checked)}
                  />
                  Auto-ajuste de timings (waveform)
                </label>

                {engine !== 'script-align' && (
                  <>
                    <label className="flex items-center gap-2 text-sm text-gray-200">
                      <input
                        type="checkbox"
                        checked={diarization}
                        onChange={(e) => {
                          setDiarization(e.target.checked);
                          if (!e.target.checked) setNumSpeakers('auto');
                        }}
                      />
                      Diarización (identificar interlocutors)
                    </label>
                    {diarization && (
                      <div className="flex items-center gap-3 ml-5 text-sm text-gray-300">
                        <span className="text-gray-400">Nº interlocutors:</span>
                        <select
                          value={numSpeakers}
                          onChange={(e) =>
                            setNumSpeakers(e.target.value === 'auto' ? 'auto' : Number(e.target.value))
                          }
                          className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-200 text-sm"
                        >
                          <option value="auto">Auto</option>
                          {[2,3,4,5,6,7,8].map((n) => (
                            <option key={n} value={n}>{n} interlocutors</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}

                {/* Marge mínim entre subtítols */}
                <div>
                  <label className="flex items-center gap-2 text-sm text-gray-200">
                    <input
                      type="checkbox"
                      checked={enforceMinSubGap}
                      onChange={(e) => setEnforceMinSubGap(e.target.checked)}
                    />
                    Margen mínimo entre subtítulos
                  </label>
                  {enforceMinSubGap && (
                    <div className="flex items-center gap-2 ml-5 mt-1">
                      <input
                        type="number" min={0} max={2000} step={10}
                        className="w-20 px-2 py-1 rounded bg-gray-800 border border-gray-600 text-gray-100 text-sm"
                        value={minSubGapMs}
                        onChange={(e) => setMinSubGapMs(Math.max(0, Number(e.target.value)))}
                      />
                      <span className="text-xs text-gray-400">ms entre cues consecutivos</span>
                    </div>
                  )}
                </div>

                {/* Guardar perfil mini-form */}
                {savePresetOpen && (
                  <div className="rounded-lg border border-gray-700 bg-gray-800 p-3 space-y-2">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                      Guardar configuració actual com a preset
                    </div>
                    <input
                      className="w-full px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-gray-100 text-sm"
                      placeholder="Nom del preset..."
                      value={savePresetName}
                      onChange={(e) => {
                        setSavePresetName(e.target.value);
                        setSavePresetError(null);
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') void handleSavePreset(); }}
                      autoFocus
                    />
                    {savePresetName.trim() && userPresets[savePresetName.trim()] && (
                      <div className="text-[10px] text-amber-400">
                        Sobreescriurà el preset existent "{savePresetName.trim()}"
                      </div>
                    )}
                    {savePresetError && (
                      <div className="text-[10px] text-red-400">{savePresetError}</div>
                    )}
                    <div className="flex justify-end gap-2">
                      <button
                        className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-semibold"
                        onClick={() => {
                          setSavePresetOpen(false);
                          setSavePresetName('');
                          setSavePresetError(null);
                        }}
                      >
                        Cancel·lar
                      </button>
                      <button
                        className="px-3 py-1 rounded text-white text-xs font-bold"
                        style={{ backgroundColor: 'var(--th-accent)' }}
                        onClick={() => void handleSavePreset()}
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Script-Align field (only when engine = script-align, Transcribir tab) ── */}
        {tab === 'transcribe' && engine === 'script-align' && (
          <div className="mt-3">
            <div className="text-xs font-bold text-gray-400 mb-1">
              Guion del doblaje <span className="text-red-400">*</span>
            </div>
            <label className="block mb-2 text-xs text-gray-400 cursor-pointer">
              <input
                type="file"
                accept=".txt,.srt,.vtt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleScriptFileChange(f);
                  e.currentTarget.value = '';
                }}
              />
              <span className="inline-block px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-200">
                Cargar desde archivo (.txt / .srt)
              </span>
              {scriptFile && <span className="ml-2 text-green-400">{scriptFile.name}</span>}
            </label>
            <textarea
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-xs font-mono resize-none"
              rows={6}
              placeholder="Pega aquí el texto del guion o carga un archivo..."
              value={scriptText}
              onChange={(e) => {
                setScriptText(e.target.value);
                if (scriptFile) setScriptFile(null);
              }}
            />
            <div className="text-xs text-gray-500 mt-1">
              {scriptText.trim().split(/\s+/).filter(Boolean).length} palabras
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="border-t border-gray-700 mt-3 pt-3">
          {busy && (
            <div className="mb-2">
              <div className="h-1.5 w-full bg-gray-700 rounded overflow-hidden">
                <div
                  className="h-1.5 transition-all"
                  style={{ width: `${jobProgress}%`, backgroundColor: 'var(--th-accent)' }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-1">{jobProgress}%</div>
            </div>
          )}
          {err && <div className="text-sm text-red-300 mb-2">{err}</div>}
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold text-sm"
            >
              Cancelar
            </button>
            {tab === 'transcribe' ? (
              <button
                disabled={busy}
                onClick={createByTranscribe}
                className="px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-60"
                style={{ backgroundColor: 'var(--th-btn-primary-bg)', color: 'var(--th-btn-primary-text)' }}
              >
                {engine === 'script-align' ? 'Alinear guion' : 'Transcribir'}
              </button>
            ) : (
              <button
                disabled={busy}
                onClick={createFromExistingSrt}
                className="px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-60"
                style={{ backgroundColor: 'var(--th-btn-primary-bg)', color: 'var(--th-btn-primary-text)' }}
              >
                Importar SRT
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from `frontend/`:
```
npx tsc --noEmit
```
Expected: no errors. If `isCanonicalMedia` complains about `d.type`, verify the `Document` interface in `appTypes.ts` has `type: 'document'` (it does, at line 65).

- [ ] **Step 3: Manual UI verification**

Start the frontend dev server and open the Create Project modal:
1. **Transcribir tab** — verify 2-column layout: left col shows Nombre + Perfil Whisper dropdown; right col shows Vídeo/Audio + Guió
2. **Whisper avançat** — click the divider row; section expands showing Motor, Modelo, Idioma, Batch, Device, checkboxes
3. **Custom detection** — change Idioma while VE is selected; Perfil dropdown switches to "(custom)" in italic
4. **Apply preset** — switch back to VCAT; all advanced fields reset to VCAT values
5. **Guardar perfil** — open advanced, click "Guardar perfil…", type a name, click Guardar; preset appears in dropdown next time modal opens
6. **Importar SRT tab** — verify left col shows Nombre + Arxiu SRT section; "Eliminar original" always visible
7. **Eliminar original** — select platform SRT from dropdown → checkbox turns red; select external file via ↑ → checkbox goes gray/disabled; clear dropdown selection → checkbox goes gray again
8. **Error states** — submit without Nombre → "Falta el nombre del proyecto"; submit without vídeo → "Selecciona un vídeo"
9. **Create by transcribe** — fill all fields, submit, modal closes, transcription task appears in task panel
10. **Create from SRT (external)** — select .srt file, submit, project created with status ready
11. **Create from SRT (platform)** — select platform SRT, submit; verify the original SRT is soft-deleted (if checkbox checked)

- [ ] **Step 4: Commit**

```bash
git add frontend/components/Projects/CreateProjectModal.tsx
git commit -m "feat: redesign CreateProjectModal — 2-col layout, Whisper presets, SRT from platform"
```

---

## Post-implementation checklist

After all tasks are complete, verify no regressions:

- [ ] Open Files tab → all documents visible, no crashes
- [ ] Open Media tab → only canonical media shown (LNK and .srt files absent)
- [ ] Open Projectes tab → project folders visible
- [ ] Open an existing project → subtitle editor loads normally
- [ ] Create a project via Transcribir → job queued, appears in task panel
- [ ] Create a project via Importar SRT (external file) → project ready immediately, LNK appears in project folder
- [ ] Create a project via Importar SRT (platform doc, delete enabled) → original SRT document goes to trash
- [ ] Backend restart → UserSettings collection exists in MongoDB (check via mongo shell or Compass)
