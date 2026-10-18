'use client';

import Loading from '@/components/Loading/Loading';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { CalendarX, Users, ArrowLeft, Check, Lock, Moon, RotateCcw, Plus, Search, ShieldAlert, Ticket, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import Notice from '@/components/ui/Notice';
import SectionTabs from '@/components/ui/SectionTabs';
import { DateInput, Field, Input, Select } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import { STRIKES_AT_LIMIT, countLabel } from '@/lib/members/strikeLabels';
import styles from './tracker.module.css';
import SectionHeader from '@/components/ui/SectionHeader';

interface Person { id: string; name: string; avatar_url: string | null; role: string; active: number; vouchers: number; atLimit: boolean; inactive: boolean }
interface Strike { id: string; mark: string | null; status: 'published' | 'removed'; category: string; reason: string; incident_date: string; meeting_id: string | null; created_at: string; published_at: string | null; removed_at: string | null; removed_how: 'taken' | 'voucher' | 'reset' | null; removed_note: string | null; created_by: string | null; published_by: string | null; removed_by: string | null; }
interface Voucher { id: string; reason: string | null; created_at: string; used_at: string | null; used_on_strike_id: string | null; given_by: string | null; removed_at: string | null; removed_by: string | null; removed_reason: string | null }
interface Event { id: string; kind: string; label: string | null; reason: string | null; by: string | null; at: string }
interface PastMiss { user_id: string; name: string; meeting_id: string; title: string; date: string; outcome: 'strike' | 'dismissed'; reason: string | null }
interface Suggestion { user_id: string; name: string; meeting_id: string; title: string; date: string }
type Tab = 'people' | 'missed';
type Filter = 'all' | 'strikes' | 'limit';
const EVENT_LABEL: Record<string, string> = { strike_added: 'Strike added', strike_removed: 'Strike taken off', strike_reinstated: 'Strike put back', voucher_given: 'Voucher given', voucher_used: 'Voucher used', voucher_removed: 'Voucher removed', strikes_reset: 'Strikes reset' };

const CATEGORIES: [string, string][] = [['meeting', 'Missed meeting'], ['event_shift', 'Missed event shift'], ['deadline', 'Missed deadline or task'], ['conduct', 'Conduct'], ['other', 'Other']];
const catLabel = (id: string) => CATEGORIES.find((c) => c[0] === id)?.[1] ?? 'Other';
const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });

// The strike tracker. Exec, HR (the "manage strikes" permission) and admins see everyone and add strikes directly. Every action takes a reason the person can read, and nobody changes their own record.
export default function StrikesSectionContent() {
  return <Tracker />;
}

function Header() {
  return <SectionHeader title="Strikes" flush sub={<><Lock size={13} aria-hidden="true" className={styles.lockIcon} /> Private to the person, exec and HR. The first mark is a warning; 3 strikes after it is the limit. Every action has a reason the person can read, never who did it.</>} />;
}

