// context/Theme/ThemeContext.tsx
// Proveïdor central del tema de color de l'aplicació.
// Aplica CSS custom properties (--th-*) a :root i persisiteix la preferència
// de l'usuari a localStorage + backend (preferences.customThemeTokens).

import React, { createContext, useContext, useEffect, useMemo, useCallback, useRef, useState } from 'react';
import useLocalStorage from '../../hooks/useLocalStorage';
import { LOCAL_STORAGE_KEYS } from '../../constants';
import {
  ThemeDefinition,
  PRESET_THEMES,
  DEFAULT_THEME_ID,
  CUSTOM_THEME_ID,
  getThemeById,
  buildCustomTheme,
} from './themes';
import { api, getToken } from '../../services/api';

interface ThemeContextValue {
  /** Tema actiu actual */
  theme: ThemeDefinition;
  /** ID del tema actiu */
  themeId: string;
  /** Canviar el tema actiu */
  setThemeId: (id: string) => void;
  /** Llista de tots els temes disponibles (presets) */
  themes: ThemeDefinition[];
  /** Tokens del tema personalitzat (editables) */
  customTokens: Record<string, string>;
  /** Actualitzar un o més tokens del tema personalitzat */
  setCustomTokens: (tokens: Record<string, string>) => void;
  /** Restablir tokens personalitzats a un preset base */
  resetCustomTokensFromPreset: (presetId: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Sistema d'overrides CSS per tema.
 *
 * Cada tema pot necessitar correccions globals de Tailwind:
 * - Sonilab: neutralitza el subtò blau dels grays de Tailwind
 * - Light:   inverteix text clar→fosc, fons fosc→clar, overlays blanc→negre
 *
 * Estratègia de especificitat:
 * - Fons: !important (per guanyar sobre Tailwind + inline)
 * - Text:  SENSE !important — així inline styles (botons, tabs actius)
 *          guanyen automàticament i conserven el color correcte.
 */
const THEME_OVERRIDES_STYLE_ID = 'th-theme-overrides';

function injectThemeOverrides(themeId: string) {
  let styleEl = document.getElementById(THEME_OVERRIDES_STYLE_ID) as HTMLStyleElement | null;

  const needsOverrides = themeId === 'sonilab' || themeId === 'light';

  if (!needsOverrides) {
    styleEl?.remove();
    return;
  }

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = THEME_OVERRIDES_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  let css = '';

  // ─────────────────────────────────────────────────────────────────────────
  // SONILAB: Tailwind blue-tinted grays → neutral pure grays
  // ─────────────────────────────────────────────────────────────────────────
  if (themeId === 'sonilab') {
    css = `
    /* ═══ Sonilab: Override Tailwind blue-tinted grays → neutral pure grays ═══ */
    [data-theme="sonilab"] {
      --tw-gray-950: 5 5 5;
      --tw-gray-900: 18 18 18;
      --tw-gray-800: 30 30 30;
      --tw-gray-700: 50 50 50;
      --tw-gray-600: 70 70 70;
      --tw-gray-500: 100 100 100;
    }

    /* ── Backgrounds ── */
    [data-theme="sonilab"] .bg-gray-950  { background-color: rgb(5 5 5) !important; }
    [data-theme="sonilab"] .bg-gray-900  { background-color: rgb(18 18 18) !important; }
    [data-theme="sonilab"] .bg-gray-800  { background-color: rgb(30 30 30) !important; }
    [data-theme="sonilab"] .bg-gray-700  { background-color: rgb(50 50 50) !important; }
    [data-theme="sonilab"] .bg-gray-600  { background-color: rgb(70 70 70) !important; }

    [data-theme="sonilab"] .bg-gray-950\\/40 { background-color: rgba(5,5,5,0.4) !important; }
    [data-theme="sonilab"] .bg-gray-950\\/50 { background-color: rgba(5,5,5,0.5) !important; }
    [data-theme="sonilab"] .bg-gray-900\\/10 { background-color: rgba(18,18,18,0.1) !important; }
    [data-theme="sonilab"] .bg-gray-900\\/20 { background-color: rgba(18,18,18,0.2) !important; }
    [data-theme="sonilab"] .bg-gray-900\\/30 { background-color: rgba(18,18,18,0.3) !important; }
    [data-theme="sonilab"] .bg-gray-900\\/40 { background-color: rgba(18,18,18,0.4) !important; }
    [data-theme="sonilab"] .bg-gray-900\\/50 { background-color: rgba(18,18,18,0.5) !important; }
    [data-theme="sonilab"] .bg-gray-900\\/60 { background-color: rgba(18,18,18,0.6) !important; }
    [data-theme="sonilab"] .bg-gray-900\\/80 { background-color: rgba(18,18,18,0.8) !important; }
    [data-theme="sonilab"] .bg-gray-900\\/90 { background-color: rgba(18,18,18,0.9) !important; }
    [data-theme="sonilab"] .bg-gray-800\\/20 { background-color: rgba(30,30,30,0.2) !important; }
    [data-theme="sonilab"] .bg-gray-800\\/30 { background-color: rgba(30,30,30,0.3) !important; }
    [data-theme="sonilab"] .bg-gray-800\\/40 { background-color: rgba(30,30,30,0.4) !important; }
    [data-theme="sonilab"] .bg-gray-800\\/50 { background-color: rgba(30,30,30,0.5) !important; }
    [data-theme="sonilab"] .bg-gray-800\\/60 { background-color: rgba(30,30,30,0.6) !important; }
    [data-theme="sonilab"] .bg-gray-800\\/80 { background-color: rgba(30,30,30,0.8) !important; }
    [data-theme="sonilab"] .bg-gray-700\\/20 { background-color: rgba(50,50,50,0.2) !important; }
    [data-theme="sonilab"] .bg-gray-700\\/30 { background-color: rgba(50,50,50,0.3) !important; }
    [data-theme="sonilab"] .bg-gray-700\\/40 { background-color: rgba(50,50,50,0.4) !important; }
    [data-theme="sonilab"] .bg-gray-700\\/50 { background-color: rgba(50,50,50,0.5) !important; }
    [data-theme="sonilab"] .bg-gray-600\\/50 { background-color: rgba(70,70,70,0.5) !important; }

    /* ── Hover backgrounds ── */
    [data-theme="sonilab"] .hover\\:bg-gray-950:hover { background-color: rgb(5 5 5) !important; }
    [data-theme="sonilab"] .hover\\:bg-gray-900:hover { background-color: rgb(18 18 18) !important; }
    [data-theme="sonilab"] .hover\\:bg-gray-800:hover { background-color: rgb(30 30 30) !important; }
    [data-theme="sonilab"] .hover\\:bg-gray-700:hover { background-color: rgb(50 50 50) !important; }
    [data-theme="sonilab"] .hover\\:bg-gray-600:hover { background-color: rgb(70 70 70) !important; }
    [data-theme="sonilab"] .hover\\:bg-gray-800\\/50:hover { background-color: rgba(30,30,30,0.5) !important; }
    [data-theme="sonilab"] .hover\\:bg-gray-800\\/60:hover { background-color: rgba(30,30,30,0.6) !important; }
    [data-theme="sonilab"] .hover\\:bg-gray-700\\/30:hover { background-color: rgba(50,50,50,0.3) !important; }
    [data-theme="sonilab"] .hover\\:bg-gray-700\\/50:hover { background-color: rgba(50,50,50,0.5) !important; }
    [data-theme="sonilab"] .hover\\:bg-gray-600\\/60:hover { background-color: rgba(70,70,70,0.6) !important; }

    /* ── Borders ── */
    [data-theme="sonilab"] .border-gray-950 { border-color: rgb(5 5 5) !important; }
    [data-theme="sonilab"] .border-gray-900 { border-color: rgb(18 18 18) !important; }
    [data-theme="sonilab"] .border-gray-800 { border-color: rgb(30 30 30) !important; }
    [data-theme="sonilab"] .border-gray-700 { border-color: rgb(50 50 50) !important; }
    [data-theme="sonilab"] .border-gray-600 { border-color: rgb(70 70 70) !important; }
    [data-theme="sonilab"] .border-gray-800\\/50 { border-color: rgba(30,30,30,0.5) !important; }
    [data-theme="sonilab"] .border-gray-800\\/30 { border-color: rgba(30,30,30,0.3) !important; }
    [data-theme="sonilab"] .border-gray-700\\/50 { border-color: rgba(50,50,50,0.5) !important; }
    [data-theme="sonilab"] .border-gray-700\\/30 { border-color: rgba(50,50,50,0.3) !important; }
    [data-theme="sonilab"] .border-gray-600\\/50 { border-color: rgba(70,70,70,0.5) !important; }
    [data-theme="sonilab"] .border-gray-600\\/30 { border-color: rgba(70,70,70,0.3) !important; }
    [data-theme="sonilab"] .border-gray-500 { border-color: rgb(100 100 100) !important; }
    [data-theme="sonilab"] .border-gray-500\\/50 { border-color: rgba(100,100,100,0.5) !important; }
    [data-theme="sonilab"] .hover\\:border-gray-600:hover { border-color: rgb(70 70 70) !important; }
    [data-theme="sonilab"] .hover\\:border-gray-600\\/60:hover { border-color: rgba(70,70,70,0.6) !important; }
    [data-theme="sonilab"] .hover\\:border-gray-500:hover { border-color: rgb(100 100 100) !important; }
    [data-theme="sonilab"] .hover\\:border-gray-500\\/50:hover { border-color: rgba(100,100,100,0.5) !important; }

    /* ── Dividers ── */
    [data-theme="sonilab"] .divide-gray-800 > :not([hidden]) ~ :not([hidden]) { border-color: rgb(30 30 30) !important; }
    [data-theme="sonilab"] .divide-gray-700 > :not([hidden]) ~ :not([hidden]) { border-color: rgb(50 50 50) !important; }
    [data-theme="sonilab"] .divide-gray-800\\/30 > :not([hidden]) ~ :not([hidden]) { border-color: rgba(30,30,30,0.3) !important; }
    [data-theme="sonilab"] .divide-gray-700\\/50 > :not([hidden]) ~ :not([hidden]) { border-color: rgba(50,50,50,0.5) !important; }

    /* ── Ring colors ── */
    [data-theme="sonilab"] .ring-gray-800 { --tw-ring-color: rgb(30 30 30) !important; }
    [data-theme="sonilab"] .ring-gray-700 { --tw-ring-color: rgb(50 50 50) !important; }
    [data-theme="sonilab"] .ring-gray-900 { --tw-ring-color: rgb(18 18 18) !important; }

    /* ── Text colors ── */
    [data-theme="sonilab"] .text-gray-900 { color: rgb(18 18 18) !important; }
    [data-theme="sonilab"] .text-gray-800 { color: rgb(30 30 30) !important; }
    [data-theme="sonilab"] .text-gray-700 { color: rgb(50 50 50) !important; }
    [data-theme="sonilab"] .text-gray-600 { color: rgb(70 70 70) !important; }

    /* ── Hardcoded navy hex values ── */
    [data-theme="sonilab"] .bg-\\[\\#111827\\] { background-color: rgb(18 18 18) !important; }
    [data-theme="sonilab"] .bg-\\[\\#0f172a\\] { background-color: rgb(10 10 10) !important; }
    [data-theme="sonilab"] .bg-\\[\\#1e293b\\] { background-color: rgb(30 30 30) !important; }
    [data-theme="sonilab"] .bg-\\[\\#020617\\] { background-color: rgb(5 5 5) !important; }
    [data-theme="sonilab"] .bg-\\[\\#0b1120\\] { background-color: rgb(8 8 8) !important; }
    `;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIGHT: Invertir colors per legibilitat en mode clar
  // ─────────────────────────────────────────────────────────────────────────
  // Text: SENSE !important perquè inline styles (botons, tabs) guanyin.
  // Fons: AMB !important per consistència amb l'approach Sonilab.
  // ─────────────────────────────────────────────────────────────────────────
  if (themeId === 'light') {
    css = `
    /* ═══ Light theme: Flip dark-mode Tailwind classes for readability ═══ */

    /* ── TEXT: white/light → dark (NO !important — inline styles win) ── */
    [data-theme="light"] .text-white     { color: #18181b; }
    [data-theme="light"] .text-gray-100  { color: #1c1c20; }
    [data-theme="light"] .text-gray-200  { color: #27272a; }
    [data-theme="light"] .text-gray-300  { color: #3f3f46; }
    [data-theme="light"] .text-gray-400  { color: #52525b; }
    [data-theme="light"] .text-gray-500  { color: #6b7280; }
    /* Bright colors that need darkening on light bg */
    [data-theme="light"] .text-yellow-300 { color: #a16207; }
    [data-theme="light"] .text-amber-300  { color: #92400e; }
    [data-theme="light"] .text-amber-400  { color: #92400e; }

    /* Hover text */
    [data-theme="light"] .hover\\:text-white:hover    { color: #18181b; }
    [data-theme="light"] .hover\\:text-gray-100:hover { color: #1c1c20; }
    [data-theme="light"] .hover\\:text-gray-200:hover { color: #18181b; }
    [data-theme="light"] .hover\\:text-gray-300:hover { color: #27272a; }
    [data-theme="light"] .hover\\:text-gray-400:hover { color: #3f3f46; }

    /* Group-hover text */
    [data-theme="light"] .group:hover .group-hover\\:text-white    { color: #18181b; }
    [data-theme="light"] .group:hover .group-hover\\:text-gray-200 { color: #27272a; }
    [data-theme="light"] .group:hover .group-hover\\:text-gray-300 { color: #3f3f46; }

    /* Placeholder text */
    [data-theme="light"] .placeholder-gray-500::placeholder { color: #a1a1aa; }
    [data-theme="light"] .placeholder-gray-400::placeholder { color: #71717a; }
    [data-theme="light"] .placeholder\\:text-gray-500::placeholder { color: #a1a1aa; }
    [data-theme="light"] .placeholder\\:text-gray-400::placeholder { color: #71717a; }

    /* ── EXCEPTIONS: preserve white text on colored backgrounds ── */
    /* Elements with colored Tailwind bg + text-white (same element) */
    [data-theme="light"] [class*="bg-red-"].text-white,
    [data-theme="light"] [class*="bg-green-"].text-white,
    [data-theme="light"] [class*="bg-blue-"].text-white,
    [data-theme="light"] [class*="bg-indigo-"].text-white,
    [data-theme="light"] [class*="bg-violet-"].text-white,
    [data-theme="light"] [class*="bg-emerald-"].text-white,
    [data-theme="light"] [class*="bg-amber-"].text-white,
    [data-theme="light"] [class*="bg-orange-"].text-white,
    [data-theme="light"] [class*="bg-yellow-"].text-white,
    [data-theme="light"] [class*="bg-rose-"].text-white,
    [data-theme="light"] [class*="bg-purple-"].text-white,
    [data-theme="light"] [class*="bg-pink-"].text-white,
    [data-theme="light"] [class*="bg-teal-"].text-white,
    [data-theme="light"] [class*="bg-cyan-"].text-white { color: #ffffff; }
    /* Elements with or inside containers with colored inline backgrounds (accent, btn-primary, tab-active) */
    [data-theme="light"] [style*="--th-accent"].text-white,
    [data-theme="light"] [style*="--th-accent"] .text-white,
    [data-theme="light"] [style*="--th-btn-primary"].text-white,
    [data-theme="light"] [style*="--th-btn-primary"] .text-white,
    [data-theme="light"] [style*="--th-tab-active"].text-white,
    [data-theme="light"] [style*="--th-tab-active"] .text-white { color: #ffffff; }
    /* lib-nav-active elements (LibraryView custom class) */
    [data-theme="light"] .lib-nav-active.text-white,
    [data-theme="light"] .lib-nav-active .text-white { color: #ffffff; }

    /* ── BACKGROUNDS: dark → light (with !important) ── */
    [data-theme="light"] .bg-gray-950  { background-color: #e8e8eb !important; }
    [data-theme="light"] .bg-gray-900  { background-color: #f0f0f2 !important; }
    [data-theme="light"] .bg-gray-800  { background-color: #f4f4f5 !important; }
    [data-theme="light"] .bg-gray-700  { background-color: #e4e4e7 !important; }
    [data-theme="light"] .bg-gray-600  { background-color: #d4d4d8 !important; }

    [data-theme="light"] .bg-gray-950\\/40 { background-color: rgba(232,232,235,0.4) !important; }
    [data-theme="light"] .bg-gray-950\\/50 { background-color: rgba(232,232,235,0.5) !important; }
    [data-theme="light"] .bg-gray-900\\/10 { background-color: rgba(240,240,242,0.3) !important; }
    [data-theme="light"] .bg-gray-900\\/20 { background-color: rgba(240,240,242,0.4) !important; }
    [data-theme="light"] .bg-gray-900\\/30 { background-color: rgba(240,240,242,0.5) !important; }
    [data-theme="light"] .bg-gray-900\\/40 { background-color: rgba(240,240,242,0.6) !important; }
    [data-theme="light"] .bg-gray-900\\/50 { background-color: rgba(240,240,242,0.7) !important; }
    [data-theme="light"] .bg-gray-900\\/60 { background-color: rgba(240,240,242,0.8) !important; }
    [data-theme="light"] .bg-gray-900\\/80 { background-color: rgba(240,240,242,0.9) !important; }
    [data-theme="light"] .bg-gray-900\\/90 { background-color: rgba(240,240,242,0.95) !important; }
    [data-theme="light"] .bg-gray-800\\/20 { background-color: rgba(244,244,245,0.4) !important; }
    [data-theme="light"] .bg-gray-800\\/30 { background-color: rgba(244,244,245,0.5) !important; }
    [data-theme="light"] .bg-gray-800\\/40 { background-color: rgba(244,244,245,0.6) !important; }
    [data-theme="light"] .bg-gray-800\\/50 { background-color: rgba(244,244,245,0.7) !important; }
    [data-theme="light"] .bg-gray-800\\/60 { background-color: rgba(244,244,245,0.8) !important; }
    [data-theme="light"] .bg-gray-800\\/80 { background-color: rgba(244,244,245,0.9) !important; }
    [data-theme="light"] .bg-gray-700\\/20 { background-color: rgba(228,228,231,0.3) !important; }
    [data-theme="light"] .bg-gray-700\\/30 { background-color: rgba(228,228,231,0.5) !important; }
    [data-theme="light"] .bg-gray-700\\/40 { background-color: rgba(228,228,231,0.6) !important; }
    [data-theme="light"] .bg-gray-700\\/50 { background-color: rgba(228,228,231,0.7) !important; }
    [data-theme="light"] .bg-gray-600\\/50 { background-color: rgba(212,212,216,0.5) !important; }

    /* Hover backgrounds */
    [data-theme="light"] .hover\\:bg-gray-950:hover { background-color: #e8e8eb !important; }
    [data-theme="light"] .hover\\:bg-gray-900:hover { background-color: #f0f0f2 !important; }
    [data-theme="light"] .hover\\:bg-gray-800:hover { background-color: #f4f4f5 !important; }
    [data-theme="light"] .hover\\:bg-gray-700:hover { background-color: #e4e4e7 !important; }
    [data-theme="light"] .hover\\:bg-gray-600:hover { background-color: #d4d4d8 !important; }
    [data-theme="light"] .hover\\:bg-gray-800\\/50:hover { background-color: rgba(244,244,245,0.7) !important; }
    [data-theme="light"] .hover\\:bg-gray-800\\/60:hover { background-color: rgba(244,244,245,0.8) !important; }
    [data-theme="light"] .hover\\:bg-gray-700\\/30:hover { background-color: rgba(228,228,231,0.5) !important; }
    [data-theme="light"] .hover\\:bg-gray-700\\/50:hover { background-color: rgba(228,228,231,0.7) !important; }
    [data-theme="light"] .hover\\:bg-gray-600\\/60:hover { background-color: rgba(212,212,216,0.6) !important; }

    /* ── White overlays → black overlays (invisible on white bg otherwise) ── */
    [data-theme="light"] .bg-white\\/5   { background-color: rgba(0,0,0,0.03) !important; }
    [data-theme="light"] .bg-white\\/10  { background-color: rgba(0,0,0,0.05) !important; }
    [data-theme="light"] .bg-white\\/15  { background-color: rgba(0,0,0,0.07) !important; }
    [data-theme="light"] .bg-white\\/20  { background-color: rgba(0,0,0,0.08) !important; }
    [data-theme="light"] .hover\\:bg-white\\/5:hover  { background-color: rgba(0,0,0,0.04) !important; }
    [data-theme="light"] .hover\\:bg-white\\/10:hover { background-color: rgba(0,0,0,0.06) !important; }
    [data-theme="light"] .hover\\:bg-white\\/15:hover { background-color: rgba(0,0,0,0.08) !important; }
    [data-theme="light"] .hover\\:bg-white\\/20:hover { background-color: rgba(0,0,0,0.10) !important; }

    /* Border white overlays → black overlays */
    [data-theme="light"] .border-white\\/5   { border-color: rgba(0,0,0,0.05) !important; }
    [data-theme="light"] .border-white\\/10  { border-color: rgba(0,0,0,0.08) !important; }
    [data-theme="light"] .border-white\\/15  { border-color: rgba(0,0,0,0.10) !important; }
    [data-theme="light"] .border-white\\/20  { border-color: rgba(0,0,0,0.12) !important; }

    /* ── BORDERS: dark → light ── */
    [data-theme="light"] .border-gray-950 { border-color: #e4e4e7 !important; }
    [data-theme="light"] .border-gray-900 { border-color: #d4d4d8 !important; }
    [data-theme="light"] .border-gray-800 { border-color: #d4d4d8 !important; }
    [data-theme="light"] .border-gray-700 { border-color: #d4d4d8 !important; }
    [data-theme="light"] .border-gray-600 { border-color: #a1a1aa !important; }
    [data-theme="light"] .border-gray-800\\/50 { border-color: rgba(212,212,216,0.5) !important; }
    [data-theme="light"] .border-gray-800\\/30 { border-color: rgba(212,212,216,0.3) !important; }
    [data-theme="light"] .border-gray-700\\/50 { border-color: rgba(212,212,216,0.5) !important; }
    [data-theme="light"] .border-gray-700\\/30 { border-color: rgba(212,212,216,0.3) !important; }
    [data-theme="light"] .border-gray-600\\/50 { border-color: rgba(161,161,170,0.5) !important; }
    [data-theme="light"] .border-gray-600\\/30 { border-color: rgba(161,161,170,0.3) !important; }
    [data-theme="light"] .border-gray-500 { border-color: #a1a1aa !important; }
    [data-theme="light"] .border-gray-500\\/50 { border-color: rgba(161,161,170,0.5) !important; }

    /* ── Border via var(--th-border) — already correct from theme tokens ── */

    /* ── Dividers ── */
    [data-theme="light"] .divide-gray-800 > :not([hidden]) ~ :not([hidden]) { border-color: #d4d4d8 !important; }
    [data-theme="light"] .divide-gray-700 > :not([hidden]) ~ :not([hidden]) { border-color: #d4d4d8 !important; }

    /* ── Ring colors ── */
    [data-theme="light"] .ring-gray-800 { --tw-ring-color: #d4d4d8 !important; }
    [data-theme="light"] .ring-gray-700 { --tw-ring-color: #d4d4d8 !important; }
    [data-theme="light"] .ring-gray-900 { --tw-ring-color: #e4e4e7 !important; }

    /* ── Hardcoded navy hex backgrounds → light ── */
    [data-theme="light"] .bg-\\[\\#111827\\] { background-color: #f0f0f2 !important; }
    [data-theme="light"] .bg-\\[\\#0f172a\\] { background-color: #e8e8eb !important; }
    [data-theme="light"] .bg-\\[\\#1e293b\\] { background-color: #f4f4f5 !important; }
    [data-theme="light"] .bg-\\[\\#020617\\] { background-color: #e8e8eb !important; }
    [data-theme="light"] .bg-\\[\\#0b1120\\] { background-color: #ececef !important; }

    /* ── bg-black with opacity: keep functional (modal overlays) ── */
    /* No override needed — bg-black/* stays dark, which is correct for overlays */

    /* ── Form elements: ensure dark text and proper backgrounds ── */
    [data-theme="light"] input,
    [data-theme="light"] textarea,
    [data-theme="light"] select { color: #18181b; }
    [data-theme="light"] input::placeholder,
    [data-theme="light"] textarea::placeholder { color: #a1a1aa; }

    /* ── Focus states ── */
    [data-theme="light"] .focus\\:ring-gray-500\\/30:focus { --tw-ring-color: rgba(161,161,170,0.3) !important; }
    [data-theme="light"] .focus\\:border-gray-500:focus { border-color: #a1a1aa !important; }

    /* ── Scrollbar styling ── */
    [data-theme="light"] ::-webkit-scrollbar-track { background: #f4f4f5; }
    [data-theme="light"] ::-webkit-scrollbar-thumb { background: #a1a1aa; }
    [data-theme="light"] ::-webkit-scrollbar-thumb:hover { background: #71717a; }
    `;
  }

  styleEl.textContent = css;
}

/** Aplica els tokens del tema com a CSS custom properties a :root */
function applyThemeToDOM(theme: ThemeDefinition) {
  const root = document.documentElement;

  // Aplicar cada token com --th-<key>
  for (const [key, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(`--th-${key}`, value);
  }

  // Aplicar el fons al body directament (per evitar flash blanc al carregar)
  document.body.style.backgroundColor = theme.tokens['bg-app'] || '';

  // Data attribute per si convé fer queries CSS
  root.setAttribute('data-theme', theme.id);

  // Injectar overrides CSS específics del tema
  injectThemeOverrides(theme.id);
}

// ── Debounce per a persistència al backend ──────────────────────────────
const SAVE_DEBOUNCE_MS = 1500;

// ── Validació de color CSS ──────────────────────────────────────────────
// Accepta: #hex, rgb(), rgba(), hsl(), hsla(), keywords CSS, transparent
const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,/%]+\)|hsla?\([\d\s.,/%]+\)|transparent|inherit|currentColor|[a-zA-Z]+)$/;

function isValidCssColor(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim();
  if (COLOR_RE.test(v)) return true;
  // Fallback: usar un element temporal per validar via el navegador
  if (typeof document === 'undefined') return false;
  const el = document.createElement('div');
  el.style.color = '';
  el.style.color = v;
  return el.style.color !== '';
}

/** Sanititza un objecte de tokens: descarta valors buits o invàlids */
function sanitizeTokens(tokens: Record<string, string>): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens)) {
    if (value && typeof value === 'string' && isValidCssColor(value.trim())) {
      clean[key] = value.trim();
    }
  }
  return clean;
}

