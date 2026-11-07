import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/notifications/audit';
import { createNotifications } from '@/lib/notifications/notify';
import { ROLE_LABELS } from '@/types/database';
import { authorizeDoc, bad, docCan, loadDocActor, namesOf, UUID, DOC_LIST_COLUMNS, type DocListsRow } from '@/lib/docs/docsServer';
import { notifyDocs } from '@/lib/docs/docsLive';
import { canAccess, cleanClubEntries, describeEntries, effectiveClubLists, matches, type AccessEntry, type ClubDocLists } from '@/lib/docs/access';

export const dynamic = 'force-dynamic';

const pacificDay = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86400000 - 8 * 3600000).toISOString().slice(0, 10);

async function teamNames(svc: ReturnType<typeof createServiceClient>) {
  const { data } = await svc.from('meeting_groups').select('id, name');
  return new Map((data ?? []).map((g) => [g.id as string, g.name as string]));
}
async function divisionNames(svc: ReturnType<typeof createServiceClient>) {
  const { data } = await svc.from('divisions').select('id, name');
  return new Map((data ?? []).map((g) => [g.id as string, g.name as string]));
}
const sentence = async (svc: ReturnType<typeof createServiceClient>, entries: AccessEntry[]) => {
  const [teams, divs] = await Promise.all([teamNames(svc), divisionNames(svc)]);
  return describeEntries(entries, {
    team: (id) => teams.get(id) ?? 'A team',
    division: (id) => divs.get(id) ?? 'a division',
    roleLabel: (r) => (ROLE_LABELS as Record<string, string>)[r] ?? r,
  });
};

// Sharing for one club doc.
//   GET ?id=                    (editors) { read, edit, custom, teams, divisions, requests, log }: the two lists, who asked for access, and what changed
//   GET ?id=&check=<person id>  (editors) { name, read, edit, why: [...] }: can this person read or edit it, and which entries let them in
//   GET ?id=&search=<text>      (editors) { matches: [{ id, name }] }: people to add (names only)
//   GET ?id=&mine=1             (anyone) { exists, canRead, requested }: for the "request access" screen of a doc someone cannot open (never the title)
//   PUT { id, read_access, edit_access }       (editors) change who reads and who edits; the person saving stays an editor
//   POST { id, message? }                       (anyone who cannot read it) ask for access: the editors are told
//   PATCH { id, request_id, decision: 'approve' | 'deny', days? }  (editors) let them in (for days, or for good) or turn them down
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id') ?? '';
  if (url.searchParams.get('mine')) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return bad('Unauthorized', 401);
    if (!UUID.test(id)) return NextResponse.json({ exists: false, canRead: false, requested: false });
    const svc = createServiceClient();
    const [actor, { data: lists }, { data: pending }] = await Promise.all([
      loadDocActor(svc, user.id),
      svc.from('docs').select(DOC_LIST_COLUMNS).eq('id', id).maybeSingle(),
      svc.from('doc_access_requests').select('id').eq('doc_id', id).eq('user_id', user.id).eq('status', 'pending').maybeSingle(),
    ]);
    if (!lists) return NextResponse.json({ exists: false, canRead: false, requested: false });
    const can = docCan(actor, lists as unknown as ClubDocLists);
    return NextResponse.json({ exists: true, canRead: can.read || can.edit, requested: !!pending });
  }

  const auth = await authorizeDoc(id, 'edit');
  if ('error' in auth) return auth.error;
  const { svc, lists } = auth;

  const search = url.searchParams.get('search');
  if (search !== null) {
    const q = search.trim();
    if (q.length < 2) return NextResponse.json({ matches: [] });
    const ids = new Set<string>();
    if (q.includes('@')) {
      const { data: found } = await svc.rpc('find_users_by_emails', { _emails: [q.toLowerCase()] });
      for (const r of (found ?? []) as { user_id: string }[]) ids.add(r.user_id);
    }
    const { data: byName } = await svc
      .from('profiles')
      .select('id')
      .ilike('display_name', `%${q.replace(/[%_]/g, '')}%`)
      .limit(8);
    for (const p of byName ?? []) ids.add(p.id as string);
    const names = await namesOf(svc, [...ids].slice(0, 8));
    return NextResponse.json({ matches: [...ids].slice(0, 8).map((i) => ({ id: i, name: names.get(i) ?? 'Unnamed' })) });
  }

  const check = url.searchParams.get('check');
  if (check) {
    if (!UUID.test(check)) return bad('Pick a person.');
    const who = await loadDocActor(svc, check);
    const can = docCan(who, lists as unknown as ClubDocLists);
    const eff = effectiveClubLists(lists as unknown as ClubDocLists);
    const why: string[] = [];
    if (who.staff) why.push('Exec and admin can always read and edit.');
    if (lists.read_access === null && who.hasView) why.push('Has the docs permission, and this doc has no read list of its own.');
    if (lists.edit_access === null && who.hasManage) why.push('Can manage docs, and this doc has no edit list of its own.');
    const hits = (list: AccessEntry[], label: string) => list.filter((e) => matches(e, who.ctx)).forEach((e) => why.push(`${label}: ${describeEntriesSync([e])}`));
    if (lists.read_access !== null) hits(eff.read, 'On the read list');
    if (lists.edit_access !== null) hits(eff.edit, 'On the edit list');
    const names = await namesOf(svc, [check]);
    return NextResponse.json({ name: names.get(check) ?? 'That person', read: can.read || can.edit, edit: can.edit, why });
  }

  const eff = effectiveClubLists(lists as unknown as ClubDocLists);
  const [teams, divs, { data: reqs }, { data: log }] = await Promise.all([
    svc.from('meeting_groups').select('id, name').order('name'),
    svc.from('divisions').select('id, name').order('name'),
    svc.from('doc_access_requests').select('id, user_id, message, created_at').eq('doc_id', id).eq('status', 'pending').order('created_at'),
    svc.from('doc_access_log').select('id, at, actor_id, summary').eq('doc_id', id).order('at', { ascending: false }).limit(20),
  ]);
  const names = await namesOf(svc, [...(reqs ?? []).map((r) => r.user_id as string), ...(log ?? []).map((l) => l.actor_id as string | null)]);
  return NextResponse.json({
    read: eff.read,
    edit: eff.edit,
    custom: eff.custom,
    readText: await sentence(svc, eff.read),
    editText: await sentence(svc, eff.edit),
    teams: (teams.data ?? []).map((t) => ({ id: t.id as string, name: t.name as string })),
    divisions: (divs.data ?? []).map((d) => ({ id: d.id as string, name: d.name as string })),
    requests: (reqs ?? []).map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      name: names.get(r.user_id as string) ?? 'Someone',
      message: (r.message as string) ?? '',
      at: r.created_at as string,
    })),
    log: (log ?? []).map((l) => ({
      id: l.id as string,
      at: l.at as string,
      by: l.actor_id ? (names.get(l.actor_id as string) ?? 'Someone') : 'Someone',
      summary: l.summary as string,
    })),
  });
}

