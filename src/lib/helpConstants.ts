export const HELP_CATEGORIES = [
  { id: 'bug', label: 'Something is broken' },
  { id: 'question', label: 'Question' },
  { id: 'account', label: 'Account or roles' },
  { id: 'tickets', label: 'Tickets or check-in' },
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

