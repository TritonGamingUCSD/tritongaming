'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Users, UserCheck, GraduationCap, ExternalLink } from 'lucide-react';
import Link from '@/components/portal/PortalLink';
import SectionHeader from '@/components/ui/SectionHeader';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import { useLiveParams, usePortalParams } from '@/lib/portal/usePortalParams';
import { mergedPortalParams } from '@/lib/portal/portalPath';
import type { DivisionHat } from '@/components/portal/hubTypes';
import { DIVISION_PAGES, divisionPagesFor, isDivisionPageId } from '@/lib/divisions/pages';
import DivisionEvents from './DivisionEvents';
import DivisionCheckIn from './DivisionCheckIn';
import DivisionLive from './DivisionLive';
import DivisionPageEditor from './DivisionPageEditor';
import DivisionQr from './DivisionQr';
import styles from './division.module.css';

interface RosterPerson {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: 'division' | 'division_member' | 'division_alumni';
  since: string;
}
const ROLE_NAME = { division: 'Head', division_member: 'Member', division_alumni: 'Alumni' } as const;

// A division's pages in the portal. The address says which: /portal/division/<division address>/<page>. The division's sidebar (DesktopShell) lists the pages; this draws the open one.
// Home and Members are real; the rest arrive in the next steps of the division project (events, check-in and Live Tools for the division; page, docs and settings).
export default function DivisionSectionContent({ hats }: { hats: DivisionHat[] }) {
  const setParams = usePortalParams();
  // Which division and page is read from the address bar and followed as it changes: a switch rewrites the address with the history API and Next reports that late, so waiting for it left the old page showing.
  const startParams = useLiveParams();
  const [loc, setLoc] = useState<{ tab: string | null; subtab: string | null; detail: string | null }>(() => ({
    tab: startParams.get('tab'),
    subtab: startParams.get('subtab'),
    detail: startParams.get('detail'),
  }));
  useEffect(() => {
    const read = () => {
      const p = mergedPortalParams(window.location.pathname, window.location.search);
      setLoc({ tab: p.get('tab'), subtab: p.get('subtab'), detail: p.get('detail') });
    };
    read();
    for (const ev of ['tg:division-nav', 'tg:portal-nav', 'popstate']) window.addEventListener(ev, read);
    return () => {
      for (const ev of ['tg:division-nav', 'tg:portal-nav', 'popstate']) window.removeEventListener(ev, read);
    };
  }, []);
  const params = { get: (k: string) => (k === 'tab' ? loc.tab : k === 'subtab' ? loc.subtab : null) };
  const hat = hats.find((h) => h.slug === params.get('tab')) ?? null;
  const asked = params.get('subtab');
  if (!hat) {
    return (
      <div className={styles.page}>
        <SectionHeader
          title="Division"
          flush
          sub={
            params.get('tab')
              ? 'That division was not found, or you do not have access to it. Pick one of yours in the switcher above the menu.'
              : 'Pick one of your divisions in the switcher above the menu.'
          }
        />
      </div>
    );
  }
  const allowed = divisionPagesFor(hat.level);
  const page = isDivisionPageId(asked) && allowed.some((p) => p.id === asked) ? asked : 'home';
  const label = DIVISION_PAGES.find((p) => p.id === page)?.label ?? 'Home';
  return (
    <div className={styles.page} style={{ ['--hat' as string]: hat.accent }}>
      <SectionHeader
        title={page === 'home' ? hat.name : `${label}`}
        flush
        sub={page === 'home' ? 'The division’s home.' : hat.name}
        actions={
          <Link href={`/${hat.slug}`} className={styles.publicLink}>
            Public page <ExternalLink size={13} aria-hidden="true" />
          </Link>
        }
      />
      {/* A phone has no sidebar: the division's pages are a row of buttons under the title. */}
      <nav className={styles.phoneTabs} aria-label={`${hat.name} pages`}>
        {allowed.map((p) => (
          <button
            key={p.id}
            type="button"
            className={p.id === page ? styles.tabOn : ''}
            aria-current={p.id === page ? 'page' : undefined}
            onClick={() => {
              setParams({ subtab: p.id === 'home' ? null : p.id });
              window.dispatchEvent(new Event('tg:division-nav'));
            }}
          >
            {p.label}
          </button>
        ))}
      </nav>
      {page === 'home' && <Home hat={hat} />}
      {page === 'members' && <Roster hat={hat} />}
      {page === 'events' && <DivisionEvents hat={hat} />}
      {page === 'check-in' && <DivisionCheckIn hat={hat} />}
      {page === 'live' && <DivisionLive hat={hat} tool={loc.detail} />}
      {page === 'page' && <DivisionPageEditor hat={hat} />}
      {page === 'qr' && <DivisionQr hat={hat} />}
      {page !== 'home' && page !== 'members' && page !== 'events' && page !== 'check-in' && page !== 'live' && page !== 'page' && page !== 'qr' && (
        <div className={styles.soon}>
          <p>
            <strong>{label}</strong> for {hat.name} is coming in a later step of the division project. It is only visible to admins until everything is finished.
          </p>
        </div>
      )}
    </div>
  );
}

