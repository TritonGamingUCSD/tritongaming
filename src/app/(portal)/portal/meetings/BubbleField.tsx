'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import styles from './meetings.module.css';

export interface BubbleAnswer { key: string; text: string }
interface Shown { key: string; text: string; leaving?: boolean }
interface Body { el: HTMLElement; x: number; y: number; w: number; h: number; seg: number; tilt: number; featuredUntil: number; ready: boolean }
// A stretch of one lane that bubbles travel along: free of the code and its timer.
interface Seg { l: number; r: number; y: number; h: number; dir: 1 | -1; speed: number }
const GAP = 10;
interface Box { l: number; t: number; r: number; b: number }

const hashStr = (t: string) => { let h = 7; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0; return h; };
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// The anonymous answers, flowing across the screen in tidy lanes (every other lane runs the other way), so they never sit on top of each other and
// many can be read at once. Lanes break around whatever is listed in `avoid` (the check-in code and its timer). A bubble that leaves one side comes
// back in at the other. When there are more answers than fit, a few at a time swap out so every answer gets airtime. A brand new answer shows at
// once, in a free gap, with a glow for a few seconds.
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

  // How many bubbles the lanes hold comfortably: the total length of the lanes divided by what a typical bubble takes, about two thirds full.
  function capacity() {
    const c = box.current;
    if (!c || !latest.current.presenting) return 6;
    const segs = buildSegments(c.clientWidth, c.clientHeight, obstacles(), laneHeight());
    const len = segs.reduce((n, g) => n + (g.r - g.l), 0);
    const sizes = [...bodies.current.values()];
    const avg = sizes.length ? sizes.reduce((n, x) => n + x.w + GAP, 0) / sizes.length : 200;
    return clamp(Math.floor((len * 0.66) / avg), 4, 48);
  }
  const laneHeight = () => clamp(Math.max(0, ...[...bodies.current.values()].map((x) => x.h)) + 12, 44, 120);
  // Cut each lane around the obstacles into stretches at least 140px wide.
  function buildSegments(W: number, H: number, obs: Box[], lh: number): Seg[] {
    const lanes = Math.max(1, Math.floor(H / lh)), h = H / lanes, out: Seg[] = [];
    for (let i = 0; i < lanes; i++) {
      const y0 = i * h, y1 = y0 + h;
      const blocked = obs.filter((o) => o.t < y1 && o.b > y0).map((o) => [Math.max(0, o.l), Math.min(W, o.r)] as [number, number]).sort((p, q) => p[0] - q[0]);
      let at = 0;
      const dir: 1 | -1 = i % 2 === 0 ? 1 : -1, speed = 20 + ((i * 7) % 5) * 4;
      for (const [l, r] of [...blocked, [W, W] as [number, number]]) {
        if (l - at >= 140) out.push({ l: at, r: l, y: y0, h, dir, speed });
        at = Math.max(at, r);
      }
    }
    return out;
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
    const featured = pendingFeature.current === key;
    if (featured) pendingFeature.current = null;
    bodies.current.set(key, { el, x: -9999, y: 0, w: el.offsetWidth, h: el.offsetHeight, seg: -1, tilt: ((hashStr(key) >> 3) % 3) - 1, featuredUntil: featured ? Date.now() + 4500 : 0, ready: false });
  }

  useEffect(() => {
    let raf = 0, last = performance.now(), sig = '';
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const c = box.current;
      if (!c) return;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (!latest.current.presenting) {
        // The small preview card: a tidy wrapped row under the counter, no drifting.
        for (const [, b] of bodies.current) { if (!b.ready) { b.ready = true; b.el.dataset.ready = '1'; } b.el.style.transform = ''; b.el.style.zIndex = ''; b.el.style.removeProperty('--fade'); }
        sig = '';
        return;
      }
      const W = c.clientWidth, H = c.clientHeight, now = Date.now();
      const list = [...bodies.current.entries()].filter(([k]) => shownRef.current.some((s) => s.key === k)).map(([, b]) => b);
      for (const b of list) { b.w = b.el.offsetWidth; b.h = b.el.offsetHeight; }
      const segs = buildSegments(W, H, obstacles(), laneHeight());
      const now2 = segs.map((g) => `${g.l | 0},${g.r | 0},${g.y | 0}`).join(';');
      if (now2 !== sig) { sig = now2; for (const b of list) b.seg = -1; }   // the screen or the code moved: find everyone a lane again
      if (!segs.length) return;
      const members = (i: number) => list.filter((b) => b.seg === i);
      // A free place for a bubble: the widest gap that fits it in any lane, otherwise it queues at the entering edge of the emptiest lane.
      const place = (b: Body) => {
        const gaps: { seg: number; x: number; room: number }[] = [];
        segs.forEach((g, i) => {
          const taken = members(i).filter((o) => o !== b && o.x + o.w > g.l - 1 && o.x < g.r + 1).sort((p, q) => p.x - q.x);
          let at = g.l;
          for (const o of [...taken, { x: g.r + GAP, w: 0 } as Body]) {
            const room = o.x - GAP - at;
            if (room >= b.w) gaps.push({ seg: i, x: at, room });
            at = Math.max(at, o.x + o.w + GAP);
          }
        });
        const best = gaps.sort((p, q) => q.room - p.room)[0];
        if (best) { b.seg = best.seg; b.x = best.x; return; }
        let pick = 0, fewest = Infinity;
        segs.forEach((_, i) => { const n = members(i).length; if (n < fewest) { fewest = n; pick = i; } });
        const g = segs[pick], others = members(pick).filter((o) => o !== b);
        b.seg = pick;
        b.x = g.dir > 0 ? Math.min(g.l - b.w, others.length ? Math.min(...others.map((o) => o.x)) - GAP - b.w : g.l - b.w) : Math.max(g.r, others.length ? Math.max(...others.map((o) => o.x + o.w)) + GAP : g.r);
      };
      for (const b of list.filter((x) => x.seg < 0 || !segs[x.seg]).sort((p, q) => p.x - q.x)) { b.seg = -1; place(b); }
      segs.forEach((g, i) => {
        const here = members(i);
        for (const b of here) {
          if (!reduced.current) b.x += g.dir * g.speed * dt;
          if (g.dir > 0 && b.x >= g.r) { const o = here.filter((x) => x !== b); b.x = Math.min(g.l - b.w, o.length ? Math.min(...o.map((x) => x.x)) - GAP - b.w : g.l - b.w); }
          else if (g.dir < 0 && b.x + b.w <= g.l) { const o = here.filter((x) => x !== b); b.x = Math.max(g.r, o.length ? Math.max(...o.map((x) => x.x + x.w)) + GAP : g.r); }
          b.y = g.y + (g.h - b.h) / 2;
        }
      });
      for (const b of list) {
        const g = segs[b.seg];
        if (!g) continue;
        const fresh = now < b.featuredUntil;
        // Fade in and out near the ends of a stretch, so a bubble never touches the code.
        const fade = fresh ? clamp((Math.min(b.x - g.l, g.r - b.x - b.w) + 1) / 36, 0, 1) : clamp(Math.min(b.x - g.l, g.r - b.x - b.w) / 36, 0, 1);
        b.el.style.transform = `translate3d(${b.x.toFixed(1)}px, ${b.y.toFixed(1)}px, 0) rotate(${b.tilt}deg)`;
        b.el.style.setProperty('--fade', fade.toFixed(2));
        b.el.dataset.fresh = fresh ? '1' : '';
        if (!b.ready) { b.ready = true; b.el.dataset.ready = '1'; }
        b.el.style.zIndex = fresh ? '3' : '1';
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
