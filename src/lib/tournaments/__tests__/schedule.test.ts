import { describe, expect, it } from 'vitest';
import { cleanRoundNames, roundKey, roundLabel, scheduleMatches } from '../schedule';

const m = (key: string, bracket: string, round: number, idx: number, status = 'pending') => ({ key, bracket, round, idx, status });

describe('scheduling', () => {
  const rows = [m('W1-1', 'W', 1, 1), m('W1-2', 'W', 1, 2), m('W1-3', 'W', 1, 3), m('W1-4', 'W', 1, 4), m('W2-1', 'W', 2, 1), m('W2-2', 'W', 2, 2), m('F', 'W', 3, 1)];
  it('runs a round a few at a time and starts the next round after it', () => {
    const t = scheduleMatches(rows, { start: '2026-11-20T18:00:00.000Z', minutes: 30, parallel: 2 });
    expect(t.get('W1-1')).toBe('2026-11-20T18:00:00.000Z');
    expect(t.get('W1-2')).toBe('2026-11-20T18:00:00.000Z');
    expect(t.get('W1-3')).toBe('2026-11-20T18:30:00.000Z');
    expect(t.get('W2-1')).toBe('2026-11-20T19:00:00.000Z');
    expect(t.get('F')).toBe('2026-11-20T19:30:00.000Z');
  });
  it('adds a gap between slots', () => {
    const t = scheduleMatches(rows, { start: '2026-11-20T18:00:00.000Z', minutes: 30, parallel: 4, gap: 10 });
    expect(t.get('W2-1')).toBe('2026-11-20T18:40:00.000Z');
  });
  it('skips finished, bye and skipped matches', () => {
    const t = scheduleMatches([m('a', 'W', 1, 1, 'done'), m('b', 'W', 1, 2, 'bye'), m('c', 'W', 1, 3, 'ready'), m('d', 'W', 2, 1, 'skipped')], {
      start: '2026-11-20T18:00:00.000Z',
      minutes: 20,
      parallel: 1,
    });
    expect([...t.keys()]).toEqual(['c']);
  });
  it('puts winners and losers of a round side by side', () => {
    const t = scheduleMatches([m('L1', 'L', 1, 1), m('W1', 'W', 1, 1), m('W2', 'W', 2, 1)], { start: '2026-11-20T18:00:00.000Z', minutes: 30, parallel: 2 });
    expect(t.get('W1')).toBe(t.get('L1'));
    expect(t.get('W2')).toBe('2026-11-20T18:30:00.000Z');
  });
  it('ignores a bad start time and keeps values in range', () => {
    expect(scheduleMatches(rows, { start: 'soon', minutes: 30, parallel: 2 }).size).toBe(0);
    const t = scheduleMatches([m('a', 'W', 1, 1), m('b', 'W', 2, 1)], { start: '2026-11-20T18:00:00.000Z', minutes: 99999, parallel: 0 });
    expect(Date.parse(t.get('b')!) - Date.parse(t.get('a')!)).toBe(600 * 60_000);
  });
});

describe('round names', () => {
  it('uses the host’s name or the default', () => {
    expect(roundLabel({ W2: 'Quarterfinals' }, 'W', 2, 'Round 2')).toBe('Quarterfinals');
    expect(roundLabel({ W2: ' ' }, 'W', 2, 'Round 2')).toBe('Round 2');
    expect(roundLabel(null, 'W', 1, 'Round 1')).toBe('Round 1');
    expect(roundKey('GF', 1)).toBe('GF1');
  });
  it('keeps only well-formed names', () => {
    expect(cleanRoundNames({ W1: ' Opening ', bad: 'x', L2: 7, GF1: '' })).toEqual({ W1: 'Opening' });
    expect(cleanRoundNames(null)).toEqual({});
  });
});
