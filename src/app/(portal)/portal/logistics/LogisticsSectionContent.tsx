'use client';

import { useState } from 'react';
import { Handshake, Package, Settings2 } from 'lucide-react';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import SectionHeader from '@/components/ui/SectionHeader';
import SectionTabs from '@/components/ui/SectionTabs';
import { usePortalTabSync, useUrlNav } from '@/lib/portal/usePortalTabSync';
import EquipmentTab from './EquipmentTab';
import SponsorsTab from './SponsorsTab';
import ToolsTab from './ToolsTab';
import { useLogistics } from './useLogistics';
import styles from './logistics.module.css';

type Tab = 'equipment' | 'sponsors' | 'tools';

// Logistics: the equipment catalog (and, in later stages, prizes, requests and event setups). Every officer can look; people with the Logistics permission can change things.
// Self-contained: it has its own tables and routes and shares nothing with check-in.
export default function LogisticsSectionContent({ canManage }: { canManage: boolean }) {
  const api = useLogistics();
  const { data, error, setError } = api;
  const { tab: urlTab } = useUrlNav();
  const allowed: Tab[] = canManage ? ['equipment', 'sponsors', 'tools'] : ['equipment', 'sponsors'];
  const [tab, setTab] = useState<Tab>(allowed.includes(urlTab as Tab) ? (urlTab as Tab) : 'equipment');
  const syncUrl = usePortalTabSync('logistics');
  const pick = (t: Tab) => { setTab(t); syncUrl(t); };

  return (
    <div className={styles.page}>
      <SectionHeader title="Logistics" flush sub={canManage ? 'Every device the club owns or borrows, and where to find it.' : 'Find a device and where it lives. Only the logistics team can make changes.'} />
      <SectionTabs<Tab> label="Logistics" value={tab} onChange={pick} tabs={[
        { id: 'equipment', label: 'Equipment', icon: <Package size={15} />, count: data?.devices.length },
        { id: 'sponsors', label: 'Sponsors', icon: <Handshake size={15} /> },
        ...(canManage ? [{ id: 'tools' as const, label: 'Tools', icon: <Settings2 size={15} /> }] : []),
      ]} />
      {error && <div role="alert" onClick={() => setError('')}><Notice tone="error">{error}</Notice></div>}
      {!data ? (error ? null : <Loading variant="inline" label="Loading…" />) : tab === 'equipment' ? <EquipmentTab api={api} data={data} /> : tab === 'sponsors' ? <SponsorsTab api={api} data={data} /> : <ToolsTab api={api} data={data} />}
    </div>
  );
}
