'use client';

import type { ComponentProps } from 'react';
import TicketsClient from './TicketsClient';
import ActivitySectionContent from '../activity/ActivitySectionContent';

// My Tickets, with the personal timeline of registrations and check-ins underneath. It used to be a History tab; old
// links to tab=history still land here.
export default function TicketsSectionContent({
  activity,
  ...tickets
}: ComponentProps<typeof TicketsClient> & { activity: ComponentProps<typeof ActivitySectionContent>['tickets'] }) {
  return (
    <div>
      <TicketsClient {...tickets} />
      {activity.length > 0 && <ActivitySectionContent tickets={activity} embedded />}
    </div>
  );
}
