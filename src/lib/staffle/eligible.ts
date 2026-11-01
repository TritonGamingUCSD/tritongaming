import type { SupabaseClient } from '@supabase/supabase-js';
import { canEnter, type Rules } from '@/lib/staffle/rules';

// Everyone who may enter a Staffle (its rules, their roles and strikes): the people a leftover prize can go to when nobody entered it. Works from the roles table and published strikes in one go.
export async function eligibleIds(svc: SupabaseClient, rules: Rules): Promise<string[]> {
  const [{ data: roles }, { data: marks }] = await Promise.all([
    svc.from('user_roles').select('user_id, role').limit(30000),
    svc.from('strikes').select('user_id').eq('status', 'published').limit(30000),
  ]);
  const byUser = new Map<string, string[]>();
  for (const r of roles ?? []) byUser.set(r.user_id as string, [...(byUser.get(r.user_id as string) ?? []), r.role as string]);
  const count = new Map<string, number>();
  for (const m of marks ?? []) count.set(m.user_id as string, (count.get(m.user_id as string) ?? 0) + 1);
  return [...byUser].filter(([id, rs]) => canEnter(rules, { id, roles: rs, marks: count.get(id) ?? 0 }).ok).map(([id]) => id);
}
