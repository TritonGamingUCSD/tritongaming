'use client';

import { useState } from 'react';
import { ArrowLeft, ExternalLink, Play, Swords } from 'lucide-react';
import Link from '@/components/portal/PortalLink';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import Button from '@/components/ui/Button';
import SectionTabs from '@/components/ui/SectionTabs';
import { usePortalParams } from '@/lib/portal/usePortalParams';
import { swissRounds, type Match } from '@/lib/tournaments/bracket';
import { rank, stageRanking, qualifiers } from '@/lib/tournaments/stages';
import { bestOfOf, currentStage, defOf, stageEngineMatches, stageField } from '@/lib/tournaments/run';
import type { MatchRow } from '@/lib/tournaments/store';
import { showToast } from '@/lib/ui/toast';
import BracketView from './BracketView';
import MatchDialog from './MatchDialog';
import EntrantsPanel from './EntrantsPanel';
import StreamPanel from './StreamPanel';
import TSettings from './TSettings';
import StructurePanel from './StructurePanel';
import ControlPanel from './ControlPanel';
import NextStageBanner from './NextStageBanner';
import { call, FORMAT_NAMES, STATUS_NAMES } from './types';
import { useTournament } from './useTournament';
import styles from './tournaments.module.css';

type Tab = 'bracket' | 'control' | 'structure' | 'entrants' | 'stream' | 'settings';
const TABS: Tab[] = ['bracket', 'control', 'structure', 'entrants', 'stream', 'settings'];

// One tournament for its organizers: the bracket (enter scores, call stations), the entrants and seeds, the stream links, and the settings. The address says which tab: /portal/tournaments/<tournament>/<tab>.
export default function TournamentDetail({ slug, subtab, divisions }: { slug: string; subtab: string | null; divisions: { id: string; name: string }[] }) {
  const { data, error, reload } = useTournament(slug);
  const setParams = usePortalParams();
  const [picked, setPicked] = useState<MatchRow | null>(null);
  const [stagePick, setStagePick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  if (!data) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading the tournament…" />;
  const t = data.tournament;
  const tab: Tab = TABS.includes(subtab as Tab) ? (subtab as Tab) : t.status === 'draft' || t.status === 'registration' ? 'structure' : 'bracket';
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
  const active = data.entrants.filter((e) => !e.dropped);
  const cur = currentStage(data.stages);
  const shown = data.stages.find((x) => x.id === stagePick) ?? cur;
  const engine: Match[] = shown ? stageEngineMatches(data.matches, shown) : [];
  const shownRows = data.matches.filter((m) => m.stage_id === shown?.id);
  const field = shown ? stageField(data.stages, shown, data.entrants, data.matches, data.stageEntrants) : [];
  const roundsTotal = shown?.format === 'swiss' ? (shown.settings.swiss_rounds ?? swissRounds(field.length || active.length)) : 0;
  const lastRound = Math.max(0, ...engine.map((m) => m.round));
  const roundDone = engine.length > 0 && !engine.some((m) => m.status === 'ready' || m.status === 'pending');
  const seeds = new Map(field.map((e) => [e.id, e.seed]));
  const poolRows =
    shown && (shown.format === 'roundrobin' || shown.format === 'swiss')
      ? [...new Set(engine.map((m) => m.group ?? 0))].map((g) => {
          const inG = engine.filter((m) => (m.group ?? 0) === g);
          const ids = g ? [...new Set(inG.flatMap((m) => [m.a, m.b]).filter((x): x is string => !!x && x !== 'BYE'))] : field.map((e) => e.id);
          return { group: g, rows: rank(ids, inG, shown.settings, seeds) };
        })
      : null;
  const nameOf = (id: string) => data.entrants.find((e) => e.id === id)?.name ?? '?';
  const nextStage = shown ? data.stages.find((x) => x.position === shown.position + 1) : undefined;
  const nextReady = !!shown && shown.status === 'complete' && !!nextStage && nextStage.status === 'pending';
  const ranking = shown ? stageRanking(defOf(shown), field, engine) : [];
  const moving = shown ? qualifiers(defOf(shown), ranking) : [];

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
          { id: 'control', label: 'Control' },
          { id: 'structure', label: 'Structure', count: data.stages.length },
          { id: 'entrants', label: 'Entrants', count: active.length },
          { id: 'stream', label: 'Stream' },
          { id: 'settings', label: 'Settings' },
        ]}
      />
      {tab === 'bracket' &&
        (data.matches.length === 0 ? (
          <Notice tone="info">The bracket is made when you press Start Bracket. Set the structure and the entrants first (the Structure and Entrants tabs).</Notice>
        ) : (
          <>
            {data.stages.length > 1 && (
              <nav className={styles.stageNav} aria-label="Stages">
                {data.stages.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    aria-current={x.id === shown?.id ? 'true' : undefined}
                    className={`${styles.stageChip} ${x.id === shown?.id ? styles.stageOn : ''} ${styles[`sc_${x.status}`]}`}
                    onClick={() => setStagePick(x.id)}
                  >
                    <b>{x.position}</b> {x.name}
                    <small>{x.status === 'live' ? 'Playing' : x.status === 'complete' ? 'Done' : 'Next'}</small>
                  </button>
                ))}
              </nav>
            )}
            {nextReady && nextStage && data.can.manage && <NextStageBanner data={data} from={shown!} stage={nextStage} moving={moving} reload={reload} />}
            {shown?.format === 'swiss' && shownRows.length > 0 && (
              <div className={styles.swissBar}>
                <span>
                  Round {lastRound} of {roundsTotal}
                </span>
                {roundDone && lastRound < roundsTotal && (
                  <Button disabled={busy} onClick={() => act({ action: 'next-round', stage_id: shown.id }, `Round ${lastRound + 1} dealt`)}>
                    Deal Round {lastRound + 1}
                  </Button>
                )}
              </div>
            )}
            {shownRows.length === 0 ? (
              <Notice tone="info">
                {shown?.name} has not started yet. {shown && shown.position > 1 ? 'It starts when the stage before it is finished.' : ''}
              </Notice>
            ) : (
              <BracketView matches={shownRows} entrants={data.entrants} format={shown?.format ?? t.format} canRun={data.can.run} onPick={setPicked} />
            )}
            {poolRows &&
              shownRows.length > 0 &&
              poolRows.map((p) => (
                <section key={p.group} className={styles.card}>
                  <h3 className={styles.cardTitle}>{p.group ? `Pool ${String.fromCharCode(64 + p.group)} standings` : 'Standings'}</h3>
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
                      {p.rows.map((r, i) => (
                        <tr
                          key={r.id}
                          className={shown?.advance.mode === 'top' && i < ((shown.advance.count ?? 0) as number) && (shown.advance.per_group || !p.group) ? styles.advancing : ''}
                        >
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
              ))}
          </>
        ))}
      {tab === 'control' && <ControlPanel data={data} reload={reload} />}
      {tab === 'structure' && <StructurePanel data={data} reload={reload} />}
      {tab === 'entrants' && <EntrantsPanel data={data} reload={reload} />}
      {tab === 'stream' && data.can.manage && <StreamPanel data={data} reload={reload} />}
      {tab === 'settings' && data.can.manage && <TSettings data={data} reload={reload} onDeleted={() => (window.location.href = '/portal/tournaments')} />}
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
