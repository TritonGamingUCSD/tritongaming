import { describe, expect, it } from 'vitest';
import { staffName } from '@/lib/names';
import { commandsFor, matchCommands } from '@/lib/portalCommands';
import { buildIcsCalendar, googleCalendarUrl } from '@/lib/ics';
import type { AppRole } from '@/types/database';

const as = (...roles: AppRole[]) => roles.map((role) => ({ role, division_id: null }));

describe('names in staff lists', () => {
  it('leads with the Google name and shows the chosen name in brackets', () => {
    expect(staffName({ display_name: 'Kiiro', google_first_name: 'Jasper', google_last_name: 'Huang' })).toBe('Jasper Huang (Kiiro)');
  });
  it('shows one name when they match or only the first name was kept', () => {
    expect(staffName({ display_name: 'Jasper Huang', google_first_name: 'Jasper', google_last_name: 'Huang' })).toBe('Jasper Huang');
    expect(staffName({ display_name: 'Jasper', google_first_name: 'Jasper', google_last_name: 'Huang' })).toBe('Jasper Huang');
  });
  it('falls back to the chosen name, then Unnamed', () => {
    expect(staffName({ display_name: 'Zee' })).toBe('Zee');
    expect(staffName({})).toBe('Unnamed');
  });
});

describe('search jump targets follow permissions', () => {
  const ids = (r: AppRole[]) => commandsFor(as(...r)).map((c) => c.id);
  it('a recruit cannot plan meetings or events', () => {
    const recruit = ids(['recruit']);
    expect(recruit).not.toContain('do-meeting-plan');
    expect(recruit).not.toContain('do-internal-plan');
    expect(recruit).toContain('do-meeting-checkin');
  });
  it('a lead can plan, only admin sees Access', () => {
    expect(ids(['lead'])).toContain('do-meeting-plan');
    expect(ids(['exec'])).not.toContain('do-access');
    expect(ids(['admin'])).toContain('do-access');
  });
  it('alumni get no internal events', () => {
    expect(ids(['alumni'])).not.toContain('go-internal');
  });
  it('matches by label words and keywords', () => {
    const list = commandsFor(as('admin'));
    expect(matchCommands(list, 'plan meet')[0]?.id).toBe('do-meeting-plan');
    expect(matchCommands(list, 'hr')[0]).toBeTruthy();
    expect(matchCommands(list, 'zzzz')).toEqual([]);
  });
});

describe('calendar files', () => {
  it('writes one VEVENT per event and escapes commas', () => {
    const ics = buildIcsCalendar([{ uid: 'a@x', title: 'Game night, loud', start: '2026-11-07T18:00:00Z', end: '2026-11-07T20:00:00Z' }], 'Test');
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(1);
    expect(ics).toContain('SUMMARY:Game night\\, loud');
    expect(ics).toContain('DTSTART:20261107T180000Z');
  });
  it('builds a Google Calendar link', () => {
    const url = googleCalendarUrl({ title: 'Meet', start: '2026-11-07T18:00:00Z', end: '2026-11-07T19:00:00Z', location: 'Room 5' });
    expect(url).toContain('calendar.google.com');
    expect(url).toContain('dates=20261107T180000Z%2F20261107T190000Z');
  });
});
