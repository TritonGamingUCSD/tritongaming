import { describe, expect, it } from 'vitest';
import { groupRows, groupTitles, shelfOf, type GroupableRow } from '@/lib/logistics/deviceGroups';

const row = (o: Partial<GroupableRow>): GroupableRow => ({ id: 'r', kind: 'club', type: 'Monitor', where: 'Shelf A · T1', located: true, games_needed: [], games: [], ...o });
const ctx = { attention: (r: GroupableRow) => r.id === 'bad', complete: (r: GroupableRow) => r.id === 'done', day: true };

describe('device groups', () => {
  it('names the shelf, or why there is none', () => {
    expect(shelfOf(row({}))).toBe('Shelf A');
    expect(shelfOf(row({ located: false, where: 'No place set' }))).toBe('No shelf set');
    expect(shelfOf(row({ kind: 'sponsor' }))).toBe('Loaners (not in storage)');
    expect(shelfOf(row({ kind: 'slot' }))).toBe('No device chosen yet');
  });
  it('groups by type in the order of the Type list', () => {
    const rank = (t: string) => ['Gaming PC', 'Monitor'].indexOf(t);
    const g = groupRows([row({ id: 'a', type: 'Monitor' }), row({ id: 'b', type: 'Gaming PC' }), row({ id: 'c', type: 'Monitor' })], 'type', ctx, rank);
    expect(g.map((x) => [x.title, x.rows.length])).toEqual([
      ['Gaming PC', 1],
      ['Monitor', 2],
    ]);
  });
  it('groups by owner: club, then sponsor, then officer loaners', () => {
    const g = groupRows([row({ id: 'a', kind: 'officer' }), row({ id: 'b' }), row({ id: 'c', kind: 'sponsor' })], 'owner', ctx);
    expect(g.map((x) => x.title)).toEqual(['Club', 'Sponsor loaner', 'Officer loaner']);
  });
  it('groups by status with what needs attention first; planning says Ready, the day says To do or Done', () => {
    const rows = [row({ id: 'done' }), row({ id: 'bad' }), row({ id: 'todo' })];
    expect(groupRows(rows, 'status', ctx).map((x) => [x.title, x.rows.map((r) => r.id)])).toEqual([
      ['Needs attention', ['bad']],
      ['To do', ['todo']],
      ['Done', ['done']],
    ]);
    expect(groupRows(rows, 'status', { ...ctx, day: false }).map((x) => x.title)).toEqual(['Needs attention', 'Ready']);
  });
  it('puts a row under every game it needs, or under none', () => {
    const titles = (r: GroupableRow) => groupTitles(r, 'games', ctx);
    expect(titles(row({ games_needed: ['Valorant', 'Smash'] }))).toEqual(['Valorant', 'Smash']);
    expect(titles(row({}))).toEqual(['No game needed']);
    const g = groupRows([row({ id: 'a', games_needed: ['Valorant', 'Smash'] }), row({ id: 'b', games_needed: ['Smash'] })], 'games', ctx);
    expect(g.map((x) => [x.title, x.rows.length])).toEqual([
      ['Smash', 2],
      ['Valorant', 1],
    ]);
  });
});
