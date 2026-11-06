'use client';

import { useState } from 'react';
import Notice from '@/components/ui/Notice';
import Button from '@/components/ui/Button';
import styles from './divisionRoster.module.css';

interface Person {
  id: string;
  name: string;
  role: 'division' | 'division_member' | 'division_alumni';
}

// The yearly handoff in three steps: who becomes a Head, who moves to Alumni, then a review before anything changes.
export default function DivisionHandoff({ divisionId, people, onDone, onCancel }: { divisionId: string; people: Person[]; onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [heads, setHeads] = useState<string[]>([]);
  const [alumni, setAlumni] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const candidates = people.filter((p) => p.role !== 'division'); // may become Head
  const leaving = people.filter((p) => p.role !== 'division_alumni' && !heads.includes(p.id)); // may become Alumni
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? 'Someone';
  const staying = people.filter((p) => p.role === 'division' && !alumni.includes(p.id) && !heads.includes(p.id)).length + heads.length;

  async function confirm() {
    setBusy(true);
    setError('');
    const r = await fetch(`/api/divisions/${divisionId}/roster`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ heads, alumni }) }).catch(
      () => null,
    );
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) return setError(j.error || 'That did not work.');
    onDone();
  }

  const row = (p: Person, on: boolean, flip: () => void, tag: string) => (
    <li key={p.id} className={styles.result}>
      <label className={styles.pname} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer' }}>
        <input type="checkbox" checked={on} onChange={flip} /> {p.name}
        <span className={styles.have}>{tag}</span>
      </label>
    </li>
  );

  return (
    <section className={styles.add} aria-label="Hand over the division">
      <strong>Hand Over — Step {step} of 3</strong>
      {error && <Notice tone="error">{error}</Notice>}
      {step === 1 && (
        <>
          <p className={styles.note}>Who becomes a Head? Tick the Members or Alumni who are taking over.</p>
          {candidates.length === 0 ? (
            <p>Nobody else is in the division yet. Add them first.</p>
          ) : (
            <ul className={styles.results}>
              {candidates.map((p) => row(p, heads.includes(p.id), () => toggle(heads, setHeads, p.id), p.role === 'division_member' ? 'Member' : 'Alumni'))}
            </ul>
          )}
        </>
      )}
      {step === 2 && (
        <>
          <p className={styles.note}>Who moves to Alumni? Tick the Heads and Members who are leaving. They keep reading docs and Home.</p>
          <ul className={styles.results}>{leaving.map((p) => row(p, alumni.includes(p.id), () => toggle(alumni, setAlumni, p.id), p.role === 'division' ? 'Head' : 'Member'))}</ul>
        </>
      )}
      {step === 3 && (
        <>
          <p className={styles.note}>Check this, then confirm. Nothing changes until you do.</p>
          <ul>
            {heads.map((id) => (
              <li key={`h${id}`}>{name(id)} becomes a Head</li>
            ))}
            {alumni.map((id) => (
              <li key={`a${id}`}>{name(id)} moves to Alumni</li>
            ))}
          </ul>
          {staying === 0 && <Notice tone="error">A division needs at least one Head. Go back and pick a new Head.</Notice>}
        </>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {step > 1 && (
          <Button variant="secondary" disabled={busy} onClick={() => setStep((step - 1) as 1 | 2)}>
            Back
          </Button>
        )}
        {step < 3 ? (
          <Button disabled={busy} onClick={() => setStep((step + 1) as 2 | 3)}>
            Next
          </Button>
        ) : (
          <Button disabled={busy || staying === 0 || heads.length + alumni.length === 0} onClick={() => void confirm()}>
            {busy ? 'Saving…' : 'Confirm Handoff'}
          </Button>
        )}
        <Button variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
