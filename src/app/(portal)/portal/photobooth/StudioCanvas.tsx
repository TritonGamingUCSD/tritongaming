'use client';

import { useRef } from 'react';
import { cellRatio, composition, frameLayout, onPhoto, type Aspect, type BoothConfig, type FrameSpec, type Overlay } from '@/lib/photobooth/booth';
import { cellSize } from '@/lib/photobooth/booth';
import styles from './photobooth.module.css';

/** What is selected on the canvas: the frame itself, a line of words, the logo or one sticker (by id). */
export type Selection = { kind: 'frame' | 'top' | 'bottom' | 'logo' } | { kind: 'sticker'; id: string } | null;

const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));

// The finished picture, big, in the middle of the studio, and everything on it can be touched: drag the logo or a line of words or a sticker, pull the corner to make it bigger, click the border to edit the frame. Only the first photo is
// live; the others show the same frame so you see the whole strip. The edits come out as small patches (the owner keeps the history); `onDrop` is the end of a move (the owner makes the whole move one undo step).
export function StudioCanvas({
  config,
  frame,
  drawing,
  logoRatio,
  stickers,
  photo,
  selected,
  onSelect,
  onFrame,
  onSticker,
  onDrop,
}: {
  config: BoothConfig;
  frame: FrameSpec | null;
  /** A drawing of the frame (a picture address) to show over each photo. */
  drawing: string;
  /** The logo's height ÷ width, or null before it has loaded. */
  logoRatio: number | null;
  stickers: Overlay[];
  /** The photo being edited (0-based; null: the first, showing every sticker). The others show what each photo has. */
  photo: number | null;
  selected: Selection;
  onSelect: (s: Selection) => void;
  onFrame: (patch: Partial<FrameSpec>) => void;
  onSticker: (id: string, patch: Partial<Overlay>) => void;
  onDrop: () => void;
}) {
  const comp = composition(config.layout, config.aspect, !!config.footer.trim());
  const pct = (n: number, of: number) => `${(n / of) * 100}%`;
  const cell = useRef<HTMLDivElement>(null);
  const move = useRef<((x: number, y: number) => void) | null>(null);
  const { w: cw, h: ch } = cellSize(config.aspect);
  const live = photo ?? 0;
  const lay = frame ? frameLayout(frame, cw, ch, logoRatio) : null;

  const at = (e: React.PointerEvent) => {
    const r = cell.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
  };
  const grab = (e: React.PointerEvent, sel: Selection, how: (x: number, y: number) => void) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    onSelect(sel);
    move.current = how;
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
        className={styles.strip}
        style={{ aspectRatio: `${comp.width} / ${comp.height}`, ['--ratio' as string]: comp.width / comp.height, background: config.strip_bg }}
        role="img"
        aria-label="The finished picture; drag things on it to move them"
      >
        {comp.cells.map((c, i) => (
          <div
            key={i}
            ref={i === live ? cell : undefined}
            className={`${styles.stripCell} ${i === live ? styles.stripLive : ''}`}
            style={{
              left: pct(c.x, comp.width),
              top: pct(c.y, comp.height),
              width: pct(c.w, comp.width),
              height: pct(c.h, comp.height),
              aspectRatio: String(cellRatio(config.aspect as Aspect)),
            }}
            onPointerDown={i === live ? () => onSelect({ kind: 'frame' }) : undefined}
            onPointerMove={i === live ? (e) => move.current && move.current(at(e).x, at(e).y) : undefined}
            onPointerUp={
              i === live
                ? () => {
                    if (move.current) onDrop();
                    move.current = null;
                  }
                : undefined
            }
            onPointerCancel={i === live ? () => ((move.current = null), onDrop()) : undefined}
          >
            {drawing && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.stripFrame} src={drawing} alt="" draggable={false} />
            )}
            {stickers.map((s) =>
              i === live || !onPhoto(s, i) ? null : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={s.id}
                  className={styles.stripSticker}
                  src={s.image}
                  alt=""
                  draggable={false}
                  style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: `${s.size * 100}%` }}
                />
              ),
            )}
            {i === live && (
              <>
                {lay?.top && (
                  <div
                    className={`${styles.handle} ${is('top') ? styles.handleOn : ''}`}
                    style={box(lay.top.cx, lay.top.cy, lay.top.w, lay.top.h)}
                    title="Drag the words"
                    onPointerDown={(e) => grab(e, { kind: 'top' }, (x, y) => onFrame({ topX: x, topY: y }))}
                  />
                )}
                {lay?.bottom && (
                  <div
                    className={`${styles.handle} ${is('bottom') ? styles.handleOn : ''}`}
                    style={box(lay.bottom.cx, lay.bottom.cy, lay.bottom.w, lay.bottom.h)}
                    title="Drag the words"
                    onPointerDown={(e) => grab(e, { kind: 'bottom' }, (x, y) => onFrame({ bottomX: x, bottomY: y }))}
                  />
                )}
                {lay?.logo && frame && (
                  <div
                    className={`${styles.handle} ${is('logo') ? styles.handleOn : ''}`}
                    style={box(lay.logo.cx, lay.logo.cy, lay.logo.w, lay.logo.h)}
                    title="Drag the logo"
                    onPointerDown={(e) => grab(e, { kind: 'logo' }, (x, y) => onFrame({ logoX: x, logoY: y }))}
                  >
                    {is('logo') && (
                      <span
                        className={styles.grip}
                        title="Pull to resize"
                        onPointerDown={(e) => grab(e, { kind: 'logo' }, (x) => onFrame({ logoSize: clamp(Math.abs(x - frame.logoX) * 2, 0.08, 0.5) }))}
                      />
                    )}
                  </div>
                )}
                {stickers
                  .filter((s) => photo === null || onPhoto(s, photo))
                  .map((s) => (
                    <div
                      key={s.id}
                      className={`${styles.handle} ${styles.stickerHandle} ${selected?.kind === 'sticker' && selected.id === s.id ? styles.handleOn : ''}`}
                      style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: `${s.size * 100}%` }}
                      title={s.name}
                      onPointerDown={(e) => grab(e, { kind: 'sticker', id: s.id }, (x, y) => onSticker(s.id, { x, y }))}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.image} alt={s.name} draggable={false} />
                      {selected?.kind === 'sticker' && selected.id === s.id && (
                        <span
                          className={styles.grip}
                          title="Pull to resize"
                          onPointerDown={(e) => grab(e, { kind: 'sticker', id: s.id }, (x) => onSticker(s.id, { size: clamp(Math.abs(x - s.x) * 2, 0.05, 1) }))}
                        />
                      )}
                    </div>
                  ))}
              </>
            )}
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
    </div>
  );
}
