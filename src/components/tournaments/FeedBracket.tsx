'use client';

import type { Feed } from './useFeed';
import styles from './feed.module.css';

type M = Feed['matches'][number];

export function roundTitle(bracket: string, round: number, max: number, pool: number | null): string {
  if (bracket === 'GF') return round === 1 ? 'Grand final' : 'Bracket reset';
  if (bracket === 'T') return 'Third place';
  if (bracket === 'L') return `Losers round ${round}`;
  if (bracket === 'W') return round === max ? 'Final' : round === max - 1 && max >= 3 ? 'Semifinals' : `Round ${round}`;
  return pool ? `Round ${round}` : `Round ${round}`;
}

// One match as two rows, used by the public page and the overlays. A winner is bold, a live match has a red tag, an undecided side is "TBD".
export function MatchCard({ m, compact }: { m: M; compact?: boolean }) {
  const row = (side: 'a' | 'b') => {
    const s = side === 'a' ? m.a : m.b;
    const score = side === 'a' ? m.scoreA : m.scoreB;
    return (
      <div className={`${styles.row} ${m.winner === side ? styles.win : ''} ${m.winner && m.winner !== side ? styles.lose : ''} ${s === null ? styles.tbd : ''}`}>
        <i>{s?.seed ?? ''}</i>
        <b>{s ? s.name : 'TBD'}</b>
        <em>{score ?? ''}</em>
      </div>
    );
  };
  return (
    <div className={`${styles.match} ${m.status === 'live' ? styles.live : ''} ${m.status === 'bye' ? styles.bye : ''} ${compact ? styles.compact : ''}`}>
      {row('a')}
      {row('b')}
      {(m.status === 'live' || m.station) && (
        <span className={styles.meta}>
          {m.status === 'live' && <span className={styles.liveTag}>Live</span>}
          {m.station && <span>{m.station}</span>}
        </span>
      )}
    </div>
  );
}

// The bracket of one stage: pools as blocks, elimination as round columns.
export default function FeedBracket({ feed, stage, hideByes = true }: { feed: Feed; stage?: number; hideByes?: boolean }) {
  const pos = stage ?? feed.current_stage;
  const mine = feed.matches.filter(
    (m) => m.stage === pos && m.status !== 'skipped' && !(hideByes && m.status === 'bye' && m.round === 1 && (m.a?.name === 'BYE' || m.b?.name === 'BYE')),
  );
  const blocks: { key: string; title: string; bracket: string; items: M[] }[] = [];
  const order = ['W', 'GF', 'T', 'L', 'RR', 'S'];
  const format = feed.stages.find((s) => s.position === pos)?.format;
  for (const b of order) {
    const all = mine.filter((m) => m.bracket === b);
    if (all.length === 0) continue;
    const pools = [...new Set(all.map((m) => m.group).filter((x): x is number => !!x))].sort((x, y) => x - y);
    if (b === 'RR' && pools.length)
      for (const p of pools) blocks.push({ key: `${b}${p}`, title: `Pool ${String.fromCharCode(64 + p)}`, bracket: b, items: all.filter((m) => m.group === p) });
    else
      blocks.push({
        key: b,
        title: b === 'W' && format === 'double' ? 'Winners bracket' : b === 'L' ? 'Losers bracket' : '',
        bracket: b,
        items: all,
      });
  }
  return (
    <div className={styles.bracket}>
      {blocks.map((blk) => {
        const max = Math.max(...blk.items.map((m) => m.round));
        const rounds = [...new Set(blk.items.map((m) => m.round))].sort((x, y) => x - y);
        const robin = blk.bracket === 'RR' || blk.bracket === 'S';
        return (
          <section key={blk.key} className={styles.block}>
            {blk.title && <h3>{blk.title}</h3>}
            <div className={robin ? styles.grid : styles.cols}>
              {rounds.map((r) => (
                <div key={r} className={styles.round}>
                  <p>{roundTitle(blk.bracket, r, max, blk.bracket === 'RR' ? 1 : null)}</p>
                  <div className={styles.cards}>
                    {blk.items
                      .filter((m) => m.round === r)
                      .map((m) => (
                        <MatchCard key={m.key} m={m} />
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function Standings({ feed }: { feed: Feed }) {
  if (feed.standings && feed.standings.length > 0) {
    const groups = [...new Set(feed.standings.map((r) => r.group ?? 0))];
    return (
      <div className={styles.tables}>
        {groups.map((g) => (
          <table key={g} className={styles.table}>
            <caption>{g ? `Pool ${String.fromCharCode(64 + g)}` : 'Standings'}</caption>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>W</th>
                <th>L</th>
                <th>D</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {feed
                .standings!.filter((r) => (r.group ?? 0) === g)
                .map((r) => (
                  <tr key={`${g}-${r.place}-${r.name}`}>
                    <td>{r.place}</td>
                    <td>{r.name}</td>
                    <td>{r.wins}</td>
                    <td>{r.losses}</td>
                    <td>{r.draws}</td>
                    <td>
                      <b>{r.points}</b>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        ))}
      </div>
    );
  }
  if (feed.placements && feed.placements.length > 0) {
    return (
      <table className={styles.table}>
        <caption>Final placements</caption>
        <tbody>
          {feed.placements.map((p) => (
            <tr key={`${p.place}-${p.name}`}>
              <td>{p.place}</td>
              <td>{p.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return null;
}
