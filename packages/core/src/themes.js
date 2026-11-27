/**
 * RoadmapSnap core: theme definitions and resolution.
 * Single canonical list of the eight Lite themes, in the order Lite's filter bar renders them.
 * Pure: no DOM, no storage, no clock.
 */

/** @typedef {'light' | 'dark' | 'professional' | 'colorful' | 'blank' | 'monochrome' | 'papallona' | 'evergreen'} ThemeName */

/** @type {readonly ThemeName[]} */
export const THEMES = Object.freeze([
  'light',
  'dark',
  'professional',
  'colorful',
  'blank',
  'monochrome',
  'papallona',
  'evergreen',
]);

/** @type {Readonly<Record<ThemeName, string>>} */
export const THEME_LABELS = Object.freeze({
  light: 'Light',
  dark: 'Dark',
  professional: 'Professional',
  colorful: 'Colorful',
  blank: 'Blank',
  monochrome: 'Monochrome',
  papallona: 'Papallona',
  evergreen: 'Evergreen',
});

/** @type {ThemeName} */
export const DEFAULT_THEME = 'light';

/**
 * Legacy stored values mapped to their current theme (Lite's appState maps dsm-firmenich the same way).
 * @type {Readonly<Record<string, ThemeName>>}
 */
export const LEGACY_THEME_ALIASES = Object.freeze({
  'dsm-firmenich': 'evergreen',
});

/**
 * Resolve any stored or user-supplied value to a valid theme name.
 * Legacy aliases map to their target; empty, non-string and unknown values fall back to the default.
 * @param {unknown} value
 * @returns {ThemeName}
 */
export function normalizeTheme(value) {
  if (typeof value !== 'string') return DEFAULT_THEME;
  if (Object.hasOwn(LEGACY_THEME_ALIASES, value)) return LEGACY_THEME_ALIASES[value];
  return /** @type {readonly string[]} */ (THEMES).includes(value) ? /** @type {ThemeName} */ (value) : DEFAULT_THEME;
}