// ── localStorage amb userId scope ───────────────────────────────────────
// Quan hi ha un userId disponible, les claus es sufixaren amb _<userId>
// per evitar mescles entre comptes al mateix navegador.
function scopedKey(base: string, userId?: string | null): string {
  return userId ? `${base}_${userId}` : base;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // userId per scoping de localStorage — es resol quan AuthProvider carrega el perfil
  const [userId, setUserId] = useState<string | null>(null);

  // ── localStorage sense scope (primer render ràpid, evita flash) ──
  const [themeIdRaw, setThemeIdRaw] = useLocalStorage<string>(LOCAL_STORAGE_KEYS.THEME, DEFAULT_THEME_ID);
  const [customTokensRaw, setCustomTokensRawLS] = useLocalStorage<Record<string, string>>(
    LOCAL_STORAGE_KEYS.CUSTOM_THEME_TOKENS,
    {}
  );

  // ── State real (pot venir de backend o de localStorage) ──
  const [themeId, setThemeIdState] = useState<string>(themeIdRaw);
  const [customTokens, setCustomTokensState] = useState<Record<string, string>>(customTokensRaw);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Persistir al backend (debounced) ──
  const persistToBackend = useCallback((tid: string, tokens: Record<string, string>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const token = getToken();
      if (!token) return;
      api.updateMe({ preferences: { themeId: tid, customThemeTokens: tokens } }).catch(() => {});
    }, SAVE_DEBOUNCE_MS);
  }, []);

  // ── Persistir a localStorage (amb scope si tenim userId) ──
  const persistToLocal = useCallback((tid: string, tokens: Record<string, string>, uid?: string | null) => {
    try {
      // Sempre desar a la clau genèrica (per al flash prevention del primer render)
      localStorage.setItem(LOCAL_STORAGE_KEYS.THEME, JSON.stringify(tid));
      localStorage.setItem(LOCAL_STORAGE_KEYS.CUSTOM_THEME_TOKENS, JSON.stringify(tokens));
      // Si hi ha userId, desar també a la clau scopada
      if (uid) {
        localStorage.setItem(scopedKey(LOCAL_STORAGE_KEYS.THEME, uid), JSON.stringify(tid));
        localStorage.setItem(scopedKey(LOCAL_STORAGE_KEYS.CUSTOM_THEME_TOKENS, uid), JSON.stringify(tokens));
      }
    } catch { /* quota exceeded, etc */ }
  }, []);

  // ── setThemeId: actualitza state + persiste ──
  const setThemeId = useCallback((newId: string) => {
    setThemeIdState(newId);
    persistToLocal(newId, customTokens, userId);
    persistToBackend(newId, customTokens);
  }, [customTokens, userId, persistToLocal, persistToBackend]);

  // ── setCustomTokens: merge parcial + valida + persiste ──
  const setCustomTokens = useCallback((newTokens: Record<string, string>) => {
    setCustomTokensState((prev) => {
      const merged = { ...prev, ...sanitizeTokens(newTokens) };
      persistToLocal(themeId, merged, userId);
      persistToBackend(themeId, merged);
      return merged;
    });
  }, [themeId, userId, persistToLocal, persistToBackend]);

  // ── Restablir des d'un preset ──
  const resetCustomTokensFromPreset = useCallback((presetId: string) => {
    const preset = PRESET_THEMES.find(t => t.id === presetId) ?? PRESET_THEMES[0];
    const tokens = { ...preset.tokens };
    setCustomTokensState(tokens);
    persistToLocal(themeId, tokens, userId);
    persistToBackend(themeId, tokens);
  }, [themeId, userId, persistToLocal, persistToBackend]);

  // ── Escoltar USER_PROFILE_LOADED des d'AuthContext (evita api.me() duplicat) ──
  useEffect(() => {
    const handler = (e: Event) => {
      const profile = (e as CustomEvent).detail;
      if (!profile?.id) return;

      const uid = profile.id as string;
      setUserId(uid);

      const prefs = profile.preferences;
      if (!prefs || typeof prefs !== 'object') {
        // No hi ha preferències al backend — intentar carregar del localStorage scopat
        try {
          const savedTid = localStorage.getItem(scopedKey(LOCAL_STORAGE_KEYS.THEME, uid));
          const savedTokens = localStorage.getItem(scopedKey(LOCAL_STORAGE_KEYS.CUSTOM_THEME_TOKENS, uid));
          if (savedTid) setThemeIdState(JSON.parse(savedTid));
          if (savedTokens) setCustomTokensState(JSON.parse(savedTokens));
        } catch { /* ignore parse errors */ }
        return;
      }

      // Restaurar themeId del backend
      if (prefs.themeId && typeof prefs.themeId === 'string') {
        setThemeIdState(prefs.themeId);
        try { localStorage.setItem(LOCAL_STORAGE_KEYS.THEME, JSON.stringify(prefs.themeId)); } catch {}
        try { localStorage.setItem(scopedKey(LOCAL_STORAGE_KEYS.THEME, uid), JSON.stringify(prefs.themeId)); } catch {}
      }

      // Restaurar customThemeTokens del backend
      if (prefs.customThemeTokens && typeof prefs.customThemeTokens === 'object' && Object.keys(prefs.customThemeTokens).length > 0) {
        const cleaned = sanitizeTokens(prefs.customThemeTokens);
        setCustomTokensState(cleaned);
        try { localStorage.setItem(LOCAL_STORAGE_KEYS.CUSTOM_THEME_TOKENS, JSON.stringify(cleaned)); } catch {}
        try { localStorage.setItem(scopedKey(LOCAL_STORAGE_KEYS.CUSTOM_THEME_TOKENS, uid), JSON.stringify(cleaned)); } catch {}
      }
    };

    window.addEventListener('USER_PROFILE_LOADED', handler);
    return () => window.removeEventListener('USER_PROFILE_LOADED', handler);
  }, []);

  // ── Tema actiu resolt ──
  const theme = useMemo(() => {
    if (themeId === CUSTOM_THEME_ID) {
      const hasTokens = Object.keys(customTokens).length > 0;
      return buildCustomTheme(hasTokens ? customTokens : {});
    }
    return getThemeById(themeId);
  }, [themeId, customTokens]);

  // Aplicar tokens al DOM quan canvia el tema
  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  // Aplicar immediatament al primer render (evita flash)
  useMemo(() => applyThemeToDOM(getThemeById(themeIdRaw)), []);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    themeId,
    setThemeId,
    themes: PRESET_THEMES,
    customTokens,
    setCustomTokens,
    resetCustomTokensFromPreset,
  }), [theme, themeId, setThemeId, customTokens, setCustomTokens, resetCustomTokensFromPreset]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

/** Hook per accedir al tema actiu i canviar-lo */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
