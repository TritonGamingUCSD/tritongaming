'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { navigatePortal } from '@/lib/portal/portalNav';

// A link to another page of the portal. Inside the hub it just switches the view (the data is already loaded), so it is instant
// instead of asking the server for the whole portal again; "open in new tab" and links outside the portal behave as usual.
export default function PortalLink({ href, onClick, ...rest }: ComponentProps<typeof Link>) {
  return (
    <Link
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented && typeof href === 'string' && navigatePortal(href, e)) e.preventDefault();
      }}
      {...rest}
    />
  );
}
