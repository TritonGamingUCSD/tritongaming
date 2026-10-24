'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import Loading from '@/components/Loading/Loading';
import { cleanCode } from '@/lib/trivia/game';
import { call } from './api';
import PlayGame from './PlayGame';
import { ordinal } from './shapes';
import styles from './trivia.module.css';

interface Mine { code: string; quiz: string; status: string; created_at: string; score: number; rank: number | null; of: number | null; blocked: boolean }
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' });

// Join a game with its code, and the games you played. A game's QR code opens this with the code already in the address.
export default function PlayTab({ onOpen }: { onOpen: (code: string | null) => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<Mine[] | null>(null);
  useEffect(() => { let on = true; void call<{ games: Mine[] }>('GET', '/api/trivia/mine').then((r) => { if (on && r.ok) setMine(r.data.games); }); return () => { on = false; }; }, []);
  const join = async () => {
    const code = cleanCode(text);
    if (!code) { setError('A code is 6 letters and numbers.'); return; }
    setBusy(true); setError('');
    const r = await call('POST', '/api/trivia/join', { code });
    setBusy(false);
    if (r.ok) onOpen(code); else setError(r.error);
  };
  return (
    <div className={styles.tab}>
      <div className={styles.joinBox}>
        <span className={styles.tape} aria-hidden="true" />
        <h2>Join a Game</h2>
        <p className={styles.muted}>Scan the QR code on the screen with your camera, or type the code shown there.</p>
        <input className={styles.codeInput} value={text} maxLength={40} inputMode="text" autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="CODE" aria-label="Game code" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void join(); }} />
        {error && <div role="alert"><Notice tone="error">{error}</Notice></div>}
        <Button loading={busy} disabled={!text.trim()} onClick={() => void join()}>Join</Button>
      </div>
      <h2 className={styles.sectionTitle}>Your Games</h2>
      {!mine ? <Loading variant="inline" label="Loading…" /> : mine.length === 0 ? <div className={styles.empty}><p>You haven’t played a game yet.</p></div> : (
        <div className={styles.list}>
          {mine.map((g) => (
            <div key={g.code} className={styles.item}>
              <div className={styles.itemMain}><b>{g.quiz}</b><span className={styles.muted}>{day(g.created_at)}{g.status === 'done' && g.rank ? ` · ${ordinal(g.rank)} of ${g.of}` : ''} · {g.score.toLocaleString('en-US')} points</span></div>
              {g.status === 'done' ? <span className={`${styles.badge} ${styles.neutral}`}>Finished</span> : g.blocked ? <span className={`${styles.badge} ${styles.bad}`}>Not in</span> : <Button size="sm" onClick={() => onOpen(g.code)}>Rejoin</Button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// A game opened from its address (the QR code, a shared link, or Rejoin): make sure the person is in it, then show it.
export function PlayEntry({ code, onLeave }: { code: string; onLeave: () => void }) {
  const [ok, setOk] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let on = true;
    const c = cleanCode(code);
    if (!c) { setError('That isn’t a game code.'); setOk(false); return; }
    void call('POST', '/api/trivia/join', { code: c }).then((r) => { if (!on) return; if (r.ok) setOk(true); else { setError(r.error); setOk(false); } });
    return () => { on = false; };
  }, [code]);
  if (ok === null) return <Loading variant="inline" label="Joining…" />;
  if (!ok) return <div className={styles.tab}><Notice tone="error">{error}</Notice><div><Button variant="secondary" onClick={onLeave}>Back</Button></div></div>;
  return <PlayGame code={cleanCode(code)!} onLeave={onLeave} />;
}
