'use client';

import { useCallback, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import styles from './ImageCropModal.module.css';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function cropToBlob(imageSrc: string, area: Area, outputSize: number): Promise<Blob> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, outputSize, outputSize);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Crop failed'))), 'image/webp', 0.85);
  });
}

// A round, zoomable/pannable crop step shown between picking a file and
// uploading it — lets someone recenter a photo instead of getting stuck
// with whatever an automatic center-crop picked.
export default function ImageCropModal({
  file,
  outputSize = 512,
  onCancel,
  onConfirm,
}: {
  file: File;
  outputSize?: number;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const [imageSrc] = useState(() => URL.createObjectURL(file));
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  function cleanup() {
    URL.revokeObjectURL(imageSrc);
  }

  async function handleConfirm() {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const blob = await cropToBlob(imageSrc, croppedAreaPixels, outputSize);
      onConfirm(blob);
    } finally {
      setProcessing(false);
      cleanup();
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h3 className={styles.title}>Adjust Photo</h3>

        <div className={styles.cropArea}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>

        <label className={styles.zoomRow}>
          <span className={styles.zoomLabel}>Zoom</span>
          <input
            type="range"
            className={styles.zoomSlider}
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>

        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={() => { cleanup(); onCancel(); }} disabled={processing}>
            Cancel
          </button>
          <button type="button" className={styles.confirmBtn} onClick={handleConfirm} disabled={processing || !croppedAreaPixels}>
            {processing ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
