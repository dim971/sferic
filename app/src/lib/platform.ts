export const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

export const IS_PROD = import.meta.env.PROD;

// On macOS production builds, the system menu bar already exposes every
// menu action — the in-app visual menubar is redundant. In dev (any OS)
// and on Windows/Linux production we keep it visible.
export const SHOW_INAPP_MENUBAR = !(IS_PROD && IS_MAC);
