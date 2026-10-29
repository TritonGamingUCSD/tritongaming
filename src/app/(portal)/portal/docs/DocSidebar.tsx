'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, FileText, GripVertical, House, MoreHorizontal, Plus, Star, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { CATEGORY_COLORS, canMoveUnder, type DocNode, type DocSection } from '@/lib/docs/docsTree';
import type { SyncDoc } from '@/lib/docs/docsSync';
import type { Doc, DocCategory } from '@/types/database';
import styles from './docs.module.css';

export interface DropTarget {
  parentId: string | null;
  categoryId: string | null;
  beforeId: string | null;
}

export default function DocSidebar({
  docs,
  sections,
  categories,
  selectedId,
  onClose,
  favorites,
  collapsed,
  onToggle,
  onCollapseAll,
  onExpandAll,
  onOpen,
  onHome,
  canEdit,
  sync,
  onNew,
  onMenu,
  onDrop,
  onAddCategory,
  onDeleteCategory,
  onCategoryColor,
  onReorderCategories,
  onRenameCategory,
}: {
  docs: Doc[];
  sections: DocSection<Doc>[];
  categories: DocCategory[];
  selectedId: string | null;
  onClose: () => void;
  favorites: Set<string>;
  collapsed: Set<string>;
  onToggle: (key: string) => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  onOpen: (id: string) => void;
  onHome: () => void;
  canEdit: boolean;
  sync: Map<string, SyncDoc>;
  onNew: (parentId: string | null, categoryId: string | null) => void;
  onMenu: (doc: Doc, action: 'sub' | 'move' | 'up' | 'down') => void;
  onDrop: (dragId: string, target: DropTarget) => void;
  onAddCategory: (name: string) => Promise<void>;
  onDeleteCategory: (c: DocCategory) => void;
  onCategoryColor: (c: DocCategory, color: string | null) => void;
  onRenameCategory: (c: DocCategory, name: string) => void;
  onReorderCategories: (ids: string[]) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; zone: 'before' | 'inside' | 'after' } | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [menuCat, setMenuCat] = useState<string | null>(null);
  const [addingCat, setAddingCat] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [colorFor, setColorFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dragCat, setDragCat] = useState<string | null>(null);
  const [liveCats, setLiveCats] = useState<string[] | null>(null);
  // While a category is dragged the others move out of the way; nothing is saved until it is dropped.
  const shownSections = liveCats
    ? [...liveCats.map((id) => sections.find((x) => x.id === id)).filter((x): x is DocSection<Doc> => !!x), ...sections.filter((x) => !x.id)]
    : sections;

  const siblingsAfter = (n: DocNode<Doc>, list: DocNode<Doc>[]) => {
    const i = list.findIndex((x) => x.doc.id === n.doc.id);
    return list[i + 1]?.doc.id ?? null;
  };
  const favDocs = docs.filter((d) => favorites.has(d.id));

  function zoneOf(e: React.DragEvent<HTMLElement>): 'before' | 'inside' | 'after' {
    const r = e.currentTarget.getBoundingClientRect();
    const y = (e.clientY - r.top) / Math.max(1, r.height);
    return y < 0.28 ? 'before' : y > 0.72 ? 'after' : 'inside';
  }

  // One button for both: it collapses everything, and once everything is collapsed it expands everything again.
  const allCollapsed = sections.length > 0 && sections.every((x) => collapsed.has(`cat:${x.id ?? 'none'}`));

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
          onDragStart={(e) => {
            setDragId(d.id);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', d.id);
          }}
          onDragEnd={() => {
            setDragId(null);
            setOver(null);
          }}
          onDragOver={(e) => {
            if (!dragId || dragId === d.id) return;
            const zone = zoneOf(e);
            const parent = zone === 'inside' ? d.id : d.parent_id;
            if (!canMoveUnder(docs, dragId, parent)) return;
            e.preventDefault();
            setOver({ id: d.id, zone });
          }}
          onDragLeave={() => setOver((o) => (o?.id === d.id ? null : o))}
          onDrop={(e) => {
            e.preventDefault();
            const id = dragId;
            const zone = zoneOf(e);
            setDragId(null);
            setOver(null);
            if (!id || id === d.id) return;
            if (zone === 'inside') onDrop(id, { parentId: d.id, categoryId: null, beforeId: null });
            else if (zone === 'before') onDrop(id, { parentId: d.parent_id, categoryId: d.parent_id ? null : sectionId, beforeId: d.id });
            else onDrop(id, { parentId: d.parent_id, categoryId: d.parent_id ? null : sectionId, beforeId: siblingsAfter(n, list) });
          }}
        >
          <button
            type="button"
            className={styles.twisty}
            onClick={() => onToggle(d.id)}
            aria-label={open ? `Collapse ${d.title}` : `Expand ${d.title}`}
            tabIndex={n.children.length ? 0 : -1}
            style={{ visibility: n.children.length ? 'visible' : 'hidden' }}
          >
            {open ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
          </button>
          <button type="button" className={styles.rowMain} onClick={() => onOpen(d.id)}>
            <span className={styles.rowIcon} aria-hidden="true">
              <FileText size={14} strokeWidth={1.5} />
            </span>
            <span className={styles.rowTitle} title={d.title || 'Untitled'}>
              {d.title || 'Untitled'}
            </span>
            {n.children.length > 0 && (
              <span className={styles.subBadge} title={`${n.children.length} ${n.children.length === 1 ? 'subpage' : 'subpages'}`}>
                {n.children.length}
              </span>
            )}
            {!d.published && canEdit && <span className={styles.tagMini}>New</span>}
            {hasDraft && d.published && <span className={styles.dot} title="Has unpublished changes" aria-label="Has unpublished changes" />}
            {editing.length > 0 && (
              <span className={styles.editingTag} title={`${editing.join(', ')} editing`}>
                {editing[0]}
                {editing.length > 1 ? ` +${editing.length - 1}` : ''} editing
              </span>
            )}
            {favorites.has(d.id) && <Star size={11} className={styles.favMini} aria-label="Favorite" />}
          </button>
          {canEdit && (
            <div className={styles.rowMenuWrap}>
              <button
                type="button"
                className={styles.rowMenuBtn}
                aria-label={`Actions for ${d.title}`}
                aria-haspopup="menu"
                aria-expanded={menuFor === d.id}
                onClick={() => setMenuFor(menuFor === d.id ? null : d.id)}
              >
                <MoreHorizontal size={15} aria-hidden="true" />
              </button>
              {menuFor === d.id && (
                <div className={styles.rowMenu} role="menu" onMouseLeave={() => setMenuFor(null)}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuFor(null);
                      onMenu(d, 'sub');
                    }}
                  >
                    Add Sub-Page
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuFor(null);
                      onMenu(d, 'move');
                    }}
                  >
                    Move To…
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuFor(null);
                      onMenu(d, 'up');
                    }}
                  >
                    Move Up
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuFor(null);
                      onMenu(d, 'down');
                    }}
                  >
                    Move Down
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {n.children.length > 0 && open && (
          <ul role="group" className={styles.treeList}>
            {n.children.map((c) => renderNode(c, n.children, sectionId))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <aside className={styles.nav} aria-label="Docs navigation">
      <div className={styles.navTop}>
        <div className={styles.drawerHead}>
          <strong>All docs</strong>
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close the doc list">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.navButtons}>
          <Button size="sm" variant="ghost" onClick={onHome} className={styles.homeBtn}>
            <House size={14} aria-hidden="true" /> Docs Home
          </Button>
          <button
            type="button"
            className={styles.collapseAll}
            onClick={allCollapsed ? onExpandAll : onCollapseAll}
            aria-label={allCollapsed ? 'Expand all' : 'Collapse all'}
            title={allCollapsed ? 'Expand all' : 'Collapse all'}
          >
            {allCollapsed ? <ChevronsUpDown size={15} aria-hidden="true" /> : <ChevronsDownUp size={15} aria-hidden="true" />}
          </button>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => onNew(null, null)} className={styles.newDocBtn}>
            <Plus size={14} aria-hidden="true" /> New Doc
          </Button>
        )}
      </div>

      <div className={styles.navScroll}>
        {docs.length === 0 && <p className={styles.emptyNote}>No docs yet.</p>}

        {
          <>
            {favDocs.length > 0 && (
              <section className={styles.catGroup}>
                <div className={styles.catHeaderStatic}>
                  <Star size={12} aria-hidden="true" /> <span className={styles.catName}>Favorites</span>
                </div>
                <ul className={styles.treeList}>
                  {favDocs.map((d) => (
                    <li key={d.id}>
                      <div className={`${styles.row} ${selectedId === d.id ? styles.rowActive : ''}`}>
                        <span className={styles.twisty} style={{ visibility: 'hidden' }} />
                        <button type="button" className={styles.rowMain} onClick={() => onOpen(d.id)}>
                          <span className={styles.rowIcon} aria-hidden="true">
                            <FileText size={14} strokeWidth={1.5} />
                          </span>
                          <span className={styles.rowTitle}>{d.title}</span>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {shownSections
              .filter((s) => canEdit || s.count > 0)
              .map((s) => {
                const key = `cat:${s.id ?? 'none'}`;
                const isCollapsed = collapsed.has(key);
                const cat = s.id ? (categories.find((c) => c.id === s.id) ?? null) : null;
                const editable = canEdit && !!cat;
                return (
                  <section key={key} className={styles.catGroup}>
                    <div
                      className={`${styles.catRow} ${dragCat === s.id ? styles.rowDragging : ''}`}
                      draggable={editable}
                      onDragStart={(e) => {
                        if (!editable) return;
                        setDragCat(s.id);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', s.id!);
                      }}
                      onDragEnd={() => {
                        setDragCat(null);
                        setLiveCats(null);
                      }}
                      onDragOver={(e) => {
                        if (dragCat) {
                          if (!s.id) return;
                          e.preventDefault();
                          if (dragCat === s.id) return;
                          const ids = shownSections.filter((x) => x.id).map((x) => x.id as string);
                          const next = ids.filter((id) => id !== dragCat);
                          next.splice(ids.indexOf(s.id), 0, dragCat);
                          if (next.join() !== ids.join()) setLiveCats(next);
                        } else if (dragId) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragCat) {
                          const ids = liveCats;
                          setDragCat(null);
                          setLiveCats(null);
                          if (ids && ids.join() !== categories.map((x) => x.id).join()) onReorderCategories(ids);
                          return;
                        }
                        const id = dragId;
                        setDragId(null);
                        setOver(null);
                        if (id) onDrop(id, { parentId: null, categoryId: s.id, beforeId: null });
                      }}
                    >
                      {renaming === s.id && cat ? (
                        <span className={styles.catHeader}>
                          <input
                            className={styles.chipRename}
                            defaultValue={cat.name}
                            autoFocus
                            maxLength={60}
                            aria-label={`New name for ${cat.name}`}
                            onFocus={(e) => e.currentTarget.select()}
                            onBlur={(e) => {
                              const v = e.currentTarget.value.trim();
                              setRenaming(null);
                              if (v && v !== cat.name) onRenameCategory(cat, v);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.currentTarget.blur();
                              if (e.key === 'Escape') {
                                e.currentTarget.value = cat.name;
                                e.currentTarget.blur();
                              }
                            }}
                          />
                        </span>
                      ) : (
                        <button type="button" className={styles.catHeader} onClick={() => onToggle(key)} aria-expanded={!isCollapsed}>
                          {editable && <GripVertical size={13} className={styles.catGrip} aria-hidden="true" />}
                          {isCollapsed ? <ChevronRight size={14} strokeWidth={2} aria-hidden="true" /> : <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />}
                          {s.color && <span className={styles.catDot} style={{ background: s.color }} aria-hidden="true" />}
                          <span className={styles.catName}>{s.name}</span>
                          <span className={styles.catCount}>{s.count}</span>
                        </button>
                      )}
                      {editable && cat && (
                        <div className={styles.rowMenuWrap}>
                          <button
                            type="button"
                            className={styles.rowMenuBtn}
                            aria-label={`Actions for the category ${cat.name}`}
                            aria-haspopup="menu"
                            aria-expanded={menuCat === cat.id}
                            onClick={() => setMenuCat(menuCat === cat.id ? null : cat.id)}
                          >
                            <MoreHorizontal size={15} aria-hidden="true" />
                          </button>
                          {menuCat === cat.id && (
                            <div className={styles.rowMenu} role="menu" onMouseLeave={() => setMenuCat(null)}>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setMenuCat(null);
                                  setRenaming(cat.id);
                                }}
                              >
                                Rename
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setMenuCat(null);
                                  setColorFor(cat.id);
                                }}
                              >
                                Change Colour
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setMenuCat(null);
                                  onNew(null, cat.id);
                                }}
                              >
                                Add Doc Here
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setMenuCat(null);
                                  onDeleteCategory(cat);
                                }}
                              >
                                Delete Category
                              </button>
                            </div>
                          )}
                          {colorFor === cat.id && (
                            <span className={styles.swatchPop} role="group" aria-label={`Colours for ${cat.name}`}>
                              {CATEGORY_COLORS.map((col) => (
                                <button
                                  key={col}
                                  type="button"
                                  className={styles.swatchOpt}
                                  style={{ background: col }}
                                  aria-label={col}
                                  aria-pressed={cat.color === col}
                                  onClick={() => {
                                    setColorFor(null);
                                    onCategoryColor(cat, col);
                                  }}
                                />
                              ))}
                              <button
                                type="button"
                                className={styles.swatchNone}
                                onClick={() => {
                                  setColorFor(null);
                                  onCategoryColor(cat, null);
                                }}
                              >
                                None
                              </button>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {!isCollapsed && (
                      <ul role="tree" className={styles.treeList} aria-label={s.name}>
                        {s.nodes.map((n) => renderNode(n, s.nodes, s.id))}
                        {s.nodes.length === 0 && <li className={styles.emptyNote}>Empty. Drag a doc onto the title.</li>}
                      </ul>
                    )}
                  </section>
                );
              })}
            {canEdit && (
              <div className={styles.addCat}>
                {addingCat ? (
                  <Input
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="New category name"
                    maxLength={60}
                    autoFocus
                    aria-label="New category name"
                    onBlur={() => {
                      const n = newCategory.trim();
                      setAddingCat(false);
                      setNewCategory('');
                      if (n) void onAddCategory(n);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') {
                        setNewCategory('');
                        e.currentTarget.blur();
                      }
                    }}
                  />
                ) : (
                  <button type="button" className={styles.addCatBtn} onClick={() => setAddingCat(true)}>
                    <Plus size={13} aria-hidden="true" /> New Category
                  </button>
                )}
              </div>
            )}
          </>
        }
      </div>
    </aside>
  );
}
