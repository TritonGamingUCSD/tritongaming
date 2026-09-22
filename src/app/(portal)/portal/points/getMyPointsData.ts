import { createClient } from '@/lib/supabase/server';

export interface TransactionRow {
  id: string;
  amount: number;
  type: string;
  note: string | null;
  created_at: string;
  reversed_at: string | null;
  event: { title: string } | { title: string }[] | null;
}

// Shared by the portal hub's Rewards card. Balance/lifetime-earned are
// derived from the ledger on every read rather than stored — see
// point_transactions in the points/rewards migration for why (a derived
// value can never drift out of sync with what actually happened).
export async function getMyPointsData(userId: string) {
  const supabase = await createClient();

  // The recent-history list is capped at 50 for display, but balance and
  // lifetime-earned (which sets tier — see src/lib/tiers.ts) have to sum
  // *every* transaction ever, not just the visible page of them, or a
  // long-time member's tier would silently regress once their history
  // outgrew the cap.
  const [{ data: transactions }, { data: allAmounts }, { data: profile }] = await Promise.all([
    supabase
      .from('point_transactions')
      .select('id, amount, type, note, created_at, reversed_at, event:events(title)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('point_transactions').select('amount, reversed_at').eq('user_id', userId),
    supabase
      .from('profiles')
      .select('referral_code, leaderboard_anonymous')
      .eq('id', userId)
      .single(),
  ]);

  const rows = transactions ?? [];
  const amounts = allAmounts ?? [];
  const balance = amounts.reduce((sum, t) => sum + t.amount, 0);
  // A reversed award (mis-scan, corrected mistake) never really happened,
  // so it shouldn't count toward permanent tier progress either — only
  // toward balance, where the compensating negative entry already nets it
  // back to zero. Tier is meant to be "never decreases from spending", not
  // "never decreases even for things that turned out to be wrong".
  const lifetimeEarned = amounts.filter((t) => t.amount > 0 && !t.reversed_at).reduce((sum, t) => sum + t.amount, 0);

  return {
    transactions: rows as TransactionRow[],
    balance,
    lifetimeEarned,
    referralCode: profile?.referral_code ?? null,
    leaderboardAnonymous: profile?.leaderboard_anonymous ?? true,
  };
}
