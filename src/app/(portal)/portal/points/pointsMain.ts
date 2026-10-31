import type { Dispatch, SetStateAction } from 'react';
import type { Tier } from '@/lib/members/tiers';
import type { TransactionRow } from './getMyPointsData';
import type { ManageSubTab, Tab } from './pointsTypes';

// What the Rewards screen itself holds and every part reads: the props, the open tab and the tier ladder.
export interface PointsMain {
  tab: Tab;
  balance: number;
  lifetimeEarned: number;
  initialAnonymous: boolean;
  transactions: TransactionRow[];
  canManageShop: boolean;
  canManagePoints: boolean;
  manageOnly: boolean;
  tiers: Tier[];
  setTiers: Dispatch<SetStateAction<Tier[]>>;
  tier: Tier;
  next: Tier | null;
  manageSubTab: ManageSubTab;
  selectTab: (t: Tab) => void;
  selectManageSubTab: (st: ManageSubTab) => void;
}
