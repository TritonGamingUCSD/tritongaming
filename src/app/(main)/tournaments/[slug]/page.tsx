import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getOffSwitches } from '@/lib/portal/featureServer';
import { createServiceClient } from '@/lib/supabase/admin';
import { loadTournament } from '@/lib/tournaments/store';
import { buildFeed } from '@/lib/tournaments/feed';
import LiveTournament from '../LiveTournament';

export const dynamic = 'force-dynamic';

async function load(slug: string) {
  const off = await getOffSwitches();
  if (off.includes('tournaments')) return null;
  const data = await loadTournament(createServiceClient(), slug);
  if (!data) return null;
  const t = data.tournament;
  if (!t.is_public || t.status === 'draft' || (t.division_id && off.includes('div_tournaments'))) return null;
  return buildFeed(t, data.entrants, data.matches, data.stages, data.stageEntrants);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const f = await load((await params).slug);
  if (!f) return { title: 'Tournament', robots: { index: false } };
  return {
    title: f.tournament.name,
    description: `${f.tournament.game || 'Tournament'}: live bracket and results from Triton Gaming.`,
    alternates: { canonical: `/tournaments/${f.tournament.slug}` },
  };
}

export default async function TournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const feed = await load(slug);
  if (!feed) notFound();
  return <LiveTournament slug={slug} initial={feed} />;
}
