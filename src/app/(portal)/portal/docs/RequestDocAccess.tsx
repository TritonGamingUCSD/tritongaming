'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import Loading from '@/components/Loading/Loading';
import { showToast } from '@/lib/ui/toast';
import styles from './docs.module.css';

// Shown when a link points to a doc this person cannot open: it does not say what the doc is called, but lets them ask the people who can say yes.
export default function RequestDocAccess({ id, onHome }: { id: string; onHome: () => void }) {
  const [state, setState] = useState<{ exists: boolean; canRead: boolean; requested: boolean } | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    fetch(`/api/docs/access?id=${id}&mine=1`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => live && setState(j))
      .catch(() => live && setState({ exists: false, canRead: false, requested: false }));
    return () => {
      live = false;
    };
  }, [id]);
  if (!state) return <Loading variant="inline" label="Looking for that doc…" />;
  return (
    <div className={styles.empty}>
      {!state.exists ? (
        <p>
          <strong>That doc is not here.</strong> It may have been deleted.
        </p>
      ) : state.canRead ? (
        <p>
          <strong>You can open this doc.</strong> Reload the page to see it.
        </p>
      ) : state.requested ? (
        <p>
          <strong>Your request is with the editors.</strong> You will get a notification when they answer.
        </p>
      ) : (
        <>
          <p>
            <strong>You do not have access to this doc.</strong> Ask the people who manage it.
          </p>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Why do you need it? (optional)"
            aria-label="Why you need this doc"
          />
          {error && <p role="alert">{error}</p>}
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              const r = await fetch('/api/docs/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, message }) });
              const j = await r.json().catch(() => ({}));
              setBusy(false);
              if (r.ok) {
                showToast('Request sent');
                setState({ ...state, requested: true });
              } else setError(j.error || 'Could not send the request.');
            }}
          >
            Request Access
          </Button>
        </>
      )}
      <p>
        <button type="button" className={styles.linkBtn} onClick={onHome}>
          Back to all docs
        </button>
      </p>
    </div>
  );
}
