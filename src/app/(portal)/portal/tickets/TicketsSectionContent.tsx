'use client';

import { useState, type ComponentProps } from 'react';
import { History } from 'lucide-react';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import TicketsClient from './TicketsClient';
import ActivitySectionContent from '../activity/ActivitySectionContent';

// My Tickets. The personal timeline of registrations and check-ins is one button away in a popup (it used to sit under the tickets); old links to tab=history still land here.
export default function TicketsSectionContent({
  activity,
  noHeader = false,
  ...tickets
}: ComponentProps<typeof TicketsClient> & { activity: ComponentProps<typeof ActivitySectionContent>['tickets']; noHeader?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      {activity.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: noHeader ? '0.6rem' : '-2.4rem', position: 'relative', zIndex: 1 }}>
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            <History size={14} aria-hidden="true" /> History
          </Button>
        </div>
      )}
      <TicketsClient {...tickets} />
      {open && (
        <Dialog title="History" wide onClose={() => setOpen(false)}>
          <ActivitySectionContent tickets={activity} embedded popup />
        </Dialog>
      )}
    </div>
  );
}
