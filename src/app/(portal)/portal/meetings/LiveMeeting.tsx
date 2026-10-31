'use client';

import Loading from '@/components/Loading/Loading';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2, ArrowLeft, MessageCircleQuestion, Lock, Timer } from 'lucide-react';
import IconButton from '@/components/ui/IconButton';
import Notice from '@/components/ui/Notice';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import BubbleField from './BubbleField';
import { QuestionEditor, ResultBars, Confetti, emptyQ, qFrom, qPayload, qBad, type QState } from './QuestionParts';
import { isCustomEmoji, customEmojiId } from '@/lib/meetings/meetingFun';
import { useMeetingLive } from '@/lib/meetings/useMeetingLive';
import { useFxListener, useReactionLedger } from '@/lib/meetings/meetingFx';
import { cleanFx } from '@/lib/meetings/meetingFxPayload';
import { WALL_LIFE_MS, WALL_VISIBLE } from '@/lib/meetings/meetingWall';
import { useVisiblePoll } from '@/lib/ui/useVisiblePoll';
import styles from './meetings.module.css';
import { Live, Person, WallItem } from './types';
import { dayLabel, sideSpot, time, timeRange } from './format';
import { Avatar } from './Avatar';
import { MeetingQR } from './MeetingQR';
import { EmojiView } from './EmojiView';
import { InvitePeople } from './InvitePeople';
import { AttendeeList } from './AttendeeList';

