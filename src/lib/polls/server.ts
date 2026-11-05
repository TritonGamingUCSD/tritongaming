import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { withGrantedCapabilities } from '@/lib/portal/capabilities';
import { canUseLive, hasLiveAccess, liveScope, type LiveScope } from '@/lib/divisions/liveAccess';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';
import { slugify } from '@/lib/core/slug';
import { tally, voterCount, type EntryInfo, type PollMode, type PollReveal, type PollStatus, type Standing } from '@/lib/polls/tally';

export const UUID = /^[0-9a-f-]{36}$/i;
export const CODE = /^[0-9]{6}$/;
export const POLL_COLUMNS = 'id, slug, name, mode, reveal, status, code, created_by, created_at, opened_at, closed_at, division_id';
export const ENTRY_COLUMNS = 'id, number, name, subtitle, image';
export const POLL_BUCKET = 'poll-images';
export const MAX_ENTRIES = 60;

export interface PollRow {
  id: string;
  slug: string;
  name: string;
  mode: PollMode;
  reveal: PollReveal;
  status: PollStatus;
  code: string | null;
  created_by: string | null;
  created_at: string;
  opened_at: string | null;
  closed_at: string | null;
  division_id: string | null;
}

// Who may do what. 'host' (officers and above, the same permission as hosting Trivia): make polls, set up their entries, open, close and reveal them, see the live counts. 'vote' (anyone with a session, which includes a guest signed in
// anonymously for this one poll): follow an open poll and vote in it. A guest is never a host, whatever their session says.
export async function authorizePolls(mode: 'host' | 'vote', what = 'polls') {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const guest = !!user.is_anonymous;
  const svc = createServiceClient();
  let scope: LiveScope = { staff: false, tg: false, divisions: [] }; // what a host may run (nothing for a voter)
  if (mode === 'host') {
    if (guest) return { error: NextResponse.json({ error: `Hosting ${what} is for officers and above.` }, { status: 403 }) };
    const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
    const grants = withGrantedCapabilities(roles ?? [], await loadGrantedCapabilities(svc, user.id).catch(() => []));
    scope = liveScope(grants);
    if (!hasLiveAccess(scope)) return { error: NextResponse.json({ error: `Hosting ${what} is for officers and above.` }, { status: 403 }) };
  }
  return { user, svc, guest, scope };
}

/** A poll by its address word, its id or (while it is open or closed) its 6-digit code. */
export async function loadPoll(svc: SupabaseClient, key: string): Promise<PollRow | null> {
  const col = UUID.test(key) ? 'id' : CODE.test(key) ? 'code' : 'slug';
  const { data, error } = await svc.from('polls').select(POLL_COLUMNS).eq(col, key).maybeSingle();
  if (error) throw new Error(`poll read failed: ${error.message}`);
  return (data as PollRow | null) ?? null;
}

/** A poll for its host: gone (null) when it belongs to someone else's side (another division's, or the club's to a division's Member). */
export async function loadPollFor(auth: { svc: SupabaseClient; scope: LiveScope }, key: string): Promise<PollRow | null> {
  const poll = await loadPoll(auth.svc, key);
  return poll && canUseLive(auth.scope, poll.division_id) ? poll : null;
}

export async function loadEntries(svc: SupabaseClient, pollId: string): Promise<EntryInfo[]> {
  const { data } = await svc.from('poll_entries').select(ENTRY_COLUMNS).eq('poll_id', pollId).order('number').limit(MAX_ENTRIES);
  return (data ?? []) as EntryInfo[];
}

/** Every vote of a poll (the counting is done in the app, with `tally`). */
export async function loadVotes(svc: SupabaseClient, pollId: string): Promise<{ user_id: string; entry_id: string; value: number }[]> {
  const out: { user_id: string; entry_id: string; value: number }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await svc
      .from('poll_votes')
      .select('user_id, entry_id, value')
      .eq('poll_id', pollId)
      .range(from, from + 999);
    out.push(...((data ?? []) as typeof out));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

/** The standings and how many people have voted. */
export async function results(svc: SupabaseClient, poll: PollRow, entries?: EntryInfo[]): Promise<{ standings: Standing[]; voters: number }> {
  const [list, votes] = await Promise.all([entries ? Promise.resolve(entries) : loadEntries(svc, poll.id), loadVotes(svc, poll.id)]);
  return { standings: tally(poll.mode, list, votes), voters: voterCount(votes) };
}

/** A 6-digit code no poll, Q&A session or running Trivia game is using. */
export async function freshCode(svc: SupabaseClient): Promise<string | null> {
  for (let i = 0; i < 25; i++) {
    const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
    const [p, q, t] = await Promise.all([
      svc.from('polls').select('id', { count: 'exact', head: true }).eq('code', code),
      svc.from('qa_sessions').select('id', { count: 'exact', head: true }).eq('code', code),
      svc.from('trivia_games').select('id', { count: 'exact', head: true }).eq('code', code).neq('status', 'done'),
    ]);
    if (!p.count && !q.count && !t.count) return code;
  }
  return null;
}

/** An address word for a new poll from its name (a number is added when it is taken). */
export async function freshSlug(svc: SupabaseClient, name: string): Promise<string> {
  let base = slugify(name).slice(0, 50) || 'poll';
  if (base === 'host') base = 'host-poll'; // (/portal/polls/host/<poll> is the big screen)
  for (let i = 0; i < 8; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const { count } = await svc.from('polls').select('id', { count: 'exact', head: true }).eq('slug', slug);
    if (!count) return slug;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

// Tell the screens of a poll something changed: everyone's (`poll:<id>`: it opened, closed or was revealed), or only the host's (`poll-host:<id>`: how many have voted). Failing to send is fine: the screens also ask now and then.
export async function broadcast(pollId: string, event: string, payload: unknown, host = false): Promise<void> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ messages: [{ topic: `${host ? 'poll-host' : 'poll'}:${pollId}`, event, payload, private: false }] }),
    });
  } catch {
    /* the screens catch up on their own */
  }
}
