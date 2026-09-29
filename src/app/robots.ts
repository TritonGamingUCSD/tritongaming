import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

// (portal) and (auth) route groups don't appear in the URL — their pages
// are real public paths (/portal/*, /login, /auth/*) with no metadata-level
// noindex of their own (see individual page fixes), so this is the actual
// enforcement point keeping the member portal and auth flow out of search
// results. /api is disallowed too — nothing there is a page worth indexing.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/portal', '/portal/', '/login', '/auth/', '/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
