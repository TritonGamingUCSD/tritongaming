import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The Team page used to live at /about — keep old links, bookmarks and search
  // results working.
  async redirects() {
    // Portal sections used to also exist as standalone pages; the hub
    // (/portal?section=…) is the one home for them. Exact paths only — detail
    // pages like /portal/events/[id] stay. Query strings carry over.
    const hubSections = ['tickets', 'profile', 'activity', 'points', 'battlepass', 'events', 'checkin', 'members', 'docs', 'qrcode', 'albums', 'admin'];
    return [
      { source: '/about', destination: '/team', permanent: true },
      { source: '/portal/admin/content', destination: '/portal?section=site-content', permanent: false },
      { source: '/portal/divisions', destination: '/portal?section=site-content&tab=divisions', permanent: false },
      ...hubSections.map((id) => ({ source: `/portal/${id}`, destination: `/portal?section=${id}`, permanent: false })),
    ];
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
