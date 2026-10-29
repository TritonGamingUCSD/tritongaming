import type { StaffleView } from '@/lib/staffle/detail';

export type { StaffleView };
export type StaffleState = StaffleView['state'];
export interface StaffleCard {
  id: string;
  slug: string;
  name: string;
  state: StaffleState;
  items: number;
  photos: string[];
  entered: number;
  won: number;
}

export { call } from '@/lib/ui/apiCall';

export const STATE_LABEL: Record<StaffleState, string> = { draft: 'Not Open Yet', open: 'Open', closed: 'Closed, waiting for the draw', drawn: 'Drawn', ended: 'Ended' };
