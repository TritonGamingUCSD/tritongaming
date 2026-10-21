'use client';

import SectionTabs from '@/components/ui/SectionTabs';
import PlanPrizes from './PlanPrizes';
import PrizeGrid from './PrizeGrid';
import type { PlanApi } from './usePlans';
import type { Catalog, LogisticsApi } from './useLogistics';

// Prizing for an event: Allocate is the sheet-like grid (which prizes each pool gets, and what is left); Event Day is the counts for each pool and prize through the steps (in temp storage, sorted,
// picked up, given out, back to storage). Sponsor prizes sent for the event are on their own page, Sponsor Prizing.
export default function PrizingTab({ plan, data, day, onDay }: { plan: PlanApi; api: LogisticsApi; data: Catalog; day: boolean; onDay: (day: boolean) => void }) {
  const d = plan.detail!;
  return (
    <>
      <SectionTabs<'allocate' | 'day'> variant="segmented" label="Prizing" value={day ? 'day' : 'allocate'} onChange={(v) => onDay(v === 'day')} tabs={[{ id: 'allocate', label: 'Allocate' }, { id: 'day', label: 'Event Day' }]} />
      {day ? <PlanPrizes plan={plan} canManage={d.canManage} closed={d.plan.status === 'closed'} /> : <PrizeGrid plan={plan} data={data} />}
    </>
  );
}
