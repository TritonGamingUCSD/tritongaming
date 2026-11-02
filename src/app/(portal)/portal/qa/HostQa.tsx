'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, EyeOff, Lock, LockOpen, Play, SkipForward, X } from 'lucide-react';
import Notice from '@/components/ui/Notice';
import { confirmHold } from '@/lib/ui/confirmHold';
import { SESSION_NAMES, nextQuestion, rankQuestions } from '@/lib/qa/rank';
import TriviaQr from '../trivia/TriviaQr';
import { call, type QaView } from './api';
import polls from '../polls/polls.module.css';
import styles from './qa.module.css';

const REFRESH_MS = 2000;

// A Q&A on the big screen. Draft: ready to open. Open: the QR code and 6-digit code to ask with, and either the question the host put on the screen (large) or, until then, the most liked questions. The controls are for the host
// (Space or Enter does the main step: show the top question, or mark the shown one answered and show the next). Only questions the host approved are ever shown here, so a rude one never reaches the screen.
export default function HostQa({ slug, onExit }: { slug: string; onExit: () => void }) {
  const [view, setView] = useState<QaView | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(t);
  }, []);

  const load = useCallback(async () => {
    const r = await call<QaView>(`/api/qa/${slug}`);
    if (r.ok) {
      setView(r.data);
      setError('');
    } else setError(r.error);
  }, [slug]);
  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    const every = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, REFRESH_MS);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(every);
    };
  }, [load]);

  const act = async (action: string) => {
    setBusy(true);
    const r = await call<QaView>(`/api/qa/${slug}`, 'PATCH', { action });
    setBusy(false);
    if (r.ok) {
      setView(r.data);
      setError('');
    } else setError(r.error);
  };
  const close = async () => {
    if (await confirmHold({ title: 'Close This Q&A?', message: 'Guests won’t be able to send questions or like any more.', confirmLabel: 'Hold To Close' })) void act('close');
  };

  const session = view?.session;
  const approved = view ? view.questions.filter((q) => q.status === 'approved') : [];
  const spot = view ? approved.find((q) => q.id === session?.spotlight_id) : undefined;
  const upNext = rankQuestions(approved.filter((q) => q.id !== spot?.id)).slice(0, 3);
  const waiting = view ? view.questions.filter((q) => q.status === 'pending').length : 0;
  const hasNext = view ? !!nextQuestion(view.questions, spot?.id ?? null) : false;

  // Keys for a clicker: Space, Enter or Page Down does the main step.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!session || busy || e.metaKey || e.ctrlKey || e.altKey || !['Enter', ' ', 'PageDown'].includes(e.key)) return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(t.tagName))) return;
      if (session.status === 'draft') void act('open');
      else if (session.status === 'open' && (spot || hasNext)) void act('next');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const stage = (
    <div className={polls.host} role="dialog" aria-label={session ? `Q&A: ${session.name}` : 'Q&A'}>
      <div className={polls.hostBar}>
        <b>{session?.name ?? 'Q&A'}</b>
        {session && <span className={polls.state}>{SESSION_NAMES[session.status]}</span>}
        {waiting > 0 && <span className={polls.state}>{waiting} waiting for approval</span>}
        <span className={polls.spacer} />
        <button type="button" className={polls.exit} onClick={onExit}>
          <X size={16} aria-hidden="true" /> Exit
        </button>
      </div>
      <div className={polls.hostBody}>
        {error && <Notice tone="error">{error}</Notice>}
        {!view && !error && <p className={polls.hint}>Loading…</p>}
        {session && session.status === 'draft' && (
          <div className={polls.hostCenter}>
            <h1>Ready For Questions</h1>
            <p className={polls.hostLead}>When you open it, a code and a QR code appear for guests. Every question waits for your OK.</p>
            <button type="button" className={polls.bigBtn} onClick={() => void act('open')} disabled={busy}>
              <Play size={22} aria-hidden="true" /> Open For Questions
            </button>
          </div>
        )}
        {session && session.status !== 'draft' && (
          <div className={polls.hostOpen}>
            {session.status === 'open' && session.code && (
              <div className={polls.join}>
                <p className={polls.kicker}>Ask a question</p>
                <TriviaQr url={`${origin}/vote/${session.code}`} size={260} />
                <p className={polls.joinText}>Scan the QR code, or go to</p>
                <p className={polls.joinUrl}>{origin.replace(/^https?:\/\//, '')}/vote</p>
                <p className={polls.joinText}>and type</p>
                <p className={polls.codeBig} aria-label={`Code ${session.code}`}>
                  {session.code}
                </p>
              </div>
            )}
            <div className={polls.hostMain}>
              {session.status === 'closed' && <h1 className={polls.hostLead}>This Q&amp;A is closed. Thanks for asking!</h1>}
              {spot ? (
                <figure className={styles.spot} style={{ margin: 0 }}>
                  <blockquote>{spot.body}</blockquote>
                  <cite>
                    {spot.author ? `— ${spot.author}` : '— Anonymous'} · {spot.likes} {spot.likes === 1 ? 'like' : 'likes'}
                  </cite>
                </figure>
              ) : (
                <p className={polls.hostLead}>
                  {approved.length ? 'Press Show Top Question to put the most liked question up here.' : 'Questions show up here once you approve them.'}
                </p>
              )}
              {upNext.length > 0 && (
                <div className={styles.next}>
                  <h2>{spot ? 'Up Next' : 'Most Liked'}</h2>
                  {upNext.map((q) => (
                    <p key={q.id} className={styles.nextItem}>
                      <span>{q.body}</span>
                      <span className={styles.likeCount}>{q.likes} ♥</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {session && session.status !== 'draft' && (
        <div className={polls.hostControls}>
          {session.status === 'open' ? (
            <>
              <button type="button" className={polls.ctrl} onClick={() => void close()} disabled={busy}>
                <Lock size={18} aria-hidden="true" /> Close Q&amp;A
              </button>
              {spot && (
                <button type="button" className={polls.ctrl} onClick={() => void act('clear_screen')} disabled={busy}>
                  <EyeOff size={18} aria-hidden="true" /> Clear Screen
                </button>
              )}
              <button type="button" className={`${polls.ctrl} ${polls.ctrlMain}`} onClick={() => void act('next')} disabled={busy || (!spot && !hasNext)}>
                {spot ? (
                  <>
                    <Check size={18} aria-hidden="true" /> Answered · {hasNext ? 'Next' : 'Done'}
                  </>
                ) : (
                  <>
                    <SkipForward size={18} aria-hidden="true" /> Show Top Question
                  </>
                )}
              </button>
            </>
          ) : (
            <button type="button" className={polls.ctrl} onClick={() => void act('reopen')} disabled={busy}>
              <LockOpen size={18} aria-hidden="true" /> Open Again
            </button>
          )}
        </div>
      )}
    </div>
  );
  return mounted ? createPortal(stage, document.body) : null;
}
