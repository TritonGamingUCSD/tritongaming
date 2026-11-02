'use client';

import SectionTabs from '@/components/ui/SectionTabs';
import { useState } from 'react';
import { Wifi, QrCode } from 'lucide-react';
import Link from '@/components/portal/PortalLink';
import { usePortalTabSync, useUrlNav } from '@/lib/portal/usePortalTabSync';
import OnlineCheckinPanel from './OnlineCheckinPanel';
import SelfCheckinPanel from './SelfCheckinPanel';
import styles from './checkinsection.module.css';

interface Event {
  id: string;
  title: string;
  start_date: string;
  is_online: boolean;
  slug?: string | null;
  self_checkin_mode?: 'off' | 'until_end' | 'forever';
  end_date?: string | null;
  checkin_windows?: { day: string; start: string; end: string }[] | null;
}

type Tab = 'self' | 'online';

// What staff need from a computer: the event's self check-in QR and, for online events, the code to reveal. Typing a 6-digit code (a ticket's or a meeting's) is the box at the top of the Dashboard;
// scanning with a camera (tickets, meetings, reward pickups) is the Scan button in the phone's bottom bar. (The older address /portal/checkin/code opens the first tab.)
export default function CheckInSectionContent({ events, canControlSelfCheckin }: { events: Event[]; canControlSelfCheckin: boolean; initialTab?: string }) {
  const { tab: initialTab } = useUrlNav();
  // Only events actually marked online get the code-reveal panel: an in-person event has no one who'd ever need a code, and showing the tab anyway would just invite an officer to reveal a code nobody's meant to use.
  const onlineEvents = events.filter((e) => e.is_online);
  const available: Tab[] = [...(events.length > 0 ? (['self'] as const) : []), ...(onlineEvents.length > 0 ? (['online'] as const) : [])];
  const [tab, setTab] = useState<Tab | undefined>(available.includes(initialTab as Tab) ? (initialTab as Tab) : available[0]);
  const syncUrl = usePortalTabSync('checkin');
  function selectTab(t: Tab) {
    setTab(t);
    syncUrl(t);
  }

  return (
    <div className={styles.page}>
      {available.length === 0 ? (
        <section className={styles.codePanel}>
          <h2>Nothing To Set Up Here Yet</h2>
          <p>There is no event to check people into right now. To check in with a 6-digit code, use the box at the top of the Dashboard.</p>
          <Link href="/portal">Go to the Dashboard</Link>
        </section>
      ) : (
        <>
          <SectionTabs
            value={tab ?? available[0]}
            onChange={selectTab}
            tabs={[
              ...(events.length > 0 ? [{ id: 'self' as const, label: 'Self Check-In', icon: <QrCode /> }] : []),
              ...(onlineEvents.length > 0 ? [{ id: 'online' as const, label: 'Online Check-In', icon: <Wifi /> }] : []),
            ]}
          />
          {tab === 'self' && events.length > 0 && <SelfCheckinPanel events={events} canControl={canControlSelfCheckin} />}
          {tab === 'online' && onlineEvents.length > 0 && <OnlineCheckinPanel events={onlineEvents} />}
        </>
      )}
    </div>
  );
}
