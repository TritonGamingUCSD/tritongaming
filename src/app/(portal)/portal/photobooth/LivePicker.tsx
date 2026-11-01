'use client';

import { useEffect, useRef, useState } from 'react';
import { composition, type BoothConfig } from '@/lib/photobooth/booth';
import type { BoothData } from './api';
import { LiveStrip } from './LiveStrip';
import styles from './photobooth.module.css';

const GAP = 24;

// Every look of the booth as a live strip side by side (the camera shows in every photo of every strip, each with its own frame, stickers and colours), so a guest can see the differences and tap the one they like. The strips
// are made as big as the space allows: all of them fit in one row.
export function LivePicker({
  video,
  base,
  looks,
  selectedId,
  onPick,
}: {
  video: HTMLVideoElement | null;
  base: BoothData['config'];
  looks: BoothData['looks'];
  selectedId: string;
  onPick: (id: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 600 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const configs = looks.map((l) => ({ look: l, config: { ...base, ...l.style } as BoothConfig }));
  const ratios = configs.map(({ config }) => {
    const c = composition(config.layout, config.aspect, !!config.footer.trim());
    return c.width / c.height;
  });
  const label = 44;
  const height = Math.max(
    120,
    Math.min(
      size.h - label,
      (size.w - GAP * (looks.length - 1)) /
        Math.max(
          0.1,
          ratios.reduce((a, b) => a + b, 0),
        ),
    ),
  );
  return (
    <div ref={box} className={styles.pickArea}>
      <div className={styles.pickStrips} role="radiogroup" aria-label="Look" style={{ gap: `${GAP}px` }}>
        {configs.map(({ look, config }) => (
          <button
            key={look.id}
            type="button"
            role="radio"
            aria-checked={look.id === selectedId}
            className={`${styles.pickStrip} ${look.id === selectedId ? styles.pickStripOn : ''}`}
            onClick={() => onPick(look.id)}
          >
            <LiveStrip video={video} config={config} frameUrl={look.frame.image} stickers={look.overlays} height={height} />
            <span className={styles.pickName}>{look.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
