/**
 * Conversió pura frame↔ms i presets de temps per perfil (TV 25 / Cine 24).
 *
 * Els valors de `min duration` i `min gap` de l'editor es guarden internament en
 * ms (contracte estable amb els consumidors de l'editor). Aquest mòdul només
 * ofereix la traducció a/de frames perquè la UI pugui oferir presets expressats
 * en frames sense trencar el format ms intern.
 */

export const DEFAULT_FPS = 25;

/** Converteix frames a mil·lisegons segons un fps donat (arrodonit al ms). */
export function framesToMs(frames: number, fps: number): number {
  if (!fps || fps <= 0) return 0;
  return Math.round((frames / fps) * 1000);
}

/** Converteix mil·lisegons a frames segons un fps donat (arrodonit al frame). */
export function msToFrames(ms: number, fps: number): number {
  if (!fps || fps <= 0) return 0;
  return Math.round((ms / 1000) * fps);
}

export interface FpsPreset {
  id: 'tv' | 'cine';
  label: string;
  fps: number;
  /** Separació mínima entre subtítols, en frames. */
  minGapFrames: number;
  /** Durada mínima d'un bloc, en frames. */
  minDurationFrames: number;
}

/**
 * Presets professionals. min gap = 2 frames (estàndard broadcast habitual);
 * min duration = 1 s (fps frames) per coincidir amb el default històric de 1000 ms.
 */
export const FPS_PRESETS: FpsPreset[] = [
  { id: 'tv', label: 'TV (25 fps)', fps: 25, minGapFrames: 2, minDurationFrames: 25 },
  { id: 'cine', label: 'Cine (24 fps)', fps: 24, minGapFrames: 2, minDurationFrames: 24 },
];

/** Valors en ms que fixa un preset (per aplicar-los als settings de l'editor). */
export function presetToMs(preset: FpsPreset): { minGapMs: number; minDurationMs: number } {
  return {
    minGapMs: framesToMs(preset.minGapFrames, preset.fps),
    minDurationMs: framesToMs(preset.minDurationFrames, preset.fps),
  };
}

/**
 * Determina quin preset coincideix amb l'estat actual (fps + ms), o 'custom' si
 * no en coincideix cap. Serveix per marcar el botó actiu a la UI sense estat extra.
 */
export function detectActivePreset(
  fps: number,
  minGapMs: number,
  minDurationMs: number,
): FpsPreset['id'] | 'custom' {
  for (const p of FPS_PRESETS) {
    const { minGapMs: g, minDurationMs: d } = presetToMs(p);
    if (fps === p.fps && minGapMs === g && minDurationMs === d) return p.id;
  }
  return 'custom';
}
