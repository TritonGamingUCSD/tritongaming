// The shapes and labels the Rewards screens share.

export type Tab = 'mine' | 'shop' | 'leaderboard' | 'tools';
export const VALID_TABS: Tab[] = ['mine', 'shop', 'leaderboard', 'tools'];

export interface RewardItem {
  id: string;
  title: string;
  description: string | null;
  point_cost: number;
  stock: number | null;
  min_tier: string | null;
  active: boolean;
  max_per_user?: number | null;
  reward_type?: 'physical' | 'digital';
  grants_fast_pass?: boolean;
  created_at?: string;
}

export interface UnlockReward {
  id: string;
  title: string;
  description: string | null;
  min_tier: string | null;
  unlocked: boolean;
  claimed: boolean;
}

export interface PendingRedemption {
  id: string;
  reward_id: string;
  status: string;
  point_cost: number;
  claimed_at: string;
  reward: { title: string } | { title: string }[] | null;
}

export interface LeaderboardRow {
  rank: number;
  isSelf: boolean;
  name: string;
  tier: string;
  points: number;
}

export interface HistoryTxn {
  id: string;
  amount: number;
  type: string;
  note: string | null;
  created_at: string;
  reversed_at: string | null;
  reverses_transaction_id: string | null;
  event: { title: string } | { title: string }[] | null;
}

export const TYPE_LABELS: Record<string, string> = {
  event_checkin: 'Event check-in',
  redemption: 'Reward redeemed',
  admin_adjustment: 'Adjustment',
};

export function oneOf<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

// The Manage tab does four genuinely separate jobs (award points, edit the
// catalog, correct a member's points, edit the tier ladder) — member
// reward redemptions are confirmed by staff with the Scan button in the phone's bottom bar,
// not from here — see UniversalScanner.tsx).
export type ManageSubTab = 'award' | 'items' | 'corrections' | 'tiers';
export const VALID_MANAGE_SUB_TABS: ManageSubTab[] = ['award', 'items', 'corrections', 'tiers'];

export interface TierRow {
  id: string;
  name: string;
  min_points: number;
  color: string;
}
