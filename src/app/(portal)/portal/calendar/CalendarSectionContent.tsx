'use client';

import { useCallback, useMemo, useState } from 'react';
import { CalendarSync } from 'lucide-react';
import SectionHeader from '@/components/ui/SectionHeader';
import Button from '@/components/ui/Button';
import CalendarView, { type CalState } from '@/components/calendar/CalendarView';
import SubscribeDialog from '@/components/calendar/SubscribeDialog';
import { calParams, readCalState } from '@/components/calendar/useCalendarState';
import { useDivisionDirectory } from '@/components/portal/DivisionDirectory';
import { useLiveParams, usePortalParams } from '@/lib/portal/usePortalParams';
import { pacificToday } from '@/lib/core/timezone';

// The portal calendar: everything the person can see or is part of, on one screen. Month, week or list; the view, the date and the filters are all in the address.
export default function CalendarSectionContent() {
  const sp = useLiveParams();
  const setParams = usePortalParams();
  const today = useMemo(() => pacificToday(), []);
  const divisions = useDivisionDirectory();
  const [subscribe, setSubscribe] = useState(false);
  const state = readCalState((k) => sp.get(k), today);
  const onState = useCallback(
    (patch: Partial<CalState>) => {
      const next = { ...state, ...patch };
      setParams({ section: 'calendar', ...calParams(next, today) });
    },
    [state, setParams, today],
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <SectionHeader
        title="Calendar"
        sub="Your events, tournaments, streams, meetings and the quarter, all in one place."
        actions={
          <Button size="sm" variant="secondary" onClick={() => setSubscribe(true)}>
            <CalendarSync size={14} aria-hidden="true" /> Subscribe
          </Button>
        }
      />
      <CalendarView endpoint="/api/calendar" state={state} onState={onState} divisions={divisions} tone="portal" signedInView />
      {subscribe && <SubscribeDialog manage onClose={() => setSubscribe(false)} />}
    </div>
  );
}
