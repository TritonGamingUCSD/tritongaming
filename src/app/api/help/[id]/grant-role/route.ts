import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { authorizeHelp, notify, type HelpTicketRow } from '@/lib/help';

export const dynamic = 'force-dynamic';

const GRANTABLE = ['officer', 'lead', 'division'] as const;

// Admins only: approve a role request. Gives the person the role they asked for, answers on the ticket, tells them, and resolves it.
// { role: 'officer' | 'lead' | 'division', division_id? }. The person's other roles are kept; an officer or lead role replaces nothing else, a division is added to any they lead.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeHelp();
  if (auth.error) return auth.error;
  if (!auth.canGrantRoles) return NextResponse.json({ error: 'Only admins can approve roles.' }, { status: 403 });
  const { id } = await params;
  const { data } = await auth.svc.from('help_tickets').select('*').eq('id', id).maybeSingle();
  const t = data as HelpTicketRow | null;
  if (!t) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
  if (t.user_id === auth.user.id) return NextResponse.json({ error: 'You can’t approve your own request.' }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const role = String(b.role ?? '') as (typeof GRANTABLE)[number];
  if (!GRANTABLE.includes(role)) return NextResponse.json({ error: 'Choose a role to give.' }, { status: 400 });
  let divisionName: string | null = null;
  const divisionId = role === 'division' ? String(b.division_id ?? '') : null;
  if (role === 'division') {
    const { data: d } = divisionId ? await auth.svc.from('divisions').select('id, name').eq('id', divisionId).maybeSingle() : { data: null };
    if (!d) return NextResponse.json({ error: 'Choose a division.' }, { status: 400 });
    divisionName = d.name as string;
  }
  const { data: current } = await auth.svc.from('user_roles').select('role, division_id').eq('user_id', t.user_id);
  const existing = current ?? [];
  const has = role === 'division' ? existing.some((r) => r.role === 'division' && r.division_id === divisionId) : existing.some((r) => r.role === role);
  const label = role === 'division' ? `Division Lead (${divisionName})` : role === 'officer' ? 'Officer' : 'Lead';
  if (!has) {
    const next = role === 'division' ? [...existing, { role, division_id: divisionId }] : [...existing.filter((r) => r.role !== role), { role, division_id: null }];
    const { error } = await auth.svc.rpc('admin_set_user_roles', { _user_id: t.user_id, _roles: next, _granted_by: auth.user.id });
    if (error) return NextResponse.json({ error: 'Couldn’t give the role.' }, { status: 500 });
  }
  const { data: who } = await auth.svc.from('profiles').select('display_name').eq('id', t.user_id).maybeSingle();
  await auth.svc.from('help_messages').insert({ ticket_id: id, author_id: auth.user.id, body: `Approved: you are now ${label}. It shows up the next time you open the portal.`, attachments: [] });
  await auth.svc.from('help_tickets').update({ status: 'resolved', resolved_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_from_user: false, assigned_to: t.assigned_to ?? auth.user.id }).eq('id', id);
  await notify(auth.svc, [t.user_id], { title: `Role approved: ${label}`, body: 'Your role request was approved. Reload the portal to see your new tools.', href: `/portal/help?ticket=${id}` });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'roles', entityId: t.user_id, summary: `Approved a role request: "${who?.display_name ?? 'someone'}" is now ${label}`, details: { ticket_id: id, role, division_id: divisionId } });
  return NextResponse.json({ ok: true });
}
