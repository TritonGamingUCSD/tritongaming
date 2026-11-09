import type { Metadata } from 'next';
import TeamBody from '@/components/PublicPages/TeamBody';

// Served from the CDN cache and refreshed in the background (the content comes from the cached fetchers in lib/, revalidated on save).
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Team',
  description: "Meet Triton Gaming's executive board, leads, and officers.",
  alternates: { canonical: '/team' },
  openGraph: {
    title: 'Team',
    description: "Meet Triton Gaming's executive board, leads, and officers.",
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Team',
    description: "Meet Triton Gaming's executive board, leads, and officers.",
  },
};

export default function Page() {
  return <TeamBody />;
}
