'use client';

import { Check, Radio } from 'lucide-react';
import type { MatchRow } from '@/lib/tournaments/store';
import { roundName, type TEntrant } from './types';
import styles from './tournaments.module.css';

// The bracket as a sheet: one column per round, a card per match with two rows (seed, name, score). Elimination formats draw columns left to right; round robin and Swiss list each round as a grid of cards.
export default function BracketView({
  matches,
  entrants,
  format,
  onPick,
  canRun,
}: {
  matches: MatchRow[];
  entrants: TEntrant[];
  format: string;
  onPick: (m: MatchRow) => void;
  canRun: boolean;
}) {
  const byId = new Map(entrants.map((e) => [e.id, e]));
  const groups: { key: string; title: string; rounds: { round: number; title: string; items: MatchRow[] }[] }[] = [];
  const order = ['W', 'GF', 'T', 'L', 'RR', 'S'];
  // Pools: one block per pool; everything else is one block per bracket.
  const blocks: { b: string; pool: number | null; items: MatchRow[] }[] = [];
  for (const b of order) {
    const all = matches.filter((m) => m.bracket === b);
    if (all.length === 0) continue;
    const pools = [...new Set(all.map((m) => m.group_no).filter((x): x is number => !!x))].sort((x, y) => x - y);
    if (b === 'RR' && pools.length > 0) for (const p of pools) blocks.push({ b, pool: p, items: all.filter((m) => m.group_no === p) });
    else blocks.push({ b, pool: null, items: all });
  }
  for (const { b, pool, items: ofB } of blocks) {
    const maxRound = Math.max(...ofB.map((m) => m.round));
    const rounds = [...new Set(ofB.map((m) => m.round))]
      .sort((x, y) => x - y)
      .map((r) => ({
        round: r,
        title: roundName(b, r, maxRound),
        items: ofB.filter((m) => m.round === r && m.status !== 'skipped').sort((x, y) => x.idx - y.idx),
      }));
    groups.push({
      key: b,
      title: b === 'W' && format === 'double' ? 'Winners bracket' : b === 'L' ? 'Losers bracket' : b === 'GF' ? 'Grand final' : b === 'T' ? 'Third place' : '',
      rounds: rounds.filter((r) => r.items.length > 0),
    });
  }
  const name = (slot: string | null) => (slot === null ? 'TBD' : slot === 'BYE' ? 'BYE' : (byId.get(slot)?.name ?? '?'));
  const seed = (slot: string | null) => (slot && slot !== 'BYE' ? byId.get(slot)?.seed : null);
  const robin = format === 'roundrobin' || format === 'swiss';

  return (
    <div className={styles.sheet}>
      {groups.map((g) => (
        <section key={g.key} className={styles.bracketGroup} aria-label={g.title || 'Matches'}>
          {g.title && <h3 className={styles.groupTitle}>{g.title}</h3>}
          <div className={robin ? styles.roundsGrid : styles.rounds}>
            {g.rounds.map((r) => (
              <div key={r.round} className={styles.round}>
                <p className={styles.roundTitle}>{r.title}</p>
                <div className={styles.roundCards}>
                  {r.items.map((m) => {
                    const bye = m.status === 'bye';
                    const playable = canRun && (m.status === 'ready' || m.status === 'live' || m.status === 'done');
                    return (
                      <button
                        key={m.key}
                        type="button"
                        className={`${styles.match} ${m.status === 'live' ? styles.matchLive : ''} ${m.status === 'done' ? styles.matchDone : ''} ${bye ? styles.matchBye : ''}`}
                        disabled={!playable}
                        onClick={() => onPick(m)}
                        aria-label={`${name(m.a)} versus ${name(m.b)}`}
                      >
                        {(['a', 'b'] as const).map((side) => {
                          const slot = side === 'a' ? m.a : m.b;
                          const score = side === 'a' ? m.score_a : m.score_b;
                          return (
                            <span
                              key={side}
                              className={`${styles.row} ${m.winner === side ? styles.won : ''} ${m.winner && m.winner !== side ? styles.lost : ''} ${slot === null ? styles.tbd : ''}`}
                            >
                              <i className={styles.seed}>{seed(slot) ?? ''}</i>
                              <b className={styles.pname}>{name(slot)}</b>
                              <em className={styles.score}>
                                {m.winner === side && <Check size={12} aria-hidden="true" />} {score ?? ''}
                              </em>
                            </span>
                          );
                        })}
                        <span className={styles.matchMeta}>
                          {m.status === 'live' && (
                            <span className={styles.liveTag}>
                              <Radio size={11} aria-hidden="true" /> Live
                            </span>
                          )}
                          {m.station && <span>{m.station}</span>}
                          {m.status === 'ready' && canRun && <span className={styles.enter}>Enter score</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
