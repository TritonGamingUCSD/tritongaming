import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // A second copy of the dev server can run beside the first (for testing) with NEXT_DIST_DIR=.next-qa; normally this is just .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // /portal/<section>/<tab>/<subtab> is the portal's address. On a fresh load it is served by the hub page, which still
  // reads section/tab/subtab as query params. Real pages (/portal/events/new, /portal/events/<id>, /portal/admin/stats…)
  // are matched first, since these are fallback rewrites.
  async rewrites() {
    const sections = ['calendar', 'tickets', 'points', 'activity', 'profile', 'events', 'checkin', 'members', 'meetings', 'internal-events', 'keys', 'strikes', 'quarters', 'divisions', 'division-members', 'docs', 'qrcode', 'albums', 'help', 'admin', 'site-content', 'shifts'].join('|');
    return {
      // Events and Divisions also have /portal/<section>/<id> record pages; their tab names are matched first so a tab is never mistaken for an id.
      beforeFiles: [
        { source: '/portal/events/:tab(list|analytics)', destination: '/portal?section=events&tab=:tab' },
        { source: '/portal/divisions/:tab(all|my-division)', destination: '/portal?section=divisions&tab=:tab' },
      ],
      fallback: [
        { source: `/portal/:section(${sections})`, destination: '/portal?section=:section' },
        { source: `/portal/:section(${sections})/:tab`, destination: '/portal?section=:section&tab=:tab' },
        { source: `/portal/:section(${sections})/:tab/:subtab`, destination: '/portal?section=:section&tab=:tab&subtab=:subtab' },
      ],
    };
  },
  // The push service worker must always be fetched fresh and may only load its own code.
  async headers() {
    return [{
      // The hero videos never change under the same name (a new version gets a new file name), so browsers may keep them for a year.
      source: '/videos/:file*',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    }, {
      source: '/sw.js',
      headers: [
        { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
      ],
    }];
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
