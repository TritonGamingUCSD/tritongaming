'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import styles from './BodyStickers.module.css';

export type BodySticker = { url: string; top: number; right: boolean; rot: number; scale: number; bx: number; x: number };

// Stickers scattered down an event page. On wide screens they sit in the side margins behind the content. On phones there are no margins, so
// each one is placed in a gap between two sections (measured in the browser), where it is fully visible and cannot cover any text.
// Must sit inside a position:relative container whose other children are the page's sections.
export default function BodyStickers({ items }: { items: BodySticker[] }) {
  const layer = useRef<HTMLDivElement>(null);
  const [phone, setPhone] = useState(false);
  const [spots, setSpots] = useState<{ top: number; left: number; w: number }[]>([]);

  useLayoutEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const run = () => {
      setPhone(mq.matches);
      const host = layer.current?.parentElement;
      if (!mq.matches || !host) { setSpots([]); return; }
      const kids = Array.from(host.children).filter((c) => c !== layer.current && (c as HTMLElement).offsetHeight > 0) as HTMLElement[];
      const hostTop = host.getBoundingClientRect().top;
      const gaps: number[] = [];
      for (let i = 0; i < kids.length - 1; i++) {
        const a = kids[i].getBoundingClientRect(), b = kids[i + 1].getBoundingClientRect();
        if (b.top - a.bottom > 12) gaps.push((a.bottom + b.top) / 2 - hostTop);
      }
      if (!gaps.length) { setSpots([]); return; }
      const count = Math.min(items.length, gaps.length);
      const step = gaps.length / count;
      const width = host.clientWidth;
      setSpots(Array.from({ length: count }, (_, k) => {
        const it = items[k];
        const w = Math.round(Math.min(78, 52 * it.scale + 14));
        // Section titles are small tags at the left of each gap, so the stickers stay in the right 60% and ride a little above the gap's middle.
        return { top: gaps[Math.min(gaps.length - 1, Math.floor(k * step + step / 2))] - w * 0.6, left: (0.4 + 0.6 * it.x) * (width - w), w };
      }));
    };
    run();
    const ro = new ResizeObserver(run);
    if (layer.current?.parentElement) ro.observe(layer.current.parentElement);
    mq.addEventListener('change', run);
    return () => { ro.disconnect(); mq.removeEventListener('change', run); };
  }, [items]);

  return (
    <div ref={layer} className={styles.layer} aria-hidden="true">
      {phone
        ? spots.map((s, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={items[i].url} alt="" decoding="async" className={styles.gap} style={{ top: s.top, left: s.left, width: s.w, transform: `rotate(${items[i].rot}deg) translateZ(0)` }} />
          ))
        : items.map((b, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={b.url} alt="" decoding="async" className={`${styles.margin} ${b.right ? styles.r : styles.l}`} style={{ top: `${b.top}%`, transform: `rotate(${b.rot}deg) translateZ(0)`, '--bs': b.scale, '--bx': `${b.bx}rem` } as React.CSSProperties} />
          ))}
    </div>
  );
}
