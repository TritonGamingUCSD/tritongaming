import type { SupabaseClient } from '@supabase/supabase-js';
import { pacificDayKey } from '@/lib/events/checkinDays';
import { resolveAvatarUrl } from '@/lib/members/profile';
import { type Quarter, loadQuarters } from '@/lib/members/quarters';
import { invalidate } from '@/lib/site/revalidate';

// Who was on the team in each academic year. While a quarter runs, everyone holding an officer, lead or exec title is written to that quarter's roster
// each day. A year's list is then everyone who was ACTIVE (not marked inactive) in at least one of its quarters, at the highest title they held while
// active. After Spring ends the year is archived automatically, and an admin can correct any year by hand.

export type Tier = 'exec' | 'lead' | 'officer';
export const TIERS: Tier[] = ['exec', 'lead', 'officer'];
export const TIER_RANK: Record<Tier, number> = { exec: 3, lead: 2, officer: 1 };
export const topTier = (roles: { role: string }[]): Tier | null => TIERS.find((t) => roles.some((r) => r.role === t)) ?? null;

export interface YearMember { user_id: string | null; name: string; title: string | null; tier: Tier; avatar_url: string | null }

const inQuarter = (q: Quarter, today: string) => q.starts_on <= today && today <= q.ends_on;

// Write today's holders of officer, lead and exec titles to the roster of the quarter we are in (only while it is running).
export async function captureRoster(svc: SupabaseClient, today: string = pacificDayKey()): Promise<number> {
  const q = (await loadQuarters(svc)).find((x) => inQuarter(x, today));
  if (!q) return 0;
  const { data: grants } = await svc.from('user_roles').select('user_id, role').in('role', TIERS);
  const rolesOf = new Map<string, { role: string }[]>();
  for (const g of grants ?? []) rolesOf.set(g.user_id as string, [...(rolesOf.get(g.user_id as string) ?? []), { role: g.role as string }]);
  const ids = [...rolesOf.keys()];
  if (!ids.length) return 0;
  const [{ data: ps }, { data: have }] = await Promise.all([
    svc.from('profiles').select('id, display_name, org_title').in('id', ids),
    svc.from('quarter_roster').select('user_id, tier').eq('quarter_id', q.id).in('user_id', ids),
  ]);
  const before = new Map((have ?? []).map((h) => [h.user_id as string, h.tier as Tier]));
  const rows = (ps ?? []).map((p) => {
    const now = topTier(rolesOf.get(p.id as string) ?? [])!;
    const old = before.get(p.id as string);
    return { quarter_id: q.id, user_id: p.id as string, tier: old && TIER_RANK[old] > TIER_RANK[now] ? old : now, title: (p.org_title as string | null) || null, name: (p.display_name as string | null) || 'Unnamed', last_seen: today };
  });
  await svc.from('quarter_roster').upsert(rows, { onConflict: 'quarter_id,user_id' });
  return rows.length;
}

// The list for an academic year, worked out from its quarters (not what is stored): active in at least one quarter, highest title while active.
export async function buildYear(svc: SupabaseClient, startYear: number): Promise<YearMember[]> {
  const quarters = (await loadQuarters(svc)).filter((q) => q.start_year === startYear);
  if (!quarters.length) return [];
  const ids = quarters.map((q) => q.id);
  const [{ data: roster }, { data: marks }] = await Promise.all([
    svc.from('quarter_roster').select('quarter_id, user_id, tier, title, name').in('quarter_id', ids),
    svc.from('officer_quarter_status').select('user_id, quarter_id').in('quarter_id', ids),
  ]);
  const inactive = new Set((marks ?? []).map((m) => `${m.user_id}|${m.quarter_id}`));
  const sorted = [...quarters].sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  const order = new Map(sorted.map((q, i) => [q.id, i]));
  const best = new Map<string, { tier: Tier; title: string | null; name: string; at: number }>();
  for (const r of roster ?? []) {
    if (inactive.has(`${r.user_id}|${r.quarter_id}`)) continue;   // sitting that quarter out
    const at = order.get(r.quarter_id as string) ?? 0;
    const cur = best.get(r.user_id as string);
    const tier = r.tier as Tier;
    // Highest tier wins; for the title, the latest active quarter at that tier.
    if (!cur || TIER_RANK[tier] > TIER_RANK[cur.tier] || (TIER_RANK[tier] === TIER_RANK[cur.tier] && at >= cur.at)) best.set(r.user_id as string, { tier, title: (r.title as string | null) ?? null, name: r.name as string, at });
  }
  const userIds = [...best.keys()];
  const { data: ps } = userIds.length ? await svc.from('profiles').select('id, display_name, avatar_url, custom_avatar_url').in('id', userIds) : { data: [] as Record<string, unknown>[] };
  const prof = new Map((ps ?? []).map((p) => [p.id as string, p]));
  return userIds.map((id) => {
    const b = best.get(id)!; const p = prof.get(id);
    return { user_id: id, name: (p?.display_name as string | null) || b.name, title: b.title, tier: b.tier, avatar_url: p ? resolveAvatarUrl({ avatar_url: p.avatar_url as string | null, custom_avatar_url: p.custom_avatar_url as string | null }) : null };
  }).sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier] || a.name.localeCompare(b.name));
}

