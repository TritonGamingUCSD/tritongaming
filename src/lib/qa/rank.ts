// The order questions are shown in: most liked first, and among equals the one asked first. Used by the guests' list, the host's console and the big screen's "next question".

export type QaStatus = 'pending' | 'approved' | 'hidden' | 'answered';
export type QaSessionStatus = 'draft' | 'open' | 'closed';

export interface QuestionInfo {
  id: string;
  body: string;
  author: string;
  status: QaStatus;
  likes: number;
  created_at: string;
}

export const MAX_BODY = 280;
export const MAX_AUTHOR = 40;
export const MAX_WAITING = 3; // questions one person can have waiting for the host at a time
export const MAX_ASKED = 10; // questions one person can send in a session

export const SESSION_NAMES: Record<QaSessionStatus, string> = { draft: 'Draft', open: 'Taking Questions', closed: 'Closed' };

export function rankQuestions<T extends { likes: number; created_at: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => b.likes - a.likes || a.created_at.localeCompare(b.created_at));
}

/** The approved question the host would show next: the most liked one that is not already on the screen. */
export function nextQuestion(list: QuestionInfo[], spotlightId: string | null): QuestionInfo | null {
  return rankQuestions(list.filter((q) => q.status === 'approved' && q.id !== spotlightId))[0] ?? null;
}

/** What a person typed as a question or a name: one line of text with the spaces tidied, cut to length. */
export function cleanText(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}