function Tracker() {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [limit, setLimit] = useState(3);
  const [me, setMe] = useState('');
  const [missed, setMissed] = useState(0);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('people');
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/strikes', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) { setError(j.error || 'Couldn’t load strikes.'); return; }
      setPeople(j.people); setLimit(j.limit); setMe(j.me); setMissed(j.suggestionCount); setError('');
    } catch { setError('Couldn’t reach the server.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => (people ?? []).filter((p) => {
    if (filter === 'strikes' && p.active === 0) return false;
    if (filter === 'limit' && !p.atLimit) return false;
    return !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase());
  }).sort((a, b) => Number(b.atLimit) - Number(a.atLimit) || b.active - a.active || a.name.localeCompare(b.name)), [people, filter, q]);

  if (error && !people) return <Notice tone="error">{error}</Notice>;
  if (!people) return <Loading label="Loading strikes…" />;
  const sel = people.find((p) => p.id === selected) ?? null;

  return (
    <div className={styles.page}>
      <Header />
      <SectionTabs<Tab> label="Strikes" value={tab} onChange={(t) => { setTab(t); setSelected(null); }} tabs={[
        { id: 'people', label: 'People', icon: <Users size={15} />, count: people.length },
        { id: 'missed', label: 'Missed meetings', icon: <CalendarX size={15} />, badge: missed },
      ]} />
      {error && <Notice tone="error">{error}</Notice>}

      {tab === 'people' && (
        <div className={`${styles.split} ${sel ? styles.hasSel : ''}`}>
          <div className={styles.listCol}>
            <div className={styles.bar}>
              <div className={styles.search}><Search size={14} aria-hidden="true" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a person" aria-label="Find a person" />{q && <button type="button" className={styles.searchClear} onClick={() => setQ('')} aria-label="Clear search"><X size={14} aria-hidden="true" /></button>}</div>
              <div className={styles.filters} role="group" aria-label="Show">
                {([['all', 'Everyone'], ['strikes', 'Has strikes'], ['limit', `At ${STRIKES_AT_LIMIT} strikes`]] as [Filter, string][]).map(([id, label]) => <button key={id} type="button" className={`${styles.chip} ${filter === id ? styles.chipOn : ''}`} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}
              </div>
            </div>
            <ul className={styles.people}>
              {shown.map((p) => (
                <li key={p.id}>
                  <button type="button" className={`${styles.person} ${selected === p.id ? styles.personOn : ''}`} onClick={() => setSelected(p.id)}>
                    <Avatar name={p.name} src={p.avatar_url} />
                    <span className={styles.personName}><strong>{p.name}</strong><small>{p.role}</small></span>
                    {p.inactive && <span className={styles.idleTag} title="Inactive this quarter"><Moon size={11} aria-hidden="true" /> Inactive</span>}
                    {p.vouchers > 0 && <span className={styles.voucherTag} title="Unused vouchers"><Ticket size={11} aria-hidden="true" /> {p.vouchers}</span>}
                    <Pips active={p.active} limit={limit} />
                  </button>
                </li>
              ))}
              {shown.length === 0 && <li className={styles.muted}>No one matches.</li>}
            </ul>
          </div>
          <div className={styles.detailCol}>
            {sel ? <PersonDetail key={sel.id} person={sel} limit={limit} me={me} onBack={() => setSelected(null)} onChanged={load} />
              : <div className={styles.placeholder}><ShieldAlert size={26} strokeWidth={1.5} aria-hidden="true" /><p>Pick a person to see their record.</p></div>}
          </div>
        </div>
      )}
      {tab === 'people' && !sel && <ResetBar onDone={load} />}
      {tab === 'missed' && <Missed me={me} onChanged={load} />}
    </div>
  );
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  return src ? <Image src={src} alt="" width={36} height={36} unoptimized referrerPolicy="no-referrer" className={styles.avatar} /> : <span className={styles.avatarFallback}>{name[0]?.toUpperCase() ?? '?'}</span>;
}
// The first mark is a warning, not a strike: a diamond set apart from the three round strikes, with the plain count written beside it.
function Pips({ active, limit }: { active: number; limit: number }) {
  const bad = active >= limit;
  return (
    <span className={`${styles.pipsWrap} ${bad ? styles.pipsBad : active ? styles.pipsWarn : ''}`} role="img" aria-label={countLabel(active)} title="A warning first, then 3 strikes">
      <span className={styles.pips}>
        <i className={`${styles.warnPip} ${active >= 1 ? styles.on : ''}`} />
        {Array.from({ length: limit - 1 }, (_, i) => <i key={i} className={i + 1 < active ? styles.on : ''} />)}
      </span>
      <small className={styles.pipLabel}>{countLabel(active)}</small>
    </span>
  );
}
function CategorySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <Select className={styles.select} value={value} onChange={(e) => onChange(e.target.value)} aria-label="What kind of strike">{CATEGORIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</Select>;
}

