'use client';

import Loading from '@/components/Loading/Loading';
import { useCallback, useEffect, useState } from 'react';
import { Repeat } from 'lucide-react';
import IconButton from '@/components/ui/IconButton';
import Notice from '@/components/ui/Notice';
import Button from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import styles from './meetings.module.css';
import { Item } from './types';
import { CheckTile } from './CheckTile';

// "Can't make it": a host records ahead of time that someone is away (with a reason), before check-in ever opens. Works
// for repeating meetings too (that week's meeting is created on the first one). Excused absences don't count against them.
export function AdvanceAbsences({ item, onChanged }: { item: Item; onChanged?: () => void }) {
  const ref = item.meeting_id ? { meeting_id: item.meeting_id } : { series_id: item.series_id, date: item.date };
  const qs = item.meeting_id ? `meeting_id=${item.meeting_id}` : `series_id=${item.series_id}&date=${item.date}`;
  const [data, setData] = useState<{
    people: { id: string; name: string }[];
    repeating?: boolean;
    absences: { user_id: string; name: string; reason: string | null; excused: boolean; every_week?: boolean; from_plan?: boolean }[];
  } | null>(null);
  const [who, setWho] = useState('');
  const [reason, setReason] = useState('');
  const [excused, setExcused] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/meetings/absence?${qs}`, { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) setData(json);
      else setError(json.error || 'Failed to load.');
    } catch {
      setError('Network error.');
    }
  }, [qs]);
  useEffect(() => {
    void load();
  }, [load]);
  async function add() {
    if (!who) return;
    setBusy(true);
    setError('');
    const res = await fetch('/api/meetings/absence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...ref, user_id: who, reason, excused }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || 'Failed.');
      return;
    }
    setWho('');
    setReason('');
    setExcused(true);
    await load();
    onChanged?.();
  }
  async function remove(userId: string, repeat = false) {
    setError('');
    const res = await fetch('/api/meetings/absence', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...ref, user_id: userId, repeat }),
    });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error || 'Failed.');
    await load();
    onChanged?.();
  }
  const away = new Set((data?.absences ?? []).map((a) => a.user_id));
  return (
    <details className={`${styles.moreOptions} ${styles.awayFold}`} aria-label="Can't make it">
      <summary>
        <span>Can’t Make It</span>
        <em>{data ? (data.absences.length ? `${data.absences.length} away` : 'Nobody away') : 'Loading…'}</em>
      </summary>
      <div className={styles.moreBody}>
        {error && <Notice tone="error">{error}</Notice>}
        {!data ? (
          <Loading variant="inline" label="Loading…" />
        ) : (
          <>
            {data.absences.length > 0 && (
              <ul className={styles.absentList}>
                {data.absences.map((a) => (
                  <li key={a.user_id}>
                    <span className={styles.personName}>
                      {a.name}
                      {a.every_week && <Repeat size={12} aria-label="Every week" className={styles.everyWeek} />}
                      <em>
                        {' '}
                        · {a.excused ? 'excused' : 'absent'}
                        {a.every_week ? ' every week' : ''}
                        {a.reason ? `: ${a.reason}` : ''}
                      </em>
                    </span>
                    <IconButton kind="remove" label={a.every_week ? `Take ${a.name} off just this week` : `Take ${a.name} off the absent list`} onClick={() => remove(a.user_id)} />
                  </li>
                ))}
              </ul>
            )}
            <div className={styles.absentForm}>
              <Select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Who can't make it">
                <option value="">Who can’t make it?</option>
                {data.people
                  .filter((p) => !away.has(p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </Select>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={140} placeholder="Reason (optional)" aria-label="Reason" />
              <CheckTile label="Excused" checked={excused} onChange={() => setExcused((v) => !v)} />
              <Button size="sm" onClick={add} loading={busy} disabled={!who}>
                Mark away
              </Button>
            </div>
            <p className={styles.faint}>Excused doesn’t count against attendance.{data.repeating && ' To excuse someone every week, switch to Every Week.'}</p>
          </>
        )}
      </div>
    </details>
  );
}
