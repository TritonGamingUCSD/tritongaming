'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import PortalSearch from './PortalSearch';
import { useCodeFlow } from './CodeBox';
import styles from './Spotlight.module.css';

// One search for everything, in the top bar as a single icon: it opens a Spotlight-style panel in the middle of the screen (⌘K or / also opens it). Type to find a page, a person, a doc or an event; type
// six digits and they are sent as a code (a meeting check-in, a ticket, a Trivia game or a poll), with the same pop-up and sounds as the code box.
export default function Spotlight() {
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState('');
  const flow = useCodeFlow();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable);
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') || (!typing && e.key === '/')) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);
  useEffect(() => {
    const ask = (e: Event) => {
      setSeed(((e as CustomEvent<string>).detail as string | undefined) ?? '');
      setOpen(true);
    };
    window.addEventListener('tg:search', ask);
    return () => window.removeEventListener('tg:search', ask);
  }, []);
  return (
    <>
      <button
        type="button"
        className={styles.btn}
        onClick={() => {
          setSeed('');
          setOpen(true);
        }}
        aria-label="Search, or enter a code"
        title="Search or enter a code (⌘K)"
      >
        <Search size={18} strokeWidth={2} aria-hidden="true" />
      </button>
      {open && (
        <div className={styles.veil} onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)} role="dialog" aria-modal="true" aria-label="Search">
          <div className={styles.panel}>
            <PortalSearch
              spotlight
              initial={seed}
              placeholder="Search pages, people, events, docs, or type a 6-digit code…"
              onClose={() => setOpen(false)}
              onCode={(c) => void flow.submit(c)}
            />
            <p className={styles.foot}>
              <kbd>↑</kbd> <kbd>↓</kbd> to move, <kbd>Enter</kbd> to open, <kbd>Esc</kbd> to close
            </p>
          </div>
        </div>
      )}
      {flow.dialog}
    </>
  );
}
