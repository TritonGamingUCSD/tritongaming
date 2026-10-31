import { type QState } from './QuestionParts';
import { type QuestionType, type Tally } from '@/lib/meetings/meetingFun';
import { Aud } from './audience';

export type WallItem = { id: string; emoji: string; x: number; y: number; at: number }; // a sticker on the wall (screen position in percent; `at` when it was placed)

export type Tab = 'mine' | 'planning' | 'host' | 'attendance' | 'emojis';

export interface Person {
  id: string;
  name: string;
  avatar_url: string | null;
  custom_avatar_url: string | null;
}

export interface TodayMeeting {
  question_type: QuestionType;
  question_options: string[] | null;
  id: string;
  title: string;
  location: string | null;
  starts_at: string;
  ends_at: string;
  open: boolean;
  accepting: boolean;
  opens_at: string;
  checked_in_at: string | null;
  doc_url: string | null;
  question: string | null;
  my_answer: string | null;
}

export interface NextMeeting {
  doc_url?: string | null;
  title: string;
  location: string | null;
  starts_at: string;
  ends_at: string;
  date: string;
}

export interface Live {
  meeting: {
    open_to_team?: boolean;
    question_type: QuestionType;
    question_options: string[] | null;
    id: string;
    title: string;
    meeting_date: string;
    starts_at: string;
    ends_at: string;
    open: boolean;
    doc_url: string | null;
    location: string | null;
    cancelled: boolean;
    series_id: string | null;
    accepting: boolean;
    opens_at: string;
    question: string | null;
    audience: string[] | null;
    invitees: string[] | null;
    group_ids: string[] | null;
    groupNames: string[];
  };
  answers: (Person & { answer: string; at: string })[];
  reactionTotals: Record<string, number>;
  customEmojis?: Record<string, { name: string; url: string }>;
  tally: Tally;
  code: string | null;
  expiresAt: number | null;
  qrPayload?: string | null;
  upcoming?: { code: string; qrPayload: string; expiresAt: number }[]; // the next few codes, so a code runs out and the next shows without a new request
  attendees: (Person & { checked_in_at: string; method: 'code' | 'manual' | 'host'; guest?: boolean })[];
  missing: Person[];
  absent: (Person & { reason: string | null; excused: boolean })[];
}

export interface Item {
  open_to_team?: boolean | null;
  question_type: QuestionType;
  question_options: string[] | null;
  key: string;
  meeting_id: string | null;
  series_id: string | null;
  date: string;
  title: string;
  location: string | null;
  doc_url: string | null;
  question: string | null;
  audience: string[] | null;
  invitees: string[] | null;
  group_ids: string[] | null;
  groupNames: string[];
  host_id: string | null;
  host_name: string | null;
  starts_at: string;
  ends_at: string;
  status: 'scheduled' | 'open' | 'closed' | 'cancelled';
  count: number;
  absent?: number;
  is_today: boolean;
  repeats: boolean;
}

export interface Series {
  ended?: boolean;
  open_to_team?: boolean | null;
  ends_on?: string | null;
  id: string;
  title: string;
  weekday: number;
  start_time: string;
  end_time: string;
  location: string | null;
  active: boolean;
  doc_url: string | null;
  audience: string[] | null;
  invitees: string[] | null;
  group_ids: string[] | null;
}

// ── Everyone: their own attendance record ─────────────────────────────────────
// Everything coming up that's meant for this person (or that they planned), grouped by day.
export type UpcomingItem = {
  key: string;
  date: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  doc_url: string | null;
  repeats: boolean;
  is_today: boolean;
  status: string;
  host_name: string | null;
  hosting: boolean;
};

export interface TeamPerson {
  id: string;
  name: string;
  avatar_url: string | null;
  custom_avatar_url: string | null;
  roles: string[];
  role: string;
  inactive?: boolean;
  alumni?: boolean;
}

export interface Group {
  id: string;
  name: string;
  member_ids: string[];
  created_by?: string | null;
}

export interface DetailsFields {
  doc: string;
  q: QState;
  audience: Aud;
  location: string;
  title: string;
  start: string;
  end: string;
}

export interface AttPerson {
  id: string;
  name: string;
  avatar_url: string | null;
  custom_avatar_url: string | null;
  role: string;
  attended: number;
  total: number;
  rate: number | null;
  streak: number;
  missedRun: number;
  marks: ('p' | 'a' | 'e' | 'g' | '-')[];
  excused: number;
  last_attended: string | null;
  follow_up: boolean;
}

export interface AttData {
  titles: string[];
  meetings: { id: string; title: string; meeting_date: string; audience: string[] | null; invitees: string[] | null; count: number; guests: number; expected: number }[];
  people: AttPerson[];
  summary: { held: number; avgTurnout: number; avgRate: number | null; followUp: number };
}

export type SortKey = 'name' | 'rate' | 'attended' | 'streak' | 'last';
