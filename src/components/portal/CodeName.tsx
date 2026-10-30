'use client';

import { useCodeStyle } from '@/lib/ui/useCodeStyle';

/** The name of the portal's own code as this device shows it: "Bytecode" or "TGcode" (for the buttons and sentences about the code a ticket, meeting or reward shows). */
export function useCodeName(): string {
  return useCodeStyle() === 'byte' ? 'Bytecode' : 'TGcode';
}
export default function CodeName() {
  return <>{useCodeName()}</>;
}
