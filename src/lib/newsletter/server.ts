import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { strictUser } from '@/lib/supabase/localAuth';
import { hasCapability, withGrantedCapabilities } from '@/lib/portal/capabilities';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';
import { slugify } from '@/lib/core/slug';
import { APPLE_ICON_DATA_URI } from '@/lib/site/appleIcon';
import { siteUrl } from '@/lib/email/template';
import { loadEvent } from '@/lib/email/eventData';
import type { EventForEmail } from '@/lib/email/eventData';
import { unsubscribeUrl } from '@/lib/email/unsubscribe';
import { cleanBlocks, eventIdsIn, type Block } from './blocks';
import { cleanRules, ISSUE_TYPES, type AudienceRules, type IssueType } from './rules';
import { renderIssue } from './render';

export const UUID = /^[0-9a-f-]{36}$/i;
export const BATCH = 40; // emails one request sends; the page asks again for the next batch
export const ISSUE_COLUMNS =
  'id, slug, number, title, preheader, type, event_id, blocks, audience, list_id, status, web_token, content_version, tested_version, created_by, review_by, review_at, sent_by, started_at, sent_at, created_at, updated_at';

export interface IssueRow {
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
  status: 'draft' | 'review' | 'sending' | 'sent';
  web_token: string;
  content_version: number;
  tested_version: number;
  created_by: string | null;
  review_by: string | null;
  review_at: string | null;
  sent_by: string | null;
  started_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

// Who may do what. 'write' (officers and above, or granted "Write the Newsletter"): look at every issue, make and edit drafts, save audiences, ask for a check, send tests. 'send' ("Send the Newsletter": exec and admin, or granted): everything a writer can,
// plus read an issue under review, send it back with a comment, send it, and manage subscribers. Sending your own issue is refused by the send route, not here.
export async function authorizeNewsletter(mode: 'write' | 'send') {
  const userClient = await createClient();
  const {
    data: { user },
  } = await strictUser(userClient);
  if (!user || user.is_anonymous) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const svc = createServiceClient();
  const { data: roles } = await userClient.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const grants = withGrantedCapabilities(roles ?? [], await loadGrantedCapabilities(svc, user.id).catch(() => []));
  const canSend = hasCapability(grants, 'send_newsletter');
  const canWrite = canSend || hasCapability(grants, 'write_newsletter');
  if (mode === 'send' ? !canSend : !canWrite)
    return {
      error: NextResponse.json(
        { error: mode === 'send' ? 'Sending the Newsletter is for exec and admins, or people granted “Send the Newsletter”.' : 'The Newsletter is for officers and above.' },
        { status: 403 },
      ),
    };
  return { user, svc, canSend, canWrite };
}

export async function loadIssue(svc: SupabaseClient, key: string): Promise<IssueRow | null> {
  const { data, error } = await svc
    .from('newsletter_issues')
    .select(ISSUE_COLUMNS)
    .eq(UUID.test(key) ? 'id' : 'slug', key)
    .maybeSingle();
  if (error) throw new Error(`Newsletter read failed: ${error.message}`);
  return data ? ({ ...data, blocks: cleanBlocks(data.blocks), audience: cleanRules(data.audience) } as IssueRow) : null;
}

export async function freshSlug(svc: SupabaseClient, title: string): Promise<string> {
  let base = slugify(title).slice(0, 50) || 'issue';
  if (base === 'subscribers') base = 'subscribers-issue'; // (/portal/newsletter/subscribers is the subscribers page)
  for (let i = 0; i < 8; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const { count } = await svc.from('newsletter_issues').select('id', { count: 'exact', head: true }).eq('slug', slug);
    if (!count) return slug;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

/** The events an issue's blocks (and its own event) show, loaded as the email needs them. */
export async function eventsFor(svc: SupabaseClient, issue: Pick<IssueRow, 'blocks' | 'event_id'>): Promise<Map<string, EventForEmail>> {
  const ids = [...new Set([...eventIdsIn(issue.blocks), ...(issue.event_id ? [issue.event_id] : [])])];
  const out = new Map<string, EventForEmail>();
  for (const id of ids) {
    const e = await loadEvent(svc, id);
    if (e) out.set(id, e);
  }
  return out;
}

/** The kind of email an issue is (which opt-out it follows, and which sender it comes from). */
export const kindOf = (type: IssueType) => ISSUE_TYPES[type].kind;

export const webUrl = (issue: Pick<IssueRow, 'web_token'>) => `${siteUrl()}/newsletter/${issue.web_token}`;
export const clickUrl = (issue: Pick<IssueRow, 'web_token'>, n: number) => `${siteUrl()}/api/newsletter/click/${issue.web_token}/${n}`;

/** The issue as the editor's preview and the web copy show it: the logo inside the page, no one's unsubscribe link. */
export async function previewHtml(svc: SupabaseClient, issue: IssueRow, opts: { test?: boolean } = {}): Promise<string> {
  const events = await eventsFor(svc, issue);
  return renderIssue({
    issue: { number: issue.number, title: issue.title, preheader: issue.preheader, type: issue.type, date: new Date(issue.sent_at ?? Date.now()) },
    blocks: issue.blocks,
    events,
    logoSrc: APPLE_ICON_DATA_URI,
    test: opts.test,
  }).html;
}

/** The email for one person: their unsubscribe link, the click counter on every link, the web copy link. `links` maps an address to its number (made when sending starts). */
export function renderFor(
  issue: IssueRow,
  events: Map<string, EventForEmail>,
  person: { user_id: string | null; subscriber_id: string | null },
  links: Map<string, number>,
  test = false,
) {
  const kind = kindOf(issue.type);
  const unsub = person.user_id ? unsubscribeUrl(person.user_id, kind) : person.subscriber_id ? unsubscribeUrl(person.subscriber_id, 'newsletter') : undefined;
  const r = renderIssue({
    issue: { number: issue.number, title: issue.title, preheader: issue.preheader, type: issue.type, date: new Date(issue.sent_at ?? Date.now()) },
    blocks: issue.blocks,
    events,
    webUrl: webUrl(issue),
    unsubscribeUrl: unsub,
    settingsUrl: person.user_id ? `${siteUrl()}/portal/profile` : undefined,
    why: person.user_id
      ? `You get this because you have an account with Triton Gaming and ${kind === 'newsletter' ? 'the newsletter is on' : kind === 'reminders' ? 'event reminders are on' : 'event updates are on'}.`
      : 'You get this because you signed up for the Triton Gaming newsletter.',
    test,
    link: (u) => (links.has(u) ? clickUrl(issue, links.get(u)!) : u),
  });
  return { ...r, unsubscribeUrl: unsub };
}

/** Every address the issue links to, numbered in order. */
export function numberLinks(issue: IssueRow, events: Map<string, EventForEmail>): Map<string, number> {
  const seen: string[] = [];
  renderIssue({
    issue: { number: issue.number, title: issue.title, type: issue.type },
    blocks: issue.blocks,
    events,
    link: (u) => {
      if (!seen.includes(u)) seen.push(u);
      return u;
    },
  });
  return new Map(seen.map((u, i) => [u, i + 1]));
}

export async function loadEventTitle(svc: SupabaseClient, id: string): Promise<string | null> {
  const { data } = await svc.from('events').select('title').eq('id', id).maybeSingle();
  return (data?.title as string | undefined) ?? null;
}
