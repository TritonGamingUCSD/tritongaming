import { NextResponse } from 'next/server';
import { withTournament, who, unauthorized } from '@/lib/tournaments/server';
import { hasStarted } from '@/lib/tournaments/run';
import { refuseBlocked } from '@/lib/wordfilter/server';

export const dynamic = 'force-dynamic';

const code = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (x) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x % 32]).join('');

// Add an entrant. Organizers: { name, user_id? } (without a user_id it is a guest with a claim code). A signed-in person: { self: true, name? (team name), members? } while sign-ups are open.
// A guest claims their entry later with { claim: 'CODE' }.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as { name?: string; user_id?: string; self?: boolean; claim?: string; members?: { name: string; user_id?: string }[] };
  const r = await withTournament(id, b.claim ? 'claim' : b.self ? 'view' : 'manage');
  if ('error' in r) return r.error;
  const blocked = await refuseBlocked({ Name: String(b.name ?? ''), ...Object.fromEntries((b.members ?? []).map((m, i) => [`Member ${i + 1}`, m.name])) });
  if (blocked) return blocked;
  const t = r.tournament;
  if (hasStarted(t) && !b.claim) return NextResponse.json({ error: 'The bracket has started. Entrants are locked.' }, { status: 409 });
  if (t.max_entrants && r.entrants.length >= t.max_entrants && !b.claim) return NextResponse.json({ error: 'This tournament is full.' }, { status: 409 });
  const me = await who();

  if (b.claim) {
    if (!me) return unauthorized();
    const hit = r.entrants.find((e) => e.claim_code && e.claim_code === String(b.claim).trim().toUpperCase());
    if (!hit) return NextResponse.json({ error: 'That code did not match anyone.' }, { status: 404 });
    if (hit.user_id) return NextResponse.json({ error: 'That entry is already claimed.' }, { status: 409 });
    if (r.entrants.some((e) => e.user_id === me.user.id)) return NextResponse.json({ error: 'You are already in this tournament.' }, { status: 409 });
    await r.svc.from('tournament_entrants').update({ user_id: me.user.id, claim_code: null }).eq('id', hit.id);
    return NextResponse.json({ ok: true, claimed: hit.name });
  }

  if (b.self) {
    if (!me) return unauthorized();
    if (!t.signups_open || t.status !== 'registration') return NextResponse.json({ error: 'Sign-ups are not open.' }, { status: 409 });
    if (r.entrants.some((e) => e.user_id === me.user.id)) return NextResponse.json({ error: 'You are already signed up.' }, { status: 409 });
    const { data: p } = await me.svc.from('profiles').select('display_name, google_first_name').eq('id', me.user.id).maybeSingle();
    const mine = (p?.display_name as string) || (p?.google_first_name as string) || 'Player';
    const members =
      t.entrant_type === 'team'
        ? [{ user_id: me.user.id, name: mine }, ...(b.members ?? []).slice(0, t.team_size - 1).map((m) => ({ name: String(m.name).slice(0, 40), user_id: m.user_id ?? null }))]
        : [];
    const name =
      t.entrant_type === 'team'
        ? String(b.name ?? '')
            .trim()
            .slice(0, 40)
        : mine;
    if (!name) return NextResponse.json({ error: 'Give your team a name.' }, { status: 400 });
    const { error } = await me.svc.from('tournament_entrants').insert({ tournament_id: t.id, user_id: me.user.id, name, members });
    if (error) return NextResponse.json({ error: 'Could not sign you up.' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const name = String(b.name ?? '')
    .trim()
    .slice(0, 40);
  let userId: string | null = b.user_id ?? null;
  let display = name;
  if (userId) {
    if (r.entrants.some((e) => e.user_id === userId)) return NextResponse.json({ error: 'They are already in.' }, { status: 409 });
    const { data: p } = await r.svc.from('profiles').select('display_name, google_first_name').eq('id', userId).maybeSingle();
    if (!p) return NextResponse.json({ error: 'No such member.' }, { status: 404 });
    display = display || (p.display_name as string) || (p.google_first_name as string) || 'Player';
  }
  if (!display) return NextResponse.json({ error: 'Type a name.' }, { status: 400 });
  userId = userId ?? null;
  const { data, error } = await r.svc
    .from('tournament_entrants')
    .insert({
      tournament_id: t.id,
      user_id: userId,
      name: display,
      claim_code: userId ? null : code(),
      members: (b.members ?? []).map((m) => ({ name: String(m.name).slice(0, 40), user_id: m.user_id ?? null })),
    })
    .select('id, claim_code')
    .single();
  if (error || !data) return NextResponse.json({ error: 'Could not add them.' }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id, claim_code: data.claim_code });
}

// Organizers: { order: [entrant ids] } sets seeds 1..n in that order; { random: true } shuffles; { id, checked_in?, dropped?, name? } edits one.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await withTournament(id, 'manage');
  if ('error' in r) return r.error;
  const b = (await request.json().catch(() => ({}))) as {
    order?: string[];
    random?: boolean;
    id?: string;
    checked_in?: boolean;
    dropped?: boolean;
    name?: string;
    members?: { name?: string; sub?: boolean; user_id?: string | null }[];
  };
  if (b.order || b.random) {
    if (hasStarted(r.tournament)) return NextResponse.json({ error: 'The bracket has started. Seeds are locked.' }, { status: 409 });
    let order = b.order ?? r.entrants.map((e) => e.id);
    if (b.random) order = [...order].sort(() => Math.random() - 0.5);
    const known = new Set(r.entrants.map((e) => e.id));
    if (order.length !== known.size || order.some((x) => !known.has(x))) return NextResponse.json({ error: 'The order must list every entrant once.' }, { status: 400 });
    await Promise.all(
      order.map((eid, i) =>
        r.svc
          .from('tournament_entrants')
          .update({ seed: i + 1 })
          .eq('id', eid),
      ),
    );
    return NextResponse.json({ ok: true });
  }
  if (!b.id || !r.entrants.some((e) => e.id === b.id)) return NextResponse.json({ error: 'Say who.' }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (typeof b.checked_in === 'boolean') patch.checked_in = b.checked_in;
  if (typeof b.dropped === 'boolean') patch.dropped = b.dropped;
  if (typeof b.name === 'string' && b.name.trim()) patch.name = b.name.trim().slice(0, 40);
  // a team's players (and its substitutes): change them any time, even while it is live
  if (Array.isArray(b.members)) {
    const members = b.members
      .slice(0, 12)
      .map((m) => ({
        name: String(m.name ?? '')
          .trim()
          .slice(0, 40),
        user_id: m.user_id ?? null,
        ...(m.sub ? { sub: true } : {}),
      }))
      .filter((m) => m.name);
    const blockedRoster = await refuseBlocked(Object.fromEntries(members.map((m, i) => [`Player ${i + 1}`, m.name])));
    if (blockedRoster) return blockedRoster;
    patch.members = members;
  }
  await r.svc.from('tournament_entrants').update(patch).eq('id', b.id);
  return NextResponse.json({ ok: true });
}

// Organizers remove an entrant (before the bracket starts), or a person withdraws themselves: { id } or { self: true }.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as { id?: string; self?: boolean };
  const r = await withTournament(id, b.self ? 'view' : 'manage');
  if ('error' in r) return r.error;
  if (hasStarted(r.tournament)) return NextResponse.json({ error: 'The bracket has started. Mark them as dropped instead.' }, { status: 409 });
  if (r.matches.some((m) => m.a === b.id || m.b === b.id))
    return NextResponse.json({ error: 'They are in matches you planned. Remove those matches first (Bracket tab).' }, { status: 409 });
  let target = b.id;
  if (b.self) {
    const me = await who();
    if (!me) return unauthorized();
    target = r.entrants.find((e) => e.user_id === me.user.id)?.id;
  }
  if (!target) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  await r.svc.from('tournament_entrants').delete().eq('id', target).eq('tournament_id', r.tournament.id);
  return NextResponse.json({ ok: true });
}
