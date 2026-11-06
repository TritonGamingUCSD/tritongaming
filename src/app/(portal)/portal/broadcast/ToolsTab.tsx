'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import { Select } from '@/components/ui/Field';
import { call, type TournamentLite } from './types';
import styles from './broadcast.module.css';

// One place to jump into the stream tools of a tournament: the producer's Control panel, the overlay links and OBS scenes, and its bracket.
export default function ToolsTab({ divisionId, divisionSlug }: { divisionId?: string; divisionSlug?: string }) {
  const [list, setList] = useState<(TournamentLite & { status: string })[] | null>(null);
  const [pick, setPick] = useState('');
  useEffect(() => {
    void (async () => {
      const r = await call<{ tournaments: (TournamentLite & { status: string })[] }>('GET', divisionId ? `/api/tournaments?division=${divisionId}` : '/api/tournaments?owner=club');
      setList(r.ok ? r.j.tournaments : []);
      if (r.ok && r.j.tournaments[0]) setPick(r.j.tournaments.find((t) => t.status === 'live')?.slug ?? r.j.tournaments[0].slug);
    })();
  }, [divisionId]);
  const tool = (tab: string) => (divisionSlug ? `/portal/${divisionSlug}/tournaments/${pick}?t=${tab}` : `/portal/tournaments/${pick}/${tab}`);
  if (!list) return <Loading label="Loading…" />;
  if (list.length === 0) return <Notice tone="info">No tournaments yet. Make one under Events → Tournaments, then its OBS tools show up here.</Notice>;
  return (
    <div className={styles.wrap}>
      <label className={styles.pick}>
        <span>Tournament</span>
        <Select value={pick} onChange={(e) => setPick(e.target.value)}>
          {list.map((t) => (
            <option key={t.id} value={t.slug}>
              {t.name}
            </option>
          ))}
        </Select>
      </label>
      <div className={styles.toolGrid}>
        <a className={styles.tool} href={tool('control')}>
          <b>Control panel</b>
          <span>Tap who won each game. The scoreboard overlay follows live.</span>
        </a>
        <a className={styles.tool} href={tool('stream')}>
          <b>Overlays and OBS scenes</b>
          <span>Pick the look, preview it, copy links or download the OBS scene file.</span>
        </a>
        <a className={styles.tool} href={tool('bracket')}>
          <b>Bracket</b>
          <span>Enter full results, set stations, fix mistakes.</span>
        </a>
        <a className={styles.tool} href={`/tournaments/${pick}`} target="_blank" rel="noopener noreferrer">
          <b>
            Public page <ExternalLink size={13} aria-hidden="true" />
          </b>
          <span>What viewers see on the website while you stream.</span>
        </a>
      </div>
      <ol className={styles.steps}>
        <li>Open the tournament’s Stream tab and download the OBS scenes. In OBS, import them and switch to the new scene collection.</li>
        <li>Before going live, mark the first match live in the Control panel and check the scoreboard shows in OBS.</li>
        <li>During the show, one person runs the Control panel; the overlays update by themselves.</li>
      </ol>
    </div>
  );
}
