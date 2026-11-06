'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import styles from './tournaments.module.css';

// Sign up for a tournament from its public page, or claim an entry an organizer typed in for you (with the code they gave you). Needs an account; a guest is asked to sign in first and comes back here.
export default function JoinPanel({ slug, id, type, teamSize, onDone }: { slug: string; id: string; type: 'solo' | 'team'; teamSize: number; onDone: () => void }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [team, setTeam] = useState('');
  const [mates, setMates] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void createClient()
      .auth.getUser()
      .then(({ data }) => setSignedIn(!!data.user && !data.user.is_anonymous));
  }, []);
  const send = async (method: string, body: object, ok: string) => {
    setBusy(true);
    setMsg(null);
    const r = await fetch(`/api/tournaments/${id}/entrants`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    setMsg(r?.ok ? { ok: true, text: ok } : { ok: false, text: j.error || 'That did not work.' });
    if (r?.ok) onDone();
  };
  if (signedIn === null) return null;
  if (!signedIn)
    return (
      <section className={styles.join}>
        <b>Sign-ups are open.</b>
        <Link href={`/login?next=${encodeURIComponent(`/tournaments/${slug}`)}`}>Sign in to join →</Link>
      </section>
    );
  return (
    <section className={styles.join}>
      <b>Sign-ups are open</b>
      {type === 'team' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(
              'POST',
              {
                self: true,
                name: team,
                members: mates
                  .split(',')
                  .map((n) => n.trim())
                  .filter(Boolean)
                  .slice(0, teamSize - 1)
                  .map((name) => ({ name })),
              },
              'Your team is signed up.',
            );
          }}
        >
          <input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Team name" maxLength={40} aria-label="Team name" />
          <input value={mates} onChange={(e) => setMates(e.target.value)} placeholder={`Teammates, separated by commas (up to ${teamSize - 1})`} aria-label="Teammates" />
          <button type="submit" disabled={busy || !team.trim()}>
            Sign up my team
          </button>
        </form>
      ) : (
        <button type="button" disabled={busy} onClick={() => send('POST', { self: true }, 'You are signed up.')}>
          Sign up
        </button>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send('POST', { claim: code }, 'Linked to your account.');
        }}
      >
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Claim code from an organizer" maxLength={8} aria-label="Claim code" />
        <button type="submit" disabled={busy || code.length < 4}>
          Claim my entry
        </button>
      </form>
      <button type="button" className={styles.link} disabled={busy} onClick={() => send('DELETE', { self: true }, 'You are out of the tournament.')}>
        Withdraw
      </button>
      {msg && (
        <p role="status" className={msg.ok ? styles.okMsg : styles.errMsg}>
          {msg.text}
        </p>
      )}
    </section>
  );
}
