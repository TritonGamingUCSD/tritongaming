'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import type { PhotoAlbumEntry } from '@/types/database';
import { useDragReorder } from '@/lib/useDragReorder';
import styles from './PhotoAlbumsField.module.css';

// An event can have more than one photo album (e.g. a day-1/day-2 split
// for a multi-day LAN) — this collects {title, url} pairs, in display
// order, same shape as the portal's standalone photo_albums table and the
// public Media page's media.albums block.
export default function PhotoAlbumsField({
  value,
  onChange,
  hint = 'Google Photos album links, shown under "After the Event" once the event has passed.',
}: {
  value: PhotoAlbumEntry[];
  onChange: (value: PhotoAlbumEntry[]) => void;
  hint?: string;
}) {
  const [draftTitle, setDraftTitle] = useState('');
  const [draftUrl, setDraftUrl] = useState('');

  function handleAdd() {
    const title = draftTitle.trim();
    const url = draftUrl.trim();
    if (!title || !url) return;
    onChange([...value, { title, url }]);
    setDraftTitle('');
    setDraftUrl('');
  }

  function handleRemove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  const { dragIndex, overIndex, dragHandleProps, dropTargetProps } = useDragReorder(value, onChange);

  function handleMove(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className={styles.field}>
      <span className={styles.label}>Photo Albums</span>

      {value.length > 0 && (
        <ul className={styles.albumList}>
          {value.map((album, i) => (
            <li
              key={`${album.url}-${i}`}
              className={`${styles.albumRow} ${dragIndex === i ? styles.rowDragging : ''} ${overIndex === i && dragIndex !== i ? styles.rowDragOver : ''}`}
              {...dropTargetProps(i)}
            >
              <span className={styles.dragHandle} {...dragHandleProps(i)} aria-label="Drag to reorder">
                <GripVertical size={14} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className={styles.albumTitle}>{album.title}</span>
              <span className={styles.albumUrl}>{album.url}</span>
              <div className={styles.albumActions}>
                <button type="button" className={styles.moveBtn} disabled={i === 0}
                  onClick={() => handleMove(i, -1)} aria-label="Move up">
                  <ChevronUp size={14} strokeWidth={2} />
                </button>
                <button type="button" className={styles.moveBtn} disabled={i === value.length - 1}
                  onClick={() => handleMove(i, 1)} aria-label="Move down">
                  <ChevronDown size={14} strokeWidth={2} />
                </button>
                <button type="button" className={styles.removeBtn} onClick={() => handleRemove(i)}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.addRow}>
        <input
          className={styles.input}
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder="Album title (e.g. Day 1 Photos)"
        />
        <input
          className={styles.input}
          type="url"
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          placeholder="https://photos.google.com/…"
        />
        <button type="button" className={styles.addBtn} onClick={handleAdd} disabled={!draftTitle.trim() || !draftUrl.trim()}>Add</button>
      </div>
      <span className={styles.hint}>{hint}</span>
    </div>
  );
}
