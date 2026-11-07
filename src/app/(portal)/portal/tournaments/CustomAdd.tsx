'use client';

import { useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { pacificDatetimeLocalToUTC } from '@/lib/core/timezone';
import type { TData } from './types';
import styles from './tournaments.module.css';

// A custom stage has no generated matches: you make them. Pick two entrants (and, if you like, a name and a start time) and add a match, or add every pairing at once. Before the tournament starts they are planned and wait; once it is live they are ready to play. Scores and standings work like a round robin.
export default function CustomAdd({ data, stageId, act, busy }: { data: TData; stageId: string; act: (body: object, done?: string) => Promise<void>; busy: boolean }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [label, setLabel] = useState('');
  const [when, setWhen] = useState('');
  const list = data.entrants.filter((e) => !e.dropped);
  // every pairing that is not already a match of this stage (in either order)
  const missing = useMemo(() => {
    const have = new Set(data.matches.filter((m) => m.stage_id === stageId).map((m) => [m.a, m.b].sort().join('|')));
    const out: [string, string][] = [];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (!have.has([list[i].id, list[j].id].sort().join('|'))) out.push([list[i].id, list[j].id]);
    return out;
  }, [data.matches, list, stageId]);
  const iso = () => (when ? pacificDatetimeLocalToUTC(when).toISOString() : undefined);
  if (list.length < 2) return <p className={styles.hint}>Add at least two entrants (the Entrants tab) before making matches.</p>;
  return (
    <div className={styles.customAdd}>
      <b>Add a match</b>
      <Select value={a} onChange={(e) => setA(e.target.value)} aria-label="First entrant">
        <option value="">First entrant</option>
        {list.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </Select>
      <Select value={b} onChange={(e) => setB(e.target.value)} aria-label="Second entrant">
        <option value="">Second entrant</option>
        {list
          .filter((e) => e.id !== a)
          .map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
      </Select>
      <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} placeholder="Name (optional), like Grand Final" aria-label="Match name" />
      <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Start time (Pacific, optional)" />
      <Button
        disabled={busy || !a || !b}
        onClick={async () => {
          await act({ action: 'add-match', stage_id: stageId, a, b, label: label || undefined, scheduled_at: iso() }, 'Match added');
          setA('');
          setB('');
          setLabel('');
        }}
      >
        Add Match
      </Button>
      <Button
        variant="secondary"
        disabled={busy || missing.length === 0 || missing.length > 200}
        onClick={() => act({ action: 'add-matches', stage_id: stageId, pairs: missing }, `${missing.length} matches added`)}
        title="Everyone plays everyone: one match for each pairing that is not there yet"
      >
        {missing.length === 0 ? 'Every Pairing Is Added' : `Add Every Pairing (${missing.length})`}
      </Button>
    </div>
  );
}
