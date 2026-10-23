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
import { useLogistics, type Catalog, type LogisticsApi } from './useLogistics';
import { usePrizes } from './usePrizes';
import { clearEdits, onUndoKey } from './undo';
import styles from './logistics.module.css';

type Tab = Route['tab'];
const TOOLS_LABELS: Record<ToolsSection, string> = { sponsors: 'Sponsors', 'event-steps': 'Event Steps', bundles: 'Bundles', prizes: 'Prizes', lists: 'Equipment Lists' };

// Logistics: Events (a plan for each event: where every device goes, prizing, sponsor loaners, officer loaners, requests), Inventory (what is in storage: devices and prizes) and Tools (sponsors and
// the lists that fill the dropdowns). Every officer can look; people with the Logistics permission can change things. Self-contained: it has its own tables and routes and shares nothing with check-in.
// Every place has its own address (see logisticsRoute.ts), so a copied link opens exactly there.
// What each Tools page holds, for the number beside its name.
const toolCount = (data: Catalog, id: ToolsSection) => {
  const n = (...k: (keyof Catalog['lists'])[]) => k.reduce((t, x) => t + data.lists[x].length, 0);
  return id === 'sponsors' ? data.sponsors.length : id === 'event-steps' ? n('step') : id === 'bundles' ? n('bundle') : id === 'prizes' ? n('prize_step', 'prize_size') : n('type', 'shelf', 'tier', 'port', 'game', 'kit');
};

// Inventory: Devices and Prizes. The prize count needs the prize list, which is only fetched here, once Inventory is open.
function InventoryView({ api, data, sub, onSub }: { api: LogisticsApi; data: Catalog; sub: 'devices' | 'prizes'; onSub: (s: 'devices' | 'prizes') => void }) {
  const prizes = usePrizes();
  return (
    <>
      <SectionTabs<'devices' | 'prizes'> variant="segmented" label="Inventory" value={sub} onChange={onSub} tabs={[{ id: 'devices', label: 'Devices', count: data.devices.length }, { id: 'prizes', label: 'Prizes', count: prizes.rows?.filter((p) => !p.plan_id).length }]} />
      {sub === 'devices' ? <EquipmentTab api={api} data={data} /> : <PrizesTab api={api} data={data} />}
    </>
  );
}

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
    const parsed = parseRoute(urlTab, urlSub, urlDetail, canManage, urlView);
    const want = routeParams(parsed);
    if (parsed.tab === 'events' && parsed.plan) return;   // an event is tidied by PlansTab, which knows its name
    if (urlTab && (urlTab !== want.tab || (urlSub ?? null) !== want.subtab || (urlDetail ?? null) !== want.detail)) setParams({ section: 'logistics', ...want });
  }, [urlTab, urlSub, urlDetail, urlView, canManage, setParams]);

  const requestOnly = !!data?.requestOnly;   // a division account: only an event's Requests pages
  const tabs = [
    { id: 'events' as const, label: 'Events', icon: <CalendarDays size={15} /> },
    { id: 'inventory' as const, label: 'Inventory', icon: <Package size={15} /> },
    ...(canManage ? [{ id: 'tools' as const, label: 'Tools', icon: <Settings2 size={15} /> }] : []),
  ];
  const pick = (t: Tab) => go(t === 'events' ? { tab: 'events', plan: null, page: 'device' } : t === 'inventory' ? { tab: 'inventory', sub: 'devices' } : { tab: 'tools', sub: 'sponsors' });
  // With an event open the sheet gets the whole page: the title and tabs step aside (All Events goes back).
  const inPlan = route.tab === 'events' && !!route.plan;
  useEffect(() => { document.addEventListener('keydown', onUndoKey); return () => { document.removeEventListener('keydown', onUndoKey); clearEdits(); }; }, []);   // Ctrl+Z for cell edits
  useEffect(() => { if (requestOnly && route.tab !== 'events') go({ tab: 'events', plan: null, page: 'requests' }); }, [requestOnly, route.tab, go]);

  return (
    <div className={styles.page}>
      {!inPlan && <SectionHeader title="Event Logistics" flush sub={canManage ? 'Where every device and prize goes for each event, and what is in storage.' : 'Find where a device goes, what is in storage, and where to get it. Only the logistics team can make changes.'} />}
      {!inPlan && !requestOnly && <SectionTabs<Tab> label="Event Logistics" value={route.tab} onChange={pick} tabs={tabs} />}
      {error && <div role="alert" onClick={() => setError('')}><Notice tone="error">{error}</Notice></div>}
      {!data ? (error ? null : <Loading variant="inline" label="Loading…" />) : route.tab === 'events' || requestOnly ? <PlansTab api={api} data={data} route={route.tab === 'events' ? route : { tab: 'events', plan: null, page: 'requests' }} go={go} />
        : route.tab === 'inventory' ? (
          <InventoryView api={api} data={data} sub={route.sub} onSub={(sub) => go({ tab: 'inventory', sub })} />
        ) : (
          <>
            <SectionTabs<ToolsSection> variant="segmented" label="Tools" value={route.sub} onChange={(sub) => go({ tab: 'tools', sub })} tabs={TOOLS_SECTIONS.map((id) => ({ id, label: TOOLS_LABELS[id], count: toolCount(data, id) }))} />
            <ToolsTab api={api} data={data} section={route.sub} />
          </>
        )}
    </div>
  );
}
