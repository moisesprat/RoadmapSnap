import { DEFAULT_VIEW_STATE, resetViewState } from '@roadmapsnap/core';

function readStoredTheme() {
  let t = localStorage.getItem('roadmapsnap-theme') || 'light';
  if (t === 'dsm-firmenich') {
    t = 'evergreen';
    try {
      localStorage.setItem('roadmapsnap-theme', t);
    } catch {
      /* ignore */
    }
  }
  return t;
}

const AppState = (() => {
  // The view defaults live in packages/core/src/viewState.js; structuredClone gives this store its own
  // (unfrozen) nested objects. Theme and the original timeline bounds are Lite-only.
  const DEFAULT_STATE = {
    ...structuredClone(DEFAULT_VIEW_STATE),
    theme: readStoredTheme(),
    timelineStart: null,
    timelineEnd: null,
  };
  let _state = { ...DEFAULT_STATE };
  let _prevState = null;
  const _listeners = new Set();

  return {
    get() { return _state; },
    set(patch) {
      _prevState = _state;
      _state = { ..._state, ...patch };
      _listeners.forEach(fn => fn(_state, _prevState));
    },
    reset() {
      _prevState = _state;
      _state = { ...resetViewState(_state), timelineStart: null, timelineEnd: null };
      _listeners.forEach(fn => fn(_state, _prevState));
    },
    subscribe(fn) { _listeners.add(fn); return () => _listeners.delete(fn); },
  };
})();

window.AppState = AppState;

export default AppState;
