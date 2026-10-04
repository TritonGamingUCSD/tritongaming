'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Scroll reveals for the inner public pages. It finds every band on the page ([data-rv-inner]) and animates its parts as they scroll in:
//   - the sticker label slaps on, the title rises,
//   - lists deal their items out one by one,
//   - any other block simply rises into place.
// Only transform and opacity are animated, and the inline styles are cleared afterwards so each card's own tilt and hover come back from CSS.
// Visitors who ask for reduced motion see everything in place. Renders nothing.
// A plain effect, not a layout effect: it must run after React has finished hydrating, or the inline styles it sets would be
// reported as a hydration mismatch.
export default function ZineMotion() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const clear = 'transform,opacity,visibility';
      const play = (targets: Element[], from: gsap.TweenVars, trigger: Element, stagger = 0.08) => {
        if (targets.length === 0) return;
        gsap.from(targets, {
          ...from,
          duration: 0.6,
          ease: 'power3.out',
          stagger,
          clearProps: clear,
          scrollTrigger: { trigger, start: 'top 88%', once: true },
        });
      };

      document.querySelectorAll<HTMLElement>('[data-rv-inner]').forEach((band) => {
        Array.from(band.children).forEach((block) => {
          if (!(block instanceof HTMLElement)) return;
          if (block.hasAttribute('data-rv-head')) {
            const label = block.querySelector('[data-rv-label]');
            const rest = Array.from(block.children).filter((c) => c !== label);
            if (label) play([label], { scale: 1.35, opacity: 0, y: -10 }, block);
            play(rest, { y: 22, opacity: 0 }, block, 0.1);
          } else if (block.tagName === 'UL' || block.tagName === 'OL') {
            play(Array.from(block.children), { y: 34, opacity: 0 }, block);
          } else {
            play([block], { y: 28, opacity: 0 }, block);
          }
        });
      });
    });

    return () => ctx.revert();
  }, [pathname]);

  return null;
}
