'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { CalendarClock, CalendarDays, Radio, ClipboardList, Check, X, Maximize2, Minimize2, UserPlus, ArrowLeft, ExternalLink, FileText, Plus, Repeat, MapPin, Download, SkipForward, RotateCcw, Pause, Play, Trash2, Link2, MessageCircleQuestion, Shuffle, Send, Users, Minus, UserX, Lock, Dices, Smile, Upload, Settings2 } from 'lucide-react';
import IconButton from '@/components/ui/IconButton';
import SectionTabs from '@/components/ui/SectionTabs';
import Notice from '@/components/ui/Notice';
import Button from '@/components/ui/Button';
import WeekHead from '@/components/ui/WeekHead';
import { startsWeekGroup, weekGroup } from '@/lib/weekGroups';

// A card's edge takes its week's color, the same as the heading above it (repeating is shown by its icon, not a color).
const WEEK_TONE = ['today', 'wnext', 'wlater'] as const;
import { Field, Input, Select, Textarea, DateInput, TimeInput } from '@/components/ui/Field';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { confirmHold } from '@/lib/confirmHold';
import { resolveAvatarUrl } from '@/lib/profile';
import { usePortalTabSync, useUrlNav } from '@/lib/usePortalTabSync';
import { AUDIENCE_LABELS, AUDIENCE_ROLES, audienceLabel, audienceRoles } from '@/lib/meetingAudience';
import { googleCalendarUrl } from '@/lib/ics';
import BubbleField from './BubbleField';
import { QuestionEditor, ResultBars, StarPicker, Confetti, emptyQ, qFrom, qPayload, qBad, type QState } from './QuestionParts';
import { CUSTOM_PREFIX, isCustomEmoji, customEmojiId, MAX_EMOJI_BYTES, MAX_EMOJI_PICK_BYTES, EMOJI_NAME, parseDiscordEmoji, emojiNameFrom, type CustomEmoji, type QuestionType, type Tally, MAX_ANSWER_LENGTH, MAX_QUESTION_LENGTH, MAX_DESCRIPTION_LENGTH, suggestQuestion } from '@/lib/meetingFun';
import PlanningPanel from './planning/PlanningPanel';
import styles from './meetings.module.css';
import SectionHeader from '@/components/ui/SectionHeader';

type Tab = 'mine' | 'planning' | 'host' | 'tools';
type ToolTab = 'attendance' | 'groups' | 'emojis';

interface Person { id: string; name: string; avatar_url: string | null; custom_avatar_url: string | null }
interface TodayMeeting { question_type: QuestionType; question_options: string[] | null; id: string; title: string; description: string | null; location: string | null; starts_at: string; ends_at: string; open: boolean; accepting: boolean; opens_at: string; checked_in_at: string | null; doc_url: string | null; question: string | null; my_answer: string | null }
interface NextMeeting { doc_url?: string | null; title: string; description: string | null; location: string | null; starts_at: string; ends_at: string; date: string }
interface Live {
  meeting: { question_type: QuestionType; question_options: string[] | null; id: string; title: string; meeting_date: string; starts_at: string; ends_at: string; open: boolean; doc_url: string | null; location: string | null; cancelled: boolean; series_id: string | null; accepting: boolean; opens_at: string; question: string | null; description: string | null; audience: string[] | null; invitees: string[] | null; group_ids: string[] | null; groupNames: string[] };
  answers: (Person & { answer: string; at: string })[];
  reactions: { id: number; emoji: string }[];
  lastReactionId: number;
  reactionTotals: Record<string, number>;
  customEmojis?: Record<string, { name: string; url: string }>;
  tally: Tally;
  code: string | null;
  expiresAt: number | null;
  attendees: (Person & { checked_in_at: string; method: 'code' | 'manual' | 'host' })[];
  missing: Person[];
  absent: (Person & { reason: string | null; excused: boolean })[];
}
interface Item { question_type: QuestionType; question_options: string[] | null; key: string; meeting_id: string | null; series_id: string | null; date: string; title: string; location: string | null; doc_url: string | null; question: string | null; description: string | null; audience: string[] | null; invitees: string[] | null; group_ids: string[] | null; groupNames: string[]; host_id: string | null; host_name: string | null; starts_at: string; ends_at: string; status: 'scheduled' | 'open' | 'closed' | 'cancelled'; count: number; absent?: number; is_today: boolean; repeats: boolean }
interface Series { ends_on?: string | null; id: string; title: string; weekday: number; start_time: string; end_time: string; location: string | null; active: boolean; doc_url: string | null; description: string | null; audience: string[] | null; invitees: string[] | null; group_ids: string[] | null }

