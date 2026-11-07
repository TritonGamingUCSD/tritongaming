'use client';

import { useState } from 'react';
import { Radio, Undo2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { Input } from '@/components/ui/Field';
import { formatPacificTime } from '@/lib/core/timezone';
import { presetOf } from '@/lib/tournaments/games';
import { bestOfOf } from '@/lib/tournaments/run';
import type { MatchRow } from '@/lib/tournaments/store';
import MatchDialog from './MatchDialog';
import { call, type TData } from './types';
import styles from './control.module.css';

// The producer's panel: the matches being played or ready, as big cards you can run from a laptop next to the stream. Tap who won each game; the series score updates on the overlays at once, and the match finishes by itself when someone has won enough games.
export default function ControlPanel({ data, reload }: { data: TData; reload: () => void }) {
  const t = data.tournament;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState<MatchRow | null>(null);
  const preset = presetOf(t.game);
  const nm = (id: string | null) => (id ? (data.entrants.find((e) => e.id === id)?.name ?? '?') : 'TBD');
  const active = data.matches
    .filter((m) => m.status === 'live' || m.status === 'ready')
    .sort((a, b) => Number(b.status === 'live') - Number(a.status === 'live') || a.round - b.round || a.idx - b.idx)
    .slice(0, 8);
  const send = async (m: MatchRow, body: object) => {
    setBusy(m.key);
    setError('');
    const r = await call('POST', `/api/tournaments/${t.id}/bracket`, { key: m.key, ...body });
    setBusy(null);
    if (!r.ok) setError(r.j.error || 'That did not work.');
    reload();
  };
  if (!data.can.run) return <Notice tone="info">Only people who run the tournament see the control panel.</Notice>;
  if (data.tournament.status !== 'live' && data.tournament.status !== 'complete')
    return <Notice tone="info">Start the tournament first (the Start button at the top). The matches that are ready to play show up here.</Notice>;
  if (active.length === 0) {
    const custom = data.stages.some((x) => x.format === 'custom' && x.status !== 'complete');
    return (
      <Notice tone="info">
        {custom
          ? 'No match is ready right now. Add matches on the Bracket tab (under the bracket, “Add a match”).'
          : 'No match is ready right now. When a result sets up the next match, it appears here.'}
      </Notice>
    );
  }
  return (
    <div className={styles.wrap}>
      {error && <Notice tone="error">{error}</Notice>}
      <p className={styles.hint}>
        Mark a match live to put it on the scoreboard overlay. Tap the winner of each game; the match ends on its own. Unmarked matches are listed as ready.
      </p>
      <div className={styles.grid}>
        {active.map((m) => {
          const stage = data.stages.find((s) => s.id === m.stage_id);
          const bestOf = bestOfOf(t, stage, m);
          const need = Math.ceil(bestOf / 2);
          const games = m.games ?? [];
          const sa = games.filter((g) => g.a > g.b).length;
          const sb = games.filter((g) => g.b > g.a).length;
          const off = busy === m.key;
          return (
            <article key={m.key} className={`${styles.card} ${m.status === 'live' ? styles.live : ''}`}>
              <header>
                <span>
                  {stage && data.stages.length > 1 ? `${stage.name} · ` : ''}
                  {m.bracket === 'GF' ? 'Grand final' : m.bracket === 'L' ? `Losers R${m.round}` : `Round ${m.round}`}
                  {bestOf > 1 ? ` · Bo${bestOf}` : ''}
                  {m.label ? ` · ${m.label}` : ''}
                  {m.scheduled_at ? ` · ${formatPacificTime(m.scheduled_at)}` : ''}
                </span>
                {m.status === 'live' ? (
                  <button type="button" className={styles.livePill} onClick={() => send(m, { action: 'live', on: false })} disabled={off} title="Take off the scoreboard">
                    <Radio size={12} aria-hidden="true" /> Live
                  </button>
                ) : (
                  <Button size="sm" variant="secondary" disabled={off} onClick={() => send(m, { action: 'live', on: true })}>
                    Go Live
                  </Button>
                )}
              </header>
              <div className={styles.sides}>
                {(['a', 'b'] as const).map((side) => (
                  <div key={side} className={styles.side}>
                    <b>{nm(side === 'a' ? m.a : m.b)}</b>
                    <em>{side === 'a' ? sa : sb}</em>
                    <Button disabled={off || !(side === 'a' ? m.a : m.b)} onClick={() => send(m, { action: 'game', winner: side })}>
                      Won {bestOf > 1 ? 'Game' : 'Match'}
                    </Button>
                  </div>
                ))}
              </div>
              {bestOf > 1 && (
                <p className={styles.series}>
                  First to {need}.{' '}
                  {games.length === 0 ? 'No games played yet.' : games.map((g, i) => `G${i + 1}: ${g.a > g.b ? nm(m.a) : nm(m.b)}${g.map ? ` (${g.map})` : ''}`).join(' · ')}
                </p>
              )}
              <footer>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={off || !m.a || !m.b}
                  onClick={() => setPicked(m)}
                  title="Type the whole score yourself instead of tapping each game"
                >
                  Enter Full Score
                </Button>
                <label>
                  <span>Station</span>
                  <Input
                    defaultValue={m.station ?? ''}
                    maxLength={30}
                    placeholder="Setup 3"
                    onBlur={(e) => e.target.value !== (m.station ?? '') && send(m, { action: 'station', station: e.target.value })}
                  />
                </label>
                {games.length > 0 && (
                  <button type="button" className={styles.undo} disabled={off} onClick={() => send(m, { action: 'undo-game' })}>
                    <Undo2 size={13} aria-hidden="true" /> Undo Last Game
                  </button>
                )}
                {preset && bestOf > 1 && <small>{preset.mapLabel}s: record them with the score dialog on the Bracket tab.</small>}
              </footer>
            </article>
          );
        })}
      </div>
      {picked && (
        <MatchDialog
          tid={t.id}
          match={picked}
          entrants={data.entrants}
          bestOf={bestOfOf(
            t,
            data.stages.find((x) => x.id === picked.stage_id),
            picked,
          )}
          format={data.stages.find((x) => x.id === picked.stage_id)?.format ?? t.format}
          game={t.game}
          onClose={() => setPicked(null)}
          onDone={reload}
        />
      )}
    </div>
  );
}
