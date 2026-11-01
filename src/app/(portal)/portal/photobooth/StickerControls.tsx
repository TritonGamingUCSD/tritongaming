'use client';

import styles from './photobooth.module.css';

export interface StickerValue {
  x: number;
  y: number;
  size: number;
  can_resize: boolean;
  can_rotate: boolean;
}

// Where a sticker starts on a photo, how big it is and what a guest may do with it, with a small stand-in photo that shows the result.
export function StickerControls({ value, onChange, image }: { value: StickerValue; onChange: (v: StickerValue) => void; image: string }) {
  const set = (patch: Partial<StickerValue>) => onChange({ ...value, ...patch });
  const slider = (label: string, key: 'x' | 'y' | 'size', min: number, max: number) => (
    <label className={styles.slider}>
      <span>{label}</span>
      <input type="range" min={min} max={max} step={0.01} value={value[key]} onChange={(e) => set({ [key]: Number(e.target.value) })} />
    </label>
  );
  return (
    <div className={styles.stickerBox}>
      <div className={styles.standIn} aria-hidden="true">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" style={{ left: `${value.x * 100}%`, top: `${value.y * 100}%`, width: `${value.size * 100}%` }} />
        )}
      </div>
      <div className={styles.stickerSliders}>
        {slider('Across', 'x', 0, 1)}
        {slider('Down', 'y', 0, 1)}
        {slider('Size', 'size', 0.05, 1)}
        <label className={styles.check}>
          <input type="checkbox" checked={value.can_resize} onChange={(e) => set({ can_resize: e.target.checked })} /> Guests can resize it
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={value.can_rotate} onChange={(e) => set({ can_rotate: e.target.checked })} /> Guests can turn it
        </label>
      </div>
    </div>
  );
}
