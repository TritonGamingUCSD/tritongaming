'use client';

import SectionTabs from '@/components/ui/SectionTabs';
import { useState } from 'react';
import { Camera, Gift, Wifi, QrCode } from 'lucide-react';
import { usePortalTabSync, useUrlNav } from '@/lib/portal/usePortalTabSync';
import type { Tier } from '@/lib/members/tiers';
import CheckInClient from './CheckInClient';
import RedemptionScanner from './RedemptionScanner';
import OnlineCheckinPanel from './OnlineCheckinPanel';
import SelfCheckinPanel from './SelfCheckinPanel';
import styles from './checkinsection.module.css';

interface Event { id: string; title: string; start_date: string; is_online: boolean; slug?: string | null; self_checkin_enabled?: boolean }

type Tab = 'tickets' | 'self' | 'redemptions' | 'online';
const VALID_TABS: Tab[] = ['tickets', 'self', 'redemptions', 'online'];

// Wraps the existing (working, camera-handling, fairly involved)
// CheckInClient with two new sibling tools rather than touching it
// directly — same officer audience, same events list, but genuinely
// different jobs (scanning a ticket vs. a redemption QR vs. revealing an
// online check-in code), so a tab bar keeps them from competing for the
// same screen instead of merging into one increasingly-overloaded
// component.
export default function CheckInSectionContent({ events, canScanRedemptions, tiers }: { events: Event[]; canScanRedemptions: boolean; initialTab?: string; tiers: Tier[] }) {
  const { tab: initialTab } = useUrlNav();
  const [tab, setTab] = useState<Tab>(VALID_TABS.includes(initialTab as Tab) ? (initialTab as Tab) : 'tickets');
  const syncUrl = usePortalTabSync('checkin');
  function selectTab(t: Tab) {
    setTab(t);
    syncUrl(t);
  }
  // Only events actually marked online get the code-reveal panel — an
  // in-person event has no one who'd ever need a code, and showing the tab
  // anyway would just invite an officer to reveal a code nobody's meant to
  // use.
  const onlineEvents = events.filter((e) => e.is_online);

  return (
    <div className={styles.page}>
      <SectionTabs
        value={tab}
        onChange={selectTab}
        tabs={[
          { id: 'tickets', label: 'Tickets', icon: <Camera /> },
          ...(events.length > 0 ? [{ id: 'self' as const, label: 'Self Check-In', icon: <QrCode /> }] : []),
          ...(canScanRedemptions ? [{ id: 'redemptions' as const, label: 'Redemptions', icon: <Gift /> }] : []),
          ...(onlineEvents.length > 0 ? [{ id: 'online' as const, label: 'Online Check-In', icon: <Wifi /> }] : []),
        ]}
      />

      {tab === 'tickets' && (
        <>
          <CheckInClient events={events} tiers={tiers} />
        </>
      )}
      {tab === 'self' && events.length > 0 && <SelfCheckinPanel events={events} />}
      {tab === 'redemptions' && canScanRedemptions && <RedemptionScanner />}
      {tab === 'online' && onlineEvents.length > 0 && <OnlineCheckinPanel events={onlineEvents} />}
    </div>
  );
}
