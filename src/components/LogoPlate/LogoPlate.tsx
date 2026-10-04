'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './LogoPlate.module.css';

// A logo on a plate that is always the opposite of the logo: a light (white-ish) logo gets a dark plate, a dark (black-ish) logo gets a paper plate,
// so a logo can never melt into its background. The logo's brightness is measured once in the browser (the transparent parts are ignored).
// If the picture can't be read (blocked by its host), it sits on the paper plate.
export default function LogoPlate({ src, alt, className = '', imgClassName = '' }: { src: string; alt: string; className?: string; imgClassName?: string }) {
  const [tone, setTone] = useState<'paper' | 'dark'>('paper');
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = 24;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 24, 24);
        const d = ctx.getImageData(0, 0, 24, 24).data;
        let sum = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 40) continue;                       // see-through pixel
          sum += (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
          n++;
        }
        // A logo with a solid background of its own is its own plate; only judge logos that are mostly see-through.
        const transparent = 1 - n / (24 * 24);
        if (!cancelled && n > 0 && transparent > 0.25) setTone(sum / n > 0.62 ? 'dark' : 'paper');
      } catch { /* cross-origin pixels blocked: keep the paper plate */ }
    };
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);

  return (
    <span className={`${styles.plate} ${tone === 'dark' ? styles.dark : ''} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={ref} src={src} alt={alt} className={imgClassName} loading="lazy" />
    </span>
  );
}
