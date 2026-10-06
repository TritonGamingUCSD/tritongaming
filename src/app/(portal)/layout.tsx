import type { Metadata } from 'next';
import './portal-controls.css';
import { getProfile, getViewingUser } from '@/lib/auth';
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
  // Applies the saved light/dark choice before first paint (no flash). With none saved, the CSS follows the device.
  const themeScript = `try{var t=localStorage.getItem('tg_portal_theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-pp-theme',t)}catch(e){}`;
  const [profile, viewing] = await Promise.all([getProfile().catch(() => null), getViewingUser().catch(() => null)]);
  const content = profile ? <PortalIdentityProvider id={profile.id} name={profile.display_name || profile.google_first_name || 'Someone'} track={!viewing}>{children}</PortalIdentityProvider> : children;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      <div className="pp-root" style={{ display: 'contents' }}>{content}</div>
    </>
  );
}
