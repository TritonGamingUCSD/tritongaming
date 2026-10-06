'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, History } from 'lucide-react';
import PortalLink from '@/components/portal/PortalLink';
import { formatPacificDateTime } from '@/lib/timezone';
import styles from './adminOverview.module.css';

interface Attention { id: string; text: string; detail: string; href: string }
interface AuditRow { id: string; created_at: string; actor_name: string | null; action: string; summary: string }

// Two panels under the Overview numbers: what needs an admin's eye right now, and the latest changes anyone made.
export default function AdminOverviewPanels() {
  const [attention, setAttention] = useState<Attention[] | null>(null);
  const [recent, setRecent] = useState<AuditRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sys, log] = await Promise.all([fetch('/api/admin/system-stats'), fetch('/api/admin/audit')]);
        const sysJson = sys.ok ? await sys.json() : null;
        const logJson = log.ok ? await log.json() : null;
        if (cancelled) return;
        const items: Attention[] = [];
        const latest = sysJson?.vercel?.deployments?.[0];
        if (latest?.state === 'ERROR') items.push({ id: 'deploy', text: 'The latest deployment failed', detail: 'Open System to see the recent deployments', href: '/portal/admin/system' });
        const db = sysJson?.database;
        if (db?.rlsEnabledTables !== undefined && db.totalTables !== undefined && db.rlsEnabledTables < db.totalTables) items.push({ id: 'rls', text: `${db.totalTables - db.rlsEnabledTables} table${db.totalTables - db.rlsEnabledTables === 1 ? '' : 's'} without row-level security`, detail: 'Open System to review the database', href: '/portal/admin/system' });
        setAttention(items);
        setRecent((logJson?.entries ?? []).slice(0, 8));
        if (!sys.ok && !log.ok) setFailed(true);
      } catch {
        if (!cancelled) { setFailed(true); setAttention([]); setRecent([]); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className={styles.panels}>
      <section className={styles.panel} aria-label="Needs attention">
        <h2 className={styles.title}><AlertTriangle size={14} aria-hidden="true" /> Needs attention</h2>
        {attention === null ? <p className={styles.muted}>Checking…</p>
          : attention.length === 0 ? <p className={styles.ok}><CheckCircle2 size={16} aria-hidden="true" /> {failed ? 'Could not check right now.' : 'Nothing needs attention.'}</p>
          : (
            <ul className={styles.list}>
              {attention.map((a) => (
                <li key={a.id}>
                  <PortalLink href={a.href} className={styles.item}>
                    <span className={styles.dot} aria-hidden="true" />
                    <span className={styles.itemText}><strong>{a.text}</strong><small>{a.detail}</small></span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </PortalLink>
                </li>
              ))}
            </ul>
          )}
      </section>

      <section className={styles.panel} aria-label="Recent admin actions">
        <h2 className={styles.title}><History size={14} aria-hidden="true" /> Recent changes</h2>
        {recent === null ? <p className={styles.muted}>Loading…</p>
          : recent.length === 0 ? <p className={styles.muted}>No changes recorded yet.</p>
          : (
            <ul className={styles.list}>
              {recent.map((r) => (
                <li key={r.id} className={styles.row}>
                  <span className={styles.diamond} aria-hidden="true" />
                  <span className={styles.itemText}><strong>{r.summary}</strong><small>{r.actor_name ?? 'System'} · {formatPacificDateTime(r.created_at)}</small></span>
                </li>
              ))}
            </ul>
          )}
        <PortalLink href="/portal/admin/audit-log" className={styles.more}>See the whole audit log →</PortalLink>
      </section>
    </div>
  );
}
