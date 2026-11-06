import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Overlay from '@/components/tournaments/Overlay';
import { OVERLAY_KINDS, type OverlayKind } from '@/components/tournaments/overlayKinds';

export const metadata: Metadata = { title: 'Overlay', robots: { index: false, follow: false } };

// A transparent page for a streaming program's Browser Source (OBS, Streamlabs, vMix). See the Stream tab of a tournament for the links and options.
export default async function OverlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; kind: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug, kind } = await params;
  const q = await searchParams;
  if (!OVERLAY_KINDS.includes(kind as OverlayKind)) notFound();
  return (
    <Overlay
      slug={slug}
      kind={kind as OverlayKind}
      token={q.token}
      accent={q.accent}
      scale={q.scale ? Number(q.scale) : undefined}
      theme={q.theme}
      match={q.match}
      stage={q.stage ? Number(q.stage) : undefined}
    />
  );
}
