'use client';

import { useEffect } from 'react';
import { ArrowLeft, Gift, Package } from 'lucide-react';
import Button from '@/components/ui/Button';
import RequestsTab from './RequestsTab';
import BorrowedTab from './BorrowedTab';
import type { LogisticsApi, Catalog } from './useLogistics';
import type { EventPage as EventPageId } from './logisticsRoute';
import styles from './logistics.module.css';

// One event, on one page: what it is (name, dates, a few numbers that each open Devices or Prizing for it) and, below, what the teams asked for and what is being lent.
// Allocation, the event day and the prize stations live on the Devices and Prizing tabs; this page only keeps the asking and lending.
export default function EventOverview({ name, dates, closed, notes, portalEvent, stats, section, requests, plan, catalog, data, onBack, onOpenDevices, onOpenPrizing }: {
  name: string; dates: string; closed: boolean; notes: string | null; portalEvent: boolean;
  stats: { teams: number; requests: number; newRequests: number; devices: number; empty: number; prizes: number };
  section: EventPageId; requests: React.ComponentProps<typeof RequestsTab>['store']; plan: React.ComponentProps<typeof RequestsTab>['plan']; catalog: LogisticsApi; data: Catalog;
  onBack: () => void; onOpenDevices: () => void; onOpenPrizing: () => void;
}) {
  // An old address that named one part (prize requests, sponsor loaners…) scrolls to that part.
  useEffect(() => {
    const id = section === 'requests-prizing' ? 'ev-prizes' : section === 'sponsor-loaners' ? 'ev-sponsor' : section === 'officer-loaners' ? 'ev-officer' : null;
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 600);
  }, [section]);
  return (
    <div className={styles.evPage}>
      <div className={styles.evHead}>
        <button type="button" className={styles.back} onClick={onBack} aria-label="All events"><ArrowLeft size={15} aria-hidden="true" /> <span className={styles.backText}>All Events</span></button>
        <div className={styles.evTitle}>
          <h2>{name}{closed && <span className={`${styles.badge} ${styles.neutral}`}>Closed</span>}</h2>
          <p>{dates}{portalEvent ? ' · Portal event' : ' · Event logistics only'}{notes ? ` · ${notes}` : ''}</p>
        </div>
        <div className={styles.evGo}>
          <Button variant="secondary" size="sm" onClick={onOpenDevices}><Package size={15} aria-hidden="true" /> Open Devices</Button>
          <Button variant="secondary" size="sm" onClick={onOpenPrizing}><Gift size={15} aria-hidden="true" /> Open Prizing</Button>
        </div>
      </div>
      <dl className={styles.evStats}>
        <div><dt>Teams</dt><dd>{stats.teams}</dd></div>
        <div><dt>Requests</dt><dd>{stats.requests}{stats.newRequests > 0 && <small className={styles.warnText}>{stats.newRequests} new</small>}</dd></div>
        <button type="button" onClick={onOpenDevices}><dt>Devices</dt><dd>{stats.devices}{stats.empty > 0 && <small className={styles.warnText}>{stats.empty} to fill</small>}</dd></button>
        <button type="button" onClick={onOpenPrizing}><dt>Prizes</dt><dd>{stats.prizes}</dd></button>
      </dl>
      <section className={styles.evSection} id="ev-devices" aria-label="Device requests">
        <h3>Device Requests</h3>
        <RequestsTab store={requests} kind="devices" plan={plan} api={catalog} data={data} />
      </section>
      <section className={styles.evSection} id="ev-prizes" aria-label="Prize requests">
        <h3>Prize Requests</h3>
        <RequestsTab store={requests} kind="prizes" plan={plan} api={catalog} data={data} />
      </section>
      <section className={styles.evSection} id="ev-sponsor" aria-label="Sponsor loaners">
        <h3>Sponsor Loaners</h3>
        <BorrowedTab plan={plan} catalog={catalog} data={data} kind="sponsor" />
      </section>
      <section className={styles.evSection} id="ev-officer" aria-label="Officer loaners">
        <h3>Officer Loaners</h3>
        <BorrowedTab plan={plan} catalog={catalog} data={data} kind="officer" />
      </section>
    </div>
  );
}
