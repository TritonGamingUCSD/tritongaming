import type { SupabaseClient } from '@supabase/supabase-js';

/** How long a guest's temporary account is kept. (A guest is someone who played Trivia at /play without an account; deleting the account also removes their row from the results of games they played.) */
export const GUEST_KEEP_DAYS = 2;

/** Is this account a leftover guest: anonymous, and older than the keep time? Pure, so it can be tested. */
export const isStaleGuest = (u: { is_anonymous?: boolean; created_at?: string }, now = Date.now(), days = GUEST_KEEP_DAYS): boolean =>
  !!u.is_anonymous && !!u.created_at && Date.parse(u.created_at) < now - days * 86_400_000;

// The daily tidy-up: delete guest accounts older than GUEST_KEEP_DAYS that are not in a game that is still going. At most `limit` per run (the job has a minute), so a big backlog is cleared over a few days.
export async function cleanupGuests(svc: SupabaseClient, limit = 400): Promise<{ removed: number; looked: number }> {
  const { data: live } = await svc.from('trivia_players').select('user_id, trivia_games!inner(status)').neq('trivia_games.status', 'done').limit(5000);
  const busy = new Set((live ?? []).map((r) => r.user_id as string));
  let removed = 0;
  let looked = 0;
  for (let page = 1; page <= 20 && removed < limit; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) break;
    looked += data.users.length;
    for (const u of data.users) {
      if (removed >= limit) break;
      if (!isStaleGuest(u) || busy.has(u.id)) continue;
      const r = await svc.auth.admin.deleteUser(u.id);
      if (!r.error) removed++;
    }
    if (data.users.length < 1000) break;
  }
  return { removed, looked };
}
