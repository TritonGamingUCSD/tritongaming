'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { Draggable } from 'gsap/Draggable';
import { InertiaPlugin } from 'gsap/InertiaPlugin';

// Motion for the inner public pages. It finds every band on the page ([data-rv-inner]) and animates its parts as they scroll in:
//   - the sticker label slaps on, the title rises,
//   - lists deal their items out one by one, any other block rises into place,
//   - titles marked [data-split] fly in letter by letter (word by word on phones),
//   - hand-drawn underlines marked [data-draw] draw themselves,
//   - prints and notes marked [data-drag] can be picked up and tossed (any direction with a mouse, sideways only on touch screens, so
//     the page still scrolls normally).
// Only transform and opacity are animated, and the reveal clears its inline styles afterwards so each card's own tilt and hover return
// from CSS. Visitors who ask for reduced motion see everything in place. Renders nothing.
export default function ZineMotion() {
  const pathname = usePathname();

  // A plain effect, not a layout effect: it must run after React has finished hydrating, or the inline styles it sets would be
  // reported as a hydration mismatch.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, Draggable, InertiaPlugin);
    const coarse = window.matchMedia('(pointer: coarse)').matches;

    const ctx = gsap.context(() => {
      const clear = 'transform,opacity,visibility';

      // Prints and notes you can pick up. Created only once an element has finished its entrance, so the reveal's cleanup cannot undo a drag.
      const grab = (root: Element) => {
        const els = [...(root.matches('[data-drag]') ? [root] : []), ...root.querySelectorAll('[data-drag]')] as HTMLElement[];
        els.forEach((el) => {
          if (Draggable.get(el)) return;
          Draggable.create(el, {
            type: coarse ? 'x' : 'x,y',
            inertia: true,
            bounds: el.closest('section') ?? undefined,
            zIndexBoost: true,
            dragClickables: false,
            onPress() { gsap.to(this.target, { scale: 1.04, duration: 0.15, overwrite: 'auto' }); },
            onRelease() { gsap.to(this.target, { scale: 1, duration: 0.25, overwrite: 'auto' }); },
          });
        });
      };

      const play = (targets: Element[], from: gsap.TweenVars, trigger: Element, stagger = 0.08) => {
        if (targets.length === 0) return;
        gsap.from(targets, {
          ...from,
          duration: 0.6,
          ease: 'power3.out',
          stagger,
          clearProps: clear,
          scrollTrigger: { trigger, start: 'top 88%', once: true },
          onComplete: () => targets.forEach(grab),
        });
      };

      document.querySelectorAll<HTMLElement>('[data-rv-inner]').forEach((band) => {
        Array.from(band.children).forEach((block) => {
          if (!(block instanceof HTMLElement)) return;
          if (block.hasAttribute('data-rv-head')) {
            const label = block.querySelector('[data-rv-label]');
            const rest = Array.from(block.children).filter((c) => c !== label && !c.hasAttribute('data-split') && !c.hasAttribute('data-draw'));
            if (label) play([label], { scale: 1.35, opacity: 0, y: -10 }, block);
            play(rest, { y: 22, opacity: 0 }, block, 0.1);
          } else if (block.tagName === 'UL' || block.tagName === 'OL') {
            play(Array.from(block.children), { y: 34, opacity: 0 }, block);
          } else {
            play([block], { y: 28, opacity: 0 }, block);
          }
        });
      });

      // Titles: lines are masked so letters rise out of a slot; on phones only words move, which is far fewer pieces to animate.
      document.querySelectorAll<HTMLElement>('[data-split]').forEach((el) => {
        const hero = el.hasAttribute('data-split-hero');
        const split = SplitText.create(el, { type: coarse ? 'lines,words' : 'lines,words,chars', mask: 'lines', linesClass: 'zm-line' });
        gsap.from(coarse ? split.words : split.chars, {
          yPercent: 115,
          rotate: coarse ? 0 : 6,
          duration: 0.7,
          ease: 'power3.out',
          stagger: coarse ? 0.05 : 0.02,
          scrollTrigger: hero ? undefined : { trigger: el, start: 'top 90%', once: true },
          delay: hero ? 0.1 : 0,
        });
      });

      // Hand-drawn underlines.
      document.querySelectorAll<SVGPathElement>('[data-draw]').forEach((path) => {
        gsap.from(path, {
          drawSVG: 0,
          duration: 0.8,
          ease: 'power2.out',
          delay: path.hasAttribute('data-draw-hero') ? 0.45 : 0,
          scrollTrigger: path.hasAttribute('data-draw-hero') ? undefined : { trigger: path, start: 'top 92%', once: true },
        });
      });

      // Anything draggable that is not inside an animated band (it still gets picked up).
      document.querySelectorAll('[data-drag]').forEach((el) => { if (!el.closest('[data-rv-inner]')) grab(el); });
    });

    return () => ctx.revert();
  }, [pathname]);

  return null;
}
