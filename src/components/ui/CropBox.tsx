'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import { dragCrop, fitAspect, startRect, type Handle, type Rect } from '@/lib/ui/cropMath';
import styles from './CropBox.module.css';

const RATIOS: { label: string; value: number | null }[] = [{ label: 'Free', value: null }, { label: 'Square', value: 1 }, { label: '4:3', value: 4 / 3 }, { label: '3:4', value: 3 / 4 }, { label: '16:9', value: 16 / 9 }];
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

// The crop step of the picture popup: the picture with a box on it. Drag the box to move it, pull a handle on an edge or corner to resize it (arrow keys move it; Shift + arrows resize), or pick a ratio.
// `fixed` is a ratio the place asked for (a profile picture is square): then there is no choice of ratio. Gives the box as fractions of the picture, so the caller can cut the real file.
export default function CropBox({ src, fixed, round, onCancel, onApply }: { src: string; fixed?: number; round?: boolean; onCancel: () => void; onApply: (box: { x: number; y: number; w: number; h: number }) => void }) {
  const img = useRef<HTMLImageElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);   // how big the picture is shown
  const [aspect, setAspect] = useState<number | null>(fixed ?? null);
  const [rect, setRect] = useState<Rect | null>(null);
  const drag = useRef<{ handle: Handle; x: number; y: number; from: Rect } | null>(null);

  const measure = useCallback(() => {
    const el = img.current;
    if (!el || !el.clientWidth) return;
    const next = { w: el.clientWidth, h: el.clientHeight };
    setSize((old) => {
      if (old && Math.abs(old.w - next.w) < 0.5 && Math.abs(old.h - next.h) < 0.5) return old;
      // The picture was resized (the window turned or resized): the box keeps its place as a share of the picture.
      setRect((r) => (r && old ? { x: r.x / old.w * next.w, y: r.y / old.h * next.h, w: r.w / old.w * next.w, h: r.h / old.h * next.h } : startRect(next.w, next.h, fixed ?? null)));
      return next;
    });
  }, [fixed]);
  useEffect(() => {
    const el = img.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const begin = (handle: Handle) => (e: React.PointerEvent) => {
    if (!rect) return;
    e.preventDefault(); e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { handle, x: e.clientX, y: e.clientY, from: rect };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !size) return;
    setRect(dragCrop(d.from, d.handle, e.clientX - d.x, e.clientY - d.y, size.w, size.h, aspect));
  };
  const end = () => { drag.current = null; };
  const key = (e: React.KeyboardEvent) => {
    if (!rect || !size || !e.key.startsWith('Arrow')) return;
    e.preventDefault();
    const step = 6, dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0, dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
    setRect(dragCrop(rect, e.shiftKey ? 'se' : 'move', dx, dy, size.w, size.h, aspect));
  };
  const choose = (value: number | null) => {
    setAspect(value);
    if (size && rect && value) setRect(fitAspect(rect, value, size.w, size.h));
  };
  const reset = () => { if (size) setRect(startRect(size.w, size.h, aspect)); };
  const apply = () => { if (rect && size) onApply({ x: rect.x / size.w, y: rect.y / size.h, w: rect.w / size.w, h: rect.h / size.h }); };

  return (
    <>
      <div className={styles.stage}>
        <div className={styles.frame}>
          <div className={styles.inner}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={img} src={src} alt="The picture to crop" className={styles.img} draggable={false} onLoad={measure} />
          {rect && size && (
            <div className={`${styles.box} ${round ? styles.round : ''}`} style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} role="group" aria-label="Crop box. Drag to move it, use the handles to resize, or the arrow keys."
              tabIndex={0} onKeyDown={key} onPointerDown={begin('move')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
              <span className={styles.grid} aria-hidden="true" />
              {HANDLES.map((h) => <span key={h} className={`${styles.handle} ${styles[`h_${h}`]}`} onPointerDown={begin(h)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} aria-hidden="true" />)}
            </div>
          )}
          </div>
        </div>
      </div>
      <div className={styles.ratios} role="group" aria-label="Shape of the crop">
        {fixed ? <span className={styles.fixed}>{Math.abs(fixed - 1) < 0.001 ? 'Square' : 'Fixed shape'}</span> : RATIOS.map((r) => (
          <button key={r.label} type="button" className={`${styles.ratio} ${aspect === r.value ? styles.on : ''}`} aria-pressed={aspect === r.value} onClick={() => choose(r.value)}>{r.label}</button>
        ))}
        <button type="button" className={styles.reset} onClick={reset}>Reset</button>
      </div>
      <p className={styles.help}>Drag the box to move it. Pull a handle on its edge or corner to resize it.</p>
      <DialogActions>
        <DialogCancel onClick={onCancel}>Back</DialogCancel>
        <Button onClick={apply} disabled={!rect} style={{ flex: 1 }}>Crop</Button>
      </DialogActions>
    </>
  );
}
