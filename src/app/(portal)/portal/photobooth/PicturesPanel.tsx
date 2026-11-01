'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Eye, EyeOff, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import { confirmHold } from '@/lib/ui/confirmHold';
import { showToast } from '@/lib/ui/toast';
import { call } from './api';
import styles from './photobooth.module.css';

interface Pic {
  id: string;
  token: string;
  url: string;
  created_at: string;
  shared: boolean;
  hidden: boolean;
  downloads: number;
  animated: boolean;
}
interface Stats {
  total: number;
  gallery: number;
  hidden: number;
  downloads: number;
}

// The pictures the booth still holds (they go when their days are up): how many, how many are in the gallery or downloaded, hide any one from the gallery and the booth's welcome screen, delete one, or save them all for the club.
export function PicturesPanel({ booth }: { booth: string }) {
  const [pics, setPics] = useState<Pic[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [zipping, setZipping] = useState(false);
  const load = useCallback(async () => {
    const r = await call<{ photos: Pic[]; stats: Stats }>(`/api/photobooth/booths/${booth}/pictures`);
    if (r.ok) {
      setPics(r.data.photos);
      setStats(r.data.stats);
    } else setError(r.error);
  }, [booth]);
  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const hide = async (p: Pic) => {
    const r = await call(`/api/photobooth/booths/${booth}/pictures/${p.id}`, 'PATCH', { hidden: !p.hidden });
    if (r.ok) await load();
    else setError(r.error);
  };
  const remove = async (p: Pic) => {
    if (!(await confirmHold({ title: 'Delete This Picture?', message: 'It is deleted now, including its guest page and animated strip.', confirmLabel: 'Hold To Delete' }))) return;
    const r = await call(`/api/photobooth/booths/${booth}/pictures/${p.id}`, 'DELETE');
    if (r.ok) await load();
    else setError(r.error);
  };
  const saveAll = async () => {
    if (!pics?.length) return;
    setZipping(true);
    try {
      const { zipSync } = await import('fflate');
      const files: Record<string, Uint8Array> = {};
      let n = 0;
      for (const p of pics) {
        const res = await fetch(p.url);
        if (!res.ok) continue;
        files[`photo-${String(++n).padStart(3, '0')}.${p.url.split('.').pop()?.split('?')[0] ?? 'jpg'}`] = new Uint8Array(await res.arrayBuffer());
      }
      const blob = new Blob([zipSync(files, { level: 0 }) as BlobPart], { type: 'application/zip' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${booth}-pictures.zip`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } catch {
      showToast('Couldn’t make the zip. Try again.');
    }
    setZipping(false);
  };

  if (!pics || !stats) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading pictures…" />;
  return (
    <div className={styles.tools}>
      {error && <Notice tone="error">{error}</Notice>}
      <dl className={styles.picStats}>
        {(
          [
            ['Pictures', stats.total],
            ['In Gallery', stats.gallery],
            ['Hidden', stats.hidden],
            ['Downloads', stats.downloads],
          ] as const
        ).map(([label, n]) => (
          <div key={label} className={styles.picStat}>
            <dd style={{ margin: 0 }}>
              <strong>{n}</strong>
            </dd>
            <dt className={styles.hint}>{label}</dt>
          </div>
        ))}
      </dl>
      <Button size="sm" variant="secondary" onClick={() => void saveAll()} disabled={!pics.length || zipping}>
        <Download size={15} aria-hidden="true" /> {zipping ? 'Making The Zip…' : 'Download All Pictures'}
      </Button>
      {pics.length === 0 ? (
        <p className={styles.hint}>No pictures yet. They show up here as guests take them.</p>
      ) : (
        <ul className={styles.picGrid}>
          {pics.map((p) => (
            <li key={p.id} className={`${styles.pic} ${p.hidden ? styles.picHidden : ''}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="A guest’s picture" loading="lazy" />
              {(p.hidden || !p.shared) && <span className={styles.picTag}>{p.hidden ? 'Hidden' : 'Guest removed'}</span>}
              <div className={styles.picBar}>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void hide(p)}
                  aria-label={p.hidden ? 'Show in the gallery' : 'Hide from the gallery'}
                  title={p.hidden ? 'Show in the gallery' : 'Hide from the gallery'}
                >
                  {p.hidden ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void remove(p)} aria-label="Delete the picture" title="Delete the picture">
                  <Trash2 size={14} aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
