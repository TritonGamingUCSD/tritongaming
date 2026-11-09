import type { Metadata } from 'next';
import MembershipBody from '@/components/PublicPages/MembershipBody';

// Served from the CDN cache and refreshed in the background (the content comes from the cached fetchers in lib/, revalidated on save).
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Membership',
  description: 'Get the Triton Gaming membership card and save at local partner spots all year long.',
  alternates: { canonical: '/membership' },
  openGraph: {
    title: 'Membership',
    description: 'Get the Triton Gaming membership card and save at local partner spots all year long.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Membership',
    description: 'Get the Triton Gaming membership card and save at local partner spots all year long.',
  },
};

export default function Page() {
  return <MembershipBody />;
}
