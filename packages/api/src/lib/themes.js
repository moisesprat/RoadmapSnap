/**
 * The eight theme names accepted for users.preferences.theme, in Lite's select order.
 * Mirrors THEMES in @roadmapsnap/core: the API image does not ship packages/core, so the list is
 * copied here and tests/guards/themes.test.js keeps the two (and Lite's filter bar) equal.
 */

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
