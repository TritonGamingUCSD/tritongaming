'use client';

import { useLinkStatus } from 'next/link';

// Placed inside a <Link>: while that link's page is still being fetched it shows a slim bar across the top of the screen, and the CSS in
// portal-controls.css dims the link and gives it a busy cursor, so a click never looks like nothing happened.
export default function LinkPending() {
  const { pending } = useLinkStatus();
  return pending ? <span className="tg-link-pending" role="status" aria-label="Loading" /> : null;
}