const TZ = 'America/Los_Angeles';
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
const timeRange = (a: string, b: string) => `${time(a)} – ${time(b)}`;
const dayLabel = (key: string, long = false) => new Date(`${key}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: long ? 'long' : 'short', month: 'short', day: 'numeric' });
const hhmmLabel = (t: string) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`; };
const pacificHHMM = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
const pacificToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const shiftKey = (key: string, days: number) => { const d = new Date(`${key}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };

// A clock that ticks every 30 seconds, so time-dependent labels stay right without a refresh.
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  return now;
}

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

// canHost: can plan meetings (leads, exec, admin) and run/edit/see results of the ones they planned.
// canManageAll: exec and admin, who can do that for every meeting and export attendance for HR.
// canAttend: checks in to meetings. canViewReports: sees every meeting's attendance results and the HR export
// (read only), e.g. the HR team, who may not attend meetings at all.
export default function MeetingsSectionContent({ canHost, canManageAll, userId, canAttend = true, canViewReports = false }: { canHost: boolean; canManageAll: boolean; userId: string; canAttend?: boolean; canViewReports?: boolean }) {
  const canManage = canHost;
  const canSeeResults = canHost || canViewReports;
  const nav = useUrlNav();
  const sync = usePortalTabSync('meetings');
  const toolTabs: ToolTab[] = [...(canSeeResults ? (['attendance'] as ToolTab[]) : []), ...(canManage ? (['groups'] as ToolTab[]) : []), ...(canAttend || canManage ? (['emojis'] as ToolTab[]) : [])];
  const valid: Tab[] = [...(canAttend ? (['mine', 'planning'] as Tab[]) : canManage ? (['planning'] as Tab[]) : []), ...(canManage ? (['host'] as Tab[]) : []), ...(toolTabs.length ? (['tools'] as Tab[]) : [])];
  // Old links and notifications: tab=upcoming and tab=checkin are part of My meetings now; Run meetings is called Host; Attendance, Groups and Emojis live under Tools.
  const legacyTool = (['attendance', 'groups', 'emojis'] as const).find((t) => t === nav.tab || t === nav.subtab);
  const startTab = nav.tab === 'upcoming' || nav.tab === 'checkin' ? 'mine' : nav.tab === 'run' ? 'host' : nav.tab === 'manage' || legacyTool ? 'tools' : nav.tab;
  const [toolTab, setToolTab] = useState<ToolTab>(legacyTool && toolTabs.includes(legacyTool) ? legacyTool : toolTabs[0] ?? 'emojis');
  const [tab, setTab] = useState<Tab>(valid.includes(startTab as Tab) ? (startTab as Tab) : valid[0] ?? 'mine');
  // Set when a meeting is opened from the Attendance tab, so Run meetings lands straight on it.
  const [runTarget, setRunTarget] = useState<string | null>(null);
  // The schedule form is opened from the header button, on the Host tab.
  const [scheduling, setScheduling] = useState(false);

  function pick(t: Tab) { setRunTarget(null); setTab(t); sync(t, t === 'tools' ? toolTab : null); }
  function openFromAttendance(id: string) { setRunTarget(id); setTab('host'); sync('host'); }

  return (
    <div className={styles.page} data-wide>
      <SectionHeader title="Meetings" flush sub={canAttend ? 'Check in with the code in the room.' : 'Attendance for every meeting.'}
        actions={canManage ? <Button size="sm" onClick={() => { setRunTarget(null); setTab('host'); sync('host'); setScheduling((v) => (tab === 'host' ? !v : true)); }}>{scheduling && tab === 'host' ? 'Close' : <><Plus size={14} aria-hidden="true" /> Schedule a Meeting</>}</Button> : undefined} />
      <SectionTabs<Tab>
        label="Meetings"
        value={tab}
        onChange={pick}
        tabs={[
          ...(canAttend ? [{ id: 'mine' as Tab, label: 'My meetings', icon: <CalendarDays size={15} /> }] : []),
          ...(canAttend || canManage ? [{ id: 'planning' as Tab, label: 'Planning', icon: <CalendarClock size={15} /> }] : []),
          ...(canManage ? [{ id: 'host' as Tab, label: 'Host', icon: <Radio size={15} /> }] : []),
          ...(toolTabs.length ? [{ id: 'tools' as Tab, label: 'Tools', icon: <Settings2 size={15} /> }] : []),
        ]}
      />
      {tab === 'mine' && canAttend && (
        <div className={styles.twoCol}>
          <div className={styles.stack}>
            <h2 className={styles.sectionHead}>Check in</h2>
            <CheckInPanel />
            <h2 className={styles.sectionHead}>Coming up</h2>
            <UpcomingPanel />
          </div>
          <div className={styles.stack}>
            <h2 className={styles.sectionHead}>History</h2>
            <MyHistoryPanel />
          </div>
        </div>
      )}
      {tab === 'planning' && (canAttend || canManage) && <PlanningPanel userId={userId} />}
      {tab === 'host' && canManage && <RunPanel initial={runTarget} showForm={scheduling} onShowForm={setScheduling} />}
      {tab === 'tools' && toolTabs.length > 0 && (
        <div className={styles.stack}>
          {toolTabs.length > 1 && (
            <SectionTabs<ToolTab> label="Tools" variant="segmented" value={toolTab} onChange={(m) => { setToolTab(m); sync('tools', m); }}
              tabs={toolTabs.map((t) => (t === 'attendance' ? { id: t, label: 'Attendance', icon: <ClipboardList size={14} /> } : t === 'groups' ? { id: t, label: 'Groups', icon: <Users size={14} /> } : { id: t, label: 'Emojis', icon: <Smile size={14} /> }))} />
          )}
          {toolTab === 'attendance' && canSeeResults && <AttendancePanel onOpenMeeting={canManage ? openFromAttendance : undefined} canExport={canManageAll || canViewReports} />}
          {toolTab === 'groups' && canManage && <GroupsPanel userId={userId} canManageAll={canManageAll} />}
          {toolTab === 'emojis' && (canAttend || canManage) && <EmojiPanel />}
        </div>
      )}
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
  const openToEnter = data.meetings.filter((m) => m.accepting && !m.checked_in_at);
  // Opened by an exec, but members can't start yet (it's earlier than 10 minutes before the start).
  const early = data.meetings.filter((m) => m.open && !m.accepting && !m.checked_in_at);

  return (
    <div className={styles.stack}>
      {checkedIn.map((m) => (
        <div key={m.id} className={`${styles.card} ${styles.done}`}>
          <span className={styles.doneIcon}><Check size={34} strokeWidth={2.5} aria-hidden="true" /></span>
          <h2 className={styles.cardTitle}>You&apos;re checked in</h2>
          <p className={styles.muted}>{m.title} · {time(m.checked_in_at!)}{m.location ? ` · ${m.location}` : ''}</p>
          {m.description && <p className={styles.descText}>{m.description}</p>}
          {m.doc_url ? <DocButton url={m.doc_url} /> : <p className={styles.faint}>No doc linked yet</p>}
          <FunBox meeting={m} onSaved={load} />
        </div>
      ))}

      {openToEnter.length > 0 && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Enter the code on the screen</h2>
          <p className={styles.muted}>
            {openToEnter.map((m) => m.title).join(' · ')} · the code changes every 30 s
          </p>
          {openToEnter.filter((m) => m.description).map((m) => <p key={m.id} className={styles.descText}>{m.description}</p>)}
          {openToEnter.filter((m) => m.doc_url).map((m) => <DocButton key={m.id} url={m.doc_url!} label={openToEnter.length > 1 ? `Doc: ${m.title}` : 'Open meeting doc'} />)}
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

      {early.length > 0 && openToEnter.length === 0 && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Check-in opens at {time(early[0].opens_at)}</h2>
          <p className={styles.muted}>{early[0].title} · starts {time(early[0].starts_at)}</p>
          {early[0].doc_url && <DocButton url={early[0].doc_url} />}
        </div>
      )}

      {checkedIn.length === 0 && openToEnter.length === 0 && early.length === 0 && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Check-in isn&apos;t open</h2>
          <p className={styles.muted}>
            {data.meetings.length > 0
              ? 'Opens when the meeting starts. This page updates itself.'
              : 'There’s no meeting today.'}
          </p>
        </div>
      )}

      {data.next && (
        <div className={styles.nextCard}>
          <span className={styles.nextLabel}>Next meeting</span>
          <strong>{data.next.title}</strong>
          <span className={styles.muted}>{dayLabel(data.next.date, true)} · {timeRange(data.next.starts_at, data.next.ends_at)}{data.next.location ? ` · ${data.next.location}` : ''}</span>
          {data.next.description && <span className={styles.descText}>{data.next.description}</span>}
          {data.next.doc_url && <DocButton url={data.next.doc_url} />}
        </div>
      )}
    </div>
  );
}


// After checking in: the question of the meeting, and quick emoji reactions for the big screen.
// A plain emoji, or the picture for a club custom one (`custom:<id>`).
function EmojiView({ emoji, custom, size = '1em' }: { emoji: string; custom?: Record<string, { name: string; url: string }>; size?: string }) {
  if (!isCustomEmoji(emoji)) return <>{emoji}</>;
  const c = custom?.[customEmojiId(emoji)];
  // eslint-disable-next-line @next/next/no-img-element
  return c ? <img src={c.url} alt={`:${c.name}:`} className={styles.customEmoji} style={{ width: size, height: size }} /> : null;
}

function FunBox({ meeting, onSaved }: { meeting: TodayMeeting; onSaved: () => void }) {
  const [text, setText] = useState(meeting.my_answer ?? '');
  const [editing, setEditing] = useState(!meeting.my_answer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [burst, setBurst] = useState<string | null>(null);
  const [club, setClub] = useState<CustomEmoji[]>([]);
  const [mine, setMine] = useState<string | null>(meeting.my_answer);
  const [tallyNow, setTallyNow] = useState<Tally | null>(null);
  const last = useRef(0);
  const type = meeting.question_type ?? 'text';
  // Polls and ratings: after you vote you watch the bars move as everyone else votes.
  useEffect(() => {
    if (type === 'text' || !mine || !meeting.open) return;
    let alive = true;
    const pull = () => fetch(`/api/meetings/${meeting.id}/results`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (alive && j) setTallyNow({ counts: j.counts, total: j.total, average: j.average }); }).catch(() => {});
    void pull();
    const t = setInterval(pull, 3000);
    return () => { alive = false; clearInterval(t); };
  }, [type, mine, meeting.id, meeting.open]);
  async function vote(choice: string) {
    setError(''); const before = mine; setMine(choice);
    const res = await fetch(`/api/meetings/${meeting.id}/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: choice }) });
    if (!res.ok) { setMine(before); setError((await res.json().catch(() => ({}))).error || 'Couldn’t send.'); return; }
    onSaved();
  }
  useEffect(() => {
    if (!meeting.open) return;
    fetch('/api/meetings/emojis', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) setClub(j.approved ?? []); }).catch(() => {});
  }, [meeting.open]);

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
          {type === 'poll' && meeting.open && (
            <div className={styles.pollChoices}>
              {(meeting.question_options ?? []).map((o) => <button key={o} type="button" className={`${styles.pollBtn} ${mine === o ? styles.pollOn : ''}`} aria-pressed={mine === o} onClick={() => void vote(o)}>{o}</button>)}
            </div>
          )}
          {type === 'rating' && meeting.open && <StarPicker value={Number(mine) || 0} onPick={(n) => void vote(String(n))} />}
          {type !== 'text' && mine && tallyNow && <ResultBars type={type} tally={tallyNow} mine={mine} />}
          {type !== 'text' && !meeting.open && mine && <p className={styles.myAnswer}><Check size={14} aria-hidden="true" /> You chose {type === 'rating' ? `${mine} star${mine === '1' ? '' : 's'}` : `“${mine}”`}</p>}
          {type === 'text' && editing && meeting.open ? (
            <form className={styles.answerForm} onSubmit={(e) => { e.preventDefault(); send(); }}>
              <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_ANSWER_LENGTH} placeholder="Your answer…" aria-label="Your answer" autoComplete="off" />
              <Button type="submit" size="sm" loading={busy} disabled={!text.trim()}><Send size={14} aria-hidden="true" /> Send</Button>
            </form>
          ) : type === 'text' && meeting.my_answer ? (
            <p className={styles.myAnswer}>
              <Check size={14} aria-hidden="true" /> “{meeting.my_answer}”
              {meeting.open && <IconButton kind="edit" size="sm" label="Edit my answer" onClick={() => setEditing(true)} />}
            </p>
          ) : null}
          {error && <Notice tone="error">{error}</Notice>}
        </div>
      )}
      {meeting.open && (
        <div className={styles.reactBar} role="group" aria-label="Send a reaction to the screen">
          <span className={styles.reactLabel}>React on the big screen</span>
          <div className={styles.reactBtns}>
            {club.length > 1 && <button type="button" className={`${styles.reactBtn} ${styles.reactDice}`} onClick={() => { const c = club[Math.floor(Math.random() * club.length)]; react(`${CUSTOM_PREFIX}${c.id}`); }} aria-label="Send a random emoji" title="Surprise me"><Dices size={22} aria-hidden="true" /></button>}
            {club.length === 0 && <p className={styles.faint}>No club emojis yet. Add one in the Emojis tab.</p>}
            {club.map((c) => {
              const key = `${CUSTOM_PREFIX}${c.id}`;
              return <button key={c.id} type="button" className={`${styles.reactBtn} ${burst === key ? styles.reactPop : ''}`} onClick={() => react(key)} aria-label={`Send ${c.name}`} title={`:${c.name}:`}><EmojiView emoji={key} custom={{ [c.id]: { name: c.name, url: c.url } }} size="1.7rem" /></button>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Everyone: their own attendance record ─────────────────────────────────────
// Everything coming up that's meant for this person (or that they planned), grouped by day.
function UpcomingPanel() {
  const [items, setItems] = useState<{ key: string; date: string; title: string; starts_at: string; ends_at: string; location: string | null; description: string | null; repeats: boolean; is_today: boolean; status: string; host_name: string | null; hosting: boolean }[] | null>(null);
  const [error, setError] = useState('');
  // Only the next few at first: a long run of weeks ahead is noise. The rest is one tap away.
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/meetings/upcoming', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) setError(json.error || 'Failed to load.'); else setItems(json.meetings);
      } catch { setError('Network error.'); }
    })();
  }, []);
  if (error) return <Notice tone="error">{error}</Notice>;
  if (!items) return <LoadingSpinner size={28} label="Loading upcoming meetings…" theme="dark" />;
  if (items.length === 0) return <div className={styles.card}><p className={styles.muted}>Nothing scheduled for you yet.</p></div>;
  return (
    <ul className={styles.stack}>
      {(showAll ? items : items.slice(0, 4)).map((m, i, shown) => (
        <Fragment key={m.key}>
        {startsWeekGroup(shown.map((x) => x.date), i) && <WeekHead date={m.date} />}
        <li data-tone={m.status === 'open' ? 'open' : m.is_today ? 'today' : WEEK_TONE[weekGroup(m.date)]} className={`${styles.meetingCard} ${m.status === 'open' ? styles.cardOpen : ''}`}>
          <div className={styles.meetingMain}>
            <span className={`${styles.dateBlock} ${m.is_today ? styles.dateToday : ''}`} aria-hidden="true">
              <small>{new Date(`${m.date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short' })}</small>
              <b>{new Date(`${m.date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', day: 'numeric' })}</b>
            </span>
            <div className={styles.meetingInfo}>
              <strong>{m.title}{m.repeats && <Repeat size={12} aria-label="Repeats weekly" className={styles.inlineIcon} />}</strong>
              <span className={styles.metaLine}>
                <span><strong className={styles.metaDay}>{m.is_today ? 'Today' : dayLabel(m.date).split(',')[0]}</strong> {timeRange(m.starts_at, m.ends_at)}</span>
                {m.location && <span><MapPin size={11} aria-hidden="true" className={styles.inlineIcon} /> {m.location}</span>}
              </span>
              {m.description && <span className={styles.descText} title={m.description}>{m.description}</span>}
              {m.hosting ? <span className={`${styles.metaLine} ${styles.metaSub}`}>You’re hosting</span> : m.host_name ? <span className={`${styles.metaLine} ${styles.metaSub}`}>Hosted by {m.host_name}</span> : null}
            </div>
            <IconButton kind="calendar" size="sm" label={`Add ${m.title} to Google Calendar`} href={googleCalendarUrl({ title: m.title, start: m.starts_at, end: m.ends_at, location: m.location, details: m.description })} />
            {m.status === 'open' && <span className={`${styles.pill} ${styles.pillOpen}`}>Check-in open</span>}
          </div>
        </li>
        </Fragment>
      ))}
      {!showAll && items.length > 4 && (
        <li><Button size="sm" variant="secondary" onClick={() => setShowAll(true)}>Show {items.length - 4} more coming up</Button></li>
      )}
    </ul>
  );
}

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
  if (data.meetings.length === 0) return <div className={styles.card}><p className={styles.muted}>No meetings yet.</p></div>;

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
              <em> · {m.attended ? `checked in ${time(m.checked_in_at!)}${m.method === 'manual' ? ' (added by exec)' : m.method === 'host' ? ' (host)' : ''}` : 'not checked in'}</em>
            </span>
            {m.doc_url && <DocButton url={m.doc_url} label="Doc" />}
          </li>
        ))}
      </ul>
    </div>
  );
}


