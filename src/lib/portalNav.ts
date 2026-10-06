import { mergedPortalParams, parsePortalPath, portalHref } from '@/lib/portalPath';

// Moves around inside the portal without asking the server for the whole page again. The portal already holds every
// section's data, so opening another section (from a notification, a search result or a link) only needs the address to
// change; that used to be a full server round trip with nothing on screen to say it was working.
// Returns false when the target isn't a portal view (or this isn't the portal), so the caller falls back to a normal link.
export function navigatePortal(href: string, e?: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; button?: number }): boolean {
  if (typeof window === 'undefined') return false;
  if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (e.button ?? 0) !== 0)) return false;   // let "open in new tab" work
  let url: URL;
  try { url = new URL(href, window.location.origin); } catch { return false; }
  if (url.origin !== window.location.origin) return false;
  const here = window.location.pathname;
  const onPortal = here === '/portal' || here.startsWith('/portal/');
  const toPortal = url.pathname === '/portal' || parsePortalPath(url.pathname) !== null;
  if (!onPortal || !toPortal) return false;
  const target = portalHref(mergedPortalParams(url.pathname, url.search));
  if (target !== `${here}${window.location.search}`) { window.history.pushState(window.history.state, '', target); (window as unknown as { __tgPush?: number }).__tgPush = ((window as unknown as { __tgPush?: number }).__tgPush ?? 0) + 1; }
  window.dispatchEvent(new Event('tg:portal-nav'));
  return true;
}