// One person's record: strikes, vouchers and history, with everything HR can do.
function PersonDetail({ person, limit, me, onBack, onChanged }: { person: Person; limit: number; me: string; onBack: () => void; onChanged: () => Promise<void> }) {
  const [data, setData] = useState<{ strikes: Strike[]; vouchers: Voucher[]; events: Event[] } | null>(null);
  const [adding, setAdding] = useState(false);
  const [giving, setGiving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const isMe = person.id === me;

  const reload = useCallback(async () => {
    const r = await fetch(`/api/strikes/people/${person.id}`, { cache: 'no-store' });
    if (r.ok) setData(await r.json());
    await onChanged();
  }, [person.id, onChanged]);
  useEffect(() => { void (async () => { const r = await fetch(`/api/strikes/people/${person.id}`, { cache: 'no-store' }); if (r.ok) setData(await r.json()); })(); }, [person.id]);

  async function act(path: string, method: string, body?: unknown, key = path): Promise<Record<string, unknown> | null> {
    setBusy(key); setError(''); setNote('');
    try {
      const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error || 'That didn’t work.'); return null; }
      await reload(); return j;
    } finally { setBusy(''); }
  }
  const strikes = data?.strikes ?? [];
  const vouchers = data?.vouchers ?? [];
  const events = data?.events ?? [];
  const unused = vouchers.filter((v) => !v.used_at && !v.removed_at);
  return (
    <section className={styles.detail} aria-label={`${person.name}'s record`}>
      <button type="button" className={styles.back} onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> All people</button>
      <div className={styles.dHead}>
        <Avatar name={person.name} src={person.avatar_url} />
        <div className={styles.dName}><strong>{person.name}</strong><span>{person.role}</span></div>
        <Pips active={person.active} limit={limit} />
      </div>
      {person.atLimit && <p className={styles.limit}>At {STRIKES_AT_LIMIT} strikes. They’ve been told the HR team will contact them.</p>}
      {isMe && <Notice tone="warning">This is your own record. You can look, but someone else has to change it.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {note && <Notice tone="success">{note}</Notice>}

      {person.inactive && <p className={styles.idleNote}><Moon size={14} aria-hidden="true" /> Inactive this quarter: no new strikes, and their record and vouchers stay as they are.</p>}
      {!isMe && (
        <div className={styles.actionsBar}>
          {!person.inactive && <Button size="sm" variant="secondary" onClick={() => { setAdding((v) => !v); setGiving(false); }} aria-expanded={adding}><Plus size={14} aria-hidden="true" /> Add a strike</Button>}
          <Button size="sm" variant="secondary" onClick={() => { setGiving((v) => !v); setAdding(false); }} aria-expanded={giving}><Ticket size={14} aria-hidden="true" /> Give a voucher</Button>
          {person.active > 0 && <Button size="sm" variant="ghost" onClick={() => { setResetting((v) => !v); setAdding(false); setGiving(false); }} aria-expanded={resetting}><RotateCcw size={14} aria-hidden="true" /> Reset</Button>}
        </div>
      )}
      {adding && <StrikeForm submit="Add strike" hint="It goes on their record right away and they get a notification. If they have a voucher, it is used on this strike." onCancel={() => setAdding(false)} busy={busy === 'new'} onSave={async (reason, date, category) => { const j = await act('/api/strikes', 'POST', { user_id: person.id, reason, incident_date: date, category }, 'new'); if (j) { setAdding(false); if (j.voucherUsed) setNote('Added. Their voucher was used on it, so it doesn’t count.'); } }} />}
      {resetting && <ReasonForm label={`Why you’re resetting ${person.name}’s strikes (they will see this)`} placeholder="e.g. Fall quarter reset" submit="Reset their strikes" busy={busy === 'reset'} onCancel={() => setResetting(false)} onSave={async (reason) => { if (!(await confirmHold({ title: `Reset ${person.name}’s strikes?`, message: 'This permanently deletes their strikes, warning and history. Nobody can open it afterwards, not even an admin. They only see your reason. Their unused vouchers are kept.', confirmLabel: 'Hold to reset' }))) return; if (await act('/api/strikes/reset', 'POST', { user_id: person.id, reason }, 'reset')) { setResetting(false); setNote('Their record was deleted for good.'); } }} />}
      {giving && <VoucherForm hasStrikes={person.active > 0} busy={busy === 'voucher'} onCancel={() => setGiving(false)} onSave={async (reason) => { const j = await act('/api/strikes/vouchers', 'POST', { user_id: person.id, reason }, 'voucher'); if (j) { setGiving(false); if (j.usedOnStrike) setNote('Voucher given. It removed their oldest strike right away.'); } }} />}

      <h3 className={styles.h3}>Strikes</h3>
      {data === null ? <Loading variant="inline" label="Loading…" /> : strikes.length === 0 ? <p className={styles.muted}>No strikes.</p> : (
        <ul className={styles.strikes}>
          {strikes.map((s) => <StrikeRow key={s.id} s={s} readOnly={isMe} unusedVouchers={unused} busy={busy === s.id} onAct={async (body) => !!(await act(`/api/strikes/${s.id}`, 'PATCH', body, s.id))}  />)}
        </ul>
      )}

      <h3 className={styles.h3}>Vouchers</h3>
      {data === null ? null : vouchers.length === 0 ? <p className={styles.muted}>No vouchers.</p> : (
        <ul className={styles.vouchers}>
          {vouchers.map((v) => <VoucherRow key={v.id} v={v} readOnly={isMe} busy={busy === v.id} onRemove={(reason) => act(`/api/strikes/vouchers/${v.id}`, 'DELETE', { reason }, v.id)} />)}
        </ul>
      )}

      <h3 className={styles.h3}>History</h3>
      {data === null ? null : events.length === 0 ? <p className={styles.muted}>Nothing yet.</p> : (
        <ul className={styles.doneList}>
          {events.map((e) => <li key={e.id}><b>{e.kind === 'strike_added' && e.label ? `${e.label} added` : EVENT_LABEL[e.kind] ?? e.kind}</b> · {day(e.at.slice(0, 10))}{e.by ? ` · by ${e.by}` : ''}{e.reason ? ` · “${e.reason}”` : ''}</li>)}
        </ul>
      )}
    </section>
  );
}

