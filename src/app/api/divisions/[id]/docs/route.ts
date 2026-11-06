import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { strictUser } from '@/lib/supabase/localAuth';
import { canDivisionAction, divisionLevel } from '@/lib/portal/divisionAccess';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';
import { withGrantedCapabilities } from '@/lib/portal/capabilities';
import { logAudit } from '@/lib/notifications/audit';
import { invalidate } from '@/lib/site/revalidate';
import { audienceOf, canAccess, canRead, cleanEntries, divisionDefaults, opensWide, type AccessContext, type AccessEntry } from '@/lib/docs/access';
import { refuseBlocked } from '@/lib/wordfilter/server';

export const dynamic = 'force-dynamic';

const COLS = 'id, title, body, audience, read_access, edit_access, updated_at';

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
  const { data: groups } = await svc.from('meeting_groups').select('id').contains('member_ids', [user.id]);
  const ctx: AccessContext = { userId: user.id, roles, teamIds: (groups ?? []).map((g) => g.id as string) };
  const staff = roles.some((r) => r.role === 'exec' || r.role === 'admin');
  return { user, svc, level, ctx, staff, canWrite: canDivisionAction(roles, id, 'write_docs') };
}

type DocRow = { id: string; title: string; body: string; audience: string; read_access: AccessEntry[] | null; edit_access: AccessEntry[] | null; updated_at: string };

// Add what the screen needs to each doc: may this person edit it?
const shape = (d: DocRow, ctx: AccessContext) => ({ ...d, read_access: d.read_access ?? [], edit_access: d.edit_access ?? [], canEdit: canAccess(d.edit_access, ctx) });

// The docs this person may read (a doc is readable by anyone on its read list or its edit list, and by exec and admin), newest edit first. { docs: [{ id, title, body, audience, read_access, edit_access, canEdit, updated_at }], canWrite }.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = await who(id, 'read_docs');
  if ('error' in w) return w.error;
  const { data } = await w.svc.from('division_docs').select(COLS).eq('division_id', id).order('updated_at', { ascending: false }).limit(200);
  const docs = ((data ?? []) as DocRow[]).filter((d) => canRead(d.read_access, d.edit_access, w.ctx)).map((d) => shape(d, w.ctx));
  // The saved groups (teams) a doc can be shared with, by name.
  const { data: teams } = await w.svc.from('meeting_groups').select('id, name').order('name');
  return NextResponse.json({ docs, canWrite: w.canWrite, level: w.level, teams: (teams ?? []).map((t) => ({ id: t.id as string, name: t.name as string })) });
}

// The two lists as they will be saved. Only a Head (or exec and admin) may open a doc to everyone or to everyone signed in. The person saving always stays on the edit list, so nobody locks themselves out.
function lists(
  b: { read_access?: unknown; edit_access?: unknown },
  divisionId: string,
  w: { level: string; staff: boolean; ctx: AccessContext },
  current?: { read: AccessEntry[]; edit: AccessEntry[] },
): { read: AccessEntry[]; edit: AccessEntry[] } | { error: string } {
  const d = divisionDefaults(divisionId);
  const read = b.read_access === undefined ? (current?.read ?? d.read) : cleanEntries(b.read_access);
  let edit = b.edit_access === undefined ? (current?.edit ?? d.edit) : cleanEntries(b.edit_access);
  if (opensWide(read) && w.level !== 'head' && !w.staff) return { error: 'Only a Head can make a doc readable by everyone.' };
  if (opensWide(edit)) return { error: 'Editing cannot be opened to everyone. Pick roles, teams or people.' };
  if (w.ctx.userId && !canAccess(edit, w.ctx)) edit = [...edit, { t: 'person', id: w.ctx.userId }];
  return { read, edit };
}

function clean(b: { title?: string; body?: string }) {
  return { title: (b.title ?? '').trim().slice(0, 120), body: (b.body ?? '').slice(0, 20000) };
}

