'use client';

import { useEffect } from 'react';

// The member pages (/me) use the portal's dark colors, so they match the site around them and their popups too. Set on the page while /me is open and put back when the person leaves (nothing is saved: the portal keeps its own light/dark choice).
export default function MeTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const before = root.getAttribute('data-pp-theme');
    root.setAttribute('data-pp-theme', 'dark');
    return () => {
      if (before) root.setAttribute('data-pp-theme', before);
      else root.removeAttribute('data-pp-theme');
    };
  }, []);
  return null;
}
