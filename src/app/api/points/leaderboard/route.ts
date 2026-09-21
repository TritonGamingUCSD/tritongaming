import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { getTier } from '@/lib/tiers';

// Ranked by lifetime points earned (status tier's own basis — see
// src/lib/tiers.ts), scoped to members who've opted in. Each opted-in
// member's own name/points visibility choices are respected independently
// (see profiles.leaderboard_show_name/show_points) — this always computes
// full standings server-side first, then redacts per-row for display, so
// someone hiding their name still occupies their real rank rather than
// the whole leaderboard silently reordering around them.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const serviceClient = createServiceClient();

  const [{ data: optedIn }, { data: allTransactions }] = await Promise.all([
    serviceClient
      .from('profiles')
      .select('id, display_name, leaderboard_show_name, leaderboard_show_points')
      .eq('leaderboard_opt_in', true),
    serviceClient.from('point_transactions').select('user_id, amount, reversed_at'),
  ]);

  const lifetimeByUser = new Map<string, number>();
  (allTransactions ?? []).forEach((t) => {
    if (t.amount > 0 && !t.reversed_at) lifetimeByUser.set(t.user_id, (lifetimeByUser.get(t.user_id) ?? 0) + t.amount);
  });

  // Tier is derived and sent unconditionally (rank + a status badge is the
  // whole point of the leaderboard existing) — the raw point total behind
  // it is only ever included in the response at all when the member opted
  // to show it, not just hidden client-side, since anything sent to the
  // browser is inspectable regardless of what the UI chooses to render.
  const ranked = (optedIn ?? [])
    .map((p) => ({ ...p, lifetime: lifetimeByUser.get(p.id) ?? 0 }))
    .sort((a, b) => b.lifetime - a.lifetime)
    .map((p, i) => ({
      rank: i + 1,
      isSelf: p.id === user.id,
      name: p.leaderboard_show_name ? (p.display_name || 'A member') : 'Anonymous',
      tier: getTier(p.lifetime).name,
      points: p.leaderboard_show_points ? p.lifetime : undefined,
    }));

  return NextResponse.json({ leaderboard: ranked });
}
