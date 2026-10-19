import ConfirmHost from '@/components/HoldToConfirm/ConfirmHost';
import ToastHost from '@/components/SaveToast/ToastHost';
import ClickFeedback from '@/components/ClickFeedback/ClickFeedback';
import ScrollArrows from '@/components/ScrollArrows/ScrollArrows';
import type { Metadata, Viewport } from 'next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';
import { ROOT_THEME_SCRIPT } from '@/lib/portal/themeScript';
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
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
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
  // The site is deliberately not installable as an app: only the portal is (see src/app/(portal)/layout.tsx, which adds the web app manifest and the standalone flags). A public page added to a
  // home screen is just a bookmark with the logo, and opens in the browser.
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
        <ToastHost />
        <ConfirmHost />
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
