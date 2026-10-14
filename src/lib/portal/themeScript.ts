// The portal's light/dark choice, shared by the portal and sign-in layouts and the toggle. It is settled once and then stays put: a saved choice (this
// browser's storage, or the cookie if storage is cleared) wins; with none, the device's setting at the first visit is taken and saved. After that
// nothing changes it but the toggle, so the theme never flips between loads or halfway through a visit when the device switches to night mode.
export const THEME_KEY = 'tg_portal_theme';
const ONE_YEAR = 60 * 60 * 24 * 365;

// The inline form, for the first paint of a full page load (no flash). Only the root layout renders it: React never runs a <script> that is rendered during
// in-app navigation (and warns about it), so a component must not render one.
const THEME_BODY = `try{var K='${THEME_KEY}',t=null;try{t=localStorage.getItem(K)}catch(e){}if(t!=='light'&&t!=='dark'){var m=document.cookie.match(/(?:^|; )${THEME_KEY}=(light|dark)/);t=m?m[1]:null}if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-pp-theme',t);try{localStorage.setItem(K,t)}catch(e){}document.cookie=K+'='+t+';path=/;max-age=${ONE_YEAR};samesite=lax'}catch(e){}`;

export function saveTheme(mode: 'light' | 'dark') {
  document.documentElement.setAttribute('data-pp-theme', mode);
  try { localStorage.setItem(THEME_KEY, mode); } catch { /* ignore */ }
  document.cookie = `${THEME_KEY}=${mode};path=/;max-age=${ONE_YEAR};samesite=lax`;
}

// Rendered once by the root layout, in <head>. On the portal's pages (portal, sign-in) it marks the page as portal, so even the opening loading screen
// takes the portal's look, and settles the saved theme. Everywhere else (the public site) it does nothing and stores nothing.
export const ROOT_THEME_SCRIPT = `(function(){if(/^\\/(portal|login|auth)(\\/|$)/.test(location.pathname)){document.documentElement.setAttribute('data-area','portal');${THEME_BODY}}})()`;

// The same thing for in-app navigation into the portal (where the inline script above does not run again).
export function applyPortalTheme() {
  document.documentElement.setAttribute('data-area', 'portal');
  let saved: string | null = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch { /* ignore */ }
  if (saved !== 'light' && saved !== 'dark') { const m = document.cookie.match(new RegExp(`(?:^|; )${THEME_KEY}=(light|dark)`)); saved = m ? m[1] : null; }
  saveTheme(saved === 'light' || saved === 'dark' ? saved : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
