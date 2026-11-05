'use client';

import { Check, CircleAlert, Gift, Info, TriangleAlert } from 'lucide-react';
import Button from '@/components/ui/Button';
import type { ReactNode } from 'react';
import { formatPacificTime } from '@/lib/core/timezone';
import type { Outcome } from '@/lib/checkin/anyCode';
import styles from './CheckInOutcome.module.css';

const clock = (iso?: string) => (iso ? formatPacificTime(iso) : '');

type Tone = 'ok' | 'warn' | 'bad' | 'info';

// One flat result card for every outcome: a colored icon tile (Byte waves when it worked), what it was and the headline, the details in plain rows, any points that were earned, and the buttons.
function Card({
  tone,
  icon,
  kicker,
  title,
  bare,
  points,
  children,
  actions,
}: {
  tone: Tone;
  icon: ReactNode;
  kicker?: string;
  title: string;
  bare?: boolean;
  points?: number;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={`${styles.card} ${styles[tone]} ${bare ? styles.bare : ''}`}>
      <div className={styles.head}>
        <span className={styles.tile} aria-hidden="true">
          {tone === 'ok' ? (
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={styles.draw}>
              <path d="M5 12.5l4.5 4.5L19 7" />
            </svg>
          ) : (
            icon
          )}
        </span>
        <div className={styles.headText}>
          {kicker && <span className={styles.kicker}>{kicker}</span>}
          <strong className={styles.title}>{title}</strong>
        </div>
        {!!points && (
          <span className={styles.pts} aria-label={`${points} points earned`}>
            <span className={styles.ptsGhost} aria-hidden="true">
              +{points}
            </span>
            +{points} pts
          </span>
        )}
      </div>
      {children && <div className={styles.rows}>{children}</div>}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <p className={styles.row}>
    <span>{label}</span>
    <b>{children}</b>
  </p>
);

// Says exactly what a check-in did, in the same words wherever it happened (the scanner, the code box, the Check-In page).
// `bare` is the scanner's sheet, where its own ring already shows the outcome: lighter, and no big icon.
export default function CheckInOutcome({
  outcome,
  onDone,
  onConfirmReward,
  onConfirmEvent,
  busy,
  doneLabel = 'Done',
  bare,
  noButton,
}: {
  bare?: boolean;
  /** The caller moves on by itself (and on a tap on the card): no button. */ noButton?: boolean;
  outcome: Outcome;
  onDone: () => void;
  onConfirmReward?: () => void;
  onConfirmEvent?: () => void;
  busy?: boolean;
  doneLabel?: string;
}) {
  if (outcome.kind === 'info') {
    return (
      <Card
        tone="info"
        icon={<Info size={26} />}
        title={outcome.title}
        bare={bare}
        actions={
          !noButton && (
            <Button variant="secondary" onClick={onDone}>
              {doneLabel}
            </Button>
          )
        }
      >
        <p className={styles.plain}>{outcome.message}</p>
      </Card>
    );
  }
  if (outcome.kind === 'confirmEvent') {
    return (
      <Card
        tone="warn"
        icon={<TriangleAlert size={26} />}
        kicker="Wrong event?"
        title={outcome.userName}
        bare={bare}
        actions={
          <>
            <Button variant="secondary" onClick={onDone} disabled={busy}>
              Cancel, wrong ticket
            </Button>
            <Button variant="secondary" onClick={onConfirmEvent} loading={busy}>
              Check in to {outcome.eventTitle || 'that event'}
            </Button>
          </>
        }
      >
        <p className={styles.plain}>
          This ticket is for <b>{outcome.eventTitle || 'another event'}</b>, but <b>{outcome.nowEvent}</b> {outcome.nowEvent.includes(' and ') ? 'are' : 'is'} on right now. Nobody
          has been checked in.
        </p>
      </Card>
    );
  }
  if (outcome.kind === 'meeting') {
    return (
      <Card
        tone="ok"
        icon={<Check size={26} />}
        kicker="Meeting check-in"
        title={outcome.already ? 'Already checked in' : 'You’re checked in'}
        bare={bare}
        actions={<Button onClick={onDone}>{doneLabel}</Button>}
      >
        <Row label="Meeting">{outcome.title}</Row>
        <Row label="Time">{clock(outcome.at)}</Row>
        {bare && <p className={styles.note}>Taking you to the meeting’s question and doc…</p>}
      </Card>
    );
  }
  if (outcome.kind === 'online') {
    return (
      <Card tone="ok" icon={<Check size={26} />} kicker="Online check-in" title="You’re checked in" bare={bare} actions={<Button onClick={onDone}>{doneLabel}</Button>}>
        <Row label="Event">{outcome.eventTitle}</Row>
      </Card>
    );
  }
  if (outcome.kind === 'ticket') {
    const fresh = outcome.status === 'active';
    const status = fresh
      ? outcome.dayTotal && outcome.dayTotal > 1
        ? `Checked in, day ${outcome.dayNumber ?? '?'} of ${outcome.dayTotal}`
        : 'Checked in'
      : outcome.status === 'used'
        ? `Already checked in${outcome.at ? ` at ${clock(outcome.at)}` : ''}${outcome.selfCheckin ? ' (self check-in)' : ''}`
        : `Ticket ${outcome.status}`;
    return (
      <Card
        tone={fresh ? 'ok' : 'warn'}
        icon={fresh ? <Check size={26} /> : <TriangleAlert size={26} />}
        kicker="Event ticket"
        title={outcome.userName}
        bare={bare}
        points={fresh ? outcome.points : undefined}
        actions={!noButton && <Button onClick={onDone}>{doneLabel}</Button>}
      >
        {outcome.eventTitle && <Row label="Event">{outcome.eventTitle}</Row>}
        <Row label="Status">{status}</Row>
        {fresh && outcome.lifetime !== undefined && outcome.tier && <Row label="Level">{`${outcome.tier} · ${outcome.lifetime.toLocaleString()} pts`}</Row>}
        {fresh && outcome.requiresForm && (
          <div className={styles.callout}>
            <strong>AS Form still to do</strong>
            <span>Tell them: “Scanning isn’t check-in. Finish your AS Form on your phone now.”</span>
          </div>
        )}
        {!fresh && outcome.status === 'used' && outcome.requiresForm && (
          <div className={styles.callout}>{outcome.formCompleted ? 'AS Form opened. Check their “response recorded” screen.' : 'AS Form not opened yet.'}</div>
        )}
      </Card>
    );
  }
  if (outcome.kind === 'reward') {
    const pending = outcome.status === 'pending';
    return (
      <Card
        tone="info"
        icon={<Gift size={26} />}
        kicker="Reward pickup"
        title={outcome.title}
        bare={bare}
        actions={
          pending ? (
            <>
              <Button variant="secondary" onClick={onDone} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={onConfirmReward} loading={busy}>
                Confirm given
              </Button>
            </>
          ) : (
            <Button onClick={onDone}>{doneLabel}</Button>
          )
        }
      >
        <Row label="For">{outcome.member}</Row>
        <Row label="Cost">{outcome.cost} pts</Row>
        <p className={styles.note}>{pending ? 'Nothing is marked as given until you confirm.' : `This reward is already ${outcome.status}.`}</p>
      </Card>
    );
  }
  if (outcome.kind === 'rewardDone') {
    return (
      <Card tone="ok" icon={<Check size={26} />} kicker="Reward pickup" title="Marked as given" bare={bare} actions={!noButton && <Button onClick={onDone}>{doneLabel}</Button>}>
        <Row label="Reward">{outcome.title}</Row>
        <Row label="Member">{outcome.member}</Row>
      </Card>
    );
  }
  return (
    <Card tone="bad" icon={<CircleAlert size={26} />} title="Didn’t work" bare={bare} actions={<Button onClick={onDone}>Try again</Button>}>
      <p className={styles.plain}>{outcome.kind === 'error' ? outcome.message : ''}</p>
    </Card>
  );
}
