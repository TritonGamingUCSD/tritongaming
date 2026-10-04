'use client';

import Notice from '@/components/ui/Notice';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { confirmHold } from '@/lib/confirmHold';
import { showToast } from '@/lib/toast';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';
import { useState } from 'react';
import { Plus, ExternalLink, Trash2, Image as ImageIcon, GripVertical } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PACIFIC_TZ } from '@/lib/timezone';
import { useDragReorder } from '@/lib/useDragReorder';
import IconButton from '@/components/ui/IconButton';
import styles from './albums.module.css';
import SectionHeader from '@/components/ui/SectionHeader';

interface Creator { display_name: string | null; }

interface AlbumRow {
  id: string;
  title: string;
  url: string;
  created_by: string | null;
  created_at: string;
  sort_order: number;
  creator: Creator | Creator[] | null;
}

const EMPTY_DRAFT = { title: '', url: '' };

// Used to embed this via <iframe> — Google Photos sends
// X-Frame-Options: SAMEORIGIN on every share-album page, so that always
// failed ("refused to connect"), not just for some albums. Tried an Open
// Graph cover-photo preview card next (the same fix used on the public
// event page — see src/lib/googlePhotosAlbum.ts), but a card full of
// someone else's cropped photo read as visually noisy sitting in a list
// of plain rows — a plain link out is what's left.
export default function PhotoAlbumsSectionContent({ albums: initial, canManage }: { albums: AlbumRow[]; canManage: boolean }) {
  const [albums, setAlbums] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  // The add-album form only counts while it's open.
  useUnsavedChanges(adding ? draft : EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const title = draft.title.trim();
    const url = draft.url.trim();
    if (!title || !url) return;
    setSaving(true);
    setError('');
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    // New albums show up first, same as the old created_at-desc default —
    // one less than the current lowest sort_order keeps it at the top of
    // the ascending-sort list without needing to renumber anything else.
    const nextSortOrder = (albums.length ? Math.min(...albums.map((a) => a.sort_order)) : 0) - 1;
    const { data, error: err } = await supabase
      .from('photo_albums')
      .insert({ title, url, created_by: user?.id ?? null, sort_order: nextSortOrder })
      .select('id, title, url, created_by, created_at, sort_order, creator:profiles(display_name)')
      .single();
    setSaving(false);
    if (err || !data) {
      setError('Failed to add album. Please try again.');
      return;
    }
    setAlbums((prev) => [data as AlbumRow, ...prev]);
    setDraft(EMPTY_DRAFT);
    setAdding(false);
    showToast('Album added');
  }

  // Re-numbers sort_order to match a new array order (drag-and-drop can
  // move a card anywhere, not just one slot, so a plain adjacent swap isn't
  // enough) and persists every row. Updates local state immediately so the
  // grid re-renders in the new order without waiting on a refetch; rolls
  // back on failure. The list is a curated handful of albums, not
  // thousands, so renumbering all of them on every move is cheap.
  async function persistReorder(next: AlbumRow[]) {
    const previous = albums;
    const renumbered = next.map((a, i) => ({ ...a, sort_order: i }));
    setAlbums(renumbered);
    setError('');
    const supabase = createClient();
    const results = await Promise.all(
      renumbered.map((a) => supabase.from('photo_albums').update({ sort_order: a.sort_order }).eq('id', a.id))
    );
    if (results.some((r) => r.error)) {
      setError('Failed to reorder albums. Please try again.');
      setAlbums(previous);
    } else {
      showToast('Album order saved');
    }
  }

  const { dragIndex, overIndex, dragHandleProps, dropTargetProps } = useDragReorder(albums, persistReorder);

  async function handleDelete(id: string) {
    if (!(await confirmHold({ title: 'Remove this album?', message: 'This only removes it from the portal, not the Google Photos album itself.', confirmLabel: 'Hold to remove' }))) return;
    setBusyId(id);
    setError('');
    const supabase = createClient();
    const { error: err } = await supabase.from('photo_albums').delete().eq('id', id);
    setBusyId(null);
    if (err) {
      setError('Failed to remove album. Please try again.');
      return;
    }
    setAlbums((prev) => prev.filter((a) => a.id !== id));
    showToast('Album removed');
  }

  return (
    <div className={styles.page}>
      <SectionHeader title="Photo Albums" sub="Google Photos albums from past events" actions={canManage ? (
        <button type="button" className={styles.addBtn} onClick={() => setAdding((a) => !a)}>
          <Plus size={15} strokeWidth={2} aria-hidden="true" /> Add Album
        </button>
      ) : undefined} />

      {adding && (
        <form className={styles.addForm} onSubmit={handleAdd}>
          <Input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="Album title (e.g. Fall 2025 Kickoff)"
            maxLength={120}
            autoFocus
          />
          <Input
            type="url"
            value={draft.url}
            onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
            placeholder="Paste a Google Photos album share link…"
          />
          <div className={styles.addFormActions}>
            <Button variant="ghost" onClick={() => { setAdding(false); setDraft(EMPTY_DRAFT); }} disabled={saving}>Cancel</Button>
            <Button type="submit" loading={saving} disabled={!draft.title.trim() || !draft.url.trim()}>
              {saving ? 'Adding…' : 'Add'}
            </Button>
          </div>
        </form>
      )}

      {error && <Notice tone="error">{error}</Notice>}

      {albums.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}><ImageIcon size={32} strokeWidth={1.25} aria-hidden="true" /></span>
          <p>No albums yet.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {albums.map((a, i) => {
            const creator = Array.isArray(a.creator) ? a.creator[0] : a.creator;
            return (
              <div
                key={a.id}
                className={`${styles.card} ${dragIndex === i ? styles.rowDragging : ''} ${overIndex === i && dragIndex !== i ? styles.rowDragOver : ''}`}
                {...(canManage ? dropTargetProps(i) : {})}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.cardHeaderLeft}>
                    {canManage && (
                      <span className={styles.dragHandle} {...dragHandleProps(i)} aria-label={`Drag to reorder ${a.title}`}>
                        <GripVertical size={14} strokeWidth={1.75} aria-hidden="true" />
                      </span>
                    )}
                    <div>
                      <h2 className={styles.cardTitle}>{a.title}</h2>
                      <p className={styles.cardMeta}>
                        Added {new Date(a.created_at).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, month: 'short', day: 'numeric', year: 'numeric' })}
                        {creator?.display_name ? ` by ${creator.display_name}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className={styles.cardActions}>
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className={styles.openLink}>
                      Open <ExternalLink size={12} strokeWidth={1.75} aria-hidden="true" />
                    </a>
                    {canManage && (
                      <>
                        <IconButton kind="delete" label={`Delete ${a.title}`} onClick={() => handleDelete(a.id)} disabled={busyId === a.id} />
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
