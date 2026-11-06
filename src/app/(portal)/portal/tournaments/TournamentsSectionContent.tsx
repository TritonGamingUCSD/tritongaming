'use client';

import { useEffect, useState } from 'react';
import SectionHeader from '@/components/ui/SectionHeader';
import { useLiveParams } from '@/lib/portal/usePortalParams';
import { mergedPortalParams } from '@/lib/portal/portalPath';
import TournamentList from './TournamentList';
import TournamentDetail from './TournamentDetail';

// Tournaments (admin-only for now). The address says what is open: /portal/tournaments is the list, /portal/tournaments/<tournament>/<tab> one tournament.
export default function TournamentsSectionContent({ divisions }: { divisions: { id: string; name: string }[] }) {
  const start = useLiveParams();
  const [loc, setLoc] = useState<{ tab: string | null; subtab: string | null }>(() => ({ tab: start.get('tab'), subtab: start.get('subtab') }));
  useEffect(() => {
    const read = () => {
      const p = mergedPortalParams(window.location.pathname, window.location.search);
      setLoc({ tab: p.get('tab'), subtab: p.get('subtab') });
    };
    read();
    for (const ev of ['tg:portal-nav', 'popstate']) window.addEventListener(ev, read);
    return () => {
      for (const ev of ['tg:portal-nav', 'popstate']) window.removeEventListener(ev, read);
    };
  }, []);
  if (loc.tab) return <TournamentDetail key={loc.tab} slug={loc.tab} subtab={loc.subtab} divisions={divisions} />;
  return (
    <div>
      <SectionHeader title="Tournaments" sub="Brackets that update live, with overlays for your stream." />
      <TournamentList divisions={divisions} />
    </div>
  );
}
