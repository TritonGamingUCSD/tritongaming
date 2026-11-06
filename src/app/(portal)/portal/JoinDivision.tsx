'use client';

import { useEffect, useState } from 'react';
import styles from './dashboardHome.module.css';

// "Ask to Join" for a division: sends a request its Heads answer. Shows where it stands afterwards (asked, in, declined). The division's Discord stays a small link beside it.
export default function JoinDivision({ id, discordUrl }: { id: string; discordUrl: string | null }) {
  const [status, setStatus] = useState<'loading' | 'none' | 'pending' | 'member' | 'declined'>('loading');
  const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    fetch(`/api/divisions/${id}/join`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { status: 'none' }))
      .then((j) => {
        if (!live) return;
        setStatus(j.status);
        setClosed(!!j.closed);
      })
      .catch(() => live && setStatus('none'));
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
  return (
    <span className={styles.joinWrap}>
      {closed && status !== 'pending' ? (
        <span className={styles.joinAsked}>Not taking requests</span>
      ) : status === 'pending' ? (
        <span className={styles.joinAsked}>Asked ✓</span>
      ) : (
        <button type="button" className={styles.joinBtn} onClick={ask} disabled={busy}>
          {status === 'declined' ? 'Ask Again' : 'Ask To Join'}
        </button>
      )}
      {discordUrl && (
        <a href={discordUrl} target="_blank" rel="noopener noreferrer" className={styles.joinLink}>
          Discord
        </a>
      )}
      {error && <small role="alert">{error}</small>}
    </span>
  );
}
