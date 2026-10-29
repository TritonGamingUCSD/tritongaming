import type { SupabaseClient } from '@supabase/supabase-js';
import { ROLE_LABELS } from '@/types/database';
import type { UserRole } from '@/types/database';
import { createNotifications } from '@/lib/notifications/notify';

// Notices to the member an admin's action is about: their roles changed, points were added or taken, a reward was handed over or cancelled.
// Plain wording: these can show on a lock screen.

const label = (r: string) => ROLE_LABELS[r as UserRole] ?? r;

// What a change from one set of roles to another means for the person, or null when nothing they would notice changed (a division moved, the same roles saved again).
export function describeRoleChange(before: string[], after: string[]): { title: string; body: string } | null {
  const had = new Set(before),
    has = new Set(after);
  const added = [...has].filter((r) => !had.has(r)),
    removed = [...had].filter((r) => !has.has(r));
  if (!added.length && !removed.length) return null;
  const parts: string[] = [];
  if (added.length) parts.push(`You now have: ${added.map(label).join(', ')}.`);
  if (removed.length) parts.push(`No longer yours: ${removed.map(label).join(', ')}.`);
  return {
    title: added.length && !removed.length ? 'You were given a new role' : removed.length && !added.length ? 'A role was removed from you' : 'Your roles changed',
    body: parts.join(' '),
  };
}

export async function notifyRoleChange(svc: SupabaseClient, userId: string, actorId: string, before: string[], after: string[]): Promise<void> {
  if (userId === actorId) return;
  const d = describeRoleChange(before, after);
  if (d) await createNotifications(svc, [{ user_id: userId, type: 'role_changed', title: d.title, body: d.body, href: '/portal' }]);
}

export const pointsText = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toLocaleString()} point${Math.abs(n) === 1 ? '' : 's'}`;

export async function notifyPoints(svc: SupabaseClient, userIds: string[], actorId: string, amount: number, note: string): Promise<void> {
  const to = [...new Set(userIds)].filter((u) => u !== actorId);
  if (!to.length) return;
  await createNotifications(
    svc,
    to.map((user_id) => ({ user_id, type: amount >= 0 ? 'points_added' : 'points_removed', title: pointsText(amount), body: note.slice(0, 120), href: '/portal/points' })),
  );
}
