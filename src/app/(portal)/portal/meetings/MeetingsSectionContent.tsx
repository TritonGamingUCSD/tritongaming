'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { CalendarCheck, Radio, History as HistoryIcon, ClipboardList, Check, X, Maximize2, Minimize2, UserPlus, ArrowLeft, ExternalLink, FileText, Plus, Repeat, MapPin, Download, SkipForward, RotateCcw, Pause, Play, Trash2, Link2, MessageCircleQuestion, Shuffle, Send } from 'lucide-react';
import SectionTabs from '@/components/ui/SectionTabs';
import Notice from '@/components/ui/Notice';
import Button from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { confirmHold } from '@/lib/confirmHold';
import { resolveAvatarUrl } from '@/lib/profile';
import { usePortalTabSync, useUrlNav } from '@/lib/usePortalTabSync';
import { REACTION_EMOJIS, MAX_ANSWER_LENGTH, MAX_QUESTION_LENGTH, suggestQuestion } from '@/lib/meetingFun';
import styles from './meetings.module.css';

type Tab = 'checkin' | 'mine' | 'run' | 'attendance';

interface Person { id: string; name: string; avatar_url: string | null; custom_avatar_url: string | null }
interface TodayMeeting { id: string; title: string; location: string | null; starts_at: string; ends_at: string; open: boolean; checked_in_at: string | null; doc_url: string | null; question: string | null; my_answer: string | null }
interface NextMeeting { title: string; location: string | null; starts_at: string; ends_at: string; date: string }
interface Live {
  meeting: { id: string; title: string; meeting_date: string; open: boolean; doc_url: string | null; location: string | null; cancelled: boolean; question: string | null };
  answers: (Person & { answer: string; at: string })[];
  reactions: { id: number; emoji: string }[];
  lastReactionId: number;
  reactionTotals: Record<string, number>;
  code: string | null;
  expiresAt: number | null;
  attendees: (Person & { checked_in_at: string; method: 'code' | 'manual' })[];
  missing: Person[];
}
interface Item { key: string; meeting_id: string | null; series_id: string | null; date: string; title: string; location: string | null; doc_url: string | null; question: string | null; starts_at: string; ends_at: string; status: 'scheduled' | 'open' | 'closed' | 'cancelled'; count: number; is_today: boolean; repeats: boolean }
interface Series { id: string; title: string; weekday: number; start_time: string; end_time: string; location: string | null; active: boolean; doc_url: string | null }

