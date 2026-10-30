'use client';

import { useEffect } from 'react';
import { playPop } from '@/lib/ui/popSound';
import ByteWink from './ByteWink';
import styles from './ByteScanPop.module.css';

// Byte on the scanner's camera view after a good scan of a Bytecode: he grows out of the code (the box this sits in is already placed over the code), hops, winks, and a soft pop
// plays as he lands. A code held at an angle: he grows out at the code's own tilt (`tilt`, degrees from upright) and turns feet-down as he jumps. It is only decoration: the result sheet and the ring carry on exactly as for any scan, and tapping Scan Next ends it at once.
export default function ByteScanPop({ className = '', tilt = 0 }: { className?: string; tilt?: number }) {
  useEffect(() => {
    const id = window.setTimeout(playPop, 140);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <span className={`${styles.grow} ${className}`} style={{ '--bs-tilt': `${((((tilt + 180) % 360) + 360) % 360) - 180}deg` } as React.CSSProperties}>
      <ByteWink entrance={false} label="Byte winks: scanned" />
    </span>
  );
}
