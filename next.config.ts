import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
      source: '/sw.js',
      headers: [
        { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
      ],
    }];
  },
  images: {
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
