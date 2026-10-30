'use client';

import ByteIcon from '@/components/Bytecode/ByteIcon';
import TGcodeIcon from '@/components/TGcode/TGcodeIcon';
import { useCodeStyle } from '@/lib/ui/useCodeStyle';

/** The icon for the portal's own code: Byte's outline when this device shows Bytecodes, the small TGcode otherwise (the same choice as PortalCode). Byte is drawn a quarter bigger: his outline is detailed, so at the same size he looks small. */
export default function CodeIcon({ size = 24 }: { size?: number }) {
  return useCodeStyle() === 'byte' ? <ByteIcon size={Math.round(size * 1.25)} /> : <TGcodeIcon size={size} />;
}
