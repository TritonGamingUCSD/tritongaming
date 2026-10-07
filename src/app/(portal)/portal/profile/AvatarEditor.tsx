'use client';

import IconButton from '@/components/ui/IconButton';
import { useRef, useState } from 'react';
import Image from 'next/image';
import { Camera } from 'lucide-react';
import { uploadCroppedImage, uploadImageToStorage, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/storage/imageUpload';
import ImageCropModal from '@/components/ImageCropModal/ImageCropModal';
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
  const [dragging, setDragging] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError('');
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { setError('Use a PNG, JPEG, WEBP, or GIF image.'); return; }
    if (file.size > MAX_IMAGE_BYTES) { setError('Image must be under 8MB.'); return; }
    if (file.type !== 'image/gif') { setPendingFile(file); return; }
    setUploading(true);
    try {
      onChange(await uploadImageToStorage(bucket, file, { maxDimension: 512, crop: 'square', pathPrefix }));
    } catch { setError('Upload failed. Please try again.'); } finally { setUploading(false); }
  }

  async function handleCrop(blob: Blob) {
    setPendingFile(null);
    setUploading(true);
    try { onChange(await uploadCroppedImage(bucket, blob, pathPrefix)); }
    catch { setError('Upload failed. Please try again.'); }
    finally { setUploading(false); }
  }

  const src = value || fallback;

  return (
    <div className={styles.card}>
      <div className={styles.holder}>
      <button
        type="button"
        className={`${styles.avatar} ${dragging ? styles.dragging : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
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
          <span>{uploading ? 'Uploading…' : dragging ? 'Drop it' : 'Change'}</span>
        </span>
      </button>
      {value && (
        <IconButton kind="remove" size="sm" className={styles.remove} onClick={() => onChange('')} disabled={uploading} label={fallback ? 'Remove my photo and use my Google photo' : 'Remove my photo'} />
      )}
      </div>

      <p className={styles.hint}>Click the circle or drop a picture on it.</p>
      {error && <p className={styles.error}>{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(',')}
        hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />

      {pendingFile && <ImageCropModal file={pendingFile} outputSize={512} onCancel={() => setPendingFile(null)} onConfirm={handleCrop} />}
    </div>
  );
}
