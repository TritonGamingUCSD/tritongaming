'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import type { TData } from './types';
import styles from './tournaments.module.css';

// A custom stage has no generated matches: pick two entrants and add a match. Scores and standings work like a round robin.
export default function CustomAdd({ data, stageId, act, busy }: { data: TData; stageId: string; act: (body: object, done?: string) => Promise<void>; busy: boolean }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const list = data.entrants.filter((e) => !e.dropped);
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
      <Button
        disabled={busy || !a || !b}
        onClick={async () => {
          await act({ action: 'add-match', stage_id: stageId, a, b }, 'Match added');
          setA('');
          setB('');
        }}
      >
        Add Match
      </Button>
    </div>
  );
}
