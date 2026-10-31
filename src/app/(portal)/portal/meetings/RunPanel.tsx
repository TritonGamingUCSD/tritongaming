'use client';

import { MeetingList } from './MeetingList';
import { LiveMeeting } from './LiveMeeting';

// ── Exec: schedule meetings, then open one to run its check-in ────────────────
export function RunPanel({
  initial,
  view,
  onView,
  showForm,
  onShowForm,
}: {
  initial: string | null;
  view: string | null | undefined;
  onView: (v: string | null) => void;
  showForm: boolean;
  onShowForm: (v: boolean) => void;
}) {
  // Which meeting is open on the live screen comes from the address (`live-<id>`), so a refresh or a copied link comes back to it.
  const live = view?.startsWith('live-') ? view.slice(5) : initial;
  if (live) return <LiveMeeting id={live} onBack={() => onView(null)} />;
  return <MeetingList onOpen={(id) => onView(`live-${id}`)} view={view} onView={onView} showForm={showForm} onShowForm={onShowForm} />;
}
