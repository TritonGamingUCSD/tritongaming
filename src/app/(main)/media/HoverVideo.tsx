'use client';

import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import styles from './media.module.css';

// No player is loaded until someone asks for it. A card is just a poster with a play sticker; hovering flips through YouTube's
// own preview frames (three small stills, loaded on first hover, no video or iframe involved), and a click starts the real player in place.
// This replaces a page full of live YouTube iframes that re-created themselves on every hover, which is what made long videos lag.
const FRAMES = ['1', '2', '3'];

export default function HoverVideo({ videoId, title }: { videoId: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState(-1);          // -1 = the main poster
  const [warm, setWarm] = useState(false);          // preview stills are only fetched once someone hovers
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setFrame(-1);
  };
  const start = () => {
    setWarm(true);
    if (timer.current) return;
    let i = 0;
    timer.current = setInterval(() => { setFrame(i % FRAMES.length); i++; }, 900);
  };
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  if (playing) {
    return (
      <div className={styles.hoverWrap}>
        <iframe
          className={styles.videoEmbed}
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className={styles.facade}
      onClick={() => setPlaying(true)}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') start(); }}
      onPointerLeave={stop}
      onFocus={start}
      onBlur={stop}
      aria-label={`Play ${title}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="" className={styles.poster} loading="lazy" />
      {warm && FRAMES.map((f, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={f} src={`https://i.ytimg.com/vi/${videoId}/${f}.jpg`} alt="" className={`${styles.poster} ${styles.still} ${frame === i ? styles.stillOn : ''}`} />
      ))}
      <span className={styles.playSticker}><Play size={18} fill="currentColor" aria-hidden="true" /> Play</span>
    </button>
  );
}