function VoucherRow({ v, readOnly, busy, onRemove }: { v: Voucher; readOnly: boolean; busy: boolean; onRemove: (reason: string) => Promise<Record<string, unknown> | null> }) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const off = !!v.used_at || !!v.removed_at;
  return (
    <li className={off ? styles.vUsed : ''}>
      <Ticket size={14} aria-hidden="true" />
      <span>
        <b>{v.removed_at ? 'Removed' : v.used_at ? 'Used' : 'Unused'}</b> · given {day(v.created_at.slice(0, 10))}{v.given_by ? ` by ${v.given_by}` : ''}{v.reason ? ` · ${v.reason}` : ''}
        {v.used_at ? ` · used ${day(v.used_at.slice(0, 10))}` : ''}{v.removed_at ? ` · removed ${day(v.removed_at.slice(0, 10))}${v.removed_by ? ` by ${v.removed_by}` : ''}${v.removed_reason ? ` · “${v.removed_reason}”` : ''}` : ''}
      </span>
      {!off && !readOnly && !asking && <IconButton kind="remove" size="sm" label="Remove this voucher" onClick={() => setAsking(true)} />}
      {asking && (
        <form className={styles.inline} onSubmit={async (e) => { e.preventDefault(); if (reason.trim() && await onRemove(reason.trim())) setAsking(false); }}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Why it’s being removed (they will see this)" aria-label="Why the voucher is being removed" required autoFocus />
          <Button type="submit" size="sm" loading={busy} disabled={!reason.trim()}>Remove</Button><Button type="button" size="sm" variant="ghost" onClick={() => setAsking(false)}>Cancel</Button>
        </form>
      )}
    </li>
  );
}

