import type { SupabaseClient } from '@supabase/supabase-js';
import { EMAIL_COLUMNS, wantsEmail, type EmailKind } from '@/lib/email/prefs';
import { authEmails } from '@/lib/email/eventData';
import type { AudienceRules } from './rules';

export interface Recipient {
  user_id: string | null;
  subscriber_id: string | null;
  name: string;
  email: string;
}
export interface Audience {
  people: Recipient[];
  matched: number; // people the rules picked (accounts), before opt-outs
  skippedOptOut: number;
  skippedNoEmail: number;
  subscribers: number;
}

const chunk = <T>(a: T[], n: number): T[][] => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/** Every row of a query, a thousand at a time. */
async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < 100000; from += 1000) {
    const { data } = await page(from, from + 999);
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

/** Who the rules pick, as account ids (before opt-outs and exclusions). */
export async function pickedIds(svc: SupabaseClient, rules: AudienceRules): Promise<Set<string>> {
  const picked = new Set<string>();
  const add = (rows: { [k: string]: unknown }[], key: string) => rows.forEach((r) => typeof r[key] === 'string' && picked.add(r[key] as string));
  const jobs: Promise<void>[] = [];
  if (rules.everyone) jobs.push(all<{ id: string }>((a, b) => svc.from('profiles').select('id').order('id').range(a, b)).then((r) => add(r, 'id')));
  if (rules.roles.length)
    jobs.push(all<{ user_id: string }>((a, b) => svc.from('user_roles').select('user_id').in('role', rules.roles).order('user_id').range(a, b)).then((r) => add(r, 'user_id')));
  if (rules.divisions.length)
    jobs.push(
      all<{ user_id: string }>((a, b) => svc.from('user_roles').select('user_id').in('division_id', rules.divisions).order('user_id').range(a, b)).then((r) => add(r, 'user_id')),
    );
  if (rules.teams.length)
    jobs.push(
      (async () => {
        const { data } = await svc.from('meeting_groups').select('member_ids').in('id', rules.teams);
        for (const g of data ?? []) for (const id of (g.member_ids as string[] | null) ?? []) picked.add(id);
      })(),
    );
  for (const e of rules.events) {
    jobs.push(
      all<{ user_id: string }>((a, b) => {
        const q = svc.from('tickets').select('user_id').eq('event_id', e.id).eq('status', 'active').order('user_id').range(a, b);
        return e.who === 'checkedin' ? q.not('checked_in_at', 'is', null) : q;
      }).then((r) => add(r, 'user_id')),
    );
  }
  await Promise.all(jobs);
  rules.people.forEach((id) => picked.add(id));
  rules.exclude.forEach((id) => picked.delete(id));
  return picked;
}

/** The people to email for an issue: the accounts the rules pick minus those who turned this kind off (or all club emails) or have no address, plus active public subscribers. Sorted, one row per address. */
export async function resolveAudience(svc: SupabaseClient, rules: AudienceRules, kind: EmailKind): Promise<Audience> {
  const picked = [...(await pickedIds(svc, rules))].sort();
  const profiles = new Map<string, Record<string, unknown>>();
  for (const part of chunk(picked, 150)) {
    const { data } = await svc
      .from('profiles')
      .select(`id, display_name, preferred_email, ${EMAIL_COLUMNS.join(', ')}`)
      .in('id', part);
    for (const p of data ?? []) profiles.set((p as unknown as { id: string }).id, p as unknown as Record<string, unknown>);
  }
  const emails = picked.length ? await authEmails(svc, new Set(picked)) : new Map<string, string>();
  const people: Recipient[] = [];
  const seen = new Set<string>();
  let skippedOptOut = 0,
    skippedNoEmail = 0;
  for (const id of picked) {
    const p = profiles.get(id) ?? {};
    if (!wantsEmail(p, kind)) {
      skippedOptOut++;
      continue;
    }
    const email = ((typeof p.preferred_email === 'string' && p.preferred_email.includes('@') ? p.preferred_email : emails.get(id)) ?? '').toLowerCase();
    if (!email) {
      skippedNoEmail++;
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    people.push({ user_id: id, subscriber_id: null, name: (p.display_name as string | null) || '', email });
  }
  let subscribers = 0;
  if (rules.subscribers) {
    const subs = await all<{ id: string; email: string; name: string }>((a, b) =>
      svc.from('newsletter_subscribers').select('id, email, name').eq('status', 'active').order('email').range(a, b),
    );
    for (const s of subs) {
      if (seen.has(s.email)) continue;
      seen.add(s.email);
      subscribers++;
      people.push({ user_id: null, subscriber_id: s.id, name: s.name, email: s.email });
    }
  }
  return { people, matched: picked.length, skippedOptOut, skippedNoEmail, subscribers };
}
