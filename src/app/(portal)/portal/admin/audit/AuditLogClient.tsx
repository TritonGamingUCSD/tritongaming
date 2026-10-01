'use client';

import { useCallback, useEffect, useState } from 'react';
import { ScrollText, Download } from 'lucide-react';
import { usePortalParams, useLiveParams } from '@/lib/usePortalParams';
import Notice from '@/components/ui/Notice';
import Button from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { PACIFIC_TZ, formatPacificDateTime } from '@/lib/timezone';
import styles from './audit.module.css';

interface Entry {
  id: string;
  created_at: string;
  actor_name: string | null;
  action: string;
  entity_type: string;
  summary: string | null;
  details: Record<string, unknown> | null;
}

const TYPES = ['', 'event', 'division', 'doc', 'doc category', 'photo album', 'reward', 'officer reward', 'account', 'site content', 'tier', 'points', 'check-in'];

function renderValue(v: unknown) {
  if (v === null || v === undefined || v === '') return '—';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

// A trigger-logged update stores { field: { from, to } }; anything else is
// shown as plain key/value pairs. Always visible — no click to see what changed.
function Changes({ details }: { details: Record<string, unknown> }) {
  return (
    <dl className={styles.changes}>
      {Object.entries(details).map(([k, v]) => {
        const change = v && typeof v === 'object' && 'to' in (v as object) ? (v as { from?: unknown; to?: unknown }) : null;
        return (
          <div key={k} className={styles.change}>
            <dt className={styles.changeKey}>{k.replace(/_/g, ' ')}</dt>
            {change ? (
              <dd className={styles.changeVal}>
                <span className={styles.from}>{renderValue(change.from)}</span>
                <span className={styles.arrow} aria-hidden="true">→</span>
                <span className={styles.to}>{renderValue(change.to)}</span>
              </dd>
            ) : (
              <dd className={styles.changeVal}><span className={styles.to}>{renderValue(v)}</span></dd>
            )}
          </div>
        );
      })}
    </dl>
  );
}

export default function AuditLogClient() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const searchParams = useLiveParams();
  const setParams = usePortalParams();
  const [type, setType] = useState(() => searchParams.get('atype') ?? '');
  const [search, setSearch] = useState(() => searchParams.get('aq') ?? '');
  const [q, setQ] = useState(() => searchParams.get('aq') ?? '');

  useEffect(() => {
    const t = setTimeout(() => setQ(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async (before?: string) => {
    setLoading(true);
    setError('');
    try {
      const p = new URLSearchParams();
      if (type) p.set('type', type);
      if (q) p.set('q', q);
      if (before) p.set('before', before);
      const res = await fetch(`/api/admin/audit?${p}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Failed to load audit log.'); return; }
      setEntries((prev) => (before ? [...prev, ...json.entries] : json.entries));
      setHasMore(!!json.hasMore);
    } catch {
      setError('Network error loading audit log.');
    } finally {
      setLoading(false);
    }
  }, [type, q]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className={styles.wrap}>
      <div className={styles.filters}>
        <Input className={styles.search} value={search} onChange={(e) => { setSearch(e.target.value); setParams({ aq: e.target.value || null }); }} placeholder="Search summary or person…" />
        <Select className={styles.select} value={type} onChange={(e) => { setType(e.target.value); setParams({ atype: e.target.value || null }); }} aria-label="Filter by type">
          {TYPES.map((t) => <option key={t} value={t}>{t || 'All types'}</option>)}
        </Select>
        <a
          className={styles.exportBtn}
          href={`/api/admin/audit/export?${new URLSearchParams({ ...(type ? { type } : {}), ...(q ? { q } : {}) })}`}
          download
        >
          <Download size={14} strokeWidth={1.75} aria-hidden="true" /> Export CSV
        </a>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {!loading && entries.length === 0 && !error ? (
        <div className={styles.empty}>
          <ScrollText size={36} strokeWidth={1.25} aria-hidden="true" />
          <p>No matching activity yet.</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {entries.map((e) => {
            const hasDetails = !!e.details && Object.keys(e.details).length > 0;
            return (
              <li key={e.id} className={styles.item}>
                <div className={styles.itemHead}>
                  <span className={styles.badge}>{e.action}</span>
                  <span className={styles.type}>{e.entity_type}</span>
                  <span className={styles.meta}>
                    {e.actor_name || 'System'} · {formatPacificDateTime(e.created_at, { year: true })}
                  </span>
                </div>
                <p className={styles.summary}>{e.summary}</p>
                {hasDetails && e.details && <Changes details={e.details} />}
              </li>
            );
          })}
        </ul>
      )}
      {loading && <p className={styles.hint}>Loading…</p>}
      {hasMore && !loading && (
        <Button variant="ghost" className={styles.more} onClick={() => load(entries[entries.length - 1].created_at)}>Load more</Button>
      )}
    </div>
  );
}
