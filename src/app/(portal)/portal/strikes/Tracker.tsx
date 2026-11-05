'use client';

import { useAddressState, textCodec } from '@/lib/portal/usePageState';
import { usePortalTabSync, useUrlNav } from '@/lib/portal/usePortalTabSync';
import Loading from '@/components/Loading/Loading';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarX, Users, Moon, Search, ShieldAlert, Ticket, X } from 'lucide-react';
import Notice from '@/components/ui/Notice';
import SectionTabs from '@/components/ui/SectionTabs';
import { STRIKES_AT_LIMIT } from '@/lib/members/strikeLabels';
import styles from './tracker.module.css';
import { Filter, Person, Tab } from './types';
import { Header } from './Header';
import { Avatar } from './Avatar';
import { Pips } from './Pips';
import { PersonDetail } from './PersonDetail';
import { ResetBar } from './ResetBar';
import { Missed } from './Missed';

export function Tracker() {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [limit, setLimit] = useState(3);
  const [me, setMe] = useState('');
  const [missed, setMissed] = useState(0);
  const [error, setError] = useState('');
  // The open view and the open person are in the address, so each can be copied and opened again.
  const { tab: urlTab } = useUrlNav();
  const syncUrl = usePortalTabSync('strikes');
  const [tab, setTabState] = useState<Tab>(urlTab === 'missed' ? 'missed' : 'people');
  const setTab = (t: Tab) => {
    setTabState(t);
    syncUrl(t);
  };
  const [selectedId, setSelectedId] = useAddressState('person', textCodec);
  const selected: string | null = selectedId || null;
  const setSelected = (v: string | null) => setSelectedId(v ?? '');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/strikes', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || 'Couldn’t load strikes.');
        return;
      }
      setPeople(j.people);
      setLimit(j.limit);
      setMe(j.me);
      setMissed(j.suggestionCount);
      setError('');
    } catch {
      setError('Couldn’t reach the server.');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(
    () =>
      (people ?? [])
        .filter((p) => {
          if (filter === 'strikes' && p.active === 0) return false;
          if (filter === 'limit' && !p.atLimit) return false;
          return !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase());
        })
        .sort((a, b) => Number(b.atLimit) - Number(a.atLimit) || b.active - a.active || a.name.localeCompare(b.name)),
    [people, filter, q],
  );

  if (error && !people) return <Notice tone="error">{error}</Notice>;
  if (!people) return <Loading label="Loading strikes…" />;
  const sel = people.find((p) => p.id === selected) ?? null;

  return (
    <div className={styles.page}>
      <Header />
      <SectionTabs<Tab>
        label="Strikes"
        value={tab}
        onChange={(t) => {
          setTab(t);
          setSelected(null);
        }}
        tabs={[
          { id: 'people', label: 'People', icon: <Users size={15} />, count: people.length },
          { id: 'missed', label: 'Missed meetings', icon: <CalendarX size={15} />, badge: missed },
        ]}
      />
      {error && <Notice tone="error">{error}</Notice>}

      {tab === 'people' && (
        <div className={`${styles.split} ${sel ? styles.hasSel : ''}`}>
          <div className={styles.listCol}>
            <div className={styles.bar}>
              <div className={styles.search}>
                <Search size={14} aria-hidden="true" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a person" aria-label="Find a person" />
                {q && (
                  <button type="button" className={styles.searchClear} onClick={() => setQ('')} aria-label="Clear search">
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className={styles.filters} role="group" aria-label="Show">
                {(
                  [
                    ['all', 'Everyone'],
                    ['strikes', 'Has strikes'],
                    ['limit', `At ${STRIKES_AT_LIMIT} strikes`],
                  ] as [Filter, string][]
                ).map(([id, label]) => (
                  <button key={id} type="button" className={`${styles.chip} ${filter === id ? styles.chipOn : ''}`} aria-pressed={filter === id} onClick={() => setFilter(id)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <ul className={styles.people}>
              {shown.map((p) => (
                <li key={p.id}>
                  <button type="button" className={`${styles.person} ${selected === p.id ? styles.personOn : ''}`} onClick={() => setSelected(p.id)}>
                    <Avatar name={p.name} src={p.avatar_url} />
                    <span className={styles.personName}>
                      <strong>{p.name}</strong>
                      <small>{p.role}</small>
                    </span>
                    {p.inactive && (
                      <span className={styles.idleTag} title="Inactive this quarter">
                        <Moon size={11} aria-hidden="true" /> Inactive
                      </span>
                    )}
                    {p.vouchers > 0 && (
                      <span className={styles.voucherTag} title="Unused vouchers">
                        <Ticket size={11} aria-hidden="true" /> {p.vouchers}
                      </span>
                    )}
                    <Pips active={p.active} limit={limit} />
                  </button>
                </li>
              ))}
              {shown.length === 0 && <li className={styles.muted}>No one matches.</li>}
            </ul>
          </div>
          <div className={styles.detailCol}>
            {sel ? (
              <PersonDetail key={sel.id} person={sel} limit={limit} me={me} onBack={() => setSelected(null)} onChanged={load} />
            ) : (
              <div className={styles.placeholder}>
                <ShieldAlert size={26} strokeWidth={1.5} aria-hidden="true" />
                <p>Pick a person to see their record.</p>
              </div>
            )}
          </div>
        </div>
      )}
      {tab === 'people' && !sel && <ResetBar onDone={load} />}
      {tab === 'missed' && <Missed me={me} onChanged={load} />}
    </div>
  );
}
