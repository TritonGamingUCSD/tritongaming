'use client';

import { useState } from 'react';
import styles from './photo.module.css';

// The guest's choice to show their picture in the event gallery (off until they choose it, and they can take it out again).
export function ShareToggle({ token, initial }: { token: string; initial: boolean }) {
  const [shared, setShared] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const toggle = async () => {
    setBusy(true);
    setProblem('');
    const res = await fetch(`/api/photos/${token}/share`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shared: !shared }) }).catch(
      () => null,
    );
    setBusy(false);
    if (res?.ok) setShared(!shared);
    else setProblem('Couldn’t save that. Try again.');
  };
  return (
    <div className={styles.share}>
      <button type="button" className={styles.shareBtn} onClick={() => void toggle()} disabled={busy} aria-pressed={shared}>
        {shared ? 'Shown In The Event Gallery · Tap To Remove' : 'Add To The Event Gallery'}
      </button>
      <p className={styles.note}>{shared ? 'Anyone with the gallery link can see this picture until it is deleted.' : 'Optional. Anyone with the gallery link could see it.'}</p>
      {problem && <p className={styles.problem}>{problem}</p>}
    </div>
  );
}
