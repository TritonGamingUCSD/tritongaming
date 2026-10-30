'use client';

import dynamic from 'next/dynamic';
import TGcode from '@/components/TGcode/TGcode';
import { useCodeStyle } from '@/lib/ui/useCodeStyle';

// The Bytecode carries Byte's drawing, so it is only loaded on a device that chose it.
const Bytecode = dynamic(() => import('@/components/Bytecode/Bytecode'), { ssr: false, loading: () => null });

// The code a person shows to be scanned (a ticket, a meeting's check-in, a reward pickup): the TGcode, or Byte's Bytecode on a device that chose it (see lib/ui/useCodeStyle).
export default function PortalCode({ payload, label }: { payload: string; label?: string }) {
  const style = useCodeStyle();
  return style === 'byte' ? <Bytecode payload={payload} label={label} /> : <TGcode payload={payload} label={label} />;
}
