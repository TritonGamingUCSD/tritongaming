'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Search, X } from 'lucide-react';
import { highlightParts, searchDocs } from '@/lib/docs/docsTree';
import type { Doc } from '@/types/database';
import styles from './docSearch.module.css';

// The search box on the docs page. Results open right under it as you type (title, a piece of the text around the match, which group the doc is in),
// with the matching words marked. Arrow keys move, Enter opens, Escape closes; "/" jumps into the box from anywhere on the page.
function Marked({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map((p, i) =>
        p.hit ? (
          <mark key={i} className={styles.match}>
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

export default function DocSearch({ docs, groupName, onOpen }: { docs: Doc[]; groupName: (d: Doc) => string; onOpen: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hits = useMemo(() => searchDocs(docs, q).slice(0, 8), [docs, q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    const off = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', off);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', off);
    };
  }, []);

  const pick = (id: string) => {
    setOpen(false);
    setQ('');
    onOpen(id);
  };
  const showList = open && q.trim().length > 0;

  return (
    <div className={styles.wrap} ref={boxRef}>
      <label className={styles.box}>
        <Search size={16} aria-hidden="true" />
        <input
          ref={inputRef}
          className={styles.input}
          type="search"
          value={q}
          placeholder="Search the docs…"
          aria-label="Search the docs"
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls="doc-search-results"
          aria-activedescendant={showList && hits[index] ? `doc-hit-${hits[index].doc.id}` : undefined}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setIndex(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIndex((i) => Math.min(hits.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter' && hits[index]) {
              e.preventDefault();
              pick(hits[index].doc.id);
            } else if (e.key === 'Escape') {
              setOpen(false);
              (e.target as HTMLElement).blur();
            }
          }}
        />
        {q ? (
          <button
            type="button"
            className={styles.clear}
            aria-label="Clear the search"
            onClick={() => {
              setQ('');
              inputRef.current?.focus();
            }}
          >
            <X size={15} aria-hidden="true" />
          </button>
        ) : (
          <kbd className={styles.kbd} aria-hidden="true">
            /
          </kbd>
        )}
      </label>
      {showList && (
        <ul className={styles.list} id="doc-search-results" role="listbox" aria-label="Matching docs">
          {hits.length === 0 && <li className={styles.none}>No doc matches “{q.trim()}”.</li>}
          {hits.map((h, i) => (
            <li key={h.doc.id} id={`doc-hit-${h.doc.id}`} role="option" aria-selected={i === index}>
              <button type="button" className={`${styles.hit} ${i === index ? styles.hitOn : ''}`} onMouseEnter={() => setIndex(i)} onClick={() => pick(h.doc.id)}>
                <span className={styles.hitIcon} aria-hidden="true">
                  <FileText size={15} />
                </span>
                <span className={styles.hitText}>
                  <strong>
                    <Marked text={h.doc.title} query={q} />
                  </strong>
                  <small className={styles.hitGroup}>{groupName(h.doc)}</small>
                  {h.snippet && (
                    <span className={styles.hitSnippet}>
                      <Marked text={h.snippet} query={q} />
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
