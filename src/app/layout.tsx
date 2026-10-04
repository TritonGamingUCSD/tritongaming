import ConfirmHost from '@/components/HoldToConfirm/ConfirmHost';
import ToastHost from '@/components/SaveToast/ToastHost';
import type { Metadata, Viewport } from 'next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';
import { Gochi_Hand } from 'next/font/google';
import './globals.css';

// Stand-in for the handwriting font that will be made from a member's handwriting. Swap the font file and keep the --font-hand variable.
const hand = Gochi_Hand({ weight: '400', subsets: ['latin'], variable: '--font-hand', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Triton Gaming',
    template: '%s | Triton Gaming',
  },
  description:
    'Triton Gaming: Gaming Org at UC San Diego. Fostering community, creativity, and industry connections.',
  keywords: ['Triton Gaming', 'UCSD', 'UC San Diego', 'gaming', 'collegiate gaming'],
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png', type: 'image/png' },
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
  // iOS Safari's "Add to Home Screen" doesn't fully honor the web manifest
  // (see manifest.ts) — these are what actually make an installed icon open
  // full-screen (no browser chrome) with the right title, on iOS specifically.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Triton Gaming',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#011941',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={hand.variable}>
      <body>
        {children}
        <ToastHost />
        <ConfirmHost />
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
