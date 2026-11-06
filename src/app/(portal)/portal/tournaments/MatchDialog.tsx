'use client';

import { useState } from 'react';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { Input } from '@/components/ui/Field';
import type { MatchRow } from '@/lib/tournaments/store';
import { call, type TEntrant } from './types';
import styles from './tournaments.module.css';

// Enter or correct one match: a single score for a best of 1, a row per game for longer series (with an optional map), a station, and "mark live" so streams and the page show it as being played.
export default function MatchDialog({
  tid,
  match,
  entrants,
  bestOf,
  format,
  onClose,
  onDone,
}: {
  tid: string;
  match: MatchRow;
  entrants: TEntrant[];
  bestOf: number;
  format: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const nm = (s: string | null) => (s ? (entrants.find((e) => e.id === s)?.name ?? '?') : 'TBD');
  const need = Math.ceil(bestOf / 2);
  const start =
    bestOf === 1
      ? [{ a: match.score_a ?? 0, b: match.score_b ?? 0 }]
      : Array.from({ length: bestOf }, (_, i) => ({ a: match.games?.[i]?.a ?? 0, b: match.games?.[i]?.b ?? 0, map: match.games?.[i]?.map ?? '' }));
  const [rows, setRows] = useState<{ a: number; b: number; map?: string }[]>(start);
  const [station, setStation] = useState(match.station ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const wins = { a: rows.filter((g) => g.a > g.b).length, b: rows.filter((g) => g.b > g.a).length };
  const robin = format === 'roundrobin' || format === 'swiss';
  const send = async (body: object) => {
    setBusy(true);
    setError('');
    const r = await call('POST', `/api/tournaments/${tid}/bracket`, { key: match.key, ...body });
    setBusy(false);
    if (r.ok) {
      onDone();
      onClose();
    } else setError(r.j.error || 'Could not save that.');
  };
  const num = (v: string) => Math.max(0, Math.min(999, Math.trunc(Number(v) || 0)));
  return (
    <Dialog title={`${nm(match.a)} vs ${nm(match.b)}`} onClose={onClose} busy={busy}>
      <p className={styles.dlgSub}>
        {bestOf === 1 ? 'Final score' : `Best of ${bestOf}: first to ${need}. Played games count; leave the rest at 0.`}
        {robin && bestOf === 1 ? ' A tie is allowed here.' : ''}
      </p>
      <div className={styles.scoreGrid}>
        <span />
        <b>{nm(match.a)}</b>
        <b>{nm(match.b)}</b>
        {rows.map((g, i) => (
          <div key={i} className={styles.scoreRow}>
            <span>{bestOf === 1 ? 'Score' : `Game ${i + 1}`}</span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={g.a}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, a: num(e.target.value) } : x)))}
              aria-label={`${nm(match.a)} score${bestOf > 1 ? `, game ${i + 1}` : ''}`}
            />
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={g.b}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, b: num(e.target.value) } : x)))}
              aria-label={`${nm(match.b)} score${bestOf > 1 ? `, game ${i + 1}` : ''}`}
            />
            {bestOf > 1 && (
              <Input
                value={g.map ?? ''}
                placeholder="Map (optional)"
                maxLength={40}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, map: e.target.value } : x)))}
                aria-label={`Map, game ${i + 1}`}
              />
            )}
          </div>
        ))}
      </div>
      {bestOf > 1 && (
        <p className={styles.dlgSub}>
          Series: {wins.a} – {wins.b}
        </p>
      )}
      <label className={styles.stationField}>
        <span>Station</span>
        <Input value={station} maxLength={30} placeholder="Setup 3" onChange={(e) => setStation(e.target.value)} />
      </label>
      {error && <Notice tone="error">{error}</Notice>}
      <DialogActions>
        <DialogCancel onClick={onClose} disabled={busy} />
        {match.status === 'done' && (
          <Button variant="secondary" disabled={busy} onClick={() => send({ action: 'undo' })}>
            Undo Result
          </Button>
        )}
        {match.status !== 'done' && (
          <Button variant="secondary" disabled={busy} onClick={async () => (await send({ action: 'station', station }), undefined)}>
            Save Station
          </Button>
        )}
        {match.status === 'ready' && (
          <Button variant="secondary" disabled={busy} onClick={() => send({ action: 'live', on: true })}>
            Mark Live
          </Button>
        )}
        {match.status === 'live' && (
          <Button variant="secondary" disabled={busy} onClick={() => send({ action: 'live', on: false })}>
            Take Off Live
          </Button>
        )}
        <Button
          loading={busy}
          onClick={async () => {
            if (station.trim() !== (match.station ?? '')) await call('POST', `/api/tournaments/${tid}/bracket`, { action: 'station', key: match.key, station });
            await send(
              bestOf === 1
                ? { action: 'report', scoreA: rows[0].a, scoreB: rows[0].b }
                : { action: 'report', games: rows.filter((g) => g.a > 0 || g.b > 0).map((g) => ({ a: g.a, b: g.b, map: g.map || undefined })) },
            );
          }}
        >
          {match.status === 'done' ? 'Save Correction' : 'Save Result'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
