import type { Metadata } from 'next';
import HubHero from '@/components/PublicPages/HubHero';
import PageTabs from '@/components/PublicPages/PageTabs';
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
      <PageTabs
        label="Join pages"
        active="/join/membership"
        tabs={[
          { href: '/join', label: 'Get Involved' },
          { href: '/join/membership', label: 'Membership Card' },
        ]}
      />
      <ClubBlocks page="membership" slot="top" />
      <MembershipBody hero={false} />
      <ClubBlocks page="membership" slot="bottom" />
    </>
  );
}
