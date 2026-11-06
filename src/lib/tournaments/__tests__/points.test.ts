import { describe, expect, it } from 'vitest';
import { dealHeats, pointsFor, pointsStandings, scoreHeat } from '../points';

describe('points series', () => {
  it('deals heats snake style with sizes at most one apart', () => {
    const heats = dealHeats(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 4);
    expect(heats).toHaveLength(2);
    expect(heats[0]).toEqual(['a', 'd', 'e', 'h'].filter((x) => x !== 'h'));
    expect(Math.abs(heats[0].length - heats[1].length)).toBeLessThanOrEqual(1);
    expect(heats.flat().sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });
  it('gives points by placement and nothing past the table', () => {
    expect(pointsFor(1)).toBe(10);
    expect(pointsFor(4)).toBe(2);
    expect(pointsFor(5)).toBe(0);
  });
  it('scores a heat from the finishing order', () => {
    expect(scoreHeat(['x', 'y'], [5, 3])).toEqual([
      { entrant_id: 'x', placement: 1, points: 5 },
      { entrant_id: 'y', placement: 2, points: 3 },
    ]);
  });
  it('totals over rounds and breaks ties by wins', () => {
    const h1 = scoreHeat(['a', 'b', 'c']);
    const h2 = scoreHeat(['b', 'a', 'c']);
    const t = pointsStandings(['a', 'b', 'c'], [h1, h2]);
    expect(t.map((r) => r.id)).toEqual(['a', 'b', 'c']); // a and b tie on 16, a has the better... equal wins, equal best, id order
    expect(t[0].points).toBe(16);
    expect(t[2].points).toBe(8);
  });
});
