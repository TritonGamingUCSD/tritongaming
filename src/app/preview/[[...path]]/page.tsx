import { notFound } from 'next/navigation';
import type { ComponentType } from 'react';
import { ensurePreviewDrafts } from '@/lib/contentPreview';

export const dynamic = 'force-dynamic';

// The public pages that Site Content blocks live on. Each is rendered as-is (inside the preview layout, which lays the
// editor's unsaved edits over the content they read).
const PAGES: Record<string, () => Promise<{ default: ComponentType }>> = {
  '': () => import('@/app/(main)/page'),
  'our-story': () => import('@/app/(main)/our-story/page'),
  'get-involved': () => import('@/app/(main)/get-involved/page'),
  sponsors: () => import('@/app/(main)/sponsors/page'),
  divisions: () => import('@/app/(main)/divisions/page'),
  team: () => import('@/app/(main)/team/page'),
  events: () => import('@/app/(main)/events/page'),
  membership: () => import('@/app/(main)/membership/page'),
  media: () => import('@/app/(main)/media/page'),
};

// Pages with a slug in the URL. The editors preview their unsaved form as the slug "__draft__" (see lib/events and lib/divisions).
const SLUG_PAGES: Record<string, () => Promise<{ default: ComponentType<{ params: Promise<{ slug: string }> }> }>> = {
  events: () => import('@/app/(main)/events/[slug]/page'),
  divisions: () => import('@/app/(main)/divisions/[slug]/page'),
};

export default async function PreviewPage({ params }: { params: Promise<{ path?: string[] }> }) {
  if (!(await ensurePreviewDrafts())) notFound();
  const { path } = await params;
  if (path?.length === 2 && SLUG_PAGES[path[0]]) {
    const Page = (await SLUG_PAGES[path[0]]()).default;
    return <Page params={Promise.resolve({ slug: path[1] })} />;
  }
  const load = PAGES[(path ?? []).join('/')];
  if (!load) notFound();
  const Page = (await load()).default;
  return <Page />;
}
