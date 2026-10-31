'use client';

import SectionTabs from '@/components/ui/SectionTabs';
import styles from './points.module.css';
import type { PointsCtx } from './pointsCtx';
import { AwardPanel } from './AwardPanel';
import { ItemsPanel } from './ItemsPanel';
import { CorrectionsPanel } from './CorrectionsPanel';
import { TiersPanel } from './TiersPanel';

export function ToolsTab(ctx: PointsCtx) {
  const { tab, canManageShop, canManagePoints, manageSubTab, selectManageSubTab } = ctx;
  return (
    <>
      {tab === 'tools' && canManageShop && (
        <div className={styles.manageTab}>
          <SectionTabs
            variant="segmented"
            label="Manage views"
            value={manageSubTab}
            onChange={selectManageSubTab}
            tabs={[
              ...(canManagePoints ? [{ id: 'award' as const, label: 'Award Points' }] : []),
              { id: 'items', label: 'Shop Items' },
              ...(canManagePoints ? [{ id: 'corrections' as const, label: 'Corrections' }] : []),
              { id: 'tiers', label: 'Tiers' },
            ]}
          />

          <AwardPanel {...ctx} />
          <ItemsPanel {...ctx} />
          <CorrectionsPanel {...ctx} />
          <TiersPanel {...ctx} />
        </div>
      )}
    </>
  );
}
