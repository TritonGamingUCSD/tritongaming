'use client';

import { useEffect, useState } from 'react';
import SectionHeader from '@/components/ui/SectionHeader';
import SectionTabs from '@/components/ui/SectionTabs';
import { useLiveParams, usePortalParams } from '@/lib/portal/usePortalParams';
import { mergedPortalParams } from '@/lib/portal/portalPath';
import ScheduleTab from './ScheduleTab';
import ToolsTab from './ToolsTab';
import SetupTab from './SetupTab';

type Tab = 'schedule' | 'tools' | 'setup';
const TABS: Tab[] = ['schedule', 'tools', 'setup'];

// Broadcast (admin-only for now): the stream schedule with roles and a go-live checklist, the OBS tools for tournaments, and the channel setup. The tab is in the address: /portal/broadcast/<tab>.
export default function BroadcastSectionContent() {
  const start = useLiveParams();
  const setParams = usePortalParams();
  const [tabParam, setTabParam] = useState<string | null>(start.get('tab'));
  useEffect(() => {
    const read = () => setTabParam(mergedPortalParams(window.location.pathname, window.location.search).get('tab'));
    read();
    for (const ev of ['tg:portal-nav', 'popstate']) window.addEventListener(ev, read);
    return () => {
      for (const ev of ['tg:portal-nav', 'popstate']) window.removeEventListener(ev, read);
    };
  }, []);
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : 'schedule';
  return (
    <div>
      <SectionHeader title="Broadcast" sub="Plan the stream, give people roles, and set up OBS in a few clicks." />
      <SectionTabs
        value={tab}
        onChange={(t) => {
          setParams({ tab: t === 'schedule' ? null : t });
          window.dispatchEvent(new Event('tg:portal-nav'));
        }}
        tabs={[
          { id: 'schedule', label: 'Schedule' },
          { id: 'tools', label: 'OBS Tools' },
          { id: 'setup', label: 'Channels' },
        ]}
      />
      {tab === 'schedule' && <ScheduleTab />}
      {tab === 'tools' && <ToolsTab />}
      {tab === 'setup' && <SetupTab />}
    </div>
  );
}
