'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import DashboardClient from './DashboardClient';
import UpcomingEventsPreview from './UpcomingEventsPreview';
import PortalHub, { useIsDesktop, type HubSection, type HubIdentity } from '@/components/portal/PortalHub';
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
  top, banner, identity, railFooter, ticket, upcomingEvents, sections,
}: {
  top: ReactNode;
  banner: ReactNode;
  identity: HubIdentity;
  railFooter: ReactNode;
  ticket: Ticket | null;
  upcomingEvents: UpcomingEvent[];
  sections: HubSection[];
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const isDesktop = useIsDesktop();
  const stickyRef = useRef<HTMLDivElement>(null);

  // Tell the sidebar how tall the pinned header is so it can sit right below it.
  useEffect(() => {
    const el = stickyRef.current;
    const root = document.documentElement;
    if (!isDesktop || !el) { root.style.removeProperty('--portal-header-h'); return; }
    const set = () => root.style.setProperty('--portal-header-h', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => { ro.disconnect(); root.style.removeProperty('--portal-header-h'); };
  }, [isDesktop]);

  const cards = (
    <>
      {banner}
      {ticket && <DashboardClient ticket={ticket} />}
      <UpcomingEventsPreview events={upcomingEvents} />
    </>
  );

  if (isDesktop) {
    return (
      <>
        <div className={styles.stickyTop} ref={stickyRef}>{top}</div>
        <Suspense>
          <PortalHub sections={sections} identity={identity} railFooter={railFooter} homeExtras={cards} onOpenChange={setPanelOpen} />
        </Suspense>
      </>
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
