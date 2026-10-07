import { logAudit } from '@/lib/notifications/audit';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/portal/capabilities';
import { strictUser } from '@/lib/supabase/localAuth';

interface Params { params: Promise<{ id: string }>; }

// Everything an admin may want to know about one account, in one read: identity and sign-in, every role and who granted it, activity
// (tickets, check-ins, meetings), points and rewards, strikes, quarter status, notifications, help tickets and recent audit entries.
// Service-role reads behind the manage_roles check; nothing here is exposed to other roles.
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await strictUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_roles')) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });

  const svc = createServiceClient();
  const [profile, priv, auth, grants, history, tickets, points, redemptions, referred, strikes, attendance, absences, quarters, notifications, help, audit, docsMade, pushes, divisions] = await Promise.all([
    svc.from('profiles').select('*').eq('id', id).maybeSingle(),
    svc.from('profile_private').select('gender, division_interests, platforms, favorite_games').eq('user_id', id).maybeSingle(),
    svc.auth.admin.getUserById(id),
    svc.from('user_roles').select('role, division_id, granted_by, created_at').eq('user_id', id).order('created_at', { ascending: false }),
    svc.from('role_change_log').select('changed_by, before, after, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(8),
    svc.from('tickets').select('status, checked_in_at, created_at, event:events(title, start_date)').eq('user_id', id).order('created_at', { ascending: false }),
    svc.from('point_transactions').select('amount, type, note, created_at, reversed_at').eq('user_id', id).order('created_at', { ascending: false }),
    svc.from('reward_redemptions').select('status').eq('user_id', id),
    svc.from('profiles').select('id', { count: 'exact', head: true }).eq('referred_by', id),
    svc.from('strikes').select('status, category, reason, incident_date, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(8),
    svc.from('meeting_attendance').select('checked_in_at, method, meeting:meetings(title, starts_at)').eq('user_id', id).order('checked_in_at', { ascending: false }).limit(8),
    svc.from('meeting_absences').select('excused', { count: 'exact' }).eq('user_id', id),
    svc.from('officer_quarter_status').select('created_at, quarter:academic_quarters(term, start_year)').eq('user_id', id).order('created_at', { ascending: false }).limit(8),
    svc.from('notifications').select('id, read_at').eq('user_id', id),
    svc.from('help_tickets').select('status, subject, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(5),
    svc.from('audit_log').select('action, entity_type, summary, created_at').eq('actor_id', id).order('created_at', { ascending: false }).limit(8),
    svc.from('docs').select('id', { count: 'exact', head: true }).eq('created_by', id),
    svc.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', id),
    svc.from('divisions').select('id, name'),
  ]);
  if (!profile.data) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

  // Names for every "who did this" id in one lookup.
  const whoIds = new Set<string>();
  (grants.data ?? []).forEach((g) => g.granted_by && whoIds.add(g.granted_by));
  (history.data ?? []).forEach((h) => h.changed_by && whoIds.add(h.changed_by));
  if (profile.data.referred_by) whoIds.add(profile.data.referred_by);
  const { data: names } = whoIds.size ? await svc.from('profiles').select('id, display_name').in('id', [...whoIds]) : { data: [] as { id: string; display_name: string | null }[] };
  const nameOf = new Map((names ?? []).map((n) => [n.id, n.display_name ?? 'Someone']));
  const divName = new Map((divisions.data ?? []).map((d) => [d.id as string, d.name as string]));

  const txns = points.data ?? [];
  const live = txns.filter((t) => !t.reversed_at);
  const tk = tickets.data ?? [];
  const au = auth.data?.user;
  return NextResponse.json({
    profile: profile.data,
    private: priv.data ?? null,
    account: au ? {
      email: au.email ?? null,
      created_at: au.created_at,
      last_sign_in_at: au.last_sign_in_at ?? null,
      providers: [...new Set((au.identities ?? []).map((i) => i.provider))],
      identities: (au.identities ?? []).map((i) => ({ provider: i.provider, email: (i.identity_data as { email?: string } | null)?.email ?? null })),
      confirmed: !!au.email_confirmed_at,
      banned_until: (au as unknown as { banned_until?: string | null }).banned_until ?? null,
    } : null,
    roles: (grants.data ?? []).map((g) => ({ role: g.role, division: g.division_id ? divName.get(g.division_id) ?? null : null, granted_by: g.granted_by ? nameOf.get(g.granted_by) ?? null : null, at: g.created_at })),
    role_history: (history.data ?? []).map((h) => ({ by: h.changed_by ? nameOf.get(h.changed_by) ?? null : null, at: h.created_at, before: h.before, after: h.after })),
    tickets: { total: tk.length, checked_in: tk.filter((t) => t.checked_in_at).length, recent: tk.slice(0, 6) },
    points: { balance: live.reduce((a, t) => a + t.amount, 0), lifetime: live.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0), recent: txns.slice(0, 6) },
    rewards: { redeemed: (redemptions.data ?? []).filter((r) => r.status === 'fulfilled').length, pending: (redemptions.data ?? []).filter((r) => r.status === 'pending').length },
    referral: { code: profile.data.referral_code ?? null, referred_by: profile.data.referred_by ? nameOf.get(profile.data.referred_by) ?? null : null, referred_count: referred.count ?? 0 },
    strikes: strikes.data ?? [],
    meetings: { attended_recent: attendance.data ?? [], absences: absences.count ?? 0, excused: (absences.data ?? []).filter((a) => a.excused).length },
    quarters: quarters.data ?? [],
    notifications: { total: (notifications.data ?? []).length, unread: (notifications.data ?? []).filter((n) => !n.read_at).length, push_devices: pushes.count ?? 0 },
    help: help.data ?? [],
    audit: audit.data ?? [],
    docs_created: docsMade.count ?? 0,
  });
}


// Deletes an account outright, or — if `reassign_to` is given — merges it
// into another account first (e.g. someone who accidentally signed up
// twice: once with a personal Gmail, once with their @ucsd.edu Google
// account, before discovering LinkGoogleSection). See admin_delete_account
// in 20260922020000_add_admin_delete_account.sql for exactly what moves,
// what gets nulled, and what's protected (can't delete yourself through
// this, can't delete the last remaining admin outright).
export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await strictUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_roles')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const reassignTo = typeof body.reassign_to === 'string' && body.reassign_to ? body.reassign_to : null;

  const serviceClient = createServiceClient();
  // Names are read before the rows are gone, for the audit trail.
  const { data: target } = await serviceClient.from('profiles').select('display_name').eq('id', id).maybeSingle();
  const { data: mergeInto } = reassignTo ? await serviceClient.from('profiles').select('display_name').eq('id', reassignTo).maybeSingle() : { data: null };
  const { error: rpcError } = await serviceClient.rpc('admin_delete_account', {
    _user_id: id,
    _admin_id: user.id,
    _reassign_to: reassignTo,
  });
  if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 400 });

  // The RPC only removes the public.profiles row (and everything that
  // cascades/reassigns from it) — the actual auth account (auth.users,
  // its identities, sessions) only goes away through the Admin API.
  const { error: authError } = await serviceClient.auth.admin.deleteUser(id);
  if (authError) return NextResponse.json({ error: `Account data was removed, but deleting the login itself failed: ${authError.message}` }, { status: 500 });

  await logAudit(serviceClient, {
    actorId: user.id,
    action: reassignTo ? 'merge' : 'delete',
    entityType: 'account',
    entityId: id,
    summary: reassignTo
      ? `Account "${target?.display_name ?? 'unnamed'}" merged into "${mergeInto?.display_name ?? 'another account'}" and removed`
      : `Account "${target?.display_name ?? 'unnamed'}" deleted`,
    details: reassignTo ? { merged_into: reassignTo } : null,
  });

  return NextResponse.json({ ok: true });
}
