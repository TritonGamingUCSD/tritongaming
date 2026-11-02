'use client';

import { useEffect, useState } from 'react';
import { Share2 } from 'lucide-react';
import styles from './photo.module.css';

// Opens the phone's own share sheet (AirDrop, Messages, WhatsApp, Instagram…) with the picture itself, or with this page's link when the phone can't share a file. A computer with no share sheet gets a button that copies the link.
export function ShareButton({ token, event }: { token: string; event: string | null }) {
  const [mode, setMode] = useState<'share' | 'copy'>('copy');
  const [note, setNote] = useState('');
  useEffect(() => {
    const t = window.setTimeout(() => setMode(typeof navigator.share === 'function' ? 'share' : 'copy'), 0);
    return () => window.clearTimeout(t);
  }, []);
  const go = async () => {
    setNote('');
    const url = window.location.href;
    const title = event ? `My photo from ${event}` : 'My photo from the photo booth';
    if (mode === 'copy') {
      try {
        await navigator.clipboard.writeText(url);
        setNote('Link copied. Paste it into a message.');
      } catch {
        setNote('Couldn’t copy the link. Press and hold the picture to save it instead.');
      }
      return;
    }
    try {
      const res = await fetch(`/photos/${token}/download`);
      const blob = res.ok ? await res.blob() : null;
      const file = blob ? new File([blob], `photo-booth.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`, { type: blob.type || 'image/jpeg' }) : null;
      if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title });
      else await navigator.share({ url, title });
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') setNote('Couldn’t open sharing. Press and hold the picture to save it instead.');
    }
  };
  return (
    <div className={styles.share}>
      <button type="button" className={`${styles.shareBtn} ${styles.shareMain}`} onClick={() => void go()}>
        <Share2 size={18} aria-hidden="true" /> {mode === 'share' ? 'Share Picture' : 'Copy Link To Share'}
      </button>
      {note && (
        <p className={styles.note} role="status">
          {note}
        </p>
      )}
    </div>
  );
}
