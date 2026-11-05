'use client';

import { useState } from 'react';
import { CalendarClock, CalendarDays, Radio, ClipboardList, Plus, Smile } from 'lucide-react';
import SectionTabs from '@/components/ui/SectionTabs';
import Button from '@/components/ui/Button';
import { usePortalTabSync, useUrlNav } from '@/lib/portal/usePortalTabSync';
import PlanningPanel from './planning/PlanningPanel';
import styles from './meetings.module.css';
import SectionHeader from '@/components/ui/SectionHeader';
import { Tab } from './types';
import { MineTab } from './MineTab';
import { TodayStrip } from './TodayStrip';
import { RunPanel } from './RunPanel';
import { EmojiPanel } from './EmojiPanel';
import { AttendancePanel } from './AttendancePanel';

// canHost: can plan meetings (leads, exec, admin) and run/edit/see results of the ones they planned.
// canManageAll: exec and admin, who can do that for every meeting and export attendance for HR.
// canAttend: checks in to meetings. canViewReports: sees every meeting's attendance results and the HR export
// (read only), e.g. the HR team, who may not attend meetings at all.
export default function MeetingsSectionContent({
  canHost,
  canManageAll,
  userId,
  canAttend = true,
  canViewReports = false,
}: {
  canHost: boolean;
  canManageAll: boolean;
  userId: string;
  canAttend?: boolean;
  canViewReports?: boolean;
}) {
  const canManage = canHost;
  const canSeeResults = canHost || canViewReports;
  const nav = useUrlNav();
  const canEmoji = canAttend || canManage;
  const valid: Tab[] = [
    ...(canAttend ? (['mine', 'planning'] as Tab[]) : canManage ? (['planning'] as Tab[]) : []),
    ...(canManage ? (['host'] as Tab[]) : []),
    ...(canSeeResults ? (['attendance'] as Tab[]) : []),
    ...(canEmoji ? (['emojis'] as Tab[]) : []),
  ];
  const sync = usePortalTabSync('meetings', () => valid[0]);
  // Old links and notifications: tab=upcoming and tab=checkin are part of My meetings now; Run meetings is called Host; Attendance and Emojis used to sit under a Tools tab.
  const startTab =
    nav.tab === 'upcoming' || nav.tab === 'checkin'
      ? 'mine'
      : nav.tab === 'run'
        ? 'host'
        : nav.tab === 'tools' || nav.tab === 'manage'
          ? nav.subtab === 'emojis'
            ? 'emojis'
            : 'attendance'
          : nav.tab;
  const [tab, setTab] = useState<Tab>(valid.includes(startTab as Tab) ? (startTab as Tab) : (valid[0] ?? 'mine'));
  // The open view inside Host (a live meeting, or a meeting's edit page) lives in the address, so a refresh or a shared link comes back to it.
  const [hostView, setHostView] = useState<string | null>(nav.tab === 'host' ? (nav.subtab ?? null) : null);
  const [mineView, setMineView] = useState<'up' | 'history'>(nav.tab === 'mine' && nav.subtab === 'history' ? 'history' : 'up');
  // Set when a meeting is opened from the Attendance tab, so Host lands straight on it.
  const [runTarget, setRunTarget] = useState<string | null>(null);
  // The schedule form is opened from the header button, on the Host tab.
  const [scheduling, setScheduling] = useState(false);

  function pick(t: Tab) {
    setRunTarget(null);
    setHostView(null);
    setMineView('up');
    setTab(t);
    sync(t);
  }
  const openHostView = (v: string | null) => {
    setHostView(v);
    sync('host', v);
  };
  function openFromAttendance(id: string) {
    setRunTarget(null);
    setTab('host');
    openHostView(`live-${id}`);
  }

  return (
    <div className={styles.page}>
      <SectionHeader
        title="Meetings"
        flush
        sub={tab === 'mine' ? (canAttend ? 'Check in with the code in the room.' : 'Attendance for every meeting.') : undefined}
        actions={
          canManage && (tab === 'mine' || tab === 'planning' || tab === 'host') ? (
            <Button
              size="sm"
              onClick={() => {
                setRunTarget(null);
                setTab('host');
                openHostView(null);
                setScheduling((v) => (tab === 'host' ? !v : true));
              }}
            >
              {scheduling && tab === 'host' ? (
                'Close'
              ) : (
                <>
                  <Plus size={14} aria-hidden="true" /> Schedule A Meeting
                </>
              )}
            </Button>
          ) : undefined
        }
      />
      <SectionTabs<Tab>
        top
        label="Meetings"
        value={tab}
        onChange={pick}
        tabs={[
          ...(canAttend ? [{ id: 'mine' as Tab, label: 'My meetings', icon: <CalendarDays size={15} /> }] : []),
          ...(canAttend || canManage ? [{ id: 'planning' as Tab, label: 'Planning', icon: <CalendarClock size={15} /> }] : []),
          ...(canManage ? [{ id: 'host' as Tab, label: 'Host', icon: <Radio size={15} /> }] : []),
          ...(canSeeResults ? [{ id: 'attendance' as Tab, label: 'Attendance', icon: <ClipboardList size={15} /> }] : []),
          ...(canEmoji ? [{ id: 'emojis' as Tab, label: 'Emojis', icon: <Smile size={15} /> }] : []),
        ]}
      />
      {tab !== 'mine' && canAttend && !(tab === 'host' && hostView) && (
        <TodayStrip
          canHost={canManage}
          onHost={(id) => {
            setTab('host');
            openHostView(`live-${id}`);
          }}
          onMine={() => pick('mine')}
        />
      )}
      {tab === 'mine' && canAttend && (
        <MineTab
          view={mineView}
          onView={(v) => {
            setMineView(v);
            sync('mine', v === 'history' ? 'history' : null);
          }}
        />
      )}
      {tab === 'planning' && (canAttend || canManage) && <PlanningPanel userId={userId} />}
      {tab === 'host' && canManage && <RunPanel initial={runTarget} view={hostView} onView={openHostView} showForm={scheduling} onShowForm={setScheduling} />}
      {tab === 'attendance' && canSeeResults && <AttendancePanel onOpenMeeting={canManage ? openFromAttendance : undefined} canExport={canManageAll || canViewReports} />}
      {tab === 'emojis' && canEmoji && <EmojiPanel />}
    </div>
  );
}
