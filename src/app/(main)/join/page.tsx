import type { Metadata } from 'next';
import { PageHero } from '@/components/ZineBand/ZineBand';
import JumpLinks from '@/components/PublicPages/JumpLinks';
import GetInvolvedBody from '@/components/PublicPages/GetInvolvedBody';
import MembershipBody from '@/components/PublicPages/MembershipBody';
import { getContentBlock } from '@/lib/site/content';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Join',
  description: 'Join Triton Gaming: ways to get involved, apply to be an officer, and get the membership card with partner discounts.',
  alternates: { canonical: '/join' },
  openGraph: { title: 'Join Triton Gaming', description: 'Ways to get involved and the membership card.', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'Join Triton Gaming', description: 'Ways to get involved and the membership card.' },
};

// Getting Involved and Membership on one page: how to take part, then the card. (Each keeps its own content and section order in Site Content.)
export default async function JoinPage() {
  const content = (await getContentBlock('page.join').catch(() => ({}))) as Record<string, unknown>;
  return (
    <>
      <PageHero
        label={(content.hero_label as string) || 'Join the club'}
        title={(content.hero_title as string) || 'Join Triton Gaming'}
        sub={(content.hero_sub as string) || 'Find your place, then get the card.'}
      />
      <JumpLinks
        links={[
          { href: '#get-involved', label: 'Get Involved' },
          { href: '#membership', label: 'Membership Card' },
        ]}
      />
      <section id="get-involved" aria-label="Get involved">
        <GetInvolvedBody hero={false} />
      </section>
      <section id="membership" aria-label="Membership card">
        <MembershipBody hero={false} />
      </section>
    </>
  );
}
