'use client';

import { Check, CircleAlert, Gift, TriangleAlert } from 'lucide-react';
import Button from '@/components/ui/Button';
import { PACIFIC_TZ } from '@/lib/core/timezone';
import type { Outcome } from '@/lib/checkin/anyCode';
import styles from './CheckInOutcome.module.css';

const clock = (iso?: string) => iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: PACIFIC_TZ }) : '';

// Says exactly what a check-in did, in the same words wherever it happened (the scanner, the code box, the Check-In page).
// `bare` leaves out the big status icon, for where the scanner's own ring already shows it.
export default function CheckInOutcome({ outcome, onDone, onConfirmReward, onChoose, busy, doneLabel = 'Done', bare }: { bare?: boolean; outcome: Outcome; onDone: () => void; onConfirmReward?: () => void; onChoose?: (which: 'meeting' | 'ticket') => void; busy?: boolean; doneLabel?: string }) {
  if (outcome.kind === 'choose') {
    return (
      <div className={`${styles.box} ${bare ? styles.bare : ''}`}>
        <span className={`${styles.icon} ${styles.info}`}><CircleAlert size={32} aria-hidden="true" /></span>
        <strong className={styles.title}>Which one is it?</strong>
        <span className={styles.detail}>That code fits both a meeting and a ticket.</span>
        <div className={styles.choices}>
          <Button onClick={() => onChoose?.('meeting')} loading={busy}>Meeting: {outcome.meeting}</Button>
          <Button variant="secondary" onClick={() => onChoose?.('ticket')} disabled={busy}>Ticket: {outcome.ticket}</Button>
        </div>
        <Button variant="secondary" onClick={onDone} disabled={busy}>Cancel</Button>
      </div>
    );
  }
  if (outcome.kind === 'meeting') {
    return (
      <div className={`${styles.box} ${bare ? styles.bare : ''}`}>
        <span className={`${styles.icon} ${styles.ok}`}><Check size={34} strokeWidth={2.5} aria-hidden="true" /></span>
        <span className={styles.kicker}>Meeting check-in</span>
        <strong className={styles.title}>{outcome.already ? 'Already checked in' : 'You’re checked in'}</strong>
        <span className={styles.detail}>{outcome.title} · {clock(outcome.at)}</span>
        {bare && <span className={styles.note}>Taking you to the meeting’s question and doc…</span>}
        <Button onClick={onDone}>{doneLabel}</Button>
      </div>
    );
  }
  if (outcome.kind === 'ticket') {
    const fresh = outcome.status === 'active';
    return (
      <div className={`${styles.box} ${bare ? styles.bare : ''}`}>
        <span className={`${styles.icon} ${fresh ? styles.ok : styles.warn}`}>{fresh ? <Check size={34} strokeWidth={2.5} aria-hidden="true" /> : <TriangleAlert size={34} strokeWidth={2} aria-hidden="true" />}</span>
        <span className={styles.kicker}>Event ticket{outcome.eventTitle ? ` · ${outcome.eventTitle}` : ''}</span>
        <strong className={styles.title}>{outcome.userName}</strong>
        <span className={styles.detail}>
          {fresh
            ? (outcome.dayTotal && outcome.dayTotal > 1 ? `Checked in — day ${outcome.dayNumber ?? '?'} of ${outcome.dayTotal}` : 'Checked in')
            : outcome.status === 'used' ? `Already checked in${outcome.at ? ` at ${clock(outcome.at)}` : ''}${outcome.selfCheckin ? ' (self check-in)' : ''}` : `Ticket ${outcome.status}`}
        </span>
        {fresh && outcome.requiresForm && <div className={styles.badge}><strong>AS Form still to do</strong><span>Tell them: “Scanning isn’t check-in — finish your AS Form on your phone now.”</span></div>}
        {!fresh && outcome.status === 'used' && outcome.requiresForm && <div className={styles.badge}>{outcome.formCompleted ? 'AS Form opened — check their “response recorded” screen' : 'AS Form not opened yet'}</div>}
        {fresh && !!outcome.points && <span className={styles.points}>+{outcome.points} pts{outcome.lifetime !== undefined && outcome.tier ? ` · ${outcome.lifetime.toLocaleString()} pts · ${outcome.tier}` : ''}</span>}
        <Button onClick={onDone}>{doneLabel}</Button>
      </div>
    );
  }
  if (outcome.kind === 'reward') {
    const pending = outcome.status === 'pending';
    return (
      <div className={`${styles.box} ${bare ? styles.bare : ''}`}>
        <span className={`${styles.icon} ${styles.info}`}><Gift size={30} aria-hidden="true" /></span>
        <span className={styles.kicker}>Reward pickup</span>
        <strong className={styles.title}>{outcome.title}</strong>
        <span className={styles.detail}>For {outcome.member} · {outcome.cost} pts</span>
        {pending ? (
          <>
            <span className={styles.note}>Nothing is marked as given until you confirm.</span>
            <div className={styles.row}>
              <Button variant="secondary" onClick={onDone} disabled={busy}>Cancel</Button>
              <Button onClick={onConfirmReward} loading={busy}>Confirm Given</Button>
            </div>
          </>
        ) : (
          <>
            <span className={styles.note}>This reward is already {outcome.status}.</span>
            <Button onClick={onDone}>{doneLabel}</Button>
          </>
        )}
      </div>
    );
  }
  if (outcome.kind === 'rewardDone') {
    return (
      <div className={`${styles.box} ${bare ? styles.bare : ''}`}>
        <span className={`${styles.icon} ${styles.ok}`}><Check size={34} strokeWidth={2.5} aria-hidden="true" /></span>
        <span className={styles.kicker}>Reward pickup</span>
        <strong className={styles.title}>Marked as given</strong>
        <span className={styles.detail}>{outcome.title} · {outcome.member}</span>
        <Button onClick={onDone}>{doneLabel}</Button>
      </div>
    );
  }
  return (
    <div className={`${styles.box} ${bare ? styles.bare : ''}`}>
      <span className={`${styles.icon} ${styles.bad}`}><CircleAlert size={32} aria-hidden="true" /></span>
      <strong className={styles.title}>Didn’t work</strong>
      <span className={styles.detail}>{outcome.message}</span>
      <Button onClick={onDone}>Try Again</Button>
    </div>
  );
}
