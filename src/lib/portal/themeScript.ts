// The portal's light/dark choice, shared by the portal and sign-in layouts and the switch in the account menu. Three choices: Light, Dark, or System (follow the device, the default,
// which is saved as nothing). A saved Light or Dark (this browser's storage, or the cookie if storage is cleared) wins and stays put.
export const THEME_KEY = 'tg_portal_theme';
const ONE_YEAR = 60 * 60 * 24 * 365;

// The inline form, for the first paint of a full page load (no flash). Only the root layout renders it: React never runs a <script> that is rendered during
// in-app navigation (and warns about it), so a component must not render one.
const THEME_BODY = `try{var K='${THEME_KEY}',t=null;try{t=localStorage.getItem(K)}catch(e){}if(t!=='light'&&t!=='dark'){var m=document.cookie.match(/(?:^|; )${THEME_KEY}=(light|dark)/);t=m?m[1]:null}var saved=t;if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-pp-theme',t);if(saved){try{localStorage.setItem(K,t)}catch(e){}document.cookie=K+'='+t+';path=/;max-age=${ONE_YEAR};samesite=lax'}}catch(e){}`;

export type ThemeChoice = 'light' | 'dark' | 'system';

export function saveTheme(mode: 'light' | 'dark') {
  document.documentElement.setAttribute('data-pp-theme', mode);
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* ignore */
  }
  document.cookie = `${THEME_KEY}=${mode};path=/;max-age=${ONE_YEAR};samesite=lax`;
}

// Rendered once by the root layout, in <head>. On the portal's pages (portal, sign-in) it marks the page as portal, so even the opening loading screen
// takes the portal's look, and settles the saved theme. Everywhere else (the public site) it does nothing and stores nothing.
export const ROOT_THEME_SCRIPT = `(function(){if(/^\\/(portal|login|auth)(\\/|$)/.test(location.pathname)){document.documentElement.setAttribute('data-area','portal');${THEME_BODY}}})()`;

// The same thing for in-app navigation into the portal (where the inline script above does not run again).
export function applyPortalTheme() {
  document.documentElement.setAttribute('data-area', 'portal');
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch {
    /* ignore */
  }
  if (saved !== 'light' && saved !== 'dark') {
    const m = document.cookie.match(new RegExp(`(?:^|; )${THEME_KEY}=(light|dark)`));
    saved = m ? m[1] : null;
  }
  if (saved === 'light' || saved === 'dark') saveTheme(saved);
  else document.documentElement.setAttribute('data-pp-theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

/** What the person chose: Light, Dark, or System (nothing saved). */
export function getThemeChoice(): ThemeChoice {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch {
    /* ignore */
  }
  if (saved !== 'light' && saved !== 'dark') {
    const m = document.cookie.match(new RegExp(`(?:^|; )${THEME_KEY}=(light|dark)`));
    saved = m ? m[1] : null;
  }
  return saved === 'light' || saved === 'dark' ? saved : 'system';
}

/** Applies a choice: Light and Dark are saved; System forgets any saved choice and follows the device. */
export function setThemeChoice(choice: ThemeChoice) {
  if (choice !== 'system') return saveTheme(choice);
  try {
    localStorage.removeItem(THEME_KEY);
  } catch {
    /* ignore */
  }
  document.cookie = `${THEME_KEY}=;path=/;max-age=0;samesite=lax`;
  document.documentElement.setAttribute('data-pp-theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
