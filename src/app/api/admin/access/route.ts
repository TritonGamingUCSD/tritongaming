import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability, GRANTABLE_CAPABILITIES, CAPABILITY_ROLES } from '@/lib/capabilities';
import { logAudit } from '@/lib/audit';
import { createNotifications } from '@/lib/notify';
import { ROLE_LABELS } from '@/types/database';

export const dynamic = 'force-dynamic';

async function authorize() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_roles')) return { error: NextResponse.json({ error: 'Only admins can manage access.' }, { status: 403 }) };
  return { user, svc: createServiceClient() };
}

// GET: the permissions that can be handed out, who has them, and the saved groups to pick from.
// GET ?q=name: find people to grant to.
export async function GET(request: Request) {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const q = new URL(request.url).searchParams.get('q')?.trim();
  if (q !== undefined && q !== null && new URL(request.url).searchParams.has('q')) {
    if (q.length < 2) return NextResponse.json({ people: [] });
    const like = `%${q.replace(/[%_,()]/g, ' ')}%`;
    const { data } = await auth.svc.from('profiles').select('id, display_name, google_first_name, google_last_name').or(`display_name.ilike.${like},google_first_name.ilike.${like},google_last_name.ilike.${like}`).limit(8);
    return NextResponse.json({ people: (data ?? []).map((p) => ({ id: p.id, name: [p.google_first_name, p.google_last_name].filter(Boolean).join(' ') || p.display_name || 'Unnamed', shown: p.display_name })) });
  }
  const [{ data: grants }, { data: groups }] = await Promise.all([
    auth.svc.from('capability_grants').select('id, capability, user_id, group_id, created_at').order('created_at'),
    auth.svc.from('meeting_groups').select('id, name, member_ids').order('name'),
  ]);
  const userIds = [...new Set((grants ?? []).map((g) => g.user_id as string | null).filter((x): x is string => !!x))];
  const { data: profiles } = userIds.length ? await auth.svc.from('profiles').select('id, display_name, google_first_name, google_last_name').in('id', userIds) : { data: [] as { id: string; display_name: string | null; google_first_name: string | null; google_last_name: string | null }[] };
  const pname = new Map((profiles ?? []).map((p) => [p.id as string, [p.google_first_name, p.google_last_name].filter(Boolean).join(' ') || (p.display_name as string | null) || 'Unnamed']));
  const gname = new Map((groups ?? []).map((g) => [g.id as string, g]));
  return NextResponse.json({
    capabilities: GRANTABLE_CAPABILITIES.map((c) => ({
      ...c,
      byRole: CAPABILITY_ROLES[c.id].map((r) => ROLE_LABELS[r]),
      grants: (grants ?? []).filter((g) => g.capability === c.id).map((g) => g.user_id
        ? { id: g.id, kind: 'person' as const, name: pname.get(g.user_id as string) ?? 'Unnamed' }
        : { id: g.id, kind: 'group' as const, name: gname.get(g.group_id as string)?.name ?? 'Group', count: (gname.get(g.group_id as string)?.member_ids as string[] | undefined)?.length ?? 0 }),
    })),
    groups: (groups ?? []).map((g) => ({ id: g.id, name: g.name, count: (g.member_ids as string[]).length })),
  });
}

export async function POST(request: Request) {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const cap = GRANTABLE_CAPABILITIES.find((c) => c.id === b.capability);
  if (!cap) return NextResponse.json({ error: 'That permission can’t be handed out.' }, { status: 400 });
  const row = b.user_id ? { user_id: String(b.user_id) } : b.group_id ? { group_id: String(b.group_id) } : null;
  if (!row) return NextResponse.json({ error: 'Pick a person or a group.' }, { status: 400 });
  const { error } = await auth.svc.from('capability_grants').insert({ capability: cap.id, ...row, granted_by: auth.user.id });
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'They already have that.' : 'Failed to save.' }, { status: error.code === '23505' ? 409 : 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'grant', entityType: 'access', summary: `Granted "${cap.label}" to ${b.user_id ? 'a person' : 'a group'}`, details: { capability: cap.id, ...row } });
  if (row.user_id) {
    await createNotifications(auth.svc, [{ user_id: row.user_id, type: 'access_granted', title: `You now have access to ${cap.label}`, body: cap.description, href: '/portal' }]);
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
  const { data } = await auth.svc.from('capability_grants').select('capability, user_id, group_id').eq('id', id).maybeSingle();
  const { error } = await auth.svc.from('capability_grants').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed to remove.' }, { status: 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'revoke', entityType: 'access', summary: `Removed a "${data?.capability ?? ''}" grant`, details: data ?? {} });
  return NextResponse.json({ ok: true });
}
