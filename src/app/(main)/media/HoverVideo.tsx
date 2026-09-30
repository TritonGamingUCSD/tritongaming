'use client';

import { useState } from 'react';
import styles from './media.module.css';

// Plays (muted — browsers block unmuted autoplay) while hovered; reverts to
// the paused poster when the pointer leaves. Swapping the iframe's src is
// what starts/stops it, since a cross-origin YouTube iframe can't be
// controlled any other way without loading its JS API. Touch devices have
// no hover, so a tap on the wrapper toggles it instead.
export default function HoverVideo({ videoId, title }: { videoId: string; title: string }) {
  const [active, setActive] = useState(false);
  const src = `https://www.youtube.com/embed/${videoId}${active ? '?autoplay=1&mute=1&playsinline=1&rel=0' : '?rel=0'}`;

  return (
    <div
      className={styles.hoverWrap}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onTouchStart={() => setActive(true)}
    >
      <iframe
        key={active ? 'playing' : 'idle'}
        className={styles.videoEmbed}
        src={src}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
