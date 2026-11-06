import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { strictUser } from '@/lib/supabase/localAuth';
import { canDivisionAction, divisionLevel } from '@/lib/portal/divisionAccess';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';
import { withGrantedCapabilities } from '@/lib/portal/capabilities';
import { logAudit } from '@/lib/notifications/audit';
import { invalidate } from '@/lib/site/revalidate';
import { DOC_AUDIENCES, docVisibleTo, type DocAudience } from '@/lib/divisions/docs';

export const dynamic = 'force-dynamic';

async function who(id: string, action: 'read_docs' | 'write_docs') {
  const userClient = await createClient();
  const {
    data: { user },
  } = await strictUser(userClient);
  if (!user || user.is_anonymous) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const svc = createServiceClient();
  const { data: mine } = await userClient.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const roles = withGrantedCapabilities(mine ?? [], await loadGrantedCapabilities(svc, user.id).catch(() => []));
  if (!canDivisionAction(roles, id, action))
    return { error: NextResponse.json({ error: action === 'write_docs' ? 'Only the division’s Heads and Members can write docs.' : 'Forbidden' }, { status: 403 }) };
  // Exec and admin are not "in" the division but see everything, like a Head.
  const level = divisionLevel(roles, id) ?? 'head';
  return { user, svc, level, canWrite: canDivisionAction(roles, id, 'write_docs') };
}

// The docs this person may read, newest edit first. { docs: [{ id, title, body, audience, updated_at }], canWrite }.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = await who(id, 'read_docs');
  if ('error' in w) return w.error;
  const { data } = await w.svc.from('division_docs').select('id, title, body, audience, updated_at').eq('division_id', id).order('updated_at', { ascending: false }).limit(200);
  const docs = (data ?? []).filter((d) => docVisibleTo(d.audience as DocAudience, w.level));
  return NextResponse.json({ docs, canWrite: w.canWrite });
}

function clean(b: { title?: string; body?: string; audience?: string }) {
  const title = (b.title ?? '').trim().slice(0, 120);
  const audience = (DOC_AUDIENCES as readonly string[]).includes(b.audience ?? '') ? (b.audience as DocAudience) : 'members';
  return { title, body: (b.body ?? '').slice(0, 20000), audience };
}

// Write one: { title, body?, audience? }.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = await who(id, 'write_docs');
  if ('error' in w) return w.error;
  const v = clean((await request.json().catch(() => ({}))) as object);
  if (!v.title) return NextResponse.json({ error: 'Give the doc a title.' }, { status: 400 });
  if (!docVisibleTo(v.audience, w.level)) return NextResponse.json({ error: 'You cannot write a doc only people above you can read.' }, { status: 403 });
  const { data, error } = await w.svc
    .from('division_docs')
    .insert({ division_id: id, ...v, created_by: w.user.id, updated_by: w.user.id })
    .select('id, title, body, audience, updated_at')
    .single();
  if (error) return NextResponse.json({ error: 'Could not save that. Try again.' }, { status: 500 });
  await logAudit(w.svc, { actorId: w.user.id, action: 'create', entityType: 'division doc', entityId: data.id as string, summary: `Wrote the division doc “${v.title}”` });
  if (v.audience === 'public') invalidate('divisions');
  return NextResponse.json({ doc: data }, { status: 201 });
}

// Change one: { id, title, body?, audience? }. A doc only Heads may read can only be changed by a Head.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = await who(id, 'write_docs');
  if ('error' in w) return w.error;
  const b = (await request.json().catch(() => ({}))) as { id?: string };
  const v = clean(b as object);
  if (!b.id || !v.title) return NextResponse.json({ error: 'Say which doc, and give it a title.' }, { status: 400 });
  const { data: cur } = await w.svc.from('division_docs').select('audience').eq('id', b.id).eq('division_id', id).maybeSingle();
  if (!cur || !docVisibleTo(cur.audience as DocAudience, w.level)) return NextResponse.json({ error: 'Doc not found' }, { status: 404 });
  if (!docVisibleTo(v.audience, w.level)) return NextResponse.json({ error: 'You cannot make a doc only people above you can read.' }, { status: 403 });
  const { data, error } = await w.svc
    .from('division_docs')
    .update({ ...v, updated_by: w.user.id, updated_at: new Date().toISOString() })
    .eq('id', b.id)
    .eq('division_id', id)
    .select('id, title, body, audience, updated_at')
    .single();
  if (error) return NextResponse.json({ error: 'Could not save that. Try again.' }, { status: 500 });
  await logAudit(w.svc, { actorId: w.user.id, action: 'update', entityType: 'division doc', entityId: b.id, summary: `Changed the division doc “${v.title}”` });
  if (v.audience === 'public' || cur.audience === 'public') invalidate('divisions');
  return NextResponse.json({ doc: data });
}

// Remove one: { id }.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = await who(id, 'write_docs');
  if ('error' in w) return w.error;
  const b = (await request.json().catch(() => ({}))) as { id?: string };
  if (!b.id) return NextResponse.json({ error: 'Say which one.' }, { status: 400 });
  const { data: cur } = await w.svc.from('division_docs').select('title, audience').eq('id', b.id).eq('division_id', id).maybeSingle();
  if (!cur || !docVisibleTo(cur.audience as DocAudience, w.level)) return NextResponse.json({ error: 'Doc not found' }, { status: 404 });
  if (cur.audience === 'public') invalidate('divisions');
  await w.svc.from('division_docs').delete().eq('id', b.id).eq('division_id', id);
  await logAudit(w.svc, { actorId: w.user.id, action: 'delete', entityType: 'division doc', entityId: b.id, summary: `Removed the division doc “${cur.title}”` });
  return NextResponse.json({ ok: true });
}
