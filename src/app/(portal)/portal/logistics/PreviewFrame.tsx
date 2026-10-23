'use client';

import { useEffect, useRef, useState } from 'react';
import { Laptop, Smartphone, X } from 'lucide-react';
import { SIMULATE_KEY } from '../LogisticsDayCard';
import styles from './logistics.module.css';

export type Preview = 'phone' | 'laptop' | null;
const SIZE = { phone: { w: 390, h: 844 }, laptop: { w: 1280, h: 800 } } as const;

// The address of this very page for the frame: the same path and params, without `preview`, and `frame=1` so the page inside knows it is a preview (it hides the switch).
export const frameSrc = () => {
  const u = new URL(window.location.href);
  u.searchParams.delete('preview');
  u.searchParams.set('frame', '1');
  return `${u.pathname}${u.search}`;
};

// Admin only: Off / Phone / Laptop. The page opens live inside a frame of that width, so its phone or laptop layout shows on any screen (the layout follows the frame's width, not the window's).
export function PreviewSwitch({ value, onChange }: { value: Preview; onChange: (p: Preview) => void }) {
  return (
    <span className={styles.miniSeg} role="group" aria-label="Preview the phone or laptop screen (admin)">
      <button type="button" aria-pressed={value === null} onClick={() => onChange(null)} title="Normal view">{value === null ? 'Preview' : <X size={13} aria-hidden="true" />}</button>
      <button type="button" aria-pressed={value === 'phone'} onClick={() => onChange('phone')} title="Show the phone screen"><Smartphone size={14} aria-hidden="true" /> Phone</button>
      <button type="button" aria-pressed={value === 'laptop'} onClick={() => onChange('laptop')} title="Show the laptop screen"><Laptop size={14} aria-hidden="true" /> Laptop</button>
    </span>
  );
}

// Admin only: make the Dashboard show this event as if it were on today (its Event Day card), on this browser only, to see and test it.
export function SimulateSwitch({ slug }: { slug: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => { try { setOn(localStorage.getItem(SIMULATE_KEY) === slug); } catch { /* storage blocked */ } }, [slug]);
  const flip = () => { const next = !on; setOn(next); try { if (next) localStorage.setItem(SIMULATE_KEY, slug); else localStorage.removeItem(SIMULATE_KEY); } catch { /* storage blocked */ } };
  return <button type="button" className={styles.linkBtn} aria-pressed={on} onClick={flip} title="Make the Dashboard show this event as if it were on today (on this browser only)">{on ? 'Simulating Event Day' : 'Simulate Event Day'}</button>;
}

export default function PreviewFrame({ mode }: { mode: 'phone' | 'laptop' }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [src, setSrc] = useState('');
  useEffect(() => { setSrc(frameSrc()); }, []);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const f = () => setScale(Math.min(1, el.clientWidth / SIZE[mode].w));
    f();
    const ro = new ResizeObserver(f);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);
  const { w, h } = SIZE[mode];
  return (
    <div ref={box} className={styles.previewBox} style={{ height: h * scale + 24 }}>
      <div className={`${styles.previewDevice} ${mode === 'phone' ? styles.previewPhone : ''}`} style={{ width: w, height: h, transform: `scale(${scale})` }}>
        {src && <iframe title={`${mode} preview`} src={src} width={w} height={h} className={styles.previewFrame} />}
      </div>
    </div>
  );
}