// Who a meeting is for: the UNION of roles (everyone holding them, live), saved groups (their current
// members, live) and individually added people.
export interface Aud { roles: string[]; groups: string[]; invitees: string[] }
// Nobody is pre-selected: whoever plans it has to choose who it is for.
export const defaultAud = (): Aud => ({ roles: [], groups: [], invitees: [] });
export const audFrom = (m: { audience: string[] | null; invitees: string[] | null; group_ids: string[] | null }): Aud => ({
  roles: audienceRoles({ audience: m.audience, invitees: m.invitees, group_ids: m.group_ids }), groups: m.group_ids ?? [], invitees: m.invitees ?? [],
});
export const audPayload = (a: Aud) => ({ audience: a.roles, group_ids: a.groups, invitees: a.invitees });
export const audienceEmpty = (a: Aud) => a.roles.length === 0 && a.groups.length === 0 && a.invitees.length === 0;

function CheckTile({ checked, indeterminate, label, onChange }: { checked: boolean; indeterminate?: boolean; label: string; onChange: () => void }) {
  return (
    <label className={`${styles.check} ${checked || indeterminate ? styles.checkOn : ''}`}>
      <input type="checkbox" className={styles.checkInput} checked={checked} onChange={onChange} />
      <span className={styles.checkBox} aria-hidden="true">
        {indeterminate ? <Minus size={13} strokeWidth={3} /> : checked ? <Check size={13} strokeWidth={3} /> : null}
      </span>
      <span>{label}</span>
    </label>
  );
}

interface TeamPerson { id: string; name: string; avatar_url: string | null; custom_avatar_url: string | null; roles: string[]; role: string }
interface Group { id: string; name: string; member_ids: string[]; created_by?: string | null }
let teamCache: TeamPerson[] | null = null;
let groupsCache: Group[] | null = null;

function useTeam() {
  const [team, setTeam] = useState<TeamPerson[] | null>(teamCache);
  useEffect(() => {
    if (team) return;
    (async () => {
      try {
        const res = await fetch('/api/meetings/people', { cache: 'no-store' });
        const json = await res.json();
        if (res.ok) { teamCache = json.people; setTeam(json.people); }
      } catch { /* the list just stays empty */ }
    })();
  }, [team]);
  return team;
}
function useGroups(): [Group[] | null, () => Promise<void>] {
  const [groups, setGroups] = useState<Group[] | null>(groupsCache);
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/meetings/groups', { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) { groupsCache = json.groups; setGroups(json.groups); }
    } catch { /* keep what we have */ }
  }, []);
  useEffect(() => { load(); }, [load]);
  return [groups, load];
}

// Pick people from the team: search, "add everyone who is …" shortcuts, and a tick list. People in
// `covered` are already included another way (a ticked role or group): shown ticked and locked.
function PeoplePicker({ team, value, onChange, covered }: { team: TeamPerson[] | null; value: string[]; onChange: (ids: string[]) => void; covered?: Map<string, string> }) {
  const [query, setQuery] = useState('');
  const shown = (team ?? []).filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const addRole = (role: string) => onChange([...new Set([...value, ...(team ?? []).filter((p) => p.roles.includes(role) && !covered?.has(p.id)).map((p) => p.id)])]);
  return (
    <div className={styles.picker}>
      <div className={styles.pickTop}>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people…" aria-label="Search people" />
        <span className={styles.pickCount}><strong>{value.length}</strong> added</span>
      </div>
      <div className={styles.presets}>
        <span className={styles.faint}>Add everyone who is</span>
        {(['exec', 'lead', 'officer', 'recruit'] as const).map((r) => <button key={r} type="button" className={styles.chip} onClick={() => addRole(r)} disabled={!team}>{AUDIENCE_LABELS[r]}</button>)}
        {value.length > 0 && <button type="button" className={styles.chip} onClick={() => onChange([])}>Clear</button>}
      </div>
      {!team ? <p className={styles.faint}>Loading people…</p> : (
        <ul className={styles.pickList}>
          {shown.map((p) => {
            const via = covered?.get(p.id);
            const on = !!via || value.includes(p.id);
            return (
              <li key={p.id}>
                <label className={`${styles.pickRow} ${on ? styles.pickRowOn : ''} ${via ? styles.pickRowLocked : ''}`}>
                  <input type="checkbox" className={styles.checkInput} checked={on} disabled={!!via} onChange={() => toggle(p.id)} />
                  <span className={`${styles.checkBox} ${on ? styles.checkBoxOn : ''}`} aria-hidden="true">{on && <Check size={13} strokeWidth={3} />}</span>
                  <Avatar p={p} />
                  <span className={styles.personName}>{p.name}</span>
                  <span className={styles.pickRole}>{via ? `via ${via}` : p.role}</span>
                </label>
              </li>
            );
          })}
          {shown.length === 0 && <li className={styles.faint}>No one matches.</li>}
        </ul>
      )}
    </div>
  );
}

export function AudiencePicker({ value, onChange }: { value: Aud; onChange: (v: Aud) => void }) {
  const team = useTeam();
  const [groups] = useGroups();
  const [showPeople, setShowPeople] = useState(value.invitees.length > 0);
  const all = value.roles.length === AUDIENCE_ROLES.length;
  const toggleRole = (r: string) => onChange({ ...value, roles: value.roles.includes(r) ? value.roles.filter((x) => x !== r) : [...value.roles, r] });
  const toggleGroup = (id: string) => onChange({ ...value, groups: value.groups.includes(id) ? value.groups.filter((x) => x !== id) : [...value.groups, id] });
  // Who is already included by a ticked role or group (so the people list can show them locked).
  const covered = new Map<string, string>();
  for (const p of team ?? []) {
    const g = (groups ?? []).find((x) => value.groups.includes(x.id) && x.member_ids.includes(p.id));
    if (p.roles.some((r) => value.roles.includes(r))) covered.set(p.id, 'role');
    else if (g) covered.set(p.id, g.name);
  }
  return (
    <div className={styles.audience}>
      <div className={styles.audSection}>
        <span className={styles.audTitle}>Roles <em>everyone with the role, always up to date</em></span>
        <div className={styles.checkGrid} role="group" aria-label="Roles">
          <CheckTile label="Select all" checked={all} indeterminate={!all && value.roles.length > 0} onChange={() => onChange({ ...value, roles: all ? [] : [...AUDIENCE_ROLES] })} />
          {AUDIENCE_ROLES.map((r) => <CheckTile key={r} label={AUDIENCE_LABELS[r]} checked={value.roles.includes(r)} onChange={() => toggleRole(r)} />)}
        </div>
      </div>

      <div className={styles.audSection}>
        <span className={styles.audTitle}>Saved groups <em>pick more than one; changes to a group carry over</em></span>
        {groups && groups.length > 0 ? (
          <div className={styles.presets}>
            {groups.map((g) => (
              <button key={g.id} type="button" aria-pressed={value.groups.includes(g.id)} className={`${styles.chip} ${value.groups.includes(g.id) ? styles.chipOn : ''}`} onClick={() => toggleGroup(g.id)}>
                {g.name} · {g.member_ids.length}
              </button>
            ))}
          </div>
        ) : <p className={styles.faint}>{groups ? 'No groups yet' : 'Loading groups…'}</p>}
      </div>

      <div className={styles.audSection}>
        <button type="button" className={styles.audToggle} onClick={() => setShowPeople((v) => !v)} aria-expanded={showPeople}>
          <span className={styles.audTitle}>Add individual people <em>{value.invitees.length > 0 ? `${value.invitees.length} added` : 'optional'}</em></span>
          <span className={styles.faint}>{showPeople ? 'Hide' : 'Show'}</span>
        </button>
        {showPeople && <PeoplePicker team={team} value={value.invitees} onChange={(ids) => onChange({ ...value, invitees: ids })} covered={covered} />}
      </div>

      {audienceEmpty(value) ? <p className={styles.checkWarn}>Pick at least one role, group or person.</p> : null}
    </div>
  );
}

