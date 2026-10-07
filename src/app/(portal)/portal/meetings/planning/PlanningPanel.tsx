'use client';

import SectionTabs from '@/components/ui/SectionTabs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDraft } from '@/lib/ui/useDraft';
import DraftBanner from '@/components/portal/DraftBanner';
import { useSearchParams } from 'next/navigation';
import { usePortalParams } from '@/lib/portal/usePortalParams';
import { ArrowLeft, Bell, CalendarClock, Check, ChevronRight, Hourglass, Lock, MousePointerClick, Plus, RotateCcw, Star, UserX, Users } from 'lucide-react';
import Notice from '@/components/ui/Notice';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import { Field, Input, Select, Textarea, DateInput } from '@/components/ui/Field';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { confirmHold } from '@/lib/ui/confirmHold';
import { audienceLabel } from '@/lib/meetings/meetingAudience';
import { MAX_RANGE_DAYS, addDays, availabilityFor, bestTimes, evaluateStart, clockLabel, dayLabel, daysBetween, slotStarts, toHhmm, toMin, withoutBusy, type PlanSlots, type PlanView } from '@/lib/meetings/meetingPlans';
import { AudiencePicker, audienceEmpty, audFrom, audPayload, defaultAud, type Aud } from '../MeetingsSectionContent';
import m from '../meetings.module.css';
import styles from './planning.module.css';
import AvailabilityGrid from './AvailabilityGrid';
import ResultsGrid, { WhoPanel } from './ResultsGrid';

const pacificToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const TIMES = Array.from({ length: 36 }, (_, i) => toHhmm(6 * 60 + i * 30));   // 6:00 AM to 11:30 PM
const LENGTHS = Array.from({ length: 16 }, (_, i) => (i + 1) * 30);
const lengthLabel = (min: number) => `${min >= 60 ? `${Math.floor(min / 60)} hr` : ''}${min % 60 ? `${min >= 60 ? ' ' : ''}${min % 60} min` : ''}`;
const rangeLabel = (p: PlanView) => p.kind === 'weekly' ? 'Every week (Sunday to Saturday)' : p.days.length ? `${dayLabel(p.days[0], 'once')}${p.days.length > 1 ? ` to ${dayLabel(p.days[p.days.length - 1], 'once')}` : ''}` : 'Dates have passed';
const slotLabel = (p: PlanView, day: string, start: string) => `${dayLabel(day, p.kind)}, ${clockLabel(start)} to ${clockLabel(toHhmm(toMin(start) + p.duration_min))}`;

