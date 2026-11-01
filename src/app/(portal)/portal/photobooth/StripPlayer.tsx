'use client';

import { useEffect, useRef } from 'react';
import type { Tick } from '@/lib/photobooth/playback';

/** The strip playing: `ticks` says which moment of its clip each photo shows at each step and `render` draws the whole strip for one step. */
export interface StripPlayback {
  ticks: Tick[];
  render: (at: Tick) => HTMLCanvasElement;
}

// The finished strip playing straight on the strip, like a real photo booth's screen: each photo in turn plays the moments before its shot and freezes on it, then all of them play together and freeze, over and over. It is drawn from the frames
// the booth captured (so it moves even when the downloadable animated picture could not be made small enough).
export function StripPlayer({ playback, frameMs, className, label }: { playback: StripPlayback; frameMs: number; className?: string; label: string }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el || !playback.ticks.length) return;
    const first = playback.render(playback.ticks[0]);
    el.width = first.width;
    el.height = first.height;
    const ctx = el.getContext('2d')!;
    let at = 0;
    const draw = () => {
      ctx.drawImage(playback.render(playback.ticks[at % playback.ticks.length]), 0, 0, el.width, el.height);
      at++;
    };
    draw();
    const t = window.setInterval(draw, frameMs);
    return () => window.clearInterval(t);
  }, [playback, frameMs]);
  return <canvas ref={canvas} className={className} role="img" aria-label={label} />;
}
