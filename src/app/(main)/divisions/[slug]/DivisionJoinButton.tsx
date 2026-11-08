'use client';

import { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import SignInDialog from '@/components/auth/SignInDialog';
import styles from './division.module.css';

// "Ask To Join" on a division's public page, aware of who is looking: signed out it opens a sign-in popup and comes back here; signed in it sends the request its Heads answer (the same request the portal sends) and shows where it stands. Members of the division see nothing.
export default function DivisionJoinButton({ id, name, path }: { id: string; name: string; path: string }) {
  const [status, setStatus] = useState<'loading' | 'out' | 'none' | 'pending' | 'member' | 'declined'>('loading');
  const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    (async () => {
      const {
        data: { user },
      } = await createClient().auth.getUser();
      if (!live) return;
      if (!user || user.is_anonymous) return setStatus('out');
      const r = await fetch(`/api/divisions/${id}/join`, { cache: 'no-store' });
      const j = r.ok ? await r.json() : { status: 'none' };
      if (!live) return;
      setStatus(j.status);
      setClosed(!!j.closed);
    })().catch(() => {
      if (live) setStatus('out');
    });
    return () => {
      live = false;
    };
  }, [id]);

  async function ask() {
    setBusy(true);
    setError('');
    const r = await fetch(`/api/divisions/${id}/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (r?.ok || r?.status === 409) setStatus('pending');
    else setError(j.error || 'Could not send that.');
  }

  if (status === 'loading' || status === 'member') return null;
  if (status === 'pending') return <span className={`${styles.applyBtn} ${styles.joinBtn}`}>Asked ✓ The Heads Will Reply</span>;
  if (closed) return <span className={`${styles.applyBtn} ${styles.joinBtn}`}>Not Taking Requests</span>;
  return (
    <>
      <button type="button" className={`${styles.applyBtn} ${styles.joinBtn}`} disabled={busy} onClick={() => (status === 'out' ? setSignIn(true) : ask())}>
        <UserPlus size={15} strokeWidth={1.75} aria-hidden="true" /> {status === 'declined' ? 'Ask Again' : 'Ask To Join'}
      </button>
      {error && <small role="alert">{error}</small>}
      {signIn && <SignInDialog next={path} reason={`Sign in to ask to join ${name}.`} onClose={() => setSignIn(false)} />}
    </>
  );
}
