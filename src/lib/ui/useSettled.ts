import { useEffect, useState } from 'react';

// True once the page has finished loading: every image and font is in, and the browser has painted twice since. Things that measure the layout to
// place themselves (floating stickers) wait for this, so they appear once, in their final spot, instead of jumping as the content around them loads.
// A slow third-party asset cannot hold them back forever: after 4 seconds they go anyway.
export function useSettled(): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    let off = false;
    const loaded = document.readyState === 'complete' ? Promise.resolve() : new Promise<void>((resolve) => window.addEventListener('load', () => resolve(), { once: true }));
    const fonts: Promise<unknown> = document.fonts?.ready ?? Promise.resolve();
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 4000));
    void Promise.race([Promise.all([loaded, fonts]), timeout]).then(() => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!off) setSettled(true);
        }),
      );
    });
    return () => {
      off = true;
    };
  }, []);
  return settled;
}
