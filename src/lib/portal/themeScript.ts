// The portal's light/dark choice, shared by the portal and sign-in layouts and the toggle. It is settled once and then stays put: a saved choice (this
// browser's storage, or the cookie if storage is cleared) wins; with none, the device's setting at the first visit is taken and saved. After that
// nothing changes it but the toggle, so the theme never flips between loads or halfway through a visit when the device switches to night mode.
export const THEME_KEY = 'tg_portal_theme';
const ONE_YEAR = 60 * 60 * 24 * 365;

// Runs inline before first paint (no flash).
export const THEME_SCRIPT = `try{var K='${THEME_KEY}',t=null;try{t=localStorage.getItem(K)}catch(e){}if(t!=='light'&&t!=='dark'){var m=document.cookie.match(/(?:^|; )${THEME_KEY}=(light|dark)/);t=m?m[1]:null}if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-pp-theme',t);try{localStorage.setItem(K,t)}catch(e){}document.cookie=K+'='+t+';path=/;max-age=${ONE_YEAR};samesite=lax'}catch(e){}`;

export function saveTheme(mode: 'light' | 'dark') {
  document.documentElement.setAttribute('data-pp-theme', mode);
  try { localStorage.setItem(THEME_KEY, mode); } catch { /* ignore */ }
  document.cookie = `${THEME_KEY}=${mode};path=/;max-age=${ONE_YEAR};samesite=lax`;
}
