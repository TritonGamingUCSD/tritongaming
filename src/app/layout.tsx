import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Triton Gaming | UC San Diego',
    template: '%s | Triton Gaming',
  },
  description:
    'Triton Gaming of UC San Diego is one of the largest student-run collegiate gaming organizations in the country. Fostering community, creativity, and industry connections.',
  keywords: ['Triton Gaming', 'UCSD', 'UC San Diego', 'gaming', 'esports', 'collegiate gaming'],
  openGraph: {
    title: 'Triton Gaming | UC San Diego',
    description: 'One of the largest student-run collegiate gaming organizations in the country.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#011941',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
