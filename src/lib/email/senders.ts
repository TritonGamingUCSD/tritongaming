// The addresses club email can come from. Each kind of email has its own sender (name + address + reply-to) so the newsletter can later come from newsletter@ and event emails from events@.
// Until an address is set (EMAIL_FROM_<SENDER>), every sender uses the one Gmail account (GMAIL_USER). A different address only works once it is a verified "Send mail as" alias of that account.
export const SENDERS = {
  general: { name: 'Triton Gaming', env: 'GENERAL' },
  events: { name: 'Triton Gaming Events', env: 'EVENTS' },
  newsletter: { name: 'Triton Gaming Newsletter', env: 'NEWSLETTER' },
} as const;
export type SenderId = keyof typeof SENDERS;

/** The sender for a kind of email (reminders and updates are events; the newsletter has its own). */
export const senderForKind = (kind: string): SenderId => (kind === 'newsletter' ? 'newsletter' : 'events');

export function senderAddress(id: SenderId): string {
  return process.env[`EMAIL_FROM_${SENDERS[id].env}`] || process.env.GMAIL_USER || '';
}
export function senderReplyTo(id: SenderId): string {
  return process.env[`EMAIL_REPLY_TO_${SENDERS[id].env}`] || process.env.EMAIL_REPLY_TO || senderAddress(id);
}
