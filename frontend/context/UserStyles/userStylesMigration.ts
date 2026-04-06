// frontend/context/UserStyles/userStylesMigration.ts
import type {
  UserStylesPayload,
  ScriptEditorStyleSet,
  SubtitleEditorStyleSet,
  HomeStyleSet,
  UserStylePreset,
  StyleScope,
  ScopeState,
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
    version: 2,
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
 * Migra un payload de v1 a v2. Només toca els scopes 'subtitleEditor' i
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

export const USER_STYLES_LOCAL_STORAGE_PREFIX = 'snlbpro_user_styles_';

export function scopedKey(userId: string): string {
  return `${USER_STYLES_LOCAL_STORAGE_PREFIX}${userId}`;
}
