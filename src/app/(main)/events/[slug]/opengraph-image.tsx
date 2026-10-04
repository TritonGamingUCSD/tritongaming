import { ImageResponse } from 'next/og';
import { getEventBySlugOrId } from '@/lib/events';
import { formatEventDateRange, formatEventTimeRange } from '@/lib/timezone';
import { OG_SIZE, ogFonts, ogImage, ogLogo } from '@/lib/ogCard';
import { EventCard } from '@/lib/ogCards';

// The card Discord and others show for an event link: the flyer on a taped paper print (kept whole, portrait or landscape) next to the
// event's title, date and place. A themed event uses its own colours. The design lives in lib/ogCards.tsx.
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Triton Gaming event';

export default async function EventOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [event, fonts, logo] = await Promise.all([getEventBySlugOrId(slug), ogFonts(), ogLogo()]);
  const c = event?.theme?.colors ?? {};
  const poster = await ogImage(event?.theme?.key_art_url || event?.flyer_url);
  return new ImageResponse(
    (
      <EventCard
        p={{
          title: event?.full_name ?? 'Triton Gaming event',
          past: event ? new Date(event.end_date || event.start_date).getTime() < Date.now() : false,
          poster,
          bg: c.bg ?? '#011941',
          accent: c.accent ?? '#ffc72c',
          text: c.text ?? '#f2f1f0',
          date: event ? formatEventDateRange(event.start_date, event.end_date || null, { weekday: true }) : '',
          time: event ? formatEventTimeRange(event.start_date, event.end_date || null) : '',
          location: event?.location ?? '',
          logo,
        }}
      />
    ),
    { ...OG_SIZE, fonts }
  );
}
