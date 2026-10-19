'use client';

import { useEffect } from 'react';

// "Add to Home Screen" always means the portal. Android's install already opens the manifest's start_url (/portal); iPhones open whichever page was on screen when it was added, so when the
// site is opened from a home-screen icon (standalone) and that first page is not in the portal, this sends it to /portal. Only the first page of a launch: later pages in the same
// window (a link to the public site, the sign-in pages) are left alone, and a notification that opens a portal page is already in the portal.
const SKIP = /^\/(portal|login|auth|api)(\/|$)/;

export default function HomeScreenLaunch() {
  useEffect(() => {
    try {
      const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
      if (!standalone || sessionStorage.getItem('tg-launched')) return;
      sessionStorage.setItem('tg-launched', '1');
      if (!SKIP.test(window.location.pathname)) window.location.replace('/portal');
    } catch { /* storage unavailable: the page just stays where it is */ }
  }, []);
  return null;
}
