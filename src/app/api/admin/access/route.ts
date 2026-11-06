import { NextResponse } from 'next/server';
import { staffName } from '@/lib/members/names';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability, CAPABILITY_ROLES, isInactiveStripped, withGrantedCapabilities } from '@/lib/portal/capabilities';
import { CAPABILITY_INFO, CAP_AREAS, RULE_CAPABILITIES } from '@/lib/portal/capabilityInfo';
import { logAudit } from '@/lib/notifications/audit';
import { createNotifications } from '@/lib/notifications/notify';
import { ROLE_LABELS, ROLE_DISPLAY_RANK, type AppRole, type Capability } from '@/types/database';
import { strictUser } from '@/lib/supabase/localAuth';

export const dynamic = 'force-dynamic';

async function authorize() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await strictUser(supabase);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_roles')) return { error: NextResponse.json({ error: 'Only admins can manage access.' }, { status: 403 }) };
  return { user, svc: createServiceClient() };
}

const ROLE_ORDER = (Object.keys(ROLE_LABELS) as AppRole[])
  .filter((r) => (r as string) !== 'guest' && (r as string) !== 'inactive')
  .sort((a, b) => ROLE_DISPLAY_RANK[a] - ROLE_DISPLAY_RANK[b]);

// Admin → Access. One route for the four views:
//   GET                      the rules (who was given or denied what, until when), the saved groups, the matrix of roles by permission, and the recent history
//   GET ?q=name              find people
//   GET ?effective=<user>    everything one person can do, and why each yes or no
// Rules: POST { capability, user_id | group_id, effect?: 'grant' | 'deny', expires_at?, note? } adds one; PATCH { id, expires_at?, note? } changes the end date or the note; DELETE ?id= removes it.
export async function GET(request: Request) {
  const auth = await authorize();
  if ('error' in auth) return auth.error;
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim();
  if (url.searchParams.has('q')) {
    if (!q || q.length < 2) return NextResponse.json({ people: [] });
    const like = `%${q.replace(/[%_,()]/g, ' ')}%`;
    const { data } = await auth.svc
      .from('profiles')
      .select('id, display_name, google_first_name, google_last_name, gamer_tag')
      .or(`display_name.ilike.${like},google_first_name.ilike.${like},google_last_name.ilike.${like},gamer_tag.ilike.${like}`)
      .limit(8);
    return NextResponse.json({ people: (data ?? []).map((p) => ({ id: p.id, name: staffName(p, { tag: true }) })) });
  }

  const effective = url.searchParams.get('effective');
  if (effective) {
    const [{ data: roleRows }, { data: groups }, { data: prof }] = await Promise.all([
      auth.svc.from('user_roles').select('role, division_id').eq('user_id', effective),
      auth.svc.from('meeting_groups').select('id, name').contains('member_ids', [effective]),
      auth.svc.from('profiles').select('display_name, google_first_name, google_last_name, gamer_tag').eq('id', effective).maybeSingle(),
    ]);
    const groupIds = (groups ?? []).map((g) => g.id as string);
    let rq = auth.svc.from('capability_grants').select('id, capability, effect, expires_at, note, user_id, group_id');
    rq = groupIds.length ? rq.or(`user_id.eq.${effective},group_id.in.(${groupIds.join(',')})`) : rq.eq('user_id', effective);
    const { data: rules } = await rq;
    const now = Date.now();
    const live = (rules ?? []).filter((g) => !g.expires_at || new Date(g.expires_at as string).getTime() > now);
    const roles = (roleRows ?? []) as { role: AppRole; division_id: string | null }[];
    const withRules = withGrantedCapabilities(
      roles,
      live.map((g) => (g.effect === 'deny' ? (`deny:${g.capability as Capability}` as `deny:${Capability}`) : (g.capability as Capability))),
    );
    const groupName = new Map((groups ?? []).map((g) => [g.id as string, g.name as string]));
    const rows = (Object.keys(CAPABILITY_INFO) as Capability[]).map((c) => {
      const why: string[] = [];
      const byRole = roles.filter((r) => CAPABILITY_ROLES[c].includes(r.role)).map((r) => ROLE_LABELS[r.role]);
      if (roles.some((r) => r.role === 'admin')) why.push('Admin: everything');
      else if (byRole.length) why.push(`Role: ${[...new Set(byRole)].join(', ')}`);
      for (const g of live.filter((x) => x.capability === c)) {
        const from = g.user_id ? 'personal rule' : `group “${groupName.get(g.group_id as string) ?? 'group'}”`;
        why.push(
          `${g.effect === 'deny' ? 'Taken away by' : 'Given by'} ${from}${g.expires_at ? ` until ${new Date(g.expires_at as string).toISOString().slice(0, 10)}` : ''}${g.note ? ` (${g.note})` : ''}`,
        );
      }
      if (roles.some((r) => r.role === 'inactive') && !roles.some((r) => r.role === 'admin') && isInactiveStripped(c) && byRole.length)
        why.push('Inactive this quarter: changing and running things is paused');
      return { id: c, label: CAPABILITY_INFO[c].label, area: CAPABILITY_INFO[c].area, has: hasCapability(withRules, c), why };
    });
    return NextResponse.json({
      person: staffName(prof ?? {}, { tag: true }),
      roles: roles.map((r) => ROLE_LABELS[r.role]),
      rows,
    });
  }

  const [{ data: rules }, { data: groups }, { data: hist }] = await Promise.all([
    auth.svc.from('capability_grants').select('id, capability, effect, expires_at, note, user_id, group_id, granted_by, created_at').order('created_at', { ascending: false }),
    auth.svc.from('meeting_groups').select('id, name, member_ids').order('name'),
    auth.svc.from('audit_log').select('id, created_at, actor_name, action, summary').eq('entity_type', 'access').order('created_at', { ascending: false }).limit(60),
  ]);
  const ids = [...new Set((rules ?? []).flatMap((g) => [g.user_id, g.granted_by]).filter((x): x is string => !!x))];
  const { data: profiles } = ids.length
    ? await auth.svc.from('profiles').select('id, display_name, google_first_name, google_last_name, gamer_tag').in('id', ids)
    : { data: [] as { id: string }[] };
  const pname = new Map((profiles ?? []).map((p) => [p.id as string, staffName(p as Parameters<typeof staffName>[0], { tag: true })]));
  const gname = new Map((groups ?? []).map((g) => [g.id as string, g]));
  return NextResponse.json({
    rules: (rules ?? []).map((g) => ({
      id: g.id,
      capability: g.capability,
      label: CAPABILITY_INFO[g.capability as Capability]?.label ?? g.capability,
      effect: g.effect ?? 'grant',
      kind: g.user_id ? 'person' : 'group',
      name: g.user_id ? (pname.get(g.user_id as string) ?? 'Unnamed') : (gname.get(g.group_id as string)?.name ?? 'Group'),
      count: g.group_id ? ((gname.get(g.group_id as string)?.member_ids as string[] | undefined)?.length ?? 0) : undefined,
      expires_at: g.expires_at,
      expired: !!g.expires_at && new Date(g.expires_at as string).getTime() <= Date.now(),
      note: g.note ?? '',
      by: g.granted_by ? (pname.get(g.granted_by as string) ?? '') : '',
      created_at: g.created_at,
    })),
    groups: (groups ?? []).map((g) => ({ id: g.id, name: g.name, count: (g.member_ids as string[]).length })),
    catalog: RULE_CAPABILITIES.map((c) => ({ id: c, ...CAPABILITY_INFO[c] })),
    matrix: {
      roles: ROLE_ORDER.map((r) => ({ id: r, label: ROLE_LABELS[r] })),
      areas: CAP_AREAS,
      rows: (Object.keys(CAPABILITY_INFO) as Capability[]).map((c) => ({ id: c, ...CAPABILITY_INFO[c], roles: CAPABILITY_ROLES[c] })),
    },
    history: hist ?? [],
  });
}

