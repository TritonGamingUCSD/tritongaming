'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

// Renders its children everywhere except on the given path prefixes. The self check-in page uses it to keep the portal's extra prompts (profile banner,
// notification bell, push offer) off a screen that should show only the check-in.
export default function HideOnPaths({ paths, children }: { paths: string[]; children: ReactNode }) {
  const pathname = usePathname();
  if (paths.some((p) => pathname.startsWith(p))) return null;
  return <>{children}</>;
}
