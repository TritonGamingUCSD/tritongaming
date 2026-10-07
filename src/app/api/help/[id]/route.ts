import { NextResponse } from 'next/server';
import { authorizeHelp, notify, signAttachments, HELP_STATUSES, type HelpMessageRow, type HelpTicketRow } from '@/lib/help';

export const dynamic = 'force-dynamic';

async function load(auth: Exclude<Awaited<ReturnType<typeof authorizeHelp>>, { error: NextResponse }>, id: string) {
  const { data } = await auth.svc.from('help_tickets').select('*').eq('id', id).maybeSingle();
  const t = data as HelpTicketRow | null;
  if (!t || (t.user_id !== auth.user.id && !auth.isStaff)) return null;
  return t;
}

// The ticket with its whole conversation. Staff see the page/device details too.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeHelp();
  if (auth.error) return auth.error;
  const { id } = await params;
  const t = await load(auth, id);
  if (!t) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
  const { data: msgs } = await auth.svc.from('help_messages').select('*').eq('ticket_id', id).order('created_at');
  const messages = (msgs ?? []) as HelpMessageRow[];
  const ids = [...new Set([t.user_id, t.assigned_to, ...messages.map((m) => m.author_id)].filter((x): x is string => !!x))];
  const { data: people } = await auth.svc.from('profiles').select('id, display_name').in('id', ids);
  const names = new Map((people ?? []).map((p) => [p.id as string, (p.display_name as string | null) || 'Unnamed']));
  const signed = await signAttachments(auth.svc, messages.flatMap((m) => m.attachments));
  const urlOf = new Map(signed.map((s) => [s.path, s.url]));
  const staffAuthors = new Set((await auth.svc.from('user_roles').select('user_id').in('role', ['exec', 'admin']).in('user_id', ids)).data?.map((r) => r.user_id as string) ?? []);
  // Admins see an "Approve this role" box on a role request: the roles a request can ask for, the person's current ones, and the divisions to pick from.
  const asksRole = auth.canGrantRoles && t.user_id !== auth.user.id && /^role (or access )?request/i.test(t.subject);
  const [{ data: have }, { data: divs }] = asksRole ? await Promise.all([
    auth.svc.from('user_roles').select('role, division_id').eq('user_id', t.user_id),
    auth.svc.from('divisions').select('id, name').order('name'),
  ]) : [{ data: null }, { data: null }];
  return NextResponse.json({
    isStaff: auth.isStaff,
    roleGrant: asksRole ? { have: have ?? [], divisions: divs ?? [] } : null,
    ticket: { ...t, user_agent: auth.isStaff ? t.user_agent : null, page: auth.isStaff ? t.page : null, user_name: names.get(t.user_id) ?? 'Unnamed', assignee_name: t.assigned_to ? names.get(t.assigned_to) ?? null : null },
    messages: messages.map((m) => ({
      id: m.id, body: m.body, created_at: m.created_at, author_id: m.author_id, author_name: names.get(m.author_id) ?? 'Unnamed',
      from_staff: m.author_id !== t.user_id && staffAuthors.has(m.author_id),
      attachments: m.attachments.map((p) => urlOf.get(p)).filter((u): u is string => !!u),
    })),
  });
}

// Staff: set status / assign. The person who asked can mark their own ticket resolved (replying reopens it).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeHelp();
  if (auth.error) return auth.error;
  const { id } = await params;
  const t = await load(auth, id);
  if (!t) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('status' in b) {
    if (!HELP_STATUSES.some((s) => s.id === b.status)) return NextResponse.json({ error: 'Unknown status.' }, { status: 400 });
    if (!auth.isStaff && b.status !== 'resolved') return NextResponse.json({ error: 'You can only mark your own ticket resolved.' }, { status: 403 });
    patch.status = b.status;
    patch.resolved_at = b.status === 'resolved' ? new Date().toISOString() : null;
  }
  if ('assigned_to' in b) {
    if (!auth.isStaff) return NextResponse.json({ error: 'Only exec and admins can assign tickets.' }, { status: 403 });
    if (b.assigned_to) {
      const { data: ok } = await auth.svc.from('user_roles').select('user_id').eq('user_id', b.assigned_to).in('role', ['exec', 'admin']).limit(1);
      if (!ok?.length) return NextResponse.json({ error: 'Tickets can only be assigned to exec or admins.' }, { status: 400 });
    }
    patch.assigned_to = b.assigned_to || null;
    if (b.assigned_to && t.status === 'open' && !('status' in b)) patch.status = 'in_progress';
  }
  if (Object.keys(patch).length === 1) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  const { error } = await auth.svc.from('help_tickets').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed to update.' }, { status: 500 });
  if (auth.isStaff && patch.status === 'resolved' && t.user_id !== auth.user.id) {
    await notify(auth.svc, [t.user_id], { title: `Resolved: ${t.subject}`, body: 'Your help ticket was marked resolved. Reply on it if you still need help.', href: `/portal/help?ticket=${id}` });
  }
  return NextResponse.json({ ok: true });
}
