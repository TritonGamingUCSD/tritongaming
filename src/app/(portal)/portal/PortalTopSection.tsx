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
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <>
      {/* Hidden while a panel is expanded — its width is matched to the
          card grid specifically (see onGridWidth below), which isn't on
          screen once a panel opens, so the banner would just be sized to
          a number that no longer corresponds to anything visible. */}
      {ticket && !panelOpen && (
        // `.page` (this div's parent) is a column flex container — a flex
        // item with an auto cross-axis margin (marginInline: 'auto', needed
        // to center it) stops stretching to fill the container by default,
        // and instead shrinks to fit its own content. width:100% overrides
        // that explicitly, so max-width actually gets a chance to matter
        // instead of the banner just sitting at its own natural (much
        // narrower) content width regardless of what max-width said.
        <div style={gridWidth ? { width: '100%', maxWidth: gridWidth, marginInline: 'auto' } : undefined}>
          <DashboardClient ticket={ticket} />
        </div>
      )}
      <Suspense>
        <PortalHub sections={sections} onGridWidth={setGridWidth} onOpenChange={setPanelOpen} />
      </Suspense>
    </>
  );
}
