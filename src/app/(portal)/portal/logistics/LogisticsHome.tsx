'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CalendarDays, CircleAlert, Gift, History, Package, Table2, Trophy } from 'lucide-react';
import Link from '@/components/portal/PortalLink';
import Loading from '@/components/Loading/Loading';
import { call } from '@/lib/ui/apiCall';
import { CONDITIONS, UNUSABLE } from '@/lib/logistics/constants';
import { isLoose, setLooseSizes } from '@/lib/logistics/prizes';
import { money, valueOf } from '@/lib/logistics/prizing';
import type { Catalog } from './useLogistics';
import type { Route } from './logisticsRoute';
import { usePrizes } from './usePrizes';
import { usePlanList } from './usePlans';
import { dates } from './eventPick';
import styles from './logisticsHome.module.css';

interface Overview {
  today: string;
  focus: null | { id: string; slug: string; name: string; starts_on: string; ends_on: string; daysAway: number; stats: { stations: number; stationsBare: number; devicesEmpty: number; requests: number; newRequests: number; prizeLines: number; planned: number; given: number; back: number; held: number } };
  fixes: { sev: 'bad' | 'warn'; text: string; href: string }[]; moreFixes: number;
  staffles: { slug: string; name: string; state: string }[];
  recent: { at: string; who: string | null; text: string }[];
}
const STAFFLE_STATE: Record<string, string> = { draft: 'Not open yet', open: 'Open', closed: 'Closed, waiting for the draw', drawn: 'Drawn' };
const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
const when = (days: number, ended: boolean) => (ended ? `ended ${-days} ${-days === 1 ? 'day' : 'days'} ago` : days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`);

// The Logistics overview: the event to look at first with its numbers and the ways into it, what needs attention (each a link to the exact place), the stock at a glance, the other open events, the Staffles that
// are running and the latest changes. Everything links into the page that can change it.
export default function LogisticsHome({ data, go }: { data: Catalog; go: (r: Route) => void }) {
  const [ov, setOv] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const prizes = usePrizes();
  const list = usePlanList();
  useMemo(() => setLooseSizes(data.lists.prize_size.filter((o) => o.loose).map((o) => o.value)), [data.lists.prize_size]);
  useEffect(() => { void call<Overview>('/api/logistics/overview', 'GET').then((r) => { if (r.ok) setOv(r.data); else setError(r.error); }); }, []);

  const stock = useMemo(() => {
    const rows = prizes.rows ?? [];
    const counted = rows.filter((p) => !isLoose(p));
    return {
      kinds: rows.length, units: counted.reduce((n, p) => n + p.quantity, 0), value: valueOf(counted),
      out: counted.filter((p) => p.quantity <= 0).map((p) => p.name), low: rows.filter((p) => isLoose(p) && (p.stock_level === 'low' || p.stock_level === 'out')).map((p) => p.name),
    };
  }, [prizes.rows]);
  const devs = useMemo(() => {
    const usable = data.devices.filter((d) => !UNUSABLE.includes(d.condition));
    const by = new Map<string, number>();
    for (const d of data.devices) by.set(d.condition, (by.get(d.condition) ?? 0) + 1);
    return { all: data.devices.length, usable: usable.length, untested: by.get('not_tested') ?? 0, gone: data.devices.length - usable.length, by };
  }, [data.devices]);
  const others = (list.plans ?? []).filter((p) => p.status === 'draft' && p.id !== ov?.focus?.id).sort((a, b) => a.starts_on.localeCompare(b.starts_on)).slice(0, 5);

  if (!ov) return <div className={styles.home}>{error ? <p className={styles.err}>{error}</p> : <Loading variant="inline" label="Loading the overview…" />}</div>;
  const f = ov.focus, ended = !!f && f.daysAway < 0 && ov.today > f.ends_on;
  const base = f ? `/portal/logistics/${f.slug}` : '/portal/logistics';
  const left = f ? Math.max(0, f.stats.held) : 0;
  const pct = f && f.stats.planned > 0 ? Math.round(((f.stats.given + f.stats.back) / f.stats.planned) * 100) : 0;

  return (
    <div className={styles.home}>
      <section className={styles.hero} aria-label="The event to look at first">
        {f ? (
          <>
            <div className={styles.heroHead}>
              <span className={styles.kicker}>{ov.today >= f.starts_on && ov.today <= f.ends_on ? 'On today' : ended ? 'Latest event' : 'Next event'}</span>
              <h3>{f.name}</h3>
              <p><CalendarDays size={14} aria-hidden="true" /> {dates({ starts_on: f.starts_on, ends_on: f.ends_on } as never)} · {ov.today >= f.starts_on && ov.today <= f.ends_on ? 'happening now' : when(f.daysAway, ended)}</p>
            </div>
            <ul className={styles.tiles}>
              <li><b>{f.stats.stations}</b><span>teams and stations</span></li>
              <li data-warn={f.stats.devicesEmpty > 0 || undefined}><b>{f.stats.devicesEmpty}</b><span>devices without an ID</span></li>
              <li><b>{f.stats.planned}</b><span>prizes planned</span></li>
              <li><b>{f.stats.given}</b><span>given out</span></li>
              <li><b>{f.stats.back}</b><span>back in storage</span></li>
              <li data-warn={f.stats.newRequests > 0 || undefined}><b>{f.stats.newRequests}</b><span>new requests</span></li>
            </ul>
            {f.stats.planned > 0 && (
              <div className={styles.progress} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Prizes handled">
                <i style={{ width: `${pct}%` }} /><span>{pct}% of the prizes are given out or back ({left} still out)</span>
              </div>
            )}
            <div className={styles.actions}>
              <Link href={`${base}/devices`} className={styles.primary}><Package size={15} aria-hidden="true" /> Devices</Link>
              <Link href={`${base}/prizing`} className={styles.primary}><Gift size={15} aria-hidden="true" /> Prizing</Link>
              <Link href={`${base}/requests`} className={styles.secondary}>Requests{f.stats.newRequests ? ` (${f.stats.newRequests} new)` : ''}</Link>
            </div>
          </>
        ) : (
          <div className={styles.empty}><b>No open events.</b><span>Make one under Events to plan devices and prizes for it.</span><button type="button" className={styles.secondary} onClick={() => go({ tab: 'events', plan: null, page: 'requests' })}>Go To Events</button></div>
        )}
      </section>

      <section className={styles.card} aria-label="Needs attention">
        <h3><AlertTriangle size={16} aria-hidden="true" /> Needs Attention</h3>
        {ov.fixes.length === 0 ? <p className={styles.ok}>Nothing needs attention right now.</p> : (
          <ul className={styles.fixes}>
            {ov.fixes.map((x, i) => <li key={i} data-sev={x.sev}><CircleAlert size={14} aria-hidden="true" /><Link href={x.href}>{x.text}</Link><ArrowRight size={13} aria-hidden="true" /></li>)}
            {ov.moreFixes > 0 && <li className={styles.more}>…and {ov.moreFixes} more</li>}
          </ul>
        )}
      </section>

      <section className={styles.card} aria-label="The stock at a glance">
        <h3><Package size={16} aria-hidden="true" /> Stock At A Glance</h3>
        <div className={styles.twoCols}>
          <div>
            <p className={styles.stat}><b>{stock.kinds}</b> prizes · <b>{stock.units}</b> counted units · <b>{money(stock.value) || '$0'}</b></p>
            {stock.out.length > 0 && <p className={styles.line}>{stock.out.length} {stock.out.length === 1 ? 'prize is' : 'prizes are'} out of stock (all given out or used up).</p>}
            {stock.low.length > 0 && <p className={styles.line} data-sev="warn">Running low (free merch): {stock.low.slice(0, 5).join(', ')}</p>}
            <p className={styles.links}><Link href="/portal/logistics/prizing?view=sheet"><Table2 size={14} aria-hidden="true" /> Prizing Sheet</Link><Link href="/portal/logistics/stock/prizes">In Stock</Link></p>
          </div>
          <div>
            <p className={styles.stat}><b>{devs.all}</b> devices · <b>{devs.usable}</b> usable{devs.untested > 0 ? <> · <b>{devs.untested}</b> not tested</> : null}{devs.gone > 0 ? <> · <b>{devs.gone}</b> dead or gone</> : null}</p>
            <ul className={styles.chips} aria-label="Devices by condition">
              {CONDITIONS.filter((c) => devs.by.get(c.id)).map((c) => <li key={c.id}>{c.label} <b>{devs.by.get(c.id)}</b></li>)}
            </ul>
            <p className={styles.links}><Link href="/portal/logistics/devices?view=sheet"><Table2 size={14} aria-hidden="true" /> Devices Sheet</Link><Link href="/portal/logistics/stock/devices">All Devices</Link></p>
          </div>
        </div>
      </section>

      <section className={styles.card} aria-label="Other open events">
        <h3><CalendarDays size={16} aria-hidden="true" /> Other Open Events</h3>
        {others.length === 0 ? <p className={styles.ok}>No other open events.</p> : (
          <ul className={styles.rows}>
            {others.map((p) => <li key={p.id}><Link href={`/portal/logistics/${p.slug}/requests`}><b>{p.name}</b><span>{dates(p)}</span></Link><span className={styles.sub}>{p.devices} devices{p.empty ? ` (${p.empty} without an ID)` : ''} · {p.prizes ?? 0} prizes</span></li>)}
          </ul>
        )}
        <p className={styles.links}><Link href="/portal/logistics/events">All Events <ArrowRight size={13} aria-hidden="true" /></Link></p>
      </section>

      <section className={styles.card} aria-label="Staffles">
        <h3><Trophy size={16} aria-hidden="true" /> Staffles</h3>
        {ov.staffles.length === 0 ? <p className={styles.ok}>No Staffles running.</p> : (
          <ul className={styles.rows}>{ov.staffles.map((s) => <li key={s.slug}><Link href={`/portal/staffle/${s.slug}`}><b>{s.name}</b></Link><span className={styles.sub}>{STAFFLE_STATE[s.state] ?? s.state}</span></li>)}</ul>
        )}
        <p className={styles.links}><Link href="/portal/staffle">All Staffles <ArrowRight size={13} aria-hidden="true" /></Link></p>
      </section>

      <section className={`${styles.card} ${styles.wide}`} aria-label="Latest changes">
        <h3><History size={16} aria-hidden="true" /> Latest Changes</h3>
        {ov.recent.length === 0 ? <p className={styles.ok}>Nothing yet.</p> : (
          <ul className={styles.recent}>{ov.recent.map((r, i) => <li key={i}><span>{r.text}</span><small>{r.who ? `${r.who} · ` : ''}{ago(r.at)}</small></li>)}</ul>
        )}
      </section>
    </div>
  );
}
