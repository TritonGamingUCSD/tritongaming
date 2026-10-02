import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import NavBar from '@/components/NavBar/NavBar';
import Footer from '@/components/Footer/Footer';
import AnnouncementBanner from '@/components/AnnouncementBanner/AnnouncementBanner';
import { ensurePreviewDrafts } from '@/lib/contentPreview';
import PreviewBridge from './PreviewBridge';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Preview', robots: { index: false, follow: false } };

// The public site as the Site Content editor's live preview: the same chrome and the same page components, with the editor's
// unsaved edits laid over the saved content. Only people who can edit site content get in.
export default async function PreviewLayout({ children }: { children: React.ReactNode }) {
  if (!(await ensurePreviewDrafts())) notFound();

  return (
    <>
      <NavBar />
      <main>{children}</main>
      <Suspense fallback={null}><Footer /></Suspense>
      <Suspense fallback={null}><AnnouncementBanner /></Suspense>
      <PreviewBridge />
    </>
  );
}
