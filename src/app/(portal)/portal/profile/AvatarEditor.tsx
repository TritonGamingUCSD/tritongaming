'use client';

import Notice from '@/components/ui/Notice';
import IconButton from '@/components/ui/IconButton';
import { useState } from 'react';
import Image from 'next/image';
import { Camera } from 'lucide-react';
import { uploadImageToStorage, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/storage/imageUpload';
import PictureDialog from '@/components/ui/PictureDialog';
import styles from './avatarEditor.module.css';

// Profile-picture editor: a big round preview you can click or drop a photo
// onto, with the source (custom vs. Google) spelled out underneath. Same
// upload + crop pipeline as ImageUploadField, just a purpose-built layout.
export default function AvatarEditor({ value, onChange, fallback, bucket, pathPrefix, initial }: {
  value: string;
  onChange: (url: string) => void;
  /** Google-synced picture shown when there's no custom one. */
  fallback?: string;
  bucket: string;
  pathPrefix?: string;
  initial: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);

  async function handleFile(file: File) {
    setError('');
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { setError('Use a PNG, JPEG, WEBP, or GIF image.'); return; }
    if (file.size > MAX_IMAGE_BYTES) { setError('Image must be under 8MB.'); return; }
    setUploading(true);
    try {
      onChange(await uploadImageToStorage(bucket, file, { maxDimension: 512, crop: 'square', pathPrefix }));
    } catch { setError('Upload failed. Please try again.'); } finally { setUploading(false); }
  }

  const src = value || fallback;

  return (
    <div className={styles.card}>
      <div className={styles.holder}>
      <button
        type="button"
        className={styles.avatar}
        onClick={() => setPicking(true)}
        disabled={uploading}
        aria-label="Change profile picture"
      >
        {src ? (
          <Image src={src} alt="" width={144} height={144} unoptimized referrerPolicy="no-referrer" className={styles.img} />
        ) : (
          <span className={styles.initial}>{initial}</span>
        )}
        <span className={styles.overlay}>
          <Camera size={22} strokeWidth={1.75} aria-hidden="true" />
          <span>{uploading ? 'Uploading…' : 'Change'}</span>
        </span>
      </button>
      {value && (
        <IconButton kind="remove" size="sm" className={styles.remove} onClick={() => onChange('')} disabled={uploading} label={fallback ? 'Remove my photo and use my Google photo' : 'Remove my photo'} />
      )}
      </div>

      <p className={styles.hint}>Click the circle to upload, drop or paste a picture.</p>
      {error && <Notice tone="error">{error}</Notice>}

      {picking && (
        <PictureDialog title="Profile picture" aspect={1} round current={src || undefined} accept={ALLOWED_IMAGE_TYPES.join(',')} hint="PNG, JPG, WebP or GIF, under 8 MB"
          onUse={(f) => { void handleFile(f[0]); }} onRemove={value ? () => onChange('') : undefined} onClose={() => setPicking(false)} />
      )}

    </div>
  );
}
