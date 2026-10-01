'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ScrollText } from 'lucide-react';
import Notice from '@/components/ui/Notice';
import Button from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { PACIFIC_TZ } from '@/lib/timezone';
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
// shown as plain key/value pairs.
function DetailRows({ details }: { details: Record<string, unknown> }) {
  return (
    <div className={styles.detail}>
      {Object.entries(details).map(([k, v]) => {
        const change = v && typeof v === 'object' && 'to' in (v as object) ? (v as { from?: unknown; to?: unknown }) : null;
        return (
          <div key={k} className={styles.detailRow}>
            <span className={styles.detailKey}>{k}</span>
            {change ? (
              <span className={styles.detailVal}>
                <span className={styles.old}>{renderValue(change.from)}</span> → <span className={styles.new}>{renderValue(change.to)}</span>
              </span>
            ) : (
              <span className={styles.detailVal}>{renderValue(v)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AuditLogClient() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

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
        <Input className={styles.search} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search summary or person…" />
        <Select className={styles.select} value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type">
          {TYPES.map((t) => <option key={t} value={t}>{t || 'All types'}</option>)}
        </Select>
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
            const open = openId === e.id;
            const hasDetails = !!e.details && Object.keys(e.details).length > 0;
            return (
              <li key={e.id} className={styles.item}>
                <button type="button" className={styles.itemHeader} onClick={() => hasDetails && setOpenId(open ? null : e.id)} disabled={!hasDetails}>
                  <span className={styles.badge}>{e.action}</span>
                  <span className={styles.summary}>
                    <span className={styles.type}>{e.entity_type}</span> {e.summary}
                  </span>
                  <span className={styles.meta}>
                    {e.actor_name || 'System'} · {new Date(e.created_at).toLocaleString('en-US', { timeZone: PACIFIC_TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </span>
                  {hasDetails && <ChevronDown size={15} strokeWidth={1.75} className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} aria-hidden="true" />}
                </button>
                {open && e.details && <DetailRows details={e.details} />}
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
