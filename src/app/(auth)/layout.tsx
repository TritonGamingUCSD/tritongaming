import type { Metadata } from 'next';

// See (portal)/layout.tsx's own comment — same reasoning, applied to the
// sign-in flow instead of the member portal itself.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // The sign-in page wears the portal's look, so it applies the same saved light/dark choice before first paint (see (portal)/layout.tsx).
  const themeScript = `try{var t=localStorage.getItem('tg_portal_theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-pp-theme',t)}catch(e){}`;
  return (
    <div style={{ minHeight: '100vh', background: 'var(--pp-paper)', color: 'var(--pp-ink)' }}>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      {children}
    </div>
  );
}
