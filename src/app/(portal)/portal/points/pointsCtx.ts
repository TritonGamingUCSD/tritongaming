import type { PointsMain } from './pointsMain';
import type { useShop } from './useShop';
import type { useLeaderboard } from './useLeaderboard';
import type { useRewardItems } from './useRewardItems';
import type { useCorrections } from './useCorrections';
import type { useAward } from './useAward';
import type { useTierLadder } from './useTierLadder';

// Everything a Rewards panel can read: the screen's own state and what each part holds.
export type PointsCtx = PointsMain & ReturnType<typeof useShop> & ReturnType<typeof useLeaderboard> & ReturnType<typeof useRewardItems> & ReturnType<typeof useCorrections> & ReturnType<typeof useAward> & ReturnType<typeof useTierLadder>;
