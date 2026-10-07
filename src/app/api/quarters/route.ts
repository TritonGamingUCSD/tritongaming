import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/notifications/audit';
import { pacificDayKey } from '@/lib/events/checkinDays';
import { staffName } from '@/lib/members/names';
import { resolveAvatarUrl } from '@/lib/members/profile';
import { ROLE_DISPLAY_RANK, ROLE_LABELS, type AppRole } from '@/types/database';
import { TERMS, authorizeQuarters, canBeInactive, currentQuarter, loadQuarters, markableQuarters, quarterName, startedQuarters, syncInactive } from '@/lib/members/quarters';

export const dynamic = 'force-dynamic';
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// The Quarter status page: the quarters that have started (never one still to come), and every officer and lead with the quarters they sat out.
export async function GET() {
  const auth = await authorizeQuarters('manage');
  if (auth.error) return auth.error;
  const quarters = await loadQuarters(auth.svc);
  const today = pacificDayKey();
  const { data: grants } = await auth.svc.from('user_roles').select('user_id, role').in('role', ['officer', 'lead', 'exec', 'admin']);
  const rolesOf = new Map<string, AppRole[]>();
  for (const g of grants ?? []) rolesOf.set(g.user_id as string, [...(rolesOf.get(g.user_id as string) ?? []), g.role as AppRole]);
  const ids = [...rolesOf.entries()].filter(([, r]) => canBeInactive(r.map((role) => ({ role })))).map(([id]) => id);
  const started = startedQuarters(quarters, today);
  const [{ data: ps }, { data: marks }, { data: roster }] = await Promise.all([
    ids.length ? auth.svc.from('profiles').select('id, display_name, google_first_name, google_last_name, avatar_url, custom_avatar_url, org_title').in('id', ids) : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    auth.svc.from('officer_quarter_status').select('user_id, quarter_id, set_by').in('quarter_id', started.map((q) => q.id)),
    // Who held an officer, lead or exec title in each started quarter (so a past quarter lists the people who were there then).
    auth.svc.from('quarter_roster').select('quarter_id, user_id, name, tier, title').in('quarter_id', started.map((q) => q.id)),
  ]);
  const people = (ps ?? []).map((p) => {
    const top = [...(rolesOf.get(p.id as string) ?? [])].sort((a, b) => ROLE_DISPLAY_RANK[b] - ROLE_DISPLAY_RANK[a])[0];
    return { id: p.id as string, name: staffName(p as never), avatar_url: resolveAvatarUrl({ avatar_url: p.avatar_url as string | null, custom_avatar_url: p.custom_avatar_url as string | null }), role: top ?? 'officer', roleLabel: top ? ROLE_LABELS[top] : '', title: (p.org_title as string | null) ?? null };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const cur = currentQuarter(quarters, today);
  return NextResponse.json({
    canSetup: auth.canSetup, today, currentId: cur?.id ?? null,
    // Quarters still to come are not listed: nobody can see or plan who sits out a quarter before it starts. (The admin's date editor reads allQuarters.)
    quarters: started.map((q) => ({ ...q, name: quarterName(q), editable: markableQuarters(quarters, today).some((m) => m.id === q.id) })),
    allQuarters: auth.canSetup ? quarters.map((q) => ({ ...q, name: quarterName(q) })) : [],
    people, marks: (marks ?? []).map((m) => ({ user_id: m.user_id, quarter_id: m.quarter_id, carried: !m.set_by })),
    roster: (roster ?? []).map((r) => ({ quarter_id: r.quarter_id, user_id: r.user_id, name: r.name, tier: r.tier, title: r.title })),
  });
}

// Add a quarter (admin): { term, start_year, starts_on, ends_on }
export async function POST(request: Request) {
  const auth = await authorizeQuarters('setup');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const term = String(b.term);
  const startYear = Number(b.start_year);
  if (!(TERMS as string[]).includes(term)) return NextResponse.json({ error: 'Pick Fall, Winter or Spring.' }, { status: 400 });
  if (!Number.isInteger(startYear) || startYear < 2000 || startYear > 2100) return NextResponse.json({ error: 'Enter the year the academic year starts in, like 2026 for 2026-27.' }, { status: 400 });
  if (!DATE.test(String(b.starts_on)) || !DATE.test(String(b.ends_on))) return NextResponse.json({ error: 'Pick the start and end dates.' }, { status: 400 });
  if (String(b.ends_on) < String(b.starts_on)) return NextResponse.json({ error: 'The quarter can’t end before it starts.' }, { status: 400 });
  const existing = await loadQuarters(auth.svc);
  if (existing.some((q) => q.starts_on <= String(b.ends_on) && q.ends_on >= String(b.starts_on))) return NextResponse.json({ error: 'That overlaps another quarter.' }, { status: 400 });
  const { data, error } = await auth.svc.from('academic_quarters').insert({ term, start_year: startYear, starts_on: b.starts_on, ends_on: b.ends_on }).select('id, term, start_year').single();
  if (error || !data) return NextResponse.json({ error: error?.code === '23505' ? 'That quarter already exists.' : 'Failed to save.' }, { status: error?.code === '23505' ? 400 : 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'create', entityType: 'quarter', entityId: data.id, summary: `Added ${quarterName(data as never)}` });
  await syncInactive(auth.svc);
  return NextResponse.json({ id: data.id }, { status: 201 });
}
