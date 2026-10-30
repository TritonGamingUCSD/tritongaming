'use client';

import { CODE_STYLE_NAMES } from '@/lib/portal/siteSettings';
import { useCodeStyle } from '@/lib/ui/useCodeStyle';

/** The name of the portal's own code as this device shows it: "Bytecode", "TGcode" or "QR code" (for the buttons and sentences about the code a ticket, meeting or reward shows). */
export function useCodeName(): string {
  return CODE_STYLE_NAMES[useCodeStyle()];
}
export default function CodeName() {
  return <>{useCodeName()}</>;
}
