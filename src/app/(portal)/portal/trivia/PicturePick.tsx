'use client';

import { useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import PictureDialog from '@/components/ui/PictureDialog';
import { compressImage } from '@/lib/ui/compressImage';
import styles from './trivia.module.css';

export const PICTURE_PROBLEM = 'That picture couldn’t be shrunk small enough. Try another picture, or a simpler one.';

// Choosing a picture for a question: a small thumbnail with a button to choose or change it and one to remove it. It only hands back the shrunk WebP file (or nothing): the caller decides when to upload.
export function PicturePick({ url, label, disabled, busy, onPick, onClear, onProblem }: { url: string; label: string; disabled?: boolean; busy?: boolean; onPick: (blob: Blob) => void; onClear?: () => void; onProblem: (message: string) => void }) {
  const [working, setWorking] = useState(false);
  const choose = async (file: File | undefined) => {
    if (!file) return;
    setWorking(true);
    const blob = await compressImage(file);
    setWorking(false);
    if (blob) onPick(blob); else onProblem(PICTURE_PROBLEM);
  };
  const [picking, setPicking] = useState(false);
  return (
    <span className={styles.pic}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.picThumb} src={url} alt={`Picture for ${label}`} loading="lazy" />
      ) : <span className={styles.picNone}>None</span>}
      {!disabled && (
        <>
          <button type="button" className={styles.picBtn} disabled={working || busy} aria-label={url ? `Change the picture of ${label}` : `Add a picture to ${label}`} title={url ? 'Change the picture' : 'Add a picture'} onClick={() => setPicking(true)}><ImagePlus size={15} /></button>
          {url && onClear && <button type="button" className={styles.picBtn} disabled={working || busy} aria-label={`Remove the picture of ${label}`} title="Remove the picture" onClick={onClear}><X size={15} /></button>}
        </>
      )}
      {picking && <PictureDialog title={`Picture for ${label}`} current={url || undefined} hint="It is shrunk for you" onUse={(f) => choose(f[0])} onRemove={url && onClear ? onClear : undefined} onClose={() => setPicking(false)} />}
    </span>
  );
}
