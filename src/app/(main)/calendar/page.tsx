import type { Metadata } from 'next';
import { PageHero } from '@/components/ZineBand/ZineBand';
import EventsTabs from '@/components/PublicPages/EventsTabs';
import { getDivisions } from '@/lib/members/divisions';
import PublicCalendar from './PublicCalendar';

export const revalidate = 300;
export const metadata: Metadata = {
  title: 'Calendar',
  description: 'Every public Triton Gaming event, tournament and stream, with the quarter dates. Subscribe in Google, Apple or Outlook.',
  alternates: { canonical: '/calendar' },
};

export default async function CalendarPage() {
  const divisions = await getDivisions();
  return (
    <main>
      <PageHero label="What's On" title="Calendar" sub="Events, tournaments and streams open to everyone, with the quarter dates." />
      <EventsTabs active="calendar" />
      <PublicCalendar divisions={divisions.map((d) => ({ id: d.id, name: d.name, slug: d.slug, accent: d.accent ?? '#7db4ea' }))} />
    </main>
  );
}
