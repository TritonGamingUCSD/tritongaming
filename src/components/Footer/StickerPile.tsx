'use client';

import { useEffect, useRef } from 'react';
import Matter from 'matter-js';
import styles from './StickerPile.module.css';

// Stickers that drop into a pile when the footer scrolls into view. Real physics (Matter.js): they stack, slide and can be dragged around with a
// mouse. On touch screens they only fall and settle (no dragging, so the page still scrolls) and there are fewer of them. The engine only runs
// while the footer is on screen, and visitors who ask for reduced motion see the pile already settled.
const STICKERS = [
  { text: 'GG', tone: 'yellow' }, { text: 'LAN', tone: 'paper' }, { text: 'GBM', tone: 'blue' }, { text: '+100 pts', tone: 'paper' },
  { text: 'free food', tone: 'yellow' }, { text: 'join us', tone: 'paper' }, { text: 'level up', tone: 'blue' }, { text: 'insert coin', tone: 'yellow' },
] as const;

export default function StickerPile() {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const nodes = Array.from(el.querySelectorAll<HTMLElement>('[data-sticker]')).slice(0, coarse ? 5 : STICKERS.length);
    el.querySelectorAll<HTMLElement>('[data-sticker]').forEach((n, i) => { if (i >= nodes.length) n.style.display = 'none'; });

    let engine: Matter.Engine | null = null;
    let runner: Matter.Runner | null = null;
    let mouseC: Matter.MouseConstraint | null = null;
    let raf = 0;
    let started = false;

    const draw = (bodies: Matter.Body[]) => {
      bodies.forEach((b, i) => {
        const n = nodes[i];
        n.style.transform = `translate(${b.position.x - n.offsetWidth / 2}px, ${b.position.y - n.offsetHeight / 2}px) rotate(${b.angle}rad)`;
      });
    };

    const build = (settled: boolean) => {
      const w = el.clientWidth, h = el.clientHeight;
      engine = Matter.Engine.create({ enableSleeping: true });
      engine.gravity.y = 1.1;
      const wall = { isStatic: true, render: { visible: false } };
      const floor = Matter.Bodies.rectangle(w / 2, h + 30, w + 200, 60, wall);
      const left = Matter.Bodies.rectangle(-30, h / 2, 60, h * 4, wall);
      const right = Matter.Bodies.rectangle(w + 30, h / 2, 60, h * 4, wall);
      const bodies = nodes.map((n, i) => {
        const bw = n.offsetWidth, bh = n.offsetHeight;
        const x = settled ? 40 + ((i * 97) % Math.max(60, w - 80)) : 40 + Math.random() * Math.max(60, w - 80);
        const y = settled ? h - bh / 2 - 4 - (i % 2) * (bh * 0.9) : -60 - i * 70;
        return Matter.Bodies.rectangle(x, y, bw, bh, { restitution: 0.35, friction: 0.5, frictionAir: 0.01, angle: (Math.random() - 0.5) * 0.8, chamfer: { radius: 6 } });
      });
      Matter.Composite.add(engine.world, [floor, left, right, ...bodies]);

      if (!coarse && !reduced) {
        const mouse = Matter.Mouse.create(el);
        // Matter's mouse swallows the wheel; the page must keep scrolling over the pile.
        const m = mouse as unknown as { element: HTMLElement; mousewheel: EventListener };
        m.element.removeEventListener('mousewheel', m.mousewheel);
        m.element.removeEventListener('DOMMouseScroll', m.mousewheel);
        mouseC = Matter.MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.2, render: { visible: false } } });
        Matter.Composite.add(engine.world, mouseC);
      }

      if (settled) {
        for (let k = 0; k < 240; k++) Matter.Engine.update(engine, 1000 / 60);
        draw(bodies);
        return;
      }
      runner = Matter.Runner.create();
      Matter.Runner.run(runner, engine);
      const loop = () => { draw(bodies); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    };

    const teardown = () => {
      cancelAnimationFrame(raf);
      if (runner) Matter.Runner.stop(runner);
      if (engine) { Matter.World.clear(engine.world, false); Matter.Engine.clear(engine); }
      engine = null; runner = null; mouseC = null;
    };

    const io = new IntersectionObserver((entries) => {
      const on = entries.some((e) => e.isIntersecting);
      if (on && !started) { started = true; build(reduced); }
      else if (!on && started && !reduced) { teardown(); started = false; el.dataset.idle = '1'; }
    }, { threshold: 0.25 });
    io.observe(el);

    let lastW = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === lastW) return;
      lastW = el.clientWidth;
      if (started) { teardown(); build(true); }
    });
    ro.observe(el);

    return () => { io.disconnect(); ro.disconnect(); teardown(); };
  }, []);

  return (
    <div className={styles.wrap}>
      <div ref={box} className={styles.pit} aria-hidden="true">
        {STICKERS.map((s) => (
          <span key={s.text} data-sticker className={`${styles.sticker} ${styles[s.tone]}`}>{s.text}</span>
        ))}
      </div>
      <p className={styles.hint} aria-hidden="true">give them a shove</p>
    </div>
  );
}
