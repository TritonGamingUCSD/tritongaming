'use client';

import { useState } from 'react';
import { Suspense } from 'react';
import DashboardClient from './DashboardClient';
import UpcomingEventsPreview from './UpcomingEventsPreview';
import PortalHub, { type HubSection } from '@/components/portal/PortalHub';

type Ticket = Parameters<typeof DashboardClient>[0]['ticket'];
type UpcomingEvent = Parameters<typeof UpcomingEventsPreview>[0]['events'][number];

// Wraps the "next ticket" banner + upcoming-events preview above the hub.
// Search now lives higher up, in page.tsx right below the greeting header
// (see .mobileSearchWrap there) — above this and the checkin banner too.
// Mobile has no card grid to match widths with anymore, so both of these
// just take their flex parent's full width.
export default function PortalTopSection({ ticket, upcomingEvents, sections }: { ticket: Ticket | null; upcomingEvents: UpcomingEvent[]; sections: HubSection[] }) {
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <>
      {/* Hidden while a panel is expanded — there's no room for a
          persistent banner/preview once a section takes over the whole
          screen. */}
      {!panelOpen && (
        <>
          {ticket && <DashboardClient ticket={ticket} />}
          <UpcomingEventsPreview events={upcomingEvents} />
        </>
      )}
      <Suspense>
        <PortalHub sections={sections} onOpenChange={setPanelOpen} />
      </Suspense>
    </>
  );
}
