import Hero from '@/components/Hero/Hero';
import LandingAbout from '@/components/LandingAbout/LandingAbout';
import LandingStatistics from '@/components/LandingStatistics/LandingStatistics';
import LandingEvents from '@/components/LandingEvents/LandingEvents';
import LandingSponsors from '@/components/LandingSponsors/LandingSponsors';
import LandingDivisions from '@/components/LandingDivisions/LandingDivisions';
import LandingRecruitment from '@/components/LandingRecruitment/LandingRecruitment';
import eventsData from '@/data/events.json';
import type { Event } from '@/types';

export default function HomePage() {
  const now = new Date();
  const upcomingEvents = (eventsData as Event[])
    .filter((e) => new Date(e.start_date) >= now)
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  return (
    <>
      <Hero />
      <LandingAbout />
      <LandingStatistics />
      <LandingEvents initialEvents={upcomingEvents} />
      <LandingSponsors />
      <LandingDivisions />
      <LandingRecruitment />
    </>
  );
}
