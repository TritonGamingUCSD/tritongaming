// A link that opens Google Calendar's "add event" screen filled in (the .ics download covers Apple, Outlook and everything else).
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function googleCalendarUrl(e: { name: string; start_date: string; end_date?: string | null; location?: string | null; slug: string }): string {
  const start = new Date(e.start_date).getTime();
  const end = e.end_date && new Date(e.end_date).getTime() > start ? e.end_date : new Date(start + 2 * 3_600_000).toISOString();
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
  const params = new URLSearchParams({ action: 'TEMPLATE', text: e.name, dates: `${stamp(e.start_date)}/${stamp(end)}`, details: `${site}/events/${e.slug}`, ...(e.location ? { location: e.location } : {}) });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
