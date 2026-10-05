'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { CalendarCheck, GraduationCap, Check, ChevronDown, Moon, Plus, Search, Settings2, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import Notice from '@/components/ui/Notice';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { DateInput, Field, Select } from '@/components/ui/Field';
import { confirmHold } from '@/lib/confirmHold';
import SectionTabs from '@/components/ui/SectionTabs';
import TeamYearsPanel from './TeamYearsPanel';
import styles from './quarters.module.css';
import SectionHeader from '@/components/ui/SectionHeader';

interface Quarter { id: string; term: 'fall' | 'winter' | 'spring'; start_year: number; starts_on: string; ends_on: string; name: string; editable: boolean }
interface Person { id: string; name: string; avatar_url: string | null; role: string; roleLabel: string; title: string | null }
interface Data {
  canSetup: boolean; today: string; currentId: string | null; quarters: Quarter[]; allQuarters: Quarter[]; people: Person[];
  marks: { user_id: string; quarter_id: string; carried: boolean }[]; roster: { quarter_id: string; user_id: string; name: string; tier: string; title: string | null }[];
}
// One line in the Active / Inactive lists.
interface Entry { id: string; name: string; avatar_url: string | null; roleLabel: string; role: string; title: string | null; inactive: boolean; carried: boolean }

const short = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
const yearLabel = (y: number) => `${y}-${String((y + 1) % 100).padStart(2, '0')}`;

// Quarter status: pick a quarter (back to the first one) and see who is Active and who is Inactive in it. Only the current quarter can be changed; a new
// quarter starts as a copy of the last one's inactive list, so exec only edits who is different. Future quarters are never shown or planned.
export default function QuarterStatusContent() {
  const [tab, setTab] = useState<'status' | 'years'>('status');
  return (
    <div className={styles.page}>
      <SectionHeader title="Quarter Status" flush sub={tab === 'status' ? 'Who is sitting out this quarter, and who sat out earlier ones.' : 'Who was exec, a lead or an officer each year.'} />
      <SectionTabs<'status' | 'years'> label="Quarter status" value={tab} onChange={setTab} tabs={[{ id: 'status', label: 'Status', icon: <CalendarCheck size={15} /> }, { id: 'years', label: 'Years', icon: <GraduationCap size={15} /> }]} />
      {tab === 'status' ? <StatusPanel /> : <TeamYearsPanel />}
    </div>
  );
}

function StatusPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [showDates, setShowDates] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/quarters', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) { setError(j.error || 'Couldn’t load this.'); return; }
      setData(j); setError('');
    } catch { setError('Couldn’t reach the server.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Newest first, only quarters that have started.
  const quarters = data?.quarters ?? [];
  const selected = quarters.find((x) => x.id === (selectedId ?? data?.currentId)) ?? quarters[0] ?? null;
  const isCurrent = !!selected && selected.id === data?.currentId;
  const editable = !!selected?.editable;
  const before = selected ? quarters[quarters.findIndex((x) => x.id === selected.id) + 1] ?? null : null;

  const marksIn = useMemo(() => {
    const m = new Map<string, { carried: boolean }>();
    for (const x of data?.marks ?? []) if (x.quarter_id === selected?.id) m.set(x.user_id, { carried: x.carried });
    return m;
  }, [data, selected]);
  const countIn = useMemo(() => {
    const n = new Map<string, number>();
    for (const x of data?.marks ?? []) n.set(x.quarter_id, (n.get(x.quarter_id) ?? 0) + 1);
    return n;
  }, [data]);

  // The current quarter lists everyone who is an officer or lead right now; an earlier quarter lists who held the title back then.
  const entries = useMemo<Entry[]>(() => {
    if (!data || !selected) return [];
    const make = (id: string, name: string, avatar: string | null, role: string, title: string | null): Entry => ({ id, name, avatar_url: avatar, role, roleLabel: role === 'lead' ? 'Lead' : 'Officer', title, inactive: marksIn.has(id), carried: !!marksIn.get(id)?.carried });
    if (isCurrent) return data.people.map((p) => make(p.id, p.name, p.avatar_url, p.role, p.title));
    const byId = new Map(data.people.map((p) => [p.id, p]));
    const seen = new Set<string>();
    const out: Entry[] = [];
    for (const r of data.roster) {
      if (r.quarter_id !== selected.id || seen.has(r.user_id) || r.tier === 'exec') continue;
      seen.add(r.user_id);
      out.push(make(r.user_id, r.name, byId.get(r.user_id)?.avatar_url ?? null, r.tier, r.title));
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [data, selected, isCurrent, marksIn]);

  const shown = entries.filter((e) => !q.trim() || e.name.toLowerCase().includes(q.trim().toLowerCase()));
  const activeList = shown.filter((e) => !e.inactive);
  const inactiveList = shown.filter((e) => e.inactive);
  const pickedActive = activeList.filter((e) => picked.has(e.id)).map((e) => e.id);
  const pickedInactive = inactiveList.filter((e) => picked.has(e.id)).map((e) => e.id);
  const carriedCount = isCurrent ? entries.filter((e) => e.carried).length : 0;
  function toggle(id: string) { setPicked((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }

  async function change(ids: string[], inactive: boolean) {
    if (!data || !selected || ids.length === 0) return;
    const keep = data.marks;
    // Show it straight away; put it back if the server says no.
    setData({ ...data, marks: inactive ? [...keep.filter((m) => !(ids.includes(m.user_id) && m.quarter_id === selected.id)), ...ids.map((user_id) => ({ user_id, quarter_id: selected.id, carried: false }))] : keep.filter((m) => !(ids.includes(m.user_id) && m.quarter_id === selected.id)) });
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/quarters/status', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quarter_id: selected.id, user_ids: ids, inactive }) });
      if (!r.ok) { setData((d) => (d ? { ...d, marks: keep } : d)); setError((await r.json().catch(() => ({}))).error || 'That didn’t work.'); return; }
      setPicked(new Set());
      await load();
    } catch { setData((d) => (d ? { ...d, marks: keep } : d)); setError('Couldn’t reach the server.'); } finally { setBusy(false); }
  }

  if (error && !data) return <Notice tone="error">{error}</Notice>;
  if (!data) return <LoadingSpinner size={28} label="Loading…" theme="dark" />;

  const column = (title: string, list: Entry[], inactive: boolean) => (
    <section className={`${styles.listCol} ${inactive ? styles.listColOff : styles.listColOn}`} aria-label={title}>
      <h3 className={styles.listHead}>{inactive ? <Moon size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />} {title} <span>{list.length}</span></h3>
      {list.length === 0 && <p className={styles.empty}>{inactive ? 'Nobody is sitting this quarter out.' : 'Nobody here.'}</p>}
      <ul className={styles.people}>
        {list.map((e) => (
          <li key={e.id} className={styles.personRow}>
            {editable && <input type="checkbox" className={styles.pickBox} checked={picked.has(e.id)} onChange={() => toggle(e.id)} aria-label={`Select ${e.name}`} />}
            {e.avatar_url ? <Image src={e.avatar_url} alt="" width={32} height={32} unoptimized referrerPolicy="no-referrer" className={styles.avatar} /> : <span className={styles.avatarFallback}>{e.name[0]?.toUpperCase()}</span>}
            <span className={styles.name}><strong>{e.name}{e.carried && <em className={styles.carriedTag} title={`Copied from ${before?.name ?? 'the last quarter'}`}>carried over</em>}</strong><small><span className={`${styles.role} ${e.role === 'lead' ? styles.roleLead : ''}`}>{e.roleLabel}</span>{e.title ? ` · ${e.title}` : ''}</small></span>
            {editable && <Button size="sm" variant="secondary" disabled={busy} onClick={() => void change([e.id], !inactive)}>{inactive ? <><Check size={13} aria-hidden="true" /> Make active</> : <><Moon size={13} aria-hidden="true" /> Make inactive</>}</Button>}
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <div className={styles.page}>
      {error && <Notice tone="error">{error}</Notice>}

      {data.canSetup && <QuarterDates data={data} open={showDates} onToggle={() => setShowDates((v) => !v)} onChanged={load} />}

      {quarters.length === 0 ? (
        <p className={styles.empty}>{data.canSetup ? 'Add the quarter dates above. A quarter shows here once it starts.' : 'No quarter has started yet.'}</p>
      ) : selected && (<>
        <div className={styles.explain} role="note">
          <Moon size={18} aria-hidden="true" />
          <div>
            <strong>What “inactive” does</strong>
            <p>An inactive officer or lead keeps their title but is sitting the quarter out: they are not expected at meetings (unless someone adds them by name), get no strikes, and have view-only access. Each quarter starts as a copy of the last one, so you only change who is different. Only the current quarter can be changed.</p>
          </div>
        </div>

        <div className={styles.qChips} role="tablist" aria-label="Quarter">
          {quarters.map((x) => {
            const n = countIn.get(x.id) ?? 0;
            return (
              <button key={x.id} type="button" role="tab" aria-selected={x.id === selected.id} className={`${styles.qChip} ${x.id === selected.id ? styles.qChipOn : ''}`} onClick={() => { setSelectedId(x.id); setPicked(new Set()); }}>
                <strong>{x.name}{x.id === data.currentId && <em>now</em>}</strong>
                <small>{n === 0 ? 'no one inactive' : `${n} inactive`}</small>
              </button>
            );
          })}
        </div>

        <p className={styles.range}>{selected.name}: {short(selected.starts_on)} to {short(selected.ends_on)}{!isCurrent && ' · this quarter is over, so it is a record and can’t be changed'}</p>

        {carriedCount > 0 && (
          <Notice tone="info">{carriedCount} {carriedCount === 1 ? 'person was' : 'people were'} copied over from {before?.name ?? 'last quarter'} when this quarter started. Check them, and make anyone who is back active again.</Notice>
        )}

        <div className={styles.bar}>
          <div className={styles.search}><Search size={14} aria-hidden="true" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a person" aria-label="Find a person" />{q && <button type="button" className={styles.searchClear} onClick={() => setQ('')} aria-label="Clear search"><X size={14} aria-hidden="true" /></button>}</div>
        </div>

        {editable && picked.size > 0 && (
          <div className={styles.bulkBar} role="region" aria-label="Change several people">
            <strong>{picked.size} selected</strong>
            {pickedActive.length > 0 && <Button size="sm" loading={busy} onClick={() => void change(pickedActive, true)}><Moon size={14} aria-hidden="true" /> Make {pickedActive.length} inactive</Button>}
            {pickedInactive.length > 0 && <Button size="sm" variant="secondary" loading={busy} onClick={() => void change(pickedInactive, false)}><Check size={14} aria-hidden="true" /> Make {pickedInactive.length} active</Button>}
            <button type="button" className={styles.bulkClear} onClick={() => setPicked(new Set())}>Clear</button>
          </div>
        )}

        <div className={styles.lists}>
          {column('Active', activeList, false)}
          {column('Inactive', inactiveList, true)}
        </div>
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
      <button type="button" className={styles.datesHead} onClick={onToggle} aria-expanded={open}><Settings2 size={15} aria-hidden="true" /> Quarter dates <span>{data.allQuarters.length}</span><ChevronDown size={15} aria-hidden="true" className={open ? styles.flip : ''} /></button>
      {open && (
        <div className={styles.datesBody}>
          {error && <Notice tone="error">{error}</Notice>}
          <ul className={styles.qList}>
            {[...data.allQuarters].sort((a, b) => b.starts_on.localeCompare(a.starts_on)).map((c) => <QuarterRow key={c.id} c={c} now={c.id === data.currentId} busy={busy === c.id} onSave={(s, e) => call(`/api/quarters/${c.id}`, 'PATCH', { starts_on: s, ends_on: e }, c.id)}
              onDelete={async () => { if (await confirmHold({ title: `Delete ${c.name}?`, message: 'Anyone marked inactive for it is active again, and its record is gone.', confirmLabel: 'Hold to delete' })) await call(`/api/quarters/${c.id}`, 'DELETE', undefined, c.id); }} />)}
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
