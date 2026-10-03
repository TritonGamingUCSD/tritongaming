'use client';

import WeekHead from '@/components/ui/WeekHead';
import { startsWeekGroup } from '@/lib/weekGroups';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { CalendarHeart, CalendarPlus, Plus, MapPin, Users, Check, CircleDashed, X as XIcon } from 'lucide-react';
import SectionTabs from '@/components/ui/SectionTabs';
import Notice from '@/components/ui/Notice';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import { Field, Input, Textarea, DateInput, TimeInput } from '@/components/ui/Field';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { confirmHold } from '@/lib/confirmHold';
import { usePortalTabSync, useUrlNav } from '@/lib/usePortalTabSync';
import { audienceLabel, isCustomAudience } from '@/lib/meetingAudience';
import { MAX_DESCRIPTION_LENGTH } from '@/lib/meetingFun';
import { googleCalendarUrl } from '@/lib/ics';
import { AudiencePicker, audFrom, audPayload, audienceEmpty, defaultAud, type Aud } from '../meetings/MeetingsSectionContent';
import mstyles from '../meetings/meetings.module.css';
import styles from './internal-events.module.css';

type Rsvp = 'going' | 'maybe' | 'not_going';
interface InternalEvent {
  id: string; title: string; date: string; starts_at: string; ends_at: string; location: string | null; description: string | null;
  audience: string[] | null; invitees: string[] | null; group_ids: string[] | null; groupNames: string[];
  host_id: string | null; host_name: string | null; hosting: boolean; canManage: boolean;
  mine: Rsvp | null; counts: Record<Rsvp, number>; going: string[]; invited: number;
}
type Tab = 'upcoming' | 'plan';

