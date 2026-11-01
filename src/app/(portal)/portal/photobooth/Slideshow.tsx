'use client';

import { useEffect, useState } from 'react';
import { call } from './api';
import styles from './photobooth.module.css';

const SHOWN = 5;

// While the booth waits for the next guest: the latest pictures guests chose to share in the booth's gallery drift across the dark background, a few at a time, changing every few seconds. Nothing is shown until someone shares one.
export function Slideshow({ booth }: { booth: string }) {
  const [urls, setUrls] = useState<string[]>([]);
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const r = await call<{ photos: { url: string }[] }>(`/api/photobooth/booths/${booth}/recent`);
      if (alive && r.ok) setUrls(r.data.photos.map((p) => p.url));
    };
    void load();
    const refresh = window.setInterval(() => void load(), 60_000);
    return () => {
      alive = false;
      window.clearInterval(refresh);
    };
  }, [booth]);
  useEffect(() => {
    const id = window.setInterval(() => setTurn((t) => t + 1), 4500);
    return () => window.clearInterval(id);
  }, []);
  if (!urls.length) return null;
  const shown = Array.from({ length: Math.min(SHOWN, urls.length) }, (_, i) => ({ url: urls[(turn * 2 + i) % urls.length], slot: i }));
  return (
    <div className={styles.slideshow} aria-hidden="true">
      {shown.map((p) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`${p.slot}-${p.url}`} className={`${styles.slide} ${styles[`slide${p.slot}`]}`} src={p.url} alt="" draggable={false} />
      ))}
    </div>
  );
}
