'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { pacificDatetimeLocalToUTC } from '@/lib/core/timezone';
import type { StageRow } from '@/lib/tournaments/store';
import { call, roundName, type TData } from './types';
import styles from './tournaments.module.css';

// Two things a host does around a bracket: fill in start times (round by round, a few at a time) and give the rounds their own names ("Quarterfinals", "Pool play"). Both are only words and times, so they work any time, even while it is live.
export default function PlanTools({
  data,
  stage,
  act,
  busy,
  reload,
}: {
  data: TData;
  stage: StageRow;
  act: (body: object, done?: string) => Promise<void>;
  busy: boolean;
  reload: () => void;
}) {
  const rows = data.matches.filter((m) => m.stage_id === stage.id && m.status !== 'skipped');
  const [start, setStart] = useState('');
  const [minutes, setMinutes] = useState('30');
  const [parallel, setParallel] = useState('1');
  const [gap, setGap] = useState('0');
  const [overwrite, setOverwrite] = useState(false);
  const names = (stage.settings?.round_names ?? {}) as Record<string, string>;
  // every round that exists, in play order, with its default name
  const rounds: { key: string; bracket: string; round: number; fallback: string }[] = [];
  for (const b of ['W', 'L', 'GF', 'T', 'RR', 'S']) {
    const ofB = rows.filter((m) => m.bracket === b);
    if (ofB.length === 0) continue;
    const max = Math.max(...ofB.map((m) => m.round));
    for (const r of [...new Set(ofB.map((m) => m.round))].sort((x, y) => x - y)) rounds.push({ key: `${b}${r}`, bracket: b, round: r, fallback: roundName(b, r, max, null) });
  }
  const saveName = async (key: string, value: string) => {
    const next = { ...names };
    if (value.trim()) next[key] = value.trim();
    else delete next[key];
    const r = await call('PATCH', `/api/tournaments/${data.tournament.id}/stages`, { id: stage.id, round_names: next });
    reload();
    return r.ok;
  };
  return (
    <details className={styles.planTools}>
      <summary>Plan The Day: Times And Round Names</summary>
      <div className={styles.planBox}>
        <h3 className={styles.cardTitle}>Start times</h3>
        <p className={styles.hint}>
          Fills in a start time for every match that is still to play, round by round. “At once” is how many matches run together (how many setups you have). Times show on the
          bracket, the Control panel and the public page.
        </p>
        <div className={styles.planForm}>
          <label>
            <span>First match starts (Pacific)</span>
            <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>
            <span>Minutes per match</span>
            <Input type="number" min={5} max={600} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </label>
          <label>
            <span>Matches at once</span>
            <Input type="number" min={1} max={64} value={parallel} onChange={(e) => setParallel(e.target.value)} />
          </label>
          <label>
            <span>Break between (minutes)</span>
            <Input type="number" min={0} max={240} value={gap} onChange={(e) => setGap(e.target.value)} />
          </label>
        </div>
        <label className={styles.check}>
          <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} /> Replace times that are already set
        </label>
        <div className={styles.cardActions}>
          <Button
            disabled={busy || !start}
            onClick={() =>
              act(
                {
                  action: 'schedule',
                  stage_id: stage.id,
                  start: pacificDatetimeLocalToUTC(start).toISOString(),
                  minutes: Number(minutes),
                  parallel: Number(parallel),
                  gap: Number(gap),
                  overwrite,
                },
                'Times filled in',
              )
            }
          >
            Fill In Times
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => act({ action: 'clear-schedule', stage_id: stage.id }, 'Times cleared')}>
            Clear Times
          </Button>
        </div>
        {data.can.manage && rounds.length > 0 && (
          <>
            <h3 className={styles.cardTitle}>Round names</h3>
            <p className={styles.hint}>Rename any round. Leave it empty to go back to the usual name.</p>
            <div className={styles.planForm}>
              {rounds.map((r) => (
                <label key={r.key}>
                  <span>{r.fallback}</span>
                  <Input
                    defaultValue={names[r.key] ?? ''}
                    placeholder={r.fallback}
                    maxLength={30}
                    onBlur={(e) => e.target.value.trim() !== (names[r.key] ?? '') && void saveName(r.key, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </>
        )}
      </div>
    </details>
  );
}
