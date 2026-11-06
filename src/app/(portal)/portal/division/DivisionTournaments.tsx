'use client';

import TournamentList from '../tournaments/TournamentList';
import type { DivisionHat } from '@/components/portal/hubTypes';

// A division's own tournaments (under its Events): its Heads create and run them, its Members enter scores. Open one to set the structure, entrants and stream; the overlays and public page work the same as the club's.
export default function DivisionTournaments({ hat }: { hat: DivisionHat }) {
  return <TournamentList divisions={[{ id: hat.id, name: hat.name, slug: hat.slug }]} divisionId={hat.id} />;
}
