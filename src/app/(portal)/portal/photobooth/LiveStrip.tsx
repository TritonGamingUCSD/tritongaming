'use client';

import { useEffect, useRef } from 'react';
import { FILTER_CSS, composition, type BoothConfig, type Overlay } from '@/lib/photobooth/booth';
import styles from './photobooth.module.css';

const CELL_PX = 240; // the width each live photo is drawn at (the screen shows it smaller or a little bigger)

// A whole strip, live: every photo of the chosen look shows the camera at once, with the look's frame, its stickers where each photo has them, its colours and its words, so a guest sees themselves in the finished picture before taking it.
// One camera feeds them all (each photo is drawn from the camera's own picture, mirrored like the big screen).
export function LiveStrip({
  video,
  config,
  frameUrl,
  stickers,
  height,
}: {
  video: HTMLVideoElement | null;
  config: BoothConfig;
  frameUrl: string;
  stickers: Overlay[];
  height?: number;
}) {
  const comp = composition(config.layout, config.aspect, !!config.footer.trim());
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const pct = (n: number, of: number) => `${(n / of) * 100}%`;

  useEffect(() => {
    if (!video) return;
    let raf = 0;
    let last = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 40) return; // (about 25 pictures a second is plenty for several strips at once)
      last = now;
      const vw = video.videoWidth,
        vh = video.videoHeight;
      if (vw && vh) {
        for (const el of canvases.current) {
          const ctx = el?.getContext('2d');
          if (!el || !ctx) continue;
          const scale = Math.max(el.width / vw, el.height / vh);
          const sw = el.width / scale,
            sh = el.height / scale;
          ctx.setTransform(-1, 0, 0, 1, el.width, 0); // (mirrored, like the camera on the big screen)
          ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, el.width, el.height);
        }
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [video, comp.cells.length]);

  return (
    <div
      className={styles.liveStrip}
      style={{ aspectRatio: `${comp.width} / ${comp.height}`, background: config.strip_bg, ...(height ? { height: `${height}px` } : {}) }}
      aria-label="Your picture, live"
    >
      {comp.cells.map((c, i) => (
        <div key={i} className={styles.liveCell} style={{ left: pct(c.x, comp.width), top: pct(c.y, comp.height), width: pct(c.w, comp.width), height: pct(c.h, comp.height) }}>
          <canvas
            ref={(el) => {
              canvases.current[i] = el;
            }}
            width={CELL_PX}
            height={Math.round((CELL_PX * c.h) / c.w)}
            style={{ filter: FILTER_CSS[config.filter] }}
          />
          {frameUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.camFrame} src={frameUrl} alt="" />
          )}
          {stickers.map((s) => {
            const p = s.placements[i];
            return p ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={s.id}
                src={s.image}
                alt=""
                draggable={false}
                className={styles.placed}
                style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${p.size * 100}%`, transform: `translate(-50%, -50%) rotate(${p.rotation}deg)` }}
              />
            ) : null;
          })}
        </div>
      ))}
      {config.footer.trim() && (
        <div
          className={styles.previewFooter}
          style={{ left: 0, top: pct(comp.footer.y, comp.height), width: '100%', height: pct(comp.footer.h, comp.height), color: config.text_color }}
        >
          {config.footer}
        </div>
      )}
    </div>
  );
}
