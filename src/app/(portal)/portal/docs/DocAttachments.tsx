'use client';

import { useRef, useState } from 'react';
import { Image as ImageIcon, Paperclip } from 'lucide-react';
import Notice from '@/components/ui/Notice';
import IconButton from '@/components/ui/IconButton';
import { uploadFileToStorage, MAX_FILE_BYTES } from '@/lib/storage/fileUpload';
import { uploadImageToStorage } from '@/lib/storage/imageUpload';
import type { DocAttachment } from '@/types/database';
import styles from './docs.module.css';

// Attachments are added and removed one at a time and saved right away (not part of the draft), so two people attaching files never wipe each other's.
export function AttachmentsEditor({ value, busy, onAdd, onRemove }: { value: DocAttachment[]; busy: boolean; onAdd: (a: DocAttachment) => Promise<void>; onRemove: (url: string) => Promise<void> }) {
  const [uploading, setUploading] = useState(false);
  const [albumUrl, setAlbumUrl] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function pick(file: File) {
    setError('');
    if (file.size > MAX_FILE_BYTES) { setError('File must be under 20MB.'); return; }
    setUploading(true);
    try {
      const isPhoto = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type);
      const url = isPhoto ? await uploadImageToStorage('doc-attachments', file, { maxDimension: 2400, quality: 0.85 }) : await uploadFileToStorage('doc-attachments', file);
      const name = isPhoto && url.endsWith('.webp') ? file.name.replace(/\.[^.]+$/, '') + '.webp' : file.name;
      await onAdd({ name, url, kind: 'file' });
    } catch { setError('Upload failed. Please try again.'); } finally { setUploading(false); }
  }

  return (
    <div className={styles.field}>
      <span className={styles.label}>Attachments <span className={styles.labelHint}>Saved right away, not part of the draft</span></span>
      {value.length > 0 && (
        <ul className={styles.attachList}>
          {value.map((a) => (
            <li key={a.url} className={styles.attachRow}>
              <span className={styles.attachIcon} aria-hidden="true">{a.kind === 'google_album' ? <ImageIcon size={16} strokeWidth={1.5} /> : <Paperclip size={16} strokeWidth={1.5} />}</span>
              <span className={styles.attachName}>{a.name}</span>
              <IconButton kind="remove" size="sm" label={`Remove ${a.name}`} onClick={() => void onRemove(a.url)} />
            </li>
          ))}
        </ul>
      )}
      <div className={styles.attachAddRow}>
        <button type="button" className={styles.attachUploadBtn} onClick={() => fileRef.current?.click()} disabled={uploading || busy}>{uploading ? 'Uploading…' : '+ Add File'}</button>
        <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); e.target.value = ''; }} />
      </div>
      <div className={styles.attachAddRow}>
        <input className={styles.input} type="url" value={albumUrl} onChange={(e) => setAlbumUrl(e.target.value)} placeholder="Paste a Google Photos album link…" aria-label="Photo album link" />
        <button type="button" className={styles.attachAddBtn} disabled={!albumUrl.trim() || busy} onClick={async () => { const u = albumUrl.trim(); setAlbumUrl(''); await onAdd({ name: 'Photo Album', url: u, kind: 'google_album' }); }}>Add</button>
      </div>
      {error && <Notice tone="error" compact>{error}</Notice>}
    </div>
  );
}

export function AttachmentsView({ attachments }: { attachments: DocAttachment[] }) {
  if (attachments.length === 0) return null;
  return (
    <section className={styles.viewAttachments}>
      <h2 className={styles.attachHeading}>Attachments</h2>
      <div className={styles.attachCards}>
        {attachments.map((a) => (
          <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" className={styles.attachCard}>
            <span className={styles.attachCardIcon} aria-hidden="true">{a.kind === 'google_album' ? <ImageIcon size={18} strokeWidth={1.5} /> : <Paperclip size={18} strokeWidth={1.5} />}</span>
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
