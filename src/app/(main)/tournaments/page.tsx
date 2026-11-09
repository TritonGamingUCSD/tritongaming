import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOffSwitches } from '@/lib/portal/featureServer';
import { createServiceClient } from '@/lib/supabase/admin';
import { PageHero } from '@/components/ZineBand/ZineBand';
import EventsTabs from '@/components/PublicPages/EventsTabs';
import { FORMAT_LABEL } from '@/components/tournaments/labels';
import { getLeaderboard } from '@/lib/tournaments/results';
import styles from './tournaments.module.css';

export const revalidate = 30;
export const metadata: Metadata = { title: 'Tournaments', description: 'Live brackets and results from Triton Gaming tournaments.', alternates: { canonical: '/tournaments' } };

export default async function TournamentsPage() {
  const off = await getOffSwitches();
  if (off.includes('tournaments')) notFound();
  const { data } = await createServiceClient()
    .from('tournaments')
    .select('slug, name, game, format, status, starts_at, division_id')
    .eq('is_public', true)
    .neq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(60);
  const board = await getLeaderboard(createServiceClient(), { divisionId: null, limit: 10 }).catch(() => []);
  const rows = (data ?? []).filter((t) => !(t.division_id && off.includes('div_tournaments')));
  return (
    <main>
      <PageHero label="Compete" title="Tournaments" sub="Brackets update live while the matches are played." />
      <EventsTabs active="tournaments" />
      {board.length > 0 && (
        <section className={styles.board} aria-label="Leaderboard">
          <h2>Leaderboard</h2>
          <ol>
            {board.map((r, i) => (
              <li key={r.key}>
                <b>{i + 1}</b>
                <span>{r.name}</span>
                <small>
                  {r.titles > 0 ? `${r.titles} ${r.titles === 1 ? 'title' : 'titles'} · ` : ''}
                  {r.played} played
                </small>
                <em>{r.points} pts</em>
              </li>
            ))}
          </ol>
        </section>
      )}
      <section className={styles.list}>
        {rows.length === 0 && <p className={styles.empty}>No tournaments to show yet.</p>}
        {rows.map((t) => (
          <Link key={t.slug} href={`/tournaments/${t.slug}`} className={`${styles.card} ${t.status === 'live' ? styles.cardLive : ''}`}>
            <span className={styles.status}>{t.status === 'live' ? 'Live now' : t.status === 'registration' ? 'Sign-ups open' : 'Finished'}</span>
            <b>{t.name}</b>
            <small>{[t.game, FORMAT_LABEL[t.format as string]].filter(Boolean).join(' · ')}</small>
          </Link>
        ))}
      </section>
    </main>
  );
}
