// Slugs that already mean something on this site — a short link may never shadow them.
export const RESERVED_SLUGS = new Set([
  'portal', 'login', 'auth', 'api', 'team', 'events', 'divisions', 'media', 'sponsors', 'membership', 'get-involved',
  'our-story', 'about', 'robots.txt', 'sitemap.xml', 'manifest.webmanifest', 'icon', 'apple-icon', 'opengraph-image',
  'favicon.ico', 'admin', 'static', 'public', 'images', 'logos', 'bytes', 'videos',
]);

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,47}$/;

export function validateSlug(raw: string): string | null {
  const slug = raw.trim().toLowerCase().replace(/^\/+/, '');
  if (!SLUG_RE.test(slug)) return null;
  if (RESERVED_SLUGS.has(slug) || slug.startsWith('_')) return null;
  return slug;
}

// Full http(s) URL, or a path inside this site ("/events/tgex-2026").
export function validateDestination(raw: string): string | null {
  const d = raw.trim();
  if (d.startsWith('/') && !d.startsWith('//')) return d.length <= 2000 ? d : null;
  try {
    const u = new URL(d);
    return (u.protocol === 'https:' || u.protocol === 'http:') && d.length <= 2000 ? u.toString() : null;
  } catch {
    return null;
  }
}
