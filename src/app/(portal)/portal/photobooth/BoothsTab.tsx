'use client';

import { useCallback, useEffect, useState } from 'react';
import { Camera, Copy, Plus, Settings2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import Loading from '@/components/Loading/Loading';
import { LAYOUT_NAMES, type Layout } from '@/lib/photobooth/booth';
import { call, type BoothRow } from './api';
import { NewBoothDialog } from './NewBoothDialog';
import styles from './photobooth.module.css';

// The booths. Each is its own thing (not tied to an event): Set Up opens its settings, Open Booth runs it on this screen.
export function BoothsTab({ onOpen, onRun }: { onOpen: (booth: string) => void; onRun: (booth: string) => void }) {
  const [booths, setBooths] = useState<BoothRow[] | null>(null);
  const [making, setMaking] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const r = await call<{ booths: BoothRow[] }>('/api/photobooth/booths');
    if (r.ok) setBooths(r.data.booths);
    else setError(r.error);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const copy = async (b: BoothRow) => {
    const r = await call<{ booth: { slug: string } }>('/api/photobooth/booths', 'POST', { name: `${b.name} copy`.slice(0, 80), from: b.slug });
    if (r.ok) await load();
    else setError(r.error);
  };

  if (!booths) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading booths…" />;
  return (
    <div className={styles.stack}>
      {error && <Notice tone="error">{error}</Notice>}
      <div className={styles.toolbar}>
        <p className={styles.about}>A booth is its own thing, not tied to an event: make as many as you like and open the one for the day.</p>
        <Button onClick={() => setMaking(true)}>
          <Plus size={16} aria-hidden="true" /> Make A Booth
        </Button>
      </div>
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
                <Button size="sm" variant="secondary" onClick={() => void copy(b)} aria-label={`Copy ${b.name}`}>
                  <Copy size={15} aria-hidden="true" /> Copy
                </Button>
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
      {making && <NewBoothDialog onClose={() => setMaking(false)} onMade={(slug, open) => (open ? onRun(slug) : onOpen(slug))} />}
    </div>
  );
}
