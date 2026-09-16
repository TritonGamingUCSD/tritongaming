'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { uploadImageToStorage, uploadCroppedImage, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/imageUpload';
import ImageCropModal from '@/components/ImageCropModal/ImageCropModal';
import styles from './ImageUploadField.module.css';

const PREVIEW_SIZE: Record<Shape, { width: number; height: number }> = {
  circle: { width: 96, height: 96 },
  square: { width: 80, height: 80 },
  wide: { width: 160, height: 100 },
};

type Shape = 'circle' | 'square' | 'wide';

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
        crop: shape === 'wide' ? 'none' : 'square',
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
  const { width, height } = PREVIEW_SIZE[shape];
  const displaySrc = value || fallbackPreview;

  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>

      {displaySrc ? (
        <div className={styles.wrap}>
          <Image src={displaySrc} alt="" width={width} height={height} unoptimized referrerPolicy="no-referrer" className={previewClass} />
          <div className={styles.actions}>
            <button type="button" className={styles.replaceBtn} onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Replace'}
            </button>
            {value && (
              <button type="button" className={styles.removeBtn} onClick={() => onChange('')} disabled={uploading}>
                Remove
              </button>
            )}
          </div>
        </div>
      ) : (
        <button type="button" className={styles.dropzone} onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? 'Uploading…' : `Click to upload ${label.toLowerCase()}`}
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
      {hint && <span className={styles.hint}>{hint}</span>}

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
