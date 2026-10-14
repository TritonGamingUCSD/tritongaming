import type { Metadata } from 'next';
import PortalThemeInit from '@/components/portal/PortalThemeInit';

// See (portal)/layout.tsx's own comment — same reasoning, applied to the
// sign-in flow instead of the member portal itself.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // The sign-in page wears the portal's look, so it settles the same saved light/dark choice (see lib/portal/themeScript.ts).
  return (
    <div style={{ minHeight: '100vh', background: 'var(--pp-paper)', color: 'var(--pp-ink)' }}>
      <PortalThemeInit />
      {children}
    </div>
  );
}
