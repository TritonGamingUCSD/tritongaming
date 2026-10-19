import type { Metadata } from 'next';
import PortalThemeInit from '@/components/portal/PortalThemeInit';
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
  // The portal is the one part of the site that can be added to a home screen / installed as an app (Android's "Install app", iOS's "Add to Home Screen"): the manifest (public/portal.webmanifest:
  // name, logo icons, opens /portal) and iOS's standalone flags are only linked from here, never from the public pages.
  manifest: '/portal.webmanifest',
  appleWebApp: { capable: true, title: 'TG Portal', statusBarStyle: 'default' },
  icons: { apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }] },
};

export default async function PortalGroupLayout({ children }: { children: React.ReactNode }) {
  // The light/dark choice is settled before first paint by the root layout's script, and by PortalThemeInit when arriving without a full load (lib/portal/themeScript.ts).
  const [profile, viewing] = await Promise.all([getProfile().catch(() => null), getViewingUser().catch(() => null)]);
  const content = profile ? <PortalIdentityProvider id={profile.id} name={profile.display_name || profile.google_first_name || 'Someone'} track={!viewing}>{children}</PortalIdentityProvider> : children;
  return (
    <>
      <PortalThemeInit />
      <div className="pp-root" style={{ display: 'contents' }}>{content}</div>
    </>
  );
}
