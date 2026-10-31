import { useEffect, useState } from 'react';
import { DESKTOP_BREAKPOINT } from './hubConstants';

export function useIsDesktop(): boolean {
  // Starts false (the SSR-safe default — the server has no window to check)
  // and corrects on mount. A real desktop visitor sees one frame of the
  // mobile layout before this flips, which is the standard, accepted
  // trade-off for a media-query-driven layout split that can't be resolved
  // server-side.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_BREAKPOINT);
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}