const TZ = 'America/Los_Angeles';
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
const timeRange = (a: string, b: string) => `${time(a)} – ${time(b)}`;
const dayLabel = (key: string, long = false) => new Date(`${key}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: long ? 'long' : 'short', month: 'short', day: 'numeric' });
const hhmmLabel = (t: string) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`; };
const pacificToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const shiftKey = (key: string, days: number) => { const d = new Date(`${key}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };

function Avatar({ p }: { p: Person }) {
  const src = resolveAvatarUrl(p);
  return src
    ? <Image src={src} alt="" width={32} height={32} unoptimized referrerPolicy="no-referrer" className={styles.avatar} />
    : <span className={styles.avatarFallback}>{p.name[0]?.toUpperCase() ?? '?'}</span>;
}

// A doc link is either a full URL (new tab) or a path inside the site (same tab).
function DocButton({ url, label = 'Open meeting doc' }: { url: string; label?: string }) {
  const external = /^https?:/i.test(url);
  return (
    <a className={styles.docBtn} href={url} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      <FileText size={16} aria-hidden="true" /> {label} {external && <ExternalLink size={13} aria-hidden="true" />}
    </a>
  );
}

export default function MeetingsSectionContent({ canManage }: { canManage: boolean }) {
  const nav = useUrlNav();
  const sync = usePortalTabSync('meetings');
  const valid: Tab[] = canManage ? ['checkin', 'mine', 'run', 'attendance'] : ['checkin', 'mine'];
  const [tab, setTab] = useState<Tab>(valid.includes(nav.tab as Tab) ? (nav.tab as Tab) : 'checkin');

  function pick(t: Tab) { setTab(t); sync(t); }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Meetings</h1>
        <p className={styles.sub}>Check in to meetings in person with the code shown in the room.</p>
      </div>
      <SectionTabs<Tab>
        label="Meetings"
        value={tab}
        onChange={pick}
        tabs={[
          { id: 'checkin', label: 'Check in', icon: <CalendarCheck size={15} /> },
          { id: 'mine', label: 'My history', icon: <HistoryIcon size={15} /> },
          ...(canManage ? [
            { id: 'run' as Tab, label: 'Run meetings', icon: <Radio size={15} /> },
            { id: 'attendance' as Tab, label: 'Attendance', icon: <ClipboardList size={15} /> },
          ] : []),
        ]}
      />
      {tab === 'checkin' && <CheckInPanel />}
      {tab === 'mine' && <MyHistoryPanel />}
      {tab === 'run' && canManage && <RunPanel />}
      {tab === 'attendance' && canManage && <AttendancePanel />}
    </div>
  );
}

// ── A team member checking themselves in ──────────────────────────────────────
function CheckInPanel() {
  const [data, setData] = useState<{ meetings: TodayMeeting[]; next: NextMeeting | null } | undefined>(undefined);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/meetings/today', { cache: 'no-store' });
      if (res.ok) setData(await res.json());
    } catch { /* keep what we have */ }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  async function submit(value: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/meetings/check-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: value }) });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Check-in failed.'); setCode(''); return; }
      setCode('');
      await load();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <LoadingSpinner size={28} label="Loading meetings…" theme="dark" />;

  const checkedIn = data.meetings.filter((m) => m.checked_in_at);
  const openToEnter = data.meetings.filter((m) => m.open && !m.checked_in_at);

  return (
    <div className={styles.stack}>
      {checkedIn.map((m) => (
        <div key={m.id} className={`${styles.card} ${styles.done}`}>
          <span className={styles.doneIcon}><Check size={34} strokeWidth={2.5} aria-hidden="true" /></span>
          <h2 className={styles.cardTitle}>You&apos;re checked in</h2>
          <p className={styles.muted}>{m.title} · {time(m.checked_in_at!)}{m.location ? ` · ${m.location}` : ''}</p>
          {m.doc_url ? <DocButton url={m.doc_url} /> : <p className={styles.faint}>No meeting doc has been linked yet.</p>}
          <FunBox meeting={m} onSaved={load} />
        </div>
      ))}

      {openToEnter.length > 0 && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Enter the code on the screen</h2>
          <p className={styles.muted}>
            {openToEnter.map((m) => m.title).join(' · ')} — the 6-digit code changes every 30 seconds.
          </p>
          <input
            className={styles.codeInput}
            value={code}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 6);
              setCode(v);
              if (v.length === 6) submit(v);
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            aria-label="6-digit meeting code"
            disabled={busy}
            autoFocus={checkedIn.length === 0}
          />
          {error && <Notice tone="error">{error}</Notice>}
          <Button onClick={() => submit(code)} disabled={code.length !== 6} loading={busy}>Check in</Button>
        </div>
      )}

      {checkedIn.length === 0 && openToEnter.length === 0 && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Check-in isn&apos;t open</h2>
          <p className={styles.muted}>
            {data.meetings.length > 0
              ? 'An exec opens check-in when the meeting starts. This page updates on its own, so keep it open.'
              : 'There’s no meeting today.'}
          </p>
        </div>
      )}

      {data.next && (
        <div className={styles.nextCard}>
          <span className={styles.nextLabel}>Next meeting</span>
          <strong>{data.next.title}</strong>
          <span className={styles.muted}>{dayLabel(data.next.date, true)} · {timeRange(data.next.starts_at, data.next.ends_at)}{data.next.location ? ` · ${data.next.location}` : ''}</span>
        </div>
      )}
    </div>
  );
}


// After checking in: the question of the meeting, and quick emoji reactions for the big screen.
function FunBox({ meeting, onSaved }: { meeting: TodayMeeting; onSaved: () => void }) {
  const [text, setText] = useState(meeting.my_answer ?? '');
  const [editing, setEditing] = useState(!meeting.my_answer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [burst, setBurst] = useState<string | null>(null);
  const last = useRef(0);

  async function send() {
    if (!text.trim()) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: text }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || 'Couldn’t send.'); return; }
      setEditing(false);
      onSaved();
    } finally { setBusy(false); }
  }

  function react(emoji: string) {
    const t = Date.now();
    if (!meeting.open || t - last.current < 400) return;
    last.current = t;
    setBurst(emoji);
    setTimeout(() => setBurst((b) => (b === emoji ? null : b)), 350);
    fetch(`/api/meetings/${meeting.id}/react`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji }) }).catch(() => {});
  }

  return (
    <div className={styles.funBox}>
      {meeting.question && (
        <div className={styles.questionBox}>
          <span className={styles.questionLabel}><MessageCircleQuestion size={14} aria-hidden="true" /> Question of the meeting</span>
          <p className={styles.questionText}>{meeting.question}</p>
          {editing && meeting.open ? (
            <form className={styles.answerForm} onSubmit={(e) => { e.preventDefault(); send(); }}>
              <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_ANSWER_LENGTH} placeholder="Your answer…" aria-label="Your answer" autoComplete="off" />
              <Button type="submit" size="sm" loading={busy} disabled={!text.trim()}><Send size={14} aria-hidden="true" /> Send</Button>
            </form>
          ) : meeting.my_answer ? (
            <p className={styles.myAnswer}>
              <Check size={14} aria-hidden="true" /> “{meeting.my_answer}”
              {meeting.open && <button type="button" className={styles.linkBtn} onClick={() => setEditing(true)}>Edit</button>}
            </p>
          ) : null}
          {error && <Notice tone="error">{error}</Notice>}
        </div>
      )}
      {meeting.open && (
        <div className={styles.reactBar} role="group" aria-label="Send a reaction to the screen">
          <span className={styles.reactLabel}>React on the big screen</span>
          <div className={styles.reactBtns}>
            {REACTION_EMOJIS.map((e) => (
              <button key={e} type="button" className={`${styles.reactBtn} ${burst === e ? styles.reactPop : ''}`} onClick={() => react(e)} aria-label={`Send ${e}`}>{e}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Everyone: their own attendance record ─────────────────────────────────────
function MyHistoryPanel() {
  const [data, setData] = useState<{ meetings: { id: string; title: string; date: string; location: string | null; attended: boolean; checked_in_at: string | null; method: string | null; doc_url: string | null }[]; attended: number; total: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/meetings/mine', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) setError(json.error || 'Failed to load.'); else setData(json);
      } catch { setError('Network error.'); }
    })();
  }, []);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <LoadingSpinner size={28} label="Loading your history…" theme="dark" />;
  if (data.meetings.length === 0) return <div className={styles.card}><p className={styles.muted}>No meetings yet. Your check-ins will show up here.</p></div>;

  const pct = data.total ? Math.round((data.attended / data.total) * 100) : 0;
  return (
    <div className={styles.stack}>
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>You&apos;ve been to {data.attended} of the last {data.total} meeting{data.total === 1 ? '' : 's'}</h2>
        <div className={styles.meter}><span style={{ width: `${pct}%` }} /></div>
      </div>
      <ul className={styles.people}>
        {data.meetings.map((m) => (
          <li key={m.id} className={`${styles.historyRow} ${m.attended ? '' : styles.missed}`}>
            <span className={styles.dateChip}>{dayLabel(m.date)}</span>
            <span className={styles.personName}>
              {m.title}
              <em> · {m.attended ? `checked in ${time(m.checked_in_at!)}${m.method === 'manual' ? ' (added by exec)' : ''}` : 'not checked in'}</em>
            </span>
            {m.doc_url && <DocButton url={m.doc_url} label="Doc" />}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Exec: schedule meetings, then open one to run its check-in ────────────────
function RunPanel() {
  const [selected, setSelected] = useState<string | null>(null);
  if (selected) return <LiveMeeting id={selected} onBack={() => setSelected(null)} />;
  return <MeetingList onOpen={setSelected} />;
}

function MeetingList({ onOpen }: { onOpen: (id: string) => void }) {
  const [data, setData] = useState<{ series: Series[]; upcoming: Item[]; past: Item[] } | null>(null);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/meetings/schedule', { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) setData(json); else setError(json.error || 'Failed to load.');
    } catch { setError('Network error.'); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load]);

  async function post(url: string, body: unknown, key: string): Promise<{ ok: boolean; json: Record<string, unknown> }> {
    setBusyKey(key); setError('');
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setError((json.error as string) || 'Something went wrong.');
      return { ok: res.ok, json };
    } finally { setBusyKey(null); }
  }

  async function start(item: Item) {
    const r = await post('/api/meetings/open', item.meeting_id ? { meeting_id: item.meeting_id } : { series_id: item.series_id, date: item.date }, item.key);
    if (r.ok) onOpen(r.json.id as string);
  }
  async function cancel(item: Item, undo = false) {
    if (!undo && !(await confirmHold({ title: `Skip ${item.title} on ${dayLabel(item.date)}?`, message: item.repeats ? 'It stays on the list as skipped, and you can restore it.' : 'This removes the meeting.', confirmLabel: 'Hold to skip' }))) return;
    const r = await post('/api/meetings/cancel', item.meeting_id ? { meeting_id: item.meeting_id, undo } : { series_id: item.series_id, date: item.date, undo }, item.key);
    if (r.ok) load();
  }
  async function saveDoc(item: Item, doc: string, question: string): Promise<boolean> {
    const fields = { doc_url: doc, question };
    const r = await post('/api/meetings/update', item.meeting_id ? { meeting_id: item.meeting_id, ...fields } : { series_id: item.series_id, date: item.date, ...fields }, item.key);
    if (r.ok) load();
    return r.ok;
  }
  async function patchSeries(s: Series, body: Record<string, unknown>) {
    setBusyKey(s.id); setError('');
    const res = await fetch(`/api/meetings/series/${s.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error || 'Failed.');
    setBusyKey(null); load();
  }
  async function deleteSeries(s: Series) {
    if (!(await confirmHold({ title: `Delete “${s.title}”?`, message: 'It stops repeating. Meetings already held and their attendance are kept.', confirmLabel: 'Hold to delete' }))) return;
    setBusyKey(s.id);
    await fetch(`/api/meetings/series/${s.id}`, { method: 'DELETE' });
    setBusyKey(null); load();
  }

  if (!data) return error ? <Notice tone="error">{error}</Notice> : <LoadingSpinner size={28} label="Loading meetings…" theme="dark" />;

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <p className={styles.muted}>Open a meeting on its day to show its check-in code.</p>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>{showForm ? 'Close' : <><Plus size={14} aria-hidden="true" /> Schedule a meeting</>}</Button>
      </div>
      {showForm && <ScheduleForm onCreated={() => { setShowForm(false); load(); }} />}
      {error && <Notice tone="error">{error}</Notice>}

      <section>
        <h3 className={styles.listTitle}>Upcoming <span>next 2 weeks</span></h3>
        {data.upcoming.length === 0 ? <p className={styles.muted}>Nothing scheduled. Add a meeting above.</p> : (
          <ul className={styles.meetingList}>
            {data.upcoming.map((it) => <MeetingCard key={it.key} item={it} busy={busyKey === it.key} onStart={() => start(it)} onView={() => it.meeting_id && onOpen(it.meeting_id)} onCancel={(undo) => cancel(it, undo)} onSaveDoc={(d, q) => saveDoc(it, d, q)} />)}
          </ul>
        )}
      </section>

      <section>
        <h3 className={styles.listTitle}>Repeating meetings</h3>
        {data.series.length === 0 ? <p className={styles.muted}>None yet. Schedule one with “Every week”.</p> : (
          <ul className={styles.people}>
            {data.series.map((s) => (
              <li key={s.id} className={`${styles.seriesRow} ${s.active ? '' : styles.paused}`}>
                <Repeat size={16} aria-hidden="true" className={styles.seriesIcon} />
                <span className={styles.personName}>
                  {s.title}
                  <em> · every {WEEKDAYS[s.weekday]} {hhmmLabel(s.start_time)}–{hhmmLabel(s.end_time)}{s.location ? ` · ${s.location}` : ''}{s.active ? '' : ' · paused'}</em>
                </span>
                <button type="button" className={styles.iconBtn} onClick={() => patchSeries(s, { active: !s.active })} disabled={busyKey === s.id} aria-label={s.active ? 'Pause' : 'Resume'} title={s.active ? 'Pause' : 'Resume'}>
                  {s.active ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
                </button>
                <button type="button" className={styles.iconBtn} onClick={() => deleteSeries(s)} disabled={busyKey === s.id} aria-label={`Delete ${s.title}`} title="Delete"><Trash2 size={14} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.past.length > 0 && (
        <section>
          <h3 className={styles.listTitle}>Recent <span>last 30 days</span></h3>
          <ul className={styles.meetingList}>
            {data.past.map((it) => <MeetingCard key={it.key} item={it} busy={false} onStart={() => {}} onView={() => it.meeting_id && onOpen(it.meeting_id)} onCancel={() => {}} onSaveDoc={async () => false} past />)}
          </ul>
        </section>
      )}
    </div>
  );
}

function MeetingCard({ item, busy, past, onStart, onView, onCancel, onSaveDoc }: {
  item: Item; busy: boolean; past?: boolean;
  onStart: () => void; onView: () => void; onCancel: (undo: boolean) => void; onSaveDoc: (doc: string, question: string) => Promise<boolean>;
}) {
  const [editingDoc, setEditingDoc] = useState(false);
  const [doc, setDoc] = useState(item.doc_url ?? '');
  const [question, setQuestion] = useState(item.question ?? '');
  const status = item.status;
  const label = status === 'open' ? 'Open now' : status === 'closed' ? `${item.count} checked in` : status === 'cancelled' ? 'Skipped' : item.is_today ? 'Today' : 'Scheduled';

  return (
    <li className={`${styles.meetingCard} ${status === 'open' ? styles.cardOpen : ''} ${status === 'cancelled' ? styles.paused : ''}`}>
      <div className={styles.meetingMain}>
        <span className={`${styles.dateBlock} ${item.is_today ? styles.dateToday : ''}`}>
          <b>{new Date(`${item.date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', day: 'numeric' })}</b>
          <small>{new Date(`${item.date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', weekday: 'short' })}</small>
        </span>
        <div className={styles.meetingInfo}>
          <strong>{item.title}{item.repeats && <Repeat size={12} aria-label="Repeats weekly" className={styles.inlineIcon} />}</strong>
          <span className={styles.muted}>{timeRange(item.starts_at, item.ends_at)}{item.location && <> · <MapPin size={11} aria-hidden="true" className={styles.inlineIcon} /> {item.location}</>}</span>
          {(item.doc_url || item.question) && (
            <span className={styles.docLine}>
              {item.doc_url && <><Link2 size={11} aria-hidden="true" /> doc linked</>}
              {item.doc_url && item.question && ' · '}
              {item.question && <><MessageCircleQuestion size={11} aria-hidden="true" /> question set</>}
            </span>
          )}
        </div>
        <span className={`${styles.pill} ${status === 'open' ? styles.pillOpen : status === 'closed' ? styles.pillDone : ''}`}>{label}</span>
      </div>
      <div className={styles.cardActions}>
        {!past && (status === 'open' ? (
          <Button size="sm" onClick={onView}><Radio size={14} aria-hidden="true" /> Show code</Button>
        ) : status === 'cancelled' ? (
          <Button size="sm" variant="ghost" onClick={() => onCancel(true)} loading={busy}><RotateCcw size={14} aria-hidden="true" /> Restore</Button>
        ) : item.is_today ? (
          <Button size="sm" onClick={onStart} loading={busy}>{status === 'closed' ? 'Re-open check-in' : 'Start check-in'}</Button>
        ) : null)}
        {(past || status === 'closed') && item.meeting_id && <Button size="sm" variant="ghost" onClick={onView}>Attendance</Button>}
        {!past && status !== 'cancelled' && status !== 'open' && (
          <>
            <Button size="sm" variant="ghost" onClick={() => setEditingDoc((v) => !v)}><FileText size={14} aria-hidden="true" /> Doc &amp; question</Button>
            {status === 'scheduled' && <Button size="sm" variant="ghost" onClick={() => onCancel(false)}><SkipForward size={14} aria-hidden="true" /> Skip</Button>}
          </>
        )}
      </div>
      {editingDoc && (
        <form className={styles.detailsForm} onSubmit={async (e) => { e.preventDefault(); if (await onSaveDoc(doc, question)) setEditingDoc(false); }}>
          <Field label="Meeting doc link"><Input value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="https://docs.google.com/… or /portal?section=docs" inputMode="url" /></Field>
          <Field label="Question of the meeting">
            <div className={styles.inlineRow}>
              <Input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={MAX_QUESTION_LENGTH} placeholder="An icebreaker people answer after checking in" />
              <Button type="button" size="sm" variant="ghost" onClick={() => setQuestion(suggestQuestion(question))}><Shuffle size={14} aria-hidden="true" /> Suggest</Button>
            </div>
          </Field>
          <div className={styles.formActions}><Button type="submit" size="sm" loading={busy}>Save</Button></div>
        </form>
      )}
    </li>
  );
}

function ScheduleForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [repeat, setRepeat] = useState<'weekly' | 'once'>('weekly');
  const [weekday, setWeekday] = useState('5');
  const [date, setDate] = useState(pacificToday());
  const [start, setStart] = useState('17:00');
  const [end, setEnd] = useState('18:00');
  const [location, setLocation] = useState('');
  const [doc, setDoc] = useState('');
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/meetings/schedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, repeat, weekday: Number(weekday), date, start, end, location, doc_url: doc, question }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || 'Failed to schedule.'); return; }
      onCreated();
    } finally { setBusy(false); }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <button type="button" className={styles.presetBtn} onClick={() => { setTitle('Gen Meeting'); setRepeat('weekly'); setWeekday('5'); setStart('17:00'); setEnd('18:00'); }}>
        <Repeat size={14} aria-hidden="true" /> Use the Gen Meeting setup (every Friday, 5–6 PM)
      </button>
      <div className={styles.formGrid}>
        <Field label="Name"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Gen Meeting" maxLength={60} required /></Field>
        <Field label="Repeats">
          <Select value={repeat} onChange={(e) => setRepeat(e.target.value as 'weekly' | 'once')}>
            <option value="weekly">Every week</option>
            <option value="once">Just once</option>
          </Select>
        </Field>
        {repeat === 'weekly' ? (
          <Field label="Day of the week"><Select value={weekday} onChange={(e) => setWeekday(e.target.value)}>{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</Select></Field>
        ) : (
          <Field label="Date"><Input type="date" value={date} min={pacificToday()} onChange={(e) => setDate(e.target.value)} required /></Field>
        )}
        <Field label="Starts"><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} required /></Field>
        <Field label="Ends"><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required /></Field>
        <Field label="Room (optional)"><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Price Center East" maxLength={80} /></Field>
      </div>
      <Field label="Meeting doc link (optional)" hint="Shown to people after they check in. For a repeating meeting this is the default; change it for any single week."><Input value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="https://docs.google.com/…" inputMode="url" /></Field>
      {repeat === 'once' && (
        <Field label="Question of the meeting (optional)" hint="An icebreaker people answer after checking in. You can also set it on the day.">
          <div className={styles.inlineRow}>
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={MAX_QUESTION_LENGTH} placeholder="What game have you put the most hours into?" />
            <Button type="button" size="sm" variant="ghost" onClick={() => setQuestion(suggestQuestion(question))}><Shuffle size={14} aria-hidden="true" /> Suggest</Button>
          </div>
        </Field>
      )}
      <p className={styles.faint}>Times are Pacific. Repeating meetings show up on the list automatically, two weeks ahead.</p>
      {error && <Notice tone="error">{error}</Notice>}
      <div className={styles.formActions}><Button type="submit" loading={busy}>{repeat === 'weekly' ? 'Schedule weekly meeting' : 'Schedule meeting'}</Button></div>
    </form>
  );
}

// ── One specific meeting: its code and who's in ───────────────────────────────
function LiveMeeting({ id, onBack }: { id: string; onBack: () => void }) {
  const [live, setLive] = useState<Live | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [presenting, setPresenting] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState<string | null>(null);
  const [docSaved, setDocSaved] = useState(false);
  const [question, setQuestion] = useState('');
  const [questionSaved, setQuestionSaved] = useState(false);
  const [floaters, setFloaters] = useState<{ key: string; emoji: string; left: number; delay: number }[]>([]);
  const fieldsInit = useRef(false);
  // Reaction cursor: null until the first load, so history never replays on screen.
  const afterRef = useRef<number | null>(null);

  const loadLive = useCallback(async () => {
    try {
      const res = await fetch(`/api/meetings/${id}/live${afterRef.current === null ? '' : `?after=${afterRef.current}`}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json: Live = await res.json();
      setLive(json);
      if (!fieldsInit.current) { fieldsInit.current = true; setDoc(json.meeting.doc_url ?? ''); setQuestion(json.meeting.question ?? ''); }
      afterRef.current = json.lastReactionId;
      if (json.reactions.length) {
        const fresh = json.reactions.map((r, i) => ({ key: `r${r.id}`, emoji: r.emoji, left: 8 + Math.random() * 84, delay: i * 0.18 }));
        setFloaters((f) => [...f, ...fresh].slice(-60));
        setTimeout(() => setFloaters((f) => f.filter((x) => !fresh.some((n) => n.key === x.key))), 4200 + fresh.length * 180);
      }
    } catch { /* next poll */ }
  }, [id]);

  useEffect(() => {
    loadLive();
    // Faster than before so reactions and answers feel live on the big screen.
    const t = setInterval(loadLive, 2000);
    return () => clearInterval(t);
  }, [loadLive]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // Once the countdown ends, fetch the new code right away instead of waiting for the next poll.
  const codeExpired = !!live?.expiresAt && now > live.expiresAt + 200;
  useEffect(() => { if (codeExpired) loadLive(); }, [codeExpired, loadLive]);

  async function act(url: string, body: unknown) {
    setBusy(true); setError('');
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || 'Something went wrong.'); return; }
      await loadLive();
    } finally { setBusy(false); }
  }
  async function addPerson(p: Person) {
    await fetch(`/api/meetings/${id}/attendance`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: p.id }) });
    loadLive();
  }
  async function removePerson(p: Person) {
    if (!(await confirmHold({ title: `Remove ${p.name}?`, message: 'They’ll be marked as not attending this meeting.', confirmLabel: 'Hold to remove' }))) return;
    await fetch(`/api/meetings/${id}/attendance`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: p.id }) });
    loadLive();
  }
  async function saveDoc() {
    setBusy(true); setError(''); setDocSaved(false);
    try {
      const res = await fetch('/api/meetings/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meeting_id: id, doc_url: doc ?? '' }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || 'Failed to save.'); return; }
      setDocSaved(true);
    } finally { setBusy(false); }
  }

  async function saveQuestion(value: string) {
    setBusy(true); setError(''); setQuestionSaved(false);
    try {
      const res = await fetch('/api/meetings/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meeting_id: id, question: value }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || 'Failed to save.'); return; }
      setQuestionSaved(true);
      loadLive();
    } finally { setBusy(false); }
  }

  if (!live) return <LoadingSpinner size={28} label="Loading meeting…" theme="dark" />;

  const open = live.meeting.open;
  const secondsLeft = live.expiresAt ? Math.max(0, Math.ceil((live.expiresAt - now) / 1000)) : 0;
  const pct = Math.min(100, (secondsLeft / 30) * 100);
  const grouped = live.code ? `${live.code.slice(0, 3)} ${live.code.slice(3)}` : '';

  return (
    <div className={styles.runWrap}>
      {!presenting && (
        <button type="button" className={styles.backLink} onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> All meetings</button>
      )}

      {open ? (
        <div className={`${styles.codePanel} ${presenting ? styles.presenting : ''}`}>
          <button type="button" className={styles.presentBtn} onClick={() => setPresenting((p) => !p)} aria-label={presenting ? 'Exit full screen view' : 'Show on screen'}>
            {presenting ? <><Minimize2 size={15} aria-hidden="true" /> Exit</> : <><Maximize2 size={15} aria-hidden="true" /> Show on screen</>}
          </button>
          {live.meeting.question && (
            <div className={styles.screenQuestion}>
              <span className={styles.questionLabel}><MessageCircleQuestion size={presenting ? 18 : 14} aria-hidden="true" /> Question of the meeting</span>
              <p>{live.meeting.question}</p>
            </div>
          )}
          <span className={styles.codeLabel}>{live.meeting.title} check-in code</span>
          <div className={styles.bigCode} aria-live="off">{grouped}</div>
          <div className={styles.timer} aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
          <div className={styles.liveCount}><strong>{live.attendees.length}</strong> of {live.attendees.length + live.missing.length} checked in</div>
          {presenting && <p className={styles.presentHint}>Open the portal → Meetings and type this code</p>}
          {live.meeting.question && live.answers.length > 0 && (
            <div className={styles.screenAnswers} aria-label="Latest answers">
              {live.answers.slice(0, presenting ? 4 : 3).map((a) => (
                <div key={`${a.id}-${a.at}`} className={styles.answerCard}>
                  <span className={styles.answerText}>“{a.answer}”</span>
                  <span className={styles.answerBy}>{a.name}</span>
                </div>
              ))}
            </div>
          )}
          <div className={styles.floaters} aria-hidden="true">
            {floaters.map((f) => <span key={f.key} className={styles.floater} style={{ left: `${f.left}%`, animationDelay: `${f.delay}s` }}>{f.emoji}</span>)}
          </div>
        </div>
      ) : (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{live.meeting.title} · {dayLabel(live.meeting.meeting_date, true)}</h2>
          <p className={styles.muted}>Check-in is closed. {live.attendees.length} checked in.</p>
          {error && <Notice tone="error">{error}</Notice>}
          {!live.meeting.cancelled && <Button onClick={() => act('/api/meetings/open', { meeting_id: id })} loading={busy}>Re-open check-in</Button>}
        </div>
      )}

      {!presenting && (
        <>
          {open && error && <Notice tone="error">{error}</Notice>}
          {open && (
            <div className={styles.runActions}>
              <Button variant="ghost" onClick={async () => { if (await confirmHold({ title: 'Close check-in?', message: 'Nobody else will be able to check in with the code. You can re-open it.', confirmLabel: 'Hold to close' })) act('/api/meetings/close', { meeting_id: id }); }} loading={busy}>Close check-in</Button>
            </div>
          )}
          <div className={styles.card}>
            <h3 className={styles.listTitle}><MessageCircleQuestion size={14} aria-hidden="true" /> Question of the meeting</h3>
            <p className={styles.faint}>Shown on the big screen and revealed to people after they check in. They can answer it and send reactions.</p>
            <form className={styles.docForm} onSubmit={(e) => { e.preventDefault(); saveQuestion(question); }}>
              <Input value={question} onChange={(e) => { setQuestion(e.target.value); setQuestionSaved(false); }} maxLength={MAX_QUESTION_LENGTH} placeholder="e.g. What game have you put the most hours into?" aria-label="Question of the meeting" />
              <Button type="button" size="sm" variant="ghost" onClick={() => { const q = suggestQuestion(question); setQuestion(q); setQuestionSaved(false); }}><Shuffle size={14} aria-hidden="true" /> Suggest</Button>
              <Button type="submit" size="sm" loading={busy}>{questionSaved ? 'Saved' : 'Save'}</Button>
            </form>
            {live.meeting.question && (
              <div className={styles.answerWall}>
                <h4 className={styles.listTitle}>Answers <span>{live.answers.length}</span></h4>
                {live.answers.length === 0 ? <p className={styles.muted}>No answers yet.</p> : (
                  <ul className={styles.people}>
                    {live.answers.map((a) => (
                      <li key={a.id} className={styles.person}>
                        <Avatar p={a} />
                        <span className={styles.personName}>{a.name}<em> · {a.answer}</em></span>
                      </li>
                    ))}
                  </ul>
                )}
                {Object.keys(live.reactionTotals).length > 0 && (
                  <p className={styles.totals}>{REACTION_EMOJIS.filter((e) => live.reactionTotals[e]).map((e) => <span key={e}>{e} {live.reactionTotals[e]}</span>)}</p>
                )}
              </div>
            )}
          </div>
          <form className={styles.docForm} onSubmit={(e) => { e.preventDefault(); saveDoc(); }}>
            <Field label="Meeting doc link" hint="Shown to people after they check in.">
              <Input value={doc ?? ''} onChange={(e) => { setDoc(e.target.value); setDocSaved(false); }} placeholder="https://docs.google.com/…" inputMode="url" />
            </Field>
            <Button type="submit" size="sm" variant="ghost" loading={busy}>{docSaved ? 'Saved' : 'Save link'}</Button>
          </form>
          <AttendeeList live={live} onAdd={addPerson} onRemove={removePerson} />
        </>
      )}
    </div>
  );
}

function AttendeeList({ live, onAdd, onRemove }: { live: Live; onAdd: (p: Person) => void; onRemove: (p: Person) => void }) {
  return (
    <div className={styles.lists}>
      <section>
        <h3 className={styles.listTitle}>Here <span>{live.attendees.length}</span></h3>
        {live.attendees.length === 0 ? <p className={styles.muted}>Nobody yet.</p> : (
          <ul className={styles.people}>
            {live.attendees.map((p) => (
              <li key={p.id} className={styles.person}>
                <Avatar p={p} />
                <span className={styles.personName}>{p.name}{p.method === 'manual' && <em> · added by exec</em>}</span>
                <span className={styles.personTime}>{time(p.checked_in_at)}</span>
                <button type="button" className={styles.iconBtn} onClick={() => onRemove(p)} aria-label={`Remove ${p.name}`}><X size={14} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className={styles.listTitle}>Not here yet <span>{live.missing.length}</span></h3>
        {live.missing.length === 0 ? <p className={styles.muted}>Everyone is in.</p> : (
          <ul className={styles.people}>
            {live.missing.map((p) => (
              <li key={p.id} className={styles.person}>
                <Avatar p={p} />
                <span className={styles.personName}>{p.name}</span>
                <button type="button" className={styles.addBtn} onClick={() => onAdd(p)}><UserPlus size={13} aria-hidden="true" /> Check in</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── Exec: attendance over time, and the HR export ─────────────────────────────
const RANGES = [
  { id: '30', label: 'Last 30 days', days: 30 },
  { id: '90', label: 'Last 90 days', days: 90 },
  { id: '365', label: 'Last year', days: 365 },
  { id: 'all', label: 'All time', days: 3650 },
] as const;

function AttendancePanel() {
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('90');
  const to = pacificToday();
  const from = shiftKey(to, -(RANGES.find((r) => r.id === range)?.days ?? 90));
  const [data, setData] = useState<{ meetings: { id: string; title: string; meeting_date: string; count: number }[]; people: { id: string; name: string; attended: number; total: number }[] } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/meetings/history', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) setError(json.error || 'Failed to load.'); else setData(json);
      } catch { setError('Network error.'); }
    })();
  }, []);

  const qs = `from=${from}&to=${to}`;
  return (
    <div className={styles.stack}>
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Export for HR</h2>
        <p className={styles.muted}>CSV files that open in Excel or Google Sheets. The log lists every person for every meeting, absences included. The summary has one row per person.</p>
        <Field label="Time range">
          <Select value={range} onChange={(e) => setRange(e.target.value as typeof range)}>{RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</Select>
        </Field>
        <div className={styles.exportBtns}>
          <a className={styles.docBtn} href={`/api/meetings/export?type=log&${qs}`}><Download size={15} aria-hidden="true" /> Attendance log (CSV)</a>
          <a className={styles.docBtn} href={`/api/meetings/export?type=summary&${qs}`}><Download size={15} aria-hidden="true" /> Per-person summary (CSV)</a>
        </div>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {!data && !error && <LoadingSpinner size={28} label="Loading attendance…" theme="dark" />}
      {data && data.meetings.length === 0 && <div className={styles.card}><p className={styles.muted}>No meetings yet. They show up here after the first check-in.</p></div>}
      {data && data.meetings.length > 0 && (
        <div className={styles.historyGrid}>
          <section className={styles.card}>
            <h3 className={styles.listTitle}>Per meeting</h3>
            <ul className={styles.people}>
              {data.meetings.map((m) => (
                <li key={m.id} className={styles.person}>
                  <span className={styles.personName}>{dayLabel(m.meeting_date)}<em> · {m.title}</em></span>
                  <span className={styles.count}>{m.count}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className={styles.card}>
            <h3 className={styles.listTitle}>Per person <span>last {data.meetings.length} meeting{data.meetings.length === 1 ? '' : 's'}</span></h3>
            <ul className={styles.people}>
              {[...data.people].sort((a, b) => b.attended - a.attended || a.name.localeCompare(b.name)).map((p) => (
                <li key={p.id} className={styles.person}>
                  <span className={styles.personName}>{p.name}</span>
                  <span className={styles.bar}><span style={{ width: `${p.total ? (p.attended / p.total) * 100 : 0}%` }} /></span>
                  <span className={styles.count}>{p.attended}/{p.total}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
