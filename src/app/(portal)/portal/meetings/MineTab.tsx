'use client';

import SectionTabs from '@/components/ui/SectionTabs';
import styles from './meetings.module.css';
import { CheckInPanel } from './CheckInPanel';
import { UpcomingPanel } from './UpcomingPanel';
import { MyHistoryPanel } from './MyHistoryPanel';

// My meetings: check in first, then what is coming up or what has happened (a switch, not two columns).
export function MineTab({ view, onView }: { view: 'up' | 'history'; onView: (v: 'up' | 'history') => void }) {
  return (
    <div className={styles.stack}>
      <CheckInPanel />
      <SectionTabs<'up' | 'history'>
        label="My meetings"
        variant="segmented"
        value={view}
        onChange={onView}
        tabs={[
          { id: 'up', label: 'Coming Up' },
          { id: 'history', label: 'History' },
        ]}
      />
      {view === 'up' ? <UpcomingPanel /> : <MyHistoryPanel />}
    </div>
  );
}
