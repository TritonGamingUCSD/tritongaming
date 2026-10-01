'use client';

import Notice from '@/components/ui/Notice';
import Button from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { confirmHold } from '@/lib/confirmHold';
import { showToast } from '@/lib/toast';
import { useUnsavedChanges, confirmDiscardUnsaved } from '@/lib/useUnsavedChanges';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePortalParams } from '@/lib/usePortalParams';
import SectionTabs from '@/components/ui/SectionTabs';
import { Image as ImageIcon, Paperclip, BookOpen, X, ChevronRight, ChevronLeft, ChevronDown, Plus, Search, FileText, Pencil, Trash2, FolderCog } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { slugify } from '@/lib/slug';
import { extractToc } from '@/lib/markdownToc';
import { uploadFileToStorage, MAX_FILE_BYTES } from '@/lib/fileUpload';
import { PACIFIC_TZ } from '@/lib/timezone';
import MarkdownContent from '@/components/MarkdownContent/MarkdownContent';
import type { Doc, DocCategory, DocAttachment } from '@/types/database';
import styles from './docs.module.css';

const UNCATEGORIZED = 'Uncategorized';

interface Draft {
  title: string;
  categoryId: string | null;
  parentId: string | null;
  content: string;
  attachments: DocAttachment[];
}

const EMPTY_DRAFT: Draft = { title: '', categoryId: null, parentId: null, content: '', attachments: [] };

