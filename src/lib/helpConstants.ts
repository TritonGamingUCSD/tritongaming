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

export const MAX_SUBJECT = 100;
export const MAX_BODY = 2000;
export const MAX_ATTACHMENTS = 3;