// ── Exec: saved groups of people ("Directors", "Marketing team") ─────────────
function GroupsPanel({ userId, canManageAll }: { userId: string; canManageAll: boolean }) {
  const team = useTeam();
  const [groups, reload] = useGroups();
  const [editing, setEditing] = useState<{ id: string | null; name: string; ids: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const nameOf = (id: string) => team?.find((p) => p.id === id)?.name ?? 'Someone';

  async function save() {
    if (!editing) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(editing.id ? `/api/meetings/groups/${editing.id}` : '/api/meetings/groups', {
        method: editing.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editing.name, member_ids: editing.ids }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || 'Failed to save.'); return; }
      setEditing(null);
      await reload();
    } finally { setBusy(false); }
  }
  async function remove(g: Group) {
    if (!(await confirmHold({ title: `Delete “${g.name}”?`, message: 'Meetings already scheduled for this group keep their invited people.', confirmLabel: 'Hold to delete' }))) return;
    await fetch(`/api/meetings/groups/${g.id}`, { method: 'DELETE' });
    reload();
  }

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <p className={styles.muted}>Groups to invite in one go.</p>
        {!editing && <Button size="sm" onClick={() => setEditing({ id: null, name: '', ids: [] })}><Plus size={14} aria-hidden="true" /> New group</Button>}
      </div>

      {editing && (
        <div className={styles.form}>
          <Field label="Group name"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Directors, Marketing team" maxLength={60} autoFocus /></Field>
          <PeoplePicker team={team} value={editing.ids} onChange={(ids) => setEditing({ ...editing, ids })} />
          {error && <Notice tone="error">{error}</Notice>}
          <div className={styles.formActions}>
            <Button variant="ghost" onClick={() => { setEditing(null); setError(''); }}>Cancel</Button>
            <Button onClick={save} loading={busy} disabled={!editing.name.trim() || editing.ids.length === 0}>{editing.id ? 'Save group' : 'Create group'}</Button>
          </div>
        </div>
      )}

      {!groups ? <LoadingSpinner size={28} label="Loading groups…" theme="dark" /> : groups.length === 0 && !editing ? (
        <div className={styles.card}><p className={styles.muted}>No groups yet.</p></div>
      ) : (
        <ul className={styles.meetingList}>
          {groups.map((g) => (
            <li key={g.id} className={styles.meetingCard}>
              <div className={styles.meetingMain}>
                <div className={styles.meetingInfo}>
                  <strong>{g.name} <span className={styles.muted}>· {g.member_ids.length} {g.member_ids.length === 1 ? 'person' : 'people'}</span></strong>
                  <span className={styles.muted}>{g.member_ids.slice(0, 6).map(nameOf).join(', ')}{g.member_ids.length > 6 ? ` +${g.member_ids.length - 6} more` : ''}</span>
                </div>
                {(canManageAll || g.created_by === userId) ? (
                  <>
                    <IconButton kind="edit" label={`Edit ${g.name}`} onClick={() => { setEditing({ id: g.id, name: g.name, ids: [...g.member_ids] }); setError(''); }} />
                    <IconButton kind="delete" label={`Delete ${g.name}`} onClick={() => remove(g)} />
                  </>
                ) : <span className={styles.faint}>made by someone else</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Exec: schedule meetings, then open one to run its check-in ────────────────
function RunPanel({ initial, showForm, onShowForm }: { initial: string | null; showForm: boolean; onShowForm: (v: boolean) => void }) {
  const [selected, setSelected] = useState<string | null>(initial);
  if (selected) return <LiveMeeting id={selected} onBack={() => setSelected(null)} />;
  return <MeetingList onOpen={setSelected} showForm={showForm} onShowForm={onShowForm} />;
}

function MeetingList({ onOpen, showForm, onShowForm }: { onOpen: (id: string) => void; showForm: boolean; onShowForm: (v: boolean) => void }) {
  const [data, setData] = useState<{ series: Series[]; upcoming: Item[]; past: Item[] } | null>(null);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const setShowForm = onShowForm;
  const [editingSeries, setEditingSeries] = useState<string | null>(null);

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
  async function remove(item: Item) {
    if (!item.meeting_id) return;
    const stillComes = item.repeats && item.date >= pacificToday();
    const msg = `${item.count > 0 ? `This also deletes its ${item.count} check-in${item.count === 1 ? '' : 's'} from the attendance records. ` : ''}${stillComes ? 'It repeats weekly, so it will reappear on the list as scheduled; use Skip to keep it off. ' : ''}${item.status === 'open' ? 'Check-in is open right now. ' : ''}This can’t be undone.`;
    if (!(await confirmHold({ title: `Delete ${item.title} on ${dayLabel(item.date)}?`, message: msg, confirmLabel: 'Hold to delete' }))) return;
    setBusyKey(item.key); setError('');
    const res = await fetch(`/api/meetings/${item.meeting_id}`, { method: 'DELETE' });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error || 'Failed to delete.');
    setBusyKey(null); load();
  }
  async function saveDoc(item: Item, f: DetailsFields): Promise<boolean> {
    // The question is locked once check-in has been opened; leave it out so an unrelated edit can't trip that.
    // Title only changes for one-off meetings (a repeating meeting keeps its name every week).
    const fields = {
      doc_url: f.doc, ...(item.status === 'open' ? {} : qPayload(f.q)), location: f.location, description: f.description,
      ...(item.repeats ? {} : { title: f.title }), start: f.start, end: f.end, ...audPayload(f.audience),
    };
    const r = await post('/api/meetings/update', item.meeting_id ? { meeting_id: item.meeting_id, ...fields } : { series_id: item.series_id, date: item.date, ...fields }, item.key);
    if (r.ok) load();
    return r.ok;
  }
  async function patchSeries(s: Series, body: Record<string, unknown>): Promise<boolean> {
    setBusyKey(s.id); setError('');
    const res = await fetch(`/api/meetings/series/${s.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error || 'Failed.');
    setBusyKey(null); load();
    return res.ok;
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
        <p className={styles.muted}>Open a meeting on its day for its code.</p>
      </div>
      {showForm && <ScheduleForm onCreated={() => { setShowForm(false); load(); }} />}
      {error && <Notice tone="error">{error}</Notice>}

      <section>
        <h3 className={styles.listTitle}>Upcoming <span>next 2 weeks</span></h3>
        {data.upcoming.length === 0 ? <p className={styles.muted}>Nothing scheduled.</p> : (
          <ul className={styles.meetingList}>
            {/* A repeating meeting's week keeps the same key before and after its row exists, so an open Details panel survives the first save. */}
            {data.upcoming.map((it, i) => (<Fragment key={it.series_id ? `${it.series_id}|${it.date}` : it.key}>{startsWeekGroup(data.upcoming.map((x) => x.date), i) && <WeekHead date={it.date} />}<MeetingCard item={it} busy={busyKey === it.key} onStart={() => start(it)} onView={() => it.meeting_id && onOpen(it.meeting_id)} onCancel={(undo) => cancel(it, undo)} onSaveDoc={(f) => saveDoc(it, f)} onDelete={() => remove(it)} onChanged={load} /></Fragment>))}
          </ul>
        )}
      </section>

      <section>
        <h3 className={styles.listTitle}>Repeating meetings</h3>
        {data.series.length === 0 ? <p className={styles.muted}>None yet.</p> : (
          <ul className={styles.people}>
            {data.series.map((s) => (
              <li key={s.id} className={`${styles.seriesRow} ${s.active ? '' : styles.paused}`}>
                <Repeat size={16} aria-hidden="true" className={styles.seriesIcon} />
                <span className={styles.personName}>
                  {s.title}
                  <em> · every {WEEKDAYS[s.weekday]} {hhmmLabel(s.start_time)}–{hhmmLabel(s.end_time)}{s.location ? ` · ${s.location}` : ''}{s.ends_on ? ` · until ${new Date(`${s.ends_on}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })}` : ''} · {audienceLabel(s)}{s.active ? '' : ' · paused'}</em>
                </span>
                <IconButton kind="edit" label={`Edit ${s.title}`} onClick={() => setEditingSeries(editingSeries === s.id ? null : s.id)} />
                <IconButton kind={s.active ? 'pause' : 'play'} label={s.active ? `Pause ${s.title}` : `Resume ${s.title}`} onClick={() => patchSeries(s, { active: !s.active })} disabled={busyKey === s.id} />
                <IconButton kind="delete" label={`Delete ${s.title}`} onClick={() => deleteSeries(s)} disabled={busyKey === s.id} />
                {editingSeries === s.id && (
                  <SeriesEditForm
                    series={s}
                    busy={busyKey === s.id}
                    onCancel={() => setEditingSeries(null)}
                    onSave={async (body) => { const ok = await patchSeries(s, body); if (ok) setEditingSeries(null); }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.past.length > 0 && (
        <section>
          <h3 className={styles.listTitle}>Recent <span>last 30 days</span></h3>
          <ul className={styles.meetingList}>
            {data.past.map((it) => <MeetingCard key={it.key} item={it} busy={false} onStart={() => {}} onView={() => it.meeting_id && onOpen(it.meeting_id)} onCancel={() => {}} onSaveDoc={async () => false} onDelete={() => remove(it)} past />)}
          </ul>
        </section>
      )}
    </div>
  );
}

// Edit a repeating meeting itself: its name, day, times, room, description, doc and who it's for.
function SeriesEditForm({ series: s, busy, onSave, onCancel }: { series: Series; busy: boolean; onSave: (body: Record<string, unknown>) => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState(s.title);
  const [weekday, setWeekday] = useState(String(s.weekday));
  const [start, setStart] = useState(s.start_time.slice(0, 5));
  const [end, setEnd] = useState(s.end_time.slice(0, 5));
  const [room, setRoom] = useState(s.location ?? '');
  const [desc, setDesc] = useState(s.description ?? '');
  const [doc, setDoc] = useState(s.doc_url ?? '');
  const [endsOn, setEndsOn] = useState(s.ends_on ?? '');
  const [audience, setAudience] = useState<Aud>(audFrom(s));
  const bad = !title.trim() || end <= start || audienceEmpty(audience);
  return (
    <form
      className={`${styles.detailsForm} ${styles.seriesForm}`}
      onSubmit={(e) => { e.preventDefault(); void onSave({ title, weekday: Number(weekday), start, end, location: room, description: desc, doc_url: doc, ends_on: endsOn || null, ...audPayload(audience) }); }}
    >
      <p className={styles.faint}>Applies to the series and coming weeks. A week you edited on its own keeps its changes.</p>
      <div className={styles.formGrid}>
        <Field label="Name"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} required /></Field>
        <Field label="Day of the week"><Select value={weekday} onChange={(e) => setWeekday(e.target.value)}>{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</Select></Field>
        <Field label="Starts"><TimeInput value={start} onChange={(e) => setStart(e.target.value)} required /></Field>
        <Field label="Ends"><TimeInput value={end} onChange={(e) => setEnd(e.target.value)} required /></Field>
      </div>
      <Field label="Room" hint="The default for every week."><Input value={room} onChange={(e) => setRoom(e.target.value)} maxLength={80} placeholder="e.g. Price Center East" /></Field>
      <Field label="Last meeting on (optional)" hint="After this day it stops showing up in the portal, the portal calendar and Google Calendar. Blank means it keeps going."><DateInput value={endsOn} min={pacificToday()} onChange={(e) => setEndsOn(e.target.value)} /></Field>
      <Field label="What's this meeting about? (optional)"><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={MAX_DESCRIPTION_LENGTH} rows={2} /></Field>
      <Field label="Meeting doc link"><Input value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="https://docs.google.com/…" inputMode="url" /></Field>
      <div className={styles.audienceField}><span className={styles.audienceTitle}>Who is it for?</span><AudiencePicker value={audience} onChange={setAudience} /></div>
      <SeriesExcused seriesId={s.id} />
      {end <= start && <p className={styles.checkWarn}>Pick an end time after the start.</p>}
      <div className={styles.formActions}>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" loading={busy} disabled={bad}>Save changes</Button>
      </div>
    </form>
  );
}

interface DetailsFields { doc: string; q: QState; audience: Aud; location: string; description: string; title: string; start: string; end: string }

function MeetingCard({ item, busy, past, onStart, onView, onCancel, onSaveDoc, onDelete, onChanged }: {
  item: Item; busy: boolean; past?: boolean; onChanged?: () => void;
  onStart: () => void; onView: () => void; onCancel: (undo: boolean) => void; onSaveDoc: (f: DetailsFields) => Promise<boolean>; onDelete: () => void;
}) {
  const [editingDoc, setEditingDoc] = useState(false);
  const [doc, setDoc] = useState(item.doc_url ?? '');
  const [q, setQ] = useState<QState>(qFrom(item));
  const [audience, setAudience] = useState<Aud>(audFrom(item));
  const [room, setRoom] = useState(item.location ?? '');
  const [desc, setDesc] = useState(item.description ?? '');
  const [title, setTitle] = useState(item.title);
  const [startT, setStartT] = useState(pacificHHMM(item.starts_at));
  const [endT, setEndT] = useState(pacificHHMM(item.ends_at));
  const status = item.status;
  // The clock decides what to say: an exec can open check-in early, but members only get in from
  // 10 minutes before the start, so "Open now" means members can actually check in right now.
  const now = useNow();
  const opensAt = new Date(item.starts_at).getTime() - 10 * 60_000;
  const label =
    status === 'cancelled' ? 'Skipped'
    : status === 'closed' ? `${item.count} checked in`
    : status === 'open' ? (now >= opensAt ? 'Check-in open' : `Opens ${time(new Date(opensAt).toISOString())}`)
    : item.is_today ? (now > new Date(item.ends_at).getTime() + 30 * 60_000 ? 'Not held' : now >= opensAt ? 'Ready to open' : `Today ${time(item.starts_at)}`)
    : 'Scheduled';

  return (
    <li data-tone={status === 'cancelled' ? 'off' : status === 'open' ? 'open' : past ? 'done' : item.is_today ? 'today' : WEEK_TONE[weekGroup(item.date)]} className={`${styles.meetingCard} ${status === 'open' ? styles.cardOpen : ''} ${status === 'cancelled' ? styles.paused : ''}`}>
      <div className={styles.meetingMain}>
        <span className={`${styles.dateBlock} ${item.is_today ? styles.dateToday : ''}`} aria-hidden="true">
          <small>{new Date(`${item.date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short' })}</small>
          <b>{new Date(`${item.date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', day: 'numeric' })}</b>
        </span>
        <div className={styles.meetingInfo}>
          <strong>{item.title}{item.repeats && <Repeat size={12} aria-label="Repeats weekly" className={styles.inlineIcon} />}</strong>
          <span className={styles.metaLine}>
            <span><strong className={styles.metaDay}>{item.is_today ? 'Today' : new Date(`${item.date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short' })}</strong> {timeRange(item.starts_at, item.ends_at)}</span>
            {item.location && <span><MapPin size={11} aria-hidden="true" className={styles.inlineIcon} /> {item.location}</span>}
          </span>
          <span className={`${styles.metaLine} ${styles.metaSub}`} title={item.description ?? undefined}>
            <span className={styles.metaAudience} title={`For: ${audienceLabel(item)}`}><Users size={11} aria-hidden="true" /> {audienceLabel(item)}</span>
            {item.doc_url && <span className={styles.metaDoc}><Link2 size={11} aria-hidden="true" /> Doc</span>}
            {item.question && <span className={styles.metaDoc}><MessageCircleQuestion size={11} aria-hidden="true" /> Question</span>}
            {item.description && <span className={styles.metaDoc}><FileText size={11} aria-hidden="true" /> Description</span>}
            {(item.absent ?? 0) > 0 && <span className={styles.metaAway} title="People who said they can't make it"><UserX size={11} aria-hidden="true" /> {item.absent} away</span>}
            {item.host_name && <span className={styles.metaHost}>Created by {item.host_name}</span>}
          </span>
        </div>
        <span className={`${styles.pill} ${status === 'open' && now >= opensAt ? styles.pillOpen : status === 'closed' ? styles.pillDone : ''}`}>{label}</span>
        <div className={styles.cardActions}>
          {!past && (status === 'open' ? (
            <Button size="sm" onClick={onView}><Radio size={14} aria-hidden="true" /> Show code</Button>
          ) : status === 'cancelled' ? (
            <Button size="sm" variant="secondary" onClick={() => onCancel(true)} loading={busy}><RotateCcw size={14} aria-hidden="true" /> Restore</Button>
          ) : item.is_today ? (
            <Button size="sm" onClick={onStart} loading={busy}>{status === 'closed' ? 'Re-open' : 'Start check-in'}</Button>
          ) : null)}
          {(past || status === 'closed') && item.meeting_id && <Button size="sm" variant="secondary" onClick={onView}>Attendance</Button>}
          {!past && status !== 'cancelled' && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setEditingDoc((v) => !v)}><FileText size={14} aria-hidden="true" /> Details</Button>
              {status === 'scheduled' && item.repeats && <Button size="sm" variant="secondary" onClick={() => onCancel(false)}><SkipForward size={14} aria-hidden="true" /> Skip</Button>}
            </>
          )}
          {/* One-off meetings only. A repeating meeting's weeks use Skip (or delete the whole repeating meeting). */}
          {item.meeting_id && !item.repeats && (
            <IconButton kind="delete" label={`Delete ${item.title} on ${dayLabel(item.date)}`} onClick={onDelete} disabled={busy} />
          )}
        </div>
      </div>
      {editingDoc && (
        <form className={styles.detailsForm} onSubmit={async (e) => { e.preventDefault(); if (await onSaveDoc({ doc, q, audience, location: room, description: desc, title, start: startT, end: endT })) setEditingDoc(false); }}>
          {!item.repeats && <Field label="Name"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} required /></Field>}
          <div className={styles.formGrid}>
            <Field label="Starts"><TimeInput value={startT} onChange={(e) => setStartT(e.target.value)} required /></Field>
            <Field label="Ends"><TimeInput value={endT} onChange={(e) => setEndT(e.target.value)} required /></Field>
          </div>
          <Field label="What's this meeting about? (optional)" hint="A line or two. Members see it when they check in."><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={MAX_DESCRIPTION_LENGTH} rows={2} placeholder="e.g. Planning the Halloween LAN: roles, budget and timeline." /></Field>
          <Field label="Room for this meeting" hint="Only changes this one meeting."><Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Price Center East" maxLength={80} /></Field>
          <Field label="Meeting doc link"><Input value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="https://docs.google.com/… or /portal?section=docs" inputMode="url" /></Field>
          <Field label="Question of the meeting" hint={status === 'open' ? 'Locked while check-in is open.' : undefined}>
            <QuestionEditor value={q} onChange={setQ} disabled={status === 'open'} />
          </Field>
          <div className={styles.audienceField}><span className={styles.audienceTitle}>Who is it for?</span><AudiencePicker value={audience} onChange={setAudience} /></div>
          <div className={styles.formActions}><Button type="submit" size="sm" loading={busy} disabled={audienceEmpty(audience) || qBad(q)}>Save</Button></div>
        </form>
      )}
      {editingDoc && !past && <AdvanceAbsences item={item} onChanged={onChanged} />}
    </li>
  );
}

// "Can't make it": a host records ahead of time that someone is away (with a reason), before check-in ever opens. Works
// for repeating meetings too (that week's meeting is created on the first one). Excused absences don't count against them.
function AdvanceAbsences({ item, onChanged }: { item: Item; onChanged?: () => void }) {
  const ref = item.meeting_id ? { meeting_id: item.meeting_id } : { series_id: item.series_id, date: item.date };
  const qs = item.meeting_id ? `meeting_id=${item.meeting_id}` : `series_id=${item.series_id}&date=${item.date}`;
  const [data, setData] = useState<{ people: { id: string; name: string }[]; repeating?: boolean; absences: { user_id: string; name: string; reason: string | null; excused: boolean; every_week?: boolean; from_plan?: boolean }[] } | null>(null);
  const [who, setWho] = useState('');
  const [reason, setReason] = useState('');
  const [excused, setExcused] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/meetings/absence?${qs}`, { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) setData(json); else setError(json.error || 'Failed to load.');
    } catch { setError('Network error.'); }
  }, [qs]);
  useEffect(() => { void load(); }, [load]);
  async function add() {
    if (!who) return;
    setBusy(true); setError('');
    const res = await fetch('/api/meetings/absence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...ref, user_id: who, reason, excused }) });
    setBusy(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error || 'Failed.'); return; }
    setWho(''); setReason(''); setExcused(true);
    await load(); onChanged?.();
  }
  async function remove(userId: string, repeat = false) {
    setError('');
    const res = await fetch('/api/meetings/absence', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...ref, user_id: userId, repeat }) });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error || 'Failed.');
    await load(); onChanged?.();
  }
  const away = new Set((data?.absences ?? []).map((a) => a.user_id));
  return (
    <section className={styles.advanceAbsences} aria-label="Can't make it">
      <h4 className={styles.audienceTitle}><UserX size={13} aria-hidden="true" /> Can’t make it</h4>
      {error && <Notice tone="error">{error}</Notice>}
      {!data ? <p className={styles.faint}>Loading…</p> : (
        <>
          {data.absences.length > 0 && (
            <ul className={styles.absentList}>
              {data.absences.map((a) => (
                <li key={a.user_id}>
                  <span className={styles.personName}>{a.name}{a.every_week && <Repeat size={12} aria-label="Every week" className={styles.everyWeek} />}<em> · {a.excused ? 'excused' : 'absent'}{a.every_week ? ' every week' : ''}{a.reason ? `: ${a.reason}` : ''}</em></span>
                  <IconButton kind="remove" label={a.every_week ? `Take ${a.name} off just this week` : `Take ${a.name} off the absent list`} onClick={() => remove(a.user_id)} />
                </li>
              ))}
            </ul>
          )}
          <div className={styles.absentForm}>
            <Select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Who can't make it">
              <option value="">Who can’t make it?</option>
              {data.people.filter((p) => !away.has(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={140} placeholder="Reason (optional)" aria-label="Reason" />
            <CheckTile label="Excused" checked={excused} onChange={() => setExcused((v) => !v)} />
            <Button size="sm" onClick={add} loading={busy} disabled={!who}>Mark away</Button>
          </div>
          <p className={styles.faint}>Excused doesn’t count against attendance.{data.repeating && ' To excuse someone every week, edit the repeating meeting under Repeating meetings.'}</p>
        </>
      )}
    </section>
  );
}

// Excused every week: someone who can't make this repeating meeting for as long as it repeats. Applies at once (not part of "Save changes").
function SeriesExcused({ seriesId }: { seriesId: string }) {
  const base = `/api/meetings/series/${seriesId}/excused`;
  const [data, setData] = useState<{ people: { id: string; name: string }[]; excused: { user_id: string; name: string; reason: string | null; excused: boolean; from_plan: boolean }[] } | null>(null);
  const [who, setWho] = useState('');
  const [reason, setReason] = useState('');
  const [excused, setExcused] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const res = await fetch(base, { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) setData(json); else setError(json.error || 'Failed to load.');
    } catch { setError('Network error.'); }
  }, [base]);
  useEffect(() => { void load(); }, [load]);
  async function call(method: 'POST' | 'DELETE', body: Record<string, unknown>) {
    setBusy(true); setError('');
    const res = await fetch(base, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error || 'Failed.'); return false; }
    await load(); return true;
  }
  const away = new Set((data?.excused ?? []).map((a) => a.user_id));
  return (
    <section className={styles.advanceAbsences} aria-label="Excused every week">
      <h4 className={styles.audienceTitle}><UserX size={13} aria-hidden="true" /> Excused every week</h4>
      {error && <Notice tone="error">{error}</Notice>}
      {!data ? <p className={styles.faint}>Loading…</p> : (
        <>
          {data.excused.length > 0 && (
            <ul className={styles.absentList}>
              {data.excused.map((a) => (
                <li key={a.user_id}>
                  <span className={styles.personName}>{a.name}<Repeat size={12} aria-hidden="true" className={styles.everyWeek} /><em> · {a.excused ? 'excused' : 'absent'}{a.reason ? `: ${a.reason}` : ''}</em></span>
                  {!a.from_plan && <IconButton kind="remove" label={`Stop excusing ${a.name} every week`} onClick={() => void call('DELETE', { user_id: a.user_id })} disabled={busy} />}
                </li>
              ))}
            </ul>
          )}
          <div className={styles.absentForm}>
            <Select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Who to excuse every week">
              <option value="">Who can’t make it?</option>
              {data.people.filter((p) => !away.has(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={140} placeholder="Reason (optional)" aria-label="Reason" />
            <CheckTile label="Excused" checked={excused} onChange={() => setExcused((v) => !v)} />
            <Button type="button" size="sm" loading={busy} disabled={!who} onClick={async () => { if (await call('POST', { user_id: who, reason, excused })) { setWho(''); setReason(''); setExcused(true); } }}>Add</Button>
          </div>
          <p className={styles.faint}>Lasts as long as the meeting repeats. Weeks already opened keep their marks.</p>
        </>
      )}
    </section>
  );
}

// Shrinks a picked picture in the browser (256px square WebP) so any normal photo fits. A GIF keeps its animation if it is small enough to send;
// a bigger one becomes a still picture (the first frame) rather than being refused.
async function prepareEmojiFile(file: File): Promise<{ file: File; note: string }> {
  if (file.type === 'image/gif' && file.size <= MAX_EMOJI_BYTES) return { file, note: '' };
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height), size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { file, note: '' };
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.88));
  if (!blob) return { file, note: '' };
  const out = new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' });
  const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  return { file: out, note: file.type === 'image/gif' ? `That GIF was too big to keep moving, so it became a still picture (${kb(out.size)}).` : file.size > 200 * 1024 ? `Shrunk from ${kb(file.size)} to ${kb(out.size)}.` : '' };
}

// The club's custom emojis: upload one (it waits for an exec to approve it), see the approved ones, and for exec/admin the review queue.
function EmojiPanel() {
  const [data, setData] = useState<{ manage: boolean; approved: CustomEmoji[]; mine: CustomEmoji[]; queue: CustomEmoji[] } | null>(null);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const load = useCallback(async () => {
    try { const r = await fetch('/api/meetings/emojis', { cache: 'no-store' }); const j = await r.json(); if (r.ok) setData(j); else setError(j.error || 'Failed to load.'); } catch { setError('Network error.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const clean = name.trim().toLowerCase().replace(/^:|:$/g, '');
  const [prepNote, setPrepNote] = useState('');
  const [discord, setDiscord] = useState('');
  const dEmoji = parseDiscordEmoji(discord);
  function onDiscord(v: string) {
    setDiscord(v); setError('');
    const d = parseDiscordEmoji(v);
    if (d) { setFile(null); setPrepNote(''); if (d.name && !name.trim()) setName(emojiNameFrom(d.name)); }
  }
  const tooBig = !!file && file.size > MAX_EMOJI_BYTES;
  async function pick(f: File | null) {
    setError(''); setPrepNote('');
    if (!f) { setFile(null); return; }
    if (f.size > MAX_EMOJI_PICK_BYTES) { setFile(null); setError('That file is huge. Pick one under 30 MB.'); return; }
    try { const p = await prepareEmojiFile(f); setFile(p.file); setPrepNote(p.note); } catch { setFile(null); setError('Couldn’t read that image.'); }
  }
  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file && !dEmoji) return;
    setBusy('upload'); setError(''); setNote('');
    const fd = new FormData(); if (dEmoji) fd.append('discord', discord.trim()); else if (file) fd.append('file', file); fd.append('name', clean);
    const r = await fetch('/api/meetings/emojis', { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy('');
    if (!r.ok) { setError(j.error || 'Couldn’t upload.'); return; }
    setName(''); setFile(null); setDiscord(''); setPrepNote(''); setNote(j.approved ? 'Added. It’s live now.' : 'Sent. It shows up once an exec approves it.');
    await load();
  }
  async function act(id: string, method: 'PATCH' | 'DELETE') {
    setBusy(id); setError('');
    const r = await fetch(`/api/meetings/emojis/${id}`, { method });
    setBusy('');
    if (!r.ok) setError((await r.json().catch(() => ({}))).error || 'Failed.');
    await load();
  }
  const tile = (e: CustomEmoji, actions?: React.ReactNode) => (
    <li key={e.id} className={styles.emojiTile}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={e.url} alt="" className={styles.emojiThumb} />
      <span>:{e.name}:</span>
      {actions}
    </li>
  );
  if (!data) return error ? <Notice tone="error">{error}</Notice> : <LoadingSpinner size={28} label="Loading…" theme="dark" />;
  return (
    <div className={styles.stack}>
      {error && <Notice tone="error">{error}</Notice>}
      {note && <Notice tone="success">{note}</Notice>}
      <form className={styles.emojiForm} onSubmit={upload} onPaste={(e) => { const f = [...e.clipboardData.files].find((x) => x.type.startsWith('image/')); if (f) { e.preventDefault(); setDiscord(''); void pick(f); } }}>
        <h2 className={styles.sectionHead}>Add an emoji</h2>
        <p className={styles.faint}>Square images work best. PNG, JPG, GIF or WebP, any size. It’s shrunk to a small square automatically. {data.manage ? 'Yours goes live straight away.' : 'An exec approves it before anyone sees it.'}</p>
        <div className={styles.emojiRow}>
          <Input value={discord} onChange={(e) => onDiscord(e.target.value)} placeholder="Paste a Discord emoji (or its link)" aria-label="Discord emoji" autoComplete="off" />
          {dEmoji && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`https://cdn.discordapp.com/emojis/${dEmoji.id}.${dEmoji.animated ? 'gif' : 'png'}?size=64`} alt="" className={styles.emojiThumb} />
          )}
        </div>
        {discord.trim() && !dEmoji && <p className={styles.checkWarn}>That doesn’t look like a Discord emoji. Copy the emoji’s link, or type it as {'<:name:123…>'}.</p>}
        <p className={styles.faint}>In Discord: right-click a custom emoji, Copy Link, and paste it above. You can also paste a copied picture anywhere in this box.</p>
        <div className={styles.emojiRow}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="name, like pog_face" maxLength={22} aria-label="Emoji name" autoComplete="off" />
          <label className={styles.filePick}><Upload size={14} aria-hidden="true" /> {file ? file.name : 'Choose image'}<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(e) => void pick(e.target.files?.[0] ?? null)} hidden /></label>
          <Button type="submit" size="sm" loading={busy === 'upload'} disabled={(!file && !dEmoji) || tooBig || !EMOJI_NAME.test(clean)}>Upload</Button>
        </div>
        {prepNote && <p className={styles.faint}>{prepNote}</p>}
        {tooBig && <p className={styles.checkWarn}>That image is still too big to send.</p>}
        {name && !EMOJI_NAME.test(clean) && <p className={styles.checkWarn}>Use 2 to 20 letters, numbers or underscores.</p>}
      </form>
      {data.manage && data.queue.length > 0 && (
        <div>
          <h2 className={styles.sectionHead}>Waiting for approval <span>{data.queue.length}</span></h2>
          <ul className={styles.emojiGrid}>{data.queue.map((e) => tile(e, <span className={styles.emojiActions}><Button size="sm" loading={busy === e.id} onClick={() => void act(e.id, 'PATCH')}>Approve</Button><IconButton kind="delete" size="sm" label={`Reject ${e.name}`} onClick={() => void act(e.id, 'DELETE')} /></span>))}</ul>
        </div>
      )}
      {!data.manage && data.mine.length > 0 && (
        <div>
          <h2 className={styles.sectionHead}>Your emojis waiting for approval</h2>
          <ul className={styles.emojiGrid}>{data.mine.map((e) => tile(e, <IconButton kind="delete" size="sm" label={`Withdraw ${e.name}`} onClick={() => void act(e.id, 'DELETE')} />))}</ul>
        </div>
      )}
      <div>
        <h2 className={styles.sectionHead}>Club emojis <span>{data.approved.length}</span></h2>
        {data.approved.length === 0 ? <p className={styles.muted}>None yet. Be the first.</p> : (
          <ul className={styles.emojiGrid}>{data.approved.map((e) => tile(e, data.manage ? <IconButton kind="delete" size="sm" label={`Remove ${e.name}`} onClick={async () => { if (await confirmHold({ title: `Remove :${e.name}:?`, message: 'It disappears for everyone. Reactions already sent with it stop showing the picture.', confirmLabel: 'Hold to remove' })) await act(e.id, 'DELETE'); }} /> : null))}</ul>
        )}
      </div>
    </div>
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
  const [endsOn, setEndsOn] = useState('');
  const [q, setQ] = useState<QState>(emptyQ);
  const [description, setDescription] = useState('');
  const [audience, setAudience] = useState<Aud>(defaultAud());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/meetings/schedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, repeat, weekday: Number(weekday), date, start, end, location, doc_url: doc, ...qPayload(q), description, ends_on: repeat === 'weekly' ? endsOn || null : null, ...audPayload(audience) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || 'Failed to schedule.'); return; }
      onCreated();
    } finally { setBusy(false); }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <Button size="sm" variant="secondary" className={styles.presetBtn} onClick={() => { setTitle('Gen Meeting'); setRepeat('weekly'); setWeekday('5'); setStart('17:00'); setEnd('18:00'); }}>
        <Repeat size={14} aria-hidden="true" /> Use the Gen Meeting setup (every Friday, 5–6 PM)
      </Button>
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
          <Field label="Date"><DateInput value={date} min={pacificToday()} onChange={(e) => setDate(e.target.value)} required /></Field>
        )}
        <Field label="Starts"><TimeInput value={start} onChange={(e) => setStart(e.target.value)} required /></Field>
        <Field label="Ends"><TimeInput value={end} onChange={(e) => setEnd(e.target.value)} required /></Field>
        {repeat === 'weekly' && <Field label="Last meeting on (optional)" hint="Blank means it keeps going until you stop it."><DateInput value={endsOn} min={pacificToday()} onChange={(e) => setEndsOn(e.target.value)} /></Field>}
        <Field label={repeat === 'weekly' ? 'Usual room (optional)' : 'Room (optional)'} hint={repeat === 'weekly' ? 'Just the default — change the room for any single week from its Details.' : undefined}><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Price Center East" maxLength={80} /></Field>
      </div>
      <Field label="What's this meeting about? (optional)" hint="A line or two. Members see it when they check in."><Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={MAX_DESCRIPTION_LENGTH} rows={2} placeholder="e.g. Planning the Halloween LAN: roles, budget and timeline." /></Field>
      <Field label="Meeting doc link (optional)" hint="Shown to people after they check in. For a repeating meeting this is the default; change it for any single week."><Input value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="https://docs.google.com/…" inputMode="url" /></Field>
      <div className={styles.audienceField}><span className={styles.audienceTitle}>Who is it for?</span><AudiencePicker value={audience} onChange={setAudience} /></div>
      {repeat === 'once' && (
        <Field label="Question of the meeting (optional)" hint="An icebreaker people answer after checking in. You can also set it on the day.">
          <QuestionEditor value={q} onChange={setQ} placeholder="What game have you put the most hours into?" />
        </Field>
      )}
      <p className={styles.faint}>Times are Pacific. Repeating meetings appear two weeks ahead.</p>
      {error && <Notice tone="error">{error}</Notice>}
      <div className={styles.formActions}><Button type="submit" loading={busy} disabled={audienceEmpty(audience)}>{repeat === 'weekly' ? 'Schedule weekly meeting' : 'Schedule meeting'}</Button></div>
    </form>
  );
}

// ── One specific meeting: its code and who's in ───────────────────────────────
function LiveMeeting({ id, onBack }: { id: string; onBack: () => void }) {
  const [live, setLive] = useState<Live | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [presenting, setPresenting] = useState(false);
  const labelRef = useRef<HTMLSpanElement>(null);
  const codeRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const totalsRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState<string | null>(null);
  const [docSaved, setDocSaved] = useState(false);
  const [q, setQ] = useState<QState>(emptyQ);
  const [questionSaved, setQuestionSaved] = useState(false);
  const [fire, setFire] = useState(0);
  const prevHere = useRef<number | null>(null);
  const [bigBurst, setBigBurst] = useState<{ key: number; emoji: string } | null>(null);
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
      if (!fieldsInit.current) { fieldsInit.current = true; setDoc(json.meeting.doc_url ?? ''); setQ(qFrom(json.meeting)); }
      afterRef.current = json.lastReactionId;
      // The moment everyone expected has checked in: confetti.
      const here = json.attendees.length, total = here + json.missing.length;
      if (prevHere.current !== null && prevHere.current < total && here >= total && total > 1) setFire(Date.now());
      prevHere.current = here;
      if (json.reactions.length) {
        const fresh = json.reactions.map((r, i) => ({ key: `r${r.id}`, emoji: r.emoji, left: 8 + Math.random() * 84, delay: i * 0.18 }));
        setFloaters((f) => [...f, ...fresh].slice(-60));
        setTimeout(() => setFloaters((f) => f.filter((x) => !fresh.some((n) => n.key === x.key))), 4200 + fresh.length * 180);
        // Lots of the same emoji at once: it explodes across the screen.
        const counts: Record<string, number> = {};
        for (const r of json.reactions) counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        if (top && top[1] >= 4) { const key = Date.now(); setBigBurst({ key, emoji: top[0] }); setTimeout(() => setBigBurst((b) => (b?.key === key ? null : b)), 1800); }
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
  async function markAbsent(p: Person, reason: string, excused: boolean) {
    await fetch(`/api/meetings/${id}/absence`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: p.id, reason, excused }) });
    loadLive();
  }
  async function clearAbsent(p: Person) {
    await fetch(`/api/meetings/${id}/absence`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: p.id }) });
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

  async function deleteMeeting() {
    if (!live) return;
    const n = live.attendees.length;
    if (!(await confirmHold({ title: `Delete ${live.meeting.title}?`, message: `${n ? `This also deletes its ${n} check-in${n === 1 ? '' : 's'} from the attendance records. ` : ''}This can’t be undone.`, confirmLabel: 'Hold to delete' }))) return;
    const res = await fetch(`/api/meetings/${id}`, { method: 'DELETE' });
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error || 'Failed to delete.'); return; }
    onBack();
  }

  async function saveQuestion(value: QState) {
    setBusy(true); setError(''); setQuestionSaved(false);
    try {
      const res = await fetch('/api/meetings/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meeting_id: id, ...qPayload(value) }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || 'Failed to save.'); return; }
      setQuestionSaved(true);
      loadLive();
    } finally { setBusy(false); }
  }

  if (!live) return <LoadingSpinner size={28} label="Loading meeting…" theme="dark" />;

  const open = live.meeting.open;
  // Over = its time has passed and check-in isn't running: the info below is locked (the doc link stays editable).
  const over = !open && Date.now() > new Date(live.meeting.ends_at).getTime();
  const secondsLeft = live.expiresAt ? Math.max(0, Math.ceil((live.expiresAt - now) / 1000)) : 0;
  const pct = Math.min(100, (secondsLeft / 30) * 100);
  const ringPct = live.attendees.length + live.missing.length > 0 ? Math.min(100, (live.attendees.length / (live.attendees.length + live.missing.length)) * 100) : 0;
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
            <div ref={questionRef} className={styles.screenQuestion}>
              <span className={styles.questionLabel}><MessageCircleQuestion size={presenting ? 18 : 14} aria-hidden="true" /> Question of the meeting</span>
              <p>{live.meeting.question}</p>
            </div>
          )}
          <span ref={labelRef} className={styles.codeLabel}>{live.meeting.title} check-in code</span>
          <div className={styles.codeRing}>
            <svg className={styles.ringSvg} aria-hidden="true" preserveAspectRatio="none"><rect x="2" y="2" rx="22" ry="22" width="calc(100% - 4px)" height="calc(100% - 4px)" pathLength="100" className={styles.ringBack} /><rect x="2" y="2" rx="22" ry="22" width="calc(100% - 4px)" height="calc(100% - 4px)" pathLength="100" className={styles.ringFill} style={{ strokeDasharray: `${ringPct} 100` }} /></svg>
            <div ref={codeRef} className={styles.bigCode} aria-live="off">{grouped}</div>
          </div>
          <div ref={timerRef} className={styles.timer} aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
          <div ref={countRef} className={styles.liveCount}><strong>{live.attendees.length}</strong> of {live.attendees.length + live.missing.length} checked in</div>
          {presenting && <p ref={hintRef} className={styles.presentHint}>Open the portal → Meetings and type this code</p>}
          {live.meeting.question && live.meeting.question_type !== 'text' && (
            <div className={styles.screenResults}><ResultBars type={live.meeting.question_type} tally={live.tally} big={presenting} /></div>
          )}
          {live.meeting.question && live.meeting.question_type === 'text' && live.answers.length > 0 && (
            <BubbleField answers={live.answers.map((x) => ({ key: `${x.id}-${x.at}`, text: x.answer }))} avoid={[questionRef, labelRef, codeRef, timerRef, countRef, hintRef, totalsRef]} presenting={presenting} />
          )}
          {Object.keys(live.reactionTotals).length > 0 && (
            <div ref={totalsRef} className={styles.screenTotals} aria-label="Reaction totals">
              {Object.entries(live.reactionTotals).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([e, n], i) => <span key={e} className={i === 0 ? styles.topTotal : ''}><EmojiView emoji={e} custom={live.customEmojis} /> <strong>{n}</strong></span>)}
            </div>
          )}
          {bigBurst && <span key={bigBurst.key} className={styles.bigBurst} aria-hidden="true"><EmojiView emoji={bigBurst.emoji} custom={live.customEmojis} size="1em" /></span>}
          <Confetti fire={fire} />
          <div className={styles.floaters} aria-hidden="true">
            {floaters.map((f) => <span key={f.key} className={styles.floater} style={{ left: `${f.left}%`, animationDelay: `${f.delay}s` }}><EmojiView emoji={f.emoji} custom={live.customEmojis} /></span>)}
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
            <p className={styles.faint}>On the big screen; revealed after check-in.</p>
            {over ? (
              <p className={styles.lockNote}><Lock size={13} aria-hidden="true" /> {live.meeting.question ? <>“{live.meeting.question}”. </> : null}This meeting has ended, so the question is locked.</p>
            ) : open ? (
              <p className={styles.lockNote}><Lock size={13} aria-hidden="true" /> The question is locked while check-in is open, so everyone answers the same one. Close check-in to change it.</p>
            ) : (
              <form className={styles.docForm} onSubmit={(e) => { e.preventDefault(); saveQuestion(q); }}>
                <QuestionEditor value={q} onChange={(v) => { setQ(v); setQuestionSaved(false); }} placeholder="e.g. What game have you put the most hours into?" />
                <Button type="submit" size="sm" loading={busy} disabled={qBad(q)}>{questionSaved ? 'Saved' : 'Save'}</Button>
              </form>
            )}
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
                  <p className={styles.totals}>{Object.keys(live.reactionTotals).map((e) => <span key={e}><EmojiView emoji={e} custom={live.customEmojis} /> {live.reactionTotals[e]}</span>)}</p>
                )}
              </div>
            )}
          </div>
{over ? (
            <p className={styles.lockNote}><Lock size={13} aria-hidden="true" /> This meeting has ended, so its info is locked.{doc ? <> Doc: <a href={doc} target="_blank" rel="noopener noreferrer">{doc}</a></> : null}</p>
          ) : (
                    <form className={styles.docForm} onSubmit={(e) => { e.preventDefault(); saveDoc(); }}>
            <Field label="Meeting doc link" hint="Shown to people after they check in.">
              <Input value={doc ?? ''} onChange={(e) => { setDoc(e.target.value); setDocSaved(false); }} placeholder="https://docs.google.com/…" inputMode="url" />
            </Field>
            <Button type="submit" size="sm" variant="ghost" loading={busy}>{docSaved ? 'Saved' : 'Save link'}</Button>
          </form>
          )}
          {!over && <InvitePeople live={live} meetingId={id} onSaved={loadLive} />}
          <AttendeeList live={live} onAdd={addPerson} onRemove={removePerson} onAbsent={markAbsent} onClearAbsent={clearAbsent} />
          {!live.meeting.series_id && <div className={styles.runActions}><IconButton kind="delete" label="Delete this meeting" onClick={deleteMeeting} /></div>}
        </>
      )}
    </div>
  );
}

