'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './LogoPlate.module.css';

// A logo on a plate that is always the opposite of the logo: a light (white-ish) logo gets a dark plate, a dark (black-ish) logo gets a paper plate,
// so a logo can never melt into its background. The logo's brightness is measured once in the browser (the transparent parts are ignored).
// If the picture can't be read (blocked by its host), it sits on the paper plate.
export default function LogoPlate({ src, alt, className = '', imgClassName = '' }: { src: string; alt: string; className?: string; imgClassName?: string }) {
  const [tone, setTone] = useState<'paper' | 'dark'>('paper');
  // Many logos come with a transparent margin of their own and look small on the plate. The artwork's bounding box is measured and the logo
  // is enlarged (never more than 1.9x) and re-centred so the artwork fills the plate.
  const [zoom, setZoom] = useState<{ s: number; x: number; y: number } | null>(null);
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

        // Bounding box of the artwork, measured at a finer size with the picture fitted (not stretched) into a square.
        const N = 64;
        const c2 = document.createElement('canvas');
        c2.width = c2.height = N;
        const x2 = c2.getContext('2d', { willReadFrequently: true });
        if (x2 && img.naturalWidth && img.naturalHeight) {
          const sc = N / Math.max(img.naturalWidth, img.naturalHeight);
          const dw = img.naturalWidth * sc, dh = img.naturalHeight * sc;
          x2.drawImage(img, (N - dw) / 2, (N - dh) / 2, dw, dh);
          const px = x2.getImageData(0, 0, N, N).data;
          let minX = N, minY = N, maxX = -1, maxY = -1;
          for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
            if (px[(y * N + x) * 4 + 3] < 40) continue;
            if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
          if (maxX >= 0) {
            const w = maxX - minX + 1, h = maxY - minY + 1;
            const s = Math.min(1.9, (0.96 * N) / Math.max(w, h));
            if (!cancelled && s > 1.08) setZoom({ s, x: ((N / 2 - (minX + maxX + 1) / 2) / N) * 100 * s, y: ((N / 2 - (minY + maxY + 1) / 2) / N) * 100 * s });
          }
        }
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
      <img ref={ref} src={src} alt={alt} className={imgClassName} loading="lazy" style={zoom ? { transform: `translate(${zoom.x}%, ${zoom.y}%) scale(${zoom.s})` } : undefined} />
    </span>
  );
}
