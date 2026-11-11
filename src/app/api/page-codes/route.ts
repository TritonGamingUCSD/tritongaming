import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/portal/capabilities';
import { strictUser } from '@/lib/supabase/localAuth';
import { logAudit } from '@/lib/notifications/audit';
import { refuseBlocked } from '@/lib/wordfilter/server';
import { PAGE_CODE, cleanDestination, randomCode } from '@/lib/pageCodes';
import { siteUrl } from '@/lib/email/template';

export const dynamic = 'force-dynamic';

async function authorize() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await strictUser(supabase);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_page_codes')) return { error: NextResponse.json({ error: 'Page codes are for officers and above.' }, { status: 403 }) };
  const isAdmin = (roles ?? []).some((r) => r.role === 'admin' || r.role === 'exec');
  return { user, svc: createServiceClient(), isAdmin };
}

const COLUMNS = 'id, code, label, destination, note, expires_at, is_active, uses, created_by, created_at';

// The codes, newest first, with what a code could point at (events, tournaments, divisions, photo booth galleries) so the screen can offer them.
export async function GET() {
  const a = await authorize();
  if (a.error) return a.error;
  const [codes, events, tournaments, divisions, booths] = await Promise.all([
    a.svc.from('page_codes').select(COLUMNS).order('created_at', { ascending: false }).limit(500),
    a.svc.from('events').select('title, slug').eq('is_published', true).order('start_time', { ascending: false }).limit(60),
    a.svc.from('tournaments').select('name, slug').eq('is_public', true).order('created_at', { ascending: false }).limit(60),
    a.svc.from('divisions').select('name, slug').order('name').limit(60),
    a.svc.from('photobooths').select('name, gallery_token').order('created_at', { ascending: false }).limit(60),
  ]);
  if (codes.error) return NextResponse.json({ error: 'Could not load the codes.' }, { status: 500 });
  return NextResponse.json({
    codes: codes.data ?? [],
    mine: a.user.id,
    canManageAll: a.isAdmin,
    targets: {
      events: (events.data ?? []).map((e) => ({ label: e.title as string, path: `/events/${e.slug}` })),
      tournaments: (tournaments.data ?? []).map((t) => ({ label: t.name as string, path: `/tournaments/${t.slug}` })),
      divisions: (divisions.data ?? []).map((d) => ({ label: d.name as string, path: `/${d.slug}` })),
      booths: (booths.data ?? []).filter((b) => b.gallery_token).map((b) => ({ label: b.name as string, path: `/gallery/${b.gallery_token}` })),
    },
  });
}

// Make a code, { label, destination, code?, expires_at?, note? }. Without a code one is picked that no live code, game, poll or Q&A is using.
export async function POST(request: Request) {
  const a = await authorize();
  if (a.error) return a.error;
  const b = await request.json().catch(() => ({}));
  const label = typeof b.label === 'string' ? b.label.trim().slice(0, 80) : '';
  if (!label) return NextResponse.json({ error: 'Give the code a name.' }, { status: 400 });
  const blocked = await refuseBlocked({ Name: label });
  if (blocked) return blocked;
  const destination = cleanDestination(b.destination, siteUrl());
  if (!destination) return NextResponse.json({ error: 'The page has to be an address on this site, like /events/my-event.' }, { status: 400 });
  const note = typeof b.note === 'string' ? b.note.trim().slice(0, 300) || null : null;
  let expires: string | null = null;
  if (b.expires_at) {
    const t = Date.parse(String(b.expires_at));
    if (Number.isNaN(t)) return NextResponse.json({ error: 'That is not a date.' }, { status: 400 });
    if (t <= Date.now()) return NextResponse.json({ error: 'The end date is already past.' }, { status: 400 });
    expires = new Date(t).toISOString();
  }
  let code = typeof b.code === 'string' ? b.code.trim() : '';
  if (code && !PAGE_CODE.test(code)) return NextResponse.json({ error: 'A code is six digits.' }, { status: 400 });
  const busy = async (c: string) => {
    const [g, p, q] = await Promise.all([
      a.svc.from('trivia_games').select('id', { head: true, count: 'exact' }).eq('code', c).neq('status', 'done'),
      a.svc.from('polls').select('id', { head: true, count: 'exact' }).eq('code', c).neq('status', 'closed').neq('status', 'revealed'),
      a.svc.from('qa_sessions').select('id', { head: true, count: 'exact' }).eq('code', c).eq('status', 'open'),
    ]);
    return !!(g.count || p.count || q.count);
  };
  if (code) {
    if (await busy(code)) return NextResponse.json({ error: 'A game, poll or Q&A that is on right now uses that code. Pick another.' }, { status: 409 });
  } else {
    for (let i = 0; i < 12 && !code; i++) {
      const c = randomCode();
      if (!(await busy(c)) && !(await a.svc.from('page_codes').select('id').eq('code', c).maybeSingle()).data) code = c;
    }
    if (!code) return NextResponse.json({ error: 'Could not find a free code. Try again.' }, { status: 503 });
  }
  const { data, error } = await a.svc.from('page_codes').insert({ code, label, destination, note, expires_at: expires, created_by: a.user.id }).select(COLUMNS).single();
  if (error)
    return NextResponse.json(
      { error: error.code === '23505' ? 'That code is already used by another page.' : 'Could not make that code.' },
      { status: error.code === '23505' ? 409 : 500 },
    );
  await logAudit(a.svc, { actorId: a.user.id, action: 'create', entityType: 'page code', entityId: data.id, summary: `Made the page code ${code} for ${label} (${destination})` });
  return NextResponse.json({ code: data }, { status: 201 });
}

