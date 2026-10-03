import { describe, expect, it } from 'vitest';
import { availabilityFor, bestTimes, canStartAt, cleanSlots, coveredSlots, planDayKeys, slotStarts } from '@/lib/meetingPlans';

const plan = { kind: 'once' as const, duration_min: 60, window_start: '09:00', window_end: '12:00', range_start: '2026-10-05', range_end: '2026-10-08' };

describe('meeting plans', () => {
  it('lists 30-minute slots up to the window end', () => {
    expect(slotStarts('09:00', '11:00')).toEqual(['09:00', '09:30', '10:00', '10:30']);
  });
  it('drops past days of a one-time plan and keeps today', () => {
    expect(planDayKeys(plan, '2026-10-07')).toEqual(['2026-10-07', '2026-10-08']);
    expect(planDayKeys(plan, '2026-10-09')).toEqual([]);
    expect(planDayKeys({ kind: 'weekly', range_start: null, range_end: null }, '2026-10-09')).toHaveLength(7);
  });
  it('covers every slot of the meeting length and must end by the window end', () => {
    expect(coveredSlots('09:30', 60)).toEqual(['09:30', '10:00']);
    expect(canStartAt(plan, '11:00')).toBe(true);
    expect(canStartAt(plan, '11:30')).toBe(false);
  });
  it('is unavailable if any covered slot is unmarked, and if-needed if any is if-needed', () => {
    const s = { '2026-10-05': { '09:00': 1 as const, '09:30': 1 as const, '10:00': 2 as const } };
    expect(availabilityFor(s, '2026-10-05', '09:00', 60)).toBe('available');
    expect(availabilityFor(s, '2026-10-05', '09:30', 60)).toBe('if_needed');
    expect(availabilityFor(s, '2026-10-05', '10:00', 60)).toBe('unavailable');
    expect(availabilityFor(undefined, '2026-10-05', '09:00', 60)).toBe('unavailable');
  });
  it('cleans answers to real days and slots', () => {
    const out = cleanSlots({ '2026-10-05': { '09:00': 1, '09:15': 1, '09:30': 3 }, '2030-01-01': { '09:00': 1 } }, ['2026-10-05'], ['09:00', '09:30']);
    expect(out).toEqual({ '2026-10-05': { '09:00': 1 } });
  });
  it('ranks start times by fewest unavailable', () => {
    const people = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
    const responses = {
      a: { '2026-10-05': { '09:00': 1 as const, '09:30': 1 as const, '10:00': 1 as const } },
      b: { '2026-10-05': { '09:00': 1 as const, '09:30': 1 as const } },
    };
    const best = bestTimes(plan, ['2026-10-05'], people, responses, 2);
    expect(best[0]).toMatchObject({ day: '2026-10-05', start: '09:00' });
    expect(best[0].noResponse.map((p) => p.id)).toEqual(['c']);
    expect(best[0].unavailable).toHaveLength(0);
  });
  it('lists every time tied for best, then fills up to the limit', () => {
    const people = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
    const full = { '09:00': 1 as const, '09:30': 1 as const, '10:00': 1 as const, '10:30': 1 as const, '11:00': 1 as const, '11:30': 1 as const };
    const responses = { a: { '2026-10-05': full, '2026-10-06': { '09:00': 1 as const, '09:30': 1 as const } }, b: { '2026-10-05': full } };
    const best = bestTimes(plan, ['2026-10-05', '2026-10-06'], people, responses, 1);
    expect(best.length).toBeGreaterThan(1);
    expect(best.every((t) => t.top)).toBe(true);
    expect(best.every((t) => t.available.length === 2)).toBe(true);
    const filled = bestTimes(plan, ['2026-10-05', '2026-10-06'], people, responses, 10);
    expect(filled.length).toBeGreaterThan(best.length);
    expect(filled.slice(0, best.length).every((t) => t.top)).toBe(true);
    expect(filled.slice(best.length).every((t) => !t.top)).toBe(true);
  });
});
