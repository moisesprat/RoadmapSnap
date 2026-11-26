// Node harness for Lite: loads the browser modules with window === globalThis and minimal
// localStorage/document stubs, then renders the full page HTML through renderPageHTML.
// js/app.js is imported too: with the stub document its top level only sets the theme attribute and
// registers a DOMContentLoaded listener, and importing it defines the same window globals as the browser
// (escapeHtmlAttr, infoIconSVG, riskIconSVG) without duplicating them here.

let loaded = null;
let currentTheme = 'light';

function installStubs() {
  globalThis.window = globalThis;
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
  };
  globalThis.document = {
    documentElement: {
      getAttribute: (name) => (name === 'data-theme' ? currentTheme : null),
      setAttribute: () => {},
    },
    addEventListener: () => {},
  };
}

export async function loadLite() {
  if (loaded) return loaded;
  installStubs();
  const { default: AppState } = await import('../../js/state/appState.js');
  await import('../../js/app.js');
  const { renderPageHTML, renderFooter } = await import('../../js/ui/page.js');
  loaded = { AppState, renderPageHTML, renderFooter };
  return loaded;
}

export async function renderLiteHTML(config, statePatch = {}, { theme = 'light' } = {}) {
  const { AppState, renderPageHTML } = await loadLite();
  globalThis.CONFIG = structuredClone(config);
  currentTheme = theme;
  AppState.reset();
  AppState.set({ ...statePatch, theme });
  return renderPageHTML(AppState.get());
}
