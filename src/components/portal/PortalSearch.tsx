'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import styles from './PortalSearch.module.css';

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

interface SearchResponse {
  members: SearchResult[];
  events: SearchResult[];
  docs: SearchResult[];
}

const EMPTY: SearchResponse = { members: [], events: [], docs: [] };
const CATEGORY_LABELS: Record<keyof SearchResponse, string> = { members: 'Members', events: 'Events', docs: 'Docs' };

// A persistent bar rather than its own hub card — search needs to be
// reachable in one step from wherever you already are in the grid, not a
// click away like every other section. `compact`, used when this sits
// inside the desktop rail (a fixed 220px column) rather than centered
// above the wide content pane, drops the centered max-width box in favor
// of filling its container.
export default function PortalSearch({ compact }: { compact?: boolean } = {}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResponse>(EMPTY);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const thisRequest = ++requestId.current;
      try {
        const res = await fetch(`/api/portal/search?q=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        // A slower earlier request can resolve after a faster later one —
        // only the most recent request's result should ever land.
        if (thisRequest === requestId.current) setResults(res.ok ? data : EMPTY);
      } catch {
        if (thisRequest === requestId.current) setResults(EMPTY);
      } finally {
        if (thisRequest === requestId.current) setLoading(false);
      }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const hasResults = results.members.length > 0 || results.events.length > 0 || results.docs.length > 0;
  const showDropdown = open && query.trim().length >= 2;

  return (
    <div className={`${styles.wrap} ${compact ? styles.compact : ''}`}>
      <div className={styles.inputWrap}>
        <Search size={15} strokeWidth={1.5} className={styles.icon} aria-hidden="true" />
        <input
          className={styles.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search"
          autoComplete="off"
        />
        {query && (
          <button className={styles.clearBtn} onMouseDown={(e) => e.preventDefault()} onClick={() => setQuery('')} aria-label="Clear search">
            <X size={13} strokeWidth={1.75} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className={styles.dropdown}>
          {loading ? (
            <div className={styles.status}>Searching…</div>
          ) : !hasResults ? (
            <div className={styles.status}>No results for "{query.trim()}"</div>
          ) : (
            (Object.keys(results) as (keyof SearchResponse)[]).map((key) =>
              results[key].length === 0 ? null : (
                <div key={key} className={styles.group}>
                  <div className={styles.groupLabel}>{CATEGORY_LABELS[key]}</div>
                  {results[key].map((r) => (
                    <Link key={r.id} href={r.href} className={styles.result} onMouseDown={(e) => e.preventDefault()}>
                      <span className={styles.resultTitle}>{r.title}</span>
                      {r.subtitle && <span className={styles.resultSubtitle}>{r.subtitle}</span>}
                    </Link>
                  ))}
                </div>
              )
            )
          )}
        </div>
      )}
    </div>
  );
}
