'use client';

import { useEffect, useState } from 'react';
import Select from '@/components/ui/Select';
import { useEmbeddedDivision } from '@/lib/portal/usePortalParams';
import { WhoCanSee } from './ScopeChip';
import { liveToolWho } from '@/lib/portal/whoSees';

// "Make this for: Triton Gaming / <division>", shown only when the person could make it for more than one. Inside a division's own page nothing is asked: it is that division's. `owner` is what to send as `division_id`
// (undefined: the server's default, which is the club's when the person may, else their only division).
export function useLiveOwner(): { owner: string | undefined; picker: React.ReactNode } {
  const fixed = useEmbeddedDivision();
  const [choices, setChoices] = useState<{ tg: boolean; divisions: { id: string; name: string }[] } | null>(null);
  const [pick, setPick] = useState('');
  useEffect(() => {
    if (fixed) return;
    let live = true;
    fetch('/api/live-owners', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!live || !j) return;
        setChoices(j);
        setPick(j.tg ? 'tg' : (j.divisions[0]?.id ?? ''));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [fixed]);
  if (fixed) return { owner: fixed, picker: null };
  const count = choices ? (choices.tg ? 1 : 0) + choices.divisions.length : 0;
  const owner = pick && pick !== 'tg' ? pick : undefined;
  const chosen = pick === 'tg' || !pick ? null : (choices?.divisions.find((d) => d.id === pick)?.name ?? null);
  const who = liveToolWho(chosen);
  const picker = choices ? (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      {count > 1 && (
        <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem', fontWeight: 600 }}>
          Make this for
          <Select value={pick} onChange={(e) => setPick(e.target.value)}>
            {choices.tg && <option value="tg">Triton Gaming</option>}
            {choices.divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </label>
      )}
      {count > 0 && <WhoCanSee owner={who.owner} lines={who.lines} />}
    </div>
  ) : null;
  return { owner, picker };
}
