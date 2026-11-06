'use client';

import { useEffect, useState } from 'react';
import TournamentList from '../tournaments/TournamentList';
import TournamentDetail from '../tournaments/TournamentDetail';
import { mergedPortalParams } from '@/lib/portal/portalPath';
import type { DivisionHat } from '@/components/portal/hubTypes';

// A division's own tournaments (under its Events): its Heads create and run them, its Members enter scores. They open on the division's own page, /portal/<division>/tournaments/<tournament>, and never on the club's. The open tab of a tournament is ?t=.
export default function DivisionTournaments({ hat }: { hat: DivisionHat }) {
  const [loc, setLoc] = useState<{ open: string | null; tab: string | null }>({ open: null, tab: null });
  useEffect(() => {
    const read = () => {
      const p = mergedPortalParams(window.location.pathname, window.location.search);
      setLoc({ open: p.get('detail'), tab: p.get('t') });
    };
    read();
    for (const ev of ['tg:division-nav', 'tg:portal-nav', 'popstate']) window.addEventListener(ev, read);
    return () => {
      for (const ev of ['tg:division-nav', 'tg:portal-nav', 'popstate']) window.removeEventListener(ev, read);
    };
  }, []);
  const divisions = [{ id: hat.id, name: hat.name, slug: hat.slug }];
  const home = `/portal/${hat.slug}/tournaments`;
  if (loc.open) return <TournamentDetail key={loc.open} slug={loc.open} subtab={loc.tab} divisions={divisions} home={home} tabKey="t" />;
  return <TournamentList divisions={divisions} divisionId={hat.id} home={home} />;
}
