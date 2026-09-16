import Hero from '@/components/Hero/Hero';
import LandingAbout from '@/components/LandingAbout/LandingAbout';
import LandingStatistics from '@/components/LandingStatistics/LandingStatistics';
import LandingEvents from '@/components/LandingEvents/LandingEvents';
import LandingSponsors from '@/components/LandingSponsors/LandingSponsors';
import LandingDivisions from '@/components/LandingDivisions/LandingDivisions';
import LandingRecruitment from '@/components/LandingRecruitment/LandingRecruitment';
import { getContentBlocks } from '@/lib/content';
import { getUpcomingEvents } from '@/lib/events';
import type { StatInput } from '@/components/LandingStatistics/LandingStatistics';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [upcomingEvents, content] = await Promise.all([
    getUpcomingEvents(6),
    getContentBlocks(['homepage.hero', 'homepage.about', 'homepage.stats', 'homepage.recruitment']),
  ]);

  const heroContent        = content['homepage.hero']        ?? {};
  const aboutContent       = content['homepage.about']       ?? {};
  const statsContent       = content['homepage.stats']       ?? {};
  const recruitmentContent = content['homepage.recruitment'] ?? {};
  const statsItems         = (statsContent.items as StatInput[] | undefined) ?? undefined;

  return (
    <>
      <Hero content={heroContent as Parameters<typeof Hero>[0]['content']} />
      <LandingStatistics stats={statsItems} />
      <LandingAbout content={aboutContent as Parameters<typeof LandingAbout>[0]['content']} />
      <LandingEvents initialEvents={upcomingEvents} />
      <LandingDivisions />
      <LandingSponsors />
      <LandingRecruitment content={recruitmentContent as Parameters<typeof LandingRecruitment>[0]['content']} />
    </>
  );
}
