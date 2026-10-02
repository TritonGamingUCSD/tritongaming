'use client';

import { Suspense, useState } from 'react';
import type { ReactNode } from 'react';
import DashboardClient from './DashboardClient';
import UpcomingEventsPreview from './UpcomingEventsPreview';
import PortalHub, { useIsDesktop, type HubSection, type HubIdentity } from '@/components/portal/PortalHub';
import Link from 'next/link';
import Image from 'next/image';
import { CalendarDays, Gift, UserPlus } from 'lucide-react';
import styles from './dashboard.module.css';

type Ticket = Parameters<typeof DashboardClient>[0]['ticket'];
type UpcomingEvent = Parameters<typeof UpcomingEventsPreview>[0]['events'][number];

// Everything above (and beside) the hub on the portal's home screen.
//
// Mobile: greeting, banner, next-ticket card and upcoming events stack above
// the hub, and all of it hides once a section is open (the section takes over).
//
// Desktop: the greeting header is pinned to the top of the screen and the
// sidebar pins right under it, so neither moves while the page scrolls. The
// banner / next-ticket / upcoming cards move into the content column (beside
// the sidebar) on the home view only.
export default function PortalTopSection({
  top, desktop, banner, identity, railFooter, ticket, upcomingEvents, sections,
}: {
  top: ReactNode;
  /** Desktop app frame: the greeting for the Dashboard's title, the points tiles, and the admin "View as" menu. */
  desktop: { greeting: string; tiles: ReactNode; viewAs: ReactNode; banners: ReactNode };
  banner: ReactNode;
  identity: HubIdentity;
  railFooter: ReactNode;
  ticket: Ticket | null;
  upcomingEvents: UpcomingEvent[];
  sections: HubSection[];
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const isDesktop = useIsDesktop();

  const hasRewards = sections.some((x) => x.id === 'points');
  const cards = (
    <>
      {banner}
      {ticket && <DashboardClient ticket={ticket} />}
      <UpcomingEventsPreview events={upcomingEvents} />
      {/* Nothing booked and nothing coming up: say so, and offer a next step (phones only —
          desktop's home already has the full section list). */}
      {!ticket && upcomingEvents.length === 0 && (
        <section className={styles.emptyHome}>
          <Image src="/bytes/byte_tgex25.png" alt="" width={96} height={96} aria-hidden="true" className={styles.emptyHomeArt} />
          <h2 className={styles.emptyHomeTitle}>Nothing on your calendar</h2>
          <p className={styles.emptyHomeText}>No tickets yet, and no new events are open right now. Here&apos;s what you can do in the meantime.</p>
          <div className={styles.emptyHomeActions}>
            <Link href="/events" className={styles.emptyHomeBtn}><CalendarDays size={16} aria-hidden="true" /> See past events &amp; photos</Link>
            {hasRewards && <Link href="/portal?section=points" className={styles.emptyHomeBtn}><Gift size={16} aria-hidden="true" /> Check your rewards</Link>}
            <Link href="/get-involved" className={styles.emptyHomeBtn}><UserPlus size={16} aria-hidden="true" /> Get involved</Link>
          </div>
        </section>
      )}
    </>
  );

  if (isDesktop) {
    return (
      <Suspense>
        <PortalHub sections={sections} identity={identity} railFooter={railFooter} homeExtras={cards} onOpenChange={setPanelOpen} frame={desktop} />
      </Suspense>
    );
  }

  return (
    <>
      {!panelOpen && (
        <>
          {top}
          {cards}
        </>
      )}
      <Suspense>
        <PortalHub sections={sections} identity={identity} railFooter={railFooter} onOpenChange={setPanelOpen} />
      </Suspense>
    </>
  );
}