// Add more people to a meeting that already exists. Roles and groups stay as they are (and keep pulling
// people in live); this only adds individuals on top. People already covered show ticked and locked.
function InvitePeople({ live, meetingId, onSaved }: { live: Live; meetingId: string; onSaved: () => void }) {
  const team = useTeam();
  const [ids, setIds] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const m = live.meeting;
  const invited = m.invitees ?? [];
  // Expected people who are in only because of a role or group (not individually added).
  const covered = new Map<string, string>();
  for (const p of [...live.attendees, ...live.missing, ...live.absent]) if (!invited.includes(p.id)) covered.set(p.id, 'role or group');

  async function save() {
    if (!ids) return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/meetings/update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_id: meetingId, invitees: ids, group_ids: m.group_ids ?? [], audience: audienceRoles({ audience: m.audience, invitees: m.invitees, group_ids: m.group_ids }) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || 'Failed to save.'); return; }
      setIds(null);
      onSaved();
    } finally { setBusy(false); }
  }

  if (!ids) {
    return (
      <div className={styles.inviteBar}>
        <span className={styles.faint}><Users size={12} aria-hidden="true" /> For: {audienceLabel({ audience: m.audience, invitees: m.invitees, group_ids: m.group_ids, groupNames: m.groupNames })}</span>
        <Button size="sm" variant="secondary" onClick={() => setIds([...invited])}><UserPlus size={14} aria-hidden="true" /> Add people</Button>
      </div>
    );
  }
  return (
    <div className={styles.card}>
      <h3 className={styles.listTitle}>Add people <span>{ids.length} added individually</span></h3>
      <p className={styles.faint}>Tick anyone to invite them directly.</p>
      <PeoplePicker team={team} value={ids} onChange={setIds} covered={covered} />
      {error && <Notice tone="error">{error}</Notice>}
      <div className={styles.formActions}>
        <Button variant="ghost" onClick={() => { setIds(null); setError(''); }}>Cancel</Button>
        <Button onClick={save} loading={busy}>Save</Button>
      </div>
    </div>
  );
}

