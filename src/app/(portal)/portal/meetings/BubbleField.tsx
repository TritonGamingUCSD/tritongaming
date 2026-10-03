'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import styles from './meetings.module.css';

export interface BubbleAnswer { key: string; text: string }
interface Shown { key: string; text: string; leaving?: boolean }
interface Body { el: HTMLElement; x: number; y: number; vx: number; vy: number; w: number; h: number; scale: number; tilt: number; featuredUntil: number; ready: boolean }
interface Box { l: number; t: number; r: number; b: number }

const hashStr = (t: string) => { let h = 7; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0; return h; };
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// The anonymous answers, drifting slowly around the free space of the screen like bubbles in water. They bounce softly off the edges and off
// whatever is listed in `avoid` (the check-in code and its timer). When there are more answers than fit, a few at a time swap out so every answer
// gets airtime. A brand new answer always shows at once: it grows large in the free space for a few seconds, then shrinks and joins the drift.
export default function BubbleField({ answers, avoid, presenting }: { answers: BubbleAnswer[]; avoid: RefObject<HTMLElement | null>[]; presenting: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const bodies = useRef(new Map<string, Body>());
  const seen = useRef(new Set<string>());
  const lastShown = useRef(new Map<string, number>());
  const [shown, setShown] = useState<Shown[]>([]);
  const shownRef = useRef<Shown[]>([]);
  const latest = useRef({ answers, presenting });
  latest.current = { answers, presenting };
  const reduced = useRef(false);

  const commit = (next: Shown[]) => { shownRef.current = next; setShown(next); };

  // How many bubbles the free space holds comfortably: the free area (sampled on a grid, so the bands around the code count properly) divided by
  // what a typical bubble needs, with plenty of breathing room.
  function capacity() {
    const c = box.current;
    if (!c) return 6;
    const p = latest.current.presenting;
    if (!p) return 6;
    const W = c.clientWidth, H = c.clientHeight, obs = obstacles(), step = 32;
    let free = 0;
    for (let x = 0; x < W; x += step) for (let y = 0; y < H; y += step) if (!obs.some((o) => hits(x, y, step, step, o))) free += step * step;
    const sizes = [...bodies.current.values()];
    const avg = sizes.length ? sizes.reduce((n, b) => n + (b.w + 14) * (b.h + 14), 0) / sizes.length : 220 * 60;
    return clamp(Math.floor(free / (avg * 3)), 3, 14);
  }
  // Everything the bubbles must stay clear of (the code, its timer, the question, the counter), each padded a little.
  function obstacles(): Box[] {
    const c = box.current;
    if (!c) return [];
    const cr = c.getBoundingClientRect();
    const pad = latest.current.presenting ? 22 : 12;
    const out: Box[] = [];
    for (const r of avoid) {
      const el = r.current;
      if (!el) continue;
      const b = el.getBoundingClientRect();
      if (b.width === 0 && b.height === 0) continue;
      out.push({ l: b.left - cr.left - pad, t: b.top - cr.top - pad, r: b.right - cr.left + pad, b: b.bottom - cr.top + pad });
    }
    return out;
  }
  const union = (list: Box[]): Box | null => list.length ? { l: Math.min(...list.map((o) => o.l)), t: Math.min(...list.map((o) => o.t)), r: Math.max(...list.map((o) => o.r)), b: Math.max(...list.map((o) => o.b)) } : null;
  const hits = (x: number, y: number, w: number, h: number, o: Box) => x < o.r && x + w > o.l && y < o.b && y + h > o.t;

  // Which answers are on screen: new ones at once, the rest rotate in.
  useEffect(() => {
    const now = Date.now();
    const keys = new Set(answers.map((a) => a.key));
    const cap = capacity();
    let next = shownRef.current.filter((s) => s.leaving || keys.has(s.key));
    const first = seen.current.size === 0;
    const fresh = answers.filter((a) => !seen.current.has(a.key));
    for (const a of answers) seen.current.add(a.key);
    const live = () => next.filter((s) => !s.leaving);
    const evict = () => {
      const candidates = live().filter((s) => (bodies.current.get(s.key)?.featuredUntil ?? 0) < now);
      const oldest = candidates.sort((a, b) => (lastShown.current.get(a.key) ?? 0) - (lastShown.current.get(b.key) ?? 0))[0];
      if (!oldest) return;
      next = next.map((s) => (s.key === oldest.key ? { ...s, leaving: true } : s));
      setTimeout(() => commit(shownRef.current.filter((s) => s.key !== oldest.key)), 700);
    };
    if (first) {
      // Opening the screen with answers already in: fill the free space with the newest, nothing is "new".
      for (const a of answers.slice(0, cap)) { next.push({ key: a.key, text: a.text }); lastShown.current.set(a.key, now); }
    } else {
      for (const a of [...fresh].reverse()) {
        while (live().length >= cap) { const before = live().length; evict(); if (live().length === before) break; }
        next.push({ key: a.key, text: a.text }); lastShown.current.set(a.key, now);
        // Only the very newest gets the big moment.
        if (a === fresh[0]) pendingFeature.current = a.key;
      }
    }
    commit(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers]);
  const pendingFeature = useRef<string | null>(null);

  // Rotation: when some answers are not on screen, swap a few every few seconds (the longest-shown leave, the longest-unseen come in).
  useEffect(() => {
    const t = setInterval(() => {
      const { answers: all } = latest.current;
      const now = Date.now();
      const on = shownRef.current.filter((s) => !s.leaving);
      const off = all.filter((a) => !on.some((s) => s.key === a.key));
      if (off.length === 0) return;
      const cap = capacity();
      const swaps = Math.min(off.length, Math.max(1, Math.round(cap / 4)));
      const leave = on.filter((s) => (bodies.current.get(s.key)?.featuredUntil ?? 0) < now && now - (lastShown.current.get(s.key) ?? 0) > 6000)
        .sort((a, b) => (lastShown.current.get(a.key) ?? 0) - (lastShown.current.get(b.key) ?? 0)).slice(0, swaps);
      const room = Math.max(0, cap - on.length);
      const enter = [...off].sort((a, b) => (lastShown.current.get(a.key) ?? 0) - (lastShown.current.get(b.key) ?? 0)).slice(0, leave.length + room);
      if (leave.length === 0 && room === 0) return;
      const gone = new Set(leave.map((s) => s.key));
      for (const a of enter) lastShown.current.set(a.key, now);
      commit([...shownRef.current.map((s) => (gone.has(s.key) ? { ...s, leaving: true } : s)), ...enter.map((a) => ({ key: a.key, text: a.text }))]);
      setTimeout(() => commit(shownRef.current.filter((s) => !gone.has(s.key))), 700);
    }, 4500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches; }, []);

  function register(key: string, el: HTMLElement | null) {
    if (!el) return;
    const existing = bodies.current.get(key);
    if (existing) { existing.el = el; return; }
    const c = box.current;
    if (!c) return;
    const W = c.clientWidth, H = c.clientHeight, w = el.offsetWidth, h = el.offsetHeight;
    const obs = obstacles();
    let x = 0, y = 0;
    for (let i = 0; i < 60; i++) {
      x = Math.random() * Math.max(1, W - w); y = Math.random() * Math.max(1, H - h);
      if (!obs.some((o) => hits(x, y, w, h, o))) break;
    }
    const sp = (latest.current.presenting ? 26 : 14) + Math.random() * (latest.current.presenting ? 22 : 14);
    const a = Math.random() * Math.PI * 2;
    const featured = pendingFeature.current === key;
    if (featured) pendingFeature.current = null;
    bodies.current.set(key, { el, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, w, h, scale: featured ? 0.4 : 1, tilt: ((hashStr(key) >> 3) % 7) - 3, featuredUntil: featured ? Date.now() + 3600 : 0, ready: false });
  }

  useEffect(() => {
    let raf = 0, last = performance.now();
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const c = box.current;
      if (!c) return;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (!latest.current.presenting) {
        // The small preview card: a tidy wrapped row under the counter, no drifting.
        for (const [k, b] of bodies.current) { if (!b.ready) { b.ready = true; b.el.dataset.ready = '1'; } b.el.style.transform = ''; b.el.style.zIndex = ''; void k; }
        return;
      }
      const W = c.clientWidth, H = c.clientHeight;
      const obs = obstacles();
      const ob = union(obs);
      const now = Date.now();
      const resolve = (b: Body) => {
        for (const o of obs) {
            if (!hits(b.x, b.y, b.w, b.h, o)) continue;
            // Push out the shortest way that stays on screen, and bounce away.
            const opts = [
              { m: b.x + b.w - o.l, ok: o.l - b.w >= 0, go: () => { b.x = o.l - b.w; b.vx = -Math.abs(b.vx); } },
              { m: o.r - b.x, ok: o.r + b.w <= W, go: () => { b.x = o.r; b.vx = Math.abs(b.vx); } },
              { m: b.y + b.h - o.t, ok: o.t - b.h >= 0, go: () => { b.y = o.t - b.h; b.vy = -Math.abs(b.vy); } },
              { m: o.b - b.y, ok: o.b + b.h <= H, go: () => { b.y = o.b; b.vy = Math.abs(b.vy); } },
            ].sort((p, q) => p.m - q.m);
            (opts.find((x) => x.ok) ?? opts[0]).go();
            b.x = clamp(b.x, 0, Math.max(0, W - b.w)); b.y = clamp(b.y, 0, Math.max(0, H - b.h));
          }
      };
      const list = [...bodies.current.entries()].filter(([k]) => shownRef.current.some((s) => s.key === k));
      for (const [, b] of list) {
        b.w = b.el.offsetWidth; b.h = b.el.offsetHeight;
        if (now < b.featuredUntil) {
          // The big moment: centred in the larger free band above or below the code.
          const above = ob ? ob.t : H / 2, below = ob ? H - ob.b : H / 2;
          const cy = ob ? (above >= below ? above / 2 : ob.b + below / 2) : H / 2;
          const tx = (W - b.w) / 2, ty = cy - b.h / 2;
          b.x += (tx - b.x) * Math.min(1, dt * 5); b.y += (ty - b.y) * Math.min(1, dt * 5);
          b.scale += ((latest.current.presenting ? 1.5 : 1.35) - b.scale) * Math.min(1, dt * 6);
        } else {
          b.scale += (1 - b.scale) * Math.min(1, dt * 3);
          if (!reduced.current) { b.x += b.vx * dt; b.y += b.vy * dt; }
          if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx); } else if (b.x > W - b.w) { b.x = Math.max(0, W - b.w); b.vx = -Math.abs(b.vx); }
          if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy); } else if (b.y > H - b.h) { b.y = Math.max(0, H - b.h); b.vy = -Math.abs(b.vy); }
          resolve(b);
        }
      }
      // Keep bubbles from sitting on each other: a few relaxation passes of full separation (with a small gap), each followed by staying clear
      // of the code and the walls, so squeezing one out of the way doesn't just push it back into something else.
      if (!reduced.current) {
        const movers = list.map(([, b]) => b).filter((b) => now >= b.featuredUntil);
        const GAP = 8;
        for (let pass = 0; pass < 4; pass++) {
          for (let i = 0; i < movers.length; i++) for (let j = i + 1; j < movers.length; j++) {
            const a = movers[i], b = movers[j];
            const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + GAP, oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + GAP;
            if (ox <= 0 || oy <= 0) continue;
            if (ox < oy) { const s = (a.x < b.x ? -1 : 1) * ox / 2; a.x += s; b.x -= s; if (pass === 0) { const v = a.vx; a.vx = b.vx; b.vx = v; } }
            else { const s = (a.y < b.y ? -1 : 1) * oy / 2; a.y += s; b.y -= s; if (pass === 0) { const v = a.vy; a.vy = b.vy; b.vy = v; } }
          }
          for (const b of movers) { resolve(b); b.x = clamp(b.x, 0, Math.max(0, W - b.w)); b.y = clamp(b.y, 0, Math.max(0, H - b.h)); }
        }
      }
      for (const [, b] of list) {
        b.el.style.transform = `translate3d(${b.x.toFixed(1)}px, ${b.y.toFixed(1)}px, 0) rotate(${b.tilt}deg) scale(${b.scale.toFixed(3)})`;
        if (!b.ready) { b.ready = true; b.el.dataset.ready = '1'; }
        b.el.style.zIndex = now < b.featuredUntil ? '3' : '1';
      }
      for (const k of [...bodies.current.keys()]) if (!shownRef.current.some((s) => s.key === k)) bodies.current.delete(k);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={box} className={`${styles.bubbleField} ${presenting ? '' : styles.bubbleInline}`} aria-label="Answers">
      {/* Anonymous on purpose: the screen never shows who said what. */}
      {shown.map((s) => {
        const h = hashStr(s.text);
        return (
          <span key={s.key} ref={(el) => register(s.key, el)} className={`${styles.drifter} ${presenting ? '' : styles.drifterInline} ${s.leaving ? styles.drifterOut : ''}`}
            style={{ ['--hue' as string]: h % 360, ['--k' as string]: s.text.length > 60 ? 0.82 : s.text.length > 25 ? 0.94 : 1.08 }}>
            {s.text}
          </span>
        );
      })}
    </div>
  );
}
