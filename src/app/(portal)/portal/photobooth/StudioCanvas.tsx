'use client';

import { useRef, useState } from 'react';
import { PLACE_MAX, PLACE_MIN, cellRatio, composition, frameLayout, type Aspect, type BoothConfig, type FrameSpec, type Overlay, type Placement } from '@/lib/photobooth/booth';
import { cellSize } from '@/lib/photobooth/booth';
import styles from './photobooth.module.css';

/** What is selected on the canvas: the frame itself, a line of words, the logo or one copy of a sticker (by id and copy number, 0-based; `photo` is the copy's slot). */
export type Selection = { kind: 'frame' | 'top' | 'bottom' | 'logo' } | { kind: 'sticker'; id: string; photo: number } | null;

const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));

// The finished picture, big, in the middle of the studio, and everything on it can be touched: drag the logo or a line of words (on the first photo: the frame is the same on every photo), drag any sticker on any photo, pull its corner to
// make it bigger, turn it with the knob above it. A sticker belongs to the picture as a whole: it sits above every photo and frame and can reach over onto the next photo. The edits come out as small patches (the owner keeps the history); `onDrop` is the end of a move (the owner makes the whole move one undo step).
export function StudioCanvas({
  config,
  frame,
  drawing,
  logoRatio,
  stickers,
  selected,
  onSelect,
  onFrame,
  onSticker,
  onPlace,
  onRemoveFrom,
  onDrop,
}: {
  config: BoothConfig;
  frame: FrameSpec | null;
  /** A drawing of the frame (a picture address) to show over each photo. */
  drawing: string;
  /** The logo's height ÷ width, or null before it has loaded. */
  logoRatio: number | null;
  stickers: Overlay[];
  selected: Selection;
  onSelect: (s: Selection) => void;
  onFrame: (patch: Partial<FrameSpec>) => void;
  onSticker: (id: string, photo: number, patch: Partial<Placement>) => void;
  /** A sticker from the tray was dropped on the picture at (x, y) (fractions of the whole picture): a new copy of it goes there. */
  onPlace: (id: string, x: number, y: number) => void;
  /** A copy of a sticker was dragged off the picture (it is taken away). */
  onRemoveFrom: (id: string, photo: number) => void;
  onDrop: () => void;
}) {
  const comp = composition(config.layout, config.aspect, !!config.footer.trim());
  const pct = (n: number, of: number) => `${(n / of) * 100}%`;
  const cells = useRef<(HTMLDivElement | null)[]>([]);
  const drag = useRef<{ cell: number; sel: Selection; how: (x: number, y: number, rect: DOMRect) => void; removable: boolean } | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const [out, setOut] = useState(false); // (a sticker is being dragged off the picture: let go and it leaves that photo)
  const { w: cw, h: ch } = cellSize(config.aspect);
  const lay = frame ? frameLayout(frame, cw, ch, logoRatio) : null;

  const grab = (e: React.PointerEvent, cell: number, sel: Selection, how: (x: number, y: number, rect: DOMRect) => void, removable = false) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    onSelect(sel);
    drag.current = { cell, sel, how, removable };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = d && (d.sel?.kind === 'sticker' ? strip.current : cells.current[d.cell]); // (a sticker belongs to the whole picture: its place is read on the picture)
    if (!d || !el) return;
    const r = el.getBoundingClientRect();
    // a sticker may be taken a little past the picture's edge; everything else stays on its photo
    const [lo, hi] = d.sel?.kind === 'sticker' ? [PLACE_MIN, PLACE_MAX] : [0, 1];
    d.how(clamp((e.clientX - r.left) / r.width, lo, hi), clamp((e.clientY - r.top) / r.height, lo, hi), r);
    const sr = strip.current?.getBoundingClientRect();
    setOut(!!sr && d.removable && d.sel?.kind === 'sticker' && (e.clientX < sr.left - 12 || e.clientX > sr.right + 12 || e.clientY < sr.top - 12 || e.clientY > sr.bottom + 12));
  };
  const onUp = () => {
    const d = drag.current;
    if (d) {
      onDrop();
      if (out && d.removable && d.sel?.kind === 'sticker') onRemoveFrom(d.sel.id, d.sel.photo);
    }
    drag.current = null;
    setOut(false);
  };
  const drop = (e: React.DragEvent) => {
    const id = e.dataTransfer.getData('text/sticker');
    const el = strip.current;
    if (!id || !el) return;
    e.preventDefault();
    const r = el.getBoundingClientRect();
    onPlace(id, clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height));
  };
  const box = (cx: number, cy: number, w: number, h: number) => ({
    left: `${((cx - w / 2) / cw) * 100}%`,
    top: `${((cy - h / 2) / ch) * 100}%`,
    width: `${(w / cw) * 100}%`,
    height: `${(h / ch) * 100}%`,
  });
  const is = (kind: string) => selected?.kind === kind;

  return (
    <div className={styles.canvas}>
      <div
        ref={strip}
        className={styles.strip}
        style={{ aspectRatio: `${comp.width} / ${comp.height}`, ['--ratio' as string]: comp.width / comp.height, background: config.strip_bg }}
        role="img"
        aria-label="The finished picture; drag things on it to move them"
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDragOver={(e) => e.dataTransfer.types.includes('text/sticker') && e.preventDefault()}
        onDrop={drop}
      >
        {comp.cells.map((c, i) => (
          <div
            key={i}
            ref={(el) => {
              cells.current[i] = el;
            }}
            className={`${styles.stripCell} ${styles.stripLive}`}
            style={{
              left: pct(c.x, comp.width),
              top: pct(c.y, comp.height),
              width: pct(c.w, comp.width),
              height: pct(c.h, comp.height),
              aspectRatio: String(cellRatio(config.aspect as Aspect)),
            }}
            onPointerDown={() => onSelect({ kind: 'frame' })}
          >
            {drawing && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.stripFrame} src={drawing} alt="" draggable={false} />
            )}
            {i === 0 && (
              <>
                {lay?.top && (
                  <div
                    className={`${styles.handle} ${is('top') ? styles.handleOn : ''}`}
                    style={box(lay.top.cx, lay.top.cy, lay.top.w, lay.top.h)}
                    title="Drag the words"
                    onPointerDown={(e) => grab(e, i, { kind: 'top' }, (x, y) => onFrame({ topX: x, topY: y }))}
                  />
                )}
                {lay?.bottom && (
                  <div
                    className={`${styles.handle} ${is('bottom') ? styles.handleOn : ''}`}
                    style={box(lay.bottom.cx, lay.bottom.cy, lay.bottom.w, lay.bottom.h)}
                    title="Drag the words"
                    onPointerDown={(e) => grab(e, i, { kind: 'bottom' }, (x, y) => onFrame({ bottomX: x, bottomY: y }))}
                  />
                )}
                {lay?.logo && frame && (
                  <div
                    className={`${styles.handle} ${is('logo') ? styles.handleOn : ''}`}
                    style={box(lay.logo.cx, lay.logo.cy, lay.logo.w, lay.logo.h)}
                    title="Drag the logo"
                    onPointerDown={(e) => grab(e, i, { kind: 'logo' }, (x, y) => onFrame({ logoX: x, logoY: y }))}
                  >
                    {is('logo') && (
                      <span
                        className={styles.grip}
                        title="Pull to resize"
                        onPointerDown={(e) => grab(e, i, { kind: 'logo' }, (x) => onFrame({ logoSize: clamp(Math.abs(x - frame.logoX) * 2, 0.08, 0.5) }))}
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        {/* the stickers sit above every photo and frame, and may reach over onto the next photo */}
        {stickers.flatMap((s) =>
          s.placements.map((p, i) => {
            if (!p) return null;
            const on = selected?.kind === 'sticker' && selected.id === s.id && selected.photo === i;
            const sel: Selection = { kind: 'sticker', id: s.id, photo: i };
            return (
              <div
                key={`${s.id}-${i}`}
                className={`${styles.handle} ${styles.stickerHandle} ${on ? styles.handleOn : ''} ${on && out ? styles.handleOut : ''}`}
                style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${p.size * 100}%`, transform: `translate(-50%, -50%) rotate(${p.rotation}deg)` }}
                title={`${s.name}: drag to move`}
                onPointerDown={(e) => grab(e, i, sel, (x, y) => onSticker(s.id, i, { x, y }), true)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.image} alt={s.name} draggable={false} />
                {on && (
                  <>
                    <span
                      className={styles.grip}
                      title="Pull to resize"
                      onPointerDown={(e) =>
                        grab(e, i, sel, (x, y, r) => {
                          const rad = (p.rotation * Math.PI) / 180;
                          const dx = (x - p.x) * r.width;
                          const dy = (y - p.y) * r.height;
                          onSticker(s.id, i, { size: clamp((2 * Math.abs(dx * Math.cos(rad) + dy * Math.sin(rad))) / r.width, 0.05, 1) });
                        })
                      }
                    />
                    <span
                      className={styles.rotKnob}
                      title="Drag to turn"
                      onPointerDown={(e) =>
                        grab(e, i, sel, (x, y, r) => {
                          let deg = (Math.atan2((y - p.y) * r.height, (x - p.x) * r.width) * 180) / Math.PI + 90;
                          if (deg > 180) deg -= 360;
                          const snap = Math.round(deg / 15) * 15;
                          onSticker(s.id, i, { rotation: Math.abs(deg - snap) < 4 ? snap : Math.round(deg) });
                        })
                      }
                    />
                  </>
                )}
              </div>
            );
          }),
        )}
        {config.footer.trim() && (
          <div
            className={styles.previewFooter}
            style={{ left: 0, top: pct(comp.footer.y, comp.height), width: '100%', height: pct(comp.footer.h, comp.height), color: config.text_color }}
          >
            {config.footer}
          </div>
        )}
      </div>
    </div>
  );
}
