import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { strictUser } from '@/lib/supabase/localAuth';
import { hasCapability } from '@/lib/portal/capabilities';
import { FEATURE_SWITCHES, switchKey } from '@/lib/portal/featureSwitches';
import { pacificDayKey } from '@/lib/core/timezone';

export const dynamic = 'force-dynamic';

// What the Admin overview shows beyond the totals: things that need a person (waiting requests and tickets, rules about to end, switches that are off), what is live right now (tournaments, broadcasts), and how busy the portal has been (changes per day, and who made them).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await strictUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_roles')) return NextResponse.json({ error: 'Admins only.' }, { status: 403 });
  const svc = createServiceClient();
  const now = Date.now();
  const since14 = new Date(now - 14 * 86400e3).toISOString();
  const [joins, help, ending, off, liveT, liveB, nextB, audit] = await Promise.all([
    svc.from('division_join_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    svc.from('help_tickets').select('id', { count: 'exact', head: true }).neq('status', 'resolved'),
    svc
      .from('capability_grants')
      .select('id, capability, expires_at')
      .gt('expires_at', new Date(now).toISOString())
      .lt('expires_at', new Date(now + 7 * 86400e3).toISOString()),
    svc
      .from('team_settings')
      .select('key, value')
      .in(
        'key',
        FEATURE_SWITCHES.map((s) => switchKey(s.key)),
      )
      .eq('value', 'off'),
    svc.from('tournaments').select('name, slug').eq('status', 'live').limit(5),
    svc.from('broadcasts').select('title').eq('status', 'live').limit(3),
    svc
      .from('broadcasts')
      .select('title, starts_at')
      .eq('status', 'scheduled')
      .gte('starts_at', new Date(now).toISOString())
      .lt('starts_at', new Date(now + 48 * 3600e3).toISOString())
      .order('starts_at')
      .limit(3),
    svc.from('audit_log').select('created_at, actor_name').gte('created_at', since14).order('created_at', { ascending: false }).limit(4000),
  ]);
  const perDay = new Map<string, number>();
  const actors = new Map<string, number>();
  for (const r of audit.data ?? []) {
    const d = pacificDayKey(r.created_at as string);
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
    if (new Date(r.created_at as string).getTime() > now - 7 * 86400e3 && r.actor_name) actors.set(r.actor_name as string, (actors.get(r.actor_name as string) ?? 0) + 1);
  }
  const days: { day: string; n: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = pacificDayKey(new Date(now - i * 86400e3).toISOString());
    days.push({ day: d, n: perDay.get(d) ?? 0 });
  }
  const offLabels = FEATURE_SWITCHES.filter((s) => (off.data ?? []).some((o) => o.key === switchKey(s.key))).map((s) => s.label);
  return NextResponse.json({
    attention: [
      ...((joins.count ?? 0) > 0
        ? [
            {
              id: 'joins',
              text: `${joins.count} division join request${joins.count === 1 ? '' : 's'} waiting`,
              detail: 'Division Heads approve them on their Members page',
              href: '/portal/divisions',
            },
          ]
        : []),
      ...((help.count ?? 0) > 0
        ? [{ id: 'help', text: `${help.count} open help ticket${help.count === 1 ? '' : 's'}`, detail: 'Open the help inbox', href: '/portal/help/inbox' }]
        : []),
      ...((ending.data ?? []).length > 0
        ? [
            {
              id: 'ending',
              text: `${ending.data!.length} access rule${ending.data!.length === 1 ? '' : 's'} ending this week`,
              detail: 'Extend or let them end in Admin → Access',
              href: '/portal/admin/access',
            },
          ]
        : []),
      ...(offLabels.length > 0
        ? [
            {
              id: 'off',
              text: `${offLabels.length} feature${offLabels.length === 1 ? '' : 's'} turned off`,
              detail: offLabels.slice(0, 4).join(', ') + (offLabels.length > 4 ? '…' : ''),
              href: '/portal/admin/settings',
            },
          ]
        : []),
    ],
    live: [
      ...(liveT.data ?? []).map((t) => ({ kind: 'Tournament', text: t.name as string, href: `/portal/tournaments/${t.slug}` })),
      ...(liveB.data ?? []).map((b) => ({ kind: 'Broadcast', text: b.title as string, href: '/portal/broadcast' })),
    ],
    soon: (nextB.data ?? []).map((b) => ({ text: b.title as string, at: b.starts_at as string })),
    days,
    actors: [...actors.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, n]) => ({ name, n })),
  });
}
