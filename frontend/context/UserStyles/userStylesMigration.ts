// frontend/context/UserStyles/userStylesMigration.ts
import type {
  UserStylesPayload,
  ScriptEditorStyleSet,
  SubtitleEditorStyleSet,
  HomeStyleSet,
  UserStylePreset,
  StyleScope,
} from '../../types/UserStyles/userStylesTypes';
import {
  FACTORY_SCRIPT_STYLES,
  FACTORY_SUBTITLE_STYLES,
  FACTORY_HOME_STYLES,
} from './factoryStyles';
import type { EditorStyles } from '../../appTypes';

const DEFAULT_PRESET_ID = 'default';
const DEFAULT_PRESET_NAME = 'Per defecte';

function defaultPresetFor<S extends StyleScope>(
  styles: UserStylePreset<S>['styles'],
): UserStylePreset<S> {
  return {
    id: DEFAULT_PRESET_ID,
    name: DEFAULT_PRESET_NAME,
    builtin: true,
    styles,
  };
}

/**
 * Construye un payload inicial. Si se pasa `legacy` (el viejo EditorStyles
 * de localStorage `snlbpro_editor_styles`), se usa como contenido del preset
 * 'Per defecte' del editor de guiones — los usuarios que ya habían personalizado
 * mantienen su configuración sin acción manual.
 */
export function buildInitialPayload(opts: { legacy?: EditorStyles | null }): UserStylesPayload {
  const scriptStyles: ScriptEditorStyleSet = opts.legacy ?? FACTORY_SCRIPT_STYLES;

  return {
    version: 1,
    scriptEditor: {
      activePresetId: DEFAULT_PRESET_ID,
      presets: [defaultPresetFor<'scriptEditor'>(scriptStyles)],
    },
    subtitleEditor: {
      activePresetId: DEFAULT_PRESET_ID,
      presets: [defaultPresetFor<'subtitleEditor'>(FACTORY_SUBTITLE_STYLES)],
    },
    home: {
      activePresetId: DEFAULT_PRESET_ID,
      presets: [defaultPresetFor<'home'>(FACTORY_HOME_STYLES)],
    },
  };
}

/**
 * Resuelve la presencia de userStyles en el orden:
 *   1. backend (`me.preferences.userStyles`)
 *   2. cache local scoped: `snlbpro_user_styles_<userId>`
 *   3. migración desde legacy `snlbpro_editor_styles`
 *
 * Devuelve también una bandera `needsPush` para que el caller decida si subir al backend.
 */
export interface LoadOrMigrateResult {
  payload: UserStylesPayload;
  needsPush: boolean;
}

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

export const USER_STYLES_LOCAL_STORAGE_PREFIX = 'snlbpro_user_styles_';

export function scopedKey(userId: string): string {
  return `${USER_STYLES_LOCAL_STORAGE_PREFIX}${userId}`;
}