const TZ = 'America/Los_Angeles';
const pt = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
const dayName = (k: string) => new Date(`${k}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short' });
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

async function api(url: string, init?: RequestInit): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  try {
    const r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }, cache: 'no-store' });
    return { ok: r.ok, json: await r.json().catch(() => ({})) };
  } catch { return { ok: false, json: { error: 'Network error. Try again.' } }; }
}

// `canRsvp` is false for someone sitting the quarter out: they can look at events but not answer them.
export default function InternalEventsSectionContent({ canHost, canRsvp = true }: { canHost: boolean; canRsvp?: boolean }) {
  const nav = useUrlNav();
  const sync = usePortalTabSync('internal-events');
  const valid: Tab[] = canHost ? ['upcoming', 'plan'] : ['upcoming'];
  const [tab, setTab] = useState<Tab>(valid.includes(nav.tab as Tab) ? (nav.tab as Tab) : 'upcoming');
  return (
    <div className={mstyles.page}>
      <div className={mstyles.header}>
        <h1 className={mstyles.title}>Internal Events</h1>
        <p className={mstyles.sub}>Internal events for the team: socials, trainings, workshops. No check-in, just let people know if you’re coming.</p>
      </div>
      {canHost && (
        <SectionTabs<Tab> label="Internal events" value={tab} onChange={(t) => { setTab(t); sync(t); }}
          tabs={[{ id: 'upcoming', label: 'Coming up', icon: <CalendarHeart size={15} /> }, { id: 'plan', label: 'Plan', icon: <CalendarPlus size={15} /> }]} />
      )}
      {tab === 'upcoming' ? <UpcomingPanel canRsvp={canRsvp} /> : <PlanPanel />}
    </div>
  );
}

function useInternalEvents(scope: 'invited' | 'manage') {
  const [items, setItems] = useState<InternalEvent[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const { ok, json } = await api(`/api/internal-events${scope === 'manage' ? '?scope=manage' : ''}`);
    if (ok) setItems(json.events as InternalEvent[]); else setError((json.error as string) || 'Failed to load.');
  }, [scope]);
  useEffect(() => { void load(); }, [load]);
  return { items, error, load, setError };
}

function DateTile({ date, soon }: { date: string; soon: boolean }) {
  return (
    <span className={`${mstyles.dateBlock} ${soon ? mstyles.dateToday : ''}`} aria-hidden="true">
      <small>{new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short' })}</small>
      <b>{new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', day: 'numeric' })}</b>
    </span>
  );
}

function Summary({ s }: { s: InternalEvent }) {
  const parts = [s.counts.going && `${s.counts.going} going`, s.counts.maybe && `${s.counts.maybe} maybe`, s.counts.not_going && `${s.counts.not_going} can’t go`].filter(Boolean);
  return <>{parts.length ? parts.join(' · ') : 'No replies yet'}</>;
}

function UpcomingPanel({ canRsvp }: { canRsvp: boolean }) {
  const { items, error, load, setError } = useInternalEvents('invited');
  const [busy, setBusy] = useState<string | null>(null);
  async function rsvp(s: InternalEvent, status: Rsvp) {
    setBusy(s.id); setError('');
    const { ok, json } = await api(`/api/internal-events/${s.id}/rsvp`, { method: 'POST', body: JSON.stringify({ status: s.mine === status ? null : status }) });
    if (!ok) setError((json.error as string) || 'Failed.');
    setBusy(null); void load();
  }
  if (error && !items) return <Notice tone="error">{error}</Notice>;
  if (!items) return <LoadingSpinner size={28} label="Loading events…" theme="dark" />;
  if (items.length === 0) return <div className={mstyles.card}><p className={mstyles.muted}>Nothing coming up. When an event is planned for you, it shows up here.</p></div>;
  return (
    <>
      {error && <Notice tone="error">{error}</Notice>}
      <ul className={mstyles.stack}>
        {items.map((s, i) => (
          <Fragment key={s.id}>
          {startsWeekGroup(items.map((x) => x.date), i) && <WeekHead date={s.date} />}
          <li className={mstyles.meetingCard}>
            <div className={mstyles.meetingMain}>
              <DateTile date={s.date} soon={s.date === today()} />
              <div className={mstyles.meetingInfo}>
                <strong>{s.title}</strong>
                <span className={mstyles.metaLine}>
                  <span><strong className={mstyles.metaDay}>{s.date === today() ? 'Today' : dayName(s.date)}</strong> {clock(s.starts_at)} – {clock(s.ends_at)}</span>
                  {s.location && <span><MapPin size={11} aria-hidden="true" /> {s.location}</span>}
                </span>
                {s.description && <span className={styles.desc}>{s.description}</span>}
                <span className={`${mstyles.metaLine} ${mstyles.metaSub}`}>
                  <span><Summary s={s} /></span>
                  {s.host_name && <span>{s.hosting ? 'You’re hosting' : `Hosted by ${s.host_name}`}</span>}
                </span>
                {s.going.length > 0 && <span className={styles.who}>Going: {s.going.join(', ')}</span>}
              </div>
            </div>
            <div className={styles.rsvp} role="group" aria-label={`Are you coming to ${s.title}?`}>
              <IconButton kind="calendar" size="sm" className={styles.addCal} label={`Add ${s.title} to Google Calendar`} href={googleCalendarUrl({ title: s.title, start: s.starts_at, end: s.ends_at, location: s.location, details: s.description })} />
              {canRsvp && ([['going', 'Going', Check], ['maybe', 'Maybe', CircleDashed], ['not_going', 'Can’t go', XIcon]] as const).map(([k, label, Icon]) => (
                <button key={k} type="button" disabled={busy === s.id} aria-pressed={s.mine === k} className={`${styles.rsvpBtn} ${s.mine === k ? styles[`on_${k}`] : ''}`} onClick={() => rsvp(s, k)}>
                  <Icon size={14} strokeWidth={2.25} aria-hidden="true" /> {label}
                </button>
              ))}
            </div>
          </li>
          </Fragment>
        ))}
      </ul>
    </>
  );
}

function PlanPanel() {
  const { items, error, load, setError } = useInternalEvents('manage');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  async function remove(s: InternalEvent) {
    if (!(await confirmHold({ title: `Delete ${s.title}?`, message: `This removes it for everyone and clears the ${s.counts.going + s.counts.maybe + s.counts.not_going} replies.`, confirmLabel: 'Hold to delete' }))) return;
    const { ok, json } = await api(`/api/internal-events/${s.id}`, { method: 'DELETE' });
    if (!ok) setError((json.error as string) || 'Failed to delete.');
    void load();
  }
  return (
    <div className={mstyles.stack}>
      <div className={mstyles.toolbar}>
        <p className={mstyles.muted}>Invitees get a notification when you plan one. Replies are for headcount only; there’s no check-in.</p>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>{showForm ? 'Close' : <><Plus size={14} aria-hidden="true" /> Plan an event</>}</Button>
      </div>
      {showForm && <InternalEventForm onDone={() => { setShowForm(false); void load(); }} />}
      {error && <Notice tone="error">{error}</Notice>}
      {!items ? <LoadingSpinner size={28} label="Loading…" theme="dark" /> : items.length === 0 ? <p className={mstyles.muted}>Nothing planned yet.</p> : (
        <ul className={mstyles.stack}>
          {items.map((s) => (
            <li key={s.id} className={mstyles.meetingCard}>
              <div className={mstyles.meetingMain}>
                <DateTile date={s.date} soon={s.date === today()} />
                <div className={mstyles.meetingInfo}>
                  <strong>{s.title}</strong>
                  <span className={mstyles.metaLine}>
                    <span><strong className={mstyles.metaDay}>{dayName(s.date)}</strong> {clock(s.starts_at)} – {clock(s.ends_at)}</span>
                    {s.location && <span><MapPin size={11} aria-hidden="true" /> {s.location}</span>}
                  </span>
                  <span className={`${mstyles.metaLine} ${mstyles.metaSub}`}>
                    {isCustomAudience(s) && <span className={mstyles.metaAudience}><Users size={11} aria-hidden="true" /> {audienceLabel(s)}</span>}
                    <span><Summary s={s} /></span>
                    {s.host_name && !s.hosting && <span>Created by {s.host_name}</span>}
                  </span>
                </div>
                <div className={mstyles.cardActions}>
                  <IconButton kind="edit" label={`Edit ${s.title}`} onClick={() => setEditing(editing === s.id ? null : s.id)} />
                  <IconButton kind="delete" label={`Delete ${s.title}`} onClick={() => remove(s)} />
                </div>
              </div>
              {editing === s.id && <InternalEventForm item={s} onDone={() => { setEditing(null); void load(); }} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InternalEventForm({ item, onDone }: { item?: InternalEvent; onDone: () => void }) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [date, setDate] = useState(item?.date ?? today());
  const [start, setStart] = useState(item ? pt(item.starts_at) : '18:00');
  const [end, setEnd] = useState(item ? pt(item.ends_at) : '20:00');
  const [room, setRoom] = useState(item?.location ?? '');
  const [desc, setDesc] = useState(item?.description ?? '');
  const [aud, setAud] = useState<Aud>(item ? audFrom(item) : defaultAud());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    const { ok, json } = await api(item ? `/api/internal-events/${item.id}` : '/api/internal-events', {
      method: item ? 'PATCH' : 'POST',
      body: JSON.stringify({ title, date, start, end, location: room, description: desc, ...audPayload(aud) }),
    });
    setBusy(false);
    if (!ok) { setError((json.error as string) || 'Failed to save.'); return; }
    onDone();
  }
  return (
    <form className={item ? mstyles.detailsForm : mstyles.form} onSubmit={submit}>
      <div className={mstyles.formGrid}>
        <Field label="Name"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Recruitment training" maxLength={60} required /></Field>
        <Field label="Date"><DateInput value={date} min={today()} onChange={(e) => setDate(e.target.value)} required /></Field>
        <Field label="Starts"><TimeInput value={start} onChange={(e) => setStart(e.target.value)} required /></Field>
        <Field label="Ends"><TimeInput value={end} onChange={(e) => setEnd(e.target.value)} required /></Field>
      </div>
      <Field label="Where"><Input value={room} onChange={(e) => setRoom(e.target.value)} maxLength={80} placeholder="e.g. Price Center East" /></Field>
      <Field label="What’s the plan? (optional)"><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={MAX_DESCRIPTION_LENGTH} rows={2} placeholder="What it’s about, what to bring, who’s invited…" /></Field>
      <div className={mstyles.audienceField}><span className={mstyles.audienceTitle}>Who is it for?</span><AudiencePicker value={aud} onChange={setAud} /></div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className={mstyles.formActions}><Button type="submit" size="sm" loading={busy} disabled={audienceEmpty(aud) || end <= start}>{item ? 'Save changes' : 'Plan event'}</Button></div>
    </form>
  );
}
