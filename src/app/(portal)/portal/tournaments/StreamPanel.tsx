'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy, Download, ExternalLink, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Segmented } from './controls';
import { obsSceneCollection } from '@/lib/tournaments/obs';
import { showToast } from '@/lib/ui/toast';
import { call, type TData } from './types';
import styles from './tournaments.module.css';

export const OVERLAYS = [
  { id: 'scoreboard', name: 'Scoreboard', size: '1920 × 1080', about: 'A lower third for the match that is live: names, seeds, series score, round, station.' },
  { id: 'bracket', name: 'Bracket', size: '1920 × 1080', about: 'The whole bracket of the current stage. It updates by itself as scores come in.' },
  { id: 'next', name: 'Up next', size: '700 × 800', about: 'The matches that are live or ready, with their stations.' },
  { id: 'standings', name: 'Standings', size: '1000 × 900', about: 'The table for pools and Swiss, or the placements once a bracket is done.' },
  { id: 'champion', name: 'Champion', size: '1920 × 1080', about: 'A winner screen. It stays empty until the tournament is finished.' },
] as const;

// Everything for the stream: pick the look once (accent, size, light or dark), then copy a link per overlay, preview it, or download an OBS scene collection with all of them already set up. A private token lets them work while the tournament is a draft.
export default function StreamPanel({ data, reload }: { data: TData; reload: () => void }) {
  const t = data.tournament;
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const [accent, setAccent] = useState('f6c84c');
  const [scale, setScale] = useState('1');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [preview, setPreview] = useState<string | null>('scoreboard');
  const qs = (extra = '') => {
    const p = new URLSearchParams({ token: t.overlay_token });
    if (/^[0-9a-f]{6}$/i.test(accent) && accent.toLowerCase() !== 'f6c84c') p.set('accent', accent);
    if (scale !== '1') p.set('scale', scale);
    if (theme !== 'dark') p.set('theme', theme);
    return `?${p.toString()}${extra}`;
  };
  const urlOf = (id: string) => `${origin}/overlay/${t.slug}/${id}${qs()}`;
  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    showToast('Link copied');
  };
  const download = () => {
    const urls = Object.fromEntries(OVERLAYS.map((o) => [o.id, urlOf(o.id)]));
    const blob = new Blob([JSON.stringify(obsSceneCollection(t.name, urls), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${t.slug}-obs-scenes.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className={styles.panelGrid}>
      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Look</h3>
        <p className={styles.hint}>These apply to every link below. The page background is transparent, so the overlay sits on top of your game.</p>
        <div className={styles.lookRow}>
          <label>
            <span>Accent color</span>
            <span className={styles.colorRow}>
              <input type="color" value={`#${/^[0-9a-f]{6}$/i.test(accent) ? accent : 'f6c84c'}`} onChange={(e) => setAccent(e.target.value.slice(1))} aria-label="Accent color" />
              <Input value={accent} maxLength={6} onChange={(e) => setAccent(e.target.value.replace(/[^0-9a-f]/gi, ''))} aria-label="Accent color as hex" />
            </span>
          </label>
          <label>
            <span>Size</span>
            <Segmented
              label="Size"
              value={scale}
              options={[
                { value: '0.8', label: 'S' },
                { value: '1', label: 'M' },
                { value: '1.25', label: 'L' },
                { value: '1.5', label: 'XL' },
              ]}
              onChange={setScale}
            />
          </label>
          <label>
            <span>Text</span>
            <Segmented
              label="Theme"
              value={theme}
              options={[
                { value: 'dark', label: 'Light on dark' },
                { value: 'light', label: 'Dark on light' },
              ]}
              onChange={setTheme}
            />
          </label>
        </div>
        <div className={styles.cardActions}>
          <Button onClick={download}>
            <Download size={14} aria-hidden="true" /> Download OBS Scenes
          </Button>
        </div>
        <p className={styles.hint}>
          In OBS: Scene Collection → Import, choose the file, then switch to it. It has the scenes Match, Bracket, Standings and Champion with every overlay set up at the right
          size. (If your OBS version does not take the file, the links below do the same job by hand.)
        </p>
        <h3 className={styles.cardTitle}>Preview</h3>
        {preview && <PreviewFrame title={`${preview} overlay`} src={urlOf(preview)} />}
        <p className={styles.hint}>Shown on a checkerboard so you can see what is transparent.</p>
      </section>
      <section className={styles.card}>
        <h3 className={styles.cardTitle}>OBS browser sources</h3>
        <p className={styles.hint}>By hand: Sources → + → Browser, paste the link, set the width and height shown, and leave Custom CSS empty.</p>
        <ul className={styles.links}>
          {OVERLAYS.map((o) => (
            <li key={o.id}>
              <div>
                <strong>{o.name}</strong> <small>{o.size}</small>
                <p>{o.about}</p>
                <code>{urlOf(o.id)}</code>
              </div>
              <div className={styles.linkBtns}>
                <Button variant="secondary" size="sm" onClick={() => copy(urlOf(o.id))}>
                  <Copy size={13} aria-hidden="true" /> Copy
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setPreview(o.id)}>
                  Preview
                </Button>
                <a className={styles.openLink} href={urlOf(o.id)} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={13} aria-hidden="true" /> Open
                </a>
              </div>
            </li>
          ))}
        </ul>
        <h3 className={styles.cardTitle}>Data feed</h3>
        <p className={styles.hint}>JSON for stream tools, bots and scripts: names, seeds, scores, stations, what is live and next, standings. No private details.</p>
        <code className={styles.feedUrl}>{`${origin}/api/tournaments/${t.slug}/feed?token=${t.overlay_token}`}</code>
        <div className={styles.cardActions}>
          <Button variant="secondary" size="sm" onClick={() => copy(`${origin}/api/tournaments/${t.slug}/feed?token=${t.overlay_token}`)}>
            <Copy size={13} aria-hidden="true" /> Copy Feed Link
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              await call('PATCH', `/api/tournaments/${t.id}`, { new_overlay_token: true });
              reload();
              showToast('New token made. Replace the links in OBS.');
            }}
          >
            <RefreshCw size={13} aria-hidden="true" /> New Token
          </Button>
        </div>
        <p className={styles.hint}>Anyone with these links can read this tournament, even a draft. Make a new token if one leaks; the old links stop working.</p>
      </section>
    </div>
  );
}

// The overlay at its real 1920 × 1080 size, shrunk to fit the box.
function PreviewFrame({ src, title }: { src: string; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(0.3);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setK(el.clientWidth / 1920);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className={styles.previewBox}>
      <iframe title={title} src={src} style={{ transform: `scale(${k})` }} />
    </div>
  );
}
