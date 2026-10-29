'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Gift, Package } from 'lucide-react';
import Button from '@/components/ui/Button';
import RequestsTab from './RequestsTab';
import BorrowedTab from './BorrowedTab';
import type { LogisticsApi, Catalog } from './useLogistics';
import type { EventPage as EventPageId } from './logisticsRoute';
import styles from './logistics.module.css';

// One event, on one page: what it is (name, dates, a few numbers that each open Devices or Prizing for it) and, below, what the teams asked for and what is being lent.
// Allocation, the event day and the prize stations live on the Devices and Prizing tabs; this page only keeps the asking and lending.
export default function EventOverview({
  name,
  dates,
  closed,
  notes,
  portalEvent,
  stats,
  section,
  requests,
  plan,
  catalog,
  data,
  onBack,
  onOpenDevices,
  onOpenPrizing,
  menu,
}: {
  name: string;
  dates: string;
  closed: boolean;
  notes: string | null;
  portalEvent: boolean;
  stats: {
    teams: number;
    requests: number;
    newRequests: number;
    devices: number;
    empty: number;
    prizes: number;
    deviceRequests: number;
    prizeRequests: number;
    sponsorLoaners: number;
    officerLoaners: number;
  };
  section: EventPageId;
  requests: React.ComponentProps<typeof RequestsTab>['store'];
  plan: React.ComponentProps<typeof RequestsTab>['plan'];
  catalog: LogisticsApi;
  data: Catalog;
  onBack: () => void;
  onOpenDevices: () => void;
  onOpenPrizing: () => void;
  menu?: React.ReactNode;
}) {
  // Every part starts folded; an old address that named one (prize requests, sponsor loaners…) opens that part and scrolls to it.
  const target = section === 'requests-prizing' ? 'ev-prizes' : section === 'sponsor-loaners' ? 'ev-sponsor' : section === 'officer-loaners' ? 'ev-officer' : null;
  const [open, setOpen] = useState<Record<string, boolean>>(target ? { [target]: true } : {});
  useEffect(() => {
    if (target) setTimeout(() => document.getElementById(target)?.scrollIntoView({ block: 'start' }), 600);
  }, [target]);
  const part = (id: string, title: string, count: number, body: React.ReactNode) => (
    <details
      className={styles.evSection}
      id={id}
      open={!!open[id]}
      onToggle={(e) => {
        const o = (e.currentTarget as HTMLDetailsElement).open;
        setOpen((c) => (c[id] === o ? c : { ...c, [id]: o }));
      }}
    >
      <summary>
        <h3>{title}</h3>
        <span className={styles.evCount}>{count}</span>
      </summary>
      {open[id] && body}
    </details>
  );
  return (
    <div className={styles.evPage}>
      <div className={styles.evHead}>
        <button type="button" className={styles.back} onClick={onBack} aria-label="All events">
          <ArrowLeft size={15} aria-hidden="true" /> <span className={styles.backText}>All Events</span>
        </button>
        <div className={styles.evTitle}>
          <h2>
            {name}
            {closed && <span className={`${styles.badge} ${styles.neutral}`}>Closed</span>}
          </h2>
          <p>
            {dates}
            {portalEvent ? ' · Portal event' : ' · Event logistics only'}
            {notes ? ` · ${notes}` : ''}
          </p>
        </div>
        <div className={styles.evGo}>
          <Button variant="secondary" size="sm" onClick={onOpenDevices}>
            <Package size={15} aria-hidden="true" /> Open Devices
          </Button>
          <Button variant="secondary" size="sm" onClick={onOpenPrizing}>
            <Gift size={15} aria-hidden="true" /> Open Prizing
          </Button>
          {menu}
        </div>
      </div>
      <dl className={styles.evStats}>
        <div>
          <dt>Teams</dt>
          <dd>{stats.teams}</dd>
        </div>
        <div>
          <dt>Requests</dt>
          <dd>
            {stats.requests}
            {stats.newRequests > 0 && <small className={styles.warnText}>{stats.newRequests} new</small>}
          </dd>
        </div>
        <button type="button" onClick={onOpenDevices}>
          <dt>Devices</dt>
          <dd>
            {stats.devices}
            {stats.empty > 0 && <small className={styles.warnText}>{stats.empty} to fill</small>}
          </dd>
        </button>
        <button type="button" onClick={onOpenPrizing}>
          <dt>Prizes</dt>
          <dd>{stats.prizes}</dd>
        </button>
      </dl>
      {part('ev-devices', 'Device Requests', stats.deviceRequests, <RequestsTab store={requests} kind="devices" plan={plan} api={catalog} data={data} />)}
      {part('ev-prizes', 'Prize Requests', stats.prizeRequests, <RequestsTab store={requests} kind="prizes" plan={plan} api={catalog} data={data} />)}
      {part('ev-sponsor', 'Sponsor Loaners', stats.sponsorLoaners, <BorrowedTab plan={plan} catalog={catalog} data={data} kind="sponsor" />)}
      {part('ev-officer', 'Officer Loaners', stats.officerLoaners, <BorrowedTab plan={plan} catalog={catalog} data={data} kind="officer" />)}
    </div>
  );
}
