'use client';

import { Check } from 'lucide-react';
import type { TData } from './types';
import styles from './tournaments.module.css';

// Before it starts: what is left to do, in order, with a button to each place. A step turns into a tick when it is done, so the host always knows what comes next.
export default function NextSteps({ data, active, goTab }: { data: TData; active: number; goTab: (t: 'bracket' | 'structure' | 'entrants') => void }) {
  const t = data.tournament;
  const first = data.stages[0];
  const custom = first?.format === 'custom';
  const planned = first ? data.matches.filter((m) => m.stage_id === first.id).length : 0;
  const people = t.entrant_type === 'team' ? 'teams' : 'players';
  const steps: { id: string; done: boolean; title: string; hint: string; go?: () => void; goLabel?: string }[] = [
    {
      id: 'entrants',
      done: active >= 2,
      title: `Add ${people}`,
      hint: active >= 2 ? `${active} ${people} are in. Put them in seed order if it matters.` : `${active} so far. You need at least two. Add them one by one or paste a list.`,
      go: () => goTab('entrants'),
      goLabel: 'Entrants',
    },
    {
      id: 'structure',
      done: data.stages.length > 0,
      title: 'Pick how it is played',
      hint: first
        ? `${first.name}: ${custom ? 'you make the matches yourself' : 'the bracket is made for you when you start'}. Add more stages (pools, then a final) if you need them.`
        : 'Add a stage.',
      go: () => goTab('structure'),
      goLabel: 'Structure',
    },
    ...(custom
      ? [
          {
            id: 'matches',
            done: planned > 0,
            title: 'Make the matches',
            hint:
              planned > 0
                ? `${planned} planned. You can add more any time, even while it is live.`
                : 'Pick who plays whom. They wait until you start, so you can set the whole schedule first.',
            go: () => goTab('bracket'),
            goLabel: 'Bracket',
          },
        ]
      : []),
    { id: 'start', done: false, title: 'Press Start', hint: 'Locks the entrants and seeds, then the first matches are ready. The Start button is at the top right.' },
  ];
  const next = steps.find((s) => !s.done)?.id;
  return (
    <ol className={styles.steps} aria-label="Before it starts">
      {steps.map((s, i) => (
        <li key={s.id} className={`${styles.step} ${s.done ? styles.stepDone : ''} ${s.id === next ? styles.stepNext : ''}`}>
          <span className={styles.stepNo} aria-hidden="true">
            {s.done ? <Check size={14} /> : i + 1}
          </span>
          <span className={styles.stepText}>
            <b>{s.title}</b>
            <small>{s.hint}</small>
          </span>
          {s.go && (
            <button type="button" className={styles.stepGo} onClick={s.go}>
              {s.goLabel}
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}
