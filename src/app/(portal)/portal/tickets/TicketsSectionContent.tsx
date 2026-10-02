'use client';

import { useState, type ComponentProps } from 'react';
import { Ticket, History } from 'lucide-react';
import SectionTabs from '@/components/ui/SectionTabs';
import { usePortalTabSync, useUrlNav } from '@/lib/usePortalTabSync';
import TicketsClient from './TicketsClient';
import ActivitySectionContent from '../activity/ActivitySectionContent';

type Tab = 'tickets' | 'history';

// My Tickets, with the personal timeline of registrations and check-ins (it used to be its own section) as a tab.
export default function TicketsSectionContent({ activity, ...tickets }: ComponentProps<typeof TicketsClient> & { activity: ComponentProps<typeof ActivitySectionContent>['tickets'] }) {
  const nav = useUrlNav();
  const sync = usePortalTabSync('tickets');
  const [tab, setTab] = useState<Tab>(nav.tab === 'history' ? 'history' : 'tickets');
  return (
    <div>
      <SectionTabs<Tab>
        label="My tickets"
        value={tab}
        onChange={(t) => { setTab(t); sync(t); }}
        tabs={[{ id: 'tickets', label: 'Tickets', icon: <Ticket size={15} /> }, { id: 'history', label: 'History', icon: <History size={15} /> }]}
      />
      {tab === 'tickets' ? <TicketsClient {...tickets} /> : <ActivitySectionContent tickets={activity} />}
    </div>
  );
}
