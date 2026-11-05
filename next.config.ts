import type { NextConfig } from 'next';
import { SECTION_IDS } from './src/lib/portal/sections';
import { RESERVED_SLUGS } from './src/lib/site/shortLinks';

// The addresses of the divisions, read once when the site is built or started (no address, no rewrites, never a failed build).
async function divisionAddresses(): Promise<string[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/divisions?select=slug`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!}` },
    });
    if (!res.ok) return [];
    return ((await res.json()) as { slug: string }[]).map((d) => d.slug).filter((s) => /^[a-z0-9][a-z0-9_-]*$/.test(s) && !RESERVED_SLUGS.has(s));
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  // A second copy of the dev server can run beside the first (for testing) with NEXT_DIST_DIR=.next-qa; normally this is just .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // /portal/<section>/<tab>/<subtab> is the portal's address. On a fresh load it is served by the hub page, which still
  // reads section/tab/subtab as query params. Real pages (/portal/events/new, /portal/events/<id>, /portal/admin/stats…)
  // are matched first, since these are fallback rewrites.
  async rewrites() {
    const sections = SECTION_IDS.join('|'); // every portal section, defined once in src/lib/portal/sections.ts
    // A division's public address: tritongaming.org/<division> (and /events, /team, /gallery under it) shows the pages under /divisions/<division>. These are plain rewrites made when the site is built, so they cost
    // no function run per visit. A division created or renamed since the last build is caught by the short-link route, which sends its address on to /divisions/<division> until the next build.
    const divisionSlugs = await divisionAddresses();
    return {
      // Events and Divisions also have /portal/<section>/<id> record pages; their tab names are matched first so a tab is never mistaken for an id.
      beforeFiles: [
        ...divisionSlugs.flatMap((slug) => [
          { source: `/${slug}`, destination: `/divisions/${slug}` },
          { source: `/${slug}/:page(events|team|gallery)`, destination: `/divisions/${slug}/:page` },
        ]),
        { source: '/portal/events/:tab(list|analytics|emails|check-ins)', destination: '/portal?section=events&tab=:tab' },
        { source: '/portal/divisions/:tab(all|my-division)', destination: '/portal?section=divisions&tab=:tab' },
      ],
      fallback: [
        { source: `/portal/:section(${sections})`, destination: '/portal?section=:section' },
        { source: `/portal/:section(${sections})/:tab`, destination: '/portal?section=:section&tab=:tab' },
        { source: `/portal/:section(${sections})/:tab/:subtab`, destination: '/portal?section=:section&tab=:tab&subtab=:subtab' },
        { source: `/portal/:section(${sections})/:tab/:subtab/:detail`, destination: '/portal?section=:section&tab=:tab&subtab=:subtab&detail=:detail' },
        // A division's pages: /portal/<division address>/<page>. Last, so every real page and section above wins; the address is looked up by the portal (an unknown one says so).
        { source: '/portal/:slug', destination: '/portal?section=division&tab=:slug' },
        { source: '/portal/:slug/:page', destination: '/portal?section=division&tab=:slug&subtab=:page' },
      ],
    };
  },
  // The push service worker must always be fetched fresh and may only load its own code.
  async headers() {
    return [
      {
        // The hero videos never change under the same name (a new version gets a new file name), so browsers may keep them for a year.
        source: '/videos/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  images: {
    // Uploaded pictures get a new address when replaced, so the optimizer can keep its copy for a month instead of asking Supabase again (egress is the free plan's tightest limit).
    minimumCacheTTL: 60 * 60 * 24 * 31,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
