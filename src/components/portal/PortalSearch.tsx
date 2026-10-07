'use client';

import { useEffect, useRef, useState } from 'react';
import Link from '@/components/portal/NoPrefetchLink';
import { navigatePortal } from '@/lib/portal/portalNav';
import { useRouter } from 'next/navigation';
import { Search, X, Users, Calendar, BookOpen, CornerDownLeft, ArrowRight, Zap } from 'lucide-react';
import { matchCommands, type PortalCommand } from '@/lib/portal/portalCommands';
import styles from './PortalSearch.module.css';

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

type SearchResponse = Record<string, SearchResult[]>;

const EMPTY: SearchResponse = {};
// Shown in this order; same color coding as the sidebar groups (Me blue, Events orange, Team violet, Library green, Manage rose).
const CATEGORY_LABELS: Record<string, string> = {
  tickets: 'My tickets', events: 'Events', internal: 'Internal events', meetings: 'Meetings', members: 'TG Members', divisions: 'Divisions', keys: 'Storage keys',
  docs: 'Docs', albums: 'Photo albums', shop: 'Rewards shop', help: 'Help', links: 'Short links',
};
const CATEGORY_META: Record<string, { icon: typeof Users; accent: string }> = {
  tickets: { icon: Calendar, accent: '#4a90d9' }, events: { icon: Calendar, accent: '#e8912d' }, internal: { icon: Calendar, accent: '#e8912d' },
  meetings: { icon: Users, accent: '#8b6cdc' }, members: { icon: Users, accent: '#8b6cdc' }, divisions: { icon: Users, accent: '#8b6cdc' }, keys: { icon: Users, accent: '#8b6cdc' },
  docs: { icon: BookOpen, accent: '#2fae86' }, albums: { icon: BookOpen, accent: '#2fae86' }, shop: { icon: BookOpen, accent: '#4a90d9' }, help: { icon: BookOpen, accent: '#2fae86' }, links: { icon: BookOpen, accent: '#d9487f' },
};
const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);
const orderedKeys = (r: SearchResponse) => CATEGORY_ORDER.filter((k) => (r[k]?.length ?? 0) > 0);

// Bold the part of a result that matched what was typed.
function Highlight({ text, q }: { text: string; q: string }) {
  const terms = q.replace(/^docs?\s+/i, '').split(/\s+/).filter((t) => t.length > 0).sort((a, b) => b.length - a.length).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!terms.length) return <>{text}</>;
  const re = new RegExp(`(${terms.join('|')})`, 'gi');
  return <>{text.split(re).map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>))}</>;
}

// A persistent bar rather than its own hub card — search needs to be
// reachable in one step from wherever you already are in the grid, not a
// click away like every other section. `compact`, used when this sits
// inside the desktop rail (a fixed 220px column) rather than centered
// above the wide content pane, drops the centered max-width box in favor
// of filling its container.
export default function PortalSearch({ compact, large, placeholder }: { compact?: boolean; large?: boolean; placeholder?: string } = {}) {
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

  // Pages can ask this bar to open with some text in it (the docs page's "Search docs" button sends "docs ").
  useEffect(() => {
    function onAsk(e: Event) {
      const text = (e as CustomEvent<string>).detail ?? '';
      if (!inputRef.current || inputRef.current.offsetParent === null) return;   // only the visible bar answers
      setQuery(text); inputRef.current.focus();
    }
    window.addEventListener('tg:search', onAsk);
    return () => window.removeEventListener('tg:search', onAsk);
  }, []);

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
  const flat = [...jump, ...orderedKeys(results).flatMap((k) => results[k])];
  useEffect(() => { setActive(0); }, [results, query, commands]);
  // Keep the highlighted result in view as the arrow keys move it through a list that scrolls (the first one scrolls back to the top so its heading shows).
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = dropdownRef.current;
    if (!box) return;
    if (active === 0) { box.scrollTop = 0; return; }
    box.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, query, results]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setQuery(''); inputRef.current?.blur(); return; }
    if (!flat.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % flat.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + flat.length) % flat.length); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const r = flat[active];
      if (r) { setQuery(''); inputRef.current?.blur(); if (!navigatePortal(r.href)) { router.push(r.href); window.dispatchEvent(new Event('tg:portal-nav')); } }
    }
  }

  const hasResults = orderedKeys(results).length > 0;
  const showDropdown = open && (query.trim().length >= 1 ? true : jump.length > 0) && (query.trim().length >= 2 || jump.length > 0);

  return (
    <div className={`${styles.wrap} ${compact ? styles.compact : ''} ${large ? styles.large : ''}`}>
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
          placeholder={placeholder ?? 'Search or jump to…'}
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
        <div className={styles.dropdown} ref={dropdownRef}>
          {jump.length > 0 && (
            <div className={styles.group} style={{ ['--accent' as string]: '#7db4ea' }}>
              <div className={styles.groupLabel}>{query.trim() ? 'Jump to' : 'Quick actions'}</div>
              {jump.map((r) => {
                const isDo = (r as SearchResult & { kind?: string }).kind === 'Do';
                return (
                  <Link
                    key={r.id}
                    href={r.href}
                    className={`${styles.result} ${flat.indexOf(r) === active ? styles.resultActive : ''}`}
                    data-idx={flat.indexOf(r)}
                    aria-current={flat.indexOf(r) === active ? 'true' : undefined}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => { setQuery(''); inputRef.current?.blur(); if (navigatePortal(r.href, e)) e.preventDefault(); else window.dispatchEvent(new Event('tg:portal-nav')); }}
                    onMouseEnter={() => setActive(flat.indexOf(r))}
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
              {orderedKeys(results).map((key) => {
                const { icon: Icon, accent } = CATEGORY_META[key];
                return (
                  <div key={key} className={styles.group} style={{ ['--accent' as string]: accent }}>
                    <div className={styles.groupLabel}>{CATEGORY_LABELS[key]}</div>
                    {results[key].map((r) => (
                      <Link
                        key={r.id}
                        href={r.href}
                        className={`${styles.result} ${flat.indexOf(r) === active ? styles.resultActive : ''}`}
                    data-idx={flat.indexOf(r)}
                    aria-current={flat.indexOf(r) === active ? 'true' : undefined}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => { setQuery(''); inputRef.current?.blur(); if (navigatePortal(r.href, e)) e.preventDefault(); else window.dispatchEvent(new Event('tg:portal-nav')); }}
                        onMouseEnter={() => setActive(flat.indexOf(r))}
                      >
                        <span className={styles.resultIcon} aria-hidden="true"><Icon size={15} strokeWidth={1.75} /></span>
                        <span className={styles.resultText}>
                          <span className={styles.resultTitle}><Highlight text={r.title} q={query.trim()} /></span>
                          {r.subtitle && <span className={styles.resultSubtitle}>{key === 'docs' ? <Highlight text={r.subtitle} q={query.trim()} /> : r.subtitle}</span>}
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
