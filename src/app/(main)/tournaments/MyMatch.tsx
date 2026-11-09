'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatPacificDate, formatPacificTime } from '@/lib/core/timezone';
import type { Feed } from '@/components/tournaments/useFeed';
import styles from './tournaments.module.css';

type M = Feed['matches'][number];

// "Your match" at the top of a tournament's public page, for someone who is in it (or on a team in it): playing now, up next (with the time and station when there are any), waiting for an opponent, or finished.
// The bracket below stays the same for everyone; this only reads which entries are theirs (/api/tournaments/<id>/mine) and finds their matches in the live feed.
export default function MyMatch({ tournamentId, feed }: { tournamentId: string; feed: Feed }) {
  const [mine, setMine] = useState<string[] | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const {
        data: { user },
      } = await createClient().auth.getUser();
      if (!user || user.is_anonymous) return;
      const r = await fetch(`/api/tournaments/${tournamentId}/mine`, { cache: 'no-store' });
      const j = r.ok ? await r.json() : { entrants: [] };
      if (live) setMine((j.entrants as { id: string; dropped?: boolean }[]).filter((e) => !e.dropped).map((e) => e.id));
    })().catch(() => {});
    return () => {
      live = false;
    };
  }, [tournamentId]);

  if (!mine?.length) return null;
  const ids = new Set(mine);
  const ofMine = (m: M) => (m.a?.id && ids.has(m.a.id) ? 'a' : m.b?.id && ids.has(m.b.id) ? 'b' : null);
  const theirs = feed.matches.filter((m) => ofMine(m) && m.a?.name !== 'BYE' && m.b?.name !== 'BYE');
  if (!theirs.length)
    return (
      <section className={`${styles.nn} ${styles.mine}`}>
        <small>Your match</small>
        <b>You are signed up. Your matches appear here once the bracket is set.</b>
      </section>
    );
  const live = theirs.find((m) => m.status === 'live');
  const next = theirs.find((m) => m.status === 'ready') ?? theirs.find((m) => m.status !== 'complete');
  const m = live ?? next;
  const opp = (x: M) => (ofMine(x) === 'a' ? x.b : x.a)?.name ?? 'TBD';

  if (!m) {
    const last = theirs[theirs.length - 1];
    const won = last.winner && last.winner === ofMine(last);
    return (
      <section className={`${styles.nn} ${styles.mine}`}>
        <small>Your match</small>
        <b>
          {feed.tournament.status === 'complete'
            ? won
              ? 'You finished on a win. See the standings below.'
              : 'Your tournament is over. See the standings below.'
            : won
              ? 'You won your last match. Waiting for what comes next.'
              : 'Your matches are done.'}
        </b>
      </section>
    );
  }
  const isLive = m.status === 'live';
  const when = m.at ? `${formatPacificDate(m.at, { weekday: true })} · ${formatPacificTime(m.at)}` : null;
  const waiting = m.status !== 'ready' && !isLive;
  return (
    <section className={`${styles.nn} ${styles.mine} ${isLive ? styles.nnLive : ''}`} aria-label="Your match">
      <small>
        {isLive ? 'You are playing now' : waiting ? 'Your next match' : 'You are up next'}
        {m.station ? ` · ${m.station}` : ''}
        {when ? ` · ${when}` : ''}
      </small>
      <b>
        {feed.matches.length ? (
          <>
            vs {opp(m)}
            {m.label ? ` · ${m.label}` : ''}
          </>
        ) : null}
      </b>
      {waiting && <i>Waiting for the matches before it to finish.</i>}
    </section>
  );
}
