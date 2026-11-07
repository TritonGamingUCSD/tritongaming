'use client';

import { Trash2 } from 'lucide-react';
import { Input, Select } from '@/components/ui/Field';
import { pacificDatetimeLocalToUTC, utcToPacificDatetimeLocal } from '@/lib/core/timezone';
import type { MatchRow } from '@/lib/tournaments/store';
import type { TData } from './types';
import styles from './tournaments.module.css';

// The matches of a custom stage as a list you can change: rename one, swap who plays, give it a start time or its own best-of, take it out. Anything with a result is locked (undo the result first).
export default function PlannedMatches({ data, stageId, act, busy }: { data: TData; stageId: string; act: (body: object, done?: string) => Promise<void>; busy: boolean }) {
  const stage = data.stages.find((s) => s.id === stageId);
  const rows = data.matches.filter((m) => m.stage_id === stageId).sort((x, y) => x.idx - y.idx);
  const list = data.entrants.filter((e) => !e.dropped);
  if (rows.length === 0) return null;
  const edit = (m: MatchRow, body: object, done?: string) => act({ action: 'edit-match', key: m.key, ...body }, done);
  const stageBest = (stage?.settings as { best_of?: number } | undefined)?.best_of ?? data.tournament.best_of;
  return (
    <section className={styles.card} aria-label="Matches of this stage">
      <h3 className={styles.cardTitle}>{rows.length === 1 ? '1 match' : `${rows.length} matches`}</h3>
      <div className={styles.planList}>
        {rows.map((m) => {
          const locked = m.status === 'done' || m.score_a !== null || m.score_b !== null || (m.games ?? []).length > 0;
          return (
            <div key={m.key} className={`${styles.planRow} ${m.status === 'pending' ? styles.planPending : ''}`}>
              <b className={styles.planNo}>#{m.idx}</b>
              <Input
                defaultValue={m.label ?? ''}
                maxLength={40}
                placeholder="Name"
                aria-label={`Name of match ${m.idx}`}
                disabled={busy || m.status === 'done'}
                onBlur={(e) => e.target.value !== (m.label ?? '') && edit(m, { label: e.target.value })}
              />
              <Select value={m.a ?? ''} disabled={busy || locked} aria-label={`First entrant of match ${m.idx}`} onChange={(e) => edit(m, { a: e.target.value })}>
                {list.map((e) => (
                  <option key={e.id} value={e.id} disabled={e.id === m.b}>
                    {e.name}
                  </option>
                ))}
              </Select>
              <span className={styles.planVs}>vs</span>
              <Select value={m.b ?? ''} disabled={busy || locked} aria-label={`Second entrant of match ${m.idx}`} onChange={(e) => edit(m, { b: e.target.value })}>
                {list.map((e) => (
                  <option key={e.id} value={e.id} disabled={e.id === m.a}>
                    {e.name}
                  </option>
                ))}
              </Select>
              <Input
                type="datetime-local"
                defaultValue={utcToPacificDatetimeLocal(m.scheduled_at)}
                aria-label={`Start time of match ${m.idx} (Pacific)`}
                disabled={busy || m.status === 'done'}
                onBlur={(e) =>
                  e.target.value !== utcToPacificDatetimeLocal(m.scheduled_at) &&
                  edit(m, { scheduled_at: e.target.value ? pacificDatetimeLocalToUTC(e.target.value).toISOString() : null })
                }
              />
              <Select
                value={m.best_of ? String(m.best_of) : ''}
                disabled={busy || m.status === 'done' || (m.games ?? []).length > 0}
                aria-label={`Length of match ${m.idx}`}
                onChange={(e) => edit(m, { best_of: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Same as stage ({stageBest > 1 ? `Bo${stageBest}` : '1 game'})</option>
                {[1, 3, 5, 7].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? 'Single game' : `Best of ${n}`}
                  </option>
                ))}
              </Select>
              <button
                type="button"
                className={styles.iconBtn}
                aria-label={`Remove match ${m.idx}`}
                title={locked ? 'It has a result. Undo it first.' : 'Remove this match'}
                disabled={busy || locked}
                onClick={() => act({ action: 'delete-match', key: m.key }, 'Match removed')}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
