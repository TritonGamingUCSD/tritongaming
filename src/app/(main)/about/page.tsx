import type { Metadata } from 'next';
import { PageHero } from '@/components/ZineBand/ZineBand';
import JumpLinks from '@/components/PublicPages/JumpLinks';
import OurStoryBody from '@/components/PublicPages/OurStoryBody';
import TeamBody from '@/components/PublicPages/TeamBody';
import { getContentBlock } from '@/lib/site/content';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'About',
  description: 'Who Triton Gaming is: our story, and the officers and division heads behind the club.',
  alternates: { canonical: '/about' },
  openGraph: { title: 'About Triton Gaming', description: 'Our story and the people behind the club.', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'About Triton Gaming', description: 'Our story and the people behind the club.' },
};

// Our Story and the Team on one page. (Each keeps its own content and section order in Site Content.)
export default async function AboutPage() {
  const content = (await getContentBlock('page.about-us').catch(() => ({}))) as Record<string, unknown>;
  return (
    <>
      <PageHero
        label={(content.hero_label as string) || 'Who we are'}
        title={(content.hero_title as string) || 'About Triton Gaming'}
        sub={(content.hero_sub as string) || 'Gaming Org at UC San Diego'}
      />
      <JumpLinks
        links={[
          { href: '#story', label: 'Our Story' },
          { href: '#team', label: 'The Team' },
        ]}
      />
      <section id="story" aria-label="Our story">
        <OurStoryBody hero={false} />
      </section>
      <section id="team" aria-label="The team">
        <TeamBody hero={false} />
      </section>
    </>
  );
}
