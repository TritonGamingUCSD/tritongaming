'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { composition, type BoothConfig } from '@/lib/photobooth/booth';
import type { BoothData } from './api';
import { LiveStrip } from './LiveStrip';
import styles from './photobooth.module.css';

const ARROWS = 200; // the room the two arrows take on the sides, in pixels
const LABEL = 90; // the look's name and the dots under the strip, in pixels
const SWIPE = 50; // how far a finger or a mouse has to slide to change the look

// The booth's looks one at a time, like a gallery: one big strip, live with the camera in every photo, with an arrow on each side (or slide it, or use the arrow keys) to see the next look, and dots to show where you are. The
// guest settles on the one they like and uses the side panel's button.
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
  const from = useRef<number | null>(null);
  const [size, setSize] = useState({ w: 900, h: 600 });
  const [dir, setDir] = useState<'next' | 'back'>('next');
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const at = Math.max(
    0,
    looks.findIndex((l) => l.id === selectedId),
  );
  const look = looks[at];
  if (!look) return null;
  const config = { ...base, ...look.style } as BoothConfig;
  const c = composition(config.layout, config.aspect, !!config.footer.trim());
  const height = Math.max(120, Math.min(size.h - LABEL, (size.w - ARROWS) / (c.width / c.height)));
  const go = (by: 1 | -1) => {
    setDir(by === 1 ? 'next' : 'back');
    onPick(looks[(at + by + looks.length) % looks.length].id);
  };
  return (
    <div ref={box} className={styles.pickArea}>
      <button type="button" className={`${styles.pickArrow} ${styles.pickArrowLeft}`} onClick={() => go(-1)} aria-label="Previous look">
        <ChevronLeft size={34} aria-hidden="true" />
      </button>
      <div
        key={look.id}
        className={`${styles.pickStage} ${dir === 'next' ? styles.pickFromRight : styles.pickFromLeft}`}
        onPointerDown={(e) => {
          from.current = e.clientX;
        }}
        onPointerUp={(e) => {
          if (from.current !== null && Math.abs(e.clientX - from.current) > SWIPE) go(e.clientX < from.current ? 1 : -1);
          from.current = null;
        }}
        onPointerCancel={() => {
          from.current = null;
        }}
        aria-live="polite"
      >
        <LiveStrip video={video} config={config} frameUrl={look.frame.image} stickers={look.overlays} height={height} />
        <span className={styles.pickName}>{look.name}</span>
      </div>
      <button type="button" className={`${styles.pickArrow} ${styles.pickArrowRight}`} onClick={() => go(1)} aria-label="Next look">
        <ChevronRight size={34} aria-hidden="true" />
      </button>
      <div className={styles.pickDots} role="tablist" aria-label="Looks">
        {looks.map((l, i) => (
          <button
            key={l.id}
            type="button"
            role="tab"
            aria-selected={i === at}
            aria-label={l.name}
            className={i === at ? styles.pickDotOn : ''}
            onClick={() => (setDir(i > at ? 'next' : 'back'), onPick(l.id))}
          />
        ))}
      </div>
    </div>
  );
}
