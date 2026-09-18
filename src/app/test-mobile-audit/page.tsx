'use client';

import PortalHub, { type HubSection } from '@/components/portal/PortalHub';
import CheckInClient from '@/app/(portal)/portal/checkin/CheckInClient';

// TEMPORARY — verifying whether closing a hub panel (clicking "Dashboard")
// while the camera is actively running actually unmounts CheckInClient and
// releases the stream, matching the real /portal hub architecture exactly.
const sections: HubSection[] = [
  {
    id: 'checkin',
    icon: <span>C</span>,
    label: 'Check-In',
    description: 'test',
    content: <CheckInClient events={[{ id: 'e1', title: 'Test Event', start_date: '2026-09-20T18:00:00.000Z' }]} />,
  },
];

export default function TestHubCamera() {
  return (
    <div style={{ padding: 20, background: '#060c1a', minHeight: '100vh' }}>
      <PortalHub sections={sections} />
    </div>
  );
}
