// RFC 5545 (iCalendar) generator, just the one VEVENT shape this site needs
// — not worth pulling in a dependency for. All times are emitted in UTC
// (`YYYYMMDDTHHMMSSZ`) rather than a floating local time + VTIMEZONE block:
// events already store their instant as a UTC ISO timestamp, so converting
// straight to this format is both simpler and unambiguous for every calendar
// app, regardless of the attendee's own timezone.

function toIcsUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

// Commas, semicolons, and backslashes are structural in ICS text values and
// must be backslash-escaped; real newlines become the literal two-character
// sequence "\n" (RFC 5545 §3.3.11) rather than an embedded line break, which
// would otherwise be read as the start of a new property.
function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// Lines over 75 octets are supposed to be "folded" (soft-wrapped with a
// leading space) per RFC 5545 §3.1 — most calendar apps tolerate long lines
// fine, but folding costs nothing and keeps this a spec-correct file rather
// than one that merely happens to work with whatever's tested against it.
function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    chunks.push(rest.slice(0, 75));
    rest = ' ' + rest.slice(75);
  }
  chunks.push(rest);
  return chunks.join('\r\n');
}

export interface IcsEventInput {
  uid: string;
  title: string;
  start: string; // ISO
  end?: string | null; // ISO — falls back to start + 2h when absent
  location?: string | null;
  description?: string | null;
  url?: string | null;
}

export function buildIcsEvent(input: IcsEventInput): string {
  const start = new Date(input.start);
  const end = input.end ? new Date(input.end) : new Date(start.getTime() + 2 * 3600_000);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Triton Gaming//Event Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${input.uid}`,
    `DTSTAMP:${toIcsUtc(new Date().toISOString())}`,
    `DTSTART:${toIcsUtc(start.toISOString())}`,
    `DTEND:${toIcsUtc(end.toISOString())}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
    ...(input.location ? [`LOCATION:${escapeIcsText(input.location)}`] : []),
    ...(input.description ? [`DESCRIPTION:${escapeIcsText(input.description)}`] : []),
    ...(input.url ? [`URL:${escapeIcsText(input.url)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

// A whole calendar (many events) for a subscription feed. Same event shape as buildIcsEvent.
export function buildIcsCalendar(events: IcsEventInput[], name: string): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Triton Gaming//Portal Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(name)}`,
    'X-PUBLISHED-TTL:PT1H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  ];
  const stamp = toIcsUtc(new Date().toISOString());
  for (const e of events) {
    const start = new Date(e.start);
    const end = e.end ? new Date(e.end) : new Date(start.getTime() + 2 * 3600_000);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toIcsUtc(start.toISOString())}`,
      `DTEND:${toIcsUtc(end.toISOString())}`,
      `SUMMARY:${escapeIcsText(e.title)}`,
      ...(e.location ? [`LOCATION:${escapeIcsText(e.location)}`] : []),
      ...(e.description ? [`DESCRIPTION:${escapeIcsText(e.description)}`] : []),
      ...(e.url ? [`URL:${escapeIcsText(e.url)}`] : []),
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

// A one-click "add to Google Calendar" link for a single item (no server needed).
export function googleCalendarUrl(e: { title: string; start: string; end?: string | null; location?: string | null; details?: string | null }): string {
  const start = new Date(e.start);
  const end = e.end ? new Date(e.end) : new Date(start.getTime() + 2 * 3600_000);
  const params = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${toIcsUtc(start.toISOString())}/${toIcsUtc(end.toISOString())}` });
  if (e.location) params.set('location', e.location);
  if (e.details) params.set('details', e.details);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
