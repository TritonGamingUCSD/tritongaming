'use client';

import { useEffect } from 'react';
import { gsap } from 'gsap';

// The hero's motion: pieces land like they were slapped on the board, the arrow draws itself. Only transform and
// opacity change, and everything is skipped for anyone whose system asks for reduced motion. Renders nothing.
export default function HeroFx() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-hero-in]', { y: -44, rotation: (i) => (i % 2 ? 1 : -1) * 7, opacity: 0, duration: 0.6, stagger: 0.09, ease: 'back.out(1.5)', delay: 0.15 });
      gsap.fromTo('[data-hero-arrow]', { strokeDasharray: 100, strokeDashoffset: 100 }, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut', delay: 0.9 });
    });
    return () => ctx.revert();
  }, []);
  return null;
}
