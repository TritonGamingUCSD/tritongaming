import type { Metadata } from 'next';

// See (portal)/layout.tsx's own comment — same reasoning, applied to the
// sign-in flow instead of the member portal itself.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--darkblue)' }}>
      {children}
    </div>
  );
}
