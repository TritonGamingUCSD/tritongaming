import { describe, expect, it } from 'vitest';
import { autoPlan } from './eventPick';
import type { PlanSummary } from './usePlans';

const plan = (slug: string, starts_on: string, ends_on: string, status: 'draft' | 'closed'): PlanSummary => ({ slug, starts_on, ends_on, status }) as PlanSummary;

describe('the event a page opens on', () => {
  it('is the open event on today', () => {
    expect(autoPlan([plan('later', '2026-11-20', '2026-11-21', 'draft'), plan('now', '2026-11-01', '2026-11-03', 'draft')], '2026-11-02')?.slug).toBe('now');
  });
  it('else the next open one coming', () => {
    expect(autoPlan([plan('far', '2026-12-20', '2026-12-21', 'draft'), plan('soon', '2026-11-10', '2026-11-11', 'draft')], '2026-11-02')?.slug).toBe('soon');
  });
  it('else the latest open one that has passed', () => {
    expect(autoPlan([plan('old', '2026-10-01', '2026-10-02', 'draft')], '2026-11-02')?.slug).toBe('old');
  });
  it('is none when no event is open: closed events are not opened by themselves', () => {
    expect(autoPlan([plan('done', '2026-10-01', '2026-10-02', 'closed'), plan('done2', '2026-11-01', '2026-11-03', 'closed')], '2026-11-02')).toBeNull();
    expect(autoPlan([], '2026-11-02')).toBeNull();
  });
});