function Home({ hat }: { hat: DivisionHat }) {
  const cards = [
    { icon: <Users size={18} aria-hidden="true" />, label: 'Heads', n: hat.counts.heads },
    { icon: <UserCheck size={18} aria-hidden="true" />, label: 'Members', n: hat.counts.members },
    { icon: <GraduationCap size={18} aria-hidden="true" />, label: 'Alumni', n: hat.counts.alumni },
  ];
  return (
    <>
      <div className={styles.banner}>
        {hat.logoUrl ? (
          <Image src={hat.logoUrl} alt="" width={64} height={64} className={styles.logo} unoptimized />
        ) : (
          <span className={styles.logoFallback}>{hat.name.slice(0, 1)}</span>
        )}
        <div>
          <h2 className={styles.name}>{hat.name}</h2>
          <p className={styles.tag}>A Triton Gaming division</p>
        </div>
      </div>
      <div className={styles.stats}>
        {cards.map((c) => (
          <div key={c.label} className={styles.stat}>
            {c.icon}
            <b>{c.n}</b>
            <span>{c.label}</span>
          </div>
        ))}
      </div>
      <p className={styles.note}>Upcoming events, announcements and join requests will show here once they are built (the next steps of the division project).</p>
    </>
  );
}

function Roster({ hat }: { hat: DivisionHat }) {
  const [people, setPeople] = useState<RosterPerson[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setPeople(null);
    setError('');
    fetch(`/api/divisions/${hat.id}/roster`, { cache: 'no-store' })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!live) return;
        if (!r.ok) setError(j.error || 'Could not load the roster.');
        else setPeople(j.people as RosterPerson[]);
      })
      .catch(() => live && setError('Network error loading the roster.'));
    return () => {
      live = false;
    };
  }, [hat.id]);
  if (error) return <Notice tone="error">{error}</Notice>;
  if (!people) return <Loading variant="inline" label="Loading the roster…" />;
  if (!people.length) return <p className={styles.note}>Nobody has a role in this division yet.</p>;
  return (
    <ul className={styles.roster}>
      {people.map((p) => (
        <li key={p.id} className={styles.person}>
          {p.avatarUrl ? (
            <Image src={p.avatarUrl} alt="" width={36} height={36} className={styles.avatar} unoptimized referrerPolicy="no-referrer" />
          ) : (
            <span className={styles.avatarFallback}>{p.name.slice(0, 1)}</span>
          )}
          <span className={styles.pname}>{p.name}</span>
          <span className={`${styles.role} ${styles[p.role]}`}>{ROLE_NAME[p.role]}</span>
        </li>
      ))}
    </ul>
  );
}
