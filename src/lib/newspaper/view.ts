import type { SupabaseClient } from '@supabase/supabase-js';
import { EMAIL_DAILY_LIMIT } from '@/lib/email/prefs';
import { problemsIn } from './blocks';
import type { IssueRow } from './server';

export interface Results {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  failures: { id: string; name: string; email: string; error: string }[];
  links: { n: number; url: string; clicks: number }[];
}

/** How a sent (or sending) issue went: counts, the failures with their reasons, and the clicks on each link. */
export async function resultsOf(svc: SupabaseClient, issueId: string, withPeople: boolean): Promise<Results> {
  const { data: rows } = await svc.from('newspaper_deliveries').select('id, name, email, status, error').eq('issue_id', issueId).limit(20000);
  const list = rows ?? [];
  const count = (s: string) => list.filter((r) => r.status === s).length;
  const { data: links } = await svc.from('newspaper_links').select('n, url, clicks').eq('issue_id', issueId).order('n');
  return {
    total: list.length,
    sent: count('sent'),
    failed: count('failed'),
    pending: count('pending'),
    failures: withPeople
      ? list
          .filter((r) => r.status === 'failed')
          .slice(0, 200)
          .map((r) => ({ id: r.id as string, name: r.name as string, email: r.email as string, error: (r.error as string | null) ?? '' }))
      : [],
    links: (links ?? []) as Results['links'],
  };
}

/** The issue as the editor shows it: the row, who wrote it, the comments, what is missing, and the results once it has gone out. */
export async function issueView(svc: SupabaseClient, issue: IssueRow, canSend: boolean) {
  const ids = [issue.created_by, issue.review_by, issue.sent_by].filter((x): x is string => !!x);
  const [{ data: comments }, { data: people }] = await Promise.all([
    svc.from('newspaper_comments').select('id, user_id, body, created_at').eq('issue_id', issue.id).order('created_at'),
    ids.length ? svc.from('profiles').select('id, display_name').in('id', ids) : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
  ]);
  const commenters = [...new Set((comments ?? []).map((c) => c.user_id as string | null).filter((x): x is string => !!x))];
  const { data: more } = commenters.length
    ? await svc.from('profiles').select('id, display_name').in('id', commenters)
    : { data: [] as { id: string; display_name: string | null }[] };
  const name = new Map([...(people ?? []), ...(more ?? [])].map((p) => [p.id as string, (p.display_name as string | null) || 'Someone']));
  return {
    issue: {
      ...issue,
      created_by_name: issue.created_by ? (name.get(issue.created_by) ?? '') : '',
      review_by_name: issue.review_by ? (name.get(issue.review_by) ?? '') : '',
      sent_by_name: issue.sent_by ? (name.get(issue.sent_by) ?? '') : '',
    },
    comments: (comments ?? []).map((c) => ({
      id: c.id,
      body: c.body,
      created_at: c.created_at,
      by: c.user_id ? (name.get(c.user_id as string) ?? 'Someone') : 'Someone',
      mine: false,
    })),
    problems: problemsIn(issue.title, issue.blocks),
    results: issue.status === 'sending' || issue.status === 'sent' ? await resultsOf(svc, issue.id, canSend) : null,
  };
}

/** Emails sent in the last 24 hours by event emails and the Newspaper together (they share one Gmail account and its daily limit). */
export async function sentLastDay(svc: SupabaseClient): Promise<number> {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const [{ data: ev }, { count }] = await Promise.all([
    svc.from('event_emails').select('sent').gte('sent_at', since),
    svc.from('newspaper_deliveries').select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('sent_at', since),
  ]);
  return (ev ?? []).reduce((n, r) => n + ((r.sent as number) ?? 0), 0) + (count ?? 0);
}
export const quotaLeft = (used: number) => Math.max(0, EMAIL_DAILY_LIMIT - used);
