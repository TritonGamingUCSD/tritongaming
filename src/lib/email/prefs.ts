// Which club emails a member wants. Three kinds they can switch off one by one, and a master switch ("all club emails") above them. Everything is on until a member turns it off, and an
// opt-out is never overridden. Client-safe (the profile shows the same list); the signed opt-out link is in unsubscribe.ts (server only).
// The two oldest columns (email_reminders, email_notifications) existed before and were never used, so they carry the first two kinds.

export const EMAIL_KINDS = [
  { id: 'reminders', column: 'email_reminders', label: 'Event reminders', hint: 'The “starts soon” email for an event you have a ticket to.' },
  { id: 'updates', column: 'email_notifications', label: 'Event updates and announcements', hint: 'A change of room or time, or news about an event you have a ticket to.' },
  { id: 'newsletter', column: 'email_newsletter', label: 'Newsletter', hint: 'News from the club now and then.' },
] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number]['id'];
export const MASTER_COLUMN = 'email_all';
export const EMAIL_COLUMNS = [MASTER_COLUMN, ...EMAIL_KINDS.map((k) => k.column)] as const;

export type EmailPrefs = Partial<Record<(typeof EMAIL_COLUMNS)[number], boolean | null>>;

/** Does this member want this kind of email? Off in either the kind's own switch or the master switch means no. */
export function wantsEmail(p: EmailPrefs | null | undefined, kind: EmailKind): boolean {
  const col = EMAIL_KINDS.find((k) => k.id === kind)!.column;
  return p?.[MASTER_COLUMN] !== false && p?.[col] !== false;
}

export const isEmailKind = (v: unknown): v is EmailKind => EMAIL_KINDS.some((k) => k.id === v);
/** The most one day's sending may add up to. Gmail through a Google Workspace account allows about 2,000 messages a day. One place to change it. */
export const EMAIL_DAILY_LIMIT = 2000;
