import { ImageResponse } from 'next/og';
import { getEventBySlugOrId } from '@/lib/events/events';
import { divisionLogoSrc, getDivisionBySlug } from '@/lib/members/divisions';
import { markdownToDescription } from '@/lib/docs/markdown';
import { formatEventDateRange, formatEventTimeRange } from '@/lib/core/timezone';
import { OG_SIZE, clampDescription, ogFonts, ogImage, ogLogo } from '@/lib/site/ogCard';
import { DivisionCard, EventCard } from '@/lib/site/ogCards';

// A short, stable fingerprint of whatever a card shows. It goes into the card's address (?v=...), so when the poster, title, date or colours change
// the address changes too, and Discord, iMessage and the browser fetch a fresh card instead of showing the old one.
export function ogVersion(...parts: unknown[]): string {
  const s = JSON.stringify(parts);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// What an event card shows, in one place: the page uses it for the version, the route for the picture.
export function eventCardInputs(event: NonNullable<Awaited<ReturnType<typeof getEventBySlugOrId>>>) {
  const c = event.theme?.colors ?? {};
  return {
    title: event.full_name,
    past: new Date(event.end_date || event.start_date).getTime() < Date.now(),
    posterUrl: event.theme?.posters?.[0] || event.flyer_url || '',
    bg: c.bg ?? '#011941',
    accent: c.accent ?? '#ffc72c',
    text: c.text ?? '#f2f1f0',
    start: event.start_date,
    end: event.end_date || null,
    location: event.location ?? '',
  };
}

export async function eventOgResponse(slug: string) {
  const [event, fonts, logo] = await Promise.all([getEventBySlugOrId(slug), ogFonts(), ogLogo()]);
  const inp = event ? eventCardInputs(event) : null;
  const poster = await ogImage(inp?.posterUrl);
  return new ImageResponse(
    (
      <EventCard
        p={{
          title: inp?.title ?? 'Triton Gaming event',
          past: inp?.past ?? false,
          poster,
          bg: inp?.bg ?? '#011941',
          accent: inp?.accent ?? '#ffc72c',
          text: inp?.text ?? '#f2f1f0',
          date: inp ? formatEventDateRange(inp.start, inp.end, { weekday: true }) : '',
          time: inp ? formatEventTimeRange(inp.start, inp.end) : '',
          location: inp?.location ?? '',
          logo,
        }}
      />
    ),
    { ...OG_SIZE, fonts, headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } }
  );
}

export function divisionCardInputs(d: NonNullable<Awaited<ReturnType<typeof getDivisionBySlug>>>) {
  return {
    name: d.name,
    pitch: d.description?.trim() ? clampDescription(markdownToDescription(d.description, 160), 140) : '',
    logo: divisionLogoSrc(d.logo_url) ?? '',
  };
}

export async function divisionOgResponse(slug: string) {
  const [division, fonts, tg] = await Promise.all([getDivisionBySlug(slug), ogFonts(), ogLogo()]);
  const inp = division ? divisionCardInputs(division) : null;
  const logo = inp ? await ogImage(inp.logo, 500) : '';
  return new ImageResponse(
    <DivisionCard p={{ name: inp?.name ?? 'Triton Gaming division', pitch: inp?.pitch ?? '', logoUrl: logo || tg }} />,
    { ...OG_SIZE, fonts, headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } }
  );
}
