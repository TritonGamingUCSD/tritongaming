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
      { source: '/portal/divisions', destination: '/portal?section=site-content&tab=divisions', permanent: false },
      ...hubSections.map((id) => ({ source: `/portal/${id}`, destination: `/portal?section=${id}`, permanent: false })),
    ];
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
