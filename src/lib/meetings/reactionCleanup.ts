import type { SupabaseClient } from '@supabase/supabase-js';

// Emoji reactions only matter while a meeting is on (the big screen and its running totals), and one busy meeting can hold a thousand of them. Nothing reads
// them afterwards, so the individual rows go after a week.
export const KEEP_REACTION_DAYS = 7;

export async function cleanupMeetingReactions(svc: SupabaseClient, now = new Date()): Promise<{ removed: number }> {
  const before = new Date(now.getTime() - KEEP_REACTION_DAYS * 86400_000).toISOString();
  const { count } = await svc.from('meeting_reactions').delete({ count: 'exact' }).lt('created_at', before);
  return { removed: count ?? 0 };
}
