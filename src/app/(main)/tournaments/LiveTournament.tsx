'use client';

import { useState } from 'react';
import Link from 'next/link';
import FeedBracket, { Standings } from '@/components/tournaments/FeedBracket';
import { FORMAT_LABEL } from '@/components/tournaments/labels';
import { useFeed, type Feed } from '@/components/tournaments/useFeed';
import styles from './tournaments.module.css';

// The public page of a tournament: the bracket, standings and who plays now and next, updating by itself.
export default function LiveTournament({ slug, initial }: { slug: string; initial: Feed }) {
  const { feed: live } = useFeed(slug, null, 5000);
  const feed = live ?? initial;
  const t = feed.tournament;
  const [pick, setPick] = useState<number | null>(null);
  const stage = pick ?? feed.current_stage;
  return (
    <main className={styles.wrap}>
      <Link href="/tournaments" className={styles.back}>
        ← All tournaments
      </Link>
      <header className={styles.head}>
        <p className={styles.kicker}>{[t.game, FORMAT_LABEL[t.format], t.best_of > 1 ? `Best of ${t.best_of}` : null].filter(Boolean).join(' · ')}</p>
        <h1>{t.name}</h1>
        <span className={`${styles.pill} ${t.status === 'live' ? styles.pillLive : ''}`}>
          {t.status === 'live' ? 'Live' : t.status === 'complete' ? 'Finished' : 'Sign-ups open'}
        </span>
      </header>
      {feed.now.length + feed.next.length > 0 && (
        <section className={styles.nowNext} aria-label="Now and next">
          {[...feed.now, ...feed.next].slice(0, 4).map((m) => (
            <div key={m.key} className={`${styles.nn} ${m.status === 'live' ? styles.nnLive : ''}`}>
              <small>
                {m.status === 'live' ? 'Playing now' : 'Up next'}
                {m.station ? ` · ${m.station}` : ''}
              </small>
              <b>
                {m.a?.name ?? 'TBD'} <i>vs</i> {m.b?.name ?? 'TBD'}
              </b>
            </div>
          ))}
        </section>
      )}
      {feed.stages.length > 1 && (
        <nav className={styles.stages} aria-label="Stages">
          {feed.stages.map((s) => (
            <button
              key={s.position}
              type="button"
              aria-current={s.position === stage ? 'true' : undefined}
              className={s.position === stage ? styles.stageOn : ''}
              onClick={() => setPick(s.position)}
            >
              {s.name}
            </button>
          ))}
        </nav>
      )}
      <div className={styles.sheet}>
        {feed.matches.length === 0 ? <p className={styles.empty}>The bracket appears when the tournament starts.</p> : <FeedBracket feed={feed} stage={stage} />}
      </div>
      <Standings feed={feed} />
    </main>
  );
}
