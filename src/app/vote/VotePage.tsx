'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import PollPlay from '../(portal)/portal/polls/PollPlay';
import QaPlay from '../(portal)/portal/qa/QaPlay';
import styles from '../(portal)/portal/polls/polls.module.css';

// Voting in a poll, or asking in a Q&A, without an account: type the 6-digit code (or arrive from the QR code) and vote. Someone signed in with an account votes as themselves; everyone else is signed in anonymously (a temporary session, no profile) only so one phone
// has one vote, and that session can reach nothing else on the site.
export default function VotePage({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const [typed, setTyped] = useState('');
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState('');
  const [kind, setKind] = useState<{ code: string; qa: boolean } | null>(null); // what the code is: a poll (the default) or a Q&A

  const session = useCallback(async () => {
    const sb = createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (user) return true;
    const r = await sb.auth.signInAnonymously();
    return !r.error;
  }, []);
  useEffect(() => {
    let on = true;
    void session().then((ok) => {
      if (!on) return;
      setReady(ok);
      if (!ok) setProblem('Couldn’t start. Check your connection and reload the page.');
    });
    return () => {
      on = false;
    };
  }, [session]);

  useEffect(() => {
    if (!code) return;
    let on = true;
    void fetch(`/api/polls/lookup/${code}`, { cache: 'no-store' })
      .then((r) => r.json())
      .catch(() => ({}))
      .then((j) => on && setKind({ code, qa: j.kind === 'qa' }));
    return () => {
      on = false;
    };
  }, [code]);

  const go = () => {
    if (!/^[0-9]{6}$/.test(typed.trim())) return setProblem('A code is 6 numbers.');
    setProblem('');
    setCode(typed.trim());
    history.replaceState(null, '', `/vote/${typed.trim()}`);
  };
  return (
    <main className={styles.votePage}>
      {!code ? (
        <div className={styles.voteCard}>
          <p className={styles.kicker}>Vote</p>
          <h1>Enter The Code</h1>
          <p className={styles.hint}>Type the 6-digit code shown on the big screen.</p>
          <input
            className={styles.codeInput}
            value={typed}
            inputMode="numeric"
            autoComplete="off"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            aria-label="6-digit code"
            autoFocus
            onChange={(e) => setTyped(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => e.key === 'Enter' && go()}
          />
          {problem && <p className={styles.problem}>{problem}</p>}
          <button type="button" className={styles.bigBtn} onClick={go} disabled={typed.length !== 6 || !ready}>
            Continue
          </button>
          <p className={styles.fine}>Playing Trivia instead? Use the code at tritongaming.org/play.</p>
        </div>
      ) : ready && kind?.code === code ? (
        (() => {
          const leave = () => {
            setCode('');
            setTyped('');
            setKind(null);
            history.replaceState(null, '', '/vote');
          };
          return kind.qa ? <QaPlay key={code} code={code} onLeave={leave} /> : <PollPlay key={code} code={code} onLeave={leave} />;
        })()
      ) : (
        <p className={styles.hint}>{problem || 'Starting…'}</p>
      )}
      <p className={styles.brand}>Triton Gaming · Gaming Org at UC San Diego</p>
    </main>
  );
}