export async function POST(request: Request) {
  const auth = await authorize();
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  const cap = RULE_CAPABILITIES.find((c) => c === b.capability);
  if (!cap) return NextResponse.json({ error: 'That permission is set by roles only, so a rule cannot change it.' }, { status: 400 });
  const effect = b.effect === 'deny' ? 'deny' : 'grant';
  const row = b.user_id ? { user_id: String(b.user_id) } : b.group_id ? { group_id: String(b.group_id) } : null;
  if (!row) return NextResponse.json({ error: 'Pick a person or a group.' }, { status: 400 });
  let expires: string | null = null;
  if (b.expires_at) {
    const d = new Date(String(b.expires_at) + (String(b.expires_at).length <= 10 ? 'T23:59:59-08:00' : ''));
    if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) return NextResponse.json({ error: 'The end date has to be in the future.' }, { status: 400 });
    expires = d.toISOString();
  }
  const { error } = await auth.svc.from('capability_grants').insert({
    capability: cap,
    ...row,
    effect,
    expires_at: expires,
    note: String(b.note ?? '')
      .trim()
      .slice(0, 200),
    granted_by: auth.user.id,
  });
  if (error)
    return NextResponse.json(
      { error: error.code === '23505' ? 'There is already a rule like that. Remove it first to change it.' : 'Failed to save.' },
      { status: error.code === '23505' ? 409 : 500 },
    );
  const info = CAPABILITY_INFO[cap];
  await logAudit(auth.svc, {
    actorId: auth.user.id,
    action: effect === 'deny' ? 'deny' : 'grant',
    entityType: 'access',
    summary: `${effect === 'deny' ? 'Took away' : 'Granted'} "${info.label}" ${effect === 'deny' ? 'from' : 'to'} ${b.user_id ? 'a person' : 'a group'}${expires ? ` until ${expires.slice(0, 10)}` : ''}`,
    details: { capability: cap, ...row, effect, expires_at: expires },
  });
  if (row.user_id && effect === 'grant') {
    await createNotifications(auth.svc, [{ user_id: row.user_id, type: 'access_granted', title: `You now have access to ${info.label}`, body: info.about, href: '/portal' }]);
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await authorize();
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  if (!b.id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if ('expires_at' in b) {
    if (!b.expires_at) patch.expires_at = null;
    else {
      const d = new Date(String(b.expires_at) + (String(b.expires_at).length <= 10 ? 'T23:59:59-08:00' : ''));
      if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) return NextResponse.json({ error: 'The end date has to be in the future.' }, { status: 400 });
      patch.expires_at = d.toISOString();
    }
  }
  if (typeof b.note === 'string') patch.note = b.note.trim().slice(0, 200);
  const { data } = await auth.svc.from('capability_grants').select('capability').eq('id', b.id).maybeSingle();
  const { error } = await auth.svc.from('capability_grants').update(patch).eq('id', b.id);
  if (error) return NextResponse.json({ error: 'Failed to save.' }, { status: 500 });
  await logAudit(auth.svc, {
    actorId: auth.user.id,
    action: 'update',
    entityType: 'access',
    summary: `Changed the end date or note of a "${data?.capability ?? ''}" rule`,
    details: patch,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await authorize();
  if ('error' in auth) return auth.error;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
  const { data } = await auth.svc.from('capability_grants').select('capability, user_id, group_id, effect').eq('id', id).maybeSingle();
  const { error } = await auth.svc.from('capability_grants').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed to remove.' }, { status: 500 });
  await logAudit(auth.svc, {
    actorId: auth.user.id,
    action: 'revoke',
    entityType: 'access',
    summary: `Removed a ${data?.effect === 'deny' ? 'take-away' : 'grant'} rule for "${data?.capability ?? ''}"`,
    details: data ?? {},
  });
  return NextResponse.json({ ok: true });
}
