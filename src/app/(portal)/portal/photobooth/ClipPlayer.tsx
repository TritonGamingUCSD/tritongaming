'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './photobooth.module.css';

// One big screen that plays each shot's live clip in turn (the moments just before the shutter, then the shot), over and over, while the animated strip plays beside it. `clips[i]` are the finished frames of shot i.
export function ClipPlayer({ clips, frameMs }: { clips: HTMLCanvasElement[][]; frameMs: number }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [which, setWhich] = useState(0);
  useEffect(() => {
    const el = canvas.current;
    const first = clips[0]?.[0];
    if (!el || !first) return;
    el.width = first.width;
    el.height = first.height;
    const ctx = el.getContext('2d')!;
    let shot = 0,
      frame = 0;
    const draw = () => {
      const f = clips[shot]?.[frame];
      if (f) ctx.drawImage(f, 0, 0, el.width, el.height);
      frame++;
      if (frame >= (clips[shot]?.length ?? 0)) {
        frame = 0;
        shot = (shot + 1) % clips.length;
        setWhich(shot);
      }
    };
    draw();
    const t = window.setInterval(draw, frameMs);
    return () => window.clearInterval(t);
  }, [clips, frameMs]);
  return (
    <div className={styles.clipBox}>
      <canvas ref={canvas} className={styles.clipCanvas} aria-label="Your live clips" role="img" />
      <span className={styles.clipTag}>
        Live · Photo {which + 1} of {clips.length}
      </span>
    </div>
  );
}
