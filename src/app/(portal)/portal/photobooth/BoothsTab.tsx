'use client';

import { useLiveSide } from '@/lib/portal/usePortalParams';
import { useEmbeddedDivision } from '@/lib/portal/usePortalParams';
import { useCallback, useEffect, useState } from 'react';
import { Camera, Copy, Plus, Settings2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import Loading from '@/components/Loading/Loading';
import { DEFAULT_BOOTH, type BoothConfig } from '@/lib/photobooth/booth';
import card from '@/components/ui/Card.module.css';
import { call, type BoothRow } from './api';
import { LiveStrip } from './LiveStrip';
import styles from './photobooth.module.css';

// The booths. Each is its own thing (not tied to an event): Set Up opens its settings, Open Booth runs it on this screen.
export function BoothsTab({ onNew, onOpen, onRun }: { onNew: () => void; onOpen: (booth: string) => void; onRun: (booth: string) => void }) {
  const division = useEmbeddedDivision();
  const [booths, setBooths] = useState<BoothRow[] | null>(null);
  const side = useLiveSide();
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const r = await call<{ booths: BoothRow[] }>('/api/photobooth/booths');
    if (r.ok) setBooths(r.data.booths.filter(side));
    else setError(r.error);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const copy = async (b: BoothRow) => {
    const r = await call<{ booth: { slug: string } }>('/api/photobooth/booths', 'POST', { name: `${b.name} copy`.slice(0, 80), from: b.slug, division_id: division });
    if (r.ok) await load();
    else setError(r.error);
  };

  if (!booths) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading booths…" />;
  return (
    <div className={styles.stack}>
      {error && <Notice tone="error">{error}</Notice>}
      <div className={styles.toolbar}>
        <p className={styles.about}>A booth is its own thing, not tied to an event: make as many as you like and open the one for the day.</p>
        <Button onClick={onNew}>
          <Plus size={16} aria-hidden="true" /> Make A Booth
        </Button>
      </div>
      {booths.length === 0 ? (
        <p className={styles.empty}>No booths yet. Make one, set up its looks and stickers, then open it on a screen at your event.</p>
      ) : (
        <div className={card.grid}>
          {booths.map((b) => (
            <div
              key={b.id}
              className={`${card.card} ${card.link}`}
              onClick={(e) => {
                if (!(e.target as HTMLElement).closest('button, a, input')) onOpen(b.slug);
              }}
            >
              <div className={`${card.preview} ${styles.boothPreview}`} aria-hidden="true">
                {b.look ? (
                  <LiveStrip video={null} config={{ ...DEFAULT_BOOTH, ...b.look.style } as BoothConfig} frameUrl={b.look.frame.image} stickers={b.look.overlays} height={220} />
                ) : (
                  <Camera size={48} />
                )}
              </div>
              <span className={card.kicker}>Booth</span>
              <h3 className={card.title}>
                <button type="button" onClick={() => onOpen(b.slug)}>
                  {b.name}
                </button>
              </h3>
              <div className={card.meta}>
                <span className={card.badge}>
                  {b.looks} look{b.looks === 1 ? '' : 's'}
                </span>
                <span className={card.badge}>{b.photos === 0 ? 'No pictures waiting' : `${b.photos} picture${b.photos === 1 ? '' : 's'} waiting`}</span>
              </div>
              <div className={`${card.actions} ${card.actionsWide}`}>
                <Button size="sm" onClick={() => onRun(b.slug)}>
                  <Camera size={15} aria-hidden="true" /> Open Booth
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onOpen(b.slug)}>
                  <Settings2 size={15} aria-hidden="true" /> Set Up
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void copy(b)} aria-label={`Copy ${b.name}`}>
                  <Copy size={15} aria-hidden="true" /> Copy
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
