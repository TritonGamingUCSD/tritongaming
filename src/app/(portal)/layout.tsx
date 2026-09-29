import type { Metadata } from 'next';

// robots.txt (see app/robots.ts) disallows /portal by path, but that only
// asks crawlers not to *fetch* it — it doesn't stop an already-indexed or
// externally-linked page from showing up in results. A metadata-level
// noindex is the actual reliable way to keep the member portal out of
// search results; it cascades to every page under this route group that
// doesn't set its own `robots` (none do).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PortalGroupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
