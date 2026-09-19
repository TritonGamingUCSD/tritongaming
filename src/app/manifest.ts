import type { MetadataRoute } from 'next';

// Next's App Router metadata-route convention — serving this file at
// src/app/manifest.ts auto-generates /manifest.webmanifest and links it from
// every page's <head>, no manual <link rel="manifest"> needed. Reuses the
// existing 500x500 app icon (src/app/icon.png, already used for the
// browser-tab favicon) at the two sizes most installers actually look for,
// rather than requiring new artwork just for this.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Triton Gaming',
    short_name: 'Triton Gaming',
    description: "UC San Diego's collegiate gaming organization",
    start_url: '/portal',
    display: 'standalone',
    background_color: '#011941',
    theme_color: '#011941',
    icons: [
      { src: '/icon.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
    // Long-press (Android) / right-click (desktop PWA) jump list — "My
    // Tickets" is the one flow someone installing this to their home screen
    // most wants a one-tap shortcut into, since it's what they'd pull up at
    // the door.
    shortcuts: [
      {
        name: 'My Tickets',
        url: '/portal/tickets',
        icons: [{ src: '/icon.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
