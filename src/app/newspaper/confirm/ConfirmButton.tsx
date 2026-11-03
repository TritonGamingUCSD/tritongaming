'use client';

import { useState } from 'react';
import styles from '../../email/unsubscribe/unsubscribe.module.css';

export default function ConfirmButton({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  async function go() {
    setState('busy');
    const r = await fetch('/api/newspaper/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: token }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setError(j.error ?? 'That didn’t save. Try again.');
    setState(r?.ok ? 'done' : 'error');
  }
  if (state === 'done') return <p className={styles.done}>You’re in! The next issue will come to this address.</p>;
  return (
    <>
      <button type="button" className={styles.button} onClick={go} disabled={state === 'busy'}>
        {state === 'busy' ? 'Saving…' : 'Yes, Sign Me Up'}
      </button>
      {state === 'error' && <p className={styles.error}>{error}</p>}
    </>
  );
}