// Record a year's list. Names added or changed by hand ("manual") are kept; the rest is rebuilt from the quarters.
export async function archiveYear(svc: SupabaseClient, startYear: number, actorId: string | null): Promise<number> {
  // Make sure today's titles are on the roster first: the daily job may not have run yet (a quarter that just started would otherwise build an empty list).
  await captureRoster(svc);
  const built = await buildYear(svc, startYear);
  await svc.from('team_years').upsert({ start_year: startYear, archived_at: new Date().toISOString(), archived_by: actorId, auto: actorId === null }, { onConflict: 'start_year' });
  const { data: kept } = await svc.from('team_year_members').select('user_id').eq('start_year', startYear).eq('manual', true);
  const keep = new Set((kept ?? []).map((k) => k.user_id as string | null).filter((x): x is string => !!x));
  await svc.from('team_year_members').delete().eq('start_year', startYear).eq('manual', false);
  const rows = built.filter((m) => !m.user_id || !keep.has(m.user_id)).map((m) => ({ start_year: startYear, user_id: m.user_id, name: m.name, title: m.title, tier: m.tier, avatar_url: m.avatar_url, manual: false }));
  if (rows.length) await svc.from('team_year_members').insert(rows);
  invalidate('board');
  return rows.length + keep.size;
}

// Archive every academic year whose Spring quarter has ended and that has not been recorded yet.
export async function autoArchive(svc: SupabaseClient, today: string = pacificDayKey()): Promise<number[]> {
  const quarters = await loadQuarters(svc);
  const { data: done } = await svc.from('team_years').select('start_year');
  const have = new Set((done ?? []).map((d) => d.start_year as number));
  const years = [...new Set(quarters.map((q) => q.start_year))].filter((y) => !have.has(y) && quarters.some((q) => q.start_year === y && q.term === 'spring' && q.ends_on < today));
  for (const y of years) await archiveYear(svc, y, null);
  return years;
}

// ── Alumni ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Graduated on June 30 of their class year. An officer, lead or exec who has graduated and was active in at least one quarter on record (or is in an
// archived year) is an alumnus for good, even if their last quarters were inactive. The officer/lead/exec role is dropped when they are moved.
export const graduated = (classOf: number | null, today: string = pacificDayKey()) => classOf !== null && `${classOf}-06-30` < today;

export async function alumniCandidates(svc: SupabaseClient, today: string = pacificDayKey()): Promise<{ id: string; name: string; class_of: number }[]> {
  const { data: grants } = await svc.from('user_roles').select('user_id, role').in('role', TIERS);
  const ids = [...new Set((grants ?? []).map((g) => g.user_id as string))];
  if (!ids.length) return [];
  const [{ data: ps }, { data: roster }, { data: marks }, { data: past }] = await Promise.all([
    svc.from('profiles').select('id, display_name, class_of').in('id', ids),
    svc.from('quarter_roster').select('quarter_id, user_id').in('user_id', ids),
    svc.from('officer_quarter_status').select('user_id, quarter_id').in('user_id', ids),
    svc.from('team_year_members').select('user_id').in('user_id', ids),
  ]);
  const marked = new Set((marks ?? []).map((m) => `${m.user_id}|${m.quarter_id}`));
  const everActive = new Set<string>([...(past ?? []).map((p) => p.user_id as string)]);
  for (const r of roster ?? []) if (!marked.has(`${r.user_id}|${r.quarter_id}`)) everActive.add(r.user_id as string);
  return (ps ?? []).filter((p) => graduated(p.class_of as number | null, today) && everActive.has(p.id as string)).map((p) => ({ id: p.id as string, name: (p.display_name as string | null) || 'Unnamed', class_of: p.class_of as number }));
}

export async function moveToAlumni(svc: SupabaseClient, userIds: string[], actorId: string | null): Promise<number> {
  let n = 0;
  for (const id of userIds) {
    const { data: roles } = await svc.from('user_roles').select('role, division_id').eq('user_id', id);
    const keep = (roles ?? []).filter((r) => !['officer', 'lead', 'exec', 'inactive', 'alumni'].includes(r.role as string));
    const next = [...keep.map((r) => ({ role: r.role, division_id: r.division_id })), { role: 'alumni', division_id: null }];
    const { error } = await svc.rpc('admin_set_user_roles', { _user_id: id, _roles: next, _granted_by: actorId });
    if (!error) n++;
  }
  if (n) invalidate('board');
  return n;
}

export async function autoAlumniOn(svc: SupabaseClient): Promise<boolean> {
  const { data } = await svc.from('team_settings').select('value').eq('key', 'auto_alumni').maybeSingle();
  return data?.value === 'on';
}

// The daily job: record today's roster, archive finished years, and (when switched on) move graduates to Alumni.
export async function runTeamSync(svc: SupabaseClient, today: string = pacificDayKey()) {
  const captured = await captureRoster(svc, today);
  const archived = await autoArchive(svc, today);
  let moved = 0;
  if (await autoAlumniOn(svc)) {
    const ready = await alumniCandidates(svc, today);
    moved = await moveToAlumni(svc, ready.map((r) => r.id), null);
  }
  return { captured, archived, moved };
}