export default function PlanningPanel({ userId }: { userId: string }) {
  const params = useSearchParams();
  const setParams = usePortalParams();
  const [plans, setPlans] = useState<PlanView[] | null>(null);
  const [canHost, setCanHost] = useState(false);
  const [openId, setOpenId] = useState<string | null>(params.get('plan'));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/meeting-plans', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Couldn’t load the plans.'); return; }
      setPlans(json.plans); setCanHost(json.canHost);
    } catch { setError('Couldn’t load the plans.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const open = plans?.find((p) => p.id === openId) ?? null;
  if (plans === null) return error ? <Notice tone="error">{error}</Notice> : <LoadingSpinner />;

  if (creating) return <PlanForm onDone={() => { setCreating(false); void load(); }} onCancel={() => setCreating(false)} />;
  if (open) return <PlanDetail key={open.id} plan={open} userId={userId} onBack={() => { setOpenId(null); setParams({ plan: null }); void load(); }} reload={load} />;

  return (
    <div className={m.stack}>
      <div className={styles.listHead}>
        <p className={m.faint}>Everyone marks when they’re free. The host picks the time.</p>
        {canHost && <Button size="sm" onClick={() => setCreating(true)}><Plus size={14} aria-hidden="true" /> New plan</Button>}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {plans.length === 0 ? (
        <p className={m.faint}>{canHost ? 'No plans yet.' : 'Nothing to fill out right now.'}</p>
      ) : (
        <ul className={styles.list}>
          {plans.map((p) => {
            const answered = p.people.filter((x) => p.responses[x.id]).length;
            const iAmAsked = p.people.some((x) => x.id === userId);
            const needsMe = iAmAsked && p.status === 'open' && !p.expired && !p.responses[userId];
            return (
              <li key={p.id}>
                <button type="button" data-tone={needsMe ? 'todo' : p.status === 'decided' ? 'done' : p.expired ? 'warn' : 'plan'} className={styles.planCard} onClick={() => { setOpenId(p.id); setParams({ plan: p.id }); }}>
                  <span className={styles.planTop}>
                    <strong>{p.title}</strong>
                    <span className={`${styles.chip} ${p.kind === 'weekly' ? styles.chipWeekly : styles.chipOnce}`}>{p.kind === 'weekly' ? 'Weekly' : 'One time'}</span>
                    <span className={`${styles.chip} ${p.status === 'decided' ? styles.chipDone : p.expired ? styles.chipWarn : styles.chipOpen}`}>{p.status === 'decided' ? 'Time picked' : p.expired ? 'Dates passed' : 'Planning'}</span>
                  </span>
                  <span className={styles.planMeta}>{rangeLabel(p)} · {lengthLabel(p.duration_min)}{p.host_name ? ` · hosted by ${p.host_name}` : ''}</span>
                  <span className={styles.planMeta}>{p.status === 'decided' && p.decided_slot ? `Set for ${slotLabel(p, p.decided_slot.day ?? String(p.decided_slot.weekday), p.decided_slot.start)}` : `${answered} of ${p.people.length} answered`}</span>
                  {needsMe && <span className={styles.needsMe}>Add your availability</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Create / edit a plan ─────────────────────────────────────────────────────
function PlanForm({ plan, onDone, onCancel }: { plan?: PlanView; onDone: () => void; onCancel: () => void }) {
  const today = pacificToday();
  const [kind, setKind] = useState<'once' | 'weekly'>(plan?.kind ?? 'once');
  const [title, setTitle] = useState(plan?.title ?? '');
  const [description, setDescription] = useState(plan?.description ?? '');
  const [location, setLocation] = useState(plan?.location ?? '');
  const [duration, setDuration] = useState(plan?.duration_min ?? 60);
  const [ws, setWs] = useState(plan?.window_start ?? '09:00');
  const [we, setWe] = useState(plan?.window_end ?? '22:00');
  const [rs, setRs] = useState(plan?.range_start && plan.range_start >= today ? plan.range_start : today);
  const [re, setRe] = useState(plan?.range_end && plan.range_end >= today ? plan.range_end : addDays(today, 6));
  const [answerBy, setAnswerBy] = useState(plan?.answer_by ?? '');
  const [audience, setAudience] = useState<Aud>(plan ? audFrom(plan) : defaultAud());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const rangeTooLong = kind === 'once' && daysBetween(rs, re) > MAX_RANGE_DAYS - 1;
  // A new plan autosaves in this browser, so a reload or lost connection does not lose it (editing an existing plan does not need it).
  const draft = useDraft('meeting-plan-new', { kind, title, description, location, duration, ws, we, rs, re, answerBy, audience }, (v) => !!plan || (!v.title.trim() && !v.description.trim() && !v.location.trim() && audienceEmpty(v.audience)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const body = { kind, title, description, location, duration_min: duration, window_start: ws, window_end: we, range_start: rs, range_end: re, answer_by: answerBy || null, ...audPayload(audience) };
      const res = await fetch(plan ? `/api/meeting-plans/${plan.id}` : '/api/meeting-plans', { method: plan ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || 'Couldn’t save the plan.'); return; }
      draft.clear();
      onDone();
    } finally { setBusy(false); }
  }

  return (
    <form className={m.form} onSubmit={submit}>
      <button type="button" className={m.backLink} onClick={onCancel}><ArrowLeft size={15} aria-hidden="true" /> Back to plans</button>
      <h2 className={m.sectionHead}>{plan ? 'Edit plan' : 'Plan a meeting'}</h2>
      {!plan && draft.offer && <DraftBanner at={draft.offer.at} what="plan" onContinue={() => { const d = draft.accept(); if (d) { setKind(d.kind); setTitle(d.title); setDescription(d.description); setLocation(d.location); setDuration(d.duration); setWs(d.ws); setWe(d.we); setRs(d.rs >= today ? d.rs : today); setRe(d.re >= today ? d.re : addDays(today, 6)); setAnswerBy(d.answerBy); setAudience(d.audience); } }} onDiscard={draft.discard} />}
      {!plan && (
        <div className={styles.kindPick} role="radiogroup" aria-label="Type of plan">
          <button type="button" role="radio" aria-checked={kind === 'once'} className={`${styles.kindBtn} ${kind === 'once' ? styles.kindOn : ''}`} onClick={() => setKind('once')}><strong>One time</strong><span>Pick from a range of dates (up to {MAX_RANGE_DAYS} days)</span></button>
          <button type="button" role="radio" aria-checked={kind === 'weekly'} className={`${styles.kindBtn} ${kind === 'weekly' ? styles.kindOn : ''}`} onClick={() => setKind('weekly')}><strong>Weekly</strong><span>Find a weekly time, Sunday to Saturday</span></button>
        </div>
      )}
      <div className={m.formGrid}>
        <Field label="Name"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Marketing sync" maxLength={60} required /></Field>
        <Field label="Meeting length"><Select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>{LENGTHS.map((l) => <option key={l} value={l}>{lengthLabel(l)}</option>)}</Select></Field>
        <Field label="Earliest time shown"><Select value={ws} onChange={(e) => setWs(e.target.value)}>{TIMES.map((t) => <option key={t} value={t}>{clockLabel(t)}</option>)}</Select></Field>
        <Field label="Latest time shown" hint="The meeting has to end by this."><Select value={we} onChange={(e) => setWe(e.target.value)}>{[...TIMES.slice(1), '24:00'].filter((t) => t !== '24:00').map((t) => <option key={t} value={t}>{clockLabel(t)}</option>)}</Select></Field>
        {kind === 'once' && (<>
          <Field label="First day"><DateInput value={rs} min={today} onChange={(e) => setRs(e.target.value)} required /></Field>
          <Field label="Last day" hint={rangeTooLong ? `At most ${MAX_RANGE_DAYS} days.` : undefined}><DateInput value={re} min={rs} onChange={(e) => setRe(e.target.value)} required /></Field>
        </>)}
        <Field label="Answer by (optional)"><DateInput value={answerBy} min={today} onChange={(e) => setAnswerBy(e.target.value)} /></Field>
        <Field label="Room (optional)"><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Price Center East" maxLength={80} /></Field>
      </div>
      <Field label="What’s it about? (optional)"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} /></Field>
      <div className={m.audienceField}><span className={m.audienceTitle}>Who should answer?</span><AudiencePicker value={audience} onChange={setAudience} /></div>
      <p className={m.faint}>Times are Pacific. Whoever can’t make the time you pick is marked absent (excused).</p>
      {error && <Notice tone="error">{error}</Notice>}
      <div className={m.formActions}><Button type="submit" loading={busy} disabled={audienceEmpty(audience) || rangeTooLong || toMin(we) - toMin(ws) < duration}>{plan ? 'Save changes' : 'Send to everyone'}</Button></div>
    </form>
  );
}

// ── One plan ─────────────────────────────────────────────────────────────────
function PlanDetail({ plan, userId, onBack, reload }: { plan: PlanView; userId: string; onBack: () => void; reload: () => Promise<void> }) {
  const iAmAsked = plan.people.some((p) => p.id === userId);
  const [view, setView] = useState<'mine' | 'results'>(iAmAsked && plan.status === 'open' && !plan.expired && !plan.responses[userId] ? 'mine' : plan.status === 'open' && iAmAsked ? 'mine' : 'results');
  // Anything I'd saved on a time that has since been taken (a meeting was added) is dropped, and saved again below.
  const startsAll = slotStarts(plan.window_start, plan.window_end);
  const [mine, setMine] = useState<PlanSlots>(() => withoutBusy(plan.mine ?? {}, plan.busy, startsAll));
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [pick, setPick] = useState<{ day: string; start: string } | null>(null);
  const [preview, setPreview] = useState<{ day: string; start: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const dirty = useRef(JSON.stringify(withoutBusy(plan.mine ?? {}, plan.busy, startsAll)) !== JSON.stringify(plan.mine ?? {}));
  const latest = useRef(mine);
  latest.current = mine;

  // Save my answers a moment after I stop tapping (just this plan; nothing is copied between plans).
  useEffect(() => {
    if (!dirty.current) return;
    setSaveState('saving');
    const t = setTimeout(async () => {
      const res = await fetch(`/api/meeting-plans/${plan.id}/availability`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slots: latest.current }) });
      setSaveState(res.ok ? 'saved' : 'error');
      if (!res.ok) setError((await res.json().catch(() => ({}))).error || 'Couldn’t save your answers.');
    }, 700);
    return () => clearTimeout(t);
  }, [mine, plan.id]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action); setError(''); setNote('');
    try {
      const res = await fetch(`/api/meeting-plans/${plan.id}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || 'That didn’t work.'); return false; }
      if (action === 'nudge') setNote(json.waiting ? `Reminded ${json.reminded} ${json.reminded === 1 ? 'person' : 'people'}.` : 'Everyone has answered.');
      if (action === 'decide') setNote(json.absent?.length ? `Scheduled. Marked absent (excused): ${json.absent.join(', ')}.` : 'Scheduled. Everyone who answered can make it.');
      await reload();
      return true;
    } finally { setBusy(''); }
  }

  if (editing) return <PlanForm plan={plan} onDone={async () => { setEditing(false); await reload(); }} onCancel={() => setEditing(false)} />;

  // The group result counts my edits the moment I make them, not only after they are saved (an empty grid still means not answered).
  const liveResponses = { ...plan.responses };
  if (iAmAsked && plan.status === 'open') { if (Object.keys(mine).length) liveResponses[userId] = mine; else delete liveResponses[userId]; }
  const live: PlanView = { ...plan, responses: liveResponses };
  const answered = plan.people.filter((p) => live.responses[p.id]);
  // Everyone who has not answered, the host included, so the count matches the Group results tab. Reminders still go only to the others (the host is the one asking).
  const waiting = plan.people.filter((p) => !live.responses[p.id]);
  const remindable = waiting.filter((p) => p.id !== plan.host_id);
  const decided = plan.status === 'decided' && plan.decided_slot;
  const suggestions = plan.status === 'open' && plan.canManage ? bestTimes(live, plan.days, plan.people, live.responses, 10, plan.blocked) : [];
  const pickEvalFull = pick ? evaluateStart(pick.day, pick.start, plan.duration_min, plan.people, live.responses, plan.blocked) : null;
  const pickEval = pickEvalFull ? pickEvalFull.unavailable.filter((p) => p.id !== plan.host_id) : [];
  const hostBusy = pick && plan.host_id && live.responses[plan.host_id] ? availabilityFor(live.responses[plan.host_id], pick.day, pick.start, plan.duration_min) === 'unavailable' : false;

  return (
    <div className={m.stack}>
      <button type="button" className={m.backLink} onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> All plans</button>
      <div className={styles.detailHead}>
        <div>
          <h2 className={styles.detailTitle}>{plan.title}</h2>
          <p className={styles.planMeta}>{rangeLabel(plan)} · {lengthLabel(plan.duration_min)} · {clockLabel(plan.window_start)} to {clockLabel(plan.window_end)}{plan.location ? ` · ${plan.location}` : ''}</p>
          <p className={styles.planMeta}><Users size={12} aria-hidden="true" /> {audienceLabel({ audience: plan.audience, invitees: plan.invitees, group_ids: plan.group_ids, groupNames: plan.groupNames })}{plan.host_name ? ` · hosted by ${plan.host_name}` : ''}{plan.answer_by ? ` · answer by ${new Date(`${plan.answer_by}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })}` : ''}</p>
          {plan.description && <p className={styles.desc}>{plan.description}</p>}
        </div>
        <div className={styles.hostBtns}>
        {plan.canManage && plan.status === 'open' && (<>
            <IconButton kind="edit" label="Edit this plan" onClick={() => setEditing(true)} />
            <Button size="sm" variant="ghost" loading={busy === 'nudge'} onClick={async () => { if (await confirmHold({ title: `Remind ${remindable.length} ${remindable.length === 1 ? 'person' : 'people'}?`, message: `This sends a notification to everyone who hasn’t answered (${remindable.map((p) => p.name).slice(0, 6).join(', ')}${remindable.length > 6 ? ', …' : ''}). It can be sent once every 12 hours.`, confirmLabel: 'Hold to send' })) await act('nudge'); }} disabled={waiting.length === 0}><Bell size={14} aria-hidden="true" /> Remind{waiting.length ? ` (${waiting.length})` : ''}</Button>
            <IconButton kind="delete" label="Delete this plan" onClick={async () => { if (await confirmHold({ title: 'Delete this plan?', message: 'Everyone’s answers are removed.', confirmLabel: 'Hold to delete' })) { const r = await fetch(`/api/meeting-plans/${plan.id}`, { method: 'DELETE' }); if (r.ok) onBack(); else setError((await r.json().catch(() => ({}))).error || 'Couldn’t delete.'); } }} />
        </>)}
        </div>
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {note && <Notice tone="success">{note}</Notice>}
      {plan.expired && plan.status === 'open' && <Notice tone="warning">All the days of this plan have passed. {plan.canManage ? 'Edit it to pick new dates.' : 'The host needs to pick new dates.'}</Notice>}

      {decided && (
        <Notice tone="success">
          <strong>Time picked: {slotLabel(plan, decided.day ?? String(decided.weekday), decided.start)}.</strong> {plan.kind === 'weekly' ? 'It’s now a weekly meeting.' : 'It’s now a scheduled meeting.'} Answers are locked.
          {plan.canReopen && <>{' '}<Button size="sm" variant="secondary" loading={busy === 'reopen'} onClick={async () => { if (await confirmHold({ title: 'Reopen planning?', message: 'This removes the scheduled meeting and the automatic absences, and unlocks everyone’s answers.', confirmLabel: 'Hold to reopen' })) await act('reopen'); }}><RotateCcw size={13} aria-hidden="true" /> Reopen planning</Button></>}
        </Notice>
      )}

      {!plan.expired && (
        <SectionTabs<'mine' | 'results'> label="View" variant="segmented" value={view} onChange={setView} tabs={[
          ...(iAmAsked && plan.status === 'open' ? [{ id: 'mine' as const, label: 'My availability', badge: !live.responses[userId] && !Object.keys(mine).length ? 1 : 0 }] : []),
          { id: 'results' as const, label: `Group results ${answered.length}/${plan.people.length}` },
        ]} />
      )}

      {!plan.expired && view === 'mine' && iAmAsked && plan.status === 'open' && (
        <>
          <AvailabilityGrid plan={plan} value={mine} onChange={(next) => { dirty.current = true; setMine(next); }} />
          <p className={styles.saveLine} aria-live="polite">
            {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Not saved.' : saveState === 'saved' || live.responses[userId] ? <><Check size={13} aria-hidden="true" /> Saved</> : 'Marks save as you go.'}
          </p>
        </>
      )}

      {!plan.expired && view === 'results' && (
        <div className={styles.resultsLayout} data-fill-width>
          <div className={styles.resultsMain}>
            <ResultsGrid plan={live} selected={pick} onSelect={setPick} preview={preview} />
          </div>
          <div className={styles.resultsSide}>
          {suggestions.length > 0 && (
            <div className={styles.suggest}>
              <h3><CalendarClock size={14} aria-hidden="true" /> Best times <small>tap one to pick it</small></h3>
              <div className={styles.sugList}>
              {suggestions.map((s, n) => (
                <div key={`${s.day}-${s.start}`} className={styles.sugRow} role="button" tabIndex={0} aria-label={`Choose ${slotLabel(plan, s.day, s.start)}`} onClick={() => setPick({ day: s.day, start: s.start })} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPick({ day: s.day, start: s.start }); } }} onMouseEnter={() => setPreview({ day: s.day, start: s.start })} onMouseLeave={() => setPreview(null)} onFocus={() => setPreview({ day: s.day, start: s.start })} onBlur={() => setPreview(null)}>
                  <div>
                    <strong><b className={`${styles.sugRank} ${s.top ? styles.sugTop : ''}`}>{s.top ? <Star size={11} aria-label="Best" /> : n + 1}</b>{slotLabel(plan, s.day, s.start)}</strong>
                    <span className={styles.sugCounts}>
                      <span><i className={styles.dotGreen} /> {s.available.length} available</span>
                      {s.ifNeeded.length > 0 && <span><i className={styles.dotAmber} /> {s.ifNeeded.length} if needed</span>}
                      {s.noResponse.length > 0 && <span><i className={styles.dotHollow} /> {s.noResponse.length} haven’t answered</span>}
                    </span>
                    <span>{s.unavailable.length ? `Can’t: ${s.unavailable.map((p) => { const b = s.blocked.find((x) => x.person.id === p.id); return b ? `${p.name} (booked: ${b.titles.join(', ')})` : p.name; }).join(', ')}` : 'Everyone who answered can make it'}</span>
                  </div>
                  <ChevronRight size={18} className={styles.sugGo} aria-hidden="true" />
                </div>
              ))}
              </div>
            </div>
          )}
          {!pick && <p className={styles.pickHint}><MousePointerClick size={16} aria-hidden="true" /> Tap a time to see who</p>}
          {pick && <WhoPanel plan={live} pick={pick} />}
          {pick && plan.canManage && plan.status === 'open' && (
            <div className={styles.confirm}>
              <strong><CalendarClock size={16} aria-hidden="true" /> Schedule {slotLabel(plan, pick.day, pick.start)}?</strong>
              {pickEval.length > 0
                ? <p className={styles.confirmLine}><UserX size={15} aria-hidden="true" /> <span>Marked absent (excused): {pickEval.map((p) => p.name).join(', ')}</span></p>
                : <p className={styles.confirmLine}><Check size={15} aria-hidden="true" /> <span>Everyone who answered can make it</span></p>}
              {waiting.length > 0 && <p className={styles.confirmLine}><Hourglass size={15} aria-hidden="true" /> <span>Not answered yet: they stay expected</span></p>}
              {hostBusy && <p className={`${styles.confirmLine} ${styles.warnText}`}><UserX size={15} aria-hidden="true" /> <span>You marked yourself unavailable then</span></p>}
              <div className={styles.confirmBtns}>
                <Button loading={busy === 'decide'} onClick={() => act('decide', plan.kind === 'weekly' ? { weekday: Number(pick.day), start: pick.start } : { day: pick.day, start: pick.start })}>Schedule it</Button>
                <Button variant="ghost" onClick={() => setPick(null)}>Cancel</Button>
              </div>
              <p className={styles.confirmFine}><Lock size={12} aria-hidden="true" /> Tells everyone and locks answers</p>
            </div>
          )}
          <div className={styles.whoAnswered}>
            <span className={styles.answeredCount}><Check size={14} aria-hidden="true" /> {answered.length} of {answered.length + waiting.length} answered</span>
            {waiting.length > 0 && (
              <span className={styles.waitingRow}>
                <span className={styles.waitingLabel}><Hourglass size={13} aria-hidden="true" /> Waiting on</span>
                {waiting.map((p) => <span key={p.id} className={styles.chip2}>{p.name}{p.id === plan.host_id ? ' (host)' : ''}</span>)}
              </span>
            )}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
