'use client';

import Loading from '@/components/Loading/Loading';
import { useCallback, useEffect, useState } from 'react';
import { Repeat } from 'lucide-react';
import IconButton from '@/components/ui/IconButton';
import Notice from '@/components/ui/Notice';
import Button from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import styles from './meetings.module.css';
import { CheckTile } from './CheckTile';

// Excused every week: someone who can't make this repeating meeting for as long as it repeats. Applies at once (not part of "Save changes").
export function SeriesExcused({ seriesId }: { seriesId: string }) {
  const base = `/api/meetings/series/${seriesId}/excused`;
  const [data, setData] = useState<{
    people: { id: string; name: string }[];
    excused: { user_id: string; name: string; reason: string | null; excused: boolean; from_plan: boolean }[];
  } | null>(null);
  const [who, setWho] = useState('');
  const [reason, setReason] = useState('');
  const [excused, setExcused] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const res = await fetch(base, { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) setData(json);
      else setError(json.error || 'Failed to load.');
    } catch {
      setError('Network error.');
    }
  }, [base]);
  useEffect(() => {
    void load();
  }, [load]);
  async function call(method: 'POST' | 'DELETE', body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    const res = await fetch(base, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || 'Failed.');
      return false;
    }
    await load();
    return true;
  }
  const away = new Set((data?.excused ?? []).map((a) => a.user_id));
  return (
    <details className={`${styles.moreOptions} ${styles.awayFold}`} aria-label="Excused every week">
      <summary>
        <span>Excused Every Week</span>
        <em>{data ? (data.excused.length ? `${data.excused.length} excused` : 'Nobody') : 'Loading…'}</em>
      </summary>
      <div className={styles.moreBody}>
        {error && <Notice tone="error">{error}</Notice>}
        {!data ? (
          <Loading variant="inline" label="Loading…" />
        ) : (
          <>
            {data.excused.length > 0 && (
              <ul className={styles.absentList}>
                {data.excused.map((a) => (
                  <li key={a.user_id}>
                    <span className={styles.personName}>
                      {a.name}
                      <Repeat size={12} aria-hidden="true" className={styles.everyWeek} />
                      <em>
                        {' '}
                        · {a.excused ? 'excused' : 'absent'}
                        {a.reason ? `: ${a.reason}` : ''}
                      </em>
                    </span>
                    {!a.from_plan && (
                      <IconButton kind="remove" label={`Stop excusing ${a.name} every week`} onClick={() => void call('DELETE', { user_id: a.user_id })} disabled={busy} />
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className={styles.absentForm}>
              <Select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Who to excuse every week">
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
              <Button
                type="button"
                size="sm"
                loading={busy}
                disabled={!who}
                onClick={async () => {
                  if (await call('POST', { user_id: who, reason, excused })) {
                    setWho('');
                    setReason('');
                    setExcused(true);
                  }
                }}
              >
                Add
              </Button>
            </div>
            <p className={styles.faint}>Lasts as long as the meeting repeats. Weeks already opened keep their marks.</p>
          </>
        )}
      </div>
    </details>
  );
}
