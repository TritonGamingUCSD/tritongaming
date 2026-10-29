'use client';

import { useLayoutEffect } from 'react';
import { applyPortalTheme } from '@/lib/portal/themeScript';

// Settles the portal's light/dark choice when someone navigates into the portal from another page without a full load (the inline script in the root
// layout only runs on a full load). Draws nothing.
export default function PortalThemeInit() {
  useLayoutEffect(() => {
    applyPortalTheme();
  }, []);
  return null;
}
