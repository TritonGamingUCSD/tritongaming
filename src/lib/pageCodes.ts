// Page codes: six digits that open a page of this site from the portal's code box. Pure helpers, shared by the routes and the manager screen.

/** A destination as a path on this site ("/events/tgex-2026"): a path, or this site's own full address (turned into its path). Never another site, never the API. null = not allowed. */
export function cleanDestination(raw: unknown, site = 'https://tritongaming.org'): string | null {
  let d = typeof raw === 'string' ? raw.trim() : '';
  if (!d || d.length > 2000) return null;
  if (/^https?:\/\//i.test(d)) {
    try {
      const u = new URL(d);
      const ours = [site, 'https://tritongaming.org', 'https://www.tritongaming.org', 'https://tritongaming.vercel.app', 'http://localhost:3000'].map((x) => new URL(x).host);
      if (!ours.includes(u.host)) return null;
      d = `${u.pathname}${u.search}${u.hash}`;
    } catch {
      return null;
    }
  }
  if (!d.startsWith('/') || d.startsWith('//') || /[\s"'<>\\]/.test(d)) return null;
  if (/^\/(api|auth)(\/|$)/i.test(d)) return null;
  return d;
}

export const PAGE_CODE = /^[0-9]{6}$/;

/** A random six-digit code. */
export function randomCode(rng: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += Math.floor(rng() * 10);
  return s;
}

/** Is a page code live right now (switched on and not past its end date)? */
export const codeIsLive = (c: { is_active: boolean; expires_at: string | null }, now = Date.now()): boolean => c.is_active && (!c.expires_at || Date.parse(c.expires_at) > now);
