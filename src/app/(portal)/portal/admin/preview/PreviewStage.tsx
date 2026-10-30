'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import Button from '@/components/ui/Button';
import ByteWink from '@/components/Bytecode/ByteWink';
import ScanOpening from '@/components/portal/ScanOpening';
import CheckInOutcome from '@/components/portal/CheckInOutcome';
import type { Outcome } from '@/lib/checkin/anyCode';
import ticketStyles from '../../tickets/fullscreenqr.module.css';
import BytecodeDemo, { TGcodeDemo } from './BytecodeDemo';
import ThemePair from './ThemePair';
import ScanTestDemo from './ScanTestDemo';
import Bytecode from '@/components/Bytecode/Bytecode';
import TGcode from '@/components/TGcode/TGcode';
import styles from './preview.module.css';

// One preview at a time, chosen by its slug (see catalog.ts). Each one plays with sample data; nothing here talks to the server.
function Replay({ onClick, label = 'Play Again' }: { onClick: () => void; label?: string }) {
  return (
    <div className={styles.bar}>
      <Button variant="secondary" onClick={onClick}>
        {label}
      </Button>
    </div>
  );
}

function ByteWinkDemo() {
  const [run, setRun] = useState(0);
  return (
    <div className={styles.stage}>
      <Replay onClick={() => setRun((n) => n + 1)} />
      <ThemePair>
        <div className={styles.box}>
          <ByteWink key={run} />
        </div>
      </ThemePair>
    </div>
  );
}

// The ticket screen's time left (see tickets/FullscreenQR.tsx): a ring round the TGcode, a line under the Bytecode. A 30 second cycle, played from the start.
function CodeRingDemo() {
  const [run, setRun] = useState(0);
  const ring = (byte: boolean) => (
    <div key={`${byte}${run}`}>
      <div className={ticketStyles.qrWrapper}>
        {!byte && (
          <svg className={ticketStyles.countdownRing} viewBox="0 0 100 100" aria-hidden="true">
            <circle className={ticketStyles.countdownTrack} cx="50" cy="50" r="48" />
            <circle className={ticketStyles.countdownFill} cx="50" cy="50" r="48" style={{ animationDuration: '30s' }} />
          </svg>
        )}
        <div className={ticketStyles.qrCanvas} style={{ width: '100%' }}>
          {byte ? <Bytecode payload="t00ffeeddccbb" /> : <TGcode payload="t00ffeeddccbb" />}
        </div>
      </div>
      {byte && (
        <div className={ticketStyles.byteBar}>
          <div className={ticketStyles.byteBarFill} style={{ animationDuration: '30s' }} />
        </div>
      )}
    </div>
  );
  return (
    <div className={styles.stage}>
      <Replay onClick={() => setRun((n) => n + 1)} />
      <ThemePair>
        {ring(false)}
        {ring(true)}
      </ThemePair>
    </div>
  );
}

function ScanOpeningDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.stage}>
      <div className={styles.bar}>
        <Button
          variant="secondary"
          onClick={() => {
            setOpen(true);
            setTimeout(() => setOpen(false), 2500);
          }}
        >
          Show It For 2.5 Seconds
        </Button>
      </div>
      {open && <ScanOpening />}
    </div>
  );
}

const NOW = '2026-10-29T21:41:07.000Z'; // fixed, so the server and the browser draw the same time
const SAMPLES: [string, Outcome][] = [
  ['Meeting', { kind: 'meeting', title: 'General Meeting', at: NOW, already: false }],
  ['Meeting, Already In', { kind: 'meeting', title: 'General Meeting', at: NOW, already: true }],
  ['Ticket', { kind: 'ticket', status: 'used', userName: 'Sample Person', eventTitle: 'Sample Night', at: NOW, points: 25, lifetime: 130, tier: 'Silver' }],
  ['Ticket, Later Day', { kind: 'ticket', status: 'used', userName: 'Sample Person', eventTitle: 'Sample Night', at: NOW, dayNumber: 2, dayTotal: 3, laterDay: true }],
  ['Reward', { kind: 'reward', id: 'sample', status: 'pending', title: 'Sample Sticker', member: 'Sample Person', cost: 50 }],
  ['Reward Handed Over', { kind: 'rewardDone', title: 'Sample Sticker', member: 'Sample Person' }],
  ['Which One?', { kind: 'choose', code: '123456', meeting: 'General Meeting', ticket: 'Sample Night' }],
  [
    'Wrong Event?',
    { kind: 'confirmEvent', userName: 'Sample Person', eventTitle: 'Sample Night', nowEvent: 'Game Jam', ticketId: 'sample', eventId: 'sample' } as unknown as Outcome,
  ],
];