// (a sentence for one entry, without names for teams and people: only used to explain a match)
const describeEntriesSync = (e: AccessEntry[]) => describeEntries(e, { roleLabel: (r) => (ROLE_LABELS as Record<string, string>)[r] ?? r });

export async function PUT(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { id?: string; read_access?: unknown; edit_access?: unknown };
  const auth = await authorizeDoc(String(b.id ?? ''), 'edit');
  if ('error' in auth) return auth.error;
  const { svc, user, actor, lists } = auth;
  const id = String(b.id);
  const before = effectiveClubLists(lists as unknown as ClubDocLists);
  const read = b.read_access === undefined ? before.read : cleanClubEntries(b.read_access);
  let edit = b.edit_access === undefined ? before.edit : cleanClubEntries(b.edit_access);
  // whoever saves stays an editor, so nobody locks themselves out
  if (!actor.staff && !canAccess(edit, actor.ctx)) edit = [...edit, { t: 'person', id: user.id }];
  const { error } = await svc.from('docs').update({ read_access: read, edit_access: edit }).eq('id', id);
  if (error) return bad('Could not save that. Try again.', 500);
  const [from, to] = await Promise.all([Promise.all([sentence(svc, before.read), sentence(svc, before.edit)]), Promise.all([sentence(svc, read), sentence(svc, edit)])]);
  const parts: string[] = [];
  if (from[0] !== to[0]) parts.push(`Who can read: ${from[0]} → ${to[0]}`);
  if (from[1] !== to[1]) parts.push(`Who can edit: ${from[1]} → ${to[1]}`);
  if (parts.length) {
    await svc
      .from('doc_access_log')
      .insert({ doc_id: id, actor_id: user.id, summary: parts.join('. ').slice(0, 900), before: { read: before.read, edit: before.edit }, after: { read, edit } });
    const { data: d } = await svc.from('docs').select('title').eq('id', id).maybeSingle();
    await logAudit(svc, { actorId: user.id, action: 'update', entityType: 'doc', entityId: id, summary: `Changed who can see the doc “${d?.title ?? ''}”` });
  }
  await notifyDocs();
  return NextResponse.json({ ok: true, read, edit });
}

