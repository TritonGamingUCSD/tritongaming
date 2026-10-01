import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The Team page used to live at /about — keep old links, bookmarks and search
  // results working.
  async redirects() {
    return [{ source: '/about', destination: '/team', permanent: true }];
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
