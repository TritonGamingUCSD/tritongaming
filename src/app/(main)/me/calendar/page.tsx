import { getDivisions } from '@/lib/members/divisions';
import PublicCalendar from '../../calendar/PublicCalendar';

export const dynamic = 'force-dynamic';

// Everything the person can see or is part of, on the main site. (The same calendar as the portal's, with the view, date and filters in the address.)
export default async function MyCalendarPage() {
  const divisions = await getDivisions();
  return <PublicCalendar personal divisions={divisions.map((d) => ({ id: d.id, name: d.name, slug: d.slug, accent: d.accent ?? '#7db4ea' }))} />;
}
