'use client';

import { Copy, ExternalLink, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';
import { showToast } from '@/lib/ui/toast';
import { call, type TData } from './types';
import styles from './tournaments.module.css';

export const OVERLAYS = [
  { id: 'bracket', name: 'Bracket', size: '1920 × 1080', about: 'The whole bracket on a transparent background. It updates by itself as scores come in.' },
  { id: 'scoreboard', name: 'Scoreboard', size: '1920 × 200', about: 'A lower third for the match that is live: names, seeds, score, game and round.' },
  { id: 'next', name: 'Up next', size: '600 × 700', about: 'The matches that are called or ready, with their stations.' },
  { id: 'standings', name: 'Standings', size: '900 × 900', about: 'The table for round robin and Swiss, or the placements once an elimination bracket is done.' },
] as const;

// The links for OBS: each overlay is a page with a transparent background (add it as a Browser Source), plus the JSON feed for any tool that reads data. The private token lets them work while the tournament is a draft or not public.
export default function StreamPanel({ data, reload }: { data: TData; reload: () => void }) {
  const t = data.tournament;
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const q = `?token=${t.overlay_token}`;
  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    showToast('Link copied');
  };
  return (
    <div className={styles.panelGrid}>
      <section className={styles.card}>
        <h3 className={styles.cardTitle}>OBS browser sources</h3>
        <p className={styles.hint}>
          In OBS: Sources → + → Browser, paste the link, set the width and height shown, and leave “Custom CSS” empty. The background is transparent and the page updates itself.
        </p>
        <ul className={styles.links}>
          {OVERLAYS.map((o) => {
            const url = `${origin}/overlay/${t.slug}/${o.id}${q}`;
            return (
              <li key={o.id}>
                <div>
                  <strong>{o.name}</strong> <small>{o.size}</small>
                  <p>{o.about}</p>
                  <code>{url}</code>
                </div>
                <div className={styles.linkBtns}>
                  <Button variant="secondary" size="sm" onClick={() => copy(url)}>
                    <Copy size={13} aria-hidden="true" /> Copy
                  </Button>
                  <a className={styles.openLink} href={url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={13} aria-hidden="true" /> Open
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Data feed</h3>
        <p className={styles.hint}>JSON for stream tools, bots and scripts. It has names, seeds, scores, stations, what is live and next, and standings. No private details.</p>
        <code className={styles.feedUrl}>{`${origin}/api/tournaments/${t.slug}/feed${q}`}</code>
        <div className={styles.cardActions}>
          <Button variant="secondary" size="sm" onClick={() => copy(`${origin}/api/tournaments/${t.slug}/feed${q}`)}>
            <Copy size={13} aria-hidden="true" /> Copy Feed Link
          </Button>
        </div>
        <h3 className={styles.cardTitle}>Private token</h3>
        <p className={styles.hint}>Anyone with these links can read this tournament, even a draft. Make a new token if one leaks; the old links stop working.</p>
        <div className={styles.cardActions}>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              await call('PATCH', `/api/tournaments/${t.id}`, { new_overlay_token: true });
              reload();
              showToast('New token made. Replace the links in OBS.');
            }}
          >
            <RefreshCw size={13} aria-hidden="true" /> Make A New Token
          </Button>
        </div>
      </section>
    </div>
  );
}
