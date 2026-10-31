'use client';

import { CODE_STYLE_NAMES, type CodeUse } from '@/lib/portal/siteSettings';
import { useCodeStyle } from '@/lib/ui/useCodeStyle';

/** The name of the portal's own code as this device shows it: "Bytecode", "TGcode" or "QR code" (for the buttons and sentences about the code a ticket, meeting or reward shows). */
export function useCodeName(use?: CodeUse): string {
  return CODE_STYLE_NAMES[useCodeStyle(use)];
}
export default function CodeName({ use }: { use?: CodeUse }) {
  return <>{useCodeName(use)}</>;
}
