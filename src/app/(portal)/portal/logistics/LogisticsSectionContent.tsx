'use client';

import { useState } from 'react';
import { CalendarDays, Handshake, Package, Settings2 } from 'lucide-react';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import SectionHeader from '@/components/ui/SectionHeader';
import SectionTabs from '@/components/ui/SectionTabs';
import { usePortalParams } from '@/lib/portal/usePortalParams';
import { usePortalTabSync, useUrlNav } from '@/lib/portal/usePortalTabSync';
import EquipmentTab from './EquipmentTab';
import PlansTab from './PlansTab';
import SponsorsTab from './SponsorsTab';
import ToolsTab from './ToolsTab';
import { useLogistics } from './useLogistics';
import styles from './logistics.module.css';

type Tab = 'equipment' | 'plans' | 'sponsors' | 'tools';

// Logistics: the equipment catalog (and, in later stages, prizes, requests and event setups). Every officer can look; people with the Logistics permission can change things.
// Self-contained: it has its own tables and routes and shares nothing with check-in.
export default function LogisticsSectionContent({ canManage }: { canManage: boolean }) {
  const api = useLogistics();
  const { data, error, setError } = api;
  const { tab: urlTab, subtab: urlSub } = useUrlNav();
  const allowed: Tab[] = canManage ? ['equipment', 'plans', 'sponsors', 'tools'] : ['equipment', 'plans', 'sponsors'];
  const [tab, setTab] = useState<Tab>(allowed.includes(urlTab as Tab) ? (urlTab as Tab) : 'equipment');
  const syncUrl = usePortalTabSync('logistics');
  const pick = (t: Tab) => { setTab(t); syncUrl(t); };
  const setParams = usePortalParams();
  const openPlan = (slug: string) => { setTab('plans'); setParams({ section: 'logistics', tab: 'plans', subtab: slug, view: null }); setDayKey((k) => k + 1); };
  const [dayKey, setDayKey] = useState(0);

  // With a plan open the sheet gets the whole page: the title and tabs step aside (All Plans goes back).
  const inPlan = tab === 'plans' && !!urlSub;
  return (
    <div className={styles.page}>
      {!inPlan && <SectionHeader title="Logistics" flush sub={canManage ? 'Every device the club owns or borrows, and where to find it.' : 'Find a device and where it lives. Only the logistics team can make changes.'} />}
      {!inPlan && <SectionTabs<Tab> label="Logistics" value={tab} onChange={pick} tabs={[
        { id: 'equipment', label: 'Equipment', icon: <Package size={15} />, count: data?.devices.length },
        { id: 'plans', label: 'Plans', icon: <CalendarDays size={15} /> },
        { id: 'sponsors', label: 'Sponsors', icon: <Handshake size={15} /> },
        ...(canManage ? [{ id: 'tools' as const, label: 'Tools', icon: <Settings2 size={15} /> }] : []),
      ]} />}
      {data && data.todayPlans.length > 0 && tab !== 'plans' && (
        <div className={styles.todayBanner}>
          <span><b>{data.todayPlans.length === 1 ? data.todayPlans[0].name : `${data.todayPlans.length} events`}</b> {data.todayPlans.length === 1 ? 'is today.' : 'are today.'}</span>
          {data.todayPlans.map((p) => <button key={p.id} type="button" className={styles.todayBtn} onClick={() => openPlan(p.slug)}>{data.todayPlans.length === 1 ? 'Open Today’s Plan' : p.name}</button>)}
        </div>
      )}
      {error && <div role="alert" onClick={() => setError('')}><Notice tone="error">{error}</Notice></div>}
      {!data ? (error ? null : <Loading variant="inline" label="Loading…" />) : tab === 'equipment' ? <EquipmentTab api={api} data={data} /> : tab === 'plans' ? <PlansTab key={dayKey} api={api} data={data} /> : tab === 'sponsors' ? <SponsorsTab api={api} data={data} /> : <ToolsTab api={api} data={data} />}
    </div>
  );
}
