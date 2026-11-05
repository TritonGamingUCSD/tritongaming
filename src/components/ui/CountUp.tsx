'use client';

import { useEffect, useRef, useState } from 'react';

// A number that counts up to its value when it first appears and whenever it changes (about 0.7 seconds, easing out). People who ask for less motion get the final number at once.
// `text` is the whole string to show (e.g. "320 pts"): the first number in it is the one that counts.
export default function CountUp({ text }: { text: string }) {
  const m = /[\d,]+/.exec(text);
  const target = m ? Number(m[0].replace(/,/g, '')) : null;
  const [shown, setShown] = useState<number | null>(target === null ? null : 0);
  const from = useRef(0);
  useEffect(() => {
    if (target === null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      from.current = target;
      const t = window.setTimeout(() => setShown(target), 0);
      return () => window.clearTimeout(t);
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / 700);
      const v = Math.round(a + (target - a) * (1 - Math.pow(1 - k, 3)));
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  if (!m || shown === null) return <>{text}</>;
  return (
    <>
      {text.slice(0, m.index)}
      {shown.toLocaleString()}
      {text.slice(m.index + m[0].length)}
    </>
  );
}
