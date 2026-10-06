'use client';

import { useState } from 'react';
import { Gamepad2, LayoutGrid } from 'lucide-react';
import SectionTabs from '@/components/ui/SectionTabs';
import { usePortalTabSync, useUrlNav } from '@/lib/usePortalTabSync';
import DivisionsManager from './DivisionsManager';
import MyDivisionsEditor from './MyDivisionsEditor';
import type { MyDivision } from './getMyDivisionsData';
import styles from '../content/sitecontent.module.css';
import SectionHeader from '@/components/ui/SectionHeader';

type Tab = 'all' | 'my-division';

interface Props {
  canManageDivisions: boolean;
  allDivisions?: Parameters<typeof DivisionsManager>[0]['divisions'];
  isDivisionLead: boolean;
  myDivisions?: MyDivision[];
}

// Everything division-related in one place (it used to be two tabs inside Site Content): the
// directory exec manage, and the page a division lead edits for their own division.
export default function DivisionsSectionContent({ canManageDivisions, allDivisions, isDivisionLead, myDivisions }: Props) {
  const { tab: urlTab } = useUrlNav();
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    ...(canManageDivisions ? [{ id: 'all' as const, label: 'All divisions', icon: <LayoutGrid size={13} strokeWidth={1.5} aria-hidden="true" /> }] : []),
    ...(isDivisionLead ? [{ id: 'my-division' as const, label: 'My division', icon: <Gamepad2 size={13} strokeWidth={1.5} aria-hidden="true" /> }] : []),
  ];
  const [tab, setTab] = useState<Tab>(tabs.some((t) => t.id === urlTab) ? (urlTab as Tab) : (tabs[0]?.id ?? 'all'));
  const sync = usePortalTabSync('divisions', () => tabs[0]?.id);
  function select(t: Tab) { setTab(t); sync(t); }

  return (
    <div className={styles.page}>
      <SectionHeader title="Divisions" sub="The divisions directory and each division’s public page" />
      {tabs.length > 1 && <SectionTabs value={tab} onChange={select} tabs={tabs.map((t) => ({ id: t.id, label: t.label, icon: t.icon }))} />}
      {tab === 'all' && canManageDivisions && allDivisions && <DivisionsManager divisions={allDivisions} />}
      {tab === 'my-division' && isDivisionLead && myDivisions && <MyDivisionsEditor divisions={myDivisions} />}
    </div>
  );
}
