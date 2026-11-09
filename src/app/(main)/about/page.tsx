import type { Metadata } from 'next';
import HubHero from '@/components/PublicPages/HubHero';
import PageTabs from '@/components/PublicPages/PageTabs';
import ClubBlocks from '@/components/ClubBlocks/ClubBlocks';
import OurStoryBody from '@/components/PublicPages/OurStoryBody';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'About',
  description: 'Who Triton Gaming is: our story, and the officers and division heads behind the club.',
  alternates: { canonical: '/about' },
  openGraph: { title: 'About', description: 'Who Triton Gaming is: our story, and the officers and division heads behind the club.', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'About', description: 'Who Triton Gaming is: our story, and the officers and division heads behind the club.' },
};

export default function Page() {
  return (
    <>
      <HubHero block="page.about-us" label="Who we are" title="About" sub="Gaming Org at UC San Diego" />
      <PageTabs
        label="About pages"
        active="/about"
        tabs={[
          { href: '/about', label: 'Our Story' },
          { href: '/about/team', label: 'The Team' },
        ]}
      />
      <ClubBlocks page="about" slot="top" />
      <OurStoryBody hero={false} />
      <ClubBlocks page="about" slot="bottom" />
    </>
  );
}
