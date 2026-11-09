import type { Metadata } from 'next';
import GetInvolvedBody from '@/components/PublicPages/GetInvolvedBody';

// Served from the CDN cache and refreshed in the background (the content comes from the cached fetchers in lib/, revalidated on save).
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Get Involved',
  description: 'Join Triton Gaming — connect on Discord, follow us on Instagram, or become an officer.',
  alternates: { canonical: '/get-involved' },
  openGraph: {
    title: 'Get Involved',
    description: 'Join Triton Gaming — connect on Discord, follow us on Instagram, or become an officer.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Get Involved',
    description: 'Join Triton Gaming — connect on Discord, follow us on Instagram, or become an officer.',
  },
};

export default function Page() {
  return <GetInvolvedBody />;
}
