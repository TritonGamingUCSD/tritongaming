'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Runs inside the editor's preview frame: re-renders the page when the editor says its drafts changed (keeping scroll position),
// and stops clicks from navigating away, since the preview shows one page.
// The first element in the page's main content whose own text contains `needle` (case-insensitive).
function findByText(needle: string): HTMLElement | null {
  const walker = document.createTreeWalker(document.querySelector('main') ?? document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if ((n.textContent ?? '').toLowerCase().includes(needle)) return n.parentElement;
  }
  return null;
}

export default function PreviewBridge() {
  const router = useRouter();
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === 'tg-preview-refresh') router.refresh();
      // Bring the part being edited into view: the footer sits at the bottom of every page; otherwise find the section by a bit of
      // its own text (the block's title/label), scroll to it and flash an outline so it is easy to spot.
      if (e.data?.type === 'tg-preview-focus') {
        if (e.data.target === 'footer') { document.querySelector('footer')?.scrollIntoView({ block: 'end', behavior: 'smooth' }); return; }
        const needle = typeof e.data.text === 'string' ? e.data.text.trim().toLowerCase() : '';
        const el = needle ? findByText(needle) : null;
        if (!el) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.animate([{ outline: '3px solid #ffc72c', outlineOffset: '6px' }, { outline: '3px solid transparent', outlineOffset: '6px' }], { duration: 1600 });
      }
    };
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest('a[href]')) e.preventDefault();
    };
    window.addEventListener('message', onMessage);
    document.addEventListener('click', onClick, true);
    window.parent?.postMessage({ type: 'tg-preview-ready' }, window.location.origin);
    return () => { window.removeEventListener('message', onMessage); document.removeEventListener('click', onClick, true); };
  }, [router]);
  return null;
}
