'use client';

import { useCallback, useEffect, useState } from 'react';
import { Camera, Plus, Settings2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import Loading from '@/components/Loading/Loading';
import { Field, Input } from '@/components/ui/Field';
import { LAYOUT_NAMES, type Layout } from '@/lib/photobooth/booth';
import { call, type BoothRow } from './api';
import styles from './photobooth.module.css';

// The booths. Each is its own thing (not tied to an event): Set Up opens its settings, Open Booth runs it on this screen.
export function BoothsTab({ onOpen, onRun }: { onOpen: (booth: string) => void; onRun: (booth: string) => void }) {
  const [booths, setBooths] = useState<BoothRow[] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await call<{ booths: BoothRow[] }>('/api/photobooth/booths');
    if (r.ok) setBooths(r.data.booths);
    else setError(r.error);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError('');
    const r = await call<{ booth: { slug: string } }>('/api/photobooth/booths', 'POST', { name });
    setBusy(false);
    if (r.ok) onOpen(r.data.booth.slug);
    else setError(r.error);
  };

  if (!booths) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading booths…" />;
  return (
    <div className={styles.stack}>
      {error && <Notice tone="error">{error}</Notice>}
      <form
        className={styles.newRow}
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <Field label="New booth">
          <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Costume Party booth" />
        </Field>
        <Button type="submit" loading={busy} disabled={!name.trim()}>
          <Plus size={16} aria-hidden="true" /> Make A Booth
        </Button>
      </form>
      {booths.length === 0 ? (
        <p className={styles.empty}>No booths yet. Make one, set up its look and overlays, then open it on a screen at your event.</p>
      ) : (
        <ul className={styles.list}>
          {booths.map((b) => (
            <li key={b.id} className={styles.row}>
              <div className={styles.rowMain}>
                <strong>{b.name}</strong>
                <span className={styles.meta}>
                  {LAYOUT_NAMES[b.layout as Layout] ?? b.layout}
                  {b.photos > 0 ? ` · ${b.photos} photo${b.photos === 1 ? '' : 's'} waiting to be downloaded` : ''}
                </span>
              </div>
              <div className={styles.rowActions}>
                <Button size="sm" variant="secondary" onClick={() => onOpen(b.slug)}>
                  <Settings2 size={15} aria-hidden="true" /> Set Up
                </Button>
                <Button size="sm" onClick={() => onRun(b.slug)}>
                  <Camera size={15} aria-hidden="true" /> Open Booth
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
