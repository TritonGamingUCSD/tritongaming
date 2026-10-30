'use client';

import type { ReactNode } from 'react';
import ByteMini from '@/components/Bytecode/ByteMini';
import { useCodeStyle } from '@/lib/ui/useCodeStyle';

/** The picture of an empty list: the icon it has always had, or, on a device that shows Bytecodes, Byte asleep (his eyes shut, a few z's drifting up). */
export default function EmptyArt({ icon, size = 96 }: { icon: ReactNode; size?: number }) {
  return useCodeStyle() === 'byte' ? (
    <span style={{ display: 'block', width: size }}>
      <ByteMini pose="sleep" />
    </span>
  ) : (
    icon
  );
}
