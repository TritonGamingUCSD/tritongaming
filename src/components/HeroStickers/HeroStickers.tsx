'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import styles from './HeroStickers.module.css';

export type HeroSticker = { url: string; credit?: { name: string; link?: string } };
type Placed = { left: number; top: number; w: number; rot: number } | null;

const ROT = [-8, 7, -5, 9, -10, 6, -7, 8];

// Floating stickers for the event hero (wide screens). The page measures where the text, buttons and poster sit and puts each sticker in the
// open space, so none of them lands on the title, description, buttons or points note. They are spread out, each as far from the others as
// the space allows. Phones show them in a row under the poster instead (see the page).
export default function HeroStickers({ items, scale }: { items: HeroSticker[]; scale: number }) {
  const layer = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState<Placed[]>([]);

  useLayoutEffect(() => {
    const host = layer.current?.parentElement;
    if (!host) return;
    const mq = window.matchMedia('(max-width: 640px)');
    const run = () => {
      if (mq.matches) { setPlaced([]); return; }
      const hr = host.getBoundingClientRect();
      const W = hr.width, H = hr.height;
      const rects = [...host.querySelectorAll<HTMLElement>('[data-avoid]')].map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left - hr.left - 18, y: r.top - hr.top - 18, w: r.width + 36, h: r.height + 36 };
      });
      // the poster is taken as a whole (with a margin), so a sticker's credit chip is never half hidden behind it
      const poster = host.querySelector<HTMLElement>('[data-avoid-poster]');
      if (poster) {
        const r = poster.getBoundingClientRect();
        const ix = -16, iy = -16;
        rects.push({ x: r.left - hr.left + ix, y: r.top - hr.top + iy, w: r.width - ix * 2, h: r.height - iy * 2 });
      }
      const base = Math.min(120, Math.max(54, window.innerWidth * 0.09)) * scale;
      // Try the full size first; when the free space is too small for every sticker, shrink them step by step (never below 44px).
      let out: Placed[] = [];
      for (const f of [1, 0.85, 0.72, 0.6, 0.5, 0.42]) {
        const w = Math.max(44, Math.min(base * f, window.innerWidth * 0.26));
        const boxH = w * 1.1 + 28;                     // picture plus the credit chip under it
        const cols = 22, rows = 12;
        const mx = Math.max(44, W * 0.04), my = 26;       // keep clear of the edges of the hero
        let cands: { x: number; y: number }[] = [];
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const x = mx + (c / (cols - 1)) * Math.max(0, W - w - mx * 2), y = my + (r / (rows - 1)) * Math.max(0, H - boxH - my * 2);
          if (rects.some((k) => x < k.x + k.w && x + w > k.x && y < k.y + k.h && y + boxH > k.y)) continue;
          cands.push({ x, y });
        }
        out = [];
        const taken: { x: number; y: number }[] = [];
        for (let i = 0; i < items.length; i++) {
          if (!cands.length) { out.push(null); continue; }
          let best = cands[0], bestScore = -Infinity;
          for (const c of cands) {
            // first sticker: nearest the top-left corner; the rest: as far as possible from the stickers already placed
            const score = taken.length ? Math.min(...taken.map((t) => Math.hypot(t.x - c.x, t.y - c.y))) : -(c.x + c.y * 1.4);
            if (score > bestScore) { best = c; bestScore = score; }
          }
          taken.push(best);
          out.push({ left: best.x, top: best.y, w, rot: ROT[i % ROT.length] });
          cands = cands.filter((c) => !(c.x < best.x + w + 10 && c.x + w + 10 > best.x && c.y < best.y + boxH + 10 && c.y + boxH + 10 > best.y)); // stickers never overlap each other
        }
        if (out.every(Boolean)) break;
      }
      setPlaced(out);
    };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(host);
    host.querySelectorAll('[data-avoid], [data-avoid-poster]').forEach((el) => ro.observe(el));
    mq.addEventListener('change', run);
    // images inside the hero (the poster) change the layout as they load
    const imgs = [...host.querySelectorAll('img')];
    imgs.forEach((im) => im.addEventListener('load', run));
    return () => { ro.disconnect(); mq.removeEventListener('change', run); imgs.forEach((im) => im.removeEventListener('load', run)); };
  }, [items, scale]);

  return (
    <div ref={layer} className={styles.layer}>
      {items.map((s, i) => {
        const p = placed[i];
        if (!p) return null;
        return (
          <div key={s.url + i} className={styles.sticker} style={{ left: p.left, top: p.top, width: p.w, transform: `rotate(${p.rot}deg)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.url} alt="" aria-hidden="true" decoding="async" />
            {s.credit && (s.credit.link
              ? <a href={s.credit.link} target="_blank" rel="noopener noreferrer" className={styles.chip} title={`Sticker by ${s.credit.name}`}>By {s.credit.name}</a>
              : <span className={styles.chip}>By {s.credit.name}</span>)}
          </div>
        );
      })}
    </div>
  );
}
