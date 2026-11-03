'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Star } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { call } from '@/lib/ui/apiCall';
import { MAX_SCORE, type EntryInfo, type PollMode, type PollStatus, type Standing } from '@/lib/polls/tally';
import { PollBars } from './PollBars';
import styles from './polls.module.css';

interface Loaded {
  poll: { id: string; name: string; mode: PollMode; status: PollStatus };
  entries: EntryInfo[];
  mine: { entry_id: string; value: number }[];
  standings: Standing[] | null;
  voters: number | null;
}
const ORDINAL = ['1st', '2nd', '3rd'];
const POLL_MS = 20_000; // backstop only: changes arrive by broadcast

// What a guest sees on their phone (and a member too): the entries as cards, a way to choose that fits the poll, and one button to send the vote. The vote can be changed until the host closes voting. Once the results are shown, they show here.
// `code` is what was typed or scanned; after the first answer the poll's id is used, so the screen keeps working after the code is given back.
export default function PollPlay({ code, onLeave }: { code: string; onLeave: () => void }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState('');
  const [gone, setGone] = useState(false);
  const [one, setOne] = useState<string | null>(null);
  const [top, setTop] = useState<string[]>([]); // entry ids in order: 1st, 2nd, 3rd
  const [scores, setScores] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const key = useRef(code);
  const seeded = useRef(false);

  const load = useCallback(async () => {
    const r = await call<Loaded>(`/api/polls/play/${key.current}`);
    if (r.ok) {
      key.current = r.data.poll.id;
      setData(r.data);
      setError('');
      if (!seeded.current) {
        seeded.current = true;
        const mine = r.data.mine;
        if (r.data.poll.mode === 'one') setOne(mine[0]?.entry_id ?? null);
        if (r.data.poll.mode === 'top3') setTop([...mine].sort((a, b) => b.value - a.value).map((v) => v.entry_id));
        if (r.data.poll.mode === 'score') setScores(Object.fromEntries(mine.map((v) => [v.entry_id, v.value])));
        if (mine.length) setSaved(JSON.stringify(mine.map((v) => [v.entry_id, v.value]).sort()));
      }
    } else if (r.status === 404) {
      setGone(true);
      setError(r.error);
    } else setError(r.error);
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);
  const id = data?.poll.id;
  const status = data?.poll.status;
  useEffect(() => {
    if (!id || status === 'revealed') return;
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
  }, [id, status, load]);

  const mode = data?.poll.mode;
  const votes = useMemo(() => {
    if (mode === 'one') return one ? [{ entry_id: one, value: 1 }] : [];
    if (mode === 'top3') return top.map((e, i) => ({ entry_id: e, value: 3 - i }));
    return Object.entries(scores)
      .filter(([, v]) => v > 0)
      .map(([entry_id, value]) => ({ entry_id, value }));
  }, [mode, one, top, scores]);
  const signature = JSON.stringify(votes.map((v) => [v.entry_id, v.value]).sort());
  const changed = votes.length > 0 && signature !== saved;

  const send = async () => {
    if (!data) return;
    setBusy(true);
    setError('');
    const r = await call<{ mine: unknown }>(`/api/polls/play/${data.poll.id}/vote`, 'POST', { votes });
    setBusy(false);
    if (r.ok) setSaved(signature);
    else {
      setError(r.error);
      if (r.status === 409) void load();
    }
  };

  if (gone) {
    return (
      <div className={styles.voteCard}>
        <h1>No Poll Here</h1>
        <p className={styles.hint}>{error || 'That code isn’t a poll right now.'}</p>
        <button type="button" className={styles.bigBtn} onClick={onLeave}>
          Try Another Code
        </button>
      </div>
    );
  }
  if (!data) return <p className={styles.hint}>{error || 'Loading the poll…'}</p>;
  const { poll, entries } = data;
  const open = poll.status === 'open';
  const how =
    poll.mode === 'one'
      ? 'Tap your favourite.'
      : poll.mode === 'top3'
        ? 'Tap your 1st, 2nd and 3rd choice, in that order. Tap a choice again to take it back.'
        : 'Give each one you want a score from 1 to 5 stars.';

  return (
    <div className={styles.play}>
      <header className={styles.playHead}>
        <p className={styles.kicker}>Poll</p>
        <h1>{poll.name}</h1>
        {open && <p className={styles.playHow}>{how}</p>}
        {poll.status === 'closed' && <p className={styles.playNote}>Voting is closed. Watch the screen for the results!</p>}
        {poll.status === 'revealed' && <p className={styles.playNote}>The results are in. Thanks for voting!</p>}
      </header>

      {poll.status === 'revealed' && data.standings ? (
        <PollBars standings={data.standings} mode={poll.mode} />
      ) : (
        <ul className={styles.voteGrid}>
          {entries.map((e) => {
            const place = top.indexOf(e.id);
            const picked = poll.mode === 'one' ? one === e.id : poll.mode === 'top3' ? place >= 0 : (scores[e.id] ?? 0) > 0;
            const body = (
              <>
                <span className={styles.voteImg}>
                  {e.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.image} alt="" loading="lazy" />
                  ) : (
                    <span className={styles.voteNum}>{e.number}</span>
                  )}
                  <span className={styles.voteBadge}>#{e.number}</span>
                  {poll.mode === 'top3' && place >= 0 && <span className={styles.votePlace}>{ORDINAL[place]}</span>}
                  {poll.mode === 'one' && picked && (
                    <span className={styles.votePlace}>
                      <Check size={16} aria-hidden="true" />
                    </span>
                  )}
                </span>
                <b>{e.name}</b>
                {e.subtitle && <i>{e.subtitle}</i>}
              </>
            );
            return (
              <li key={e.id} className={`${styles.voteItem} ${picked ? styles.voteOn : ''}`}>
                {poll.mode === 'score' ? (
                  <div className={styles.voteBtn}>
                    {body}
                    <span className={styles.stars} role="radiogroup" aria-label={`Score for ${e.name}`}>
                      {Array.from({ length: MAX_SCORE }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          type="button"
                          role="radio"
                          aria-checked={(scores[e.id] ?? 0) === n}
                          aria-label={`${n} star${n === 1 ? '' : 's'}`}
                          disabled={!open}
                          className={(scores[e.id] ?? 0) >= n ? styles.starOn : ''}
                          onClick={() => setScores((s) => ({ ...s, [e.id]: s[e.id] === n ? 0 : n }))}
                        >
                          <Star size={26} aria-hidden="true" />
                        </button>
                      ))}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.voteBtn}
                    disabled={!open}
                    aria-pressed={picked}
                    onClick={() => {
                      if (poll.mode === 'one') setOne(e.id);
                      else setTop((t) => (t.includes(e.id) ? t.filter((x) => x !== e.id) : t.length < 3 ? [...t, e.id] : t));
                    }}
                  >
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {open && (
        <div className={styles.sendBar}>
          <span className={styles.sendText} role="status">
            {error
              ? error
              : changed
                ? saved
                  ? 'You changed your vote.'
                  : votes.length
                    ? 'Ready to send.'
                    : ''
                : saved
                  ? 'Your vote is in. You can change it until voting closes.'
                  : 'Make your choice, then send it.'}
          </span>
          <button type="button" className={styles.bigBtn} onClick={() => void send()} disabled={busy || !changed}>
            {busy ? 'Sending…' : saved ? (changed ? 'Change My Vote' : 'Vote Sent') : 'Send My Vote'}
          </button>
        </div>
      )}
    </div>
  );
}
