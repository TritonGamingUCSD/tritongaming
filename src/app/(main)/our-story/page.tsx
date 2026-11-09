import type { Metadata } from 'next';
import OurStoryBody from '@/components/PublicPages/OurStoryBody';

// Served from the CDN cache and refreshed in the background (the content comes from the cached fetchers in lib/, revalidated on save).
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Our Story',
  description: 'What Triton Gaming is about — our community, events, and the teams behind them.',
  alternates: { canonical: '/our-story' },
  openGraph: {
    title: 'Our Story',
    description: 'What Triton Gaming is about — our community, events, and the teams behind them.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Our Story',
    description: 'What Triton Gaming is about — our community, events, and the teams behind them.',
  },
};

export default function Page() {
  return <OurStoryBody />;
}
