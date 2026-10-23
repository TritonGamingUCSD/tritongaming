'use client';

import { useEffect, useState } from 'react';
import Link from '@/components/portal/PortalLink';
import { Boxes } from 'lucide-react';
import styles from './dashboardHome.module.css';

interface TodayPlan { id: string; slug: string; name: string; teams: number; devices: number; stepsDone: number; stepsTotal: number; newRequests: number }
// While an event is on today the Dashboard says so for the people who look at Logistics: how far the event-day steps are, and a way straight into Event Day.
export default function LogisticsDayCard() {
  const [plans, setPlans] = useState<TodayPlan[] | null>(null);
  useEffect(() => {
    let live = true;
    void fetch('/api/logistics/today').then((r) => (r.ok ? r.json() : { plans: [] })).then((j) => { if (live) setPlans(j.plans ?? []); }).catch(() => { if (live) setPlans([]); });
    return () => { live = false; };
  }, []);
  if (!plans?.length) return null;
  return (
    <>
      {plans.map((p) => {
        const pct = p.stepsTotal ? Math.min(100, Math.round((p.stepsDone / p.stepsTotal) * 100)) : 0;
        return (
          <section key={p.id} className={styles.dayCard} aria-label={`Event Day: ${p.name}`}>
            <div className={styles.dayCardHead}>
              <Boxes size={18} aria-hidden="true" />
              <b>{p.name}</b>
              <span className={styles.dayCardTag}>Today</span>
            </div>
            <div className={styles.dayCardBar} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Event day steps done"><i style={{ width: `${pct}%` }} /></div>
            <p className={styles.dayCardMeta}>{p.stepsDone} of {p.stepsTotal} steps done · {p.teams} teams · {p.devices} devices{p.newRequests > 0 ? ` · ${p.newRequests} new requests` : ''}</p>
            <div className={styles.dayCardActions}>
              <Link href={`/portal/logistics/${p.slug}/event-day-devices`} className={styles.primary}>Event Day: Devices</Link>
              <Link href={`/portal/logistics/${p.slug}/event-day-prizing`} className={styles.secondary}>Event Day: Prizing</Link>
            </div>
          </section>
        );
      })}
    </>
  );
}
