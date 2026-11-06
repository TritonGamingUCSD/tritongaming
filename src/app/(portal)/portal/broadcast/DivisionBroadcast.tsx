'use client';

import { useEffect, useState } from 'react';
import SectionTabs from '@/components/ui/SectionTabs';
import { usePortalParams } from '@/lib/portal/usePortalParams';
import { mergedPortalParams } from '@/lib/portal/portalPath';
import type { DivisionHat } from '@/components/portal/hubTypes';
import ScheduleTab from './ScheduleTab';
import ToolsTab from './ToolsTab';
import SetupTab from './SetupTab';

type Tab = 'schedule' | 'tools' | 'setup';

// A division's own broadcasts: its schedule, its broadcast team (the roles people take on each show), its checklist and its own Twitch and YouTube channels, separate from the club's. Heads run it; Members see the schedule and their roles. The tab is in the address: /portal/<division>/broadcast/<tab>.
export default function DivisionBroadcast({ hat }: { hat: DivisionHat }) {
  const setParams = usePortalParams();
  const [tabParam, setTabParam] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setTabParam(mergedPortalParams(window.location.pathname, window.location.search).get('detail'));
    read();
    for (const ev of ['tg:division-nav', 'tg:portal-nav', 'popstate']) window.addEventListener(ev, read);
    return () => {
      for (const ev of ['tg:division-nav', 'tg:portal-nav', 'popstate']) window.removeEventListener(ev, read);
    };
  }, []);
  const isHead = hat.level === 'head' || hat.level === 'staff';
  const allowed: Tab[] = isHead ? ['schedule', 'tools', 'setup'] : ['schedule'];
  const tab: Tab = allowed.includes(tabParam as Tab) ? (tabParam as Tab) : 'schedule';
  return (
    <div>
      {isHead && (
        <SectionTabs
          value={tab}
          onChange={(t) => {
            setParams({ detail: t === 'schedule' ? null : t });
            window.dispatchEvent(new Event('tg:division-nav'));
          }}
          tabs={[
            { id: 'schedule', label: 'Schedule' },
            { id: 'tools', label: 'OBS Tools' },
            { id: 'setup', label: 'Channels' },
          ]}
        />
      )}
      {tab === 'schedule' && <ScheduleTab divisionId={hat.id} divisionSlug={hat.slug} />}
      {tab === 'tools' && <ToolsTab divisionId={hat.id} divisionSlug={hat.slug} />}
      {tab === 'setup' && <SetupTab divisionId={hat.id} divisionName={hat.name} divisionSlug={hat.slug} />}
    </div>
  );
}
