'use client';

import { useRef } from 'react';
import type { Overlay } from '@/lib/photobooth/booth';
import styles from './photobooth.module.css';

/** A sticker a guest has put on the live camera: where it is (fractions of the photo), how big and turned. */
export interface Placed {
  key: number;
  overlay: Overlay;
  x: number;
  y: number;
  size: number;
  rotation: number; // radians
}

// The guest's stickers on top of the live camera: drag one to move it, tap to select it (the buttons below the camera resize, turn or remove the selected one).
export function StickerLayer({
  stickers,
  selected,
  locked = false,
  onSelect,
  onMove,
}: {
  stickers: Placed[];
  selected: number | null;
  /** While the photos are being taken the stickers stay where they are. */
  locked?: boolean;
  onSelect: (key: number | null) => void;
  onMove: (key: number, x: number, y: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ key: number; dx: number; dy: number } | null>(null);
  const point = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  return (
    <div
      ref={box}
      className={`${styles.stickerLayer} ${locked ? styles.stickerLocked : ''}`}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const p = point(e);
        onMove(drag.current.key, Math.min(1, Math.max(0, p.x - drag.current.dx)), Math.min(1, Math.max(0, p.y - drag.current.dy)));
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onPointerDown={(e) => e.target === e.currentTarget && onSelect(null)}
    >
      {stickers.map((s) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={s.key}
          src={s.overlay.image}
          alt={s.overlay.name}
          draggable={false}
          className={`${styles.placed} ${selected === s.key ? styles.placedOn : ''}`}
          style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: `${s.size * 100}%`, transform: `translate(-50%, -50%) rotate(${s.rotation}rad)` }}
          onPointerDown={(e) => {
            e.stopPropagation();
            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            const p = point(e);
            drag.current = { key: s.key, dx: p.x - s.x, dy: p.y - s.y };
            onSelect(s.key);
          }}
        />
      ))}
    </div>
  );
}
