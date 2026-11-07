'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarSync } from 'lucide-react';
import CalendarView, { type CalDivision, type CalState } from '@/components/calendar/CalendarView';
import SubscribeDialog from '@/components/calendar/SubscribeDialog';
import { calParams, readCalState } from '@/components/calendar/useCalendarState';
import { pacificToday } from '@/lib/core/timezone';
import styles from './calendar.module.css';

// The public calendar. The view, date and filters live in the address (?view=week&date=2026-11-10&div=<id>&hide=holiday) so a view can be shared.
const KEYS = { tab: 'view', subtab: 'date' } as const;
const read = (): CalState => {
  const q = new URLSearchParams(window.location.search);
  return readCalState((k) => q.get(k === 'tab' ? KEYS.tab : k === 'subtab' ? KEYS.subtab : k), pacificToday());
};

export default function PublicCalendar({ divisions }: { divisions: CalDivision[] }) {
  const [state, setState] = useState<CalState>(() => ({ view: 'month', date: pacificToday(), hide: [], div: '', mine: false }));
  const [subscribe, setSubscribe] = useState(false);
  useEffect(() => {
    setState(read());
    const onPop = () => setState(read());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const onState = useCallback((patch: Partial<CalState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      const p = calParams(next, pacificToday());
      const q = new URLSearchParams();
      if (p.tab) q.set(KEYS.tab, p.tab);
      if (p.subtab) q.set(KEYS.subtab, p.subtab);
      if (p.hide) q.set('hide', p.hide);
      if (p.div) q.set('div', p.div);
      window.history.replaceState(null, '', q.size ? `?${q}` : window.location.pathname);
      return next;
    });
  }, []);
  const divSlug = state.div && state.div !== 'club' ? divisions.find((d) => d.id === state.div)?.slug : null;
  const feed = typeof window === 'undefined' ? '' : `${window.location.origin}/api/calendar/public.ics${divSlug ? `?division=${divSlug}` : ''}`;
  return (
    <div className={styles.wrap}>
      <CalendarView
        endpoint="/api/calendar/public"
        state={state}
        onState={onState}
        divisions={divisions}
        tone="site"
        signedInView={false}
        toolbarExtra={
          <button type="button" className={styles.sub} onClick={() => setSubscribe(true)}>
            <CalendarSync size={15} aria-hidden="true" /> Subscribe
          </button>
        }
      />
      {subscribe && <SubscribeDialog url={feed} onClose={() => setSubscribe(false)} />}
    </div>
  );
}
