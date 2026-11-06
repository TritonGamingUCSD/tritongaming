'use client';

import { useState } from 'react';
import { ArrowLeft, ExternalLink, Play, Swords } from 'lucide-react';
import Link from '@/components/portal/PortalLink';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import Button from '@/components/ui/Button';
import SectionTabs from '@/components/ui/SectionTabs';
import { usePortalParams } from '@/lib/portal/usePortalParams';
import { standings, swissRounds, type Match } from '@/lib/tournaments/bracket';
import { toMatch, type MatchRow } from '@/lib/tournaments/store';
import { showToast } from '@/lib/ui/toast';
import BracketView from './BracketView';
import MatchDialog from './MatchDialog';
import EntrantsPanel from './EntrantsPanel';
import StreamPanel from './StreamPanel';
import TSettings from './TSettings';
import { call, FORMAT_NAMES, STATUS_NAMES } from './types';
import { useTournament } from './useTournament';
import styles from './tournaments.module.css';

type Tab = 'bracket' | 'entrants' | 'stream' | 'settings';
const TABS: Tab[] = ['bracket', 'entrants', 'stream', 'settings'];

// One tournament for its organizers: the bracket (enter scores, call stations), the entrants and seeds, the stream links, and the settings. The address says which tab: /portal/tournaments/<tournament>/<tab>.
export default function TournamentDetail({ slug, subtab, divisions }: { slug: string; subtab: string | null; divisions: { id: string; name: string }[] }) {
  const { data, error, reload } = useTournament(slug);
  const setParams = usePortalParams();
  const [picked, setPicked] = useState<MatchRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  if (!data) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading the tournament…" />;
  const t = data.tournament;
  const tab: Tab = TABS.includes(subtab as Tab) ? (subtab as Tab) : t.status === 'draft' || t.status === 'registration' ? 'entrants' : 'bracket';
  const owner = t.division_id ? (divisions.find((d) => d.id === t.division_id)?.name ?? 'A division') : 'Triton Gaming';
  const goTab = (x: Tab) => {
    setParams({ subtab: x });
    window.dispatchEvent(new Event('tg:portal-nav'));
  };
  const act = async (body: object, done?: string) => {
    setBusy(true);
    setProblem('');
    const r = await call('POST', `/api/tournaments/${t.id}/bracket`, body);
    setBusy(false);
    if (!r.ok) setProblem(r.j.error || 'That did not work.');
    else if (done) showToast(done);
    reload();
  };
  const engine: Match[] = data.matches.map(toMatch);
  const active = data.entrants.filter((e) => !e.dropped);
  const roundsTotal = t.format === 'swiss' ? (t.swiss_rounds ?? swissRounds(active.length)) : 0;
  const lastRound = Math.max(0, ...data.matches.map((m) => m.round));
  const roundDone = data.matches.length > 0 && !engine.some((m) => m.status === 'ready' || m.status === 'pending');
  const table =
    t.format === 'roundrobin' || t.format === 'swiss'
      ? standings(
          active.map((e) => e.id),
          engine,
        )
      : null;
  const nameOf = (id: string) => data.entrants.find((e) => e.id === id)?.name ?? '?';

  return (
    <div className={styles.page}>
      <Link href="/portal/tournaments" className={styles.back}>
        <ArrowLeft size={14} aria-hidden="true" /> All tournaments
      </Link>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>
            {owner} · {FORMAT_NAMES[t.format]}
            {t.best_of > 1 ? ` · Best of ${t.best_of}` : ''}
          </p>
          <h1 className={styles.title}>{t.name}</h1>
          <p className={styles.sub}>
            {t.game || 'No game set'} · {active.length} {t.entrant_type === 'team' ? 'teams' : 'players'}
          </p>
        </div>
        <div className={styles.heroSide}>
          <span className={`${styles.status} ${styles[`st_${t.status}`]}`}>
            {t.status === 'live' && <i className={styles.pulse} />} {STATUS_NAMES[t.status]}
          </span>
          {data.can.manage && data.matches.length === 0 && (
            <Button disabled={busy || active.length < 2} onClick={() => act({ action: 'start' }, 'The bracket is live')}>
              <Play size={15} aria-hidden="true" /> Start Bracket
            </Button>
          )}
          {t.status !== 'draft' && (
            <a className={styles.openLink} href={`/tournaments/${t.slug}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={13} aria-hidden="true" /> Public page
            </a>
          )}
        </div>
      </header>
      {problem && <Notice tone="error">{problem}</Notice>}
      <SectionTabs
        value={tab}
        onChange={goTab}
        tabs={[
          { id: 'bracket', label: 'Bracket', icon: <Swords /> },
          { id: 'entrants', label: 'Entrants', count: active.length },
          { id: 'stream', label: 'Stream' },
          { id: 'settings', label: 'Settings' },
        ]}
      />
      {tab === 'bracket' &&
        (data.matches.length === 0 ? (
          <Notice tone="info">The bracket is made when you press Start Bracket. Add entrants and set seeds first (Entrants tab).</Notice>
        ) : (
          <>
            {t.format === 'swiss' && (
              <div className={styles.swissBar}>
                <span>
                  Round {lastRound} of {roundsTotal}
                </span>
                {roundDone && lastRound < roundsTotal && (
                  <Button disabled={busy} onClick={() => act({ action: 'next-round' }, `Round ${lastRound + 1} dealt`)}>
                    Deal Round {lastRound + 1}
                  </Button>
                )}
              </div>
            )}
            <BracketView matches={data.matches} entrants={data.entrants} format={t.format} canRun={data.can.run} onPick={setPicked} />
            {table && (
              <section className={styles.card}>
                <h3 className={styles.cardTitle}>Standings</h3>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>P</th>
                      <th>W</th>
                      <th>L</th>
                      <th>D</th>
                      <th>Pts</th>
                      <th>Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.map((r, i) => (
                      <tr key={r.id}>
                        <td>{i + 1}</td>
                        <td>{nameOf(r.id)}</td>
                        <td>{r.played}</td>
                        <td>{r.wins}</td>
                        <td>{r.losses}</td>
                        <td>{r.draws}</td>
                        <td>
                          <b>{r.points}</b>
                        </td>
                        <td>{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </>
        ))}
      {tab === 'entrants' && <EntrantsPanel data={data} reload={reload} />}
      {tab === 'stream' && data.can.manage && <StreamPanel data={data} reload={reload} />}
      {tab === 'settings' && data.can.manage && <TSettings data={data} reload={reload} onDeleted={() => (window.location.href = '/portal/tournaments')} />}
      {picked && <MatchDialog tid={t.id} match={picked} entrants={data.entrants} bestOf={t.best_of} format={t.format} onClose={() => setPicked(null)} onDone={reload} />}
    </div>
  );
}
