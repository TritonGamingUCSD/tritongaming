'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { FileText, FolderCog, Home, Plus, Search, Star } from 'lucide-react';
import Popover from '@/components/ui/Popover';
import type { DocNode, DocSection } from '@/lib/docsTree';
import type { Doc } from '@/types/database';
import styles from './docs.module.css';

interface Row { doc: Doc; depth: number; group: string }
interface Group { label: string; color?: string | null; rows: Row[] }

const walk = (nodes: DocNode<Doc>[], group: string): Row[] => nodes.flatMap((n) => [{ doc: n.doc, depth: n.depth, group }, ...walk(n.children, group)]);

// "Browse all docs": a small searchable list that drops from the button. Type to filter; with nothing typed it shows your favourites,
// then every category (what changed lately lives on the docs home, not here). Arrow keys move, Enter opens. Editors also get Organize and New doc at the bottom.
export default function DocPicker({ anchor, docs, sections, favorites, selectedId, canEdit, onOpen, onHome, onOrganize, onNew, onClose }: {
  anchor: RefObject<HTMLElement | null>; docs: Doc[]; sections: DocSection<Doc>[]; favorites: Set<string>; selectedId: string | null; canEdit: boolean;
  onOpen: (id: string) => void; onHome: () => void; onOrganize: () => void; onNew: () => void; onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // The panel is placed a frame after it mounts (hidden until then), and a hidden field cannot take focus.
  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 30); return () => clearTimeout(t); }, []);
  const visible = useMemo(() => new Set(docs.map((d) => d.id)), [docs]);

  const groups: Group[] = useMemo(() => {
    const term = q.trim().toLowerCase();
    const inVisible = (r: Row) => visible.has(r.doc.id);
    const sectionRows = sections.map((s) => ({ s, rows: walk(s.nodes, s.name).filter(inVisible) }));
    if (term) {
      const hits = sectionRows.flatMap(({ rows }) => rows).filter((r) => r.doc.title.toLowerCase().includes(term) || (r.doc.tags ?? []).some((t) => t.toLowerCase().includes(term)));
      hits.sort((a, b) => Number(b.doc.title.toLowerCase().startsWith(term)) - Number(a.doc.title.toLowerCase().startsWith(term)));
      return [{ label: hits.length ? `${hits.length} match${hits.length === 1 ? '' : 'es'}` : 'No matches', rows: hits.map((r) => ({ ...r, depth: 0 })) }];
    }
    const out: Group[] = [];
    const favs = docs.filter((d) => favorites.has(d.id));
    if (favs.length) out.push({ label: 'Favorites', rows: favs.map((doc) => ({ doc, depth: 0, group: 'Favorites' })) });
    for (const { s, rows } of sectionRows) if (rows.length) out.push({ label: s.name, color: s.color, rows });
    return out;
  }, [q, docs, sections, favorites, visible]);

  const flat = groups.flatMap((g) => g.rows);
  useEffect(() => { setCursor(0); }, [q]);
  useEffect(() => { listRef.current?.querySelector<HTMLElement>(`[data-i="${cursor}"]`)?.scrollIntoView({ block: 'nearest' }); }, [cursor]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(flat.length - 1, c + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    else if (e.key === 'Enter' && flat[cursor]) { e.preventDefault(); onOpen(flat[cursor].doc.id); }
  }

  let i = -1;
  return (
    <Popover anchor={anchor} onClose={onClose} width={380} label="Browse all docs">
      <div className={styles.picker} onKeyDown={onKey}>
        <label className={styles.pickerSearch}>
          <Search size={15} aria-hidden="true" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a doc by title or tag" aria-label="Find a doc" />
        </label>
        <div className={styles.pickerList} ref={listRef} role="listbox" aria-label="Docs">
          {!q.trim() && (
            <button type="button" className={styles.pickerHome} onClick={onHome}><Home size={14} aria-hidden="true" /> Docs home</button>
          )}
          {groups.map((g) => (
            <div key={g.label} className={styles.pickerGroup}>
              <div className={styles.pickerLabel}>{g.color && <span className={styles.pickerDot} style={{ background: g.color }} aria-hidden="true" />}{g.label}</div>
              {g.rows.map((r) => {
                i += 1;
                const idx = i;
                return (
                  <button key={`${g.label}-${r.doc.id}`} type="button" role="option" aria-selected={r.doc.id === selectedId} data-i={idx}
                    className={`${styles.pickerRow} ${idx === cursor ? styles.pickerCursor : ''} ${r.doc.id === selectedId ? styles.pickerCurrent : ''}`}
                    style={{ paddingLeft: `${0.6 + r.depth * 0.9}rem` }} onMouseMove={() => setCursor(idx)} onClick={() => onOpen(r.doc.id)}>
                    <span className={styles.pickerIcon} aria-hidden="true"><FileText size={14} /></span>
                    <span className={styles.pickerTitle}>{r.doc.title || 'Untitled'}</span>
                    {favorites.has(r.doc.id) && g.label !== 'Favorites' && <Star size={12} className={styles.pickerStar} aria-label="Favorite" />}
                    {q.trim() && <span className={styles.pickerWhere}>{r.group}</span>}
                    {canEdit && r.doc.draft_updated_at && <span className={styles.pickerDraft} title="Has unpublished changes" aria-label="Has unpublished changes" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        {canEdit && (
          <div className={styles.pickerFoot}>
            <button type="button" onClick={onNew}><Plus size={14} aria-hidden="true" /> New doc</button>
            <button type="button" onClick={onOrganize}><FolderCog size={14} aria-hidden="true" /> Organize</button>
          </div>
        )}
      </div>
    </Popover>
  );
}
