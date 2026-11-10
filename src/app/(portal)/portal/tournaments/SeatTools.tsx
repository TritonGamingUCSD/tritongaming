'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Select from '@/components/ui/Select';
import Notice from '@/components/ui/Notice';
import { Toggle } from './controls';
import type { MatchRow, StageRow } from '@/lib/tournaments/store';
import { call, type TData } from './types';
import styles from './tournaments.module.css';

/** Who can sit in a bracket's places: the stage's entrants that have not dropped out. */
export const seatable = (data: TData, stage: StageRow) => {
  const inStage = new Set(data.stageEntrants.filter((x) => x.stage_id === stage.id).map((x) => x.entrant_id));
  return data.entrants.filter((e) => !e.dropped && inStage.has(e.id));
};

/** A bracket whose places start empty ("by hand or draw"): is it still open for seating (no result in yet)? */
export const seatingOpen = (stage: StageRow | undefined, rows: MatchRow[]) =>
  !!stage &&
  (stage.format === 'single' || stage.format === 'double') &&
  stage.settings?.placement === 'manual' &&
  stage.status === 'live' &&
  rows.every((m) => m.status !== 'done' && m.status !== 'live' && m.score_a === null);

/** The places of the first round: [match, side] for every place a team can sit (byes are not places). */
export const placesOf = (rows: MatchRow[]) =>
  rows
    .filter((m) => m.bracket === 'W' && m.round === 1)
    .sort((x, y) => x.idx - y.idx)
    .flatMap((m) => (['a', 'b'] as const).map((side) => ({ m, side, slot: side === 'a' ? m.a : m.b })))
    .filter((p) => p.slot !== 'BYE');

// The bar over a bracket that is being seated: how many places are filled, a draw, "fill in order", clear, and the switch that makes a tap on a first-round match pick its teams instead of scoring it.
export function SeatBar({
  data,
  stage,
  rows,
  seating,
  setSeating,
  act,
  busy,
}: {
  data: TData;
  stage: StageRow;
  rows: MatchRow[];
  seating: boolean;
  setSeating: (v: boolean) => void;
  act: (b: object, done?: string) => Promise<void>;
  busy: boolean;
}) {
  const places = placesOf(rows);
  const filled = places.filter((p) => p.slot).length;
  const people = seatable(data, stage).length;
  return (
    <section className={styles.card} aria-label="Seat the teams">
      <h3 className={styles.cardTitle}>
        Seats{' '}
        <small>
          {filled} of {places.length} filled · {people} {people === 1 ? 'team' : 'teams'} in
        </small>
      </h3>
      <p className={styles.hint}>
        This bracket starts with empty places, so there is no seeding. Draw the teams in, or tap a first-round match to pick who sits where. Winners and losers move on by
        themselves after that. Seats lock when the first result is in.
      </p>
      <div className={styles.seatBar}>
        <Button
          size="sm"
          disabled={busy || filled >= Math.min(places.length, people)}
          onClick={() => void act({ action: 'fill-slots', stage_id: stage.id, mode: 'random' }, 'Teams drawn into the empty places')}
        >
          Draw Teams At Random
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy || filled >= Math.min(places.length, people)}
          onClick={() => void act({ action: 'fill-slots', stage_id: stage.id, mode: 'order' }, 'Teams placed in order')}
        >
          Fill In Order
        </Button>
        <Button size="sm" variant="secondary" disabled={busy || filled === 0} onClick={() => void act({ action: 'clear-slots', stage_id: stage.id }, 'Seats cleared')}>
          Clear Seats
        </Button>
        <Toggle checked={seating} onChange={setSeating} hint="On: tapping a first-round match picks its teams. Off: tapping enters a score (once both teams are in).">
          Tap to seat
        </Toggle>
      </div>
      {people > places.length && (
        <Notice tone="warning">
          {people} teams are in but the bracket has {places.length} places. Raise the places in Structure before it starts, or drop a team.
        </Notice>
      )}
    </section>
  );
}

// Pick the two teams of one first-round match. A team already in another place moves here (its old place empties).
export function SeatDialog({
  data,
  match,
  stage,
  rows,
  onClose,
  reload,
}: {
  data: TData;
  stage: StageRow;
  match: MatchRow;
  rows: MatchRow[];
  onClose: () => void;
  reload: () => void;
}) {
  const people = seatable(data, stage).sort((x, y) => (x.seed ?? 1e9) - (y.seed ?? 1e9));
  const where = new Map<string, string>();
  for (const p of placesOf(rows)) if (p.slot) where.set(p.slot, `${p.m.key.replace(/^s\d+\//, '')}`);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const put = async (side: 'a' | 'b', id: string) => {
    setWorking(true);
    setError('');
    const r = await call('POST', `/api/tournaments/${data.tournament.id}/bracket`, { action: 'place', key: match.key, side, entrant_id: id || null });
    setWorking(false);
    if (!r.ok) setError(r.j.error || 'Could not place that.');
    else reload();
  };
  return (
    <Dialog title={`Seats · ${match.key.replace(/^s\d+\//, '')}`} onClose={onClose} busy={working}>
      <div className={styles.seatDialog}>
        {(['a', 'b'] as const).map((side) => {
          const slot = side === 'a' ? match.a : match.b;
          if (slot === 'BYE')
            return (
              <p key={side}>
                {side === 'a' ? 'Top' : 'Bottom'} place: <b>BYE</b> (no team needed)
              </p>
            );
          return (
            <label key={side} className={styles.field}>
              <span>{side === 'a' ? 'Top place' : 'Bottom place'}</span>
              <Select value={slot ?? ''} disabled={working} onChange={(e) => void put(side, e.target.value)}>
                <option value="">Empty</option>
                {people.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {where.has(e.id) && e.id !== slot ? ` (now in ${where.get(e.id)})` : ''}
                  </option>
                ))}
              </Select>
            </label>
          );
        })}
        {error && <Notice tone="error">{error}</Notice>}
      </div>
      <DialogActions>
        <DialogCancel onClick={onClose}>Done</DialogCancel>
      </DialogActions>
    </Dialog>
  );
}
