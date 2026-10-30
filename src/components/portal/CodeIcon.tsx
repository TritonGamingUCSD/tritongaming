'use client';

import { QrCode } from 'lucide-react';
import ByteIcon from '@/components/Bytecode/ByteIcon';
import TGcodeIcon from '@/components/TGcode/TGcodeIcon';
import { useCodeStyle } from '@/lib/ui/useCodeStyle';

/** The icon for the portal's own code: Byte's outline for Bytecodes, a QR icon for QR codes, the small TGcode otherwise (the same choice as PortalCode). Byte is drawn a quarter bigger: his outline is detailed, so at the same size he looks small. */
export default function CodeIcon({ size = 24 }: { size?: number }) {
  const style = useCodeStyle();
  if (style === 'byte') return <ByteIcon size={Math.round(size * 1.25)} />;
  if (style === 'qr') return <QrCode size={size} strokeWidth={2} aria-hidden="true" />;
  return <TGcodeIcon size={size} />;
}
