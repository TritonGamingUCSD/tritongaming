import type { StaffleView } from '@/lib/staffle/detail';

export type { StaffleView };
export type StaffleState = StaffleView['state'];
export interface StaffleCard { id: string; slug: string; name: string; opens_at: string; closes_at: string; state: StaffleState; items: number; photos: string[]; entered: number; won: number }

export { call } from '@/lib/ui/apiCall';

// Times are shown in Pacific time, whatever the screen's own clock says.
export const when = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export const STATE_LABEL: Record<StaffleState, string> = { scheduled: 'Opens soon', open: 'Open', closed: 'Closed, waiting for the draw', drawn: 'Drawn', ended: 'Ended', cancelled: 'Cancelled' };
