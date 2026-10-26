'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Gift, Package } from 'lucide-react';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import SectionHeader from '@/components/ui/SectionHeader';
import SectionTabs from '@/components/ui/SectionTabs';
import { useLiveParams, usePortalParams } from '@/lib/portal/usePortalParams';
import { useUrlNav } from '@/lib/portal/usePortalTabSync';
import DevicesPage from './DevicesPage';
import PlansTab from './PlansTab';
import PrizingPage from './PrizingPage';
import { parseRoute, routeParams, type Route } from './logisticsRoute';
import { useLogistics } from './useLogistics';
import { clearEdits, onUndoKey } from './undo';
import styles from './logistics.module.css';

type Tab = Route['tab'];

// Logistics: Events (what each team asked for, the sponsor and officer loaners, an event's name and dates), Prizing (every prize and what each station of an event gets) and Devices (every device and
// where each goes, planning and the event day). Each of the last two is one page with an event picker and its own gear for its lists. Every officer can look; people with the Logistics permission can
// change things. Self-contained: it has its own tables and routes and shares nothing with check-in. Every place has its own address (see logisticsRoute.ts), so a copied link opens exactly there.
export default function LogisticsSectionContent({ canManage }: { canManage: boolean }) {
  const api = useLogistics();
  const { data, error, setError } = api;
  const { tab: urlTab, subtab: urlSub, detail: urlDetail } = useUrlNav();
  const urlView = useLiveParams().get('view') ?? undefined;
  const setParams = usePortalParams();
  const [route, setRoute] = useState<Route>(() => parseRoute(urlTab, urlSub, urlDetail, canManage, urlView));
  const go = useCallback((r: Route) => { setRoute(r); setParams({ section: 'logistics', ...routeParams(r) }); }, [setParams]);
  // An old address (equipment, plans, a long ID, a prize page…) is tidied to the new one.
  useEffect(() => {
    const parsed = parseRoute(urlTab, urlSub, urlDetail, canManage, urlView);
    const want = routeParams(parsed);
    if (parsed.tab === 'events' && parsed.plan) return;   // an event is tidied by PlansTab, which knows its name
    if (urlTab && (urlTab !== want.tab || (urlSub ?? null) !== want.subtab || (urlDetail ?? null) !== want.detail || (urlView ?? null) !== want.view)) { setRoute(parsed); setParams({ section: 'logistics', ...want }); }
  }, [urlTab, urlSub, urlDetail, urlView, canManage, setParams]);

  const requestOnly = !!data?.requestOnly;   // a division account: only an event's Requests pages
  const tabs = [
    { id: 'devices' as const, label: 'Devices', icon: <Package size={15} /> },
    { id: 'prizing' as const, label: 'Prizing', icon: <Gift size={15} /> },
    { id: 'events' as const, label: 'Events', icon: <CalendarDays size={15} /> },
  ];
  const pick = (t: Tab) => go(t === 'events' ? { tab: 'events', plan: null, page: 'requests' } : t === 'prizing' ? { tab: 'prizing', plan: null } : { tab: 'devices', plan: null });
  // With an event open under Events the sheet gets the whole page: the title and tabs step aside (All Events goes back).
  const inPlan = route.tab === 'events' && !!route.plan;
  useEffect(() => { document.addEventListener('keydown', onUndoKey); return () => { document.removeEventListener('keydown', onUndoKey); clearEdits(); }; }, []);   // Ctrl+Z for cell edits
  useEffect(() => { if (requestOnly && route.tab !== 'events') go({ tab: 'events', plan: null, page: 'requests' }); }, [requestOnly, route.tab, go]);

  return (
    <div className={styles.page}>
      {!inPlan && <SectionHeader title="Event Logistics" flush sub={canManage ? 'Where every device and prize goes for each event, and what is in storage.' : 'Find where a device goes, what is in storage, and where to get it. Only the logistics team can make changes.'} />}
      {!inPlan && !requestOnly && <SectionTabs<Tab> label="Event Logistics" value={route.tab} onChange={pick} tabs={tabs} />}
      {error && <div role="alert" onClick={() => setError('')}><Notice tone="error">{error}</Notice></div>}
      {!data ? (error ? null : <Loading variant="inline" label="Loading…" />)
        : route.tab === 'events' || requestOnly ? <PlansTab api={api} data={data} route={route.tab === 'events' ? route : { tab: 'events', plan: null, page: 'requests' }} go={go} />
        : route.tab === 'prizing' ? <PrizingPage api={api} data={data} slug={route.plan} go={go} />
        : <DevicesPage api={api} data={data} route={route} go={go} />}
    </div>
  );
}
