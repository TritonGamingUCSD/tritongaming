import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { getOfficerTier, BATTLEPASS_ROLES, fetchOfficerTiers } from '@/lib/officerTiers';

// Unlike the member leaderboard (opt-in, per-field redaction — see
// /api/points/leaderboard), this one has no privacy toggles: it's a
// smaller, already-trusted internal group (officer-tier roles only, and
// only visible to other officer-tier roles), not the general membership,
// so full names/points are shown outright.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: callerRoles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
  if (!(callerRoles ?? []).some((r) => BATTLEPASS_ROLES.includes(r.role))) {
    return NextResponse.json({ error: 'The Battlepass is only for officer-tier roles.' }, { status: 403 });
  }

  const serviceClient = createServiceClient();
  // !user_roles_user_id_fkey disambiguates the embed — user_roles has two
  // FKs into profiles (user_id and granted_by), so a bare `profiles(...)`
  // is an ambiguous-relationship error from PostgREST (PGRST201), not a
  // real "column doesn't exist" error. That error was silently swallowed
  // here (only `data` was destructured, never `error`), so this always
  // failed and always returned an empty leaderboard — see every other
  // user_roles->profiles embed in the codebase (getAdminData.ts,
  // getMembersData.ts, getBoardMembers.ts), all of which already use this
  // same hint.
  const [{ data: officerProfiles, error: profilesError }, { data: allTransactions, error: txError }, tiers] = await Promise.all([
    serviceClient.from('user_roles').select('user_id, profiles!user_roles_user_id_fkey(display_name)').in('role', BATTLEPASS_ROLES),
    serviceClient.from('officer_point_transactions').select('user_id, amount, reversed_at'),
    fetchOfficerTiers(supabase),
  ]);
  if (profilesError || txError) {
    return NextResponse.json({ error: (profilesError ?? txError)?.message ?? 'Failed to load leaderboard.' }, { status: 500 });
  }

  const lifetimeByUser = new Map<string, number>();
  (allTransactions ?? []).forEach((t) => {
    if (t.amount > 0 && !t.reversed_at) lifetimeByUser.set(t.user_id, (lifetimeByUser.get(t.user_id) ?? 0) + t.amount);
  });

  const seen = new Set<string>();
  const ranked = (officerProfiles ?? [])
    .filter((p) => {
      if (seen.has(p.user_id)) return false;
      seen.add(p.user_id);
      return true;
    })
    .map((p) => {
      const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
      const lifetime = lifetimeByUser.get(p.user_id) ?? 0;
      return { userId: p.user_id, name: profile?.display_name || 'A member', lifetime };
    })
    .filter((p) => p.lifetime > 0)
    .sort((a, b) => b.lifetime - a.lifetime)
    .map((p, i) => ({
      rank: i + 1,
      isSelf: p.userId === user.id,
      name: p.name,
      tier: getOfficerTier(p.lifetime, tiers).name,
      points: p.lifetime,
    }));

  return NextResponse.json({ leaderboard: ranked });
}
