import { NextResponse } from 'next/server';
import { authorizeHelp, cleanAttachments, notify, staffIds, MAX_BODY, type HelpTicketRow } from '@/lib/help';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeHelp();
  if (auth.error) return auth.error;
  const { id } = await params;
  const { data } = await auth.svc.from('help_tickets').select('*').eq('id', id).maybeSingle();
  const t = data as HelpTicketRow | null;
  const isOwner = t?.user_id === auth.user.id;
  if (!t || (!isOwner && !auth.isStaff)) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const body = String(b.body ?? '').trim().slice(0, MAX_BODY);
  const attachments = cleanAttachments(b.attachments, auth.user.id);
  if (!body && attachments.length === 0) return NextResponse.json({ error: 'Write a message first.' }, { status: 400 });
  const { error } = await auth.svc.from('help_messages').insert({ ticket_id: id, author_id: auth.user.id, body: body || '(screenshot)', attachments });
  if (error) return NextResponse.json({ error: 'Failed to send.' }, { status: 500 });
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), last_from_user: isOwner };
  // The asker replying reopens a resolved ticket; a handler replying to a fresh ticket picks it up.
  if (isOwner && t.status === 'resolved') { patch.status = 'open'; patch.resolved_at = null; }
  if (!isOwner && t.status === 'open') patch.status = 'in_progress';
  if (!isOwner && !t.assigned_to) patch.assigned_to = auth.user.id;
  await auth.svc.from('help_tickets').update(patch).eq('id', id);
  const href = `/portal?section=help&tab=${isOwner ? 'inbox' : 'mine'}&ticket=${id}`;
  if (isOwner) await notify(auth.svc, (t.assigned_to ? [t.assigned_to] : await staffIds(auth.svc)).filter((u) => u !== auth.user.id), { title: `New reply on: ${t.subject}`, body: body.slice(0, 120), href });
  else await notify(auth.svc, [t.user_id], { title: `Reply to your help ticket: ${t.subject}`, body: body.slice(0, 120), href });
  return NextResponse.json({ ok: true }, { status: 201 });
}