function StrikeRow({ s, readOnly, unusedVouchers, busy, onAct }: { s: Strike; readOnly: boolean; unusedVouchers: Voucher[]; busy: boolean; onAct: (b: Record<string, unknown>) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<null | 'remove' | 'voucher' | 'reinstate'>(null);
  const [note, setNote] = useState('');
  const [voucherId, setVoucherId] = useState(unusedVouchers[0]?.id ?? '');
  const chip = s.status === 'published' ? styles.stOn : styles.stOff;
  return (
    <li className={`${styles.strike} ${s.status === 'removed' ? styles.strikeOff : ''}`}>
      <div className={styles.strikeTop}>
        <span className={`${styles.status} ${chip}`}>{s.status === 'published' ? 'On their record' : s.removed_how === 'voucher' ? 'Removed with voucher' : s.removed_how === 'reset' ? 'Cleared by a reset' : 'Taken off'}</span>
        <span className={styles.cat}>{catLabel(s.category)}</span>
        {s.mark && <span className={styles.cat}><b>{s.mark}</b></span>}
        <time>{day(s.incident_date)}</time>
      </div>
      {editing ? (
        <StrikeForm initialReason={s.reason} initialDate={s.incident_date} initialCategory={s.category} submit="Save" busy={busy} onCancel={() => setEditing(false)} onSave={async (reason, date, category) => { if (await onAct({ action: 'edit', reason, incident_date: date, category })) setEditing(false); }} />
      ) : <p className={styles.reason}>{s.reason}</p>}
      <p className={styles.meta}>
        {s.created_by ? `Added by ${s.created_by}` : ''}{s.removed_by ? ` · removed by ${s.removed_by}` : ''}{s.removed_note ? ` · “${s.removed_note}”` : ''}
      </p>
      {!readOnly && !editing && (
        <div className={styles.rowActions}>
          {s.status === 'published' && <Button size="sm" variant="secondary" onClick={() => setMode(mode === 'remove' ? null : 'remove')}>Take away</Button>}
          {s.status === 'published' && unusedVouchers.length > 0 && <Button size="sm" variant="secondary" onClick={() => setMode(mode === 'voucher' ? null : 'voucher')}><Ticket size={14} aria-hidden="true" /> Use a voucher now</Button>}
          {s.status === 'removed' && <Button size="sm" variant="secondary" onClick={() => setMode(mode === 'reinstate' ? null : 'reinstate')}>Reinstate</Button>}
          {s.status !== 'removed' && <IconButton kind="edit" size="sm" label="Edit this strike" onClick={() => setEditing(true)} />}
        </div>
      )}
      {mode === 'remove' && (
        <form className={styles.inline} onSubmit={async (e) => { e.preventDefault(); if (await note.trim() && await onAct({ action: 'remove', reason: note.trim() })) { setMode(null); setNote(''); } }}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Why it’s being taken off (they will see this)" aria-label="Why it is being taken off" required autoFocus />
          <Button type="submit" size="sm" loading={busy} disabled={!note.trim()}>Take away</Button><Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
        </form>
      )}
      {mode === 'voucher' && (
        <form className={styles.inline} onSubmit={async (e) => { e.preventDefault(); if (voucherId && note.trim() && await onAct({ action: 'apply_voucher', voucher_id: voucherId, reason: note.trim() })) { setMode(null); setNote(''); } }}>
          <Select className={styles.select} value={voucherId} onChange={(e) => setVoucherId(e.target.value)} aria-label="Which voucher">
            {unusedVouchers.map((v) => <option key={v.id} value={v.id}>Voucher from {day(v.created_at.slice(0, 10))}{v.reason ? ` · ${v.reason}` : ''}</option>)}
          </Select>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Why (they will see this)" aria-label="Why the voucher is being used" required />
          <Button type="submit" size="sm" loading={busy} disabled={!note.trim()}>Remove with voucher</Button><Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
        </form>
      )}
      {mode === 'reinstate' && (
        <form className={styles.inline} onSubmit={async (e) => { e.preventDefault(); if (note.trim() && await onAct({ action: 'reinstate', reason: note.trim() })) { setMode(null); setNote(''); } }}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Why it’s being put back (they will see this)" aria-label="Why it is being put back" required autoFocus />
          <Button type="submit" size="sm" loading={busy} disabled={!note.trim()}>Reinstate</Button><Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
        </form>
      )}
    </li>
  );
}

function StrikeForm({ initialReason = '', initialDate, initialCategory = 'other', submit, hint, busy, onSave, onCancel }: { initialReason?: string; initialDate?: string; initialCategory?: string; submit: string; hint?: string; busy: boolean; onSave: (reason: string, date: string, category: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState(initialReason);
  const [date, setDate] = useState(initialDate ?? todayKey());
  const [category, setCategory] = useState(initialCategory);
  return (
    <form className={styles.form} onSubmit={(e) => { e.preventDefault(); if (reason.trim()) onSave(reason.trim(), date, category); }}>
      <div className={styles.twoCol}>
        <Field label="What kind"><CategorySelect value={category} onChange={setCategory} /></Field>
        <Field label="Date it happened"><DateInput value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
      </div>
      <Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Missed the Gen Meeting without an excuse" required autoFocus /></Field>
      {hint && <p className={styles.hint}>{hint}</p>}
      <div className={styles.formActions}><Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button><Button type="submit" size="sm" loading={busy} disabled={!reason.trim()}>{submit}</Button></div>
    </form>
  );
}
function ReasonForm({ label, placeholder, submit, busy, onSave, onCancel }: { label: string; placeholder: string; submit: string; busy: boolean; onSave: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  return (
    <form className={styles.form} onSubmit={(e) => { e.preventDefault(); if (reason.trim()) onSave(reason.trim()); }}>
      <Field label={label}><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder={placeholder} required autoFocus /></Field>
      <div className={styles.formActions}><Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button><Button type="submit" size="sm" loading={busy} disabled={!reason.trim()}>{submit}</Button></div>
    </form>
  );
}

// Reset everyone's strikes (usually once a quarter). The old record is deleted for good; unused vouchers are kept.
function ResetBar({ onDone }: { onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  async function go(reason: string) {
    if (!(await confirmHold({ title: 'Reset everyone’s strikes?', message: 'This permanently deletes everyone’s strikes, warnings and history for everyone you can change. Nobody can open it afterwards, not even an admin. Each person only sees your reason. Unused vouchers are kept.', confirmLabel: 'Hold to reset' }))) return;
    setBusy(true); setError(''); setNote('');
    const r = await fetch('/api/strikes/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(j.error || 'That didn’t work.'); return; }
    setOpen(false); setNote(`Reset: ${j.strikes} strike${j.strikes === 1 ? '' : 's'} deleted for good. Your own record isn’t touched: someone else has to clear it.`); await onDone();
  }
  return (
    <div>
      {error && <Notice tone="error">{error}</Notice>}
      {note && <Notice tone="success">{note}</Notice>}
      {open ? <ReasonForm label="Why you’re resetting (everyone will see this)" placeholder="e.g. Fall quarter reset" submit="Reset everyone’s strikes" busy={busy} onCancel={() => setOpen(false)} onSave={go} />
        : <Button size="sm" variant="ghost" onClick={() => { setOpen(true); setNote(''); }}><RotateCcw size={14} aria-hidden="true" /> Reset everyone’s strikes</Button>}
    </div>
  );
}

function VoucherForm({ hasStrikes, busy, onSave, onCancel }: { hasStrikes: boolean; busy: boolean; onSave: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  return (
    <form className={styles.form} onSubmit={(e) => { e.preventDefault(); if (reason.trim()) onSave(reason.trim()); }}>
      <Field label="Why they earned it (they will see this)"><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="e.g. Ran the tabling shift" required autoFocus /></Field>
      <p className={styles.hint}>{hasStrikes ? 'They already have a strike, so this voucher removes their oldest one right away.' : 'They have no strikes, so it is kept and used automatically the next time one is published.'}</p>
      <div className={styles.formActions}><Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button><Button type="submit" size="sm" loading={busy} disabled={!reason.trim()}>Give voucher</Button></div>
    </form>
  );
}

// People who missed a meeting they were meant for (after the excuse window). Each person gets three clear choices; strike and dismiss
// can also be done for everyone at one meeting at once. Strike asks to confirm, excuse needs a reason, dismiss takes an optional one.
type Mode = 'add' | 'excuse' | 'dismiss';
type Panel = { id: string; mode: Mode; items: { user_id: string; meeting_id: string }[]; who: string };
const CHOICES: { mode: Mode; title: string; text: string }[] = [
  { mode: 'add', title: 'Add Strike', text: 'They missed it and it counts against them.' },
  { mode: 'excuse', title: 'Excuse', text: 'They had a good reason. Marked excused on the meeting, no strike.' },
  { mode: 'dismiss', title: 'Dismiss', text: 'Not a real miss (say, a wrong list). No strike, nothing marked.' },
];
function Missed({ me, onChanged }: { me: string; onChanged: () => Promise<void> }) {
  const [list, setList] = useState<Suggestion[] | null>(null);
  const [past, setPast] = useState<PastMiss[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [panel, setPanel] = useState<Panel | null>(null);
  const [reason, setReason] = useState('');
  const [showPast, setShowPast] = useState(false);
  const key = (s: { user_id: string; meeting_id: string }) => `${s.user_id}|${s.meeting_id}`;
  const load = useCallback(async () => { const r = await fetch('/api/strikes/suggestions', { cache: 'no-store' }); if (r.ok) { const j = await r.json(); setList(j.suggestions); setPast(j.past ?? []); } else setError('Couldn’t load this.'); }, []);
  useEffect(() => { void load(); }, [load]);
  const groups = useMemo(() => {
    const m = new Map<string, { title: string; date: string; people: Suggestion[] }>();
    for (const s of list ?? []) { const g = m.get(s.meeting_id) ?? { title: s.title, date: s.date, people: [] }; g.people.push(s); m.set(s.meeting_id, g); }
    return [...m.entries()];
  }, [list]);
  const open = (id: string, mode: Mode, items: Panel['items'], who: string) => { setPanel(panel && panel.id === id && panel.mode === mode ? null : { id, mode, items, who }); setReason(''); };
  async function go(action: Mode | 'undo', items: { user_id: string; meeting_id: string }[], why = '') {
    if (!items.length) return;
    setBusy(true); setError(''); setDone('');
    const r = await fetch('/api/strikes/suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, items, reason: why }) });
    setBusy(false);
    if (!r.ok) { setError((await r.json().catch(() => ({}))).error || 'That didn’t work.'); await load(); return; }
    const n = items.length;
    setPanel(null); setReason('');
    setDone(action === 'add' ? `${n} strike${n === 1 ? '' : 's'} added.` : action === 'excuse' ? 'Excused. They’re off this list and marked excused on the meeting.' : action === 'dismiss' ? `${n} dismissed. ${n === 1 ? 'It moved' : 'They moved'} to Past Missed Meetings.` : `${n} put back on the list.`);
    await load(); await onChanged();
  }
  // The confirm step under a row (or under a meeting's header, for everyone there).
  const form = (pn: Panel) => {
    const many = pn.items.length > 1;
    if (pn.mode === 'add') return (
      <div className={styles.inline}>
        <span className={styles.panelText}>Add {many ? `${pn.items.length} strikes` : `a strike for ${pn.who}`}?</span>
        <Button size="sm" loading={busy} onClick={() => go('add', pn.items)}>Add {many ? 'Strikes' : 'Strike'}</Button>
        <Button size="sm" variant="ghost" onClick={() => setPanel(null)}>Cancel</Button>
      </div>
    );
    const excuse = pn.mode === 'excuse';
    return (
      <form className={styles.inline} onSubmit={(e) => { e.preventDefault(); if (!excuse || reason.trim()) void go(pn.mode, pn.items, reason.trim()); }}>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={140} required={excuse} autoFocus
          placeholder={excuse ? `Why ${many ? 'they are' : `${pn.who.split(' ')[0]} is`} excused, e.g. marked absent by mistake` : 'Why (optional)'} aria-label={excuse ? 'Why they are excused' : 'Why it is dismissed'} />
        <Button type="submit" size="sm" loading={busy} disabled={excuse && !reason.trim()}>{excuse ? 'Excuse' : 'Dismiss'}{many ? ` ${pn.items.length}` : ''}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setPanel(null)}>Cancel</Button>
      </form>
    );
  };
  if (!list) return <Loading label="Loading…" />;
  return (
    <div className={styles.review}>
      <ul className={styles.choiceKey}>
        {CHOICES.map((c) => <li key={c.mode}><b>{c.title}</b><span>{c.text}</span></li>)}
      </ul>
      {error && <Notice tone="error">{error}</Notice>}
      {done && <Notice tone="success">{done}</Notice>}
      {groups.length === 0 ? <div className={styles.placeholder}><Check size={24} aria-hidden="true" /><p>No missed meetings to look at. A miss shows up here as soon as its meeting ends.</p></div> : groups.map(([mid, g]) => {
        const others = g.people.filter((s) => s.user_id !== me).map((s) => ({ user_id: s.user_id, meeting_id: s.meeting_id }));
        const gid = `meeting:${mid}`;
        return (
          <section key={mid} className={styles.meetingCard}>
            <div className={styles.meetingHead}>
              <h3 className={styles.meetingTitle}>{g.title} <span>{day(g.date)} · {g.people.length} missed</span></h3>
              {others.length > 1 && (
                <span className={styles.bulkBtns}>
                  <Button size="sm" variant="secondary" onClick={() => open(gid, 'add', others, 'everyone')} aria-expanded={panel?.id === gid && panel.mode === 'add'}>Strike All ({others.length})</Button>
                  <Button size="sm" variant="ghost" onClick={() => open(gid, 'dismiss', others, 'everyone')} aria-expanded={panel?.id === gid && panel.mode === 'dismiss'}>Dismiss All</Button>
                </span>
              )}
            </div>
            {panel?.id === gid && <div className={styles.panel}>{form(panel)}</div>}
            <ul className={styles.missList}>
              {g.people.map((s) => {
                const id = key(s), it = [{ user_id: s.user_id, meeting_id: s.meeting_id }];
                const on = (m: Mode) => panel?.id === id && panel.mode === m;
                return (
                  <li key={id} className={styles.missItem}>
                    <div className={styles.missRow}>
                      <span className={styles.missName}>{s.name}</span>
                      {s.user_id === me ? <em>Your own: someone else decides.</em> : (
                        <span className={styles.rowBtns}>
                          <Button size="sm" variant={on('add') ? 'primary' : 'secondary'} onClick={() => open(id, 'add', it, s.name)} aria-expanded={on('add')}>Add Strike</Button>
                          <Button size="sm" variant="ghost" onClick={() => open(id, 'excuse', it, s.name)} aria-expanded={on('excuse')}><Check size={14} aria-hidden="true" /> Excuse</Button>
                          <Button size="sm" variant="ghost" onClick={() => open(id, 'dismiss', it, s.name)} aria-expanded={on('dismiss')}><X size={14} aria-hidden="true" /> Dismiss</Button>
                        </span>
                      )}
                    </div>
                    {panel?.id === id && <div className={styles.panel}>{form(panel)}</div>}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <button type="button" className={styles.pastToggle} onClick={() => setShowPast((v) => !v)} aria-expanded={showPast}>Past Missed Meetings ({past.length})</button>
      {showPast && (past.length === 0 ? <p className={styles.muted}>Nothing decided yet.</p> : (
        <ul className={styles.missList}>
          {past.map((p) => (
            <li key={key(p)} className={styles.pastRow}>
              <span className={styles.pastMain}><b>{p.name}</b><small>{p.title} · {day(p.date)}</small>{p.reason && <small>“{p.reason}”</small>}</span>
              <span className={`${styles.status} ${p.outcome === 'strike' ? styles.stOn : styles.stDraft}`}>{p.outcome === 'strike' ? 'Strike Added' : 'Dismissed'}</span>
              {p.outcome !== 'strike' && p.user_id !== me && <Button size="sm" variant="ghost" loading={busy} onClick={() => go('undo', [{ user_id: p.user_id, meeting_id: p.meeting_id }])}>Put Back</Button>}
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}
