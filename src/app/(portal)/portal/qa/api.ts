import type { QaSessionStatus, QuestionInfo } from '@/lib/qa/rank';
import { call } from '@/lib/ui/apiCall';

export { call };
export type { QaSessionStatus, QuestionInfo };

export interface QaCard {
  id: string;
  slug: string;
  name: string;
  status: QaSessionStatus;
  code: string | null;
  created_at: string;
  pending: number;
  approved: number;
  answered: number;
  total: number;
}
export interface QaSessionInfo {
  id: string;
  slug: string;
  name: string;
  status: QaSessionStatus;
  code: string | null;
  spotlight_id: string | null;
}
/** What the host's screens work with: the session and every question. */
export interface QaView {
  session: QaSessionInfo;
  questions: QuestionInfo[];
}
