'use client';

import { useLayoutEffect } from 'react';
import { applyPortalTheme, getThemeChoice, setThemeChoice } from '@/lib/portal/themeScript';

// Settles the portal's light/dark choice when someone navigates into the portal from another page without a full load (the inline script in the root
// layout only runs on a full load), and, when the choice is System, follows the device while the page is open. Draws nothing.
export default function PortalThemeInit() {
  useLayoutEffect(() => {
    applyPortalTheme();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const follow = () => {
      if (getThemeChoice() === 'system') setThemeChoice('system');
    };
    mq.addEventListener('change', follow);
    return () => mq.removeEventListener('change', follow);
  }, []);
  return null;
}