export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { id?: string; message?: string };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return bad('Unauthorized', 401);
  const id = String(b.id ?? '');
  if (!UUID.test(id)) return bad('That doc does not exist.', 404);
  const svc = createServiceClient();
  const [actor, { data: doc }] = await Promise.all([
    loadDocActor(svc, user.id),
    svc.from('docs').select('id, title, created_by, updated_by, read_access, edit_access').eq('id', id).maybeSingle(),
  ]);
  if (!doc) return bad('That doc does not exist.', 404);
  const can = docCan(actor, doc as unknown as ClubDocLists);
  if (can.read || can.edit) return bad('You can already read this doc.', 409);
  const message = String(b.message ?? '')
    .trim()
    .slice(0, 300);
  const { error } = await svc.from('doc_access_requests').insert({ doc_id: id, user_id: user.id, message });
  if (error) return NextResponse.json({ ok: true, already: true }); // one waiting request per person
  // tell the people who can say yes: persons on the edit list, its author and last editor; if none, exec and admin
  const edit = (doc.edit_access as AccessEntry[] | null) ?? [];
  const to = new Set<string>(
    [...edit.filter((e) => e.t === 'person').map((e) => (e as { id: string }).id), doc.created_by as string, doc.updated_by as string].filter(Boolean) as string[],
  );
  to.delete(user.id);
  if (to.size === 0) {
    const { data: staff } = await svc.from('user_roles').select('user_id').in('role', ['exec', 'admin']);
    for (const s of staff ?? []) to.add(s.user_id as string);
  }
  const names = await namesOf(svc, [user.id]);
  await createNotifications(
    svc,
    [...to].map((user_id) => ({
      user_id,
      type: 'doc_access_request',
      title: `${names.get(user.id) ?? 'Someone'} asked for access to “${doc.title}”`,
      body: message || 'Open the doc’s Share box to say yes or no.',
      href: `/portal/docs?id=${id}&share=1`,
    })),
  );
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { id?: string; request_id?: string; decision?: string; days?: number };
  const auth = await authorizeDoc(String(b.id ?? ''), 'edit');
  if ('error' in auth) return auth.error;
  const { svc, user, lists } = auth;
  const id = String(b.id);
  if (!UUID.test(String(b.request_id ?? '')) || (b.decision !== 'approve' && b.decision !== 'deny')) return bad('Pick a request and say yes or no.');
  const { data: req } = await svc.from('doc_access_requests').select('id, user_id, status').eq('id', b.request_id).eq('doc_id', id).maybeSingle();
  if (!req || req.status !== 'pending') return bad('That request was already answered.', 409);
  const { data: doc } = await svc.from('docs').select('title').eq('id', id).maybeSingle();
  const names = await namesOf(svc, [req.user_id as string]);
  let until: string | undefined;
  if (b.decision === 'approve') {
    const days = Number(b.days);
    if (Number.isFinite(days) && days > 0) until = pacificDay(Math.min(Math.round(days), 365));
    const eff = effectiveClubLists(lists as unknown as ClubDocLists);
    const entry: AccessEntry = { t: 'person', id: req.user_id as string, name: names.get(req.user_id as string), ...(until ? { until } : {}) };
    const read = [...eff.read.filter((e) => !(e.t === 'person' && e.id === req.user_id)), entry];
    await svc.from('docs').update({ read_access: read, edit_access: eff.edit }).eq('id', id);
    await svc
      .from('doc_access_log')
      .insert({ doc_id: id, actor_id: user.id, summary: `Let ${names.get(req.user_id as string) ?? 'someone'} read it${until ? ` until ${until}` : ''} (they asked)` });
  } else {
    await svc.from('doc_access_log').insert({ doc_id: id, actor_id: user.id, summary: `Turned down ${names.get(req.user_id as string) ?? 'someone'}’s request` });
  }
  await svc
    .from('doc_access_requests')
    .update({ status: b.decision === 'approve' ? 'approved' : 'denied', resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq('id', req.id);
  await createNotifications(svc, [
    {
      user_id: req.user_id as string,
      type: 'doc_access_answer',
      title: b.decision === 'approve' ? `You can now read “${doc?.title ?? 'the doc'}”` : `Your request for “${doc?.title ?? 'the doc'}” was turned down`,
      body: b.decision === 'approve' ? (until ? `Until ${until}.` : null) : null,
      href: b.decision === 'approve' ? `/portal/docs?id=${id}` : null,
    },
  ]);
  await notifyDocs();
  return NextResponse.json({ ok: true });
}
