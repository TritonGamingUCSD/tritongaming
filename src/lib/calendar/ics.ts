import { addDaysKey } from '@/lib/core/timezone';
import { KIND_INFO, type CalItem } from './types';

// Calendar files (.ics) for a feed or a single "add to my calendar", and the links that add an item to Google or Outlook. Pure.
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** A line folded at 75 bytes, as the format asks (continuation lines start with a space). */
export function fold(line: string): string {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let len = 0;
  for (const ch of line) {
    const n = bytes.encode(ch).length;
    if (len + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      len = 0;
    }
    cur += ch;
    len += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const stamp = (iso: string) =>
  new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
const dayStamp = (day: string) => day.replace(/-/g, '');

/** The times of one item as calendar-file lines. An all-day item ends the day after its last day. */
function times(item: CalItem): string[] {
  if (item.allDay) return [`DTSTART;VALUE=DATE:${dayStamp(item.start)}`, `DTEND;VALUE=DATE:${dayStamp(addDaysKey(item.end && item.end >= item.start ? item.end : item.start, 1))}`];
  const end = item.end && item.end > item.start ? item.end : new Date(Date.parse(item.start) + 3600_000).toISOString();
  return [`DTSTART:${stamp(item.start)}`, `DTEND:${stamp(end)}`];
}

export interface IcsOptions {
  /** The calendar's name shown in the app that subscribes. */
  name: string;
  /** The site's address (https://…), used to make each item's link absolute. */
  origin?: string;
  now?: Date;
}

export function buildIcs(items: CalItem[], opts: IcsOptions): string {
  const now = stamp((opts.now ?? new Date()).toISOString());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Triton Gaming//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(opts.name)}`,
    'X-WR-TIMEZONE:America/Los_Angeles',
  ];
  for (const it of items) {
    const href = it.href ? (it.href.startsWith('http') ? it.href : `${opts.origin ?? ''}${it.href}`) : '';
    lines.push(
      'BEGIN:VEVENT',
      `UID:${it.id.replace(/[^A-Za-z0-9:_.-]/g, '-')}@tritongaming`,
      `DTSTAMP:${now}`,
      ...times(it),
      `SUMMARY:${esc(it.title)}`,
      ...(it.location ? [`LOCATION:${esc(it.location)}`] : []),
      `DESCRIPTION:${esc([KIND_INFO[it.kind].label, it.note, href].filter(Boolean).join(' · '))}`,
      ...(href ? [`URL:${href}`] : []),
      `CATEGORIES:${esc(KIND_INFO[it.kind].plural)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Google Calendar's "add this event" link. */
export function googleLink(it: CalItem, origin = ''): string {
  const dates = it.allDay
    ? `${dayStamp(it.start)}/${dayStamp(addDaysKey(it.end && it.end >= it.start ? it.end : it.start, 1))}`
    : `${stamp(it.start)}/${stamp(it.end && it.end > it.start ? it.end : new Date(Date.parse(it.start) + 3600_000).toISOString())}`;
  const href = it.href ? (it.href.startsWith('http') ? it.href : `${origin}${it.href}`) : '';
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: it.title,
    dates,
    details: [KIND_INFO[it.kind].label, it.note, href].filter(Boolean).join(' · '),
    ctz: 'America/Los_Angeles',
  });
  if (it.location) p.set('location', it.location);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/** Outlook on the web's "add this event" link. */
export function outlookLink(it: CalItem, origin = ''): string {
  const iso = (s: string) => (it.allDay ? `${s}T00:00:00` : new Date(s).toISOString());
  const endDay = it.allDay
    ? addDaysKey(it.end && it.end >= it.start ? it.end : it.start, 1)
    : it.end && it.end > it.start
      ? it.end
      : new Date(Date.parse(it.start) + 3600_000).toISOString();
  const href = it.href ? (it.href.startsWith('http') ? it.href : `${origin}${it.href}`) : '';
  const p = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: it.title,
    startdt: iso(it.start),
    enddt: iso(endDay),
    body: [KIND_INFO[it.kind].label, it.note, href].filter(Boolean).join(' · '),
    ...(it.allDay ? { allday: 'true' } : {}),
  });
  if (it.location) p.set('location', it.location);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p.toString()}`;
}

/** A file name for a single item's .ics. */
export const icsFileName = (it: CalItem) =>
  `${
    it.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'event'
  }.ics`;
