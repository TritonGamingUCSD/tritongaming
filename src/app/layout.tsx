import ConfirmHost from '@/components/HoldToConfirm/ConfirmHost';
import ToastHost from '@/components/SaveToast/ToastHost';
import ClickFeedback from '@/components/ClickFeedback/ClickFeedback';
import ScrollArrows from '@/components/ScrollArrows/ScrollArrows';
import HomeScreenLaunch from '@/components/HomeScreenLaunch/HomeScreenLaunch';
import type { Metadata, Viewport } from 'next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';
import { ROOT_THEME_SCRIPT } from '@/lib/portal/themeScript';
import { APPLE_ICON_DATA_URI } from '@/lib/site/appleIcon';
import './globals.css';


export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Triton Gaming',
    template: '%s | Triton Gaming',
  },
  description:
    'Triton Gaming: Gaming Org at UC San Diego. Fostering community, creativity, and industry connections.',
  keywords: ['Triton Gaming', 'UC San Diego', 'gaming', 'collegiate gaming'],
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png' },
    ],
    apple: [
      { url: APPLE_ICON_DATA_URI, sizes: '180x180', type: 'image/png' },   // embedded, not a file: see lib/site/appleIcon.ts
    ],
  },
  openGraph: {
    siteName: 'Triton Gaming',
    title: 'Triton Gaming',
    description: 'Gaming Org at UC San Diego',
    type: 'website',
    locale: 'en_US',
    // No `images` here on purpose — opengraph-image.tsx (the file-convention
    // route) supplies a properly-sized 1200x630 card automatically, for
    // this page and every nested one that doesn't define its own.
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Triton Gaming',
    description: 'Gaming Org at UC San Diego',
  },
  // "Add to Home Screen" / "Install" from any page of the site is the portal: the manifest (public/portal.webmanifest: name TG Portal, the logo icons, opens /portal) and, for iOS, the standalone
  // flags; a launch from an iPhone icon whose first page is outside the portal is sent to /portal (components/HomeScreenLaunch).
  manifest: '/portal.webmanifest',
  appleWebApp: { capable: true, title: 'TG Portal', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Also the colour of the side bar in a Discord link preview, so it is the brand yellow rather than a navy that disappears into Discord's dark theme.
  themeColor: '#ffc72c',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: ROOT_THEME_SCRIPT }} />
      </head>
      <body>
        {children}
        <ClickFeedback />
        <ScrollArrows />
        <HomeScreenLaunch />
        <ToastHost />
        <ConfirmHost />
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
