'use client';

import { useMemo, useRef, useState } from 'react';
import { Image as ImageIcon, Paperclip, BookOpen, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { slugify } from '@/lib/slug';
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

// Write/Preview tabs — same small pattern duplicated in EventForm and
// ContentEditor rather than shared.
function MarkdownField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  return (
    <div className={styles.field}>
      <div className={styles.mdHeader}>
        <span className={styles.label}>Content</span>
        <div className={styles.mdTabs}>
          <button type="button" className={`${styles.mdTab} ${tab === 'write' ? styles.mdTabActive : ''}`} onClick={() => setTab('write')}>Write</button>
          <button type="button" className={`${styles.mdTab} ${tab === 'preview' ? styles.mdTabActive : ''}`} onClick={() => setTab('preview')}>Preview</button>
        </div>
      </div>
      {tab === 'write' ? (
        <textarea
          className={`${styles.input} ${styles.textarea}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={16}
          placeholder="Write in Markdown — **bold**, _italic_, [links](https://…), lists, headings…"
        />
      ) : (
        <div className={styles.mdPreview}>
          {value.trim() ? <MarkdownContent>{value}</MarkdownContent> : <span className={styles.mdPreviewEmpty}>Nothing to preview yet.</span>}
        </div>
      )}
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
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}

function AttachmentsView({ attachments }: { attachments: DocAttachment[] }) {
  if (attachments.length === 0) return null;
  return (
    <div className={styles.viewAttachments}>
      <span className={styles.label}>Attachments</span>
      <ul className={styles.attachList}>
        {attachments.map((a, i) => (
          <li key={`${a.url}-${i}`}>
            <a href={a.url} target="_blank" rel="noopener noreferrer" className={styles.attachLink}>
              <span aria-hidden="true">
                {a.kind === 'google_album' ? <ImageIcon size={14} strokeWidth={1.5} /> : <Paperclip size={14} strokeWidth={1.5} />}
              </span> {a.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DocsClient({ initialDocs, initialCategories, userId, canEdit }: { initialDocs: Doc[]; initialCategories: DocCategory[]; userId: string; canEdit: boolean }) {
  const [docs, setDocs] = useState(initialDocs);
  const [categories, setCategories] = useState(initialCategories);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [query, setQuery] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
    setIsNew(true);
    setEditing(true);
    setSelectedId(null);
    setDraft({ ...EMPTY_DRAFT, parentId });
    setError('');
  }

  function startEdit(doc: Doc) {
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
    if (!window.confirm(`Delete category "${cat.name}"? Docs in it become uncategorized, not deleted.`)) return;
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
    if (!window.confirm(`Delete "${selected.title}"?${warn} This can't be undone.`)) return;
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
    setSelectedId(null);
    setEditing(false);
  }

  return (
    <div className={styles.layout}>
      <div className={styles.sidebar}>
        <input
          className={styles.searchInput}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search docs…"
          aria-label="Search documentation"
        />
        {canEdit && <button type="button" className={styles.newBtn} onClick={() => startNew(null)}>+ New Doc</button>}

        {canEdit && (
          <div className={styles.categoryManager}>
            <div className={styles.categoryManagerLabel}>Categories</div>
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
              <input
                className={styles.categoryAddInput}
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="New category…"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }}
              />
              <button type="button" className={styles.categoryAddBtn} onClick={handleAddCategory} disabled={!newCategory.trim()}>+</button>
            </div>
          </div>
        )}

        {docs.length === 0 && <p className={styles.emptyNote}>No docs yet — create the first one.</p>}

        {tree.map(({ name, items }) => (
          <div key={name} className={styles.catGroup}>
            <div className={styles.catLabel}>{name}</div>
            {items.map(({ doc, children }) => (
              <div key={doc.id}>
                <button
                  className={`${styles.docItem} ${selectedId === doc.id && !isNew ? styles.docItemActive : ''}`}
                  onClick={() => { setSelectedId(doc.id); setEditing(false); setIsNew(false); }}
                >
                  {doc.title}
                </button>
                {children.map((child) => (
                  <button
                    key={child.id}
                    className={`${styles.docItem} ${styles.docItemChild} ${selectedId === child.id && !isNew ? styles.docItemActive : ''}`}
                    onClick={() => { setSelectedId(child.id); setEditing(false); setIsNew(false); }}
                  >
                    {child.title}
                  </button>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className={styles.panel}>
        {editing ? (
          <div className={styles.form}>
            <label className={styles.field}>
              <span className={styles.label}>Title *</span>
              <input
                className={styles.input}
                value={draft.title}
                onChange={(e) => setDraft((f) => ({ ...f, title: e.target.value }))}
                maxLength={120}
                autoFocus
              />
            </label>

            <div className={styles.formRow}>
              <label className={styles.field}>
                <span className={styles.label}>Category</span>
                <select
                  className={styles.input}
                  value={draft.categoryId ?? ''}
                  onChange={(e) => setDraft((f) => ({ ...f, categoryId: e.target.value || null }))}
                >
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Parent Doc</span>
                <select
                  className={styles.input}
                  value={draft.parentId ?? ''}
                  onChange={(e) => setDraft((f) => ({ ...f, parentId: e.target.value || null }))}
                >
                  <option value="">Top-level (no parent)</option>
                  {parentOptions.map((d) => (
                    <option key={d.id} value={d.id}>{d.title}</option>
                  ))}
                </select>
                <span className={styles.hint}>Pick a parent to make this a sub-post under it.</span>
              </label>
            </div>

            <MarkdownField value={draft.content} onChange={(v) => setDraft((f) => ({ ...f, content: v }))} />
            <AttachmentsField value={draft.attachments} onChange={(v) => setDraft((f) => ({ ...f, attachments: v }))} />

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.actions}>
              <button type="button" className={styles.cancelBtn} onClick={cancelEdit} disabled={saving}>Cancel</button>
              <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={saving || !draft.title.trim()}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : selected ? (
          <div className={styles.view}>
            <div className={styles.viewHeader}>
              <div>
                <span className={styles.catBadge}>
                  {(selected.category_id && categoryById.get(selected.category_id)?.name) || UNCATEGORIZED}
                </span>
                <h1 className={styles.viewTitle}>{selected.title}</h1>
                <p className={styles.viewMeta}>
                  Updated {new Date(selected.updated_at).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              {canEdit && (
                <div className={styles.viewActions}>
                  {!selected.parent_id && (
                    <button type="button" className={styles.editBtn} onClick={() => startNew(selected.id)}>+ Sub-Post</button>
                  )}
                  <button type="button" className={styles.editBtn} onClick={() => startEdit(selected)}>Edit</button>
                  <button type="button" className={styles.deleteBtn} onClick={handleDelete} disabled={saving}>Delete</button>
                </div>
              )}
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.viewBody}>
              {selected.content.trim() ? <MarkdownContent>{selected.content}</MarkdownContent> : <p className={styles.emptyNote}>This doc has no content yet.</p>}
            </div>
            <AttachmentsView attachments={selected.attachments} />
          </div>
        ) : (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}><BookOpen size={32} strokeWidth={1.25} aria-hidden="true" /></span>
            <p>{canEdit ? 'Select a doc from the left, or create a new one.' : 'Select a doc from the left to read it.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
