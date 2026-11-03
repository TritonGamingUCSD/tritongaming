'use client';

import { useState } from 'react';
import styles from '../email/unsubscribe/unsubscribe.module.css';
import form from './subscribe.module.css';

export default function SubscribeForm() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [trap, setTrap] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [message, setMessage] = useState('');
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setState('busy');
    setMessage('');
    const r = await fetch('/api/newspaper/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, website: trap }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) {
      setState('done');
      setMessage(j.message ?? 'Check your email.');
    } else {
      setState('idle');
      setMessage(j.error ?? 'We couldn’t reach the server. Try again.');
    }
  }
  if (state === 'done') return <p className={styles.done}>{message}</p>;
  return (
    <form onSubmit={go} className={form.form}>
      <label className={form.label}>
        Email
        <input
          className={form.input}
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </label>
      <label className={form.label}>
        First name (optional)
        <input className={form.input} autoComplete="given-name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className={form.trap} aria-hidden="true">
        Website
        <input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
      </label>
      <button type="submit" className={styles.button} disabled={state === 'busy' || !email.trim()}>
        {state === 'busy' ? 'Sending…' : 'Sign Me Up'}
      </button>
      {message && (
        <p className={styles.error} role="alert">
          {message}
        </p>
      )}
    </form>
  );
}
