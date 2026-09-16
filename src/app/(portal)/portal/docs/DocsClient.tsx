'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { slugify } from '@/lib/slug';
import MarkdownContent from '@/components/MarkdownContent/MarkdownContent';
import type { Doc } from '@/types/database';
import styles from './docs.module.css';

const UNCATEGORIZED = 'General';

interface Draft {
  title: string;
  category: string;
  content: string;
}

const EMPTY_DRAFT: Draft = { title: '', category: '', content: '' };

// Write/Preview tabs — same pattern as EventForm's MarkdownField and
// ContentEditor's MarkdownField, duplicated locally rather than shared,
// matching how this codebase already has this exact small component twice.
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

export default function DocsClient({ initialDocs, userId }: { initialDocs: Doc[]; userId: string }) {
  const [docs, setDocs] = useState(initialDocs);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selected = docs.find((d) => d.id === selectedId) ?? null;

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? docs.filter((d) => d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q)) : docs;
    const groups: Record<string, Doc[]> = {};
    for (const d of filtered) {
      const cat = d.category?.trim() || UNCATEGORIZED;
      (groups[cat] ??= []).push(d);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [docs, query]);

  function startNew() {
    setIsNew(true);
    setEditing(true);
    setSelectedId(null);
    setDraft(EMPTY_DRAFT);
    setError('');
  }

  function startEdit(doc: Doc) {
    setIsNew(false);
    setEditing(true);
    setSelectedId(doc.id);
    setDraft({ title: doc.title, category: doc.category ?? '', content: doc.content });
    setError('');
  }

  function cancelEdit() {
    setEditing(false);
    setIsNew(false);
    setError('');
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
        // Slugs are unique; on a collision, just append -2, -3, ... rather
        // than asking the author to pick a different one themselves.
        while (docs.some((d) => d.slug === slug)) {
          slug = `${baseSlug}-${++attempt}`;
        }
        const { data, error: err } = await supabase
          .from('docs')
          .insert({
            slug,
            title: draft.title.trim(),
            category: draft.category.trim() || null,
            content: draft.content,
            created_by: userId,
            updated_by: userId,
          })
          .select('id, slug, title, category, content, created_by, updated_by, created_at, updated_at')
          .single();
        if (err) throw err;
        setDocs((prev) => [...prev, data as Doc]);
        setSelectedId((data as Doc).id);
      } else if (selected) {
        const { data, error: err } = await supabase
          .from('docs')
          .update({
            title: draft.title.trim(),
            category: draft.category.trim() || null,
            content: draft.content,
            updated_by: userId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selected.id)
          .select('id, slug, title, category, content, created_by, updated_by, created_at, updated_at')
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
    if (!window.confirm(`Delete "${selected.title}"? This can't be undone.`)) return;
    setSaving(true);
    setError('');
    const supabase = createClient();
    const { error: err } = await supabase.from('docs').delete().eq('id', selected.id);
    setSaving(false);
    if (err) {
      setError('Failed to delete. Please try again.');
      return;
    }
    setDocs((prev) => prev.filter((d) => d.id !== selected.id));
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
        <button type="button" className={styles.newBtn} onClick={startNew}>+ New Doc</button>

        {docs.length === 0 && <p className={styles.emptyNote}>No docs yet — create the first one.</p>}

        {grouped.map(([category, items]) => (
          <div key={category} className={styles.catGroup}>
            <div className={styles.catLabel}>{category}</div>
            {items.map((d) => (
              <button
                key={d.id}
                className={`${styles.docItem} ${selectedId === d.id && !isNew ? styles.docItemActive : ''}`}
                onClick={() => { setSelectedId(d.id); setEditing(false); setIsNew(false); }}
              >
                {d.title}
              </button>
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
            <label className={styles.field}>
              <span className={styles.label}>Category</span>
              <input
                className={styles.input}
                value={draft.category}
                onChange={(e) => setDraft((f) => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Creative, HR, General"
                maxLength={60}
              />
            </label>
            <MarkdownField value={draft.content} onChange={(v) => setDraft((f) => ({ ...f, content: v }))} />

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
                {selected.category && <span className={styles.catBadge}>{selected.category}</span>}
                <h1 className={styles.viewTitle}>{selected.title}</h1>
                <p className={styles.viewMeta}>
                  Updated {new Date(selected.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div className={styles.viewActions}>
                <button type="button" className={styles.editBtn} onClick={() => startEdit(selected)}>Edit</button>
                <button type="button" className={styles.deleteBtn} onClick={handleDelete} disabled={saving}>Delete</button>
              </div>
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.viewBody}>
              {selected.content.trim() ? <MarkdownContent>{selected.content}</MarkdownContent> : <p className={styles.emptyNote}>This doc has no content yet.</p>}
            </div>
          </div>
        ) : (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>📚</span>
            <p>Select a doc from the left, or create a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
