'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, Lock, LockOpen, Play, X } from 'lucide-react';
import Notice from '@/components/ui/Notice';
import { confirmHold } from '@/lib/ui/confirmHold';
import { Confetti } from '../photobooth/Confetti';
import TriviaQr from '../trivia/TriviaQr';
import { call, STATUS_NAMES, type PollView } from './api';
import { PollBars } from './PollBars';
import styles from './polls.module.css';

const POLL_MS = 2000;
const STEP_MS = 1500; // between one place being revealed and the next

// A poll run on the big screen. Draft: ready to open. Open: the QR code and the 6-digit code to vote with, how many votes are in, and either the live bars or just the entries (the poll's setting). Closed: Reveal, or open again.
// Revealed: the places come in from last to first and the winner is marked with confetti. The host sees the counts on the screen only as the poll's setting allows, because the screen is what the audience sees.
export default function HostPoll({ slug, onExit }: { slug: string; onExit: () => void }) {
  const [view, setView] = useState<PollView | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<number | null>(null); // places on screen while the reveal plays (null: all of them)
  const [mounted, setMounted] = useState(false);
  const stepper = useRef<number | undefined>(undefined);
  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(t);
  }, []);

  const load = useCallback(async () => {
    const r = await call<PollView>(`/api/polls/${slug}`);
    if (r.ok) {
      setView(r.data);
      setError('');
    } else setError(r.error);
  }, [slug]);
  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    const every = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(every);
    };
  }, [load]);
  useEffect(() => () => window.clearInterval(stepper.current), []);

  const act = async (action: 'open' | 'close' | 'reopen' | 'reveal') => {
    setBusy(true);
    const r = await call<PollView>(`/api/polls/${slug}`, 'PATCH', { action });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setError('');
    setView(r.data);
    if (action === 'reveal') {
      // the places come in one at a time, last place first
      window.clearInterval(stepper.current);
      setShown(0);
      let n = 0;
      stepper.current = window.setInterval(() => {
        n++;
        setShown(n);
        if (n >= r.data.standings.length) {
          window.clearInterval(stepper.current);
          setShown(null);
        }
      }, STEP_MS);
    }
  };
  const close = async () => {
    if (await confirmHold({ title: 'Close Voting?', message: 'Guests won’t be able to vote or change their vote.', confirmLabel: 'Hold To Close' })) void act('close');
  };

  // Keys for a clicker: Space, Enter or Page Down does the main step.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!view || busy || e.metaKey || e.ctrlKey || e.altKey || !['Enter', ' ', 'PageDown'].includes(e.key)) return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(t.tagName))) return;
      if (view.poll.status === 'draft' && view.entries.length >= 2) void act('open');
      else if (view.poll.status === 'closed') void act('reveal');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const poll = view?.poll;
  const live = poll?.reveal === 'live';
  const stage = (
    <div className={styles.host} role="dialog" aria-label={poll ? `Poll: ${poll.name}` : 'Poll'}>
      <div className={styles.hostBar}>
        <b>{poll?.name ?? 'Poll'}</b>
        {poll && <span className={styles.state}>{STATUS_NAMES[poll.status]}</span>}
        <span className={styles.spacer} />
        <button type="button" className={styles.exit} onClick={onExit}>
          <X size={16} aria-hidden="true" /> Exit
        </button>
      </div>
      <div className={styles.hostBody}>
        {error && <Notice tone="error">{error}</Notice>}
        {!view && !error && <p className={styles.hint}>Loading…</p>}
        {view && poll && (
          <>
            {poll.status === 'draft' && (
              <div className={styles.hostCenter}>
                <h1>Ready To Open Voting</h1>
                <p className={styles.hostLead}>{view.entries.length} entries. When you open voting, a code and a QR code appear for guests.</p>
                <Entries entries={view.entries} />
                <button type="button" className={styles.bigBtn} onClick={() => void act('open')} disabled={busy || view.entries.length < 2}>
                  <Play size={22} aria-hidden="true" /> Open Voting
                </button>
              </div>
            )}

            {poll.status === 'open' && (
              <div className={styles.hostOpen}>
                <div className={styles.join}>
                  <p className={styles.kicker}>Vote now</p>
                  {poll.code && <TriviaQr url={`${origin}/vote/${poll.code}`} size={260} />}
                  <p className={styles.joinText}>Scan the QR code, or go to</p>
                  <p className={styles.joinUrl}>{origin.replace(/^https?:\/\//, '')}/vote</p>
                  <p className={styles.joinText}>and type</p>
                  <p className={styles.codeBig} aria-label={`Code ${poll.code}`}>
                    {poll.code}
                  </p>
                  <p className={styles.voted} role="status">
                    <b>{view.voters}</b> {view.voters === 1 ? 'person has' : 'people have'} voted
                  </p>
                </div>
                <div className={styles.hostMain}>
                  {live ? <PollBars standings={view.standings} mode={poll.mode} big /> : <Entries entries={view.entries} big />}
                  {!live && <p className={styles.hostLead}>Results stay hidden until you reveal them.</p>}
                </div>
              </div>
            )}

            {poll.status === 'closed' && (
              <div className={styles.hostCenter}>
                <h1>Voting Is Closed</h1>
                <p className={styles.hostLead}>
                  {view.voters} {view.voters === 1 ? 'person' : 'people'} voted.
                </p>
                {live ? <PollBars standings={view.standings} mode={poll.mode} /> : <Entries entries={view.entries} />}
              </div>
            )}

            {poll.status === 'revealed' && (
              <div className={styles.hostCenter}>
                {shown === null && <Confetti />}
                <h1>{shown === null ? 'The Results' : 'And The Results Are…'}</h1>
                <PollBars standings={view.standings} mode={poll.mode} shown={shown ?? view.standings.length} big />
                {shown === null && (
                  <p className={styles.hostLead}>
                    {view.voters} {view.voters === 1 ? 'person' : 'people'} voted.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {view && poll && (poll.status === 'open' || poll.status === 'closed') && (
        <div className={styles.hostControls}>
          {poll.status === 'open' ? (
            <>
              <button type="button" className={styles.ctrl} onClick={() => void close()} disabled={busy}>
                <Lock size={18} aria-hidden="true" /> Close Voting
              </button>
              {live === false && (
                <button type="button" className={`${styles.ctrl} ${styles.ctrlMain}`} onClick={() => void act('reveal')} disabled={busy}>
                  <Eye size={18} aria-hidden="true" /> Reveal Now
                </button>
              )}
            </>
          ) : (
            <>
              <button type="button" className={styles.ctrl} onClick={() => void act('reopen')} disabled={busy}>
                <LockOpen size={18} aria-hidden="true" /> Open Voting Again
              </button>
              <button type="button" className={`${styles.ctrl} ${styles.ctrlMain}`} onClick={() => void act('reveal')} disabled={busy}>
                <Eye size={18} aria-hidden="true" /> Reveal Results
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
  return mounted ? createPortal(stage, document.body) : null;
}

/** The entries as numbered cards with their pictures (what guests choose from). */
function Entries({ entries, big = false }: { entries: { id: string; number: number; name: string; subtitle: string; image: string }[]; big?: boolean }) {
  return (
    <ul className={`${styles.entryCards} ${big ? styles.entryCardsBig : ''}`}>
      {entries.map((e) => (
        <li key={e.id} className={styles.entryCard}>
          {e.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.image} alt="" loading="lazy" />
          ) : (
            <span className={styles.entryCardNum}>{e.number}</span>
          )}
          <b>
            #{e.number} {e.name}
          </b>
          {e.subtitle && <i>{e.subtitle}</i>}
        </li>
      ))}
    </ul>
  );
}
