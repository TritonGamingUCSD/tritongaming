import { describe, expect, it } from 'vitest';
import { staffName } from '@/lib/members/names';
import { commandsFor, matchCommands } from '@/lib/portal/portalCommands';
import type { AppRole } from '@/types/database';

const as = (...roles: AppRole[]) => roles.map((role) => ({ role, division_id: null }));

describe('names in staff lists', () => {
  it('leads with the chosen name and shows the real name in brackets', () => {
    expect(staffName({ display_name: 'Kiiro', google_first_name: 'Jasper', google_last_name: 'Huang' })).toBe('Kiiro (Jasper Huang)');
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
  it('matches by label words and keywords', () => {
    const list = commandsFor(as('admin'));
    expect(matchCommands(list, 'plan meet')[0]?.id).toBe('do-meeting-plan');
    expect(matchCommands(list, 'hr')[0]).toBeTruthy();
    expect(matchCommands(list, 'zzzz')).toEqual([]);
  });
});

describe('staffName with a gamer tag', () => {
  it('adds the tag in quotes for pickers, and only when asked', () => {
    const p = { display_name: 'Kiiro', google_first_name: 'Jasper', google_last_name: 'Huang', gamer_tag: 'KiiroTag' };
    expect(staffName(p, { tag: true })).toBe('Kiiro (Jasper Huang) "KiiroTag"');
    expect(staffName(p)).toBe('Kiiro (Jasper Huang)');
  });
  it('tells two people with the same name apart', () => {
    const a = staffName({ display_name: 'Alex Kim', google_first_name: 'Alex', google_last_name: 'Kim', gamer_tag: 'Frost' }, { tag: true });
    const b = staffName({ display_name: 'Alex Kim', google_first_name: 'Alex', google_last_name: 'Kim', gamer_tag: 'Ember' }, { tag: true });
    expect(a).not.toBe(b);
  });
  it('leaves it off when there is no tag, or the name already says it', () => {
    expect(staffName({ display_name: 'Zee' }, { tag: true })).toBe('Zee');
    expect(staffName({ display_name: 'Kiiro', gamer_tag: 'kiiro' }, { tag: true })).toBe('Kiiro');
  });
});
