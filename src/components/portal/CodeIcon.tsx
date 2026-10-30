'use client';

import ByteIcon from '@/components/Bytecode/ByteIcon';
import TGcodeIcon from '@/components/TGcode/TGcodeIcon';
import { useCodeStyle } from '@/lib/ui/useCodeStyle';

/** The icon for the portal's own code: Byte's outline when this device shows Bytecodes, the small TGcode otherwise (the same choice as PortalCode). */
export default function CodeIcon({ size = 24 }: { size?: number }) {
  return useCodeStyle() === 'byte' ? <ByteIcon size={size} /> : <TGcodeIcon size={size} />;
}
