'use client';

import { useState } from 'react';
import { FileText, Gamepad2, LayoutGrid } from 'lucide-react';
import ContentEditor from '../admin/content/ContentEditor';
import type { ContentBlock } from '@/lib/content-blocks';
import DivisionsManager from '../divisions/DivisionsManager';
import MyDivisionsEditor from '../divisions/MyDivisionsEditor';
import type { MyDivision } from '../divisions/getMyDivisionsData';
import styles from './sitecontent.module.css';

type Tab = 'pages' | 'divisions' | 'my-division';

interface Props {
  canEditContent: boolean;
  contentBlocks?: ContentBlock[];
  contentMap?: Record<string, Record<string, unknown>>;
  lastEdited?: Record<string, { by: string; at: string }>;
  canManageDivisions: boolean;
  allDivisions?: Parameters<typeof DivisionsManager>[0]['divisions'];
  isDivisionLead: boolean;
  myDivisions?: MyDivision[];
}

// Three editors that all boil down to "change what shows on the public
// site" — previously three separate hub cards under Admin, which buried
// each behind a click and made "Admin" a junk drawer of unrelated things
// (roles, stats, AND content editing). One card, tabbed like the Admin
// page's own tab bar, so the affordance for "there's more than one thing
// here" is consistent everywhere it shows up in the portal.
export default function SiteContentSectionContent({
  canEditContent, contentBlocks, contentMap, lastEdited,
  canManageDivisions, allDivisions,
  isDivisionLead, myDivisions,
}: Props) {
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    ...(canEditContent ? [{ id: 'pages' as const, label: 'Pages', icon: <FileText size={13} strokeWidth={1.5} aria-hidden="true" /> }] : []),
    ...(canManageDivisions ? [{ id: 'divisions' as const, label: 'Divisions', icon: <LayoutGrid size={13} strokeWidth={1.5} aria-hidden="true" /> }] : []),
    ...(isDivisionLead ? [{ id: 'my-division' as const, label: 'My Division', icon: <Gamepad2 size={13} strokeWidth={1.5} aria-hidden="true" /> }] : []),
  ];
  const [tab, setTab] = useState<Tab>(tabs[0]?.id ?? 'pages');

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Site Content</h1>
          <p className={styles.titleSub}>Everything that shows up on the public site</p>
        </div>
      </div>

      {/* Skip the tab bar entirely for the common case of someone who only
          has one of these three — a lone tab is just extra chrome around
          content that has nowhere else to go. */}
      {tabs.length > 1 && (
        <div className={styles.tabBar} role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'pages' && canEditContent && contentBlocks && contentMap && (
        <ContentEditor blocks={contentBlocks} contentMap={contentMap} lastEdited={lastEdited ?? {}} />
      )}
      {tab === 'divisions' && canManageDivisions && allDivisions && (
        <DivisionsManager divisions={allDivisions} />
      )}
      {tab === 'my-division' && isDivisionLead && myDivisions && (
        <MyDivisionsEditor divisions={myDivisions} />
      )}
    </div>
  );
}