// Markdown editor: write and preview side by side on wide screens, tabbed on
// narrow ones — so you see the result as you type instead of flipping back and forth.
function MarkdownField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  return (
    <div className={styles.field}>
      <div className={styles.mdHeader}>
        <span className={styles.label}>Content <span className={styles.labelHint}>Markdown — ## headings become the table of contents</span></span>
        <SectionTabs variant="segmented" label="Editor view" value={tab} onChange={setTab} tabs={[{ id: 'write', label: 'Write' }, { id: 'preview', label: 'Preview' }]} />
      </div>
      <div className={styles.mdSplit} data-tab={tab}>
        <textarea
          className={`${styles.input} ${styles.textarea} ${styles.mdWrite}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={20}
          placeholder="Write in Markdown — **bold**, _italic_, [links](https://…), lists, ## headings…"
        />
        <div className={`${styles.mdPreview} ${styles.mdPreviewPane}`}>
          {value.trim() ? <MarkdownContent>{value}</MarkdownContent> : <span className={styles.mdPreviewEmpty}>Nothing to preview yet.</span>}
        </div>
      </div>
    </div>
  );
}

function AttachmentsField({ value, onChange }: { value: DocAttachment[]; onChange: (v: DocAttachment[]) => void }) {
  const [uploading, setUploading] = useState(false);
  const [albumUrl, setAlbumUrl] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFilePick(file: File) {
    setError('');
    if (file.size > MAX_FILE_BYTES) {
      setError('File must be under 20MB.');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadFileToStorage('doc-attachments', file);
      onChange([...value, { name: file.name, url, kind: 'file' }]);
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function handleAddAlbum() {
    const url = albumUrl.trim();
    if (!url) return;
    onChange([...value, { name: 'Photo Album', url, kind: 'google_album' }]);
    setAlbumUrl('');
  }

  function handleRemove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className={styles.field}>
      <span className={styles.label}>Attachments</span>

      {value.length > 0 && (
        <ul className={styles.attachList}>
          {value.map((a, i) => (
            <li key={`${a.url}-${i}`} className={styles.attachRow}>
              <span className={styles.attachIcon} aria-hidden="true">
                {a.kind === 'google_album' ? <ImageIcon size={16} strokeWidth={1.5} /> : <Paperclip size={16} strokeWidth={1.5} />}
              </span>
              <span className={styles.attachName}>{a.name}</span>
              <button type="button" className={styles.attachRemoveBtn} onClick={() => handleRemove(i)}>Remove</button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.attachAddRow}>
        <button type="button" className={styles.attachUploadBtn} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? 'Uploading…' : '+ Add File'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFilePick(f); e.target.value = ''; }}
        />
      </div>
      <div className={styles.attachAddRow}>
        <input
          className={styles.input}
          type="url"
          value={albumUrl}
          onChange={(e) => setAlbumUrl(e.target.value)}
          placeholder="Paste a Google Photos album link…"
        />
        <button type="button" className={styles.attachAddBtn} onClick={handleAddAlbum} disabled={!albumUrl.trim()}>Add</button>
      </div>
      {error && <Notice tone="error" compact>{error}</Notice>}
    </div>
  );
}

function AttachmentsView({ attachments }: { attachments: DocAttachment[] }) {
  if (attachments.length === 0) return null;
  return (
    <section className={styles.viewAttachments}>
      <h2 className={styles.attachHeading}>Attachments</h2>
      <div className={styles.attachCards}>
        {attachments.map((a, i) => (
          <a key={`${a.url}-${i}`} href={a.url} target="_blank" rel="noopener noreferrer" className={styles.attachCard}>
            <span className={styles.attachCardIcon} aria-hidden="true">
              {a.kind === 'google_album' ? <ImageIcon size={18} strokeWidth={1.5} /> : <Paperclip size={18} strokeWidth={1.5} />}
            </span>
            <span className={styles.attachCardText}>
              <span className={styles.attachCardName}>{a.name}</span>
              <span className={styles.attachCardKind}>{a.kind === 'google_album' ? 'Photo album' : 'File'}</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

export default function DocsClient({ initialDocs, initialCategories, userId, canEdit }: { initialDocs: Doc[]; initialCategories: DocCategory[]; userId: string; canEdit: boolean }) {
  const [docs, setDocs] = useState(initialDocs);
  const [categories, setCategories] = useState(initialCategories);
  // Deep-linked in from portal search (?id=<docId>) — opens straight to
  // that doc's content instead of just landing on the general list.
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get('id'));
  const setParams = usePortalParams();
  const [editing, setEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [query, setQuery] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [manageCats, setManageCats] = useState(false);
  // Only an open editor holds unsaved edits. Opening a different doc (or
  // starting a new one) re-baselines via the key instead of counting as a change.
  const { markSaved, dirty } = useUnsavedChanges(editing ? draft : null, undefined, `${editing}:${isNew}:${selectedId}`);

  // Keep ?id=<doc> in the address bar so any doc can be linked to (skipped on first render so a deep link isn't wiped).
  const syncedOnce = useRef(false);
  useEffect(() => {
    if (!syncedOnce.current) { syncedOnce.current = true; return; }
    setParams({ id: selectedId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selected = docs.find((d) => d.id === selectedId) ?? null;
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Sidebar tree: category -> top-level docs -> their sub-posts (one level).
  const tree = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (d: Doc) => !q || d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q);
    const topLevel = docs.filter((d) => !d.parent_id);
    const childrenOf = (id: string) => docs.filter((d) => d.parent_id === id);

    const groups = new Map<string, Doc[]>();
    for (const d of topLevel) {
      const catName = (d.category_id && categoryById.get(d.category_id)?.name) || UNCATEGORIZED;
      const kids = childrenOf(d.id);
      if (!matches(d) && !kids.some(matches)) continue;
      if (!groups.has(catName)) groups.set(catName, []);
      groups.get(catName)!.push(d);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => (a === UNCATEGORIZED ? 1 : b === UNCATEGORIZED ? -1 : a.localeCompare(b)))
      .map(([name, items]) => ({ name, items: items.map((d) => ({ doc: d, children: childrenOf(d.id) })) }));
  }, [docs, query, categoryById]);

  // Valid parents for the doc form — top-level docs only, and never the doc
  // being edited itself (a sub-post can't be its own parent).
  const parentOptions = docs.filter((d) => !d.parent_id && d.id !== selectedId);

  function startNew(parentId: string | null = null) {
    if (!confirmDiscardUnsaved()) return;
    setIsNew(true);
    setEditing(true);
    setSelectedId(null);
    setDraft({ ...EMPTY_DRAFT, parentId });
    setError('');
  }

  function startEdit(doc: Doc) {
    if (!confirmDiscardUnsaved()) return;
    setIsNew(false);
    setEditing(true);
    setSelectedId(doc.id);
    setDraft({
      title: doc.title,
      categoryId: doc.category_id,
      parentId: doc.parent_id,
      content: doc.content,
      attachments: doc.attachments,
    });
    setError('');
  }

  function cancelEdit() {
    if (!confirmDiscardUnsaved()) return;
    setEditing(false);
    setIsNew(false);
    setError('');
  }

  async function handleAddCategory() {
    const name = newCategory.trim();
    if (!name) return;
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from('doc_categories')
      .insert({ name, order_index: categories.length })
      .select('id, name, order_index, created_at')
      .single();
    if (err) {
      setError(err.code === '23505' ? 'A category with that name already exists.' : 'Failed to add category.');
      return;
    }
    setCategories((prev) => [...prev, data as DocCategory]);
    setNewCategory('');
  }

  async function handleDeleteCategory(cat: DocCategory) {
    if (!(await confirmHold({ title: `Delete category "${cat.name}"?`, message: 'Docs in it become uncategorized, not deleted.', confirmLabel: 'Hold to delete' }))) return;
    const supabase = createClient();
    const { error: err } = await supabase.from('doc_categories').delete().eq('id', cat.id);
    if (err) {
      setError('Failed to delete category.');
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== cat.id));
    setDocs((prev) => prev.map((d) => (d.category_id === cat.id ? { ...d, category_id: null } : d)));
  }

  async function handleSave() {
    if (!draft.title.trim()) return;
    setSaving(true);
    setError('');
    const supabase = createClient();

    try {
      if (isNew) {
        const baseSlug = slugify(draft.title) || 'doc';
        let slug = baseSlug;
        let attempt = 1;
        while (docs.some((d) => d.slug === slug)) {
          slug = `${baseSlug}-${++attempt}`;
        }
        const { data, error: err } = await supabase
          .from('docs')
          .insert({
            slug,
            title: draft.title.trim(),
            category_id: draft.categoryId,
            parent_id: draft.parentId,
            order_index: 0,
            content: draft.content,
            attachments: draft.attachments,
            created_by: userId,
            updated_by: userId,
          })
          .select('id, slug, title, category_id, parent_id, order_index, content, attachments, created_by, updated_by, created_at, updated_at')
          .single();
        if (err) throw err;
        setDocs((prev) => [...prev, data as Doc]);
        setSelectedId((data as Doc).id);
      } else if (selected) {
        const { data, error: err } = await supabase
          .from('docs')
          .update({
            title: draft.title.trim(),
            category_id: draft.categoryId,
            parent_id: draft.parentId,
            content: draft.content,
            attachments: draft.attachments,
            updated_by: userId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selected.id)
          .select('id, slug, title, category_id, parent_id, order_index, content, attachments, created_by, updated_by, created_at, updated_at')
          .single();
        if (err) throw err;
        setDocs((prev) => prev.map((d) => (d.id === selected.id ? (data as Doc) : d)));
      }
      markSaved();
      showToast('Doc saved');
      setEditing(false);
      setIsNew(false);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    const childCount = docs.filter((d) => d.parent_id === selected.id).length;
    const warn = childCount > 0 ? ` Its ${childCount} sub-post${childCount === 1 ? '' : 's'} will be deleted too.` : '';
    if (!(await confirmHold({ title: `Delete "${selected.title}"?`, message: warn.trim() || undefined, confirmLabel: 'Hold to delete' }))) return;
    setSaving(true);
    setError('');
    const supabase = createClient();
    const { error: err } = await supabase.from('docs').delete().eq('id', selected.id);
    setSaving(false);
    if (err) {
      setError('Failed to delete. Please try again.');
      return;
    }
    setDocs((prev) => prev.filter((d) => d.id !== selected.id && d.parent_id !== selected.id));
    showToast('Doc deleted');
    setSelectedId(null);
    setEditing(false);
  }

  const showDetail = editing || !!selected;
  const q = query.trim().toLowerCase();

  // Everything in reading order (category → doc → its sub-posts), for prev/next.
  const ordered = useMemo(() => {
    const out: Doc[] = [];
    const cats = [...categories].sort((a, b) => a.order_index - b.order_index || a.name.localeCompare(b.name));
    const byCat = (cid: string | null) => docs.filter((d) => !d.parent_id && (d.category_id ?? null) === cid);
    const push = (d: Doc) => { out.push(d); docs.filter((c) => c.parent_id === d.id).forEach((c) => out.push(c)); };
    cats.forEach((c) => byCat(c.id).forEach(push));
    byCat(null).forEach(push);
    return out;
  }, [docs, categories]);
  const idx = selected ? ordered.findIndex((d) => d.id === selected.id) : -1;
  const prevDoc = idx > 0 ? ordered[idx - 1] : null;
  const nextDoc = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;
  const parentDoc = selected?.parent_id ? docs.find((d) => d.id === selected.parent_id) ?? null : null;
  const toc = useMemo(() => (selected ? extractToc(selected.content) : []), [selected]);
  const recent = useMemo(() => [...docs].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5), [docs]);

  const results = useMemo(() => {
    if (!q) return [];
    return docs.flatMap((d) => {
      const inTitle = d.title.toLowerCase().includes(q);
      const at = d.content.toLowerCase().indexOf(q);
      if (!inTitle && at === -1) return [];
      const snippet = at === -1 ? '' : (at > 40 ? '…' : '') + d.content.slice(Math.max(0, at - 40), at + 90).replace(/\s+/g, ' ').trim() + '…';
      return [{ doc: d, snippet }];
    });
  }, [docs, q]);

  // "On this page" scroll spy
  const proseRef = useRef<HTMLDivElement>(null);
  const [activeHeading, setActiveHeading] = useState<string | null>(null);
  useEffect(() => {
    setActiveHeading(null);
    const root = proseRef.current;
    if (!root || toc.length === 0) return;
    const heads = toc.map((t) => root.querySelector<HTMLElement>(`#${CSS.escape(t.id)}`)).filter((h): h is HTMLElement => !!h);
    if (heads.length === 0) return;
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActiveHeading(visible.target.id);
    }, { rootMargin: '-90px 0px -65% 0px' });
    heads.forEach((h) => obs.observe(h));
    return () => obs.disconnect();
  }, [toc, selectedId]);

  function openDoc(id: string) {
    if (!confirmDiscardUnsaved()) return;
    setSelectedId(id);
    setEditing(false);
    setIsNew(false);
    window.scrollTo({ top: 0 });
  }
  function toggleCat(name: string) {
    setCollapsed((prev) => { const n = new Set(prev); if (n.has(name)) n.delete(name); else n.add(name); return n; });
  }
  const catName = (d: Doc) => (d.category_id && categoryById.get(d.category_id)?.name) || UNCATEGORIZED;

  return (
    <div className={`${styles.shell} ${showDetail ? styles.showDetail : ''}`}>
      {/* ── Left: navigation ── */}
      <aside className={styles.nav}>
        <div className={styles.navTop}>
          <div className={styles.searchWrap}>
            <Search size={15} strokeWidth={1.75} className={styles.searchIcon} aria-hidden="true" />
            <input className={styles.searchInput} type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search docs…" aria-label="Search documentation" />
            {query && <button type="button" className={styles.searchClear} onClick={() => setQuery('')} aria-label="Clear search"><X size={13} strokeWidth={2} /></button>}
          </div>
          {canEdit && <Button size="sm" onClick={() => startNew(null)}><Plus size={14} aria-hidden="true" /> New doc</Button>}
        </div>

        <div className={styles.navScroll}>
          {docs.length === 0 && <p className={styles.emptyNote}>No docs yet — create the first one.</p>}

          {q ? (
            <div className={styles.results}>
              <div className={styles.resultsLabel}>{results.length} result{results.length === 1 ? '' : 's'}</div>
              {results.length === 0 && <p className={styles.emptyNote}>Nothing matches “{query.trim()}”.</p>}
              {results.map(({ doc, snippet }) => (
                <button key={doc.id} type="button" className={`${styles.result} ${selectedId === doc.id && !isNew ? styles.navActive : ''}`} onClick={() => openDoc(doc.id)}>
                  <span className={styles.resultTitle}>{doc.title}</span>
                  <span className={styles.resultCat}>{catName(doc)}</span>
                  {snippet && <span className={styles.resultSnippet}>{snippet}</span>}
                </button>
              ))}
            </div>
          ) : (
            tree.map(({ name, items }) => {
              const isCollapsed = collapsed.has(name);
              return (
                <section key={name} className={styles.catGroup}>
                  <button type="button" className={styles.catHeader} onClick={() => toggleCat(name)} aria-expanded={!isCollapsed}>
                    {isCollapsed ? <ChevronRight size={14} strokeWidth={2} aria-hidden="true" /> : <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />}
                    <span className={styles.catName}>{name}</span>
                    <span className={styles.catCount}>{items.reduce((n, i) => n + 1 + i.children.length, 0)}</span>
                  </button>
                  {!isCollapsed && (
                    <div className={styles.catItems}>
                      {items.map(({ doc, children }) => (
                        <div key={doc.id}>
                          <button type="button" className={`${styles.navItem} ${selectedId === doc.id && !isNew ? styles.navActive : ''}`} onClick={() => openDoc(doc.id)}>
                            <FileText size={14} strokeWidth={1.5} aria-hidden="true" />
                            <span>{doc.title}</span>
                          </button>
                          {children.map((child) => (
                            <button key={child.id} type="button" className={`${styles.navItem} ${styles.navChild} ${selectedId === child.id && !isNew ? styles.navActive : ''}`} onClick={() => openDoc(child.id)}>
                              <span>{child.title}</span>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>

        {canEdit && (
          <div className={styles.catManager}>
            <button type="button" className={styles.catManagerToggle} onClick={() => setManageCats((v) => !v)} aria-expanded={manageCats}>
              <FolderCog size={14} strokeWidth={1.75} aria-hidden="true" /> Manage categories
              <ChevronDown size={14} className={manageCats ? styles.flip : ''} aria-hidden="true" />
            </button>
            {manageCats && (
              <div className={styles.catManagerBody}>
                {categories.length > 0 && (
                  <div className={styles.categoryChips}>
                    {categories.map((c) => (
                      <span key={c.id} className={styles.categoryChip}>
                        {c.name}
                        <button type="button" className={styles.categoryChipRemove} onClick={() => handleDeleteCategory(c)} aria-label={`Delete category ${c.name}`}><X size={12} strokeWidth={2} /></button>
                      </span>
                    ))}
                  </div>
                )}
                <div className={styles.categoryAddRow}>
                  <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New category…" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }} />
                  <Button size="sm" onClick={handleAddCategory} disabled={!newCategory.trim()}>Add</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* ── Main ── */}
      <main className={styles.main}>
        {showDetail && (
          <button type="button" className={styles.backToList} onClick={() => { if (!confirmDiscardUnsaved()) return; setSelectedId(null); setEditing(false); setIsNew(false); }}>
            <ChevronLeft size={16} aria-hidden="true" /> All docs
          </button>
        )}

        {editing ? (
          <div className={styles.editor}>
            <header className={styles.editorHead}>
              <h1 className={styles.editorTitle}>{isNew ? (draft.parentId ? 'New sub-post' : 'New doc') : 'Edit doc'}</h1>
              {dirty && <span className={styles.unsaved}>Unsaved changes</span>}
            </header>

            <label className={styles.field}>
              <span className={styles.label}>Title *</span>
              <Input value={draft.title} onChange={(e) => setDraft((f) => ({ ...f, title: e.target.value }))} maxLength={120} autoFocus placeholder="e.g. Event day checklist" />
            </label>

            <div className={styles.formRow}>
              <label className={styles.field}>
                <span className={styles.label}>Category</span>
                <Select value={draft.categoryId ?? ''} onChange={(e) => setDraft((f) => ({ ...f, categoryId: e.target.value || null }))}>
                  <option value="">Uncategorized</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Parent doc</span>
                <Select value={draft.parentId ?? ''} onChange={(e) => setDraft((f) => ({ ...f, parentId: e.target.value || null }))}>
                  <option value="">Top-level (no parent)</option>
                  {parentOptions.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                </Select>
                <span className={styles.hint}>Pick a parent to make this a sub-post under it.</span>
              </label>
            </div>

            <MarkdownField value={draft.content} onChange={(v) => setDraft((f) => ({ ...f, content: v }))} />
            <AttachmentsField value={draft.attachments} onChange={(v) => setDraft((f) => ({ ...f, attachments: v }))} />

            {error && <Notice tone="error">{error}</Notice>}

            <div className={styles.saveBar}>
              <Button variant="ghost" onClick={cancelEdit} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} loading={saving} disabled={!draft.title.trim()}>{saving ? 'Saving…' : 'Save doc'}</Button>
            </div>
          </div>
        ) : selected ? (
          <div className={styles.reader}>
            <article className={styles.article}>
              <nav className={styles.crumbs} aria-label="Breadcrumb">
                <span>{catName(selected)}</span>
                {parentDoc && (<><ChevronRight size={12} aria-hidden="true" /><button type="button" className={styles.crumbLink} onClick={() => openDoc(parentDoc.id)}>{parentDoc.title}</button></>)}
              </nav>
              <header className={styles.articleHead}>
                <h1 className={styles.articleTitle}>{selected.title}</h1>
                {canEdit && (
                  <div className={styles.articleActions}>
                    {!selected.parent_id && <Button size="sm" variant="ghost" onClick={() => startNew(selected.id)}><Plus size={14} aria-hidden="true" /> Sub-post</Button>}
                    <Button size="sm" variant="ghost" onClick={() => startEdit(selected)}><Pencil size={14} aria-hidden="true" /> Edit</Button>
                    <Button size="sm" variant="ghost" onClick={handleDelete} disabled={saving}><Trash2 size={14} aria-hidden="true" /> Delete</Button>
                  </div>
                )}
              </header>
              <p className={styles.articleMeta}>Updated {new Date(selected.updated_at).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, month: 'short', day: 'numeric', year: 'numeric' })}</p>

              {error && <Notice tone="error">{error}</Notice>}

              <div className={styles.prose} ref={proseRef}>
                {selected.content.trim() ? <MarkdownContent headingIds>{selected.content}</MarkdownContent> : <p className={styles.emptyNote}>This doc has no content yet.</p>}
              </div>

              <AttachmentsView attachments={selected.attachments} />

              {(prevDoc || nextDoc) && (
                <nav className={styles.pager} aria-label="Previous and next doc">
                  {prevDoc ? (
                    <button type="button" className={styles.pagerBtn} onClick={() => openDoc(prevDoc.id)}>
                      <span className={styles.pagerLabel}><ChevronLeft size={13} aria-hidden="true" /> Previous</span>
                      <span className={styles.pagerTitle}>{prevDoc.title}</span>
                    </button>
                  ) : <span />}
                  {nextDoc ? (
                    <button type="button" className={`${styles.pagerBtn} ${styles.pagerNext}`} onClick={() => openDoc(nextDoc.id)}>
                      <span className={styles.pagerLabel}>Next <ChevronRight size={13} aria-hidden="true" /></span>
                      <span className={styles.pagerTitle}>{nextDoc.title}</span>
                    </button>
                  ) : <span />}
                </nav>
              )}
            </article>

            {toc.length > 1 && (
              <aside className={styles.toc} aria-label="On this page">
                <div className={styles.tocLabel}>On this page</div>
                {toc.map((t) => (
                  <a key={t.id} href={`#${t.id}`} className={`${styles.tocLink} ${t.level === 3 ? styles.tocSub : ''} ${activeHeading === t.id ? styles.tocActive : ''}`}
                    onClick={(e) => { e.preventDefault(); document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setActiveHeading(t.id); }}>
                    {t.text}
                  </a>
                ))}
              </aside>
            )}
          </div>
        ) : (
          <div className={styles.home}>
            <header className={styles.homeHead}>
              <span className={styles.homeIcon}><BookOpen size={26} strokeWidth={1.5} aria-hidden="true" /></span>
              <div>
                <h1 className={styles.homeTitle}>Documentation</h1>
                <p className={styles.homeSub}>{docs.length} doc{docs.length === 1 ? '' : 's'} across {tree.length} categor{tree.length === 1 ? 'y' : 'ies'} — guides, checklists and how-tos for the team.</p>
              </div>
            </header>

            {recent.length > 0 && (
              <section>
                <h2 className={styles.homeH2}>Recently updated</h2>
                <div className={styles.recentList}>
                  {recent.map((d) => (
                    <button key={d.id} type="button" className={styles.recentItem} onClick={() => openDoc(d.id)}>
                      <span className={styles.recentTitle}>{d.title}</span>
                      <span className={styles.recentMeta}>{catName(d)} · {new Date(d.updated_at).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, month: 'short', day: 'numeric' })}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {tree.length > 0 && (
              <section>
                <h2 className={styles.homeH2}>Browse by category</h2>
                <div className={styles.catCards}>
                  {tree.map(({ name, items }) => (
                    <div key={name} className={styles.catCard}>
                      <div className={styles.catCardHead}>
                        <span className={styles.catCardName}>{name}</span>
                        <span className={styles.catCount}>{items.reduce((n, i) => n + 1 + i.children.length, 0)}</span>
                      </div>
                      <ul className={styles.catCardList}>
                        {items.slice(0, 4).map(({ doc }) => (
                          <li key={doc.id}><button type="button" className={styles.catCardLink} onClick={() => openDoc(doc.id)}>{doc.title}</button></li>
                        ))}
                      </ul>
                      {items.length > 4 && <span className={styles.catCardMore}>+{items.length - 4} more</span>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {docs.length === 0 && <div className={styles.empty}><p>{canEdit ? 'No docs yet — create the first one.' : 'No docs have been published yet.'}</p></div>}
          </div>
        )}
      </main>
    </div>
  );
}
