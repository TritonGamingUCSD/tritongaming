'use client';

import { useState } from 'react';
import { GripVertical, Play } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import type { StageRow } from '@/lib/tournaments/store';
import { call, type TData } from './types';
import { useDragOrder } from './useDragOrder';
import styles from './tournaments.module.css';

// Shown when a stage is finished and the next one has not started: who moves on, in seed order (drag to change it), and a button to start the next stage.
export default function NextStageBanner({ data, from, stage, moving, reload }: { data: TData; from: StageRow; stage: StageRow; moving: string[]; reload: () => void }) {
  const [order, setOrder] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const list = order ?? moving;
  const { rowProps } = useDragOrder(list, setOrder);
  const name = (id: string) => data.entrants.find((e) => e.id === id)?.name ?? '?';
  const start = async () => {
    setBusy(true);
    setError('');
    const r = await call('POST', `/api/tournaments/${data.tournament.id}/bracket`, { action: 'start-stage', stage_id: stage.id, order: list });
    setBusy(false);
    if (!r.ok) setError(r.j.error || 'Could not start it.');
    reload();
  };
  return (
    <section className={styles.nextBanner}>
      <div>
        <p className={styles.kicker}>{from.name} is finished</p>
        <h3 className={styles.cardTitle}>
          {list.length} move on to {stage.name}
        </h3>
        <p className={styles.hint}>This is their seed order for the next stage. Drag to change it before you start.</p>
      </div>
      <ol className={styles.moving}>
        {list.map((id, i) => (
          <li key={id} {...rowProps(id)} className={styles.movingRow}>
            <GripVertical size={14} aria-hidden="true" />
            <b>{i + 1}</b> {name(id)}
          </li>
        ))}
      </ol>
      {error && <Notice tone="error">{error}</Notice>}
      <Button loading={busy} disabled={list.length < 2} onClick={start}>
        <Play size={15} aria-hidden="true" /> Start {stage.name}
      </Button>
    </section>
  );
}
