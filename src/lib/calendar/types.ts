// What the calendar shows: one list of items from every part of the portal, each with a kind (its colour and filter), when, and where it opens. Plain data, shared by the loaders, the screens, the feeds and the tests.
export const CAL_KINDS = ['event', 'meeting', 'tournament', 'broadcast', 'logistics', 'deadline', 'term', 'holiday'] as const;
export type CalKind = (typeof CAL_KINDS)[number];

export const KIND_INFO: Record<CalKind, { label: string; color: string; plural: string }> = {
  event: { label: 'Event', plural: 'Events', color: '#e8912d' }, // theme-ok
  meeting: { label: 'Meeting', plural: 'Meetings', color: '#7db4ea' }, // theme-ok
  tournament: { label: 'Tournament', plural: 'Tournaments', color: '#d9487f' }, // theme-ok
  broadcast: { label: 'Stream', plural: 'Streams', color: '#8b6cdc' }, // theme-ok
  logistics: { label: 'Event Setup', plural: 'Event Setups', color: '#2fae86' }, // theme-ok
  deadline: { label: 'Deadline', plural: 'Deadlines', color: '#e5484d' }, // theme-ok
  term: { label: 'Quarter', plural: 'Quarter Dates', color: '#3c7fd0' }, // theme-ok
  holiday: { label: 'Holiday', plural: 'Holidays', color: '#9aa7bd' }, // theme-ok
};

export interface CalItem {
  /** Stable across loads and unique per day it shows on: `<source>:<id>`. */
  id: string;
  kind: CalKind;
  title: string;
  /** An instant (ISO with a time), or a Pacific day (YYYY-MM-DD) when `allDay`. */
  start: string;
  /** The end instant; for an all-day item the last day (inclusive). */
  end?: string | null;
  allDay: boolean;
  /** The division it belongs to; empty is Triton Gaming's. */
  divisionId?: string | null;
  /** The person has a ticket, a role, is expected or is organizing it. */
  mine?: boolean;
  location?: string | null;
  /** Where it opens (a portal page for members, the public page on the public calendar). */
  href?: string | null;
  /** A short extra line ("Live now", "Draft", "UCSD only"). */
  note?: string | null;
}
