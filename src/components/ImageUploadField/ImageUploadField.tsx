'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { uploadImageToStorage, uploadCroppedImage, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/storage/imageUpload';
import ImageCropModal from '@/components/ImageCropModal/ImageCropModal';
import styles from './ImageUploadField.module.css';
import { Camera, X } from 'lucide-react';

const PREVIEW_SIZE: Record<Shape, { width: number; height: number }> = {
  circle: { width: 96, height: 96 },
  square: { width: 80, height: 80 },
  logo: { width: 80, height: 80 },
  wide: { width: 160, height: 100 },
};

// 'logo' previews the same square box as 'square' but pads onto a
// transparent square canvas instead of center-cropping (see
// lib/imageUpload's 'pad' crop mode) — for logos/marks that need to keep
// their full content, unlike a face photo where cropping to the subject is
// actually what you want.
type Shape = 'circle' | 'square' | 'logo' | 'wide';

export default function ImageUploadField({
  label,
  value,
  onChange,
  bucket,
  pathPrefix,
  shape = 'square',
  maxDimension = 1600,
  hint,
  fallbackPreview,
  interactiveCrop = false,
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  bucket: string;
  pathPrefix?: string;
  shape?: Shape;
  maxDimension?: number;
  hint?: string;
  /** Shown in place of an empty value (e.g. a synced Google avatar) — Remove is hidden while it's the only thing displayed, since there's nothing to clear back to. */
  fallbackPreview?: string;
  /** Opens a zoomable/pannable round-crop step before uploading, instead of an automatic center-crop. Ignored for GIFs (cropping would flatten the animation). */
  interactiveCrop?: boolean;
  /** A small thumbnail row (for lists of pictures): no label or hint on screen, a short "Upload" button. The label still names the controls for screen readers. */
  compact?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError('');

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('Please choose a PNG, JPEG, WEBP, or GIF image.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Image must be under 8MB.');
      return;
    }

    if (interactiveCrop && file.type !== 'image/gif') {
      setPendingFile(file);
      return;
    }

    setUploading(true);
    try {
      const url = await uploadImageToStorage(bucket, file, {
        maxDimension,
        crop: shape === 'wide' ? 'none' : shape === 'logo' ? 'pad' : 'square',
        pathPrefix,
      });
      onChange(url);
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleCropConfirm(blob: Blob) {
    setPendingFile(null);
    setUploading(true);
    try {
      const url = await uploadCroppedImage(bucket, blob, pathPrefix);
      onChange(url);
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  const previewClass = shape === 'circle' ? styles.previewCircle : shape === 'wide' ? styles.previewWide : styles.previewSquare;
  const { width, height } = compact ? (shape === 'wide' ? { width: 84, height: 56 } : { width: 56, height: 56 }) : PREVIEW_SIZE[shape];
  const displaySrc = value || fallbackPreview;

  return (
    <div className={`${styles.field} ${compact ? styles.compact : ''}`}>
      {!compact && <span className={styles.label}>{label}</span>}

      {displaySrc ? (
        <div className={styles.wrap}>
          {/* The picture itself is the replace button; the small x in its corner removes it. */}
          <button type="button" className={`${styles.preview} ${shape === 'circle' ? styles.previewRound : ''}`} onClick={() => inputRef.current?.click()} disabled={uploading} aria-label={`Replace ${label.toLowerCase()}`}>
            <Image src={displaySrc} alt="" width={width} height={height} unoptimized referrerPolicy="no-referrer" className={previewClass} />
            <span className={styles.overlay} aria-hidden="true">{uploading ? 'Uploading…' : <><Camera size={16} /> Replace</>}</span>
          </button>
          {value && (
            <button type="button" className={styles.removeChip} onClick={() => onChange('')} disabled={uploading} aria-label={`Remove ${label.toLowerCase()}`} title="Remove">
              <X size={12} strokeWidth={2.5} aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        <button type="button" className={styles.dropzone} onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? 'Uploading…' : compact ? 'Upload' : `Click to upload ${label.toLowerCase()}`}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(',')}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
        hidden
      />

      {error && <span className={styles.hint} style={{ color: '#fca5a5' }}>{error}</span>}
      {hint && !compact && <span className={styles.hint}>{hint}</span>}

      {pendingFile && (
        <ImageCropModal
          file={pendingFile}
          outputSize={maxDimension}
          onCancel={() => setPendingFile(null)}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}
