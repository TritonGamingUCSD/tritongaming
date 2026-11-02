'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Download, Eye, EyeOff, Trash2, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import { PictureZoom } from '@/components/ui/PictureZoom';
import { formatPacificDateTime } from '@/lib/core/timezone';
import { confirmHold } from '@/lib/ui/confirmHold';
import { showToast } from '@/lib/ui/toast';
import { call } from './api';
import styles from './photobooth.module.css';

interface Pic {
  id: string;
  token: string;
  url: string;
  gif: string;
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

const extOf = (url: string) => url.split('.').pop()?.split('?')[0] || 'jpg';

/** Saves a file from its public address under a name (a link to another address would only open it). */
async function save(url: string, name: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await res.blob());
    a.download = name;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    return true;
  } catch {
    return false;
  }
}

// The pictures the booth still holds (they go when their days are up), as a big grid: tap one to see it large, download that one (or its animated picture), hide it from the gallery and the booth's welcome screen, or delete it. Tick several
// to hide, delete or download just those as a zip; with none ticked, Download All saves every picture for the club.
export function PicturesPanel({ booth }: { booth: string }) {
  const [pics, setPics] = useState<Pic[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [zipping, setZipping] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await call<{ photos: Pic[]; stats: Stats }>(`/api/photobooth/booths/${booth}/pictures`);
    if (r.ok) {
      setPics(r.data.photos);
      setStats(r.data.stats);
      setPicked((p) => p.filter((id) => r.data.photos.some((x) => x.id === id)));
    } else setError(r.error);
  }, [booth]);
  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const hide = async (ids: string[], hidden: boolean) => {
    const rs = await Promise.all(ids.map((id) => call(`/api/photobooth/booths/${booth}/pictures/${id}`, 'PATCH', { hidden })));
    const bad = rs.find((r) => !r.ok);
    if (bad && !bad.ok) setError(bad.error);
    await load();
  };
  const remove = async (ids: string[]) => {
    const many = ids.length > 1;
    if (
      !(await confirmHold({
        title: many ? `Delete ${ids.length} Pictures?` : 'Delete This Picture?',
        message: many ? 'They are deleted now, including their guest pages and animated strips.' : 'It is deleted now, including its guest page and animated strip.',
        confirmLabel: 'Hold To Delete',
      }))
    )
      return;
    const rs = await Promise.all(ids.map((id) => call(`/api/photobooth/booths/${booth}/pictures/${id}`, 'DELETE')));
    const bad = rs.find((r) => !r.ok);
    if (bad && !bad.ok) setError(bad.error);
    setOpen(null);
    await load();
  };
  const one = async (p: Pic, gif: boolean) => {
    const when = new Date(p.created_at).toISOString().slice(0, 16).replace(/[-:T]/g, '');
    const ok = gif ? await save(p.gif, `${booth}-${when}-animated.gif`) : await save(p.url, `${booth}-${when}.${extOf(p.url)}`);
    if (!ok) showToast('Couldn’t save that. Try again.');
  };
  const zip = async (list: Pic[]) => {
    if (!list.length) return;
    setZipping(true);
    try {
      const { zipSync } = await import('fflate');
      const files: Record<string, Uint8Array> = {};
      let n = 0;
      for (const p of list) {
        const res = await fetch(p.url);
        if (!res.ok) continue;
        files[`photo-${String(++n).padStart(3, '0')}.${extOf(p.url)}`] = new Uint8Array(await res.arrayBuffer());
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
  const chosen = pics.filter((p) => picked.includes(p.id));
  const zoomed = pics.find((p) => p.id === open) ?? null;
  return (
    <div className={styles.picPage}>
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
      {pics.length === 0 ? (
        <p className={styles.hint}>No pictures yet. They show up here as guests take them, and are deleted after 7 days.</p>
      ) : (
        <>
          <div className={styles.picToolbar} role="toolbar" aria-label="Pictures">
            {chosen.length === 0 ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => setPicked(pics.map((p) => p.id))}>
                  <Check size={15} aria-hidden="true" /> Select All
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void zip(pics)} disabled={zipping}>
                  <Download size={15} aria-hidden="true" /> {zipping ? 'Making The Zip…' : 'Download All'}
                </Button>
              </>
            ) : (
              <>
                <strong>{chosen.length} selected</strong>
                <Button size="sm" variant="secondary" onClick={() => void zip(chosen)} disabled={zipping}>
                  <Download size={15} aria-hidden="true" /> {zipping ? 'Making The Zip…' : 'Download'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void hide(
                      picked,
                      chosen.some((p) => !p.hidden),
                    )
                  }
                >
                  {chosen.some((p) => !p.hidden) ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />} {chosen.some((p) => !p.hidden) ? 'Hide' : 'Show'}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void remove(picked)}>
                  <Trash2 size={15} aria-hidden="true" /> Delete
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setPicked([])}>
                  <X size={15} aria-hidden="true" /> Clear
                </Button>
              </>
            )}
          </div>
          <ul className={styles.picGrid}>
            {pics.map((p) => (
              <li key={p.id} className={`${styles.pic} ${p.hidden ? styles.picHidden : ''} ${picked.includes(p.id) ? styles.picOn : ''}`}>
                <button type="button" className={styles.picImg} onClick={() => setOpen(p.id)} aria-label="Show this picture larger">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="A guest’s picture" loading="lazy" />
                </button>
                <label className={styles.picCheck}>
                  <input type="checkbox" checked={picked.includes(p.id)} onChange={() => toggle(p.id)} aria-label="Select this picture" />
                </label>
                {(p.hidden || !p.shared) && <span className={styles.picTag}>{p.hidden ? 'Hidden' : 'Guest removed'}</span>}
                <div className={styles.picFoot}>
                  <span className={styles.picWhen}>
                    {formatPacificDateTime(p.created_at)}
                    {p.downloads > 0 ? ` · ${p.downloads} download${p.downloads === 1 ? '' : 's'}` : ''}
                  </span>
                  <span className={styles.picBar}>
                    <button type="button" className={styles.picBtn} onClick={() => void one(p, false)} aria-label="Download this picture" title="Download">
                      <Download size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={styles.picBtn}
                      onClick={() => void hide([p.id], !p.hidden)}
                      aria-label={p.hidden ? 'Show in the gallery' : 'Hide from the gallery'}
                      title={p.hidden ? 'Show in the gallery' : 'Hide from the gallery'}
                    >
                      {p.hidden ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
                    </button>
                    <button type="button" className={styles.picBtn} onClick={() => void remove([p.id])} aria-label="Delete the picture" title="Delete">
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {zoomed && (
        <PictureZoom src={zoomed.url} title={`Taken ${formatPacificDateTime(zoomed.created_at)}`} onClose={() => setOpen(null)}>
          <Button size="sm" onClick={() => void one(zoomed, false)}>
            <Download size={15} aria-hidden="true" /> Download Picture
          </Button>
          {zoomed.animated && zoomed.gif && (
            <Button size="sm" variant="secondary" onClick={() => void one(zoomed, true)}>
              <Download size={15} aria-hidden="true" /> Animated
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => void hide([zoomed.id], !zoomed.hidden)}>
            {zoomed.hidden ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />} {zoomed.hidden ? 'Show' : 'Hide'}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void remove([zoomed.id])}>
            <Trash2 size={15} aria-hidden="true" /> Delete
          </Button>
        </PictureZoom>
      )}
    </div>
  );
}
