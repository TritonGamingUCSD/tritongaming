'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './PhotoWall.module.css';

export interface WallPhoto {
  token: string;
  url: string;
}

// Every picture of a booth as a wall of strips drifting slowly up and down in turn, filling whatever box it is put in. With `spotlight`, a picture that arrives while the wall is open is shown big in the middle for a few seconds first.
// `dim` keeps it quiet behind other things (the booth's welcome screen).
export function PhotoWall({ photos, spotlight = false, dim = false }: { photos: WallPhoto[]; spotlight?: boolean; dim?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(4);
  const [lit, setLit] = useState<WallPhoto | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const timer = useRef(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCols(Math.max(2, Math.min(8, Math.round(el.clientWidth / 210)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!seen.current) {
        seen.current = new Set(photos.map((p) => p.token)); // (the first load is not news)
        return;
      }
      const fresh = photos.filter((p) => !seen.current!.has(p.token));
      fresh.forEach((p) => seen.current!.add(p.token));
      if (spotlight && fresh.length) {
        setLit(fresh[0]);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setLit(null), 4500);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [photos, spotlight]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const lists = useMemo(() => {
    const out: WallPhoto[][] = Array.from({ length: cols }, () => []);
    if (photos.length === 0) return out;
    const slots = Math.max(photos.length, cols * 5); // (few pictures: they repeat so every strip is full and long enough to drift)
    for (let k = 0; k < slots; k++) out[k % cols].push(photos[k % photos.length]);
    return out;
  }, [photos, cols]);

  return (
    <div ref={box} className={`${styles.wall} ${dim ? styles.dim : ''}`} style={{ ['--cols' as string]: cols }} aria-hidden={dim}>
      {lists.map((list, c) => (
        <div key={c} className={styles.col}>
          <div className={styles.drift} style={{ animationDuration: `${Math.max(30, list.length * 8)}s`, animationDirection: c % 2 ? 'reverse' : 'normal' }}>
            {[...list, ...list].map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={`${p.token}-${i}`} src={p.url} alt="" className={styles.tile} loading="lazy" />
            ))}
          </div>
        </div>
      ))}
      {lit && (
        <div className={styles.spot} key={lit.token}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lit.url} alt="The newest picture" className={styles.spotImg} />
          <span className={styles.spotTag}>Just Taken</span>
        </div>
      )}
    </div>
  );
}
