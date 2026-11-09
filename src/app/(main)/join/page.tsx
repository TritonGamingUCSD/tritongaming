import type { Metadata } from 'next';
import HubHero from '@/components/PublicPages/HubHero';
import PageTabs from '@/components/PublicPages/PageTabs';
import ClubBlocks from '@/components/ClubBlocks/ClubBlocks';
import GetInvolvedBody from '@/components/PublicPages/GetInvolvedBody';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Join',
  description: 'Ways to get involved with Triton Gaming, and how to apply to be an officer.',
  alternates: { canonical: '/join' },
  openGraph: { title: 'Join', description: 'Ways to get involved with Triton Gaming, and how to apply to be an officer.', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'Join', description: 'Ways to get involved with Triton Gaming, and how to apply to be an officer.' },
};

export default function Page() {
  return (
    <>
      <HubHero block="page.join" label="Join the club" title="Join" sub="Find your place, then get the card." />
      <PageTabs
        label="Join pages"
        active="/join"
        tabs={[
          { href: '/join', label: 'Get Involved' },
          { href: '/join/membership', label: 'Membership Card' },
        ]}
      />
      <ClubBlocks page="join" slot="top" />
      <GetInvolvedBody hero={false} />
      <ClubBlocks page="join" slot="bottom" />
    </>
  );
}
