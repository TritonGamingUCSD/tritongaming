'use client';

import { useEffect, useRef, useState } from 'react';
import { Maximize2, LayoutGrid, Presentation } from 'lucide-react';
import { PhotoWall } from '@/components/PhotoWall/PhotoWall';
import type { GalleryData } from '@/lib/photobooth/gallery';
import styles from './gallery.module.css';

// The gallery on screen: a grid of the pictures (new ones pop in) or a wall for a big screen. It looks for new pictures every few seconds. The choice is in the address (?wall=1).
export function GalleryView({ token, initial, initialWall }: { token: string; initial: GalleryData; initialWall: boolean }) {
  const [data, setData] = useState(initial);
  const [wall, setWall] = useState(initialWall);
  const known = useRef(new Set(initial.photos.map((p) => p.token)));
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useEffect(() => {
    let live = true;
    const id = window.setInterval(async () => {
      const res = await fetch(`/api/gallery/${token}`, { cache: 'no-store' }).catch(() => null);
      if (!live || !res?.ok) return;
      const next = (await res.json()) as GalleryData;
      const added = next.photos.filter((p) => !known.current.has(p.token)).map((p) => p.token);
      added.forEach((t) => known.current.add(t));
      setData(next);
      if (added.length) setFresh((f) => new Set([...f, ...added]));
    }, 8000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [token]);

  const show = (w: boolean) => {
    setWall(w);
    const url = new URL(window.location.href);
    if (w) url.searchParams.set('wall', '1');
    else url.searchParams.delete('wall');
    window.history.replaceState(null, '', url);
  };

  const switcher = (
    <div className={styles.switch}>
      <button type="button" className={styles.switchBtn} onClick={() => show(!wall)}>
        {wall ? <LayoutGrid size={16} aria-hidden="true" /> : <Presentation size={16} aria-hidden="true" />} {wall ? 'Grid' : 'Wall'}
      </button>
      {wall && (
        <button type="button" className={styles.switchBtn} onClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)} aria-label="Full screen">
          <Maximize2 size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );

  if (wall)
    return (
      <main className={styles.wallPage} style={{ ['--accent' as string]: data.accent }}>
        <PhotoWall photos={data.photos} spotlight />
        <div className={styles.wallTitle}>
          <strong>{data.name}</strong>
          <span>
            {data.photos.length} picture{data.photos.length === 1 ? '' : 's'}
          </span>
        </div>
        {data.photos.length === 0 && <p className={styles.wallEmpty}>Pictures from the booth show up here.</p>}
        {switcher}
      </main>
    );

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{data.name}</h1>
      <p className={styles.note}>Pictures from the booth. Tap one to download it. Each is deleted a few days after it was taken.</p>
      {switcher}
      {data.photos.length === 0 ? (
        <p className={styles.note}>Pictures from the booth show up here.</p>
      ) : (
        <ul className={styles.grid}>
          {data.photos.map((p, i) => (
            <li key={p.token} className={fresh.has(p.token) ? styles.fresh : styles.settle} style={{ animationDelay: fresh.has(p.token) ? '0s' : `${Math.min(i, 20) * 40}ms` }}>
              <a href={`/photos/${p.token}`} className={styles.item}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="A picture from the photo booth" loading="lazy" />
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.brand}>Triton Gaming · Gaming Org at UC San Diego</p>
    </main>
  );
}
