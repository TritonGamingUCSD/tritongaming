import type { Metadata } from 'next';
import HubHero from '@/components/PublicPages/HubHero';
import ClubBlocks from '@/components/ClubBlocks/ClubBlocks';
import MembershipBody from '@/components/PublicPages/MembershipBody';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Membership Card',
  description: 'The Triton Gaming membership card: the price, how to get it, and partner discounts.',
  alternates: { canonical: '/join/membership' },
  openGraph: { title: 'Membership Card', description: 'The Triton Gaming membership card: the price, how to get it, and partner discounts.', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'Membership Card', description: 'The Triton Gaming membership card: the price, how to get it, and partner discounts.' },
};

export default function Page() {
  return (
    <>
      <HubHero block="page.join" label="Join the club" title="Join" sub="Find your place, then get the card." />
      <ClubBlocks page="membership" slot="top" />
      <MembershipBody hero={false} />
      <ClubBlocks page="membership" slot="bottom" />
    </>
  );
}
