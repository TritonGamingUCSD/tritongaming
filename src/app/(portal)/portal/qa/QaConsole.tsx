'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, EyeOff, Lock, LockOpen, Play, Radio, Trash2, Tv, Undo2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import DetailHeader from '@/components/ui/DetailHeader';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import { Field, Input } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import { useVisiblePoll } from '@/lib/ui/useVisiblePoll';
import { SESSION_NAMES, rankQuestions, type QaStatus } from '@/lib/qa/rank';
import { call, type QaView, type QuestionInfo } from './api';
import polls from '../polls/polls.module.css';
import styles from './qa.module.css';

const REFRESH_MS = 3000;

// One Q&A as its host runs it from a laptop or phone: open and close it, approve the questions that come in (or all of them at once), put one on the big screen, mark it answered, hide what should not be seen. The big screen
// itself is a separate page (Open Big Screen) so the audience never sees this one.
export default function QaConsole({ slug, onBack, onRun, onDeleted }: { slug: string; onBack: () => void; onRun: () => void; onDeleted: () => void }) {
  const [view, setView] = useState<QaView | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await call<QaView>(`/api/qa/${slug}`);
    if (r.ok) {
      setView(r.data);
      setName((n) => n || r.data.session.name);
    } else setError(r.error);
  }, [slug]);
  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);
  useVisiblePoll(load, REFRESH_MS, !!view);

  if (!view) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading the Q&A…" />;
  const { session, questions } = view;
  const send = async (url: string, method: 'PATCH' | 'DELETE', body?: unknown) => {
    setBusy(true);
    setError('');
    const r = await call<QaView>(url, method, body);
    setBusy(false);
    if (r.ok) setView(r.data);
    else setError(r.error);
    return r.ok;
  };
  const act = (action: string) => send(`/api/qa/${slug}`, 'PATCH', { action });
  const set = (q: QuestionInfo, body: { status?: QaStatus; spotlight?: boolean }) => send(`/api/qa/${slug}/questions/${q.id}`, 'PATCH', body);
  const close = async () => {
    if (await confirmHold({ title: 'Close This Q&A?', message: 'Guests won’t be able to send questions or like any more.', confirmLabel: 'Hold To Close' })) void act('close');
  };
  const remove = async () => {
    if (!(await confirmHold({ title: 'Delete This Q&A?', message: `“${session.name}” and all its questions are deleted.`, confirmLabel: 'Hold To Delete' }))) return;
    const r = await call(`/api/qa/${slug}`, 'DELETE');
    if (r.ok) onDeleted();
    else setError(r.error);
  };
  const dropQuestion = async (q: QuestionInfo) => {
    if (await confirmHold({ title: 'Delete This Question?', message: 'It is removed for good.', confirmLabel: 'Hold To Delete' }))
      void send(`/api/qa/${slug}/questions/${q.id}`, 'DELETE');
  };

  const by = (s: QaStatus) => questions.filter((q) => q.status === s);
  const waiting = by('pending');
  const shown = rankQuestions(by('approved'));
  const done = by('answered');
  const hidden = by('hidden');
  const author = (q: QuestionInfo) => (q.author ? `Asked by ${q.author}` : 'Anonymous');

  return (
    <div className={polls.stack}>
      <DetailHeader
        back={{ label: 'All Q&A', onClick: onBack }}
        title={session.name}
        chip={SESSION_NAMES[session.status]}
        actions={
          <>
            <Button size="sm" onClick={onRun}>
              <Tv size={15} aria-hidden="true" /> Open Big Screen
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void remove()}
              disabled={session.status === 'open'}
              title={session.status === 'open' ? 'Close it first' : 'Delete the Q&A'}
            >
              <Trash2 size={15} aria-hidden="true" /> Delete
            </Button>
          </>
        }
      />
      {error && (
        <div role="alert" onClick={() => setError('')}>
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      <section className={polls.panel}>
        <h2>Settings</h2>
        <Field label="Name">
          <Input
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name.trim() !== session.name && void send(`/api/qa/${slug}`, 'PATCH', { name })}
          />
        </Field>
        <div className={polls.head}>
          {session.status === 'draft' && (
            <Button onClick={() => void act('open')} loading={busy}>
              <Play size={16} aria-hidden="true" /> Open For Questions
            </Button>
          )}
          {session.status === 'open' && (
            <>
              <Button variant="secondary" onClick={() => void close()}>
                <Lock size={16} aria-hidden="true" /> Close Q&amp;A
              </Button>
              <span className={styles.codeLine}>
                <Radio size={16} aria-hidden="true" /> Code <b>{session.code}</b>
              </span>
            </>
          )}
          {session.status === 'closed' && (
            <Button variant="secondary" onClick={() => void act('reopen')} loading={busy}>
              <LockOpen size={16} aria-hidden="true" /> Open Again
            </Button>
          )}
        </div>
        {session.status === 'draft' && <p className={polls.hint}>Opening gives the code. Put the big screen up so guests can scan the QR code.</p>}
      </section>

      <section className={polls.panel}>
        <div className={polls.panelHead}>
          <h2>
            Waiting For You <span className={polls.count}>{waiting.length}</span>
          </h2>
          {waiting.length > 1 && (
            <Button size="sm" variant="secondary" onClick={() => void act('approve_all')} disabled={busy}>
              <Check size={15} aria-hidden="true" /> Approve All
            </Button>
          )}
        </div>
        {waiting.length === 0 ? (
          <p className={polls.hint}>
            {session.status === 'open' ? 'Nothing waiting. New questions show up here by themselves.' : 'Questions that guests send wait here until you approve them.'}
          </p>
        ) : (
          <ul className={styles.questions}>
            {waiting.map((q) => (
              <li key={q.id} className={styles.question}>
                <div>
                  <p>{q.body}</p>
                  <small>{author(q)}</small>
                </div>
                <div className={styles.acts}>
                  <Button size="sm" onClick={() => void set(q, { status: 'approved' })} disabled={busy}>
                    <Check size={15} aria-hidden="true" /> Approve
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => void set(q, { status: 'hidden' })} disabled={busy}>
                    <EyeOff size={15} aria-hidden="true" /> Hide
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={polls.panel}>
        <h2>
          On The List <span className={polls.count}>{shown.length}</span>
        </h2>
        {shown.length === 0 ? (
          <p className={polls.hint}>Approved questions appear here, the most liked first.</p>
        ) : (
          <ul className={styles.questions}>
            {shown.map((q) => {
              const on = session.spotlight_id === q.id;
              return (
                <li key={q.id} className={`${styles.question} ${on ? styles.onScreen : ''}`}>
                  <div>
                    <p>{q.body}</p>
                    <small>
                      {author(q)} · {q.likes} {q.likes === 1 ? 'like' : 'likes'}
                      {on ? ' · On the big screen' : ''}
                    </small>
                  </div>
                  <div className={styles.acts}>
                    <Button size="sm" variant={on ? 'secondary' : 'primary'} onClick={() => void set(q, { spotlight: !on })} disabled={busy}>
                      <Tv size={15} aria-hidden="true" /> {on ? 'Take Off Screen' : 'Show On Screen'}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => void set(q, { status: 'answered' })} disabled={busy}>
                      <Check size={15} aria-hidden="true" /> Answered
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => void set(q, { status: 'hidden' })} disabled={busy} aria-label="Hide this question">
                      <EyeOff size={15} aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section className={polls.panel}>
          <h2>
            Answered <span className={polls.count}>{done.length}</span>
          </h2>
          <ul className={styles.questions}>
            {done.map((q) => (
              <li key={q.id} className={`${styles.question} ${styles.answered}`}>
                <div>
                  <p>{q.body}</p>
                  <small>
                    {author(q)} · {q.likes} {q.likes === 1 ? 'like' : 'likes'}
                  </small>
                </div>
                <div className={styles.acts}>
                  <Button size="sm" variant="secondary" onClick={() => void set(q, { status: 'approved' })} disabled={busy}>
                    <Undo2 size={15} aria-hidden="true" /> Put Back
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hidden.length > 0 && (
        <section className={polls.panel}>
          <h2>
            Hidden <span className={polls.count}>{hidden.length}</span>
          </h2>
          <ul className={styles.questions}>
            {hidden.map((q) => (
              <li key={q.id} className={`${styles.question} ${styles.answered}`}>
                <div>
                  <p>{q.body}</p>
                  <small>{author(q)}</small>
                </div>
                <div className={styles.acts}>
                  <Button size="sm" variant="secondary" onClick={() => void set(q, { status: 'approved' })} disabled={busy}>
                    <Undo2 size={15} aria-hidden="true" /> Approve
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => void dropQuestion(q)} disabled={busy} aria-label="Delete this question">
                    <Trash2 size={15} aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
