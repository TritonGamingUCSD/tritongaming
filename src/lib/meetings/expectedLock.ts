import type { SupabaseClient } from '@supabase/supabase-js';
import { AUDIENCE_ROLES, isExpectedActive, rolesAsOf, type MeetingAudience } from '@/lib/meetings/meetingAudience';

// Once check-in has closed (the scheduled end, or the host closed it), who the meeting expected is saved and never changes: a role or team
// change afterward cannot turn anyone into a no-show, or take a real no-show off the list. Meetings that ended before this existed are locked the first
// time they are read, from the roles people held when the meeting ended.
type LockInput = MeetingAudience & { id: string; ends_at: string; closed_at?: string | null };

export const isOver = (m: { ends_at: string; closed_at?: string | null }) => !!m.closed_at || new Date(m.ends_at).getTime() <= Date.now();

/** Locked expected people per meeting. A meeting still taking check-ins is not in the map (its list is still live). Inputs need `extra_ids` (see attachExtras). */
export async function lockedExpected(svc: SupabaseClient, meetings: LockInput[]): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  const over = meetings.filter(isOver);
  if (!over.length) return out;
  const ids = over.map((m) => m.id);
  const { data: state } = await svc.from('meetings').select('id, expected_locked_at').in('id', ids);
  const locked = new Set((state ?? []).filter((s) => s.expected_locked_at).map((s) => s.id as string));
  if (locked.size) {
    const lockedIds = [...locked];
    for (let i = 0; i < lockedIds.length; i += 200) {
      const { data } = await svc
        .from('meeting_expected')
        .select('meeting_id, user_id')
        .in('meeting_id', lockedIds.slice(i, i + 200))
        .limit(50000);
      for (const r of data ?? []) {
        const s = out.get(r.meeting_id as string) ?? new Set<string>();
        s.add(r.user_id as string);
        out.set(r.meeting_id as string, s);
      }
    }
    for (const id of lockedIds) if (!out.has(id)) out.set(id, new Set());
  }
  const todo = over.filter((m) => !locked.has(m.id));
  if (!todo.length) return out;
  const { data: grants } = await svc
    .from('user_roles')
    .select('user_id, role, created_at')
    .in('role', [...AUDIENCE_ROLES, 'inactive', 'alumni']);
  const rolesOf = new Map<string, { role: string; created_at: string }[]>();
  for (const g of grants ?? []) rolesOf.set(g.user_id as string, [...(rolesOf.get(g.user_id as string) ?? []), { role: g.role as string, created_at: g.created_at as string }]);
  for (const m of todo) {
    const cutoff = m.closed_at && new Date(m.closed_at) < new Date(m.ends_at) ? m.closed_at : m.ends_at;
    const set = new Set<string>(m.extra_ids ?? m.invitees ?? []);
    for (const [uid, roles] of rolesOf) if (isExpectedActive(m, uid, rolesAsOf(roles, cutoff))) set.add(uid);
    const rows = [...set].map((user_id) => ({ meeting_id: m.id, user_id }));
    for (let i = 0; i < rows.length; i += 500) await svc.from('meeting_expected').upsert(rows.slice(i, i + 500), { onConflict: 'meeting_id,user_id', ignoreDuplicates: true });
    await svc.from('meetings').update({ expected_locked_at: new Date().toISOString() }).eq('id', m.id);
    out.set(m.id, set);
  }
  return out;
}

/** Was this person expected? Uses the locked list when there is one, otherwise the live rules. */
export const wasExpected = (locks: Map<string, Set<string>>, m: MeetingAudience & { id: string }, userId: string, roles: { role: string }[]) => {
  const s = locks.get(m.id);
  return s ? s.has(userId) : isExpectedActive(m, userId, roles);
};
