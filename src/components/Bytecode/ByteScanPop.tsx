'use client';

import { useEffect } from 'react';
import { playPop } from '@/lib/ui/popSound';
import ByteWink from './ByteWink';
import styles from './ByteScanPop.module.css';

// Byte on the scanner's camera view after a good scan of a Bytecode: he grows out of the code (the box this sits in is already placed over the code), hops, winks, and a soft pop
// plays as he lands. It is only decoration: the result sheet and the ring carry on exactly as for any scan, and tapping Scan Next ends it at once.
export default function ByteScanPop({ className = '' }: { className?: string }) {
  useEffect(() => {
    const id = window.setTimeout(playPop, 140);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <span className={`${styles.grow} ${className}`}>
      <ByteWink entrance={false} label="Byte winks: scanned" />
    </span>
  );
}
