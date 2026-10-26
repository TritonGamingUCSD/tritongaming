'use client';

import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import SectionHeader from '@/components/ui/SectionHeader';
import { usePortalParams } from '@/lib/portal/usePortalParams';
import { useUrlNav } from '@/lib/portal/usePortalTabSync';
import DrawScreen from './DrawScreen';
import StaffleForm from './StaffleForm';
import StaffleList from './StaffleList';
import StaffleViewPage from './StaffleViewPage';
import { parseStaffleRoute, staffleParams, type StaffleRoute } from './staffleRoute';
import styles from './staffle.module.css';

// Staffle: a raffle among staff for items from Prizing. Everyone who can see Event Logistics can look and enter; people with the Event Logistics permission make Staffles, run the draw and mark prizes claimed.
// Every place has an address (see staffleRoute.ts).
export default function StaffleSectionContent({ canManage }: { canManage: boolean }) {
  const { tab, subtab } = useUrlNav();
  const setParams = usePortalParams();
  const [route, setRoute] = useState<StaffleRoute>(() => parseStaffleRoute(tab, subtab, canManage));
  const go = useCallback((r: StaffleRoute) => { setRoute(r); setParams({ section: 'staffle', ...staffleParams(r) }); }, [setParams]);
  const [listKey, setListKey] = useState(0);

  if (route.view === 'draw') return <DrawScreen slug={route.slug} onClose={() => go({ view: 'one', slug: route.slug })} />;
  return (
    <div className={styles.page}>
      {route.view !== 'one' && (
        <SectionHeader title="Staffle" flush sub="A raffle for staff: tick the prizes you want, and winners are drawn live on a big screen. One entry per prize; you can win once."
          actions={canManage ? <Button onClick={() => go({ view: 'new' })}><Plus size={15} aria-hidden="true" /> New Staffle</Button> : undefined} />
      )}
      {route.view === 'one'
        ? <StaffleViewPage key={route.slug} slug={route.slug} canManage={canManage} onBack={() => go({ view: 'list' })} onDraw={() => go({ view: 'draw', slug: route.slug })} onGone={() => { setListKey((k) => k + 1); go({ view: 'list' }); }} />
        : <StaffleList key={listKey} onOpen={(slug) => go({ view: 'one', slug })} />}
      {route.view === 'new' && <StaffleForm staffle={null} onClose={() => go({ view: 'list' })} onSaved={(slug) => { setListKey((k) => k + 1); go({ view: 'one', slug }); }} />}
    </div>
  );
}
