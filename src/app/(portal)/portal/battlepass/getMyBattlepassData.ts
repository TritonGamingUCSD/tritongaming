import { createClient } from '@/lib/supabase/server';

export interface BattlepassTransactionRow {
  id: string;
  amount: number;
  type: string;
  note: string | null;
  created_at: string;
  reversed_at: string | null;
  reverses_transaction_id: string | null;
}

// Mirrors getMyPointsData.ts exactly, against the officer_* tables instead —
// see 20260921100000_add_officer_points_system.sql for why this is a fully
// separate ledger from the member one. "Battlepass" is the user-facing
// name for this system; the schema itself keeps its original officer_*
// naming.
export async function getMyBattlepassData(userId: string) {
  const supabase = await createClient();

  const [{ data: transactions }, { data: allAmounts }] = await Promise.all([
    supabase
      .from('officer_point_transactions')
      .select('id, amount, type, note, created_at, reversed_at, reverses_transaction_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('officer_point_transactions').select('amount, reversed_at').eq('user_id', userId),
  ]);

  const rows = transactions ?? [];
  const amounts = allAmounts ?? [];
  const balance = amounts.reduce((sum, t) => sum + t.amount, 0);
  // A reversed award doesn't count toward tier — see getMyPointsData.ts's
  // identical reasoning on the member side.
  const lifetimeEarned = amounts.filter((t) => t.amount > 0 && !t.reversed_at).reduce((sum, t) => sum + t.amount, 0);

  return {
    transactions: rows as BattlepassTransactionRow[],
    balance,
    lifetimeEarned,
  };
}
