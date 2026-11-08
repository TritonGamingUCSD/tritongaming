import { redirect } from 'next/navigation';
import { getProfile, getUserRoles } from '@/lib/core/auth';
import { isRewardsEligible } from '@/lib/portal/capabilities';
import { getTiersCached } from '@/lib/portal/portalCounts';
import PointsSectionContent from '@/app/(portal)/portal/points/PointsSectionContent';
import { getMyPointsData } from '@/app/(portal)/portal/points/getMyPointsData';

export const dynamic = 'force-dynamic';

// Points and the shop, for students (the same page the portal has).
export default async function MyRewardsPage() {
  const [profile, roles] = await Promise.all([getProfile(), getUserRoles()]);
  if (!profile) return null;
  if (!isRewardsEligible(roles)) redirect('/me/tickets');
  const [points, tiers] = await Promise.all([getMyPointsData(profile.id), getTiersCached()]);
  return (
    <PointsSectionContent
      balance={points?.balance ?? 0}
      lifetimeEarned={points?.lifetimeEarned ?? 0}
      leaderboardAnonymous={points?.leaderboardAnonymous ?? false}
      transactions={points?.transactions ?? []}
      manageOnly={false}
      canManageShop={false}
      canManagePoints={false}
      tiers={tiers}
    />
  );
}
