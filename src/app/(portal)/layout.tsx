import type { Metadata } from 'next';
import { THEME_SCRIPT } from '@/lib/portal/themeScript';
import './portal-controls.css';
import { getProfile, getViewingUser } from '@/lib/core/auth';
import { PortalIdentityProvider } from '@/components/portal/PortalIdentity';

// robots.txt (see app/robots.ts) disallows /portal by path, but that only
// asks crawlers not to *fetch* it — it doesn't stop an already-indexed or
// externally-linked page from showing up in results. A metadata-level
// noindex is the actual reliable way to keep the member portal out of
// search results; it cascades to every page under this route group that
// doesn't set its own `robots` (none do).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PortalGroupLayout({ children }: { children: React.ReactNode }) {
  // The light/dark choice is settled before first paint by this script (lib/portal/themeScript.ts).
  const [profile, viewing] = await Promise.all([getProfile().catch(() => null), getViewingUser().catch(() => null)]);
  const content = profile ? <PortalIdentityProvider id={profile.id} name={profile.display_name || profile.google_first_name || 'Someone'} track={!viewing}>{children}</PortalIdentityProvider> : children;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <div className="pp-root" style={{ display: 'contents' }}>{content}</div>
    </>
  );
}
