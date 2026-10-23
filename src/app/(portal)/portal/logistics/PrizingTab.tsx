'use client';

import PlanPrizes from './PlanPrizes';
import PrizeAllocation from './PrizeAllocation';
import PrizeWrapUp from './PrizeWrapUp';
import type { PlanApi } from './usePlans';
import type { Catalog, LogisticsApi } from './useLogistics';

// Prizing for an event: Allocate is a card per pool, made by a prize request (how many and how much it asked for, the prizes it has, Suggest to fill the rest; the old grid is under it); Event Day is the counts for each pool and prize through the steps (in temp storage, sorted,
// picked up, given out, back to storage). Sponsor prizes sent for the event are on their own page, Sponsor Prizing.
export default function PrizingTab({ plan, data, day, bySponsor, onSponsorGroup }: { plan: PlanApi; api: LogisticsApi; data: Catalog; day: boolean; bySponsor: boolean; onSponsorGroup: (v: boolean) => void }) {
  const d = plan.detail!;
  return (
    <>
      {d.plan.status === 'closed' && <PrizeWrapUp plan={plan} />}
      {day ? <PlanPrizes plan={plan} canManage={false} closed={d.plan.status === 'closed'} /> : <PrizeAllocation plan={plan} data={data} bySponsor={bySponsor} onSponsorGroup={onSponsorGroup} />}
    </>
  );
}