function CheckInResultsDemo() {
  const [run, setRun] = useState(0);
  return (
    <div className={styles.stage}>
      <Replay onClick={() => setRun((n) => n + 1)} />
      <ThemePair>
        {SAMPLES.map(([name, outcome]) => (
          <figure key={`${name}${run}`} className={styles.card} style={{ width: '100%' }}>
            <div className={styles.wide}>
              <CheckInOutcome outcome={outcome} onDone={() => {}} noButton />
            </div>
            <figcaption>{name}</figcaption>
          </figure>
        ))}
      </ThemePair>
    </div>
  );
}

function TicketCheckedInDemo() {
  const [run, setRun] = useState(0);
  const [tierUp, setTierUp] = useState(false);
  const [byte, setByte] = useState(false);
  return (
    <div className={styles.stage}>
      <div className={styles.bar}>
        <Button variant="secondary" onClick={() => setRun((n) => n + 1)}>
          Play Again
        </Button>
        <Button variant="secondary" onClick={() => setTierUp((v) => !v)}>
          {tierUp ? 'Without Tier Up' : 'With Tier Up'}
        </Button>
        <Button variant="secondary" onClick={() => setByte((v) => !v)}>
          {byte ? 'Show The Check Mark' : 'Show Byte Instead'}
        </Button>
      </div>
      <div className={`${styles.card} ${styles.dark}`} key={run}>
        <div className={ticketStyles.checkedInState}>
          <div className={ticketStyles.checkedInIcon} aria-hidden="true" style={byte ? { width: '8rem', height: '8rem', background: 'transparent', boxShadow: 'none' } : undefined}>
            {byte ? <ByteWink /> : <Check size={32} strokeWidth={2} />}
          </div>
          <div className={ticketStyles.checkedInTitle}>You&apos;re Checked In!</div>
          <div className={ticketStyles.checkedInTime}>9:41:07 PM</div>
          <div className={`${ticketStyles.pointsEarned} pp-dark`}>
            <span className={ticketStyles.pointsEarnedNumber}>+25</span>
            <span className={ticketStyles.pointsEarnedLabel}>points earned</span>
            {tierUp && (
              <div className={ticketStyles.tierUp} style={{ '--tier-color': '#c0c0c0' } as React.CSSProperties}>
                <div className={ticketStyles.confetti} aria-hidden="true">
                  {Array.from({ length: 18 }, (_, i) => (
                    <span key={i} style={{ '--i': i } as React.CSSProperties} />
                  ))}
                </div>
                <div className={ticketStyles.tierUpKicker}>Tier up!</div>
                <div className={ticketStyles.tierUpName}>Silver</div>
                <div className={ticketStyles.tierUpFrom}>you were Bronze</div>
              </div>
            )}
          </div>
          <p className={ticketStyles.hint}>Have a great time — see you inside.</p>
        </div>
      </div>
    </div>
  );
}

// The site's shared motion (src/app/globals.css); each plays on its own swatch.
const SITE: [string, string, string][] = [
  ['logo-pop', 'Logo Pop', 'logo-pop 0.9s ease both'],
  ['float', 'Float', 'float 3s ease-in-out infinite'],
  ['tag-slide-up', 'Tag Slide Up', 'tag-slide-up 0.8s ease both'],
  ['hero-title-enter', 'Hero Title Enter', 'hero-title-enter 1s ease both'],
  ['yellow-glow-pulse', 'Yellow Glow Pulse', 'yellow-glow-pulse 2.4s ease-in-out infinite'],
  ['btn-shimmer', 'Button Shimmer', 'btn-shimmer 2s linear infinite'],
  ['main-card-shimmer', 'Card Shimmer', 'main-card-shimmer 3s linear infinite'],
  ['blue-aurora', 'Blue Aurora', 'blue-aurora 6s ease-in-out infinite'],
  ['tgPendingSpin', 'Pending Spinner', 'tgPendingSpin 0.9s linear infinite'],
  ['tgPendingBar', 'Pending Bar', 'tgPendingBar 1.4s ease-in-out infinite'],
];

function SiteAnimationsDemo() {
  const [run, setRun] = useState(0);
  return (
    <div className={styles.stage}>
      <Replay onClick={() => setRun((n) => n + 1)} />
      <div className={styles.cards}>
        {SITE.map(([name, title, animation]) => (
          <figure key={`${name}${run}`} className={styles.card}>
            <div className={styles.swatch} style={{ animation }}>
              {name === 'tgPendingSpin' ? '◜' : 'TG'}
            </div>
            <figcaption>{title}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

export default function PreviewStage({ slug }: { slug: string }) {
  switch (slug) {
    case 'bytecode':
      return <BytecodeDemo />;
    case 'tgcode':
      return <TGcodeDemo />;
    case 'code-ring':
      return <CodeRingDemo />;
    case 'scan-test':
      return <ScanTestDemo />;
    case 'byte-wink':
      return <ByteWinkDemo />;
    case 'scan-opening':
      return <ScanOpeningDemo />;
    case 'check-in-results':
      return <CheckInResultsDemo />;
    case 'ticket-checked-in':
      return <TicketCheckedInDemo />;
    case 'site-animations':
      return <SiteAnimationsDemo />;
    default:
      return null;
  }
}
