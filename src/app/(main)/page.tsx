import type { Metadata } from 'next';
import Hero from '@/components/Hero/Hero';
import LandingAbout from '@/components/LandingAbout/LandingAbout';
import LandingStatistics from '@/components/LandingStatistics/LandingStatistics';
import LandingEvents from '@/components/LandingEvents/LandingEvents';
import LandingSponsors from '@/components/LandingSponsors/LandingSponsors';
import LandingRecruitment from '@/components/LandingRecruitment/LandingRecruitment';
import { getContentBlocks } from '@/lib/content';
import { getUpcomingEvents } from '@/lib/events';
import type { StatInput } from '@/components/LandingStatistics/LandingStatistics';

export const dynamic = 'force-dynamic';

// Title/description are left unset here — they inherit the root layout's
// defaults, which are already written for the home page specifically (not
// generic filler). Canonical is the one thing actually worth pinning: this
// page is also technically reachable via odd query strings, and a
// self-referencing canonical is the standard defense against that being
// read as duplicate content.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

// Organization schema — the one JSON-LD block that belongs on the home
// page specifically (not per-page), so search engines can attribute
// events/social profiles/etc. to a single canonical entity instead of
// guessing from prose.
const ORGANIZATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Triton Gaming',
  alternateName: "Triton Gaming at UC San Diego",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  logo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/logos/tg_logo.png`,
  sameAs: [
    'https://discord.gg/tritongaming',
  ],
};

export default async function HomePage() {
  const [upcomingEvents, content] = await Promise.all([
    getUpcomingEvents(6),
    getContentBlocks(['homepage.hero', 'homepage.about', 'homepage.stats', 'homepage.events', 'homepage.recruitment']),
  ]);

  const heroContent        = content['homepage.hero']        ?? {};
  const aboutContent       = content['homepage.about']       ?? {};
  const statsContent       = content['homepage.stats']       ?? {};
  const eventsContent      = content['homepage.events']      ?? {};
  const recruitmentContent = content['homepage.recruitment'] ?? {};
  const statsItems         = (statsContent.items as StatInput[] | undefined) ?? undefined;

  return (
    <>
      {/* eslint-disable-next-line react/no-danger -- static, hand-written object, not user input */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }} />
      <Hero content={heroContent as Parameters<typeof Hero>[0]['content']} />
      <LandingStatistics stats={statsItems} />
      <LandingAbout content={aboutContent as Parameters<typeof LandingAbout>[0]['content']} />
      <LandingEvents initialEvents={upcomingEvents} content={eventsContent} />
      <LandingSponsors />
      <LandingRecruitment content={recruitmentContent as Parameters<typeof LandingRecruitment>[0]['content']} />
    </>
  );
}
