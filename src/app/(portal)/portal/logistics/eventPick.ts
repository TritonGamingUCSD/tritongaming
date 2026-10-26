import type { PlanSummary } from './usePlans';

// The event a page opens on when none is named: the one on today, else the next one coming, else the latest.
export function autoPlan(plans: PlanSummary[], today: string): PlanSummary | null {
  const open = plans.filter((p) => p.status === 'draft');
  return open.find((p) => p.starts_on <= today && today <= p.ends_on) ?? [...open].filter((p) => p.starts_on >= today).sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0] ?? open[0] ?? plans[0] ?? null;
}
export const dates = (p: PlanSummary) => (p.starts_on === p.ends_on ? p.starts_on : `${p.starts_on} to ${p.ends_on}`);
export const eventLabel = (p: PlanSummary) => `${p.name} · ${dates(p)}${p.status === 'closed' ? ' (closed)' : ''}`;
