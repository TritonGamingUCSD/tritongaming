'use client';

import { useCallback, useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import styles from './PushSettings.module.css';

interface Kind {
  id: string;
  label: string;
  hint: string;
  on: boolean;
}

// Which club emails I get: one switch for each kind, and a master switch above them. Saved as soon as a switch is flipped. Every email also has a link to stop that kind.
export default function EmailSettings() {
  const [all, setAll] = useState(true);
  const [kinds, setKinds] = useState<Kind[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const r = await fetch('/api/email/preferences', { cache: 'no-store' }).catch(() => null);
    if (!r?.ok) {
      setError('Couldn’t load your email settings.');
      return;
    }
    const j = await r.json();
    setAll(j.all);
    setKinds(j.kinds);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function save(body: Record<string, unknown>, apply: () => void, undo: () => void) {
    apply();
    setError('');
    const r = await fetch('/api/email/preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
    if (!r?.ok) {
      undo();
      setError('That didn’t save. Try again.');
    }
  }

  if (!kinds) return <section className={styles.card}>{error ? <Notice tone="error">{error}</Notice> : <Loading variant="inline" label="Loading…" />}</section>;
  return (
    <section className={styles.card} aria-label="Email settings">
      <div className={styles.head}>
        <span className={styles.icon}>
          <Mail size={18} aria-hidden="true" />
        </span>
        <div>
          <h2 className={styles.title}>Email</h2>
          <p className={styles.sub}>Choose which emails from the club you get. Each email also has a link to stop that kind.</p>
        </div>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <fieldset className={styles.kinds}>
        <legend className={styles.legend}>Emails</legend>
        <label className={styles.kind}>
          <input
            type="checkbox"
            checked={all}
            onChange={(e) =>
              void save(
                { all: e.target.checked },
                () => setAll(e.target.checked),
                () => setAll(!e.target.checked),
              )
            }
          />
          <span>
            <b>All club emails</b>
            <small>Turn this off to stop every email below, whatever each one is set to.</small>
          </span>
        </label>
        {kinds.map((k) => (
          <label key={k.id} className={styles.kind} style={all ? undefined : { opacity: 0.55 }}>
            <input
              type="checkbox"
              checked={k.on}
              disabled={!all}
              onChange={(e) =>
                void save(
                  { kind: k.id, on: e.target.checked },
                  () => setKinds((cur) => cur?.map((x) => (x.id === k.id ? { ...x, on: e.target.checked } : x)) ?? cur),
                  () => setKinds((cur) => cur?.map((x) => (x.id === k.id ? { ...x, on: !e.target.checked } : x)) ?? cur),
                )
              }
            />
            <span>
              <b>{k.label}</b>
              <small>{k.hint}</small>
            </span>
          </label>
        ))}
      </fieldset>
    </section>
  );
}