// ── One specific meeting: its code and who's in ───────────────────────────────
export function LiveMeeting({ id, onBack }: { id: string; onBack: () => void }) {
  const [live, setLive] = useState<Live | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [presenting, setPresenting] = useState(false);
  const labelRef = useRef<HTMLSpanElement>(null);
  const codeRef = useRef<HTMLDivElement>(null);
  const codeRowRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const totalsRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState<string | null>(null);
  const [docSaved, setDocSaved] = useState(false);
  const [q, setQ] = useState<QState>(emptyQ);
  const [questionSaved, setQuestionSaved] = useState(false);
  const [fire, setFire] = useState(0);
  const prevHere = useRef<number | null>(null);
  const [bigBurst, setBigBurst] = useState<{ key: number; emoji: string; left: number } | null>(null);
  const [floaters, setFloaters] = useState<{ key: string; emoji: string; left: number; delay: number }[]>([]);
  const fieldsInit = useRef(false);
  const floatSeq = useRef(0);

  const loadLive = useCallback(async () => {
    try {
      const res = await fetch(`/api/meetings/${id}/live`, { cache: 'no-store' });
      if (!res.ok) return;
      const json: Live = await res.json();
      setLive(json);
      if (!fieldsInit.current) {
        fieldsInit.current = true;
        setDoc(json.meeting.doc_url ?? '');
        setQ(qFrom(json.meeting));
      }
      // The moment everyone expected has checked in: confetti.
      const here = json.attendees.filter((a) => !a.guest).length,
        total = here + json.missing.length; // guests are not part of the expected count
      if (prevHere.current !== null && prevHere.current < total && here >= total && total > 1) setFire(Date.now());
      prevHere.current = here;
    } catch {
      /* next poll */
    }
  }, [id]);

  useEffect(() => {
    void loadLive();
  }, [loadLive]);
  useMeetingLive(id, loadLive); // refreshes when someone checks in, answers or reacts
  // Reactions and stickers arrive straight from the phones (no refresh). Each reaction floats up (lots of the same emoji at once: one big one bursts) and is counted; the counts are saved
  // in batches and kept in this browser until saved, so closing and reopening this screen never loses them. Stickers go on the wall and fade after a while.
  const { unsaved, add: countReaction } = useReactionLedger(id, loadLive);
  const [wall, setWall] = useState<WallItem[]>([]);
  const customRef = useRef<Live['customEmojis']>(undefined);
  customRef.current = live?.customEmojis;
  const recentEmoji = useRef<{ t: number; e: string; n: number }[]>([]);
  const lastBurst = useRef(0);
  useFxListener(
    id,
    useCallback(
      (raw: unknown) => {
        const fx = cleanFx(raw, (e) => isCustomEmoji(e) && !!customRef.current?.[customEmojiId(e)]);
        if (!fx) return;
        const t = Date.now();
        if (fx.r) {
          countReaction(fx.b, fx.r);
          const fresh = Object.entries(fx.r)
            .flatMap(([e, n]) => Array.from({ length: Math.min(n, 6) }, () => e))
            .slice(0, 14)
            .map((emoji, i) => ({ key: `r${++floatSeq.current}`, emoji, left: sideSpot(), delay: i * 0.12 }));
          setFloaters((f) => [...f, ...fresh].slice(-60));
          setTimeout(() => setFloaters((f) => f.filter((x) => !fresh.some((n) => n.key === x.key))), 4200 + fresh.length * 120);
          recentEmoji.current = [...recentEmoji.current.filter((x) => t - x.t < 2000), ...Object.entries(fx.r).map(([e, n]) => ({ t, e, n }))];
          const sums: Record<string, number> = {};
          for (const x of recentEmoji.current) sums[x.e] = (sums[x.e] ?? 0) + x.n;
          const top = Object.entries(sums).sort((a, b) => b[1] - a[1])[0];
          if (top && top[1] >= 4 && t - lastBurst.current > 1800) {
            lastBurst.current = t;
            setBigBurst({ key: t, emoji: top[0], left: sideSpot(12, 20) });
            setTimeout(() => setBigBurst((b) => (b?.key === t ? null : b)), 1800);
          }
        }
        if (fx.s) setWall((w) => [...w, ...fx.s!.map((q, i) => ({ id: `${fx.b}${i}`, emoji: q.e, x: q.x, y: q.y, at: t }))].slice(-WALL_VISIBLE));
      },
      [countReaction],
    ),
    !!live?.meeting.open,
  );
  useEffect(() => {
    if (!wall.length) return;
    const t = setInterval(() => setWall((w) => w.filter((i) => Date.now() - i.at < WALL_LIFE_MS)), 5000);
    return () => clearInterval(t);
  }, [wall.length]);
  useVisiblePoll(loadLive, 120_000); // slow backstop in case the live connection is blocked (changes arrive by signal; the code changes by itself from `upcoming`)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // Once the countdown ends, fetch the new code right away instead of waiting for the next poll.
  const rolled = live?.expiresAt && now > live.expiresAt ? live.upcoming?.find((u) => u.expiresAt > now) : undefined;
  const shown = rolled ?? (live ? { code: live.code, qrPayload: live.qrPayload ?? null, expiresAt: live.expiresAt } : null);
  const codeExpired = !!shown?.expiresAt && now > shown.expiresAt + 200;
  useEffect(() => {
    if (codeExpired) loadLive();
  }, [codeExpired, loadLive]);

  async function act(url: string, body: unknown) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Something went wrong.');
        return;
      }
      await loadLive();
    } finally {
      setBusy(false);
    }
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
    setBusy(true);
    setError('');
    setDocSaved(false);
    try {
      const res = await fetch('/api/meetings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_id: id, doc_url: doc ?? '' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Failed to save.');
        return;
      }
      setDocSaved(true);
    } finally {
      setBusy(false);
    }
  }

  async function deleteMeeting() {
    if (!live) return;
    const n = live.attendees.length;
    if (
      !(await confirmHold({
        title: `Delete ${live.meeting.title}?`,
        message: `${n ? `This also deletes its ${n} check-in${n === 1 ? '' : 's'} from the attendance records. ` : ''}This can’t be undone.`,
        confirmLabel: 'Hold to delete',
      }))
    )
      return;
    const res = await fetch(`/api/meetings/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || 'Failed to delete.');
      return;
    }
    onBack();
  }

  async function saveQuestion(value: QState) {
    setBusy(true);
    setError('');
    setQuestionSaved(false);
    try {
      const res = await fetch('/api/meetings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_id: id, ...qPayload(value) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Failed to save.');
        return;
      }
      setQuestionSaved(true);
      loadLive();
    } finally {
      setBusy(false);
    }
  }

  // Check-in closes by itself at the scheduled end. When the clock passes it, load the new state right away instead of waiting for the next poll.
  const endsAtMs = live ? new Date(live.meeting.ends_at).getTime() : 0;
  const pastEnd = !!live?.meeting.open && now > endsAtMs + 500;
  useEffect(() => {
    if (pastEnd) loadLive();
  }, [pastEnd, loadLive]);

  if (!live) return <Loading label="Loading meeting…" />;

  const open = live.meeting.open;
  // Over = its time has passed and check-in isn't running: the info below is locked (the doc link stays editable).
  const over = !open && Date.now() > new Date(live.meeting.ends_at).getTime();
  const secondsLeft = shown?.expiresAt ? Math.max(0, Math.ceil((shown.expiresAt - now) / 1000)) : 0;
  const pct = Math.min(100, (secondsLeft / 30) * 100);
  const expectedHere = live.attendees.filter((a) => !a.guest).length,
    guestCount = live.attendees.length - expectedHere;
  const ringPct = expectedHere + live.missing.length > 0 ? Math.min(100, (expectedHere / (expectedHere + live.missing.length)) * 100) : 0;
  const grouped = shown?.code ? `${shown.code.slice(0, 3)} ${shown.code.slice(3)}` : '';

  // What the screen shows: the saved totals plus the reactions counted here that are not saved yet.
  const totals: Record<string, number> = { ...(live?.reactionTotals ?? {}) };
  for (const [e, n] of Object.entries(unsaved)) totals[e] = (totals[e] ?? 0) + n;

  // Full screen is drawn on the page itself (not inside the portal's animated panel, which would shrink a "fixed" screen to the panel and leave the top and bottom bars over it).
  const codePanel = open ? (
    <div className={`${styles.codePanel} ${presenting ? styles.presenting : ''}`}>
      <button type="button" className={styles.presentBtn} onClick={() => setPresenting((v) => !v)} aria-label={presenting ? 'Exit full screen view' : 'Show on screen'}>
        {presenting ? (
          <>
            <Minimize2 size={15} aria-hidden="true" /> Exit
          </>
        ) : (
          <>
            <Maximize2 size={15} aria-hidden="true" /> Show On Screen
          </>
        )}
      </button>
      {presenting && (
        <div ref={topRef} className={styles.stageBar}>
          <h2>{live.meeting.title}</h2>
          <span>
            {dayLabel(live.meeting.meeting_date, true)} · {timeRange(live.meeting.starts_at, live.meeting.ends_at)}
            {live.meeting.location ? ` · ${live.meeting.location}` : ''}
          </span>
        </div>
      )}
      {live.meeting.question && (
        <div ref={questionRef} className={styles.screenQuestion}>
          <span className={styles.questionLabel}>
            <MessageCircleQuestion size={presenting ? 18 : 14} aria-hidden="true" /> Question of the meeting
          </span>
          <p>{live.meeting.question}</p>
        </div>
      )}
      <span ref={labelRef} className={styles.codeLabel}>
        {presenting ? 'Check in now' : `${live.meeting.title} check-in code`}
      </span>
      <div ref={codeRowRef} className={`${styles.codeRing} ${styles.duo}`}>
        <svg className={styles.ringSvg} aria-hidden="true" preserveAspectRatio="none">
          <rect x="2" y="2" rx="22" ry="22" width="calc(100% - 4px)" height="calc(100% - 4px)" pathLength="100" className={styles.ringBack} />
          <rect
            x="2"
            y="2"
            rx="22"
            ry="22"
            width="calc(100% - 4px)"
            height="calc(100% - 4px)"
            pathLength="100"
            className={styles.ringFill}
            style={{ strokeDasharray: `${ringPct} 100` }}
          />
        </svg>
        <div className={styles.duoCode}>
          <div ref={codeRef} className={styles.bigCode} aria-live="off">
            {grouped}
          </div>
          <small>Type this code in Meetings</small>
        </div>
        {shown?.code && shown.qrPayload && (
          <>
            <span className={styles.duoDivider} aria-hidden="true" />
            <div className={styles.duoQr}>
              <MeetingQR payload={shown?.qrPayload ?? ''} size={presenting ? 340 : 180} />
              <small>Or tap Scan in the portal</small>
            </div>
          </>
        )}
      </div>
      <div ref={timerRef} className={styles.timer} aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
      <div ref={countRef} className={styles.liveCount}>
        {/* On the shared screen only the count shows, never who checked in; the host's own panel keeps the faces. */}
        {!presenting && live.attendees.length > 0 && (
          <span className={styles.arrivals} aria-hidden="true">
            {live.attendees.slice(0, 7).map((a) => (
              <span key={a.id} className={styles.arrival}>
                <Avatar p={a} />
              </span>
            ))}
            {live.attendees.length > 7 && <span className={styles.arrivalMore}>+{live.attendees.length - 7}</span>}
          </span>
        )}
        <span>
          <strong>{expectedHere}</strong> of {expectedHere + live.missing.length} checked in{guestCount > 0 ? ` (+${guestCount})` : ''}
        </span>
      </div>
      <span ref={hintRef} aria-hidden="true" />
      {live.meeting.question && live.meeting.question_type !== 'text' && (
        <div className={styles.screenResults}>
          <ResultBars type={live.meeting.question_type} tally={live.tally} big={presenting} />
        </div>
      )}
      {live.meeting.question && live.meeting.question_type === 'text' && live.answers.length > 0 && (
        <BubbleField
          answers={live.answers.map((x) => ({ key: `${x.id}-${x.at}`, text: x.answer }))}
          avoid={[topRef, questionRef, labelRef, codeRowRef, timerRef, countRef, hintRef, totalsRef]}
          presenting={presenting}
        />
      )}
      {Object.keys(totals).length > 0 && (
        <div ref={totalsRef} className={styles.screenTotals} aria-label="Reaction totals">
          {Object.entries(totals)
            .sort((x, y) => y[1] - x[1])
            .slice(0, 5)
            .map(([e, n], i) => (
              <span key={e} className={i === 0 ? styles.topTotal : ''}>
                <EmojiView emoji={e} custom={live.customEmojis} /> <strong>{n}</strong>
              </span>
            ))}
        </div>
      )}
      {bigBurst && (
        <span key={bigBurst.key} className={styles.bigBurst} style={{ left: `${bigBurst.left}%` }} aria-hidden="true">
          <EmojiView emoji={bigBurst.emoji} custom={live.customEmojis} size="1em" />
        </span>
      )}
      <Confetti fire={fire} />
      {presenting && wall.length > 0 && (
        <div className={styles.wallLayer} aria-hidden="true">
          {wall.map((w) => (
            <span
              key={w.id}
              className={styles.wallItem}
              style={{ left: `${w.x}%`, top: `${w.y}%`, rotate: `${([...w.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 40) - 20}deg` }}
            >
              <EmojiView emoji={w.emoji} custom={live.customEmojis} />
            </span>
          ))}
        </div>
      )}
      <div className={styles.floaters} aria-hidden="true">
        {floaters.map((f) => (
          <span key={f.key} className={styles.floater} style={{ left: `${f.left}%`, animationDelay: `${f.delay}s` }}>
            <EmojiView emoji={f.emoji} custom={live.customEmojis} />
          </span>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div className={styles.runWrap}>
      {!presenting && (
        <header className={styles.liveHead}>
          <button type="button" className={styles.backLink} onClick={onBack}>
            <ArrowLeft size={15} aria-hidden="true" /> All Meetings
          </button>
          <div className={styles.liveTitleRow}>
            <div className={styles.liveTitle}>
              <h2>{live.meeting.title}</h2>
              <span>
                {dayLabel(live.meeting.meeting_date, true)} · {timeRange(live.meeting.starts_at, live.meeting.ends_at)}
                {live.meeting.location ? ` · ${live.meeting.location}` : ''}
              </span>
            </div>
            <span className={`${styles.pill} ${open ? styles.pillOpen : styles.pillDone}`}>{open ? 'Check-In Open' : over ? 'Ended' : 'Check-In Closed'}</span>
          </div>
        </header>
      )}

      {open ? (
        presenting && typeof document !== 'undefined' ? (
          createPortal(codePanel, document.body)
        ) : (
          codePanel
        )
      ) : (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            {live.meeting.title} · {dayLabel(live.meeting.meeting_date, true)}
          </h2>
          <p className={styles.muted}>Check-in is closed{over ? <> (it ended at {time(live.meeting.ends_at)})</> : null}.</p>
          <div className={styles.wrapUp} aria-label="Summary">
            <div>
              <strong>{expectedHere}</strong>
              <span>of {expectedHere + live.missing.length} came</span>
            </div>
            {guestCount > 0 && (
              <div>
                <strong>{guestCount}</strong>
                <span>extra</span>
              </div>
            )}
            <div>
              <strong>{live.missing.length}</strong>
              <span>missing</span>
            </div>
            {live.absent.length > 0 && (
              <div>
                <strong>{live.absent.length}</strong>
                <span>can’t make it</span>
              </div>
            )}
          </div>
          {live.missing.length > 0 && (
            <p className={styles.faint}>
              Not here:{' '}
              {live.missing
                .slice(0, 8)
                .map((p) => p.name)
                .join(', ')}
              {live.missing.length > 8 ? ` and ${live.missing.length - 8} more` : ''}. They count as absent unless you mark them as excused below.
            </p>
          )}
          {error && <Notice tone="error">{error}</Notice>}
          {!live.meeting.cancelled && (
            <Button onClick={() => act('/api/meetings/open', { meeting_id: id })} loading={busy}>
              Re-open check-in
            </Button>
          )}
        </div>
      )}

      {!presenting && (
        <>
          {open && error && <Notice tone="error">{error}</Notice>}
          {open && (
            <div className={`${styles.endBanner} ${endsAtMs - now <= 10 * 60_000 ? styles.endSoon : ''}`} role="status">
              <span className={styles.endIcon} aria-hidden="true">
                <Timer size={18} />
              </span>
              <span className={styles.endText}>
                <strong>
                  {endsAtMs - now <= 10 * 60_000
                    ? `Check-In Closes In ${Math.max(1, Math.ceil((endsAtMs - now) / 60_000))} Min`
                    : `Check-In Is Open Until ${time(live.meeting.ends_at)}`}
                </strong>
                <span>It closes by itself at {time(live.meeting.ends_at)}. Close it sooner once everyone is in, so late scans don’t get through.</span>
              </span>
              <Button
                variant={endsAtMs - now <= 10 * 60_000 ? 'primary' : 'secondary'}
                onClick={async () => {
                  if (
                    await confirmHold({
                      title: 'Close check-in?',
                      message: 'Nobody else will be able to check in with the code. You can re-open it.',
                      confirmLabel: 'Hold to close',
                    })
                  )
                    act('/api/meetings/close', { meeting_id: id });
                }}
                loading={busy}
              >
                Close Check-In
              </Button>
            </div>
          )}
          <details className={styles.moreOptions} open>
            <summary>
              <span>Who&apos;s Here</span>
              <em>
                {expectedHere} of {expectedHere + live.missing.length} checked in{live.missing.length > 0 ? ` · ${live.missing.length} not yet` : ''}
              </em>
            </summary>
            <div className={styles.moreBody}>
              <AttendeeList live={live} onAdd={addPerson} onRemove={removePerson} onAbsent={markAbsent} onClearAbsent={clearAbsent} />
            </div>
          </details>
          <details className={styles.moreOptions} open={live.answers.length > 0}>
            <summary>
              <span>Question &amp; Answers</span>
              <em>{live.meeting.question ? `${live.answers.length} ${live.answers.length === 1 ? 'answer' : 'answers'}` : 'No question set'}</em>
            </summary>
            <div className={styles.moreBody}>
              <div className={styles.card}>
                <h3 className={styles.listTitle}>
                  <MessageCircleQuestion size={14} aria-hidden="true" /> Question of the meeting
                </h3>
                <p className={styles.faint}>On the big screen; revealed after check-in.</p>
                {over ? (
                  <p className={styles.lockNote}>
                    <Lock size={13} aria-hidden="true" /> {live.meeting.question ? <>“{live.meeting.question}”. </> : null}This meeting has ended, so the question is locked.
                  </p>
                ) : open ? (
                  <p className={styles.lockNote}>
                    <Lock size={13} aria-hidden="true" /> The question is locked while check-in is open, so everyone answers the same one. Close check-in to change it.
                  </p>
                ) : (
                  <form
                    className={styles.docForm}
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveQuestion(q);
                    }}
                  >
                    <QuestionEditor
                      value={q}
                      onChange={(v) => {
                        setQ(v);
                        setQuestionSaved(false);
                      }}
                      placeholder="e.g. What game have you put the most hours into?"
                    />
                    <Button type="submit" size="sm" loading={busy} disabled={qBad(q)}>
                      {questionSaved ? 'Saved' : 'Save'}
                    </Button>
                  </form>
                )}
                {live.meeting.question && (
                  <div className={styles.answerWall}>
                    <h4 className={styles.listTitle}>
                      Answers <span>{live.answers.length}</span>
                    </h4>
                    {live.answers.length === 0 ? (
                      <p className={styles.muted}>No answers yet.</p>
                    ) : (
                      <ul className={styles.people}>
                        {live.answers.map((a) => (
                          <li key={a.id} className={styles.person}>
                            <Avatar p={a} />
                            <span className={styles.personName}>
                              {a.name}
                              <em> · {a.answer}</em>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {Object.keys(totals).length > 0 && (
                      <p className={styles.totals}>
                        {Object.keys(totals).map((e) => (
                          <span key={e}>
                            <EmojiView emoji={e} custom={live.customEmojis} /> {totals[e]}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </details>
          <details className={styles.moreOptions}>
            <summary>
              <span>Access &amp; Doc</span>
              <em>
                {doc ? 'Doc linked' : 'No doc yet'} · {live.meeting.open_to_team === false ? 'Private Meeting' : 'Open to the team'}
              </em>
            </summary>
            <div className={styles.moreBody}>
              {!over && <InvitePeople live={live} meetingId={id} onSaved={loadLive} />}
              {over ? (
                <p className={styles.lockNote}>
                  <Lock size={13} aria-hidden="true" /> This meeting has ended, so its info is locked.
                  {doc ? (
                    <>
                      {' '}
                      Doc:{' '}
                      <a href={doc} target="_blank" rel="noopener noreferrer">
                        {doc}
                      </a>
                    </>
                  ) : null}
                </p>
              ) : (
                <form
                  className={styles.docFormRow}
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveDoc();
                  }}
                >
                  <Field label="Meeting doc link" hint="Members it is meant for see the link as soon as you add it.">
                    <div className={styles.inputWithButton}>
                      <Input
                        value={doc ?? ''}
                        onChange={(e) => {
                          setDoc(e.target.value);
                          setDocSaved(false);
                        }}
                        placeholder="https://docs.google.com/…"
                        inputMode="url"
                      />
                      <Button type="submit" size="sm" variant="secondary" loading={busy}>
                        {docSaved ? 'Saved' : 'Save Link'}
                      </Button>
                    </div>
                  </Field>
                </form>
              )}
            </div>
          </details>
          {!live.meeting.series_id && (
            <div className={styles.runActions}>
              <IconButton kind="delete" label="Delete this meeting" onClick={deleteMeeting} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
