import Hero from '@/components/Hero/Hero';
import LandingAbout from '@/components/LandingAbout/LandingAbout';
import LandingStatistics from '@/components/LandingStatistics/LandingStatistics';
import LandingEvents from '@/components/LandingEvents/LandingEvents';
import LandingSponsors from '@/components/LandingSponsors/LandingSponsors';
import LandingDivisions from '@/components/LandingDivisions/LandingDivisions';
import LandingRecruitment from '@/components/LandingRecruitment/LandingRecruitment';
import { getContentBlocks } from '@/lib/content';
import eventsData from '@/data/events.json';
import type { Event } from '@/types';
import type { StatInput } from '@/components/LandingStatistics/LandingStatistics';

export default async function HomePage() {
  const now = new Date();
  const upcomingEvents = (eventsData as Event[])
    .filter((e) => new Date(e.start_date) >= now)
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  const content = await getContentBlocks(['homepage.hero', 'homepage.about', 'homepage.stats']);

  const heroContent = content['homepage.hero'] ?? {};
  const aboutContent = content['homepage.about'] ?? {};
  const statsContent = content['homepage.stats'] ?? {};
  const statsItems = (statsContent.items as StatInput[] | undefined) ?? undefined;

  return (
    <>
      <Hero content={heroContent as Parameters<typeof Hero>[0]['content']} />
      <LandingAbout content={aboutContent as Parameters<typeof LandingAbout>[0]['content']} />
      <LandingStatistics stats={statsItems} />
      <LandingEvents initialEvents={upcomingEvents} />
      <LandingSponsors />
      <LandingDivisions />
      <LandingRecruitment />
    </>
  );
}
