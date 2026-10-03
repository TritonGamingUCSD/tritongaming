'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { CalendarRange, Check, ChevronDown, Moon, Plus, Search, Settings2, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import Notice from '@/components/ui/Notice';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { DateInput, Field, Select } from '@/components/ui/Field';
import { confirmHold } from '@/lib/confirmHold';
import SectionTabs from '@/components/ui/SectionTabs';
import TeamYearsPanel from './TeamYearsPanel';
import styles from './quarters.module.css';

interface Quarter { id: string; term: 'fall' | 'winter' | 'spring'; start_year: number; starts_on: string; ends_on: string; name: string; editable: boolean }
interface Person { id: string; name: string; avatar_url: string | null; role: string; roleLabel: string; title: string | null }
interface Data { canSetup: boolean; today: string; currentId: string | null; quarters: Quarter[]; people: Person[]; marks: { user_id: string; quarter_id: string }[] }

const short = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
const yearLabel = (y: number) => `${y}-${String((y + 1) % 100).padStart(2, '0')}`;

// Quarter status: every officer and lead (rows) against each quarter of an academic year (columns). A green check means active; the moon means they are
// sitting that quarter out (inactive: they keep their title, are not expected at meetings, and have view-only access). Exec and admins mark it; the
// next quarter starts everyone active again.
export default function QuarterStatusContent() {
  const [tab, setTab] = useState<'status' | 'years'>('status');
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}><CalendarRange size={22} aria-hidden="true" /> {tab === 'status' ? 'Quarter status' : 'Team by year'}</h1>
        <p className={styles.sub}>{tab === 'status' ? 'Switch a quarter off for someone who’s sitting it out.' : 'Who was exec, a lead or an officer each year.'}</p>
      </div>
      <SectionTabs<'status' | 'years'> label="Quarter status" value={tab} onChange={setTab} tabs={[{ id: 'status', label: 'Status' }, { id: 'years', label: 'Years' }]} />
      {tab === 'status' ? <StatusPanel /> : <TeamYearsPanel />}
    </div>
  );
}

function StatusPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [year, setYear] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [onlyInactive, setOnlyInactive] = useState(false);
  const [showDates, setShowDates] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkQuarter, setBulkQuarter] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/quarters', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) { setError(j.error || 'Couldn’t load this.'); return; }
      setData(j); setError('');
    } catch { setError('Couldn’t reach the server.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const years = useMemo(() => [...new Set((data?.quarters ?? []).map((x) => x.start_year))].sort((a, b) => b - a), [data]);
  const current = data?.quarters.find((x) => x.id === data.currentId) ?? null;
  const shownYear = year ?? current?.start_year ?? years[0] ?? null;
  const cols = useMemo(() => (data?.quarters ?? []).filter((x) => x.start_year === shownYear).sort((a, b) => a.starts_on.localeCompare(b.starts_on)), [data, shownYear]);
  const markSet = useMemo(() => new Set((data?.marks ?? []).map((m) => `${m.user_id}|${m.quarter_id}`)), [data]);
  const inactiveNow = useMemo(() => new Set((data?.marks ?? []).filter((m) => m.quarter_id === data?.currentId).map((m) => m.user_id)), [data]);

  const people = useMemo(() => (data?.people ?? []).filter((p) => (!onlyInactive || inactiveNow.has(p.id)) && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()))), [data, q, onlyInactive, inactiveNow]);

  async function setStatus(p: Person, quarter: Quarter, inactive: boolean) {
    if (!data) return;
    const key = `${p.id}|${quarter.id}`;
    const before = data.marks;
    // Show it straight away; put it back if the server says no.
    setData({ ...data, marks: inactive ? [...before, { user_id: p.id, quarter_id: quarter.id }] : before.filter((m) => !(m.user_id === p.id && m.quarter_id === quarter.id)) });
    setError('');
    const r = await fetch('/api/quarters/status', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quarter_id: quarter.id, user_ids: [p.id], inactive }) });
    if (!r.ok) { setData((d) => (d ? { ...d, marks: before } : d)); setError((await r.json().catch(() => ({}))).error || 'That didn’t work.'); void key; }
  }

  const editableCols = cols.filter((c) => c.editable);
  const targetId = editableCols.find((c) => c.id === bulkQuarter)?.id ?? editableCols.find((c) => c.id === data?.currentId)?.id ?? editableCols[0]?.id ?? '';
  const allShown = people.length > 0 && people.every((p) => picked.has(p.id));
  function toggle(id: string) { setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }

  async function bulk(inactive: boolean) {
    if (!data || !targetId || picked.size === 0) return;
    setBulkBusy(true); setError('');
    try {
      const r = await fetch('/api/quarters/status', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quarter_id: targetId, user_ids: [...picked], inactive }) });
      if (!r.ok) { setError((await r.json().catch(() => ({}))).error || 'That didn’t work.'); return; }
      setPicked(new Set());
      await load();
    } catch { setError('Couldn’t reach the server.'); } finally { setBulkBusy(false); }
  }

  if (error && !data) return <Notice tone="error">{error}</Notice>;
  if (!data) return <LoadingSpinner size={28} label="Loading…" theme="dark" />;

  return (
    <div className={styles.page}>
      {error && <Notice tone="error">{error}</Notice>}

      {data.canSetup && <QuarterDates data={data} open={showDates} onToggle={() => setShowDates((v) => !v)} onChanged={load} />}

      {data.quarters.length === 0 ? (
        <p className={styles.empty}>{data.canSetup ? 'Add the quarters above to get started.' : 'An admin needs to add the quarter dates first.'}</p>
      ) : (<>
        <div className={styles.bar}>
          {years.length > 1 && (
            <div className={styles.years} role="tablist" aria-label="Academic year">
              {years.map((y) => <button key={y} type="button" role="tab" aria-selected={y === shownYear} className={`${styles.chip} ${y === shownYear ? styles.chipOn : ''}`} onClick={() => setYear(y)}>{yearLabel(y)}</button>)}
            </div>
          )}
          <div className={styles.search}><Search size={14} aria-hidden="true" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a person" aria-label="Find a person" />{q && <button type="button" className={styles.searchClear} onClick={() => setQ('')} aria-label="Clear search"><X size={14} aria-hidden="true" /></button>}</div>
          <button type="button" className={`${styles.chip} ${onlyInactive ? styles.chipOn : ''}`} aria-pressed={onlyInactive} onClick={() => setOnlyInactive((v) => !v)}><Moon size={13} aria-hidden="true" /> Inactive now{inactiveNow.size > 0 ? ` · ${inactiveNow.size}` : ''}</button>
        </div>

        {picked.size > 0 && (
          <div className={styles.bulkBar} role="region" aria-label="Change several people">
            <strong>{picked.size} selected</strong>
            {editableCols.length > 1 && (
              <select className={styles.bulkSelect} value={targetId} onChange={(e) => setBulkQuarter(e.target.value)} aria-label="Quarter to change">
                {editableCols.map((c) => <option key={c.id} value={c.id}>{c.name.split(' ')[0]}</option>)}
              </select>
            )}
            <Button size="sm" loading={bulkBusy} disabled={!targetId} onClick={() => void bulk(true)}><Moon size={14} aria-hidden="true" /> Make inactive</Button>
            <Button size="sm" variant="secondary" loading={bulkBusy} disabled={!targetId} onClick={() => void bulk(false)}><Check size={14} aria-hidden="true" /> Make active</Button>
            <button type="button" className={styles.bulkClear} onClick={() => setPicked(new Set())}>Clear</button>
          </div>
        )}

        <div className={styles.wrap}>
          <div className={styles.matrix} style={{ gridTemplateColumns: `minmax(11rem, 1fr) repeat(${cols.length}, minmax(5.5rem, 7rem))` }}>
            <div className={styles.corner}>
              <label className={styles.pick}><input type="checkbox" checked={allShown} onChange={() => setPicked(allShown ? new Set() : new Set(people.map((p) => p.id)))} aria-label="Select everyone shown" /> <span>All</span></label>
            </div>
            {cols.map((c) => (
              <div key={c.id} className={`${styles.colHead} ${c.id === data.currentId ? styles.now : ''}`}>
                <strong>{c.name.split(' ')[0]}</strong>
                <small>{short(c.starts_on)} to {short(c.ends_on)}</small>
                {c.id === data.currentId && <em>now</em>}
              </div>
            ))}
            {people.map((p) => (
              <div key={p.id} className={styles.row}>
                <div className={styles.person}>
                  <input type="checkbox" className={styles.pickBox} checked={picked.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} />
                  {p.avatar_url ? <Image src={p.avatar_url} alt="" width={32} height={32} unoptimized referrerPolicy="no-referrer" className={styles.avatar} /> : <span className={styles.avatarFallback}>{p.name[0]?.toUpperCase()}</span>}
                  <span className={styles.name}><strong>{p.name}</strong><small><span className={`${styles.role} ${p.role === 'lead' ? styles.roleLead : ''}`}>{p.roleLabel}</span>{p.title ? ` · ${p.title}` : ''}</small></span>
                </div>
                {cols.map((c) => {
                  const off = markSet.has(`${p.id}|${c.id}`);
                  return (
                    <div key={c.id} className={`${styles.cell} ${c.id === data.currentId ? styles.nowCell : ''}`}>
                      <button type="button" disabled={!c.editable} className={`${styles.toggle} ${off ? styles.off : styles.on}`} aria-pressed={!off}
                        aria-label={`${p.name}, ${c.name}: ${off ? 'inactive' : 'active'}${c.editable ? '. Press to change.' : ''}`}
                        title={c.editable ? (off ? 'Inactive: press to make active' : 'Active: press to make inactive') : 'This quarter is over'}
                        onClick={() => setStatus(p, c, !off)}>
                        {off ? <Moon size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
            {people.length === 0 && <p className={`${styles.empty} ${styles.span}`}>No one matches.</p>}
          </div>
        </div>
        <p className={styles.key}><span className={styles.keyItem}><i className={styles.on}><Check size={12} aria-hidden="true" /></i> active</span><span className={styles.keyItem}><i className={styles.off}><Moon size={12} aria-hidden="true" /></i> inactive</span></p>
      </>)}
    </div>
  );
}

// Admin only: the quarter dates. Add a quarter, change its dates, or delete it.
function QuarterDates({ data, open, onToggle, onChanged }: { data: Data; open: boolean; onToggle: () => void; onChanged: () => Promise<void> }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [term, setTerm] = useState('fall');
  const thisYear = new Date().getFullYear();
  const [startYear, setStartYear] = useState(String(thisYear));
  const [starts, setStarts] = useState('');
  const [ends, setEnds] = useState('');

  async function call(path: string, method: string, body?: unknown, key = path) {
    setBusy(key); setError('');
    try {
      const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      if (!r.ok) { setError((await r.json().catch(() => ({}))).error || 'That didn’t work.'); return false; }
      await onChanged(); return true;
    } finally { setBusy(''); }
  }

  return (
    <section className={styles.dates}>
      <button type="button" className={styles.datesHead} onClick={onToggle} aria-expanded={open}><Settings2 size={15} aria-hidden="true" /> Quarter dates <span>{data.quarters.length}</span><ChevronDown size={15} aria-hidden="true" className={open ? styles.flip : ''} /></button>
      {open && (
        <div className={styles.datesBody}>
          {error && <Notice tone="error">{error}</Notice>}
          <ul className={styles.qList}>
            {[...data.quarters].sort((a, b) => b.starts_on.localeCompare(a.starts_on)).map((c) => <QuarterRow key={c.id} c={c} now={c.id === data.currentId} busy={busy === c.id} onSave={(s, e) => call(`/api/quarters/${c.id}`, 'PATCH', { starts_on: s, ends_on: e }, c.id)}
              onDelete={async () => { if (await confirmHold({ title: `Delete ${c.name}?`, message: 'Anyone marked inactive for it is active again.', confirmLabel: 'Hold to delete' })) await call(`/api/quarters/${c.id}`, 'DELETE', undefined, c.id); }} />)}
          </ul>
          <form className={styles.addForm} onSubmit={async (e) => { e.preventDefault(); if (await call('/api/quarters', 'POST', { term, start_year: Number(startYear), starts_on: starts, ends_on: ends }, 'add')) { setStarts(''); setEnds(''); } }}>
            <Field label="Quarter"><Select value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Quarter"><option value="fall">Fall</option><option value="winter">Winter</option><option value="spring">Spring</option></Select></Field>
            <Field label="Academic year starts in"><Select value={startYear} onChange={(e) => setStartYear(e.target.value)} aria-label="Academic year">{[thisYear - 1, thisYear, thisYear + 1].map((y) => <option key={y} value={y}>{yearLabel(y)}</option>)}</Select></Field>
            <Field label="Starts"><DateInput value={starts} onChange={(e) => setStarts(e.target.value)} required /></Field>
            <Field label="Ends"><DateInput value={ends} onChange={(e) => setEnds(e.target.value)} required /></Field>
            <Button type="submit" size="sm" loading={busy === 'add'} disabled={!starts || !ends}><Plus size={14} aria-hidden="true" /> Add</Button>
          </form>
        </div>
      )}
    </section>
  );
}

function QuarterRow({ c, now, busy, onSave, onDelete }: { c: Quarter; now: boolean; busy: boolean; onSave: (s: string, e: string) => Promise<boolean>; onDelete: () => void }) {
  const [s, setS] = useState(c.starts_on);
  const [e, setE] = useState(c.ends_on);
  const changed = s !== c.starts_on || e !== c.ends_on;
  return (
    <li className={styles.qRow}>
      <strong>{c.name}{now && <em> now</em>}</strong>
      <span className={styles.dateBox}><DateInput value={s} onChange={(ev) => setS(ev.target.value)} aria-label={`${c.name} starts`} /></span>
      <span aria-hidden="true">to</span>
      <span className={styles.dateBox}><DateInput value={e} onChange={(ev) => setE(ev.target.value)} aria-label={`${c.name} ends`} /></span>
      {changed && <Button size="sm" loading={busy} onClick={() => void onSave(s, e)}>Save</Button>}
      <IconButton kind="delete" size="sm" label={`Delete ${c.name}`} onClick={onDelete} />
    </li>
  );
}
