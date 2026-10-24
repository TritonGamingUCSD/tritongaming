import { describe, expect, it } from 'vitest';
import { cleanCode, drawGame, isAskable, makeCode, pointsFor, shuffle, standings, topThree, totals, type PoolQuestion } from '../trivia/game';

const q = (id: string, over: Partial<PoolQuestion> = {}): PoolQuestion => ({ id, text: `Question ${id}`, choices: ['a', 'b', 'c', 'd'], correct: 1, secs: 20, ...over });
const seeded = (seed = 1) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

describe('join code', () => {
  it('makes 6 characters without look-alikes', () => {
    for (let i = 0; i < 200; i++) expect(makeCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });
  it('cleans what a person typed or pasted', () => {
    expect(cleanCode(' ab3 k9z ')).toBe('AB3K9Z');
    expect(cleanCode('https://x.test/portal/trivia/play/ab3k9z')).toBe('AB3K9Z');
    expect(cleanCode('ab3')).toBeNull();
    expect(cleanCode('')).toBeNull();
  });
});

describe('points', () => {
  it('gives 1000 for an instant right answer and 500 at the last second', () => {
    expect(pointsFor(true, 0, 20)).toBe(1000);
    expect(pointsFor(true, 20000, 20)).toBe(500);
    expect(pointsFor(true, 10000, 20)).toBe(750);
  });
  it('gives nothing for a wrong answer and never more than 1000 or less than 500 for a right one', () => {
    expect(pointsFor(false, 0, 20)).toBe(0);
    expect(pointsFor(true, -50, 20)).toBe(1000);
    expect(pointsFor(true, 99999, 20)).toBe(500);
  });
});

describe('drawing a game', () => {
  const pool = Array.from({ length: 12 }, (_, i) => q(`q${i}`));
  it('draws the amount asked, each question once', () => {
    const g = drawGame(pool, new Set(), 5, seeded(3));
    expect(g).toHaveLength(5);
    expect(new Set(g.map((x) => x.id)).size).toBe(5);
  });
  it('never asks for more than the pool holds', () => {
    expect(drawGame(pool, new Set(), 50)).toHaveLength(12);
  });
  it('uses questions no earlier game asked first', () => {
    const used = new Set(pool.slice(0, 8).map((x) => x.id));
    for (let s = 1; s < 20; s++) {
      const ids = drawGame(pool, used, 4, seeded(s)).map((x) => x.id);
      expect(ids.every((id) => !used.has(id))).toBe(true);
    }
    const six = drawGame(pool, used, 6, seeded(7)).map((x) => x.id);
    expect(six.filter((id) => !used.has(id))).toHaveLength(4);   // all 4 unused come first, then 2 repeats
  });
  it('skips unfinished questions', () => {
    const mixed = [q('ok'), q('blank', { text: '' }), q('gap', { choices: ['a', '', 'c', 'd'] })];
    expect(drawGame(mixed, new Set(), 10).map((x) => x.id)).toEqual(['ok']);
    expect(isAskable(q('x', { correct: 4 }))).toBe(false);
  });
  it('shuffles the answers and keeps track of the right one', () => {
    for (let s = 1; s < 30; s++) {
      const [one] = drawGame([q('a', { choices: ['w', 'x', 'y', 'z'], correct: 2 })], new Set(), 1, seeded(s));
      expect([...one.choices].sort()).toEqual(['w', 'x', 'y', 'z']);
      expect(one.choices[one.correct]).toBe('y');
    }
  });
  it('shuffle keeps every item', () => {
    expect(shuffle([1, 2, 3, 4, 5], seeded(9)).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('standings', () => {
  const p = (id: string, score: number, time_ms: number) => ({ user_id: id, name: id, score, time_ms });
  it('orders by score, then by the shorter total time', () => {
    const s = standings([p('a', 1000, 9000), p('b', 2000, 20000), p('c', 1000, 5000)]);
    expect(s.map((x) => x.user_id)).toEqual(['b', 'c', 'a']);
    expect(s.map((x) => x.rank)).toEqual([1, 2, 3]);
  });
  it('gives exact ties the same rank', () => {
    const s = standings([p('a', 500, 1000), p('b', 500, 1000), p('c', 100, 1)]);
    expect(s.map((x) => x.rank)).toEqual([1, 1, 3]);
  });
  it('adds up the answers of the players still in', () => {
    const t = totals([{ user_id: 'a', name: 'A' }, { user_id: 'b', name: 'B' }], [
      { user_id: 'a', points: 900, ms: 2000, ok: true }, { user_id: 'a', points: 0, ms: 5000, ok: false }, { user_id: 'gone', points: 1000, ms: 1, ok: true }, { user_id: 'b', points: 600, ms: 8000, ok: true },
    ]);
    expect(t).toEqual([{ user_id: 'a', name: 'A', score: 900, time_ms: 2000 }, { user_id: 'b', name: 'B', score: 600, time_ms: 8000 }]);
  });
  it('picks exactly three winners, even through a tie, and nobody on zero', () => {
    const s = standings([p('a', 900, 1), p('b', 900, 1), p('c', 900, 1), p('d', 900, 1), p('z', 0, 0)]);
    expect(topThree(s)).toHaveLength(3);
    expect(topThree(standings([p('a', 100, 1), p('z', 0, 0)])).map((x) => x.user_id)).toEqual(['a']);
  });
});
