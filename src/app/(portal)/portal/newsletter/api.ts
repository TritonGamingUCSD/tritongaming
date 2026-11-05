import type { Block } from '@/lib/newsletter/blocks';
import type { AudienceRules, IssueType } from '@/lib/newsletter/rules';
import { call } from '@/lib/ui/apiCall';
import { compressImage } from '@/lib/ui/compressImage';
import { safeFetch } from '@/lib/ui/safeFetch';

export { call };
export type { Block, AudienceRules, IssueType };

export type IssueStatus = 'draft' | 'review' | 'sending' | 'sent';
export const STATUS_NAMES: Record<IssueStatus, string> = { draft: 'Draft', review: 'Waiting For A Check', sending: 'Sending', sent: 'Sent' };

export interface IssueCard {
  id: string;
  slug: string;
  number: number;
  title: string;
  type: IssueType;
  status: IssueStatus;
  event_id: string | null;
  created_by: string | null;
  created_by_name: string;
  review_by: string | null;
  updated_at: string;
  sent_at: string | null;
  sent: number;
  failed: number;
  total: number;
}
export interface Issue {
  id: string;
  slug: string;
  number: number;
  title: string;
  preheader: string;
  type: IssueType;
  event_id: string | null;
  blocks: Block[];
  audience: AudienceRules;
  list_id: string | null;
  status: IssueStatus;
  web_token: string;
  content_version: number;
  tested_version: number;
  created_by: string | null;
  created_by_name: string;
  review_by: string | null;
  review_by_name: string;
  review_at: string | null;
  sent_by_name: string;
  sent_at: string | null;
}
export interface Results {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  failures: { id: string; name: string; email: string; error: string }[];
  links: { n: number; url: string; clicks: number }[];
}
export interface IssueView {
  issue: Issue;
  comments: { id: string; body: string; created_at: string; by: string }[];
  problems: string[];
  results: Results | null;
  canSend: boolean;
  me: string;
}
export interface Options {
  events: { id: string; title: string; start_date: string; is_published: boolean }[];
  divisions: { id: string; name: string }[];
  teams: { id: string; name: string; size: number }[];
}
export interface AudienceCount {
  total: number;
  accounts: number;
  subscribers: number;
  skippedOptOut: number;
  skippedNoEmail: number;
  left: number;
  sample: string[];
}
export interface SavedList {
  id: string;
  name: string;
  rules: AudienceRules;
}

/** Shrinks a picture in the browser and uploads it for a draft; answers with its address. */
export async function uploadPicture(slug: string, file: File): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const blob = await compressImage(file);
  if (!blob) return { ok: false, error: 'That picture couldn’t be shrunk small enough. Try another one, or a simpler one.' };
  const form = new FormData();
  form.append('file', new File([blob], 'picture.webp', { type: 'image/webp' }));
  const res = await safeFetch(`/api/newsletter/${slug}/image`, { method: 'POST', body: form, cache: 'no-store' }).catch(() => null);
  const json = res ? await res.json().catch(() => ({})) : {};
  return res?.ok ? { ok: true, url: json.url as string } : { ok: false, error: json.error ?? 'Couldn’t reach the server.' };
}
