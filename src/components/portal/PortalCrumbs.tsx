'use client';

import { Fragment, useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { mergedPortalParams, portalHref } from '@/lib/portalPath';
import { navigatePortal } from '@/lib/portalNav';
import styles from './PortalHub.module.css';

// "Admin › People › Member Management": the open section, then its tab and subtab, read from the address
// (/portal/<section>/<tab>/<subtab>). Each level before the last is a link back to that level.
const WORD: Record<string, string> = { qr: 'QR', ics: 'ICS', faq: 'FAQ', tg: 'TG', ucsd: 'UCSD', api: 'API' };
export function slugLabel(slug: string): string {
  return decodeURIComponent(slug).split(/[-_\s]+/).filter(Boolean).map((w) => WORD[w.toLowerCase()] ?? w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function PortalCrumbs({ section, sectionLabel, className }: { section: string; sectionLabel: string; className?: string }) {
  const [tab, setTab] = useState<string | null>(null);
  const [subtab, setSubtab] = useState<string | null>(null);
  useEffect(() => {
    const read = () => {
      const p = mergedPortalParams(window.location.pathname, window.location.search);
      setTab(p.get('tab')); setSubtab(p.get('tab') ? p.get('subtab') : null);
    };
    read();
    window.addEventListener('tg:portal-nav', read);
    window.addEventListener('popstate', read);
    const id = window.setInterval(read, 400);   // tabs rewrite the address with replaceState, which fires no event
    return () => { window.removeEventListener('tg:portal-nav', read); window.removeEventListener('popstate', read); window.clearInterval(id); };
  }, [section]);

  // The trail starts at the page itself (Documentation › Read), without the menu group in front.
  const trail: { label: string; href?: string }[] = [];
  trail.push({ label: sectionLabel, href: portalHref(new URLSearchParams({ section })) });
  if (tab) trail.push({ label: slugLabel(tab), href: portalHref(new URLSearchParams({ section, tab })) });
  if (subtab) trail.push({ label: slugLabel(subtab), href: portalHref(new URLSearchParams({ section, tab: tab!, subtab })) });
  return (
    <nav className={`${styles.crumbTrail} ${className ?? ''}`} aria-label="You are here">
      {trail.map((c, i) => {
        const last = i === trail.length - 1;
        return (
          <Fragment key={i}>
            {i > 0 && <ChevronRight size={11} strokeWidth={2} aria-hidden="true" className={styles.crumbSep} />}
            {last ? <span className={styles.crumbHere} aria-current="page">{c.label}</span>
              : <a className={styles.crumbLink} href={c.href} onClick={(e) => { if (c.href && navigatePortal(c.href, e)) e.preventDefault(); }}>{c.label}</a>}
          </Fragment>
        );
      })}
    </nav>
  );
}
