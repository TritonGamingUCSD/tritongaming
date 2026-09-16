'use client';

import { useState } from 'react';
import { Suspense } from 'react';
import DashboardClient from './DashboardClient';
import PortalHub, { type HubSection } from '@/components/portal/PortalHub';

type Ticket = Parameters<typeof DashboardClient>[0]['ticket'];

// Wraps the "next ticket" banner + the hub grid together so the banner can
// match the grid's actual rendered width (left AND right edges lined up
// with the card cluster below it) instead of just spanning the full
// container — the grid centers a variable number of cards, so its true
// width isn't something a sibling can know without measuring it. See
// PortalHub's onGridWidth for how that measurement gets here.
export default function PortalTopSection({ ticket, sections }: { ticket: Ticket | null; sections: HubSection[] }) {
  const [gridWidth, setGridWidth] = useState<number | null>(null);

  return (
    <>
      {ticket && (
        <div style={gridWidth ? { maxWidth: gridWidth, marginInline: 'auto' } : undefined}>
          <DashboardClient ticket={ticket} />
        </div>
      )}
      <Suspense>
        <PortalHub sections={sections} onGridWidth={setGridWidth} />
      </Suspense>
    </>
  );
}
