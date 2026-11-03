'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Copy, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import { Input } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import { showToast } from '@/lib/ui/toast';
import TriviaQr from '../trivia/TriviaQr';
import { call } from './api';
import polls from '../polls/polls.module.css';
import styles from './newspaper.module.css';

interface Sub {
  id: string;
  email: string;
  name: string;
  status: 'pending' | 'active' | 'unsubscribed';
  created_at: string;
  confirmed_at: string | null;
}
const LABEL = { pending: 'Waiting to confirm', active: 'Subscribed', unsubscribed: 'Unsubscribed' } as const;

// The people who signed up for the Newspaper without an account (senders only): how many, the sign-up link and QR code to put on a screen or a poster, and the list, with a way to remove someone who asks. Only confirmed people get an issue.
export default function SubscribersPanel({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<{ subscribers: Sub[]; active: number; pending: number; unsubscribed: number } | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const load = useCallback(async (search: string) => {
    const r = await call<{ subscribers: Sub[]; active: number; pending: number; unsubscribed: number }>(
      `/api/newspaper/subscribers${search ? `?q=${encodeURIComponent(search)}` : ''}`,
    );
    if (r.ok) setData(r.data);
    else setError(r.error);
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => void load(q), q ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [load, q]);

  const link = typeof window === 'undefined' ? '' : `${window.location.origin}/newspaper`;
  if (!data) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading subscribers…" />;
  return (
    <div className={polls.stack}>
      <div className={polls.head}>
        <Button variant="secondary" size="sm" onClick={onBack}>
          <ArrowLeft size={15} aria-hidden="true" /> All Issues
        </Button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <section className={polls.panel}>
        <h2>Sign-Up Link</h2>
        <p className={polls.hint}>Anyone can sign up here without an account. They get one email to confirm, and are only added when they press its button.</p>
        <div className={polls.head}>
          <b>{link.replace(/^https?:\/\//, '')}</b>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                showToast('Link copied.');
              } catch {
                setError('Couldn’t copy. Select the address and copy it.');
              }
            }}
          >
            <Copy size={15} aria-hidden="true" /> Copy Link
          </Button>
        </div>
        {link && <TriviaQr url={link} size={180} />}
        <p className={polls.hint}>
          {data.active} subscribed · {data.pending} waiting to confirm · {data.unsubscribed} unsubscribed. To send an issue to subscribers, turn on Public subscribers in its
          Audience.
        </p>
      </section>
      <section className={polls.panel}>
        <h2>People</h2>
        <Input value={q} placeholder="Search by email or name…" aria-label="Search subscribers" onChange={(e) => setQ(e.target.value)} />
        {data.subscribers.length === 0 ? (
          <p className={polls.hint}>{q ? 'Nobody matches.' : 'Nobody has signed up yet.'}</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Person</th>
                <th>State</th>
                <th aria-label="Remove" />
              </tr>
            </thead>
            <tbody>
              {data.subscribers.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.name || 'No name'}
                    <br />
                    <small>{s.email}</small>
                  </td>
                  <td>{LABEL[s.status]}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label={`Remove ${s.email}`}
                      onClick={async () => {
                        if (
                          !(await confirmHold({
                            title: 'Remove This Person?',
                            message: `${s.email} is taken off the list for good. They can sign up again.`,
                            confirmLabel: 'Hold To Remove',
                          }))
                        )
                          return;
                        await call(`/api/newspaper/subscribers/${s.id}`, 'DELETE');
                        void load(q);
                      }}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
