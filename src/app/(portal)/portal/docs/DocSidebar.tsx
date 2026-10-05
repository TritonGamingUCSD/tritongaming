'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, FolderCog, MoreHorizontal, Plus, Search, Star, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { canMoveUnder, highlightParts, type DocNode, type DocSection, type SearchHit } from '@/lib/docsTree';
import type { SyncDoc } from '@/lib/docsSync';
import type { Doc, DocCategory } from '@/types/database';
import styles from './docs.module.css';

export interface DropTarget { parentId: string | null; categoryId: string | null; beforeId: string | null }

function Highlight({ text, query }: { text: string; query: string }) {
  return <>{highlightParts(text, query).map((p, i) => (p.hit ? <mark key={i} className={styles.mark}>{p.text}</mark> : <span key={i}>{p.text}</span>))}</>;
}

export default function DocSidebar({
  docs, sections, categories, selectedId, query, onQuery, hits, favorites, collapsed, onToggle, onOpen, onHome, canEdit, sync,
  onNew, onMenu, onDrop, onAddCategory, onDeleteCategory, catName,
}: {
  docs: Doc[]; sections: DocSection<Doc>[]; categories: DocCategory[]; selectedId: string | null; query: string; onQuery: (q: string) => void; hits: SearchHit<Doc>[];
  favorites: Set<string>; collapsed: Set<string>; onToggle: (key: string) => void; onOpen: (id: string) => void; onHome: () => void; canEdit: boolean;
  sync: Map<string, SyncDoc>; onNew: (parentId: string | null, categoryId: string | null) => void; onMenu: (doc: Doc, action: 'sub' | 'move' | 'up' | 'down') => void;
  onDrop: (dragId: string, target: DropTarget) => void; onAddCategory: (name: string) => Promise<void>; onDeleteCategory: (c: DocCategory) => void; catName: (d: Doc) => string;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; zone: 'before' | 'inside' | 'after' } | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [manageCats, setManageCats] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const q = query.trim();

  const siblingsAfter = (n: DocNode<Doc>, list: DocNode<Doc>[]) => { const i = list.findIndex((x) => x.doc.id === n.doc.id); return list[i + 1]?.doc.id ?? null; };
  const favDocs = docs.filter((d) => favorites.has(d.id));

  function zoneOf(e: React.DragEvent<HTMLElement>): 'before' | 'inside' | 'after' {
    const r = e.currentTarget.getBoundingClientRect();
    const y = (e.clientY - r.top) / Math.max(1, r.height);
    return y < 0.28 ? 'before' : y > 0.72 ? 'after' : 'inside';
  }

  function renderNode(n: DocNode<Doc>, list: DocNode<Doc>[], sectionId: string | null): React.ReactNode {
    const d = n.doc;
    const open = !collapsed.has(d.id);
    const live = sync.get(d.id);
    const editing = live?.editing ?? [];
    const active = selectedId === d.id;
    const dropHere = over?.id === d.id && dragId && dragId !== d.id ? over.zone : null;
    const hasDraft = canEdit && !!d.draft_updated_at;
    return (
      <li key={d.id} role="treeitem" aria-expanded={n.children.length ? open : undefined} aria-selected={active}>
        <div
          className={`${styles.row} ${active ? styles.rowActive : ''} ${dropHere ? styles['drop_' + dropHere] : ''} ${dragId === d.id ? styles.rowDragging : ''}`}
          style={{ paddingLeft: `${0.35 + n.depth * 0.95}rem` }}
          draggable={canEdit}
          onDragStart={(e) => { setDragId(d.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', d.id); }}
          onDragEnd={() => { setDragId(null); setOver(null); }}
          onDragOver={(e) => {
            if (!dragId || dragId === d.id) return;
            const zone = zoneOf(e);
            const parent = zone === 'inside' ? d.id : d.parent_id;
            if (!canMoveUnder(docs, dragId, parent)) return;
            e.preventDefault(); setOver({ id: d.id, zone });
          }}
          onDragLeave={() => setOver((o) => (o?.id === d.id ? null : o))}
          onDrop={(e) => {
            e.preventDefault();
            const id = dragId; const zone = zoneOf(e);
            setDragId(null); setOver(null);
            if (!id || id === d.id) return;
            if (zone === 'inside') onDrop(id, { parentId: d.id, categoryId: null, beforeId: null });
            else if (zone === 'before') onDrop(id, { parentId: d.parent_id, categoryId: d.parent_id ? null : sectionId, beforeId: d.id });
            else onDrop(id, { parentId: d.parent_id, categoryId: d.parent_id ? null : sectionId, beforeId: siblingsAfter(n, list) });
          }}
        >
          <button type="button" className={styles.twisty} onClick={() => onToggle(d.id)} aria-label={open ? `Collapse ${d.title}` : `Expand ${d.title}`} tabIndex={n.children.length ? 0 : -1} style={{ visibility: n.children.length ? 'visible' : 'hidden' }}>
            {open ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
          </button>
          <button type="button" className={styles.rowMain} onClick={() => onOpen(d.id)}>
            <span className={styles.rowIcon} aria-hidden="true">{d.icon ? d.icon : <FileText size={14} strokeWidth={1.5} />}</span>
            <span className={styles.rowTitle}>{d.title || 'Untitled'}</span>
            {!d.published && canEdit && <span className={styles.tagMini}>New</span>}
            {hasDraft && d.published && <span className={styles.dot} title="Has unpublished changes" aria-label="Has unpublished changes" />}
            {editing.length > 0 && <span className={styles.editingTag} title={`${editing.join(', ')} editing`}>{editing[0]}{editing.length > 1 ? ` +${editing.length - 1}` : ''} editing</span>}
            {favorites.has(d.id) && <Star size={11} className={styles.favMini} aria-label="Favorite" />}
          </button>
          {canEdit && (
            <div className={styles.rowMenuWrap}>
              <button type="button" className={styles.rowMenuBtn} aria-label={`Actions for ${d.title}`} aria-haspopup="menu" aria-expanded={menuFor === d.id} onClick={() => setMenuFor(menuFor === d.id ? null : d.id)}><MoreHorizontal size={15} aria-hidden="true" /></button>
              {menuFor === d.id && (
                <div className={styles.rowMenu} role="menu" onMouseLeave={() => setMenuFor(null)}>
                  <button type="button" role="menuitem" onClick={() => { setMenuFor(null); onMenu(d, 'sub'); }}>Add Sub-Page</button>
                  <button type="button" role="menuitem" onClick={() => { setMenuFor(null); onMenu(d, 'move'); }}>Move To…</button>
                  <button type="button" role="menuitem" onClick={() => { setMenuFor(null); onMenu(d, 'up'); }}>Move Up</button>
                  <button type="button" role="menuitem" onClick={() => { setMenuFor(null); onMenu(d, 'down'); }}>Move Down</button>
                </div>
              )}
            </div>
          )}
        </div>
        {n.children.length > 0 && open && <ul role="group" className={styles.treeList}>{n.children.map((c) => renderNode(c, n.children, sectionId))}</ul>}
      </li>
    );
  }

  return (
    <aside className={styles.nav} aria-label="Docs navigation">
      <div className={styles.navTop}>
        <div className={styles.searchWrap}>
          <Search size={15} strokeWidth={1.75} className={styles.searchIcon} aria-hidden="true" />
          <input className={styles.searchInput} type="search" value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Search every doc…" aria-label="Search documentation"
            onKeyDown={(e) => { if (e.key === 'Enter' && hits[0]) onOpen(hits[0].doc.id); if (e.key === 'Escape') onQuery(''); }} />
          {query && <button type="button" className={styles.searchClear} onClick={() => onQuery('')} aria-label="Clear search"><X size={13} strokeWidth={2} /></button>}
        </div>
        <div className={styles.navButtons}>
          <Button size="sm" variant="ghost" onClick={onHome}>Docs Home</Button>
          {canEdit && <Button size="sm" onClick={() => onNew(null, null)}><Plus size={14} aria-hidden="true" /> New Doc</Button>}
        </div>
      </div>

      <div className={styles.navScroll}>
        {docs.length === 0 && <p className={styles.emptyNote}>No docs yet.</p>}

        {q ? (
          <div className={styles.results} role="list" aria-label="Search results">
            <div className={styles.resultsLabel}>{hits.length} result{hits.length === 1 ? '' : 's'}</div>
            {hits.length === 0 && <p className={styles.emptyNote}>Nothing matches “{q}”. Try fewer words.</p>}
            {hits.map(({ doc, snippet }) => (
              <button key={doc.id} type="button" role="listitem" className={`${styles.result} ${selectedId === doc.id ? styles.rowActive : ''}`} onClick={() => onOpen(doc.id)}>
                <span className={styles.resultTitle}>{doc.icon ? `${doc.icon} ` : ''}<Highlight text={doc.title} query={q} /></span>
                <span className={styles.resultCat}>{catName(doc)}{doc.tags.length ? ` · ${doc.tags.map((t) => `#${t}`).join(' ')}` : ''}</span>
                {snippet && <span className={styles.resultSnippet}><Highlight text={snippet} query={q} /></span>}
              </button>
            ))}
          </div>
        ) : (
          <>
            {favDocs.length > 0 && (
              <section className={styles.catGroup}>
                <div className={styles.catHeaderStatic}><Star size={12} aria-hidden="true" /> <span className={styles.catName}>Favorites</span></div>
                <ul className={styles.treeList}>
                  {favDocs.map((d) => (
                    <li key={d.id}><div className={`${styles.row} ${selectedId === d.id ? styles.rowActive : ''}`}><span className={styles.twisty} style={{ visibility: 'hidden' }} /><button type="button" className={styles.rowMain} onClick={() => onOpen(d.id)}><span className={styles.rowIcon} aria-hidden="true">{d.icon ?? <FileText size={14} strokeWidth={1.5} />}</span><span className={styles.rowTitle}>{d.title}</span></button></div></li>
                  ))}
                </ul>
              </section>
            )}
            {sections.map((s) => {
              const key = `cat:${s.id ?? 'none'}`;
              const isCollapsed = collapsed.has(key);
              return (
                <section key={key} className={styles.catGroup}>
                  <button type="button" className={styles.catHeader} onClick={() => onToggle(key)} aria-expanded={!isCollapsed}
                    onDragOver={(e) => { if (dragId) { e.preventDefault(); } }} onDrop={(e) => { e.preventDefault(); const id = dragId; setDragId(null); setOver(null); if (id) onDrop(id, { parentId: null, categoryId: s.id, beforeId: null }); }}>
                    {isCollapsed ? <ChevronRight size={14} strokeWidth={2} aria-hidden="true" /> : <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />}
                    <span className={styles.catName}>{s.name}</span>
                    <span className={styles.catCount}>{s.count}</span>
                  </button>
                  {!isCollapsed && (
                    <ul role="tree" className={styles.treeList} aria-label={s.name}>
                      {s.nodes.map((n) => renderNode(n, s.nodes, s.id))}
                      {s.nodes.length === 0 && <li className={styles.emptyNote}>Nothing here yet. {canEdit ? 'Drag a doc onto the title.' : ''}</li>}
                    </ul>
                  )}
                </section>
              );
            })}
          </>
        )}
      </div>

      {canEdit && (
        <div className={styles.catManager}>
          <button type="button" className={styles.catManagerToggle} onClick={() => setManageCats((v) => !v)} aria-expanded={manageCats}>
            <FolderCog size={14} strokeWidth={1.75} aria-hidden="true" /> Manage Categories
            <ChevronDown size={14} className={manageCats ? styles.flip : ''} aria-hidden="true" />
          </button>
          {manageCats && (
            <div className={styles.catManagerBody}>
              {categories.length > 0 && (
                <div className={styles.categoryChips}>
                  {categories.map((c) => (
                    <span key={c.id} className={styles.categoryChip}>{c.name}
                      <button type="button" className={styles.categoryChipRemove} onClick={() => onDeleteCategory(c)} aria-label={`Delete category ${c.name}`}><X size={12} strokeWidth={2} /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className={styles.categoryAddRow}>
                <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New category…" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const n = newCategory.trim(); if (n) { setNewCategory(''); void onAddCategory(n); } } }} />
                <Button size="sm" disabled={!newCategory.trim()} onClick={() => { const n = newCategory.trim(); setNewCategory(''); void onAddCategory(n); }}>Add</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
