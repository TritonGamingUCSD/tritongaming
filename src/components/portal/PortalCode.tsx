'use client';

import dynamic from 'next/dynamic';
import TGcode from '@/components/TGcode/TGcode';
import type { CodeUse } from '@/lib/portal/siteSettings';
import { useCodeStyle } from '@/lib/ui/useCodeStyle';

// The Bytecode carries Byte's drawing, so it is only loaded on a device that chose it.
const Bytecode = dynamic(() => import('@/components/Bytecode/Bytecode'), { ssr: false, loading: () => null });
const PortalQr = dynamic(() => import('./PortalQr'), { ssr: false, loading: () => null });

// The code a person shows to be scanned (a ticket, a meeting's check-in, a reward pickup): the TGcode, Byte's Bytecode or a QR code, as the site (or this device) chose (see lib/ui/useCodeStyle).
export default function PortalCode({ payload, label, use }: { payload: string; label?: string; use: CodeUse }) {
  const style = useCodeStyle(use);
  if (style === 'byte') return <Bytecode payload={payload} label={label} />;
  if (style === 'qr') return <PortalQr payload={payload} label={label} />;
  return <TGcode payload={payload} label={label} />;
}
