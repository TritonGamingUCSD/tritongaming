'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, X, Users, Calendar, BookOpen, CornerDownLeft, ArrowRight, Zap } from 'lucide-react';
import { matchCommands, type PortalCommand } from '@/lib/portalCommands';
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
const CATEGORY_LABELS: Record<keyof SearchResponse, string> = { members: 'TG Members', events: 'Events', docs: 'Docs' };
// Same color coding as the sidebar groups.
const CATEGORY_META: Record<keyof SearchResponse, { icon: typeof Users; accent: string }> = {
  members: { icon: Users, accent: '#34d399' },
  events: { icon: Calendar, accent: '#4a90e2' },
  docs: { icon: BookOpen, accent: '#34d399' },
};

// Bold the part of a result that matched what was typed.
function Highlight({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i === -1) return <>{text}</>;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

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
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);
  // Sections and actions to jump to: loaded once, the first time the bar is focused.
  const [commands, setCommands] = useState<PortalCommand[] | null>(null);
  const loadingCommands = useRef(false);
  function ensureCommands() {
    if (commands || loadingCommands.current) return;
    loadingCommands.current = true;
    fetch('/api/portal/commands').then((r) => r.json()).then((d) => setCommands(d.commands ?? [])).catch(() => setCommands([])).finally(() => { loadingCommands.current = false; });
  }

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

  // ⌘K / Ctrl+K (or "/" when not typing somewhere) jumps straight to the box.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = /^(input|textarea|select)$/i.test((e.target as HTMLElement)?.tagName ?? '') || (e.target as HTMLElement)?.isContentEditable;
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') || (!typing && e.key === '/')) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Jump targets: what the person typed matched against sections/actions. With nothing typed, a few suggestions.
  const SUGGESTED = ['do-help-new', 'go-tickets', 'do-meeting-checkin', 'do-meeting-plan', 'go-calendar'];
  const jump: SearchResult[] = (commands ?? []).length === 0 ? [] : (query.trim().length >= 1
    ? matchCommands(commands!, query.trim())
    : SUGGESTED.map((id) => commands!.find((c) => c.id === id)).filter((c): c is PortalCommand => !!c).slice(0, 5)
  ).map((c) => ({ id: c.id, title: c.label, subtitle: c.hint, href: c.href, kind: c.kind } as SearchResult & { kind: string }));
  const flat = [...jump, ...(Object.keys(results) as (keyof SearchResponse)[]).flatMap((k) => results[k])];
  useEffect(() => { setActive(0); }, [results, query, commands]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setQuery(''); inputRef.current?.blur(); return; }
    if (!flat.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % flat.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + flat.length) % flat.length); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const r = flat[active];
      if (r) { setQuery(''); inputRef.current?.blur(); router.push(r.href); window.dispatchEvent(new Event('tg:portal-nav')); }
    }
  }

  const hasResults = results.members.length > 0 || results.events.length > 0 || results.docs.length > 0;
  const showDropdown = open && (query.trim().length >= 1 ? true : jump.length > 0) && (query.trim().length >= 2 || jump.length > 0);

  return (
    <div className={`${styles.wrap} ${compact ? styles.compact : ''}`}>
      <div className={`${styles.inputWrap} ${open ? styles.inputFocus : ''}`}>
        <Search size={16} strokeWidth={1.75} className={styles.icon} aria-hidden="true" />
        <input
          ref={inputRef}
          className={styles.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => { setOpen(true); ensureCommands(); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search or jump to…"
          aria-label="Search the portal"
          autoComplete="off"
        />
        {query ? (
          <button className={styles.clearBtn} onMouseDown={(e) => e.preventDefault()} onClick={() => setQuery('')} aria-label="Clear search">
            <X size={13} strokeWidth={2} />
          </button>
        ) : (
          <kbd className={styles.kbd} aria-hidden="true">⌘K</kbd>
        )}
      </div>

      {showDropdown && (
        <div className={styles.dropdown}>
          {jump.length > 0 && (
            <div className={styles.group} style={{ ['--accent' as string]: '#ffc72c' }}>
              <div className={styles.groupLabel}>{query.trim() ? 'Jump to' : 'Quick actions'}</div>
              {jump.map((r) => {
                const isDo = (r as SearchResult & { kind?: string }).kind === 'Do';
                return (
                  <Link
                    key={r.id}
                    href={r.href}
                    className={`${styles.result} ${flat[active]?.id === r.id ? styles.resultActive : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setQuery(''); inputRef.current?.blur(); window.dispatchEvent(new Event('tg:portal-nav')); }}
                    onMouseEnter={() => setActive(flat.findIndex((x) => x.id === r.id))}
                  >
                    <span className={styles.resultIcon} aria-hidden="true">{isDo ? <Zap size={15} strokeWidth={1.75} /> : <ArrowRight size={15} strokeWidth={1.75} />}</span>
                    <span className={styles.resultText}>
                      <span className={styles.resultTitle}><Highlight text={r.title} q={query.trim()} /></span>
                      {r.subtitle && <span className={styles.resultSubtitle}>{r.subtitle}</span>}
                    </span>
                    <CornerDownLeft size={13} className={styles.resultEnter} aria-hidden="true" />
                  </Link>
                );
              })}
            </div>
          )}
          {query.trim().length < 2 ? null : loading ? (
            <div className={styles.status}>Searching…</div>
          ) : !hasResults && jump.length === 0 ? (
            <div className={styles.status}>No results for “{query.trim()}”</div>
          ) : !hasResults ? null : (
            <>
              {(Object.keys(results) as (keyof SearchResponse)[]).map((key) => {
                if (results[key].length === 0) return null;
                const { icon: Icon, accent } = CATEGORY_META[key];
                return (
                  <div key={key} className={styles.group} style={{ ['--accent' as string]: accent }}>
                    <div className={styles.groupLabel}>{CATEGORY_LABELS[key]}</div>
                    {results[key].map((r) => (
                      <Link
                        key={r.id}
                        href={r.href}
                        className={`${styles.result} ${flat[active]?.id === r.id ? styles.resultActive : ''}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setActive(flat.findIndex((x) => x.id === r.id))}
                      >
                        <span className={styles.resultIcon} aria-hidden="true"><Icon size={15} strokeWidth={1.75} /></span>
                        <span className={styles.resultText}>
                          <span className={styles.resultTitle}><Highlight text={r.title} q={query.trim()} /></span>
                          {r.subtitle && <span className={styles.resultSubtitle}>{r.subtitle}</span>}
                        </span>
                        <CornerDownLeft size={13} className={styles.resultEnter} aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                );
              })}
              <div className={styles.hints} aria-hidden="true">
                <span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
