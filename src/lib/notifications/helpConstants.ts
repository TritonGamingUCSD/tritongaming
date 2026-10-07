export const HELP_CATEGORIES = [
  { id: 'bug', label: 'Something is broken' },
  { id: 'question', label: 'Question' },
  { id: 'account', label: 'Account or roles' },
  { id: 'tickets', label: 'Tickets or check-in' },
  { id: 'doc', label: 'Doc problem' },
  { id: 'other', label: 'Other' },
] as const;
export type HelpCategory = (typeof HELP_CATEGORIES)[number]['id'];
export const HELP_STATUSES = [
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'resolved', label: 'Resolved' },
] as const;
export type HelpStatus = (typeof HELP_STATUSES)[number]['id'];

// Starter text for the details box, per category, so people include what we need to help them.
export const HELP_TEMPLATES: Record<HelpCategory, string> = {
  bug: 'What I was trying to do:\n\nWhat happened instead:\n\nWhat I expected to happen:\n',
  question: 'My question:\n',
  account: 'What I need changed (my role, name, email or something else):\n\nWhy:\n',
  tickets: 'Which event:\n\nWhat is going wrong with my ticket or check-in:\n',
  doc: 'What is wrong or out of date:\n',
  other: '',
};

// "I need a role": the starter message the dashboard's role card links to (/portal/help/ask?topic=role&role=officer). The role is one of ROLE_ASKS.
export const ROLE_ASKS = [
  { id: 'officer', label: 'Officer' },
  { id: 'division', label: 'Division lead' },
  { id: 'other', label: 'Something else' },
] as const;
export function roleRequest(role: string | null): { subject: string; body: string } {
  const ask = ROLE_ASKS.find((r) => r.id === role);
  const what = ask && ask.id !== 'other' ? ask.label : '';
  return {
    subject: what ? `Role request: ${what}` : 'Role or access request',
    body: `The role or access I need: ${what || '(for example officer, a division lead, or access to a specific tool)'}\n\nWhat I help with in Triton Gaming (team, division, events):\n\nWho can confirm this (an exec or lead I work with):\n\nAnything else we should know:\n`,
  };
}

export const MAX_SUBJECT = 100;
export const MAX_BODY = 2000;
export const MAX_ATTACHMENTS = 3;


// The structured role request ("Role wanted: Officer / Division: Esports / Who can vouch: …") and its reading back, so an admin's approve box starts on what was asked.
export const REQUESTABLE_ROLES = [{ id: 'officer', label: 'Officer' }, { id: 'lead', label: 'Lead' }, { id: 'division', label: 'Division lead' }] as const;
export type RequestableRole = (typeof REQUESTABLE_ROLES)[number]['id'];
export function roleRequestBody(r: { role: RequestableRole; division?: string; vouch: string; note?: string }): { subject: string; body: string } {
  const label = REQUESTABLE_ROLES.find((x) => x.id === r.role)?.label ?? r.role;
  return {
    subject: `Role request: ${label}`,
    body: [`Role wanted: ${label}`, r.role === 'division' && r.division ? `Division: ${r.division}` : '', `Who can vouch: ${r.vouch.trim()}`, r.note?.trim() ? `Anything else: ${r.note.trim()}` : ''].filter(Boolean).join('\n'),
  };
}
export function parseRoleRequest(subject: string, body: string): { role: RequestableRole | null; division: string | null } {
  const text = `${subject}\n${body}`;
  const wanted = /Role wanted:\s*(.+)/i.exec(text)?.[1] ?? /Role request:\s*(.+)/i.exec(subject)?.[1] ?? '';
  const role = REQUESTABLE_ROLES.find((x) => wanted.trim().toLowerCase().startsWith(x.label.toLowerCase()))?.id ?? null;
  const division = /^Division:\s*(.+)$/im.exec(body)?.[1]?.trim() ?? null;
  return { role, division };
}
