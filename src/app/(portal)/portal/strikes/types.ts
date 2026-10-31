export interface Person {
  id: string;
  name: string;
  avatar_url: string | null;
  role: string;
  active: number;
  vouchers: number;
  atLimit: boolean;
  inactive: boolean;
}

export interface Strike {
  id: string;
  mark: string | null;
  status: 'published' | 'removed';
  category: string;
  reason: string;
  incident_date: string;
  meeting_id: string | null;
  created_at: string;
  published_at: string | null;
  removed_at: string | null;
  removed_how: 'taken' | 'voucher' | 'reset' | null;
  removed_note: string | null;
  created_by: string | null;
  published_by: string | null;
  removed_by: string | null;
}

export interface Voucher {
  id: string;
  reason: string | null;
  created_at: string;
  used_at: string | null;
  used_on_strike_id: string | null;
  given_by: string | null;
  removed_at: string | null;
  removed_by: string | null;
  removed_reason: string | null;
}

export interface Event {
  id: string;
  kind: string;
  label: string | null;
  reason: string | null;
  by: string | null;
  at: string;
}

export interface PastMiss {
  user_id: string;
  name: string;
  meeting_id: string;
  title: string;
  date: string;
  outcome: 'strike' | 'dismissed';
  reason: string | null;
}

export interface Suggestion {
  user_id: string;
  name: string;
  meeting_id: string;
  title: string;
  date: string;
}

export type Tab = 'people' | 'missed';

export type Filter = 'all' | 'strikes' | 'limit';

// People who missed a meeting they were meant for (after the excuse window). Each person gets three clear choices; strike and dismiss
// can also be done for everyone at one meeting at once. Strike asks to confirm, excuse needs a reason, dismiss takes an optional one.
export type Mode = 'add' | 'excuse' | 'dismiss';

export type Panel = { id: string; mode: Mode; items: { user_id: string; meeting_id: string }[]; who: string };
