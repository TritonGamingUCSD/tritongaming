'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Package, Settings2 } from 'lucide-react';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import SectionHeader from '@/components/ui/SectionHeader';
import SectionTabs from '@/components/ui/SectionTabs';
import { useLiveParams, usePortalParams } from '@/lib/portal/usePortalParams';
import { useUrlNav } from '@/lib/portal/usePortalTabSync';
import EquipmentTab from './EquipmentTab';
import PlansTab from './PlansTab';
import PrizesTab from './PrizesTab';
import ToolsTab from './ToolsTab';
import { parseRoute, routeParams, TOOLS_SECTIONS, type Route, type ToolsSection } from './logisticsRoute';
import { useLogistics } from './useLogistics';
import styles from './logistics.module.css';

type Tab = Route['tab'];
const TOOLS_LABELS: Record<ToolsSection, string> = { sponsors: 'Sponsors', 'event-steps': 'Event Steps', bundles: 'Bundles', prizes: 'Prizes', lists: 'Equipment Lists' };

// Logistics: Events (a plan for each event: where every device goes, prizing, sponsor items, officer loaners, requests), Inventory (what is in storage: devices and prizes) and Tools (sponsors and
// the lists that fill the dropdowns). Every officer can look; people with the Logistics permission can change things. Self-contained: it has its own tables and routes and shares nothing with check-in.
// Every place has its own address (see logisticsRoute.ts), so a copied link opens exactly there.
export default function LogisticsSectionContent({ canManage }: { canManage: boolean }) {
  const api = useLogistics();
  const { data, error, setError } = api;
  const { tab: urlTab, subtab: urlSub, detail: urlDetail } = useUrlNav();
  const urlView = useLiveParams().get('view') ?? undefined;
  const setParams = usePortalParams();
  const [route, setRoute] = useState<Route>(() => parseRoute(urlTab, urlSub, urlDetail, canManage, urlView));
  const go = useCallback((r: Route) => { setRoute(r); setParams({ section: 'logistics', ...routeParams(r) }); }, [setParams]);
  // An old address (equipment, plans, a long ID…) is tidied to the new one.
  useEffect(() => {
    const want = routeParams(parseRoute(urlTab, urlSub, urlDetail, canManage, urlView));
    if (urlTab && (urlTab !== want.tab || (urlSub ?? null) !== want.subtab || (urlDetail ?? null) !== want.detail) && want.tab !== 'events') setParams({ section: 'logistics', ...want });
    // events are tidied by PlansTab, which knows the plan's name
  }, [urlTab, urlSub, urlDetail, urlView, canManage, setParams]);

  const tabs = [
    { id: 'events' as const, label: 'Events', icon: <CalendarDays size={15} /> },
    { id: 'inventory' as const, label: 'Inventory', icon: <Package size={15} /> },
    ...(canManage ? [{ id: 'tools' as const, label: 'Tools', icon: <Settings2 size={15} /> }] : []),
  ];
  const pick = (t: Tab) => go(t === 'events' ? { tab: 'events', plan: null, page: 'device' } : t === 'inventory' ? { tab: 'inventory', sub: 'devices' } : { tab: 'tools', sub: 'sponsors' });
  // With an event open the sheet gets the whole page: the title and tabs step aside (All Events goes back).
  const inPlan = route.tab === 'events' && !!route.plan;

  return (
    <div className={styles.page}>
      {!inPlan && <SectionHeader title="Logistics" flush sub={canManage ? 'Where every device and prize goes for each event, and what is in storage.' : 'Find where a device goes, what is in storage, and where to get it. Only the logistics team can make changes.'} />}
      {!inPlan && <SectionTabs<Tab> label="Logistics" value={route.tab} onChange={pick} tabs={tabs} />}
      {error && <div role="alert" onClick={() => setError('')}><Notice tone="error">{error}</Notice></div>}
      {!data ? (error ? null : <Loading variant="inline" label="Loading…" />) : route.tab === 'events' ? <PlansTab api={api} data={data} route={route} go={go} />
        : route.tab === 'inventory' ? (
          <>
            <SectionTabs<'devices' | 'prizes'> variant="segmented" label="Inventory" value={route.sub} onChange={(sub) => go({ tab: 'inventory', sub })} tabs={[{ id: 'devices', label: 'Devices', count: data.devices.length }, { id: 'prizes', label: 'Prizes' }]} />
            {route.sub === 'devices' ? <EquipmentTab api={api} data={data} /> : <PrizesTab api={api} data={data} />}
          </>
        ) : (
          <>
            <SectionTabs<ToolsSection> variant="segmented" label="Tools" value={route.sub} onChange={(sub) => go({ tab: 'tools', sub })} tabs={TOOLS_SECTIONS.map((id) => ({ id, label: TOOLS_LABELS[id] }))} />
            <ToolsTab api={api} data={data} section={route.sub} />
          </>
        )}
    </div>
  );
}
