import type { Metadata } from 'next';
import HubHero from '@/components/PublicPages/HubHero';
import PageTabs from '@/components/PublicPages/PageTabs';
import ClubBlocks from '@/components/ClubBlocks/ClubBlocks';
import TeamBody from '@/components/PublicPages/TeamBody';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'The Team',
  description: 'Meet the officers and division heads behind Triton Gaming.',
  alternates: { canonical: '/about/team' },
  openGraph: { title: 'The Team', description: 'Meet the officers and division heads behind Triton Gaming.', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'The Team', description: 'Meet the officers and division heads behind Triton Gaming.' },
};

export default function Page() {
  return (
    <>
      <HubHero block="page.about-us" label="Who we are" title="About" sub="Gaming Org at UC San Diego" />
      <PageTabs
        label="About pages"
        active="/about/team"
        tabs={[
          { href: '/about', label: 'Our Story' },
          { href: '/about/team', label: 'The Team' },
        ]}
      />
      <ClubBlocks page="team" slot="top" />
      <TeamBody hero={false} />
      <ClubBlocks page="team" slot="bottom" />
    </>
  );
}
