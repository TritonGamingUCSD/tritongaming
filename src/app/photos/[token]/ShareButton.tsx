'use client';

import { useEffect, useState } from 'react';
import { Copy, Share2 } from 'lucide-react';
import styles from './photo.module.css';

// Two ways to pass the picture on. Share Picture opens the phone's own share sheet (AirDrop, Messages, WhatsApp, Instagram, Save Image…) with the picture itself, or with this page's link when the phone can't share a file; a computer
// with no share sheet only gets Copy Link. Copy Link copies this page's address.
export function ShareButton({ token, event }: { token: string; event: string | null }) {
  const [canShare, setCanShare] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => {
    const t = window.setTimeout(() => setCanShare(typeof navigator.share === 'function'), 0);
    return () => window.clearTimeout(t);
  }, []);
  const share = async () => {
    setNote('');
    const url = window.location.href;
    const title = event ? `My photo from ${event}` : 'My photo from the photo booth';
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
  const copy = async () => {
    setNote('');
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNote('Link copied. Paste it into a message.');
    } catch {
      setNote('Couldn’t copy the link. Press and hold the picture to save it instead.');
    }
  };
  return (
    <div className={styles.share}>
      {canShare && (
        <button type="button" className={`${styles.shareBtn} ${styles.shareMain}`} onClick={() => void share()}>
          <Share2 size={18} aria-hidden="true" /> Share Picture
        </button>
      )}
      <button type="button" className={`${styles.shareBtn} ${styles.shareMain}`} onClick={() => void copy()}>
        <Copy size={18} aria-hidden="true" /> Copy Link
      </button>
      {note && (
        <p className={styles.note} role="status">
          {note}
        </p>
      )}
    </div>
  );
}
