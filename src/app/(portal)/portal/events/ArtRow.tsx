'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import ImageUploadField from '@/components/ImageUploadField/ImageUploadField';
import type { AssetCredit } from '@/lib/eventTheme';
import styles from './eventextras.module.css';

// One picture and who made it, on a single compact row: a small thumbnail (click it to replace, x in its corner to remove), then the artist's
// name and a link to their portfolio or social page stacked beside it. Used for posters and stickers.
export default function ArtRow({
  label, value, onChange, shape, maxDimension, credit, onCredit, grip, onRemoveEmpty, extra,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  shape: 'wide' | 'logo';
  maxDimension: number;
  credit?: AssetCredit;
  onCredit: (patch: Partial<AssetCredit>) => void;
  grip?: ReactNode;
  onRemoveEmpty?: () => void;
  extra?: string;
}) {
  return (
    <>
      {grip}
      <div className={styles.artThumb}>
        <ImageUploadField label={label} value={value} onChange={onChange} bucket="event-flyers" shape={shape} maxDimension={maxDimension} compact />
      </div>
      <div className={styles.artFields}>
        {extra && <span className={styles.artTag}>{extra}</span>}
        <input className={styles.artInput} value={credit?.name ?? ''} onChange={(e) => onCredit({ name: e.target.value })} maxLength={60} placeholder="Made by" aria-label={`${label}: who made it`} disabled={!value} />
        <input className={styles.artInput} type="url" value={credit?.link ?? ''} onChange={(e) => onCredit({ link: e.target.value })} placeholder="Their portfolio or social link" aria-label={`${label}: link to their portfolio or social page`} disabled={!value} />
      </div>
      {!value && onRemoveEmpty && <button type="button" className={styles.remove} onClick={onRemoveEmpty} aria-label={`Remove empty ${label.toLowerCase()}`}><X size={14} aria-hidden="true" /></button>}
    </>
  );
}
