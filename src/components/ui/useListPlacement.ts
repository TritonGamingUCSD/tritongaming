import { useLayoutEffect, useState } from 'react';

// Where an open drop-down list goes: fixed on the screen (so a table that scrolls or clips its cells can't hide it), upwards when there is no room below.
export function useListPlacement(open: boolean, anchor: React.RefObject<HTMLElement | null>, dep: number): React.CSSProperties | null {
  const [pos, setPos] = useState<React.CSSProperties | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (!r) return;
      // On an iPhone the keyboard covers the page without shrinking the window, so room is measured against what is actually visible (the visual viewport).
      const vv = window.visualViewport,
        top = vv?.offsetTop ?? 0,
        seen = top + (vv?.height ?? window.innerHeight);
      const below = seen - r.bottom - 8,
        above = r.top - top - 8;
      const up = below < 200 && above > below;
      const room = Math.max(120, Math.min(240, up ? above : below));
      setPos({
        position: 'fixed',
        left: Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 176) - 8)),
        width: Math.max(r.width, 176),
        maxHeight: room,
        right: 'auto',
        ...(up ? { bottom: window.innerHeight - r.top + 3, top: 'auto' } : { top: r.bottom + 3 }),
      });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('scroll', place);
    };
  }, [open, dep, anchor]);
  return pos;
}