// Change one, { id, label?, destination?, expires_at?, is_active?, note? }. The person who made it, and exec and admin, may.
export async function PATCH(request: Request) {
  const a = await authorize();
  if (a.error) return a.error;
  const b = await request.json().catch(() => ({}));
  const row = typeof b.id === 'string' ? (await a.svc.from('page_codes').select(COLUMNS).eq('id', b.id).maybeSingle()).data : null;
  if (!row) return NextResponse.json({ error: 'That code is gone.' }, { status: 404 });
  if (!a.isAdmin && row.created_by !== a.user.id) return NextResponse.json({ error: 'Only the person who made a code, or an exec or admin, can change it.' }, { status: 403 });
  const patch: Record<string, unknown> = {};
  if (typeof b.label === 'string') {
    const label = b.label.trim().slice(0, 80);
    if (!label) return NextResponse.json({ error: 'Give the code a name.' }, { status: 400 });
    const blocked = await refuseBlocked({ Name: label });
    if (blocked) return blocked;
    patch.label = label;
  }
  if (b.destination !== undefined) {
    const d = cleanDestination(b.destination, siteUrl());
    if (!d) return NextResponse.json({ error: 'The page has to be an address on this site, like /events/my-event.' }, { status: 400 });
    patch.destination = d;
  }
  if (b.expires_at !== undefined) {
    if (b.expires_at === null || b.expires_at === '') patch.expires_at = null;
    else {
      const t = Date.parse(String(b.expires_at));
      if (Number.isNaN(t)) return NextResponse.json({ error: 'That is not a date.' }, { status: 400 });
      patch.expires_at = new Date(t).toISOString();
    }
  }
  if (typeof b.is_active === 'boolean') patch.is_active = b.is_active;
  if (b.note !== undefined) patch.note = typeof b.note === 'string' ? b.note.trim().slice(0, 300) || null : null;
  if (Object.keys(patch).length === 0) return NextResponse.json({ code: row });
  const { data, error } = await a.svc.from('page_codes').update(patch).eq('id', row.id).select(COLUMNS).single();
  if (error) return NextResponse.json({ error: 'Could not save that.' }, { status: 500 });
  return NextResponse.json({ code: data });
}

export async function DELETE(request: Request) {
  const a = await authorize();
  if (a.error) return a.error;
  const b = await request.json().catch(() => ({}));
  const row = typeof b.id === 'string' ? (await a.svc.from('page_codes').select('id, code, label, created_by').eq('id', b.id).maybeSingle()).data : null;
  if (!row) return NextResponse.json({ error: 'That code is gone.' }, { status: 404 });
  if (!a.isAdmin && row.created_by !== a.user.id) return NextResponse.json({ error: 'Only the person who made a code, or an exec or admin, can delete it.' }, { status: 403 });
  await a.svc.from('page_codes').delete().eq('id', row.id);
  await logAudit(a.svc, { actorId: a.user.id, action: 'remove', entityType: 'page code', entityId: row.id, summary: `Deleted the page code ${row.code} (${row.label})` });
  return NextResponse.json({ ok: true });
}
