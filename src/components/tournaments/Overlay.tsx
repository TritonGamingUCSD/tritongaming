'use client';

import { useEffect } from 'react';
import FeedBracket, { MatchCard, Standings } from './FeedBracket';
import { useFeed, type Feed } from './useFeed';
import styles from './overlay.module.css';

import type { OverlayKind } from './overlayKinds';

type M = Feed['matches'][number];

// The pages OBS loads as a Browser Source. The background is transparent, nothing on the page is clickable, and it updates itself. Options in the address: ?token= (for a draft or private tournament), ?accent=f6c84c (a hex color), ?scale=1.25, ?theme=light, ?match=<match key> (scoreboard: always show this match), ?stage=2 (bracket: that stage).
export default function Overlay({
  slug,
  kind,
  token,
  accent,
  scale,
  theme,
  match,
  stage,
}: {
  slug: string;
  kind: OverlayKind;
  token?: string;
  accent?: string;
  scale?: number;
  theme?: string;
  match?: string;
  stage?: number;
}) {
  const { feed } = useFeed(slug, token, 3000);
  useEffect(() => {
    const prev = [document.documentElement.style.background, document.body.style.background];
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    return () => {
      document.documentElement.style.background = prev[0];
      document.body.style.background = prev[1];
    };
  }, []);
  const vars = {
    ['--tf-accent' as string]: /^[0-9a-f]{3,8}$/i.test(accent ?? '') ? `#${accent}` : '#f6c84c',
    ['--tf-ink' as string]: theme === 'light' ? '#0b1730' : '#ffffff',
    ['--tf-card' as string]: theme === 'light' ? 'rgba(255,255,255,0.92)' : 'rgba(10,18,32,0.9)',
    ['--tf-line' as string]: theme === 'light' ? 'rgba(11,23,48,0.35)' : 'rgba(255,255,255,0.35)',
    ['--tf-muted' as string]: theme === 'light' ? '#4a5877' : '#9fb0c8',
    zoom: scale && scale > 0.2 && scale < 4 ? scale : 1,
  };
  if (!feed) return <div className={styles.root} style={vars} />;
  return (
    <div className={styles.root} style={vars} data-kind={kind}>
      {kind === 'bracket' && <FeedBracket feed={feed} stage={stage} />}
      {kind === 'scoreboard' && <Scoreboard feed={feed} matchKey={match} />}
      {kind === 'next' && <Next feed={feed} />}
      {kind === 'standings' && <Standings feed={feed} />}
      {kind === 'champion' && <Champion feed={feed} />}
    </div>
  );
}

const roundWord = (m: M, feed: Feed) => {
  const st = feed.stages.find((s) => s.position === m.stage);
  const label =
    m.bracket === 'GF'
      ? m.round === 1
        ? 'Grand final'
        : 'Bracket reset'
      : m.bracket === 'L'
        ? `Losers round ${m.round}`
        : m.bracket === 'T'
          ? 'Third place'
          : m.group
            ? `Pool ${String.fromCharCode(64 + m.group)} · Round ${m.round}`
            : `Round ${m.round}`;
  return feed.stages.length > 1 && st ? `${st.name} · ${label}` : label;
};

// The lower third: the live match (or the next ready one), names with seeds, the score, the series so far and the game being played.
function Scoreboard({ feed, matchKey }: { feed: Feed; matchKey?: string }) {
  const m: M | undefined = (matchKey ? feed.matches.find((x) => x.key === matchKey || x.key.endsWith(`/${matchKey}`)) : undefined) ?? feed.now[0] ?? feed.next[0];
  if (!m) return null;
  const bo = m.best_of ?? feed.tournament.best_of;
  const games = m.games ?? [];
  const last = games[games.length - 1];
  return (
    <div key={m.key} className={styles.lower}>
      <div className={styles.lowerLeft}>
        <small>{feed.tournament.name}</small>
        <b>{roundWord(m, feed)}</b>
        {bo > 1 && <span>Best of {bo}</span>}
      </div>
      <div className={styles.lowerMid}>
        <div className={`${styles.team} ${m.winner === 'a' ? styles.winner : ''}`}>
          <i>{m.a?.seed ?? ''}</i>
          <b>{m.a?.name ?? 'TBD'}</b>
        </div>
        <div className={styles.lowerScore}>
          <em>{m.scoreA ?? 0}</em>
          <span>–</span>
          <em>{m.scoreB ?? 0}</em>
        </div>
        <div className={`${styles.team} ${styles.right} ${m.winner === 'b' ? styles.winner : ''}`}>
          <b>{m.b?.name ?? 'TBD'}</b>
          <i>{m.b?.seed ?? ''}</i>
        </div>
      </div>
      <div className={styles.lowerRight}>
        {last?.map && <b>{last.map}</b>}
        {m.station && <span>{m.station}</span>}
        {m.status === 'live' && <span className={styles.livePill}>Live</span>}
      </div>
    </div>
  );
}

function Next({ feed }: { feed: Feed }) {
  const list = [...feed.now, ...feed.next].slice(0, 6);
  if (list.length === 0) return null;
  return (
    <div className={styles.next}>
      <h2>Up next</h2>
      {list.map((m) => (
        <div key={m.key} className={styles.nextRow}>
          <MatchCard m={m} compact />
          <small>{[roundWord(m, feed), m.station].filter(Boolean).join(' · ')}</small>
        </div>
      ))}
    </div>
  );
}

function Champion({ feed }: { feed: Feed }) {
  const first = feed.placements?.find((p) => p.place === 1) ?? feed.standings?.[0];
  if (!first || feed.tournament.status !== 'complete') return null;
  const name = 'name' in first ? first.name : '';
  return (
    <div className={styles.champion}>
      <small>{feed.tournament.name}</small>
      <b>{name}</b>
      <span>Champion</span>
    </div>
  );
}
