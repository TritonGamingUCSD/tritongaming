import { createHmac, timingSafeEqual } from 'node:crypto';
import { isEmailKind, type EmailKind } from './prefs';

// The opt-out link in every email: it names the member and the kind and is signed, so it works without signing in and cannot be made up for someone else. Server only.
const secret = () => process.env.EMAIL_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const sign = (body: string) => createHmac('sha256', secret()).update(body).digest('base64url');
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || 'https://tritongaming.org').replace(/\/$/, '');

export function unsubscribeToken(userId: string, kind: EmailKind): string {
  const body = Buffer.from(`${userId}.${kind}`).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function verifyUnsubscribeToken(token: string): { userId: string; kind: EmailKind } | null {
  const [body, sig] = String(token ?? '').split('.');
  if (!body || !sig || !secret()) return null;
  const want = sign(body);
  const a = Buffer.from(sig),
    b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [userId, kind] = Buffer.from(body, 'base64url').toString().split('.');
  return userId && isEmailKind(kind) ? { userId, kind } : null;
}

/** The link in the email: it opens the confirmation page for a person, and a mail app's one-click Unsubscribe posts to the same address. */
export const unsubscribeUrl = (userId: string, kind: EmailKind) => `${siteUrl()}/api/email/unsubscribe?t=${unsubscribeToken(userId, kind)}`;

// The confirm link in the one email a new public subscriber gets: it names the subscriber and is signed the same way, but its kind is "confirm", which is not an email kind, so it can't be used as an opt-out and an opt-out can't be used as it.
export const confirmToken = (subscriberId: string): string => {
  const body = Buffer.from(`${subscriberId}.confirm`).toString('base64url');
  return `${body}.${sign(body)}`;
};
export function verifyConfirmToken(token: string): string | null {
  const [body, sig] = String(token ?? '').split('.');
  if (!body || !sig || !secret()) return null;
  const a = Buffer.from(sig),
    b = Buffer.from(sign(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [id, kind] = Buffer.from(body, 'base64url').toString().split('.');
  return id && kind === 'confirm' ? id : null;
}
export const confirmUrl = (subscriberId: string) => `${siteUrl()}/newspaper/confirm?t=${confirmToken(subscriberId)}`;
