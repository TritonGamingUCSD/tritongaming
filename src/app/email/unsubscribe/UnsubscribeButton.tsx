'use client';

import { useState } from 'react';
import styles from './unsubscribe.module.css';

export default function UnsubscribeButton({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  async function go() {
    setState('busy');
    const r = await fetch('/api/email/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: token }) }).catch(() => null);
    setState(r?.ok ? 'done' : 'error');
  }
  if (state === 'done') return <p className={styles.done}>Done. You can turn it back on any time in your <a className={styles.link} href="/portal/profile">profile</a>.</p>;
  return (
    <>
      <button type="button" className={styles.button} onClick={go} disabled={state === 'busy'}>{state === 'busy' ? 'Saving…' : 'Yes, Stop These Emails'}</button>
      {state === 'error' && <p className={styles.error}>That didn’t save. Try again.</p>}
    </>
  );
}