function AttendeeList({ live, onAdd, onRemove, onAbsent, onClearAbsent }: {
  live: Live; onAdd: (p: Person) => void; onRemove: (p: Person) => void;
  onAbsent: (p: Person, reason: string, excused: boolean) => void; onClearAbsent: (p: Person) => void;
}) {
  // Which person's "mark absent" form is open.
  const [absentFor, setAbsentFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [excused, setExcused] = useState(true);
  function openAbsent(p: Person) { setAbsentFor(p.id); setReason(''); setExcused(true); }
  return (
    <div className={styles.lists}>
      <section>
        <h3 className={styles.listTitle}>Here <span>{live.attendees.length}</span></h3>
        {live.attendees.length === 0 ? <p className={styles.muted}>Nobody yet.</p> : (
          <ul className={styles.people}>
            {live.attendees.map((p) => (
              <li key={p.id} className={styles.person}>
                <Avatar p={p} />
                <span className={styles.personName}>{p.name}{p.method === 'manual' && <em> · added by exec</em>}{p.method === 'host' && <em> · host (automatic)</em>}</span>
                <span className={styles.personTime}>{time(p.checked_in_at)}</span>
                <IconButton kind="remove" size="sm" label={`Remove ${p.name}`} onClick={() => onRemove(p)} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className={styles.listTitle}>Not here yet <span>{live.missing.length}</span></h3>
        {live.missing.length === 0 ? <p className={styles.muted}>Everyone is accounted for.</p> : (
          <ul className={styles.people}>
            {live.missing.map((p) => (
              <li key={p.id} className={styles.personCol}>
                <div className={styles.personRow}>
                  <Avatar p={p} />
                  <span className={styles.personName}>{p.name}</span>
                  <IconButton kind="checkin" label={`Check in ${p.name}`} onClick={() => onAdd(p)} />
                  <IconButton kind="absent" label={`Mark ${p.name} absent`} active={absentFor === p.id} onClick={() => (absentFor === p.id ? setAbsentFor(null) : openAbsent(p))} aria-expanded={absentFor === p.id} />
                </div>
                {absentFor === p.id && (
                  <form className={styles.absentForm} onSubmit={(e) => { e.preventDefault(); onAbsent(p, reason, excused); setAbsentFor(null); }}>
                    <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional), e.g. exam, sick" maxLength={140} aria-label={`Why ${p.name} is absent`} autoFocus />
                    <CheckTile label="Excused" checked={excused} onChange={() => setExcused((v) => !v)} />
                    <Button type="submit" size="sm">Mark absent</Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {live.absent.length > 0 && (
        <section className={styles.listWide}>
          <h3 className={styles.listTitle}>Marked absent <span>{live.absent.length}</span></h3>
          <ul className={styles.people}>
            {live.absent.map((p) => (
              <li key={p.id} className={styles.person}>
                <Avatar p={p} />
                <span className={styles.personName}>{p.name}{p.reason && <em> · {p.reason}</em>}</span>
                <span className={`${styles.pill} ${p.excused ? styles.pillDone : ''}`}>{p.excused ? 'Excused' : 'Absent'}</span>
                <IconButton kind="remove" size="sm" label={`Undo absence for ${p.name}`} onClick={() => onClearAbsent(p)} />
              </li>
            ))}
          </ul>
        </section>
      )}
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

interface AttPerson { id: string; name: string; avatar_url: string | null; custom_avatar_url: string | null; role: string; attended: number; total: number; rate: number | null; streak: number; missedRun: number; marks: ('p' | 'a' | 'e' | 'g' | '-')[]; excused: number; last_attended: string | null; follow_up: boolean }
interface AttData {
  titles: string[];
  meetings: { id: string; title: string; meeting_date: string; audience: string[] | null; invitees: string[] | null; count: number; guests: number; expected: number }[];
  people: AttPerson[];
  summary: { held: number; avgTurnout: number; avgRate: number | null; followUp: number };
}
type SortKey = 'name' | 'rate' | 'attended' | 'streak' | 'last';

function AttendancePanel({ onOpenMeeting, canExport }: { onOpenMeeting?: (id: string) => void; canExport: boolean }) {
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('90');
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [onlyFollowUp, setOnlyFollowUp] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'rate', dir: 1 });
  const [data, setData] = useState<AttData | null>(null);
  const [error, setError] = useState('');
  const [showMeetings, setShowMeetings] = useState(false);
  const [showAllPeople, setShowAllPeople] = useState(false);

  const to = pacificToday();
  const from = shiftKey(to, -(RANGES.find((r) => r.id === range)?.days ?? 90));
  const qs = `from=${from}&to=${to}${title ? `&title=${encodeURIComponent(title)}` : ''}`;

  useEffect(() => {
    let cancelled = false;
    setData(null); setError('');
    (async () => {
      try {
        const res = await fetch(`/api/meetings/attendance?${qs}`, { cache: 'no-store' });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) setError(json.error || 'Failed to load.'); else setData(json);
      } catch { if (!cancelled) setError('Network error.'); }
    })();
    return () => { cancelled = true; };
  }, [qs]);

  const people = (data?.people ?? [])
    .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()) && (!onlyFollowUp || p.follow_up))
    .sort((a, b) => {
      const v = (p: AttPerson) => sort.key === 'name' ? p.name.toLowerCase() : sort.key === 'rate' ? (p.rate ?? -1) : sort.key === 'attended' ? p.attended : sort.key === 'streak' ? p.streak : (p.last_attended ?? '');
      const x = v(a), y = v(b);
      return (x < y ? -1 : x > y ? 1 : a.name.localeCompare(b.name)) * sort.dir;
    });

  const th = (key: SortKey, label: string) => (
    <button type="button" className={`${styles.thBtn} ${sort.key === key ? styles.thOn : ''}`} onClick={() => setSort((s) => (s.key === key ? { key, dir: (-s.dir) as 1 | -1 } : { key, dir: key === 'name' ? 1 : -1 }))}>
      {label}{sort.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
    </button>
  );
  const maxBar = Math.max(1, ...(data?.meetings ?? []).map((m) => Math.max(m.count, m.expected)));
  const bars = (data?.meetings ?? []).slice(-40);

  return (
    <div className={styles.stack}>
      <div className={styles.filters}>
        <Field label="Time range"><Select value={range} onChange={(e) => setRange(e.target.value as typeof range)}>{RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</Select></Field>
        <Field label="Meeting">
          <Select value={title} onChange={(e) => setTitle(e.target.value)}>
            <option value="">All meetings</option>
            {(data?.titles ?? (title ? [title] : [])).map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        {canExport && <div className={styles.exportBtns}>
          <a className={styles.docBtn} href={`/api/meetings/export?type=log&${qs}`}><Download size={15} aria-hidden="true" /> Log (CSV)</a>
          <a className={styles.docBtn} href={`/api/meetings/export?type=summary&${qs}`}><Download size={15} aria-hidden="true" /> Summary (CSV)</a>
        </div>}
      </div>
      {canExport ? <p className={styles.faint}>Exports follow these filters.</p> : <p className={styles.faint}>Your meetings’ results.</p>}

      {error && <Notice tone="error">{error}</Notice>}
      {!data && !error && <LoadingSpinner size={28} label="Loading attendance…" theme="dark" />}
      {data && data.meetings.length === 0 && <div className={styles.card}><p className={styles.muted}>No meetings in this range.</p></div>}

      {data && data.meetings.length > 0 && (
        <>
          <div className={styles.tiles}>
            <div className={styles.tile}><strong>{data.summary.held}</strong><span>meetings held</span></div>
            <div className={styles.tile}><strong>{data.summary.avgTurnout}</strong><span>average turnout</span></div>
            <div className={styles.tile}><strong>{data.summary.avgRate === null ? '–' : `${Math.round(data.summary.avgRate * 100)}%`}</strong><span>average attendance</span></div>
            <button type="button" className={`${styles.tile} ${styles.tileBtn} ${onlyFollowUp ? styles.tileOn : ''}`} onClick={() => setOnlyFollowUp((v) => !v)} aria-pressed={onlyFollowUp}>
              <strong>{data.summary.followUp}</strong><span>to follow up{onlyFollowUp ? ' (showing)' : ''}</span>
            </button>
          </div>

          <section className={styles.card}>
            <h3 className={styles.listTitle}>Turnout <span>each bar is a meeting, outline = people expected</span></h3>
            <div className={styles.trend} role="img" aria-label="Turnout per meeting">
              {bars.map((m) => (
                <button key={m.id} type="button" className={styles.trendCol} onClick={() => onOpenMeeting?.(m.id)} title={`${dayLabel(m.meeting_date)} · ${m.title}: ${m.count} of ${m.expected}${m.guests > 0 ? `, plus ${m.guests} guest${m.guests === 1 ? '' : 's'}` : ''}`}>
                  <span className={styles.trendBar} style={{ height: `${(Math.max(m.count, m.expected) / maxBar) * 100}%` }}>
                    <span className={styles.trendFill} style={{ height: `${m.expected || m.count ? Math.min(100, (m.count / Math.max(m.count, m.expected)) * 100) : 0}%` }} />
                  </span>
                  <small>{new Date(`${m.meeting_date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'numeric', day: 'numeric' })}</small>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.tableHead}>
              <h3 className={styles.listTitle}>People <span>{people.length} shown</span></h3>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people…" aria-label="Search people" className={styles.searchBox} />
            </div>
            <div className={styles.sortRow}>Sort: {th('rate', 'Rate')} {th('attended', 'Attended')} {th('streak', 'Streak')} {th('last', 'Last seen')} {th('name', 'Name')}</div>
            {people.length === 0 ? <p className={styles.muted}>No one matches.</p> : (
              <ul className={styles.people}>
                {(showAllPeople || query || onlyFollowUp ? people : people.slice(0, 20)).map((p) => (
                  <li key={p.id} className={styles.attRow}>
                    <Avatar p={p} />
                    <span className={styles.attMain}>
                      <span className={styles.personName}>{p.name}{p.follow_up && <b className={styles.flag}>Follow up</b>}</span>
                      <em className={styles.attSub}>
                        {p.role}{p.streak >= 2 ? ` · ${p.streak} in a row` : ''}{p.missedRun >= 2 ? ` · missed last ${p.missedRun}` : ''}{p.last_attended ? ` · last ${dayLabel(p.last_attended)}` : ' · never attended'}
                      </em>
                    </span>
                    <span className={styles.dots} aria-label="Recent meetings, oldest to newest">
                      {p.marks.slice(-12).map((m, i) => <i key={i} className={m === 'p' ? styles.dotP : m === 'a' ? styles.dotA : m === 'e' ? styles.dotE : m === 'g' ? styles.dotG : styles.dotN} />)}
                    </span>
                    <span className={styles.attRate}>
                      <span className={styles.bar}><span style={{ width: `${(p.rate ?? 0) * 100}%` }} /></span>
                      <span className={styles.count}>{p.attended}/{p.total}{p.rate !== null ? ` · ${Math.round(p.rate * 100)}%` : ''}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {!showAllPeople && !query && !onlyFollowUp && people.length > 20 && <Button variant="ghost" size="sm" onClick={() => setShowAllPeople(true)}>Show all {people.length}</Button>}
            <p className={`${styles.faint} ${styles.dotKey}`}>
              <span><i style={{ background: '#34d399' }} /> came</span>
              <span><i style={{ background: '#f87171' }} /> missed</span>
              <span><i style={{ boxShadow: 'inset 0 0 0 2px #fbbf24' }} /> excused</span>
              <span><i style={{ background: '#6b7280' }} /> not invited</span>
              <span title="Under 50%, or the last 3 expected meetings missed">⚑ follow up</span>
            </p>
          </section>

          <section className={styles.card}>
            <button type="button" className={styles.collapse} onClick={() => setShowMeetings((v) => !v)} aria-expanded={showMeetings}>
              <h3 className={styles.listTitle}>Meetings <span>{data.meetings.length}</span></h3><span>{showMeetings ? 'Hide' : 'Show'}</span>
            </button>
            {showMeetings && (
              <ul className={styles.people}>
                {[...data.meetings].reverse().map((m) => (
                  <li key={m.id} className={styles.person}>
                    <span className={styles.personName}>{dayLabel(m.meeting_date)}<em> · {m.title} · {audienceLabel(m)}</em></span>
                    <span className={styles.count}>{m.count}/{m.expected}{m.guests > 0 ? ` +${m.guests} guest${m.guests === 1 ? '' : 's'}` : ''}</span>
                    {onOpenMeeting && <Button size="sm" variant="ghost" onClick={() => onOpenMeeting(m.id)}>Open</Button>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
