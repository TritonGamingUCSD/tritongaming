import { randomUUID } from 'node:crypto';
import nodemailer, { type Transporter } from 'nodemailer';
import { MAX_BLAST, parseRecipients } from './recipients';
import { emailHtml, emailText, LOGO_CID } from './template';
import { SENDERS, senderAddress, senderReplyTo, type SenderId } from './senders';
import { APPLE_ICON_DATA_URI } from '@/lib/site/appleIcon';

// Sending email with nodemailer through a Gmail account (GMAIL_USER and a Google "app password" in GMAIL_APP_PASSWORD, both in .env.local / the host's settings). This is for admin testing:
// every message wears the club's template (template.ts), the caller supplies the exact addresses, every message goes to ONE person (never a shared To/Cc line, so nobody sees the others), and a blast is capped at MAX_BLAST.
// A normal Gmail account allows about 500 recipients a day (a Workspace account 2,000), so this is not a way to mail the whole club.

export const emailConfigured = () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
export const emailFrom = () => process.env.GMAIL_USER ?? '';

let transport: Transporter | null = null;
function getTransport() {
  transport ??= nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    pool: true, maxConnections: 2, maxMessages: 50,
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
  });
  return transport;
}

/** Logs in to the mail server without sending anything: tells whether the saved details work. */
export async function verifyEmail(): Promise<{ ok: boolean; error?: string }> {
  if (!emailConfigured()) return { ok: false, error: 'Email isn’t set up yet (GMAIL_USER and GMAIL_APP_PASSWORD).' };
  try { await getTransport().verify(); return { ok: true }; } catch (e) { return { ok: false, error: friendly(e) }; }
}

// The logo travels inside every email (an inline attachment the HTML points at as cid:tglogo), so it shows without the recipient's mail app reaching our site.
const LOGO = Buffer.from(APPLE_ICON_DATA_URI.replace(/^data:image\/png;base64,/, ''), 'base64');

function friendly(e: unknown): string {
  const code = (e as { code?: string; responseCode?: number }).code, rc = (e as { responseCode?: number }).responseCode;
  if (code === 'EAUTH' || rc === 535) return 'Gmail refused the login. Check GMAIL_USER and that GMAIL_APP_PASSWORD is a Google app password (not the normal password).';
  if (code === 'ETIMEDOUT' || code === 'ECONNECTION' || code === 'ESOCKET') return 'Couldn’t reach Gmail. Try again in a moment.';
  if (rc === 550 || rc === 553) return 'Gmail refused that address.';
  if (rc === 421 || rc === 450 || rc === 452) return 'Gmail is limiting sending right now (daily or per-minute limit). Try later.';
  return 'Gmail couldn’t send it.';
}

export interface BlastResult { to: string; ok: boolean; error?: string }

/** Sends `subject` and `message` (plain text; blank lines make paragraphs) to each address on its own. Returns one result per valid address; never throws. */
export async function sendBlast(recipientsText: string, subject: string, message: string): Promise<{ results: BlastResult[]; bad: string[]; error?: string }> {
  if (!emailConfigured()) return { results: [], bad: [], error: 'Email isn’t set up yet (GMAIL_USER and GMAIL_APP_PASSWORD).' };
  const { valid, bad } = parseRecipients(recipientsText);
  if (valid.length === 0) return { results: [], bad, error: 'Add at least one valid email address.' };
  if (valid.length > MAX_BLAST) return { results: [], bad, error: `That is ${valid.length} addresses; a test blast is limited to ${MAX_BLAST}.` };
  const t = getTransport();
  const results: BlastResult[] = [];
  for (const to of valid) {
    try {
      await t.sendMail({ from: `Triton Gaming <${emailFrom()}>`, to, subject, text: emailText(message), html: emailHtml({ subject, message }), attachments: [{ filename: 'tg-logo.png', content: LOGO, cid: LOGO_CID, contentType: 'image/png', contentDisposition: 'inline' }] });
      results.push({ to, ok: true });
    } catch (e) { results.push({ to, ok: false, error: friendly(e) }); }
  }
  return { results, bad };
}

/** Where replies go: EMAIL_REPLY_TO if it is set, else the sending address. One place to change when the club has a monitored inbox. */
export const emailReplyTo = () => process.env.EMAIL_REPLY_TO || emailFrom();

/** One message to one person with the exact html and text it is given (an event email, built elsewhere). `unsubscribeUrl` adds the one-click opt-out headers mail apps show as "Unsubscribe". Never throws. */
export async function sendOne(o: { to: string; subject: string; text: string; html: string; sender?: SenderId; unsubscribeUrl?: string }): Promise<BlastResult> {
  if (!emailConfigured()) return { to: o.to, ok: false, error: 'Email isn’t set up yet (GMAIL_USER and GMAIL_APP_PASSWORD).' };
  if (process.env.EMAIL_DRY_RUN === '1') return { to: o.to, ok: true };   // a test server sends nothing (the check scripts use it)
  try {
    const sender = o.sender ?? 'general', from = senderAddress(sender), replyTo = senderReplyTo(sender);
    await getTransport().sendMail({
      from: `${SENDERS[sender].name} <${from}>`, replyTo, to: o.to, subject: o.subject, text: o.text, html: o.html,
      // A message id on the club's own domain (not the server's machine name), a mailto opt-out beside the link, and the one-click header: all things mail providers look for in real mail.
      messageId: `<${randomUUID()}@${from.split('@')[1] || 'tritongaming.org'}>`,
      ...(o.unsubscribeUrl ? { headers: { 'List-Unsubscribe': `<${o.unsubscribeUrl}>, <mailto:${replyTo}?subject=Unsubscribe>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } } : {}),
      attachments: [{ filename: 'tg-logo.png', content: LOGO, contentType: 'image/png', cid: LOGO_CID }],
    });
    return { to: o.to, ok: true };
  } catch (e) { return { to: o.to, ok: false, error: friendly(e) }; }
}