// Write one: { title, body?, read_access?, edit_access? }. Without lists it starts readable by the division's Heads and Members and editable by its Heads (and the writer).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = await who(id, 'write_docs');
  if ('error' in w) return w.error;
  const b = (await request.json().catch(() => ({}))) as { title?: string; body?: string; read_access?: unknown; edit_access?: unknown };
  const v = clean(b);
  if (!v.title) return NextResponse.json({ error: 'Give the doc a title.' }, { status: 400 });
  const blocked = await refuseBlocked({ Title: v.title, Document: v.body });
  if (blocked) return blocked;
  const l = lists(b, id, w);
  if ('error' in l) return NextResponse.json({ error: l.error }, { status: 403 });
  const audience = audienceOf(l.read, id);
  const { data, error } = await w.svc
    .from('division_docs')
    .insert({ division_id: id, ...v, audience, read_access: l.read, edit_access: l.edit, created_by: w.user.id, updated_by: w.user.id })
    .select(COLS)
    .single();
  if (error) return NextResponse.json({ error: 'Could not save that. Try again.' }, { status: 500 });
  await logAudit(w.svc, { actorId: w.user.id, action: 'create', entityType: 'division doc', entityId: data.id as string, summary: `Wrote the division doc “${v.title}”` });
  if (audience === 'public') invalidate('divisions');
  return NextResponse.json({ doc: shape(data as DocRow, w.ctx) }, { status: 201 });
}

// Change one: { id, title, body?, read_access?, edit_access? }. Only someone on the doc's edit list (or exec and admin) may; they can also change who reads and edits it.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = await who(id, 'read_docs');
  if ('error' in w) return w.error;
  const b = (await request.json().catch(() => ({}))) as { id?: string; title?: string; body?: string; read_access?: unknown; edit_access?: unknown };
  const v = clean(b);
  if (!b.id || !v.title) return NextResponse.json({ error: 'Say which doc, and give it a title.' }, { status: 400 });
  const blocked = await refuseBlocked({ Title: v.title, Document: v.body });
  if (blocked) return blocked;
  const { data: cur } = await w.svc.from('division_docs').select('audience, read_access, edit_access').eq('id', b.id).eq('division_id', id).maybeSingle();
  if (!cur || !canRead(cur.read_access as AccessEntry[], cur.edit_access as AccessEntry[], w.ctx)) return NextResponse.json({ error: 'Doc not found' }, { status: 404 });
  if (!canAccess(cur.edit_access as AccessEntry[], w.ctx)) return NextResponse.json({ error: 'You can read this doc but not change it.' }, { status: 403 });
  const l = lists(b, id, w, { read: (cur.read_access as AccessEntry[]) ?? [], edit: (cur.edit_access as AccessEntry[]) ?? [] });
  if ('error' in l) return NextResponse.json({ error: l.error }, { status: 403 });
  const audience = audienceOf(l.read, id);
  const { data, error } = await w.svc
    .from('division_docs')
    .update({ ...v, audience, read_access: l.read, edit_access: l.edit, updated_by: w.user.id, updated_at: new Date().toISOString() })
    .eq('id', b.id)
    .eq('division_id', id)
    .select(COLS)
    .single();
  if (error) return NextResponse.json({ error: 'Could not save that. Try again.' }, { status: 500 });
  await logAudit(w.svc, { actorId: w.user.id, action: 'update', entityType: 'division doc', entityId: b.id, summary: `Changed the division doc “${v.title}”` });
  if (audience === 'public' || cur.audience === 'public') invalidate('divisions');
  return NextResponse.json({ doc: shape(data as DocRow, w.ctx) });
}

// Remove one: { id }. Only someone on its edit list (or exec and admin).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = await who(id, 'read_docs');
  if ('error' in w) return w.error;
  const b = (await request.json().catch(() => ({}))) as { id?: string };
  if (!b.id) return NextResponse.json({ error: 'Say which one.' }, { status: 400 });
  const { data: cur } = await w.svc.from('division_docs').select('title, audience, read_access, edit_access').eq('id', b.id).eq('division_id', id).maybeSingle();
  if (!cur || !canRead(cur.read_access as AccessEntry[], cur.edit_access as AccessEntry[], w.ctx)) return NextResponse.json({ error: 'Doc not found' }, { status: 404 });
  if (!canAccess(cur.edit_access as AccessEntry[], w.ctx)) return NextResponse.json({ error: 'You can read this doc but not delete it.' }, { status: 403 });
  if (cur.audience === 'public') invalidate('divisions');
  await w.svc.from('division_docs').delete().eq('id', b.id).eq('division_id', id);
  await logAudit(w.svc, { actorId: w.user.id, action: 'delete', entityType: 'division doc', entityId: b.id, summary: `Removed the division doc “${cur.title}”` });
  return NextResponse.json({ ok: true });
}
