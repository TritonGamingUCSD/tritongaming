'use client';

import PlanPrizes from './PlanPrizes';
import PrizeGrid from './PrizeGrid';
import type { PlanApi } from './usePlans';
import type { Catalog, LogisticsApi } from './useLogistics';

// Prizing for an event: Allocate is the sheet-like grid (which prizes each pool gets, and what is left); Event Day is the counts for each pool and prize through the steps (in temp storage, sorted,
// picked up, given out, back to storage). Sponsor prizes sent for the event are on their own page, Sponsor Prizing.
export default function PrizingTab({ plan, data, day }: { plan: PlanApi; api: LogisticsApi; data: Catalog; day: boolean }) {
  const d = plan.detail!;
  return (
    <>
      {day ? <PlanPrizes plan={plan} canManage={d.canManage} closed={d.plan.status === 'closed'} /> : <PrizeGrid plan={plan} data={data} />}
    </>
  );
}
