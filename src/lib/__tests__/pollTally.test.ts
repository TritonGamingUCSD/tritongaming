import { describe, expect, test } from 'vitest';
import { cleanVotes, tally, type EntryInfo } from '@/lib/polls/tally';

const e = (n: number): EntryInfo => ({ id: `e${n}`, number: n, name: `Entry ${n}`, subtitle: '', image: '' });
const entries = [e(1), e(2), e(3), e(4)];
const ids = entries.map((x) => x.id);

describe('checking a vote', () => {
  test('one favourite: exactly one entry worth 1', () => {
    expect(cleanVotes('one', ids, [{ entry_id: 'e2', value: 1 }])).toEqual({ votes: [{ entry_id: 'e2', value: 1 }] });
    expect(cleanVotes('one', ids, [])).toHaveProperty('error');
    expect(
      cleanVotes('one', ids, [
        { entry_id: 'e1', value: 1 },
        { entry_id: 'e2', value: 1 },
      ]),
    ).toHaveProperty('error');
    expect(cleanVotes('one', ids, [{ entry_id: 'e1', value: 5 }])).toHaveProperty('error');
  });
  test('top 3: up to three different entries with different places', () => {
    expect(
      cleanVotes('top3', ids, [
        { entry_id: 'e1', value: 3 },
        { entry_id: 'e2', value: 2 },
        { entry_id: 'e3', value: 1 },
      ]),
    ).toHaveProperty('votes');
    expect(cleanVotes('top3', ids, [{ entry_id: 'e1', value: 3 }])).toHaveProperty('votes'); // (a voter may pick fewer)
    expect(
      cleanVotes('top3', ids, [
        { entry_id: 'e1', value: 3 },
        { entry_id: 'e2', value: 3 },
      ]),
    ).toHaveProperty('error');
    expect(cleanVotes('top3', ids, [{ entry_id: 'e1', value: 4 }])).toHaveProperty('error');
    expect(
      cleanVotes(
        'top3',
        ids,
        ids.map((id, i) => ({ entry_id: id, value: (i % 3) + 1 })),
      ),
    ).toHaveProperty('error');
  });
  test('score: any entries, each 1 to 5', () => {
    expect(
      cleanVotes('score', ids, [
        { entry_id: 'e1', value: 5 },
        { entry_id: 'e4', value: 1 },
      ]),
    ).toHaveProperty('votes');
    expect(cleanVotes('score', ids, [{ entry_id: 'e1', value: 6 }])).toHaveProperty('error');
    expect(cleanVotes('score', ids, [{ entry_id: 'e1', value: 0 }])).toHaveProperty('error');
  });
  test('an entry from another poll, or the same entry twice, is refused', () => {
    expect(cleanVotes('one', ids, [{ entry_id: 'other', value: 1 }])).toHaveProperty('error');
    expect(
      cleanVotes('score', ids, [
        { entry_id: 'e1', value: 3 },
        { entry_id: 'e1', value: 4 },
      ]),
    ).toHaveProperty('error');
    expect(cleanVotes('one', ids, 'nonsense')).toHaveProperty('error');
  });
});

describe('counting votes', () => {
  test('one favourite: the most votes first, ties share a place', () => {
    const s = tally('one', entries, [
      { entry_id: 'e2', value: 1 },
      { entry_id: 'e2', value: 1 },
      { entry_id: 'e3', value: 1 },
      { entry_id: 'e1', value: 1 },
    ]);
    expect(s.map((x) => [x.number, x.total, x.place])).toEqual([
      [2, 2, 1],
      [1, 1, 2],
      [3, 1, 2],
      [4, 0, 4],
    ]);
  });
  test('top 3: points add up and a tie goes to more first places', () => {
    const s = tally('top3', entries, [
      { entry_id: 'e1', value: 3 }, // voter A: 1 first
      { entry_id: 'e2', value: 2 },
      { entry_id: 'e3', value: 1 },
      { entry_id: 'e2', value: 3 }, // voter B: e2 first
      { entry_id: 'e1', value: 2 },
      { entry_id: 'e3', value: 1 },
    ]);
    expect(s[0].number).toBe(1); // e1: 3 + 2 = 5, e2: 2 + 3 = 5 → tie on points and on firsts (1 each) → both place 1
    expect(s[0].place).toBe(1);
    expect(s[1].place).toBe(1);
    expect(s.find((x) => x.number === 3)!.total).toBe(2);
  });
  test('score: the average, best first; an entry nobody scored is last with 0', () => {
    const s = tally('score', entries, [
      { entry_id: 'e1', value: 5 },
      { entry_id: 'e1', value: 4 },
      { entry_id: 'e2', value: 5 },
    ]);
    expect(s.map((x) => [x.number, x.total, x.voters])).toEqual([
      [2, 5, 1],
      [1, 4.5, 2],
      [3, 0, 0],
      [4, 0, 0],
    ]);
  });
  test('votes for entries that are not in the poll are ignored', () => {
    expect(tally('one', entries, [{ entry_id: 'ghost', value: 1 }]).every((x) => x.total === 0)).toBe(true);
  });
});
