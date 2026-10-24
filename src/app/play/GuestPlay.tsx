'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';
import Loading from '@/components/Loading/Loading';
import { cleanCode } from '@/lib/trivia/game';
import { call } from '../(portal)/portal/trivia/api';
import PlayGame from '../(portal)/portal/trivia/PlayGame';
import { FloatShapes, Stage, Tape } from '../(portal)/portal/trivia/shapes';
import styles from '../(portal)/portal/trivia/trivia.module.css';

const NICK_KEY = 'tg-trivia-nickname';
const read = () => { try { return localStorage.getItem(NICK_KEY) ?? ''; } catch { return ''; } };
const keep = (v: string) => { try { localStorage.setItem(NICK_KEY, v); } catch { /* the nickname just is not remembered */ } };

// Playing Trivia without an account: type the game's code (or arrive from its QR code), pick a nickname, play. A person who is signed in with an account goes to the portal's Trivia instead and plays as themselves.
// A guest is signed in anonymously (a temporary session, no profile) only so the game can tell their answers apart; it can reach nothing else on the site.
export default function GuestPlay({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(cleanCode(initialCode) ?? '');
  const [typed, setTyped] = useState('');
  const [nick, setNick] = useState('');
  const [error, setError] = useState('');
  const [membersOnly, setMembersOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [checking, setChecking] = useState(true);

  const join = useCallback(async (c: string, name: string) => {
    setBusy(true); setError('');
    const sb = createClient();
    let { data: { user } } = await sb.auth.getUser();
    if (!user) {
      const r = await sb.auth.signInAnonymously();
      if (r.error) { setBusy(false); setError('Couldn’t start. Check your connection and try again.'); return; }
      user = r.data.user;
    }
    const r = await call('POST', '/api/trivia/join', { code: c, nickname: name });
    setBusy(false);
    if (r.ok) { keep(name); setPlaying(true); return; }
    setMembersOnly(r.status === 403 && /members/i.test(r.error));
    setError(r.error);
  }, []);

  // Someone with an account plays as themselves in the portal; a guest who was here before (a refresh) goes straight back into the game.
  useEffect(() => {
    let on = true;
    void createClient().auth.getUser().then(({ data: { user } }) => {
      if (!on) return;
      if (user && !user.is_anonymous) { window.location.replace(code ? `/portal/trivia/play/${code}` : '/portal/trivia/play'); return; }
      const saved = read();
      setNick(saved);
      if (user && code && saved.length >= 2) void join(code, saved);
      setChecking(false);
    });
    return () => { on = false; };
  }, [code, join]);

  if (playing && code) return <PlayGame code={code} onLeave={() => { setPlaying(false); setCode(''); history.replaceState(null, '', '/play'); }} />;

  const goCode = () => { const c = cleanCode(typed); if (!c) { setError('A code is 6 numbers.'); return; } setError(''); setCode(c); history.replaceState(null, '', `/play/${c}`); };
  return (
    <Stage>
      <div className={styles.stage} role="dialog" aria-label="Play Trivia"><FloatShapes />
        <div className={styles.stageBar}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.logo} src="/logos/tg_logo.png" alt="" />
          <b>Trivia</b>
        </div>
        <div className={`${styles.stageBody} ${styles.center}`}>
          {checking ? <Loading variant="inline" label="Loading…" /> : (
            <div className={styles.guestCard}>
              <Tape />
              <p className={styles.kicker}>{code ? 'Join the game' : 'Play Trivia'}</p>
              {!code ? (
                <>
                  <p className={styles.guestHow}>Type the 6-digit code shown on the big screen.</p>
                  <input className={styles.guestInput} value={typed} inputMode="numeric" autoComplete="off" autoFocus maxLength={12} placeholder="000000" aria-label="Game code" onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') goCode(); }} />
                  <Button disabled={!typed.trim()} onClick={goCode}>Next</Button>
                </>
              ) : (
                <>
                  <p className={styles.guestHow}>Game <b>{code}</b>. Pick a nickname the others will see on the big screen.</p>
                  <input className={styles.guestInput} value={nick} maxLength={20} autoComplete="off" autoFocus placeholder="Your nickname" aria-label="Nickname" onChange={(e) => setNick(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && nick.trim().length >= 2) void join(code, nick); }} />
                  <Button loading={busy} disabled={nick.trim().length < 2} onClick={() => void join(code, nick)}>Join Game</Button>
                </>
              )}
              {error && <p role="alert" className={styles.guestError}>{error}</p>}
              {membersOnly && <a className={styles.guestLink} href={`/login?next=${encodeURIComponent(`/portal/trivia/play/${code}`)}`}>Sign in to play</a>}
              {!membersOnly && <a className={styles.guestLink} href={`/login?next=${encodeURIComponent(code ? `/portal/trivia/play/${code}` : '/portal/trivia/play')}`}>I have an account</a>}
            </div>
          )}
        </div>
      </div>
    </Stage>
  );
}
