'use client';

import { useState } from 'react';
import { GripVertical } from 'lucide-react';
import Button from '@/components/ui/Button';
import type { HeatSlot } from '@/lib/tournaments/points';
import type { MatchRow } from '@/lib/tournaments/store';
import { useDragOrder } from './useDragOrder';
import type { TEntrant } from './types';
import styles from './tournaments.module.css';

// One heat of a points series: the players listed first to last. Drag them into the order they finished (or use the arrows), then save: points are given from the stage's table.
export default function HeatCard({ match, entrants, canRun, onSave }: { match: MatchRow; entrants: TEntrant[]; canRun: boolean; onSave: (order: string[]) => Promise<void> }) {
  const heat = (match.heat ?? []) as HeatSlot[];
  const scored = heat.every((h) => h.placement !== null);
  const initial = scored ? [...heat].sort((a, b) => (a.placement ?? 0) - (b.placement ?? 0)).map((h) => h.entrant_id) : heat.map((h) => h.entrant_id);
  const [order, setOrder] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const { rowProps } = useDragOrder(order, setOrder, !canRun);
  const name = (id: string) => entrants.find((e) => e.id === id)?.name ?? '?';
  const points = (id: string) => heat.find((h) => h.entrant_id === id)?.points;
  const move = (i: number, d: -1 | 1) => {
    const next = [...order];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };
  const changed = scored ? order.join() !== initial.join() : true;
  return (
    <div className={`${styles.heat} ${scored ? styles.heatDone : ''}`}>
      <p className={styles.heatTitle}>
        Heat {match.idx} {scored && <span>scored</span>}
      </p>
      <ol>
        {order.map((id, i) => (
          <li key={id} {...rowProps(id)} className={styles.heatRow}>
            {canRun && <GripVertical size={14} aria-hidden="true" />}
            <b>{i + 1}</b>
            <span>{name(id)}</span>
            {scored && <em>+{points(id) ?? 0}</em>}
            {canRun && (
              <span className={styles.heatArrows}>
                <button type="button" aria-label={`Move ${name(id)} up`} onClick={() => move(i, -1)} disabled={i === 0}>
                  ↑
                </button>
                <button type="button" aria-label={`Move ${name(id)} down`} onClick={() => move(i, 1)} disabled={i === order.length - 1}>
                  ↓
                </button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {canRun && (
        <Button
          size="sm"
          disabled={busy || !changed}
          onClick={async () => {
            setBusy(true);
            await onSave(order);
            setBusy(false);
          }}
        >
          {scored ? 'Save Changes' : 'Save Placements'}
        </Button>
      )}
    </div>
  );
}
