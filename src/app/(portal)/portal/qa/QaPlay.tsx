'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Send, ThumbsUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { call } from '@/lib/ui/apiCall';
import { MAX_AUTHOR, MAX_BODY, type QaSessionStatus, type QaStatus } from '@/lib/qa/rank';
import polls from '../polls/polls.module.css';
import styles from './qa.module.css';

interface Loaded {
  session: { id: string; name: string; status: QaSessionStatus };
  spotlight_id: string | null;
  questions: { id: string; body: string; author: string; status: QaStatus; likes: number; liked: boolean; mine: boolean }[];
  mine: { id: string; body: string; status: QaStatus; created_at: string }[];
}
const POLL_MS = 20_000; // backstop only: changes arrive by broadcast
const NAME_KEY = 'tg-qa-name';
const remember = (name?: string): string => {
  try {
    if (name !== undefined) localStorage.setItem(NAME_KEY, name);
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
};

// What a guest sees on their phone: a box to send a question (your name is optional), the questions the host has let through with a like button for each, and what became of your own questions.
// `code` is what was typed or scanned; after the first answer the session's id is used.
export default function QaPlay({ code, onLeave }: { code: string; onLeave: () => void }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState('');
  const [gone, setGone] = useState(false);
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState('');
  const key = useRef(code);

  useEffect(() => {
    const t = window.setTimeout(() => setName(remember()), 0);
    return () => window.clearTimeout(t);
  }, []);
  const load = useCallback(async () => {
    const r = await call<Loaded>(`/api/qa/play/${key.current}`);
    if (r.ok) {
      key.current = r.data.session.id;
      setData(r.data);
      setError('');
    } else if (r.status === 404) {
      setGone(true);
      setError(r.error);
    } else setError(r.error);
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);
  const id = data?.session.id;
  useEffect(() => {
    if (!id) return;
    const every = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    const channel = createClient()
      .channel(`poll:${id}`)
      .on('broadcast', { event: 'state' }, () => void load())
      .subscribe();
    const wake = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', wake);
    return () => {
      window.clearInterval(every);
      document.removeEventListener('visibilitychange', wake);
      void createClient().removeChannel(channel);
    };
  }, [id, load]);

  const ask = async () => {
    if (!data || !text.trim() || busy) return;
    setBusy(true);
    setError('');
    setSent('');
    const r = await call<{ question: unknown }>(`/api/qa/play/${data.session.id}/ask`, 'POST', { body: text, author: name });
    setBusy(false);
    if (r.ok) {
      remember(name.trim());
      setText('');
      setSent('Sent! The host will look at it before it goes up.');
      void load();
    } else {
      setError(r.error);
      if (r.status === 409) void load();
    }
  };
  const like = async (qid: string, on: boolean) => {
    if (!data) return;
    setData({ ...data, questions: data.questions.map((q) => (q.id === qid ? { ...q, liked: on, likes: q.likes + (on ? 1 : -1) } : q)) }); // shown at once; the next refresh confirms it
    const r = await call<{ ok: true }>(`/api/qa/play/${data.session.id}/like`, 'POST', { question_id: qid, on });
    if (!r.ok) setError(r.error);
    void load();
  };

  if (gone) {
    return (
      <div className={polls.voteCard}>
        <h1>No Q&amp;A Here</h1>
        <p className={polls.hint}>{error || 'That code isn’t a Q&A right now.'}</p>
        <button type="button" className={polls.bigBtn} onClick={onLeave}>
          Try Another Code
        </button>
      </div>
    );
  }
  if (!data) return <p className={polls.hint}>{error || 'Loading the Q&A…'}</p>;
  const open = data.session.status === 'open';
  const spot = data.questions.find((q) => q.id === data.spotlight_id);
  const live = data.questions.filter((q) => q.status === 'approved' && q.id !== data.spotlight_id);
  const done = data.questions.filter((q) => q.status === 'answered');
  const label = (s: QaStatus, qid: string) =>
    qid === data.spotlight_id
      ? 'On the big screen now'
      : s === 'pending'
        ? 'Waiting for the host'
        : s === 'approved'
          ? 'Up for the room'
          : s === 'answered'
            ? 'Answered'
            : 'Not shown';

  const row = (q: Loaded['questions'][number]) => (
    <li key={q.id} className={`${styles.question} ${q.id === data.spotlight_id ? styles.onScreen : ''} ${q.status === 'answered' ? styles.answered : ''}`}>
      <div>
        <p>{q.body}</p>
        <small>
          {q.author ? `Asked by ${q.author}` : 'Anonymous'}
          {q.mine ? ' (you)' : ''}
        </small>
      </div>
      {q.status === 'answered' ? (
        <span className={`${styles.chip} ${styles.chipOk}`}>
          <Check size={13} aria-hidden="true" /> Answered
        </span>
      ) : (
        <button type="button" className={styles.likes} aria-pressed={q.liked} disabled={!open} onClick={() => void like(q.id, !q.liked)}>
          <ThumbsUp size={16} aria-hidden="true" /> {q.likes}
          <span className="sr-only">{q.liked ? ' liked, tap to take back' : ' like'}</span>
        </button>
      )}
    </li>
  );

  return (
    <div className={styles.qaPlay}>
      <header className={polls.playHead}>
        <p className={polls.kicker}>Q&amp;A</p>
        <h1>{data.session.name}</h1>
        {!open && <p className={polls.playNote}>This Q&amp;A is closed. Thanks for asking!</p>}
      </header>

      {open && (
        <form
          className={styles.ask}
          onSubmit={(e) => {
            e.preventDefault();
            void ask();
          }}
        >
          <label className="sr-only" htmlFor="qa-body">
            Your question
          </label>
          <textarea id="qa-body" rows={3} value={text} maxLength={MAX_BODY} placeholder="Ask your question…" onChange={(e) => setText(e.target.value)} />
          <label className="sr-only" htmlFor="qa-name">
            Your name (optional)
          </label>
          <input
            id="qa-name"
            value={name}
            maxLength={MAX_AUTHOR}
            placeholder="Your name (optional, blank is anonymous)"
            autoComplete="given-name"
            onChange={(e) => setName(e.target.value)}
          />
          <div className={styles.askFoot}>
            <span role="status">
              {error ? <b className={polls.problem}>{error}</b> : sent ? <span className={styles.ok}>{sent}</span> : 'The host checks each question first.'}
            </span>
            <span>
              {text.length}/{MAX_BODY}
            </span>
          </div>
          <button type="submit" className={polls.bigBtn} disabled={busy || !text.trim()}>
            <Send size={18} aria-hidden="true" /> {busy ? 'Sending…' : 'Send Question'}
          </button>
        </form>
      )}
      {!open && error && <p className={polls.problem}>{error}</p>}

      {spot && (
        <section className={styles.section} aria-label="On the big screen">
          <h2>On The Big Screen</h2>
          <ul className={styles.questions}>{row(spot)}</ul>
        </section>
      )}
      <section className={styles.section} aria-label="Questions">
        <h2>Questions{live.length ? ` (${live.length})` : ''}</h2>
        {live.length ? (
          <ul className={styles.questions}>{live.map(row)}</ul>
        ) : (
          <p className={polls.hint}>{spot ? 'No other questions yet.' : 'No questions up yet. Be the first to ask!'}</p>
        )}
      </section>
      {done.length > 0 && (
        <section className={styles.section} aria-label="Answered">
          <h2>Answered</h2>
          <ul className={styles.questions}>{done.map(row)}</ul>
        </section>
      )}
      {data.mine.length > 0 && (
        <section className={styles.section} aria-label="Your questions">
          <h2>Your Questions</h2>
          <ul className={styles.questions}>
            {data.mine.map((q) => (
              <li key={q.id} className={styles.question}>
                <p>{q.body}</p>
                <span className={`${styles.chip} ${q.status === 'approved' || q.status === 'answered' ? styles.chipOk : ''}`}>{label(q.status, q.id)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
