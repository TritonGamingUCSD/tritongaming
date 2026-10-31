'use client';

import SectionTabs from '@/components/ui/SectionTabs';
import { useState } from 'react';
import { Award, ShoppingBag, Trophy, Settings, } from 'lucide-react';
import { getTier, nextTier, type Tier } from '@/lib/members/tiers';
import PortalCode from '@/components/portal/PortalCode';
import { usePortalTabSync, useUrlNav } from '@/lib/portal/usePortalTabSync';
import type { TransactionRow } from './getMyPointsData';
import Button from '@/components/ui/Button';
import styles from './points.module.css';
import SectionHeader from '@/components/ui/SectionHeader';
import { useShop } from './useShop';
import { useLeaderboard } from './useLeaderboard';
import { useRewardItems } from './useRewardItems';
import { useCorrections } from './useCorrections';
import { useAward } from './useAward';
import { useTierLadder } from './useTierLadder';
import { MyPointsTab } from './MyPointsTab';
import { ShopTab } from './ShopTab';
import { LeaderboardTab } from './LeaderboardTab';
import { ToolsTab } from './ToolsTab';
import { VALID_TABS, VALID_MANAGE_SUB_TABS, type ManageSubTab, type Tab } from './pointsTypes';

interface Props {
  balance: number;
  lifetimeEarned: number;
  leaderboardAnonymous: boolean;
  transactions: TransactionRow[];
  canManageShop: boolean;
  canManagePoints: boolean;
  /** Exec and admins who run Rewards but don't earn points themselves: no My Points or Shop tabs, opens on Tools. */
  manageOnly?: boolean;
  initialTab?: string;
  // /portal/points/tools/items — reaches all the way into
  // the Manage tab's own sub-tab bar, not just its top-level tab.
  initialSubTab?: string;
  tiers: Tier[];
}

export default function PointsSectionContent({
  balance,
  lifetimeEarned,
  leaderboardAnonymous: initialAnonymous,
  transactions,
  canManageShop,
  canManagePoints,
  manageOnly = false,
  tiers: initialTiers,
}: Props) {
  const { tab: initialTab, subtab: initialSubTab } = useUrlNav();
  // Local state, not just the prop directly — editing a tier in the Tiers
  // sub-tab below needs the rest of this component (progress bar, shop
  // gating, dropdowns) to reflect the change immediately, without a full
  // page reload.
  const [tiers, setTiers] = useState<Tier[]>(initialTiers);
  const [tab, setTab] = useState<Tab>(
    VALID_TABS.includes(initialTab as Tab) ? (initialTab as Tab) : VALID_MANAGE_SUB_TABS.includes(initialSubTab as ManageSubTab) || manageOnly ? 'tools' : 'mine',
  );
  const [manageSubTab, setManageSubTab] = useState<ManageSubTab>(VALID_MANAGE_SUB_TABS.includes(initialSubTab as ManageSubTab) ? (initialSubTab as ManageSubTab) : 'award');
  const syncUrl = usePortalTabSync('points');
  function selectTab(t: Tab) {
    setTab(t);
    syncUrl(t, t === 'tools' ? manageSubTab : undefined);
  }
  function selectManageSubTab(st: ManageSubTab) {
    setManageSubTab(st);
    syncUrl('tools', st);
  }
  const tier = getTier(lifetimeEarned, tiers);
  const next = nextTier(lifetimeEarned, tiers);

  const main = { tab, balance, lifetimeEarned, initialAnonymous, transactions, canManageShop, canManagePoints, manageOnly, tiers, setTiers, tier, next, manageSubTab, selectTab, selectManageSubTab };
  const shopState = useShop(main);
  const leaderboard = useLeaderboard(main);
  const rewardItems = useRewardItems(main);
  const corrections = useCorrections(main, leaderboard);
  const award = useAward(main, leaderboard);
  const tierLadder = useTierLadder(main, rewardItems);
  const ctx = { ...main, ...shopState, ...leaderboard, ...rewardItems, ...corrections, ...award, ...tierLadder };
  const { qrFor, setQrFor, unclaimedUnlockCount } = shopState;

  return (
    <div className={styles.page}>
      <SectionHeader title="Rewards" sub="Earn points for showing up, spend them on perks" />

      <SectionTabs
        value={tab}
        onChange={selectTab}
        tabs={[
          ...(manageOnly
            ? []
            : [
                { id: 'mine' as const, label: 'My Points', icon: <Award />, badge: unclaimedUnlockCount },
                { id: 'shop' as const, label: 'Shop', icon: <ShoppingBag /> },
              ]),
          { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy /> },
          ...(canManageShop ? [{ id: 'tools' as const, label: 'Tools', icon: <Settings /> }] : []),
        ]}
      />

      {tab === 'mine' && <MyPointsTab {...ctx} />}
      {tab === 'shop' && <ShopTab {...ctx} />}
      {tab === 'leaderboard' && <LeaderboardTab {...ctx} />}
      {tab === 'tools' && canManageShop && <ToolsTab {...ctx} />}

      {qrFor && (
        <div className={styles.qrOverlay} onClick={() => setQrFor(null)}>
          <div className={styles.qrModal} onClick={(e) => e.stopPropagation()}>
            <p className={styles.qrHint}>Show this to an officer at an event</p>
            <div className={styles.qrCanvas}>
              <PortalCode use="reward" payload={`r${qrFor.replace(/-/g, '').slice(0, 12)}`} />
            </div>
            <Button type="button" onClick={() => setQrFor(null)}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

