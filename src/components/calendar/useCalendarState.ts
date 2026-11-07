import { CAL_KINDS, type CalKind } from '@/lib/calendar/types';
import { CAL_VIEWS, isDay, type CalView } from '@/lib/calendar/grid';
import type { CalState } from './CalendarView';

/** The calendar's screen as address words, and back: view, date, hidden kinds, whose, and "only mine". */
export function readCalState(get: (k: string) => string | null | undefined, today: string): CalState {
  const v = get('tab');
  const view = (CAL_VIEWS as string[]).includes(v ?? '') ? (v as CalView) : 'month';
  const d = get('subtab');
  const hide = (get('hide') ?? '').split(',').filter((k): k is CalKind => (CAL_KINDS as readonly string[]).includes(k));
  return { view, date: isDay(d) ? d : today, hide, div: get('div') ?? '', mine: get('mine') === '1' };
}
export function calParams(s: CalState, today: string) {
  return {
    tab: s.view === 'month' ? null : s.view,
    subtab: s.date === today ? null : s.date,
    hide: s.hide.length ? s.hide.join(',') : null,
    div: s.div || null,
    mine: s.mine ? '1' : null,
  };
}
