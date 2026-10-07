import { NextResponse } from 'next/server';
import { authorizeHelp, cleanAttachments, describeAgent, notify, staffIds, HELP_CATEGORIES, MAX_BODY, MAX_SUBJECT, type HelpTicketRow } from '@/lib/notifications/help';

export const dynamic = 'force-dynamic';

// GET: my tickets, or (staff, ?scope=all) every ticket. POST: open a new ticket.
export async function GET(request: Request) {
  const auth = await authorizeHelp();
  if (auth.error) return auth.error;
  const all = auth.isStaff && new URL(request.url).searchParams.get('scope') === 'all';
  let q = auth.svc.from('help_tickets').select('*').order('updated_at', { ascending: false }).limit(200);
  if (!all) q = q.eq('user_id', auth.user.id);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: 'Failed to load tickets.' }, { status: 500 });
  const tickets = (data ?? []) as HelpTicketRow[];
  const ids = [...new Set(tickets.flatMap((t) => [t.user_id, t.assigned_to].filter((x): x is string => !!x)))];
  const { data: people } = ids.length ? await auth.svc.from('profiles').select('id, display_name').in('id', ids) : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.id as string, (p.display_name as string | null) || 'Unnamed']));
  return NextResponse.json({
    isStaff: auth.isStaff,
    tickets: tickets.map((t) => ({ ...t, user_agent: undefined, user_name: names.get(t.user_id) ?? 'Unnamed', assignee_name: t.assigned_to ? names.get(t.assigned_to) ?? null : null })),
  });
}

export async function POST(request: Request) {
  const auth = await authorizeHelp();
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const subject = String(b.subject ?? '').trim().slice(0, MAX_SUBJECT);
  const body = String(b.body ?? '').trim().slice(0, MAX_BODY);
  const category = HELP_CATEGORIES.some((c) => c.id === b.category) ? b.category : 'other';
  if (!subject || !body) return NextResponse.json({ error: 'Add a short title and describe what’s going on.' }, { status: 400 });
  // Rate limit: a handful of open tickets at a time is plenty.
  const { count } = await auth.svc.from('help_tickets').select('id', { count: 'exact', head: true }).eq('user_id', auth.user.id).neq('status', 'resolved');
  if ((count ?? 0) >= 5) return NextResponse.json({ error: 'You already have 5 open tickets. Wait for a reply or close one first.' }, { status: 429 });
  const page = String(b.page ?? '').slice(0, 200) || null;
  const { data: t, error } = await auth.svc.from('help_tickets').insert({
    user_id: auth.user.id, category, subject, page, user_agent: `${describeAgent(request.headers.get('user-agent'))}${b.viewport ? ` · ${String(b.viewport).slice(0, 20)}` : ''}`,
  }).select('id').single();
  if (error || !t) return NextResponse.json({ error: 'Failed to open the ticket.' }, { status: 500 });
  await auth.svc.from('help_messages').insert({ ticket_id: t.id, author_id: auth.user.id, body, attachments: cleanAttachments(b.attachments, auth.user.id) });
  const staff = (await staffIds(auth.svc)).filter((id) => id !== auth.user.id);
  const { data: me } = await auth.svc.from('profiles').select('display_name').eq('id', auth.user.id).maybeSingle();
  await notify(auth.svc, staff, { title: `New help ticket: ${subject}`, body: `From ${me?.display_name ?? 'a member'}`, href: `/portal/help/inbox?ticket=${t.id}` });
  return NextResponse.json({ id: t.id }, { status: 201 });
}
