'use client';

import SectionTabs from '@/components/ui/SectionTabs';
import { useState } from 'react';
import { Keyboard, Wifi, QrCode } from 'lucide-react';
import { usePortalTabSync, useUrlNav } from '@/lib/portal/usePortalTabSync';
import EnterCodePanel from './EnterCodePanel';
import OnlineCheckinPanel from './OnlineCheckinPanel';
import SelfCheckinPanel from './SelfCheckinPanel';
import styles from './checkinsection.module.css';

interface Event { id: string; title: string; start_date: string; is_online: boolean; slug?: string | null; self_checkin_mode?: 'off' | 'until_end' | 'forever'; end_date?: string | null; checkin_windows?: { day: string; start: string; end: string }[] | null }

type Tab = 'code' | 'self' | 'online';
const VALID_TABS: Tab[] = ['code', 'self', 'online'];

// What staff need from a computer: one box for any six-digit code (a ticket's or a meeting's), the event's self check-in QR and, for online events, the code to reveal.
// Scanning with a camera (tickets, meetings, reward pickups) is the Scan button in the phone's bottom bar.
export default function CheckInSectionContent({ events, canControlSelfCheckin }: { events: Event[]; canControlSelfCheckin: boolean; initialTab?: string }) {
  const { tab: initialTab } = useUrlNav();
  const [tab, setTab] = useState<Tab>(VALID_TABS.includes(initialTab as Tab) ? (initialTab as Tab) : 'code');
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
          { id: 'code', label: 'Enter Code', icon: <Keyboard /> },
          ...(events.length > 0 ? [{ id: 'self' as const, label: 'Self Check-In', icon: <QrCode /> }] : []),
          ...(onlineEvents.length > 0 ? [{ id: 'online' as const, label: 'Online Check-In', icon: <Wifi /> }] : []),
        ]}
      />

      {tab === 'code' && <EnterCodePanel />}
      {tab === 'self' && events.length > 0 && <SelfCheckinPanel events={events} canControl={canControlSelfCheckin} />}
      {tab === 'online' && onlineEvents.length > 0 && <OnlineCheckinPanel events={onlineEvents} />}
    </div>
  );
}
